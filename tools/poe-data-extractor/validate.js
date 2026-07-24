import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { outputFiles } from './publish.js';

function assertObject(value, label) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error(`${label} must be a JSON object`);
  }
}

function assertMinimumEntries(value, minimum, label) {
  assertObject(value, label);
  const count = Object.keys(value).length;
  if (count < minimum) {
    throw new Error(`${label} has ${count} entries; expected at least ${minimum}`);
  }
}

function assertMinimumArrayEntries(value, minimum, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be a JSON array`);
  }
  if (value.length < minimum) {
    throw new Error(`${label} has ${value.length} entries; expected at least ${minimum}`);
  }
}

export async function validateDataDirectory(directory) {
  const datasets = {};
  for (const filename of outputFiles) {
    const filePath = path.join(directory, filename);
    try {
      datasets[filename] = JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch (error) {
      throw new Error(`Unable to read valid JSON from ${filePath}: ${error.message}`);
    }
  }

  assertMinimumEntries(datasets['areas.json'], 15, 'areas');
  for (const key of ['labyrinth', 'normalMaps', 'uniqueMaps', 'acts']) {
    if (!Array.isArray(datasets['areas.json'][key]) || datasets['areas.json'][key].length === 0) {
      throw new Error(`areas.${key} must be a non-empty array`);
    }
  }

  const items = datasets['items.json'];
  assertObject(items, 'items');
  for (const key of ['baseTypes', 'names']) {
    assertMinimumEntries(items[key], 3, `items.${key}`);
  }
  assertMinimumArrayEntries(items.frameTypes, 10, 'items.frameTypes');

  assertMinimumArrayEntries(datasets['mapMods.json'].mapMods, 500, 'mapMods.mapMods');
  assertMinimumEntries(datasets['worldAreas.json'], 500, 'worldAreas');
  assertMinimumEntries(datasets['uniques.json'].byIconPath, 500, 'uniques.byIconPath');
  assertMinimumEntries(datasets['events.json'].byQuote, 100, 'events.byQuote');

  return outputFiles;
}

async function main() {
  const directoryArgument = process.argv[2];
  if (!directoryArgument) {
    throw new Error('Usage: node validate.js <data-directory>');
  }
  const directory = path.resolve(directoryArgument);
  const validated = await validateDataDirectory(directory);
  console.log(`Validated ${validated.length} datasets in ${directory}`);
}

const invokedAsScript =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  main().catch((error) => {
    console.error('Data validation failed:', error);
    process.exitCode = 1;
  });
}
