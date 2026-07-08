import {
  authCallbackFailureReasons,
  processAuthCallbackUrl,
} from '../../../src/main/deepLinks/authCallback';
import { OAuthCallbackFlowCoordinator } from '../../../src/main/deepLinks/OAuthCallbackFlowCoordinator';

describe('OAuth callback flow integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes a valid protocol callback into token exchange and emits progress/success events', async () => {
    const sentEvents: Array<[string, unknown?]> = [];
    const getOauthToken = jest.fn(async (code: string) => {
      sentEvents.push(['oauth:received-code']);
      return {
        access_token: `token-for-${code}`,
        expires_in: 3600,
        username: 'Alice',
      };
    });

    const coordinator = new OAuthCallbackFlowCoordinator({
      processProtocolUrl: (protocolUrl) =>
        processAuthCallbackUrl(protocolUrl, {
          getActiveProfile: () => ({
            characterName: 'Alice',
            league: 'Settlers',
            valid: true,
          }),
          getCurrentCharacter: async () => ({
            name: 'Alice',
            league: 'Settlers',
          }),
          getOauthToken,
          getState: () => 'xyz',
          saveSettings: async () => undefined,
          sendAuthFailure: (payload) => sentEvents.push(['oauth:auth-failure', payload]),
          saveToken: async () => undefined,
          sendAuthSuccess: () => sentEvents.push(['oauth:auth-success']),
          verifyState: (state) => state === 'xyz',
        }),
    });

    await coordinator.setReady();
    await coordinator.handleProtocolUrl('exile-diary://auth?code=abc123&state=xyz');

    expect(getOauthToken).toHaveBeenCalledWith('abc123');
    expect(sentEvents).toEqual([['oauth:received-code'], ['oauth:auth-success']]);
  });

  it('surfaces state mismatch without starting token exchange', async () => {
    const sentEvents: Array<[string, unknown?]> = [];
    const getOauthToken = jest.fn();

    const coordinator = new OAuthCallbackFlowCoordinator({
      processProtocolUrl: (protocolUrl) =>
        processAuthCallbackUrl(protocolUrl, {
          getActiveProfile: () => null,
          getCurrentCharacter: async () => ({
            name: 'Alice',
            league: 'Settlers',
          }),
          getOauthToken,
          getState: () => 'expected-state',
          saveSettings: async () => undefined,
          sendAuthFailure: (payload) => sentEvents.push(['oauth:auth-failure', payload]),
          saveToken: async () => undefined,
          sendAuthSuccess: () => sentEvents.push(['oauth:auth-success']),
          verifyState: () => false,
        }),
    });

    await coordinator.setReady();
    await coordinator.handleProtocolUrl('exile-diary://auth?code=abc123&state=wrong');

    expect(getOauthToken).not.toHaveBeenCalled();
    expect(sentEvents).toEqual([
      ['oauth:auth-failure', { reason: authCallbackFailureReasons.stateMismatch }],
    ]);
  });
});
