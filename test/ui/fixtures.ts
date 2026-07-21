export type UiScenarioName = 'populated' | 'empty' | 'unauthenticated' | 'backend-error';

const makeRun = (id: number, name: string, completed = true) => ({
  id,
  name,
  level: 83,
  depth: null,
  iiq: 96,
  iir: 42,
  pack_size: 31,
  first_event: `2026-07-16T0${id}:00:00.000Z`,
  last_event: `2026-07-16T0${id}:08:30.000Z`,
  xpgained: 12_500_000,
  deaths: id === 2 ? 1 : 0,
  gained: id === 1 ? 382.5 : 174.25,
  kills: id === 1 ? 812 : 649,
  run_info: JSON.stringify({ graftblood: id === 1 ? 318 : 245 }),
  completed,
});

export const representativeItem = {
  id: 'fixture-divine-orb',
  name: '',
  typeLine: 'Divine Orb',
  ilvl: 1,
  frameType: 0,
  identified: true,
  icon: '/src/renderer/assets/img/mirror.png',
  explicitMods: [],
  implicitMods: [],
  enchantMods: [],
  w: 1,
  h: 1,
  stackSize: 3,
  maxStackSize: 20,
  pickupStackSize: 3,
  value: 540,
  originalValue: 540,
  stashTabId: 'currency-tab',
  isIgnored: false,
};

const boss = (name: string, count = 0) => ({
  name,
  count,
  totalTime: count ? 95 : 0,
  fastest: count ? 95 : Number.MAX_SAFE_INTEGER,
  deaths: 0,
  details: {},
});

export const populatedStats = {
  divinePrice: 180,
  misc: {
    xp: 25_000_000,
    kills: 1461,
    deaths: 1,
    valueOfDrops: 556.75,
    rawDivineDrops: 3,
    shrines: { total: 5, types: { acceleration: 3, divine: 2 } },
    abyssalDepths: 1,
    vaalSideAreas: 2,
    envoy: { encounters: 2, words: 47 },
    maven: { crucible: { started: 1, completed: 1 }, battle: { started: 0, completed: 0 } },
    simulacrum: { encounters: 0, splinters: 34 },
    shaper: { started: 0, completed: 0, phases: {} },
    blight: { encounters: 2, lanes: { total: 8, min: 3, max: 5 }, maps: 1 },
    metamorph: { encountered: 1, organs: { brain: 1, eye: 2 } },
    legion: { generals: { encounters: 1, kills: 1 } },
    legionGenerals: { encounters: 1, kills: 1, generals: {} },
    incursion: {
      unlocks: { count: 2, time: { total: 17, min: 7, max: 10 } },
      rooms: { count: 3, temples: 1, types: {} },
    },
    bestiary: {
      captured: { yellow: 4, red: 2 },
      crafted: { count: 1, time: { total: 6, min: 6, max: 6 } },
    },
    delve: { niko: 2, sulphiteNodes: 7 },
    betrayal: {
      junCounter: 2,
      memberEncounters: 4,
      members: {},
      boss: { started: 0, finished: 0 },
    },
    unrighteousTurnedToAsh: 12,
  },
  areas: {
    maps: {
      name: 'maps',
      count: 2,
      time: 1020,
      gained: 556.75,
      profitPerHour: 1964.12,
      kills: 1461,
      deaths: 1,
      maps: [],
      areas: {},
    },
  },
  bosses: {
    maps: boss('Map Bosses', 2),
    shaperGuardians: boss('Shaper Guardians'),
    elderGuardians: boss('Elder Guardians'),
    conquerors: boss('Conquerors'),
    legion: boss('Legion Generals', 1),
    betrayal: boss('Catarina, Master of Undeath'),
    sirus: boss('Sirus, Awakener of Worlds'),
    shaper: boss('The Shaper'),
    harvest: boss('Oshabi, Avatar of the Grove'),
    maven: boss('The Maven'),
    synthesis: boss('Venarius, the Eternal'),
  },
  items: {
    divinePrice: 180,
    loot: [{ ...representativeItem, raw_data: JSON.stringify(representativeItem) }],
  },
};

const zeroNumericValues = (value: unknown): void => {
  if (Array.isArray(value)) {
    value.forEach(zeroNumericValues);
    return;
  }
  if (!value || typeof value !== 'object') return;
  Object.entries(value).forEach(([key, nestedValue]) => {
    if (typeof nestedValue === 'number') {
      (value as Record<string, unknown>)[key] = 0;
    } else {
      zeroNumericValues(nestedValue);
    }
  });
};

export const emptyStats: typeof populatedStats = structuredClone(populatedStats);
zeroNumericValues(emptyStats);
emptyStats.items.loot = [];

export const populatedSettings = {
  username: 'FixtureAccount',
  activeProfile: {
    valid: true,
    characterName: 'TestExile',
    league: 'Fixture League',
    leagueOverride: '',
  },
  clientTxt: 'C:\\Games\\Path of Exile\\logs\\Client.txt',
  screenshotDir: 'C:\\Screenshots',
  screenshots: {
    allowFolderWatch: true,
    allowCustomShortcut: true,
    screenshotDir: 'C:\\Screenshots',
  },
  screenshotShortcut: 'F8',
  runParseScreenshotEnabled: true,
  runParseShortcut: 'F9',
  overlayEnabled: true,
  overlayPersistenceEnabled: true,
  overlayToggleShortcut: 'F10',
  overlayMovementShortcut: 'F11',
  autoScreenshotOnMapEntry: { enabled: false, delay: 2 },
  alternateSplinterPricing: false,
  enableIncubatorAlert: true,
  forceDebugMode: false,
  enableAutoscroll: true,
  logToUI: true,
  netWorthCheck: { interval: 300 },
  filters: { filterPatterns: [], minimumValue: 1, perCategory: {} },
};

export const populatedRuns = [
  makeRun(1, 'Dunes Map'),
  makeRun(2, 'Crimson Temple Map'),
  makeRun(3, 'Jungle Valley Map', false),
];

export const runDetails = {
  league: 'Fixture League',
  prevxp: 100_000,
  completed: true,
  mods: [{ mod: 'Monsters have 40% increased life' }],
  events: [
    {
      id: 1,
      event_type: 'entered',
      event_text: 'Entered Dunes Map',
      timestamp: '2026-07-16T01:00:00.000Z',
    },
    {
      id: 2,
      event_type: 'slain',
      event_text: 'Map boss defeated',
      timestamp: '2026-07-16T01:07:00.000Z',
    },
  ],
  items: {},
};

export const stashTabs = [
  {
    id: 'currency-tab',
    name: 'Currency',
    type: 'CurrencyStash',
    index: 0,
    metadata: { colour: '5b4636' },
    tracked: true,
  },
  { id: 'dump-tab', name: 'Dump', type: 'QuadStash', index: 1, metadata: {}, tracked: true },
];

export const characters = [
  {
    id: 'character-1',
    name: 'TestExile',
    level: 96,
    class: 'Pathfinder',
    league: 'Fixture League',
    active: true,
    current: true,
  },
  {
    id: 'character-2',
    name: 'SecondExile',
    level: 88,
    class: 'Trickster',
    league: 'Fixture League',
  },
];
