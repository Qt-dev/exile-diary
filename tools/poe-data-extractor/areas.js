import Areas from './data/tables/English/WorldAreas.json' with { type: "json" };
import fs from 'fs/promises';

function dedupe(arr) {
  return Array.from(new Set(arr));
}

const EXCLUDE_NAMES = [
  'NULL',
  'Character Select',
  'Your Hideout',
  'Your Guild Hideout',
];

function isValidName(name) {
  if (!name || EXCLUDE_NAMES.includes(name)) return false;
  if (name.includes('[UNUSED]')) return false;
  if (name.includes('[DNT]')) return false;
  return true;
}

export default async () => {
  const validAreas = Areas.filter(area => isValidName(area.Name));
  const used = new Set();
  const result = {};

  // Define all category rules in order
  const categories = [
    {
      key: 'labyrinth',
      filter: area => area.IsLabyrinthArea,
      sort: false,
    },
    {
      key: 'vaalSideAreas',
      filter: area => area.IsVaalArea,
      sort: true,
    },
    // League/expansion rules
    {
      key: 'breach',
      filter: area => area.Id && area.Id.startsWith('Breach'),
      sort: true,
    },
    {
      key: 'betrayal',
      filter: area => area.Id && area.Id.startsWith('Betrayal'),
      sort: true,
    },
    {
      key: 'delve',
      filter: area => area.Id && area.Id.startsWith('Delve'),
      sort: true,
    },
    {
      key: 'incursion',
      filter: area => area.Id && area.Id.startsWith('Incursion'),
      sort: true,
    },
    {
      key: 'legion',
      filter: area => area.Id && area.Id.startsWith('Legion'),
      sort: true,
    },
    {
      key: 'synthesis',
      filter: area => area.Id && area.Id.startsWith('Synthesis') && area.Act === 0,
      sort: true,
    },
    {
      key: 'bestiary',
      filter: area => area.Id && area.Id.startsWith('Menagerie'),
      sort: true,
    },
    {
      key: 'delirium',
      filter: area => area.Id && area.Id.startsWith('AfflictionTown'),
      sort: true,
    },
    {
      key: 'harvest',
      filter: area => area.Id && area.Id.startsWith('Harvest'),
      sort: true,
    },
    {
      key: 'heist',
      filter: area => area.Id && area.Id.startsWith('Heist'),
      sort: true,
    },
    {
      key: 'ultimatum',
      filter: area => area.Id && area.Id.startsWith('Ultimatum'),
      sort: true,
    },
    {
      key: 'expedition',
      filter: area => area.Id && area.Id.startsWith('Expedition'),
      sort: true,
    },
    {
      key: 'endgame',
      filter: area => Array.isArray(area.Bosses_MonsterVarietiesKeys) && area.Bosses_MonsterVarietiesKeys.length > 0 && area.Id && (area.Id.includes('Uber') || area.Id.includes('Shaper') || area.Id.includes('Atziri') || area.Id.includes('Boss')),
      sort: true,
    },
    {
      key: 'sanctum',
      filter: area => area.Id && area.Id.startsWith('Sanctum'),
      sort: true,
    },
    {
      key: 'uniqueMaps',
      filter: area => area.IsUniqueMapArea,
      sort: true,
    },
    {
      key: 'normalMaps',
      filter: area => area.IsMapArea,
      sort: true,
    },
    {
      key: 'hideout',
      filter: area => area.IsHideout === true,
      sort: true,
    },
    {
      key: 'acts',
      filter: area => typeof area.Act === 'number' && area.Act < 11 && !area.IsTown,
      sort: false,
    },
  ];

  // Process each category in order, always excluding already-used names
  for (const cat of categories) {
    const arr = dedupe(validAreas.filter(area => cat.filter(area) && !used.has(area.Name)).map(area => area.Name));
    if (cat.sort) arr.sort();
    arr.forEach(name => used.add(name));
    result[cat.key] = arr;
  }

  // Misc: any area not already used
  const misc = dedupe(validAreas.filter(area => !used.has(area.Name)).map(area => area.Name)).sort();
  result.misc = misc;

  await fs.mkdir('./output', { recursive: true });
  await fs.writeFile('./output/areas.json', JSON.stringify(result, null, 2));

  console.log('Areas generated successfully.');
};
