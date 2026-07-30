import assert from 'node:assert/strict';
import test from 'node:test';
import worker, { type Env } from '../src/index';

const env: Env = { GGG_CLIENT_SECRET: 'test-secret' };

test('redirects the legacy API root to the project repository', async () => {
  const response = await worker.fetch(
    new Request('https://exilediary.com/'),
    env,
    {} as ExecutionContext
  );

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://github.com/Qt-dev/exile-diary');
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
});

test('renders a safe app deep-link for a valid OAuth callback', async () => {
  const response = await worker.fetch(
    new Request('https://exilediary.com/auth/success?code=abc%3Cscript%3E&state=state%26value'),
    env,
    {} as ExecutionContext
  );

  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy') ?? '', /script-src 'nonce-/);
  assert.match(html, /exile-diary:\/\/auth\?code=abc%3Cscript%3E&state=state%26value/);
  assert.doesNotMatch(html, /<script><\/script>/);
});

test('rejects malformed token requests before they reach GGG', async () => {
  const response = await worker.fetch(
    new Request('https://exilediary.com/auth/token', { method: 'POST', body: 'code=abc' }),
    env,
    {} as ExecutionContext
  );

  assert.equal(response.status, 415);
});

test('exchanges a form-encoded OAuth code without exposing the client secret', async () => {
  const originalFetch = globalThis.fetch;
  let upstreamBody = '';
  globalThis.fetch = async (_input, init) => {
    upstreamBody = String(init?.body);
    return new Response(
      JSON.stringify({ access_token: 'token', expires_in: 3600, username: 'account' }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  };

  try {
    const response = await worker.fetch(
      new Request('https://exilediary.com/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'code=code-value&code_verifier=verifier-value',
      }),
      env,
      {} as ExecutionContext
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
    assert.match(upstreamBody, /client_secret=test-secret/);
    assert.match(upstreamBody, /code_verifier=verifier-value/);
    assert.deepEqual(await response.json(), {
      access_token: 'token',
      expires_in: 3600,
      username: 'account',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
