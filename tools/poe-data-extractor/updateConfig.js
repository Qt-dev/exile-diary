import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';

export const latestPatchUrl =
  'https://raw.githubusercontent.com/poe-tool-dev/latest-patch-version/main/latest.txt';

const patchPattern = /^\d+(?:\.\d+){2,4}[a-z]?$/i;

export async function updatePatchConfig({
  fetchImpl = fetch,
  configPath = path.resolve('./data/config.json'),
} = {}) {
  const response = await fetchImpl(latestPatchUrl);
  if (!response.ok) {
    throw new Error(`Latest patch request failed with HTTP ${response.status}`);
  }

  const latestPatch = (await response.text()).trim();
  if (!patchPattern.test(latestPatch)) {
    throw new Error(`Latest patch response is invalid: ${JSON.stringify(latestPatch)}`);
  }

  const config = await fs.readFile(configPath, 'utf8');
  const patchEntry = /"patch"\s*:\s*"[^"]*"/;
  const currentEntry = config.match(patchEntry);
  if (!currentEntry) {
    throw new Error(`No patch entry found in ${configPath}`);
  }

  const updatedConfig = config.replace(patchEntry, `"patch": "${latestPatch}"`);
  const changed = updatedConfig !== config;
  if (changed) {
    await fs.writeFile(configPath, updatedConfig);
  }

  return { changed, patch: latestPatch };
}

async function main() {
  const result = await updatePatchConfig();
  console.log(
    result.changed
      ? `Latest patch updated: ${result.patch}`
      : `Latest patch unchanged: ${result.patch}`
  );
}

const invokedAsScript =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  main().catch((error) => {
    console.error('Failed to update the latest patch:', error);
    process.exitCode = 1;
  });
}
