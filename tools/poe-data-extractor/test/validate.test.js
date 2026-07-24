import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { outputFiles, publishData } from '../publish.js';
import { validateDataDirectory } from '../validate.js';
import { findUnexpectedPaths } from '../checkChangedFiles.js';

async function makeDirectory(context, prefix) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

test('publishes deterministic JSON and rejects missing output', async (context) => {
  const sourceDirectory = await makeDirectory(context, 'poe-data-source-');
  const targetDirectory = await makeDirectory(context, 'poe-data-target-');
  for (const filename of outputFiles) {
    await fs.writeFile(path.join(sourceDirectory, filename), '{"z":1,"a":2}');
  }

  await publishData({ sourceDirectory, targetDirectory });
  assert.equal(
    await fs.readFile(path.join(targetDirectory, 'areas.json'), 'utf8'),
    '{ "z": 1, "a": 2 }\n'
  );

  await fs.rm(path.join(sourceDirectory, 'items.json'));
  await assert.rejects(publishData({ sourceDirectory, targetDirectory }), /items\.json/);
});

test('validates the checked-in generated datasets', async () => {
  const validated = await validateDataDirectory(path.resolve('../../src/helpers/data'));
  assert.deepEqual(validated, outputFiles);
});

test('rejects malformed and suspiciously empty datasets', async (context) => {
  const malformedDirectory = await makeDirectory(context, 'poe-data-malformed-');
  await fs.writeFile(path.join(malformedDirectory, 'areas.json'), '{broken');
  await assert.rejects(validateDataDirectory(malformedDirectory), /valid JSON/);

  const emptyDirectory = await makeDirectory(context, 'poe-data-empty-');
  for (const filename of outputFiles) {
    await fs.writeFile(path.join(emptyDirectory, filename), '{}');
  }
  await assert.rejects(validateDataDirectory(emptyDirectory), /areas has 0 entries/);
});

test('change allowlist accepts generated data and rejects unrelated files', () => {
  assert.deepEqual(
    findUnexpectedPaths([
      'tools/poe-data-extractor/data/config.json',
      'src/helpers/data/items.json',
    ]),
    []
  );
  assert.deepEqual(findUnexpectedPaths(['src/main/index.ts']), ['src/main/index.ts']);
});
