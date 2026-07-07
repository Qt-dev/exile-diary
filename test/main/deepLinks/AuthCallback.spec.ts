jest.mock('electron-log', () => ({
  info: jest.fn(),
}));

import {
  findExileDiaryProtocolUrl,
  parseExileDiaryProtocolUrl,
  processAuthCallbackUrl,
} from '../../../src/main/deepLinks/authCallback';

describe('auth callback deep links', () => {
  it('finds the exile diary protocol URL in argv-like arrays', () => {
    expect(
      findExileDiaryProtocolUrl([
        'C:\\Program Files\\Exile Diary\\exile-diary.exe',
        'D:\\Dev\\exile-diary\\out\\electron\\main\\index.js',
        'exile-diary://auth?code=abc&state=xyz',
      ])
    ).toBe('exile-diary://auth?code=abc&state=xyz');
  });

  it('parses protocol URLs with code and state', () => {
    expect(parseExileDiaryProtocolUrl('exile-diary://auth?code=abc&state=xyz')).toEqual({
      rawUrl: 'exile-diary://auth?code=abc&state=xyz',
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
      isAuthenticated: jest.fn(),
      saveSettings: jest.fn(),
      saveToken: jest.fn(),
      sendAuthSuccess: jest.fn(),
      verifyState: jest.fn(() => false),
    });

    expect(result).toBe(false);
  });

  it('completes the auth flow and seeds the active profile when needed', async () => {
    const getOauthToken = jest.fn(async () => ({ access_token: 'token' }));
    const saveToken = jest.fn(async () => undefined);
    const isAuthenticated = jest.fn(async () => true);
    const sendAuthSuccess = jest.fn();
    const getCurrentCharacter = jest.fn(async () => ({ name: 'Alice', league: 'Settlers' }));
    const saveSettings = jest.fn(async () => undefined);

    const result = await processAuthCallbackUrl('exile-diary://auth?code=abc&state=xyz', {
      getActiveProfile: jest.fn(() => null),
      getCurrentCharacter,
      getOauthToken,
      getState: jest.fn(() => 'xyz'),
      isAuthenticated,
      saveSettings,
      saveToken,
      sendAuthSuccess,
      verifyState: jest.fn((value: string) => value === 'xyz'),
    });

    expect(result).toBe(true);
    expect(getOauthToken).toHaveBeenCalledWith('abc');
    expect(saveToken).toHaveBeenCalledWith({ access_token: 'token' });
    expect(isAuthenticated).toHaveBeenCalledWith(true);
    expect(sendAuthSuccess).toHaveBeenCalledTimes(1);
    expect(getCurrentCharacter).toHaveBeenCalledTimes(1);
    expect(saveSettings).toHaveBeenCalledWith({
      activeProfile: {
        characterName: 'Alice',
        league: 'Settlers',
        valid: true,
      },
    });
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
      isAuthenticated: jest.fn(async () => true),
      saveSettings,
      saveToken: jest.fn(async () => undefined),
      sendAuthSuccess: jest.fn(),
      verifyState: jest.fn((value: string) => value === 'xyz'),
    });

    expect(result).toBe(true);
    expect(getCurrentCharacter).not.toHaveBeenCalled();
    expect(saveSettings).not.toHaveBeenCalled();
  });
});
