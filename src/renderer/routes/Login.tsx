import React from 'react';
import { Button } from '@mui/material';
import { useParams, useLoaderData } from 'react-router';
import { electronService } from '../electron.service';
const { openExternal } = electronService.shell;

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
  };

  return (
    <div className="Root">
      <h3>Exile Diary Reborn requires you to log in with the PoE API to function</h3>
      <Button variant="contained" color="primary" onClick={openLink}>
        Login with PoE
      </Button>
    </div>
  );
}

export default Login;
