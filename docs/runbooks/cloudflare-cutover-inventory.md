# Cloudflare cutover inventory

Captured on 2026-07-29 before the authoritative-DNS handoff. Update this document whenever a public service is added or removed.

Cutover status (2026-07-30):

- Squarespace now delegates to `carter.ns.cloudflare.com` and `mary.ns.cloudflare.com`.
- Cloudflare is active and proxies the apex.
- The `exile-diary-auth` Worker serves `exilediary.com/*`; its production OAuth secret is stored as an encrypted Worker secret.
- `prices.exilediary.com` is connected to the production R2 bucket and has working Cloudflare DNS/TLS.
- The public R2 development URL remains disabled.
- AWS and Route 53 remain intact for the seven-day rollback window.

## Registrar and DNS

- Registrar: Squarespace. Keep registration and domain lock there.
- Current authoritative DNS: Route 53 hosted zone for `exilediary.com`.
- Destination authoritative DNS: Cloudflare Free zone for `exilediary.com`.
- DNSSEC: disabled at the registrar (no DS record).
- Cloudflare nameservers assigned to the zone:
  - `carter.ns.cloudflare.com`
  - `mary.ns.cloudflare.com`

### Route 53 records to preserve

| Type | Name | Target | TTL / mode |
| --- | --- | --- | --- |
| A (alias) | `exilediary.com` | API Gateway custom domain `d-axiahjqxfa.execute-api.us-east-1.amazonaws.com` | Alias; keep as the rollback origin until the Worker is verified. |
| CNAME | `_496fb87a10498ce85c5e7c79cf544c73.exilediary.com` | `_aa42ddd28fa6256e61972b2f80d99b3b.wmqxbylrnj.acm-validations.aws` | 300 seconds; retain through the AWS rollback window. |

The Route 53 export contained no MX, SPF, DKIM, DMARC, AAAA, `www`, pricing, or other public service records. The SOA and NS records are provider-managed and must not be recreated in Cloudflare.

## Public API behavior

| Route | Existing API Gateway integration | Cloudflare replacement |
| --- | --- | --- |
| `GET /` | `redirect-to-github` Lambda | `exile-diary-auth` Worker redirects to the project repository. |
| `POST /auth/token` | `get-oauth-token` Lambda | Worker securely exchanges the OAuth authorization code. |
| `GET /auth/success` | `redirect-with-access-token` Lambda | Worker opens the `exile-diary://` callback. |

The Worker is configured for `exilediary.com/*` so the full API Gateway surface moves together. It must not receive production traffic until `GGG_CLIENT_SECRET` is set in Cloudflare and the synthetic and real OAuth checks pass.

## Pricing delivery

- R2 bucket: `exile-diary-pricing-production` already exists.
- Intended custom domain: `prices.exilediary.com`.
- Do not enable `r2.dev` for production.
- The R2 custom-domain record was connected after the parent zone became active. Configure GitHub publication credentials and validate a published snapshot before migrating the app's production pricing reads.

## Rollback boundary

Keep the Route 53 hosted zone, API Gateway, the three Lambda functions, ACM validation, and AWS OAuth secret unchanged for at least seven days after a successful real OAuth and pricing-client validation. The DNS rollback is to restore the four Route 53 nameservers at Squarespace.
