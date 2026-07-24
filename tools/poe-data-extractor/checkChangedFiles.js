import { execFileSync } from 'child_process';
import { pathToFileURL } from 'url';
import path from 'path';

const allowedPaths = new Set([
  'tools/poe-data-extractor/data/config.json',
  'src/helpers/data/areas.json',
  'src/helpers/data/items.json',
  'src/helpers/data/mapMods.json',
  'src/helpers/data/worldAreas.json',
  'src/helpers/data/uniques.json',
  'src/helpers/data/events.json',
]);

export function findUnexpectedPaths(paths) {
  return paths.filter((changedPath) => changedPath && !allowedPaths.has(changedPath));
}

function main() {
  const trackedOutput = execFileSync(
    'git',
    ['diff', '--name-only', '--diff-filter=ACMRTUXB', 'HEAD'],
    { encoding: 'utf8' }
  );
  const untrackedOutput = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
    encoding: 'utf8',
  });
  const changedPaths = [...trackedOutput.split(/\r?\n/), ...untrackedOutput.split(/\r?\n/)].filter(
    Boolean
  );
  const unexpected = findUnexpectedPaths(changedPaths);
  if (unexpected.length > 0) {
    throw new Error(`Extraction modified unexpected paths:\n${unexpected.join('\n')}`);
  }
  console.log(`Validated extraction change allowlist (${changedPaths.length} changed paths)`);
}

const invokedAsScript =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
