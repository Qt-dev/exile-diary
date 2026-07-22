# API/IPC audit result

The authentication and profile-selection paths had multiple owners for GGG character requests. A clean OAuth flow could issue roughly three physical character-list calls, while a profile switch could issue up to four logical calls across the main process, renderer, and sidecar. Process-local caches could not coalesce those calls.

Accepted recommendations:

- Make the runtime sidecar the renderer's sole GGG API owner.
- Remove OAuth callback profile auto-selection; let the explicit character picker own selection.
- Pass the selected profile DTO into DB initialization instead of resolving it through another API call.
- Coalesce identical in-flight requests and cache character lists briefly.
- Share the character snapshot used by inventory and passive-tree consumers.
- Apply bounded HTTP timeouts and account-scoped request keys.
- Refresh sidecar authentication in place after token persistence instead of restarting it.
- Fix character-picker assignment and empty-list handling.

