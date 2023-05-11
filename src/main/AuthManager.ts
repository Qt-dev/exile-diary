import randomstring from 'randomstring';
import crypto from 'crypto';
import base64url from 'base64url';
import logger from 'electron-log';
import axios, { AxiosResponse } from 'axios';
import RendererLogger from './RendererLogger';
import moment from 'moment';

const code_verifier = randomstring.generate(128);
const base64Digest = crypto
  .createHash("sha256")
  .update(code_verifier)
  .digest("base64");
const code_challenge = base64url.fromBase64(base64Digest);

const state = randomstring.generate(32);

export default {
  getAuthInfo: () => {
    return {
      code_verifier, code_challenge, state
    }
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


    const headers = new Headers();
    headers.append("Content-Type", "application/x-www-form-urlencoded");

    const urlencodedParams = new URLSearchParams();
    urlencodedParams.append("code", code);
    urlencodedParams.append("scope", "account:characters account:stashes");
    urlencodedParams.append("code_verifier", code_verifier);

    const response: AxiosResponse = await axios.post(url, urlencodedParams);
    const token = await response.data;

    const expirationTime = moment().add(token.expires_in, 'seconds').format('YYYY-MM-DD HH:mm:ss');
    logger.info(`Fetched token from the GGG API for ${token.username}. It expires on ${expirationTime} (${token.expires_in} seconds)`);
    RendererLogger.log({
      messages: [
        {
          text: 'Got a token for '
        },
        {
          text: token.username,
          type: 'important'
        },
        {
          text: '. It expires on '
        },
        {
          text: expirationTime,
          type: 'important'
        },
        {
          text: ` (in ${token.expires_in} seconds).`
        }
      ]
    });
    return token;
  },
}