# Poe.ninja pricing proxy

The pricing proxy is static data in Cloudflare R2, refreshed by the `publish-poe-pricing` GitHub Actions workflow. Production clients read the configured `PRICING_PUBLIC_BASE_URL`; they retain their last validated local snapshot if this service is unavailable.

## Approval gates

Do not perform the following through an application release or an unreviewed workflow run:

- Enable Cloudflare billing, create R2 credentials, or add GitHub secrets.
- Change Route 53 records, registrar nameservers, DNSSEC, Cloudflare DNS records, cache rules, WAF rules, bucket lifecycle rules, or a custom domain.
- Run a non-dry-run publication, promote a rollback manifest, or delete retained snapshots.

An owner must approve each production action and record the run URL, operator, timestamp, and verification result in the deployment issue or release notes.

## One-time production setup

### DNS and domain ownership

Keep the `exilediary.com` registration where it is today. The recommended design changes authoritative DNS from Route 53 to Cloudflare only after the existing record set has been imported and verified; the complete procedure also migrates the small AWS auth service without changing its public URLs.

Cloudflare Free cannot attach an R2 custom domain under a Route 53-authoritative parent zone. The supported production design is to make `exilediary.com` an active Cloudflare zone while retaining its domain registration wherever it is today. The full auth and DNS migration procedure is in [cloudflare-migration.md](cloudflare-migration.md).

Choose one approved deployment route before configuring production:

1. **Recommended route:** move authoritative DNS for `exilediary.com` to Cloudflare, keep the domain registration unchanged, and attach `prices.exilediary.com` directly to R2.
2. **Alternative route:** register a separate low-cost domain used only for pricing, delegate that new domain's authoritative DNS to Cloudflare, and use a hostname such as `prices.<new-domain>/v1`.
3. **Keep Route 53 authoritative:** use Cloudflare Business/Enterprise partial-zone support for `prices.exilediary.com`. This is paid and outside the free-tier design.
4. **Keep all DNS on AWS:** replace the R2 delivery layer with an AWS-hosted design such as S3 plus CloudFront. This preserves `prices.exilediary.com` in Route 53 but is a separate architecture and cost model.

Do not CNAME `prices.exilediary.com` to an `r2.dev` URL. Cloudflare documents that as an unsupported, non-production access path.

### R2 and Cloudflare delivery

1. Add `exilediary.com` to Cloudflare, enable R2, create the Standard bucket `exile-diary-pricing-production`, and leave `r2.dev` disabled.
2. Add a 30-day lifecycle expiry for `v1/poe1/leagues/*/snapshots/`. Never expire `leagues.json`, `current.json`, or `_publisher/` state through this rule.
3. Attach `prices.exilediary.com` as the bucket custom domain. It must be proxied by Cloudflare and use managed TLS. Set `PRICING_PUBLIC_BASE_URL=https://prices.exilediary.com/v1` in the GitHub environment and release configuration.
4. Add a Cache Everything rule limited to `prices.exilediary.com/v1/*`, respecting origin cache headers. Enable tiered cache when available. Configure bucket CORS for public `GET` and `HEAD` requests with `Access-Control-Allow-Origin: *`.
5. Add WAF custom rules to block all methods except GET and HEAD, paths beginning `/_publisher/`, and requests with query strings on public pricing paths.
6. Confirm public objects send the intended headers: manifests cache for five minutes, immutable snapshots cache for one year and are gzip encoded. Confirm `CF-Cache-Status` becomes `HIT` on a repeat snapshot request.
7. Confirm `_publisher/` cannot be fetched publicly and `r2.dev` does not serve the bucket.

### GitHub Actions access

Create the protected `pricing-production` GitHub environment and limit it to the default branch. Scheduled publishing must not require a reviewer, or it will stop at the environment gate.

Add these environment secrets, scoped to R2 object read/write on this bucket only:

- `CF_R2_ACCESS_KEY_ID`
- `CF_R2_SECRET_ACCESS_KEY`

Add these environment variables:

- `CF_ACCOUNT_ID`
- `R2_BUCKET=exile-diary-pricing-production`
- `R2_ENDPOINT` (the account-specific S3-compatible R2 endpoint)
- `PRICING_PUBLIC_BASE_URL=https://prices.exilediary.com/v1`
- `POE_NINJA_CONTACT` (a monitored contact URL or email for the upstream User-Agent)

Do not grant DNS, Workers, account administration, or other-bucket access. Rotate the R2 token at least annually and immediately after a suspected exposure.

## Development and publication

Use Node 22 and install the locked dependencies with `npm ci`. Development never needs R2 credentials:

```powershell
npm run pricing:generate
npm run pricing:validate
npm run pricing:serve
```

Point a development app at the local server with `EXILE_DIARY_PRICING_BASE_URL`; use the direct poe.ninja transport only for explicit development/testing. Do not use production R2 credentials locally.

The scheduled workflow runs at minutes 7, 22, 37, and 52. It publishes all active PoE 1 leagues. GitHub schedules can be delayed; the prior valid manifest remains public until a complete replacement is validated.

For a manual workflow dispatch, select `dry_run` first. Use the league override only for a known normalized league id. `force_full_refresh` bypasses upstream ETag reuse. A rollback takes an existing retained `rollback_snapshot_id`; it never edits immutable snapshot data.

## Smoke check and rollback

After an approved production publication:

1. Fetch `https://prices.exilediary.com/v1/poe1/leagues.json` and confirm the target league manifest exists.
2. Fetch its `current.json`; verify protocol version, league id, snapshot id, hash, schema version, catalog revision, and timestamp.
3. Fetch the immutable snapshot, verify its gzip decoding and SHA-256 against the manifest, then repeat the request and confirm a Cloudflare cache hit.
4. Start a development build configured for the production base URL; confirm it accepts the snapshot and persists the daily rate record.
5. Confirm invalid methods, query strings, `_publisher/`, and `r2.dev` are rejected or unavailable.

If a newly published snapshot is wrong, stop further publication, identify the most recent retained verified snapshot, and run the workflow manually with its `rollback_snapshot_id` and the affected league. Verify the manifest now references that immutable snapshot. Resume scheduled publishing only after the root cause is fixed and an approved dry run succeeds.

## Schema and backend updates

`/v1` and `protocolVersion: 1` are stable public contracts. Additive optional manifest fields are safe. Changing existing field meaning, removing a field, or changing object layout requires a new `/v2` path and `protocolVersion: 2`.

Increase `catalogRevision` whenever Poe.ninja categories, endpoint mappings, adapters, or price-key construction changes. Increase `PriceSnapshot.schemaVersion` only when existing clients cannot read the snapshot safely.

For an incompatible change, publish both protocol paths from the same validated upstream refresh, release clients that prefer the new path while retaining the old path, and only retire the old path after the minimum supported desktop version no longer needs it. Roll back by moving a manifest within the same protocol; never overwrite an immutable snapshot key.

When adding a category, update the shared catalog and adapter, add sanitized fixtures and matcher coverage, force a full refresh, run a dry-run publication, and compare category completeness, key collisions, values, and payload growth before asking for production approval.

## Ongoing checks

Review each workflow summary for upstream failures, skipped leagues, payload-size changes, and snapshot age. Monitor R2 storage and Class A/B operations, GitHub workflow failures, and cache-hit behavior. Treat a snapshot older than 24 hours, a missing current manifest, or unexpected direct poe.ninja production traffic as an incident.
