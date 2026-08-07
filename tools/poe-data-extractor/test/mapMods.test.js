import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import generateMapMods from '../mapMods.js';

async function makeDirectory(context) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'poe-data-map-mods-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

test('normalizes PoE inline links while preserving visible text and unrelated brackets', async (context) => {
  const directory = await makeDirectory(context);
  const inputPath = path.join(directory, 'stat_descriptions.json');
  const outputPath = path.join(directory, 'mapMods.json');
  const examples = [
    [
      'An [ContainsAbyss|Abyss] Pit in Area will spawn an [AbyssalConsort|Abyssal Consort]',
      'An Abyss Pit in Area will spawn an Abyssal Consort',
    ],
    ['Area contains # additional [ContainsAbyss|Abysses]', 'Area contains # additional Abysses'],
    ['Area contains an additional [ContainsAbyss|Abyss]', 'Area contains an additional Abyss'],
    ['Areas contain [ContainsAbyss|Abysses]', 'Areas contain Abysses'],
    [
      'Rare Monsters have [ElementalThorns|Elemental Thorns] reflecting # Elemental Damage',
      'Rare Monsters have Elemental Thorns reflecting # Elemental Damage',
    ],
    [
      'Rare Monsters have [PhysicalThorns|Physical Thorns] reflecting # Physical Damage',
      'Rare Monsters have Physical Thorns reflecting # Physical Damage',
    ],
    [
      '[ContainsAbyss|Abyss] Chasms in Area spawn #% increased Monsters per fed soul',
      'Abyss Chasms in Area spawn #% increased Monsters per fed soul',
    ],
    [
      '[ContainsAbyss|Abyss] Chasms in Area spawn #% reduced Monsters per fed soul',
      'Abyss Chasms in Area spawn #% reduced Monsters per fed soul',
    ],
  ];
  const descriptions = examples.map(([text]) => ({
    statId: 'map_test',
    languages: { English: { descriptions: [{ text }] } },
  }));
  descriptions.push({
    statId: 'map_unrelated_brackets',
    languages: { English: { descriptions: [{ text: 'Text [without a pipe] and {0}' }] } },
  });

  await fs.writeFile(inputPath, JSON.stringify({ descriptions }));
  await generateMapMods({ inputFilePath: inputPath, outputFilePath: outputPath });

  const generated = JSON.parse(await fs.readFile(outputPath, 'utf8')).mapMods;
  assert.deepEqual(generated.slice(3), [
    ...examples.map(([, expected]) => expected).sort(),
    'Text [without a pipe] and #',
  ]);
  assert.ok(generated.every((entry) => !/\[[^|\]]+\|[^\]]+\]/.test(entry)));
});
