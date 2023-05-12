import React, { useEffect, useState } from 'react';
import { Button } from '@mui/material';
import { useParams, useLoaderData, useNavigate } from 'react-router';
import { electronService } from '../electron.service';
import Logo from '../assets/img/icons/png/128x128.png';
import './Login.css';
import { ipcRenderer } from 'electron';
const { openExternal } = electronService.shell;
const { logger } = electronService;

type AuthData = {
  state: string,
  code_challenge: string,
}

// https://www.pathofexile.com/oauth/authorize?client_id=exilediaryreborn&response_type=code&scope=account:characters account:stashes&state=7815696ecbf1c96e6894b779456d330e&redirect_uri=https://exilediary.com/auth/success&code_challenge=IEaJXycQHHBqdlm8r_KwXaS1iAwV7Hoh_DTWYNmPx74&code_challenge_method=S256
function Login({}) {
  const { code_challenge, state } = useLoaderData() as AuthData;
  const url = `https://www.pathofexile.com/oauth/authorize?client_id=exilediaryreborn&response_type=code&scope=account:characters account:stashes&state=${state}&redirect_uri=https://exilediary.com/auth/success&code_challenge=${code_challenge}&code_challenge_method=S256`
  const openLink = () => {
    openExternal(url);
    setIsError(false);
    setIsOngoing(true);
  };
  const navigate = useNavigate();
  
  useEffect(() => {
    ipcRenderer.on('oauth:auth-failure', (event, arg) => {
      logger.info('Auth Failure, redirecting to the root page');
      setIsOngoing(false);
      setIsFetchingOauthToken(false);
      setIsError(true);
    });
    
    ipcRenderer.on('oauth:received-code', (event, arg) => {
      setIsOngoing(false);
      setIsFetchingOauthToken(true);
    });
    
    ipcRenderer.on('oauth:auth-success', (event, arg) => {
      logger.info('Auth Success, redirecting to the root page');
      navigate('/', { replace: true });
    });
  }, []);
  
  const [ isFetchingOauthToken, setIsFetchingOauthToken ] = useState(false);
  const [ isOngoing, setIsOngoing ] = useState(false);
  const [ isError, setIsError ] = useState(false);

  const warning = isOngoing ? <p>Please authenticate through the window that just opened</p> : null;
  
  return (
    <div className="Login">
      <div className="Login__Box">
        <img src={Logo} alt="Exile Diary Logo" className="Login__Logo"/>
        <h3>Exile Diary <span className="Text--Legendary">Reborn</span> requires you to log in with the PoE API to function</h3>
        {isFetchingOauthToken ? <p>Received Code, Fetching Oauth Token...</p> : null}
        {isError ? <p className='Test--Error'>Something went wrong, please try again</p> : null}
        <Button variant={isOngoing ? "outlined" : "contained"} color="primary" onClick={openLink}>
          Login with PoE
        </Button>
        <p className="Login__Warning">{warning}</p>
      </div>
    </div>
  );
}

export default Login;
