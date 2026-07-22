jest.mock('electron-log', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

import {
  EXILE_DIARY_PROTOCOL_SCHEMES,
  authCallbackFailureReasons,
  findExileDiaryProtocolUrl,
  parseExileDiaryProtocolUrl,
  processAuthCallbackUrl,
} from '../../../src/main/deepLinks/authCallback';

describe('auth callback deep links', () => {
  it('supports both registered deep-link schemes', () => {
    expect(EXILE_DIARY_PROTOCOL_SCHEMES).toEqual(['exile-diary://', 'exilediary://']);
  });

  it('finds the exile diary protocol URL in argv-like arrays', () => {
    expect(
      findExileDiaryProtocolUrl([
        'C:\\Program Files\\Exile Diary\\exile-diary.exe',
        'D:\\Dev\\exile-diary\\out\\electron\\main\\index.js',
        'exile-diary://auth?code=abc&state=xyz',
      ])
    ).toBe('exile-diary://auth?code=abc&state=xyz');
  });

  it('finds the exilediary protocol URL in argv-like arrays', () => {
    expect(
      findExileDiaryProtocolUrl([
        'C:\\Program Files\\Exile Diary\\exile-diary.exe',
        'exilediary://auth?code=abc&state=xyz',
      ])
    ).toBe('exilediary://auth?code=abc&state=xyz');
  });

  it('parses protocol URLs with code and state', () => {
    expect(parseExileDiaryProtocolUrl('exile-diary://auth?code=abc&state=xyz')).toEqual({
      rawUrl: 'exile-diary://auth?code=abc&state=xyz',
      code: 'abc',
      state: 'xyz',
    });
  });

  it('parses the exilediary protocol variant', () => {
    expect(parseExileDiaryProtocolUrl('exilediary://auth?code=abc&state=xyz')).toEqual({
      rawUrl: 'exilediary://auth?code=abc&state=xyz',
      code: 'abc',
      state: 'xyz',
    });
  });

  it('ignores invalid URLs', () => {
    expect(parseExileDiaryProtocolUrl('not-a-url')).toBeNull();
    expect(parseExileDiaryProtocolUrl('https://example.com/callback?code=abc')).toBeNull();
  });

  it('ignores callback URLs with a bad state', async () => {
    const result = await processAuthCallbackUrl('exile-diary://auth?code=abc&state=bad', {
      getActiveProfile: jest.fn(() => null),
      getCurrentCharacter: jest.fn(),
      getOauthToken: jest.fn(),
      getState: jest.fn(() => 'expected'),
      saveSettings: jest.fn(),
      sendAuthFailure: jest.fn(),
      saveToken: jest.fn(),
      sendAuthSuccess: jest.fn(),
      verifyState: jest.fn(() => false),
    });

    expect(result).toEqual({
      ok: false,
      reason: authCallbackFailureReasons.stateMismatch,
    });
  });

  it('completes the auth flow and leaves profile selection to the character picker', async () => {
    const getOauthToken = jest.fn(async () => ({ access_token: 'token' }));
    const saveToken = jest.fn(async () => undefined);
    const sendAuthSuccess = jest.fn();
    const getCurrentCharacter = jest.fn(async () => ({ name: 'Alice', league: 'Settlers' }));
    const saveSettings = jest.fn(async () => undefined);

    const result = await processAuthCallbackUrl('exile-diary://auth?code=abc&state=xyz', {
      getActiveProfile: jest.fn(() => null),
      getCurrentCharacter,
      getOauthToken,
      getState: jest.fn(() => 'xyz'),
      saveSettings,
      sendAuthFailure: jest.fn(),
      saveToken,
      sendAuthSuccess,
      verifyState: jest.fn((value: string) => value === 'xyz'),
    });

    expect(result).toEqual({ ok: true });
    expect(getOauthToken).toHaveBeenCalledWith('abc');
    expect(saveToken).toHaveBeenCalledWith({ access_token: 'token' });
    expect(sendAuthSuccess).toHaveBeenCalledTimes(1);
    expect(getCurrentCharacter).not.toHaveBeenCalled();
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it('skips profile seeding when an active profile already exists', async () => {
    const getCurrentCharacter = jest.fn(async () => ({ name: 'Alice', league: 'Settlers' }));
    const saveSettings = jest.fn(async () => undefined);

    const result = await processAuthCallbackUrl('exile-diary://auth?code=abc&state=xyz', {
      getActiveProfile: jest.fn(() => ({
        characterName: 'Existing',
        league: 'Standard',
        valid: true,
      })),
      getCurrentCharacter,
      getOauthToken: jest.fn(async () => ({ access_token: 'token' })),
      getState: jest.fn(() => 'xyz'),
      saveSettings,
      sendAuthFailure: jest.fn(),
      saveToken: jest.fn(async () => undefined),
      sendAuthSuccess: jest.fn(),
      verifyState: jest.fn((value: string) => value === 'xyz'),
    });

    expect(result).toEqual({ ok: true });
    expect(getCurrentCharacter).not.toHaveBeenCalled();
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it('does not fail the callback when the current character lookup returns nothing', async () => {
    const saveSettings = jest.fn(async () => undefined);
    const sendAuthSuccess = jest.fn();

    const result = await processAuthCallbackUrl('exile-diary://auth?code=abc&state=xyz', {
      getActiveProfile: jest.fn(() => null),
      getCurrentCharacter: jest.fn(async () => undefined as any),
      getOauthToken: jest.fn(async () => ({ access_token: 'token' })),
      getState: jest.fn(() => 'xyz'),
      saveSettings,
      sendAuthFailure: jest.fn(),
      saveToken: jest.fn(async () => undefined),
      sendAuthSuccess,
      verifyState: jest.fn((value: string) => value === 'xyz'),
    });

    expect(result).toEqual({ ok: true });
    expect(sendAuthSuccess).toHaveBeenCalledTimes(1);
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it('does not fail the callback when the current character lookup throws', async () => {
    const saveSettings = jest.fn(async () => undefined);
    const sendAuthSuccess = jest.fn();

    const result = await processAuthCallbackUrl('exile-diary://auth?code=abc&state=xyz', {
      getActiveProfile: jest.fn(() => null),
      getCurrentCharacter: jest.fn(async () => {
        throw new Error('timeout');
      }),
      getOauthToken: jest.fn(async () => ({ access_token: 'token' })),
      getState: jest.fn(() => 'xyz'),
      saveSettings,
      sendAuthFailure: jest.fn(),
      saveToken: jest.fn(async () => undefined),
      sendAuthSuccess,
      verifyState: jest.fn((value: string) => value === 'xyz'),
    });

    expect(result).toEqual({ ok: true });
    expect(sendAuthSuccess).toHaveBeenCalledTimes(1);
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it('does not start background profile seeding after auth success', async () => {
    let resolveCharacter: (() => void) | undefined;
    const characterPromise = new Promise<{ name: string; league: string }>((resolve) => {
      resolveCharacter = () => resolve({ name: 'Alice', league: 'Settlers' });
    });
    const getCurrentCharacter = jest.fn(() => characterPromise);
    const sendAuthSuccess = jest.fn();
    const saveSettings = jest.fn(async () => undefined);

    const callbackPromise = processAuthCallbackUrl('exile-diary://auth?code=abc&state=xyz', {
      getActiveProfile: jest.fn(() => null),
      getCurrentCharacter,
      getOauthToken: jest.fn(async () => ({ access_token: 'token' })),
      getState: jest.fn(() => 'xyz'),
      saveSettings,
      sendAuthFailure: jest.fn(),
      saveToken: jest.fn(async () => undefined),
      sendAuthSuccess,
      verifyState: jest.fn((value: string) => value === 'xyz'),
    });

    await expect(callbackPromise).resolves.toEqual({ ok: true });
    expect(sendAuthSuccess).toHaveBeenCalledTimes(1);
    expect(getCurrentCharacter).not.toHaveBeenCalled();
    expect(saveSettings).not.toHaveBeenCalled();

    resolveCharacter?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(saveSettings).not.toHaveBeenCalled();
  });

  it('fails when the callback URL is invalid', async () => {
    const sendAuthFailure = jest.fn();

    const result = await processAuthCallbackUrl('not-a-url', {
      getActiveProfile: jest.fn(() => null),
      getCurrentCharacter: jest.fn(),
      getOauthToken: jest.fn(),
      getState: jest.fn(() => 'expected'),
      saveSettings: jest.fn(),
      sendAuthFailure,
      saveToken: jest.fn(),
      sendAuthSuccess: jest.fn(),
      verifyState: jest.fn(() => false),
    });

    expect(result).toEqual({
      ok: false,
      reason: authCallbackFailureReasons.invalidUrl,
    });
    expect(sendAuthFailure).toHaveBeenCalledWith({
      reason: authCallbackFailureReasons.invalidUrl,
    });
  });

  it('fails when the callback is missing a code', async () => {
    const getOauthToken = jest.fn();
    const sendAuthFailure = jest.fn();

    const result = await processAuthCallbackUrl('exile-diary://auth?state=xyz', {
      getActiveProfile: jest.fn(() => null),
      getCurrentCharacter: jest.fn(),
      getOauthToken,
      getState: jest.fn(() => 'xyz'),
      saveSettings: jest.fn(),
      sendAuthFailure,
      saveToken: jest.fn(),
      sendAuthSuccess: jest.fn(),
      verifyState: jest.fn((value: string) => value === 'xyz'),
    });

    expect(result).toEqual({
      ok: false,
      reason: authCallbackFailureReasons.missingCode,
    });
    expect(getOauthToken).not.toHaveBeenCalled();
    expect(sendAuthFailure).toHaveBeenCalledWith({
      reason: authCallbackFailureReasons.missingCode,
    });
  });

  it('fails when the callback is missing a state', async () => {
    const getOauthToken = jest.fn();
    const sendAuthFailure = jest.fn();

    const result = await processAuthCallbackUrl('exile-diary://auth?code=abc', {
      getActiveProfile: jest.fn(() => null),
      getCurrentCharacter: jest.fn(),
      getOauthToken,
      getState: jest.fn(() => 'xyz'),
      saveSettings: jest.fn(),
      sendAuthFailure,
      saveToken: jest.fn(),
      sendAuthSuccess: jest.fn(),
      verifyState: jest.fn((value: string) => value === 'xyz'),
    });

    expect(result).toEqual({
      ok: false,
      reason: authCallbackFailureReasons.missingState,
    });
    expect(getOauthToken).not.toHaveBeenCalled();
    expect(sendAuthFailure).toHaveBeenCalledWith({
      reason: authCallbackFailureReasons.missingState,
    });
  });

  it('fails cleanly when token exchange throws', async () => {
    const getOauthToken = jest.fn(async () => {
      throw new Error('boom');
    });
    const sendAuthFailure = jest.fn();

    const result = await processAuthCallbackUrl('exile-diary://auth?code=abc&state=xyz', {
      getActiveProfile: jest.fn(() => null),
      getCurrentCharacter: jest.fn(),
      getOauthToken,
      getState: jest.fn(() => 'xyz'),
      saveSettings: jest.fn(),
      sendAuthFailure,
      saveToken: jest.fn(),
      sendAuthSuccess: jest.fn(),
      verifyState: jest.fn((value: string) => value === 'xyz'),
    });

    expect(result).toEqual({
      ok: false,
      reason: authCallbackFailureReasons.tokenExchangeFailed,
    });
    expect(sendAuthFailure).toHaveBeenCalledWith({
      reason: authCallbackFailureReasons.tokenExchangeFailed,
    });
  });

  it('fails cleanly when token save throws', async () => {
    const sendAuthFailure = jest.fn();

    const result = await processAuthCallbackUrl('exile-diary://auth?code=abc&state=xyz', {
      getActiveProfile: jest.fn(() => null),
      getCurrentCharacter: jest.fn(),
      getOauthToken: jest.fn(async () => ({ access_token: 'token' })),
      getState: jest.fn(() => 'xyz'),
      saveSettings: jest.fn(),
      sendAuthFailure,
      saveToken: jest.fn(async () => {
        throw new Error('save failed');
      }),
      sendAuthSuccess: jest.fn(),
      verifyState: jest.fn((value: string) => value === 'xyz'),
    });

    expect(result).toEqual({
      ok: false,
      reason: authCallbackFailureReasons.tokenSaveFailed,
    });
    expect(sendAuthFailure).toHaveBeenCalledWith({
      reason: authCallbackFailureReasons.tokenSaveFailed,
    });
  });

  it('completes auth success even when the profile has not been seeded yet', async () => {
    const sendAuthFailure = jest.fn();
    const sendAuthSuccess = jest.fn();
    const getOauthToken = jest.fn(async () => ({ access_token: 'token' }));
    const getCurrentCharacter = jest.fn(
      async () =>
        new Promise<{ name: string; league: string }>(() => {
          /* keep pending */
        })
    );

    const result = await processAuthCallbackUrl('exile-diary://auth?code=abc&state=xyz', {
      getActiveProfile: jest.fn(() => null),
      getCurrentCharacter,
      getOauthToken,
      getState: jest.fn(() => 'xyz'),
      saveSettings: jest.fn(),
      sendAuthFailure,
      saveToken: jest.fn(async () => undefined),
      sendAuthSuccess,
      verifyState: jest.fn((value: string) => value === 'xyz'),
    });

    expect(result).toEqual({ ok: true });
    expect(getOauthToken).toHaveBeenCalledWith('abc');
    expect(sendAuthSuccess).toHaveBeenCalledTimes(1);
    expect(sendAuthFailure).not.toHaveBeenCalled();
  });
});
