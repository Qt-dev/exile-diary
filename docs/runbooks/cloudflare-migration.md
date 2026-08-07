# Cloudflare migration: auth and pricing

This runbook moves the small AWS authentication service in `server/` and the pricing delivery hostname to Cloudflare while retaining the public URLs:

- `https://exilediary.com/` (legacy project redirect)
- `https://exilediary.com/auth/success`
- `https://exilediary.com/auth/token`
- `https://prices.exilediary.com/v1`

It does **not** transfer the domain registration away from AWS. It changes only the authoritative nameservers from the Route 53 hosted zone to Cloudflare. Retain the Route 53 zone and AWS resources through the rollback window.

## Prerequisites

1. Create or select the Cloudflare account that will own both the `exilediary.com` zone and the R2 bucket.
2. Create the GitHub environment `cloudflare-production` and add:
   - `CLOUDFLARE_API_TOKEN`: scoped to Workers Scripts/Edit, Account Settings/Read, Zone/Read, Zone/DNS/Edit, and R2/Edit for this account only.
   - `CLOUDFLARE_ACCOUNT_ID`: the target account ID.
3. Create a Cloudflare R2 subscription and the Standard bucket `exile-diary-pricing-production`. Do not enable `r2.dev` for production.
4. Export the Route 53 hosted-zone record set. Record every A, AAAA, CNAME, MX, TXT, CAA, SRV, and validation record. Do not rely only on Cloudflare’s quick scan.
5. Determine whether DNSSEC is enabled at the registrar. If it is, plan the DNSSEC handoff before changing nameservers.

## Build and verify the Worker

1. Put the Path of Exile OAuth client secret into `server/cloudflare/.dev.vars` locally.
2. Run `npm run cloudflare:auth:test` and `npm run cloudflare:auth:dev`.
3. Set the production secret directly in Cloudflare:

   ```powershell
   npx wrangler secret put GGG_CLIENT_SECRET --config server/cloudflare/wrangler.jsonc
   ```

4. Do not place that secret in a GitHub Actions secret unless the deployment process is intentionally changed to update it. The workflow deploys code only and preserves the existing Worker secret.

## Move authoritative DNS

1. Add `exilediary.com` to Cloudflare on the Free plan and import/recreate the Route 53 records.
2. Compare the Cloudflare zone with the Route 53 export manually. Preserve mail and third-party verification records as DNS-only.
3. Keep the current AWS/API Gateway origin records present and DNS-only until the zone is ready. Once the zone is active, proxy only hostnames that Cloudflare should serve.
4. At the registrar, disable or migrate DNSSEC as appropriate, then replace the Route 53 nameservers with the two Cloudflare nameservers assigned to the zone.
5. Wait for the Cloudflare zone to become **Active**. Verify the apex, `www`, mail records, and every third-party validation hostname before proceeding.

## Activate the Worker

1. Ensure the `exilediary.com` DNS record used for the existing API Gateway is proxied (orange cloud). The Worker route deliberately covers `exilediary.com/*`, preserving the legacy root redirect as well as both OAuth paths. A Worker Route needs a proxied record.
2. Deploy with `npm run cloudflare:auth:deploy`, or manually run the `Deploy Cloudflare auth worker` workflow.
3. Test `/auth/success` with synthetic parameters and then complete a real desktop OAuth flow. Confirm that the OAuth callback opens the desktop app and that the app receives a token.
4. Confirm that the Worker response includes `Cache-Control: no-store` and that Cloudflare logs do not contain client secrets, authorization codes, or tokens.

## Attach R2 pricing

1. In R2, attach `prices.exilediary.com` as the custom domain for `exile-diary-pricing-production`.
2. Enable public access only through the custom domain. Leave `r2.dev` disabled.
3. Configure a Cache Rule for `prices.exilediary.com/v1/*` that respects the publisher’s cache headers. Cache immutable snapshots aggressively; keep `current.json` and `leagues.json` short-lived.
4. Configure R2 CORS if browser-based clients are ever introduced. The current Electron main-process client does not require CORS.
5. Set `PRICING_PUBLIC_BASE_URL=https://prices.exilediary.com/v1` in the `publish-poe-pricing` GitHub environment and publish one snapshot.
6. Verify a client downloads `v1/current.json`, validates the manifest and snapshot hash, and retains its prior snapshot if the service is unavailable.

## Rollback and retirement

1. If the Worker fails, remove its route or grey-cloud the affected hostname so the current AWS origin receives traffic again.
2. If DNS migration fails broadly, restore the Route 53 nameservers at the registrar. Allow for DNS propagation.
3. Keep Lambda, API Gateway, Secrets Manager, and the Route 53 hosted zone for at least seven days after a successful production OAuth and pricing validation.
4. Before deleting AWS resources, export their configuration, remove the OAuth secret from AWS only after Cloudflare is verified, and confirm Cloudflare is serving both auth and pricing production traffic.
