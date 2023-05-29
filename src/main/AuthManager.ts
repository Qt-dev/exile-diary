import randomstring from 'randomstring';
import crypto from 'crypto';
import base64url from 'base64url';
import logger from 'electron-log';
import axios, { AxiosResponse } from 'axios';
import RendererLogger from './RendererLogger';
import moment from 'moment';
import keytar from 'keytar';
import SettingsManager from './SettingsManager';

const account = 'ggg:token';
const service = 'exilediary';
const code_verifier = randomstring.generate(128);
const base64Digest = crypto.createHash('sha256').update(code_verifier).digest('base64');
const code_challenge = base64url.fromBase64(base64Digest);

const state = randomstring.generate(32);

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

    const expirationTime = moment().add(token.expires_in, 'seconds').format('YYYY-MM-DD HH:mm:ss');
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
  saveToken: async (token) => {
    const { access_token, expires_in, username } = token;
    if (access_token === undefined || expires_in === undefined) {
      logger.error('Received bad information from the API', token);
      messenger.send('oauth:auth-failure');
      return;
    } else {
      logger.info('Saving token to the local storage');
      SettingsManager.set(
        'tokenExpirationDate',
        moment().add(expires_in, 'seconds').format('YYYY-MM-DD HH:mm:ss')
      );
      SettingsManager.set('username', username);
      await keytar.setPassword(service, account, access_token);
      await AuthManager.setLogoutTimer();
    }
  },
  isAuthenticated: async () => {
    logger.info('Checking if the user is authenticated');
    const password = await keytar.getPassword(service, account);
    const expirationDate = SettingsManager.get('tokenExpirationDate');
    const username = SettingsManager.get('username');
    const activeProfile = SettingsManager.get('activeProfile');
    const isAuthenticated =
      password !== null &&
      expirationDate !== null &&
      moment().isBefore(expirationDate) &&
      !!username &&
      !!activeProfile &&
      !!activeProfile.characterName &&
      !!activeProfile.league &&
      !!activeProfile.valid;
    logger.info(`User is ${isAuthenticated ? '' : 'not '}authenticated`, {
      password: !!password,
      expirationDate,
    });
    return isAuthenticated;
  },
  logout: async () => {
    logger.info('Logging out');
    await keytar.deletePassword(service, account);
    SettingsManager.delete('tokenExpirationDate');
    messenger.send('oauth:logged-out');
  },
  setLogoutTimer: async () => {
    if (await AuthManager.isAuthenticated()) {
      const tokenExiprationDate = SettingsManager.get('tokenExpirationDate');
      const realExpirationDate = moment(tokenExiprationDate).subtract(15, 'minutes');
      const millisecondsToExpiration = realExpirationDate.diff(moment());
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

      clearTimeout(logoutTimer);
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
    const password = await keytar.getPassword(service, account);
    return password;
  },
};

export default AuthManager;
