# Cloudflare OAuth Worker maintenance

Before changing or deploying `server/cloudflare`, read the root `package.json` and use its current `version` for the OAuth User-Agent in `server/cloudflare/src/index.ts`.

The User-Agent must remain in this form:

```text
OAuth exile-diary-reborn/<package.json version> (contact: quentin@devauchelle.com)
```

This applies to human and AI-assisted changes. Do not deploy a stale version. Run the Worker test and typecheck before deployment; the test compares the outbound User-Agent with `package.json.version`.

Never log or expose `GGG_CLIENT_SECRET`, authorization codes, PKCE verifiers, access tokens, or refresh tokens. After deployment, verify the Wrangler version ID and complete a fresh real OAuth login rather than reusing an authorization code.
