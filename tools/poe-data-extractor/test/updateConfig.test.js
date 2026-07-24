import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { updatePatchConfig } from '../updateConfig.js';

async function createConfig(patch = '3.28.0.16') {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'poe-data-config-'));
  const configPath = path.join(directory, 'config.json');
  await fs.writeFile(configPath, `{\n  "patch": "${patch}"\n}\n`);
  return { configPath, directory };
}

test('updates the config with a trimmed valid patch', async (context) => {
  const { configPath, directory } = await createConfig();
  context.after(() => fs.rm(directory, { recursive: true, force: true }));

  const result = await updatePatchConfig({
    configPath,
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => '3.29.0.1\n' }),
  });

  assert.deepEqual(result, { changed: true, patch: '3.29.0.1' });
  assert.match(await fs.readFile(configPath, 'utf8'), /"patch": "3\.29\.0\.1"/);
});

test('does not rewrite an unchanged config', async (context) => {
  const { configPath, directory } = await createConfig();
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const before = await fs.stat(configPath);

  const result = await updatePatchConfig({
    configPath,
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => '3.28.0.16' }),
  });

  assert.deepEqual(result, { changed: false, patch: '3.28.0.16' });
  assert.equal((await fs.stat(configPath)).mtimeMs, before.mtimeMs);
});

for (const invalidPatch of ['', 'not-a-patch', '<html>failure</html>']) {
  test(`rejects invalid patch response ${JSON.stringify(invalidPatch)}`, async (context) => {
    const { configPath, directory } = await createConfig();
    context.after(() => fs.rm(directory, { recursive: true, force: true }));

    await assert.rejects(
      updatePatchConfig({
        configPath,
        fetchImpl: async () => ({ ok: true, status: 200, text: async () => invalidPatch }),
      }),
      /response is invalid/
    );
  });
}

test('rejects an unsuccessful HTTP response', async (context) => {
  const { configPath, directory } = await createConfig();
  context.after(() => fs.rm(directory, { recursive: true, force: true }));

  await assert.rejects(
    updatePatchConfig({
      configPath,
      fetchImpl: async () => ({ ok: false, status: 503, text: async () => '' }),
    }),
    /HTTP 503/
  );
});

test('propagates network failures', async (context) => {
  const { configPath, directory } = await createConfig();
  context.after(() => fs.rm(directory, { recursive: true, force: true }));

  await assert.rejects(
    updatePatchConfig({
      configPath,
      fetchImpl: async () => {
        throw new Error('network unavailable');
      },
    }),
    /network unavailable/
  );
});
