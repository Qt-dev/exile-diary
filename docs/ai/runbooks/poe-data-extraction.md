# PoE data extraction

The `update-poe-data` GitHub Actions workflow refreshes the application's generated Path of Exile data every day at 04:17 UTC. It also supports manual dry runs and publishing runs from the Actions UI. All work runs on a GitHub-hosted runner; no developer computer needs to remain online.

## GitHub App setup

Create a private GitHub App such as `exile-diary-data-updater` with no webhooks and these repository permissions:

- Contents: read and write
- Pull requests: read and write
- Metadata: read (granted implicitly)

Install the App only on `Qt-dev/exile-diary`. Add its client ID as the repository variable `POE_DATA_APP_CLIENT_ID` and its private key as the repository secret `POE_DATA_APP_PRIVATE_KEY`.

The workflow requests a short-lived installation token scoped to the current repository and the two permissions above. It uses the App bot as the commit author.

## Rollout

1. Merge the in-repository extractor and workflow onto the default branch.
2. Open **Actions → update-poe-data → Run workflow**.
3. Leave `publish` disabled for the first run. Confirm extraction and validation pass and the summary reports whether data changed.
4. Run it again with `publish` enabled. If data changed, confirm the App opens `chore: refresh extracted PoE data` from `automation/poe-data-refresh`.
5. Review and merge the PR normally. Auto-merge is intentionally not enabled.

The daily schedule is active only after the workflow file exists on the default branch.

## Local commands

```bash
npm ci --prefix tools/poe-data-extractor
npm run data:extract
npm run data:check
npm test --prefix tools/poe-data-extractor
```

`data:extract` may update only the extractor patch configuration and these generated datasets:

- `areas.json`
- `items.json`
- `mapMods.json`
- `worldAreas.json`
- `uniques.json`
- `events.json`

The scheduled workflow fails if any other tracked path changes.

## Failure handling

- Patch lookup, download, generation, publishing, validation, or unexpected-file failures make the workflow fail with a nonzero status.
- The job summary records the patch, whether generated data changed, whether the same tree is already in the automation PR, and whether publishing was requested.
- Rerun a failed job after an upstream outage. Use a manual publishing run for urgent patch launches instead of changing the daily schedule.
