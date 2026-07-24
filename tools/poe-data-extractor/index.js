import fs from 'fs/promises';

await fs.mkdir('./output/temp', { recursive: true });

const [
  { default: generateItems },
  { default: generateUniques },
  { default: generateAreas },
  { default: parseStats },
  { default: generateMapMods },
  { default: generateWorldAreas },
  { default: generateEvents },
] = await Promise.all([
  import('./items.js'),
  import('./uniques.js'),
  import('./areas.js'),
  import('./utils/statsDescriptionParser.js'),
  import('./mapMods.js'),
  import('./worldAreas.js'),
  import('./events.js'),
]);

await generateItems();
await generateUniques();
await generateAreas();
await parseStats();
await generateMapMods();
await generateWorldAreas();
await generateEvents();

console.log('Data generation completed successfully.');
