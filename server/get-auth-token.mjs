/* global fetch, btoa, atob */
/* This uses the AWS Secrets Manager to get the secret key for the GGGAUTH API. */
/* Docs: https://docs.aws.amazon.com/secretsmanager/latest/userguide/retrieving-secrets_lambda.html */
const getSecretKey = async () => {
  const secretName = "gggapi/keys";
  const endpoint = `http://localhost:2773/secretsmanager/get?secretId=${secretName}`;
  const headers = { "X-Aws-Parameters-Secrets-Token": process.env.AWS_SESSION_TOKEN };
  
  const secretsResponse = await fetch(endpoint, { headers });
  const secretsJson = await secretsResponse.json()
  const { SecretKey } = JSON.parse(secretsJson.SecretString);
  return SecretKey;
};

const getAuthToken = async ({ secretKey, code, code_verifier }) => {
  const endpoint = "https://www.pathofexile.com/oauth/token";
  
  const headers = { "Content-Type" : "application/x-www-form-urlencoded" };
  
  const urlencodedParams = new URLSearchParams();
  urlencodedParams.append("client_id", "exilediaryreborn");
  urlencodedParams.append("client_secret", secretKey);
  urlencodedParams.append("grant_type", "authorization_code");
  urlencodedParams.append("code", code);
  urlencodedParams.append("redirect_uri", "https://exilediary.com/auth/success");
  urlencodedParams.append("scope", "account:characters account:stashes");
  urlencodedParams.append("code_verifier", code_verifier);
  
  console.log(urlencodedParams.toString());
  
  const tokenResponse = await fetch(endpoint, {method: 'POST', body: urlencodedParams, headers});
  const jsonToken = tokenResponse.json();
  return jsonToken
}

export const handler = async(event, context) => {
  const secretKey = await getSecretKey();
  const params = new URLSearchParams(atob(event.body));
  const code = params.get('code');
  const code_verifier = params.get('code_verifier');
  

  const token = await getAuthToken({ secretKey, code, code_verifier });
  
  
  const response = {
      statusCode: 200,
      headers: {
          "Content-Type": "application/json",
      },
      host: event.headers.host,
      body: JSON.stringify({
          ...token
      }),
  };
  return response;
};
