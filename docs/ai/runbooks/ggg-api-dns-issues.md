# GGG API DNS / Resolver Issues

## Typical Symptoms
- `npm run dev` starts, but GGG requests time out against a private or sinkhole IP
- logs mention `api.pathofexile.com` resolving to `10.0.0.1`
- the browser can reach Path of Exile normally, but the Electron app cannot

## Likely Cause
The Electron/Node process is using a different resolver path than the browser, or it is inheriting a VPN/proxy/DNS override that rewrites the GGG API host.

## First Checks
- Run `nslookup api.pathofexile.com`
- Compare the result with what the app logs during startup or first GGG request
- Check VPN, security software, custom DNS, and any local resolver override
- Confirm the hosts file does not contain a Path of Exile entry

## Cheapest Recovery Path
- Remove or disable the DNS/proxy override that points `api.pathofexile.com` at `10.0.0.1`
- Restart the app after the resolver path is fixed
- If the browser works but the app does not, focus on Electron/Node-specific network settings

## Good Verification
- `npm run dev`
- a successful character fetch from the login or settings flow
- logs show the GGG API host resolving to public addresses

## Helpful Paths
- `src/main/runtime/poeApiHostResolution.ts`
- `src/main/GGGAPI.ts`
- `docs/ai/runbooks/native-module-abi-mismatch.md`
