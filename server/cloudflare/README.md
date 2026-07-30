# Cloudflare auth service

This Worker replaces the API Gateway routes and three AWS Lambda functions currently documented in `server/infrastructure.drawio`.

| Public route | Behaviour |
| --- | --- |
| `GET /` | Preserves the legacy redirect to the Exile Diary GitHub repository. |
| `GET /auth/success` | Receives the Path of Exile OAuth callback and safely opens `exile-diary://auth`. |
| `POST /auth/token` | Exchanges an authorization code and PKCE verifier for the token used by the desktop client. |

The Worker intentionally has no database, R2 binding, or CORS policy. The desktop main process calls `/auth/token`; browsers never need to call it cross-origin.

## Local development

1. Copy `.dev.vars.example` to `.dev.vars` and fill in the real client secret.
2. Run `npm run cloudflare:auth:dev`.
3. Use `http://localhost:8787/auth/success?code=test&state=test` to check the callback page. Do not use a local callback URL with the real OAuth provider unless that callback is explicitly registered for the client.

## Deployment

The production route requires `exilediary.com` to be an active Cloudflare zone with the relevant DNS record proxied. Follow [the migration runbook](../../docs/runbooks/cloudflare-migration.md) before deploying.

```powershell
npx wrangler secret put GGG_CLIENT_SECRET --config server/cloudflare/wrangler.jsonc
npm run cloudflare:auth:deploy
```

The Worker’s secret replaces AWS Secrets Manager. Keep it out of `.dev.vars`, GitHub Actions logs, source code, and issue reports.
