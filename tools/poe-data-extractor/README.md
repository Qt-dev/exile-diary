# PoE Data Extractor

This in-repository tool downloads Path of Exile data, generates the six JSON datasets consumed by Exile Diary, validates them, and publishes them to `src/helpers/data`.

The tool previously lived in the `Qt-dev/exile-diary-data-extracter` repository. That repository remains available for history, but this directory is now the maintained source.

## Commands

From the application repository root:

```bash
npm ci --prefix tools/poe-data-extractor
npm run data:extract
npm run data:check
```

`data:extract` performs four fail-fast stages:

1. Fetch and validate the latest PoE patch identifier.
2. Export the configured game data tables.
3. Generate the application datasets.
4. Deterministically format and publish the six JSON files.

Temporary bundles, exported tables, language files, and intermediate output are ignored.
