import logger from 'electron-log';

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
  isAuthenticated: (isFirstTime: boolean) => Promise<boolean>;
  saveSettings: (settings: Record<string, unknown>) => Promise<unknown>;
  saveToken: (token: Token) => Promise<unknown>;
  sendAuthSuccess: () => void;
  verifyState: (state: string) => boolean;
};

function hasValidActiveProfile(activeProfile: ActiveProfile) {
  return !!(
    activeProfile &&
    activeProfile.valid &&
    activeProfile.characterName &&
    activeProfile.league
  );
}

export function findExileDiaryProtocolUrl(values: string[]) {
  return values.find((value) => value.startsWith('exile-diary://'));
}

export function parseExileDiaryProtocolUrl(rawUrl: string) {
  try {
    const parsedUrl = new URL(rawUrl);
    if (parsedUrl.protocol !== 'exile-diary:') {
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

export async function processAuthCallbackUrl(rawUrl: string, deps: AuthCallbackDeps) {
  const parsedCallback = parseExileDiaryProtocolUrl(rawUrl);
  if (!parsedCallback) {
    logger.info(`Ignoring non Exile Diary protocol URL: ${rawUrl}`);
    return false;
  }

  const { code, state } = parsedCallback;
  if (!code || !state || !deps.verifyState(state)) {
    logger.info('No access token from Lambda', code, state, deps.getState());
    logger.info(rawUrl);
    return false;
  }

  logger.info('We got an access token from Lambda');
  const token = await deps.getOauthToken(code);
  await deps.saveToken(token);

  const isAuthenticated = await deps.isAuthenticated(true);
  if (!isAuthenticated) {
    return false;
  }

  deps.sendAuthSuccess();

  if (!hasValidActiveProfile(deps.getActiveProfile())) {
    const character = await deps.getCurrentCharacter();
    await deps.saveSettings({
      activeProfile: {
        characterName: character.name,
        league: character.league,
        valid: true,
      },
    });
  }

  return true;
}
