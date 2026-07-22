import logger from 'electron-log';

export const EXILE_DIARY_PROTOCOL_SCHEMES = ['exile-diary://', 'exilediary://'] as const;
export const authCallbackFailureReasons = {
  invalidUrl: 'invalid-url',
  missingCode: 'missing-code',
  missingState: 'missing-state',
  stateMismatch: 'state-mismatch',
  tokenExchangeFailed: 'token-exchange-failed',
  tokenSaveFailed: 'token-save-failed',
} as const;

export type AuthCallbackFailureReason =
  (typeof authCallbackFailureReasons)[keyof typeof authCallbackFailureReasons];

export type AuthCallbackFailurePayload = {
  reason: AuthCallbackFailureReason;
};

export type AuthCallbackResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      reason: AuthCallbackFailureReason;
    };

type ActiveProfile = {
  characterName?: string | null;
  league?: string | null;
  valid?: boolean;
} | null;

type Character = {
  name: string;
  league: string;
};

type Token = unknown;

type AuthCallbackDeps = {
  getActiveProfile: () => ActiveProfile;
  getCurrentCharacter: () => Promise<Character>;
  getOauthToken: (code: string) => Promise<Token>;
  getState: () => string;
  saveSettings: (settings: Record<string, unknown>) => Promise<unknown>;
  sendAuthFailure: (payload: AuthCallbackFailurePayload) => void;
  saveToken: (token: Token) => Promise<unknown>;
  sendAuthSuccess: () => void;
  verifyState: (state: string) => boolean;
};

export function findExileDiaryProtocolUrl(values: string[]) {
  return values.find((value) =>
    EXILE_DIARY_PROTOCOL_SCHEMES.some((scheme) => value.startsWith(scheme))
  );
}

export function parseExileDiaryProtocolUrl(rawUrl: string) {
  try {
    const parsedUrl = new URL(rawUrl);
    if (!['exile-diary:', 'exilediary:'].includes(parsedUrl.protocol)) {
      return null;
    }

    return {
      rawUrl,
      code: parsedUrl.searchParams.get('code'),
      state: parsedUrl.searchParams.get('state'),
    };
  } catch {
    return null;
  }
}

function failAuthCallback(
  rawUrl: string,
  reason: AuthCallbackFailureReason,
  deps: Pick<AuthCallbackDeps, 'sendAuthFailure'>
): AuthCallbackResult {
  logger.info('OAuth callback failed', { rawUrl, reason });
  deps.sendAuthFailure({ reason });
  return {
    ok: false,
    reason,
  };
}

export async function processAuthCallbackUrl(rawUrl: string, deps: AuthCallbackDeps) {
  logger.info('OAuth callback received', { rawUrl });
  const parsedCallback = parseExileDiaryProtocolUrl(rawUrl);
  if (!parsedCallback) {
    return failAuthCallback(rawUrl, authCallbackFailureReasons.invalidUrl, deps);
  }

  const { code, state } = parsedCallback;
  logger.info('OAuth callback parsed', {
    codePresent: !!code,
    rawUrl,
    statePresent: !!state,
  });

  if (!code) {
    return failAuthCallback(rawUrl, authCallbackFailureReasons.missingCode, deps);
  }

  if (!state) {
    return failAuthCallback(rawUrl, authCallbackFailureReasons.missingState, deps);
  }

  const isStateValid = deps.verifyState(state);
  logger.info('OAuth callback state validation completed', {
    isStateValid,
    rawUrl,
    statePresent: true,
  });

  if (!isStateValid) {
    logger.info('OAuth callback state mismatch', { expectedStatePresent: !!deps.getState(), rawUrl });
    return failAuthCallback(rawUrl, authCallbackFailureReasons.stateMismatch, deps);
  }

  logger.info('OAuth callback entering token exchange', { rawUrl });
  let token: Token;
  try {
    token = await deps.getOauthToken(code);
  } catch (error) {
    logger.error('OAuth callback token exchange failed', {
      error,
      rawUrl,
      reason: authCallbackFailureReasons.tokenExchangeFailed,
    });
    return failAuthCallback(rawUrl, authCallbackFailureReasons.tokenExchangeFailed, deps);
  }

  try {
    await deps.saveToken(token);
  } catch (error) {
    logger.error('OAuth callback token save failed', {
      error,
      rawUrl,
      reason: authCallbackFailureReasons.tokenSaveFailed,
    });
    return failAuthCallback(rawUrl, authCallbackFailureReasons.tokenSaveFailed, deps);
  }

  deps.sendAuthSuccess();
  logger.info('OAuth callback emitted auth success', { rawUrl });

  return {
    ok: true,
  };
}
