# Manual Inventory Capture Shortcut

## Summary

Add a configurable global shortcut, defaulting to `CommandOrControl+F11`, that performs a fresh inventory request and records inventory differences as loot for the active run.

Manual captures use a dedicated `inventoryCapture` event type so they remain auditable without masquerading as an area transition.

## Implementation Changes

- Extend shortcut settings, defaults, persistence, and Hotkey Settings UI with `inventoryCaptureShortcut`.
- Register the shortcut through `GlobalShortcutController`; invoke a runtime-sidecar method rather than accessing inventory directly from the Electron shell.
- Add a runtime method such as `runTracking.captureInventory` that:
  - Resolves the active run and current area.
  - Performs a fresh GGG inventory request.
  - Creates an `inventoryCapture` event containing the current area and capture timestamp.
  - Persists the inventory diff, priced item rows, and new `last_inventory` baseline.
  - Serializes concurrent captures through the existing inventory queue.
- If no active run/current area exists, perform only the fresh baseline update and report that no loot event was created.
- Update run accounting queries and event-to-zone handling so `inventoryCapture` events participate wherever `entered` events currently provide loot accounting.
- Report success/failure through existing logging and overlay messaging, including the number of newly captured items.

## Test Plan

- Shortcut controller:
  - Registers the new default/configured accelerator.
  - Invokes the manual-capture callback.
  - Preserves existing registration and re-registration behavior.
- Inventory capture:
  - Uses a fresh API request.
  - Computes diffs and advances the baseline.
  - Persists the dedicated event and item rows.
  - Handles duplicate/no-diff captures.
  - Falls back to baseline-only behavior without an active run.
  - Serializes overlapping captures.
- Runtime/IPC:
  - Exposes and dispatches the new runtime method in both in-process and sidecar modes.
- Accounting:
  - Includes `inventoryCapture` items in run loot/profit totals.
  - Keeps captures in town excluded according to existing area rules.
- Settings UI:
  - Displays, records, resets, and cancels the new shortcut.
  - Re-registers shortcuts after settings changes.

## Assumptions

- The shortcut is enabled and registered by default; no separate enable toggle is added.
- Default accelerator: `CommandOrControl+F11`.
- Manual captures always request fresh inventory data.
- A successful capture creates an auditable event even when the diff is empty; no active run creates no event.
