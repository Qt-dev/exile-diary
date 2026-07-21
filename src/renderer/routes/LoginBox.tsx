import React, { useEffect, useState } from 'react';
import { Button } from '@mui/material';
import { useLoaderData, useNavigate } from 'react-router';
import { electronService } from '../electron.service';
import Logo from '../assets/img/icons/png/128x128.png';
import './Login.css';
const { logger } = electronService;

type AuthData = {
  state: string;
  code_challenge: string;
};

const LoginBox = () => {
  const { code_challenge, state } = useLoaderData() as AuthData;
  const url =
    'https://www.pathofexile.com/oauth/authorize?' +
    'client_id=exilediaryreborn' +
    '&response_type=code' +
    '&scope=account:characters account:stashes account:league_accounts account:item_filter' +
    `&state=${state}` +
    '&redirect_uri=https://exilediary.com/auth/success' +
    `&code_challenge=${code_challenge}` +
    '&code_challenge_method=S256';

  const openLink = () => {
    electronService.openExternal(url);
    setIsError(false);
    setIsOngoing(true);
  };
  const navigate = useNavigate();
  const [isFetchingOauthToken, setIsFetchingOauthToken] = useState(false);
  const [isOngoing, setIsOngoing] = useState(false);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const redirectToCharacterSelect = async () => {
      const isAuthenticated = await electronService.isAuthenticated();
      if (isMounted && isAuthenticated) {
        logger.info('Auth is already complete, redirecting to the character select page');
        navigate('/login/character-select', { replace: true });
      }
    };

    const unsubscribeAuthFailure = electronService.on('oauthAuthFailure', () => {
      logger.info('Auth Failure, redirecting to the root page');
      setIsOngoing(false);
      setIsFetchingOauthToken(false);
      setIsError(true);
    });

    const unsubscribeReceivedCode = electronService.on('oauthReceivedCode', () => {
      setIsFetchingOauthToken(true);
    });

    const unsubscribeAuthSuccess = electronService.on('oauthAuthSuccess', () => {
      logger.info('Auth Success, redirecting to the character select page');
      if (isMounted) {
        navigate('/login/character-select', { replace: true });
      }
    });

    setIsError(false);
    setIsOngoing(false);
    setIsFetchingOauthToken(false);
    void redirectToCharacterSelect();

    return () => {
      isMounted = false;
      unsubscribeAuthFailure();
      unsubscribeReceivedCode();
      unsubscribeAuthSuccess();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="Login__Box Box">
      <img src={Logo} alt="Exile Diary Logo" className="Login__Logo" />
      <h3>
        Exile Diary <span className="Text--Legendary">Reborn</span> requires you to log in with the
        PoE API to function
      </h3>
      {isError ? <p className="Test--Error">Something went wrong, please try again</p> : null}
      <Button variant={isOngoing ? 'outlined' : 'contained'} color="primary" onClick={openLink}>
        Login with PoE
      </Button>
      {isFetchingOauthToken ? <p>Received Code, Fetching Oauth Token...</p> : null}
      {isOngoing && !isFetchingOauthToken ? (
        <p>Please authenticate through the window that just opened</p>
      ) : null}
    </div>
  );
};

export default LoginBox;
