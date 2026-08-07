export interface Env {
  GGG_CLIENT_SECRET: string;
}

const GGG_TOKEN_ENDPOINT = 'https://www.pathofexile.com/oauth/token';
// Keep this version aligned with package.json. Any human or AI changing or deploying this Worker must update it to the latest desktop release.
const GGG_OAUTH_USER_AGENT = 'OAuth exile-diary-reborn/1.11.8 (contact: quentin@devauchelle.com)';
const PROJECT_URL = 'https://github.com/Qt-dev/exile-diary';
const REDIRECT_URI = 'https://exilediary.com/auth/success';
const OAUTH_SCOPE =
  'account:characters account:stashes account:league_accounts account:item_filter';
const MAX_TOKEN_REQUEST_BYTES = 8 * 1024;

const securityHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

function textResponse(status: number, message: string, headers: HeadersInit = {}) {
  return new Response(message, {
    status,
    headers: {
      ...securityHeaders,
      'Content-Type': 'text/plain; charset=utf-8',
      ...headers,
    },
  });
}

function redirectResponse(url: string) {
  return new Response(null, {
    status: 302,
    headers: {
      ...securityHeaders,
      Location: url,
    },
  });
}

function safeScriptValue(value: string) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function authSuccessPage(code: string, state: string) {
  const deepLink = `exile-diary://auth?${new URLSearchParams({ code, state }).toString()}`;
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const redirectUrl = safeScriptValue(deepLink);

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Exile Diary Authentication</title>
    <style>
      body { align-items: center; background: #000; color: #d0d0d0; display: flex; font-family: system-ui, sans-serif; justify-content: center; margin: 0; min-height: 100vh; text-align: center; }
      main { background: #111; border: 1px solid #333; border-radius: 8px; box-shadow: 0 4px 15px #19191980; max-width: 400px; padding: 30px 40px; }
      h1 { color: #fff; font-size: 1.4rem; margin-top: 0; }
      a { background: #8787fe; border-radius: 5px; color: #fff; display: inline-block; font-weight: 700; margin-top: 16px; padding: 12px 24px; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <h1>Authentication successful</h1>
      <p>Returning you to Exile Diary…</p>
      <p>If the app does not open, <a id="open-app" href="#">open Exile Diary</a>.</p>
    </main>
    <script nonce="${nonce}">
      const redirectUrl = ${redirectUrl};
      document.getElementById('open-app').href = redirectUrl;
      window.location.replace(redirectUrl);
    </script>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      ...securityHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'`,
    },
  });
}

async function exchangeToken(request: Request, env: Env) {
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) {
    return textResponse(415, 'Expected application/x-www-form-urlencoded request body.');
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > MAX_TOKEN_REQUEST_BYTES) {
    return textResponse(413, 'Request body is too large.');
  }

  const body = await request.text();
  if (body.length > MAX_TOKEN_REQUEST_BYTES) {
    return textResponse(413, 'Request body is too large.');
  }

  const submitted = new URLSearchParams(body);
  const code = submitted.get('code');
  const codeVerifier = submitted.get('code_verifier');
  if (!code || !codeVerifier) {
    return textResponse(400, 'Missing OAuth code or code verifier.');
  }

  const tokenRequest = new URLSearchParams({
    client_id: 'exilediaryreborn',
    client_secret: env.GGG_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    scope: OAUTH_SCOPE,
    code_verifier: codeVerifier,
  });

  const upstream = await fetch(GGG_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': GGG_OAUTH_USER_AGENT,
    },
    body: tokenRequest,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      ...securityHeaders,
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
    },
  });
}

const worker: ExportedHandler<Env> = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/') {
      if (request.method !== 'GET')
        return textResponse(405, 'Method not allowed.', { Allow: 'GET' });

      return redirectResponse(PROJECT_URL);
    }

    if (url.pathname === '/auth/success') {
      if (request.method !== 'GET')
        return textResponse(405, 'Method not allowed.', { Allow: 'GET' });

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code || !state) return textResponse(400, 'Missing OAuth code or state.');

      return authSuccessPage(code, state);
    }

    if (url.pathname === '/auth/token') {
      if (request.method !== 'POST')
        return textResponse(405, 'Method not allowed.', { Allow: 'POST' });
      return exchangeToken(request, env);
    }

    return textResponse(404, 'Not found.');
  },
};

export default worker;
