import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import prettier from 'prettier';

export const outputFiles = [
  'areas.json',
  'items.json',
  'mapMods.json',
  'worldAreas.json',
  'uniques.json',
  'events.json',
];

export async function publishData({
  sourceDirectory = path.resolve('./output'),
  targetDirectory,
} = {}) {
  if (!targetDirectory) throw new Error('A target directory is required');

  await fs.mkdir(targetDirectory, { recursive: true });
  for (const filename of outputFiles) {
    const sourcePath = path.join(sourceDirectory, filename);
    const targetPath = path.join(targetDirectory, filename);
    const source = await fs.readFile(sourcePath, 'utf8');
    JSON.parse(source);
    const formatted = await prettier.format(source, {
      parser: 'json',
      printWidth: 100,
      tabWidth: 2,
      useTabs: false,
      endOfLine: 'lf',
    });
    await fs.writeFile(targetPath, formatted);
  }
}

async function main() {
  const targetArgument = process.argv[2];
  if (!targetArgument) {
    throw new Error('Usage: node publish.js <target-directory>');
  }
  await publishData({ targetDirectory: path.resolve(targetArgument) });
  console.log(`Published ${outputFiles.length} datasets to ${path.resolve(targetArgument)}`);
}

const invokedAsScript =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  main().catch((error) => {
    console.error('Failed to publish generated data:', error);
    process.exitCode = 1;
  });
}
