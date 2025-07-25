import randomstring from 'randomstring';
import crypto from 'crypto';
import base64url from 'base64url';
import Logger from 'electron-log';
import axios, { AxiosResponse } from 'axios';
import RendererLogger from './RendererLogger';
import dayjs from 'dayjs';
import Store from 'electron-store';
import SettingsManager from './SettingsManager';

const storeKey = 'token';
const logger = Logger.scope('Auth');
const code_verifier = randomstring.generate(128);
const base64Digest = crypto.createHash('sha256').update(code_verifier).digest('base64');
const code_challenge = base64url.fromBase64(base64Digest);

const state = randomstring.generate(32);

type FullToken = {
  access_token: string;
  expires_in: number;
  username: string;
};

const TokenStore = new Store({
  name: 'creds',
  encryptionKey: 'exilediary',
  fileExtension: 'token',
});

let logoutTimer;
let messenger;

const AuthManager = {
  setMessenger: (ipcMain) => {
    messenger = ipcMain;
  },
  getAuthInfo: () => {
    return {
      code_verifier,
      code_challenge,
      state,
    };
  },
  verifyState: (inputState) => {
    return state === inputState;
  },
  getState: () => {
    return state;
  },
  getOauthToken: async (code) => {
    logger.info('Getting oauth token from the GGG API');
    const url = `https://exilediary.com/auth/token`;
    messenger.send('oauth:received-code');

    const urlencodedParams = new URLSearchParams();
    urlencodedParams.append('code', code);
    urlencodedParams.append('code_verifier', code_verifier);

    const response: AxiosResponse = await axios.post(url, urlencodedParams);
    const token = await response.data;

    const expirationTime = dayjs().add(token.expires_in, 'seconds').format('YYYY-MM-DD HH:mm:ss');
    logger.info(
      `Fetched token from the GGG API for ${token.username}. It expires on ${expirationTime} (${token.expires_in} seconds)`
    );
    RendererLogger.log({
      messages: [
        {
          text: 'Got a token for ',
        },
        {
          text: token.username,
          type: 'important',
        },
        {
          text: '. It expires on ',
        },
        {
          text: expirationTime,
          type: 'important',
        },
        {
          text: ` (in ${token.expires_in} seconds).`,
        },
      ],
    });
    return token;
  },
  saveToken: async (token: FullToken) => {
    const { access_token, expires_in, username } = token;
    if (access_token === undefined || expires_in === undefined) {
      logger.error('Received bad information from the API', token);
      messenger.send('oauth:auth-failure');
      return;
    } else {
      logger.info('Saving token to the local storage');
      SettingsManager.set(
        'tokenExpirationDate',
        dayjs().add(expires_in, 'seconds').format('YYYY-MM-DD HH:mm:ss')
      );
      SettingsManager.set('username', username);
      TokenStore.set(storeKey, access_token);
      await AuthManager.setLogoutTimer(true);
    }
  },
  isAuthenticated: async (isFirstTime = false) => {
    logger.info('Checking if the user is authenticated');
    const password = TokenStore.get(storeKey);
    const expirationDate = SettingsManager.get('tokenExpirationDate');
    const username = SettingsManager.get('username');
    const activeProfile = SettingsManager.get('activeProfile');
    const isAuthenticated =
      !!password &&
      expirationDate !== null &&
      dayjs().isBefore(expirationDate) &&
      !!username &&
      (!isFirstTime
        ? !!activeProfile &&
          !!activeProfile.characterName &&
          !!activeProfile.league &&
          !!activeProfile.valid
        : true);
    logger.info(`User is ${isAuthenticated ? '' : 'not '}authenticated`, {
      password: !!password,
      expirationDate,
    });
    return isAuthenticated;
  },
  logout: async () => {
    logger.info('Logging out');
    TokenStore.reset(storeKey);
    SettingsManager.delete('tokenExpirationDate');
    messenger.send('oauth:logged-out');
  },
  setLogoutTimer: async (isFirstTime = false) => {
    if (await AuthManager.isAuthenticated(isFirstTime)) {
      const tokenExiprationDate = SettingsManager.get('tokenExpirationDate');
      const realExpirationDate = dayjs(tokenExiprationDate).subtract(15, 'minutes');
      const millisecondsToExpiration = realExpirationDate.diff(dayjs());
      logger.info(
        `Setting logout timer to ${realExpirationDate.format(
          'YYYY-MM-DD HH:mm:ss'
        )}, in ${millisecondsToExpiration} milliseconds`
      );
      RendererLogger.log({
        messages: [
          {
            text: 'Your GGG Token expires on ',
          },
          {
            text: realExpirationDate.format('YYYY-MM-DD HH:mm:ss'),
            type: 'important',
          },
          {
            text: '. Exile Diary will log you out on that time if you do not log in again before that from the ',
          },
          {
            text: 'Settings page',
            type: 'important',
            link: '/settings',
          },
          {
            text: '.',
          },
        ],
      });

      if (logoutTimer) clearTimeout(logoutTimer);
      const maxTimeout = 2147483647; // Max timeout for setTimeout
      if (millisecondsToExpiration > maxTimeout) {
        logger.info(
          `Logout timer is too long (${millisecondsToExpiration} milliseconds), checking again in  ${
            maxTimeout / 2
          } milliseconds`
        );
        logoutTimer = setTimeout(() => {
          AuthManager.setLogoutTimer();
        }, maxTimeout / 2);
      } else {
        logoutTimer = setTimeout(() => {
          logger.info('Token expired, logging out');
          AuthManager.logout().then(() => {
            messenger.send('oauth:expired-token');
          });
        }, millisecondsToExpiration);
      }
    }
  },
  getToken: async () => {
    logger.info('Getting token from the local storage');
    const password = TokenStore.get(storeKey);
    return password;
  },
};

export default AuthManager;
