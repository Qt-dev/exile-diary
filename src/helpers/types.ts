type RunInfo = {
  blightedMap?: string;
  maven?: {
    crucibleCompleted?: boolean;
    mavenDefeated?: boolean;
    firstLine: number;
  };
  oshabiBattle?: {
    start: number;
    completed: boolean;
  };
  venariusBattle?: {
    start: number;
    completed: boolean;
  };
  shaperBattle?: {
    phase1start: number;
    completed: boolean;
  };
  mastermindBattle?: {
    battle2start: number;
    completed: boolean;
  };
  envoy?: {
    words: number;
  };
  shrines?: string[];
  simulacrumProgress?: {
    splinters: number;
  };
  labyrinth?: {
    completed: boolean;
    argusKilled: number;
    darkshrines: {
      [key: string]: number;
    };
  };
  masters?: {
    [key: string]: {
      completed: boolean;
      tier3Rooms?: string[];
      missionMap?: boolean;
      isTemple?: boolean;
    };
  };
  syndicate?: {
    [key: string]: {
      defeated: boolean;
      killedPlayer: boolean;
      safehouseLeaderDefeated: boolean;
    };
  };
  sirusBattle?: {
    start: number;
    completed: boolean;
    finalPhaseStart: number;
    dieBeamsFired: number;
    dieBeamKills: number;
    droppedOrb: boolean;
  };
  legionGenerals?: {
    [key: string]: {
      defeated: boolean;
    };
  };
  conqueror: {
    [key: string]: {
      encountered: boolean;
      battle: boolean;
      defeated: boolean;
      droppedOrb: boolean;
    };
  };
  metamorph?: {
    [key: string]: number;
  };
  heistRogues?: {
    [key: string]: any;
  };
  heistCompleted?: boolean;
  deaths?: number;
  mapBoss?: {
    [key: string]: {
      time: number;
      deaths: number;
    };
  };
  bossBattle?: {
    time: number;
    deaths: number;
  };
  elderGuardian?: string;
};

type Run = {
  id: string;
  name: string;
  runinfo: string;
  areaType: string;
  parsedRunInfo?: RunInfo;
  kills?: number;
  gained?: number;
  firstevent: number;
  lastevent: number;
  deaths?: number;
  conqueror_time?: number;
  conqueror_deaths?: number;
  mastermind_deaths?: number;
  sirus_deaths?: number;
  shaper_deaths?: number;
  maven_deaths?: number;
  oshabi_deaths?: number;
  venarius_deaths?: number;
};

type Order = 'asc' | 'desc';

type StashTab = {
  id: string;
  name: string;
  type: string;
  items: any[];
  public?: boolean;
}

type StashTabData = {
  id: string;
  name: string;
  type: string;
  index?: number;
  metadata: {
    public?: boolean;
    folder?: boolean;
    color?: string; // 6 digits hex color
  }
  items?: ItemData[];
  children?: StashTabData[];
  tracked: boolean;
};

type ItemData = {
  pickupStackSize: number;
  maxStackSize: any;
  properties?: any[];
  requirements?: any;
  frameType: number;
  influences?: string[];
  shaper?: boolean;
  elder?: boolean;
  icon: string;
  sockets?: {
    group: number;
    sColour: string;
  }[];

  name: string;
  id: string;
  ilvl: number;
  styleModifiers: any;
  typeLine: string;
  hybrid?: {
    baseTypeName: string;
  };
  identified?: boolean;
  corrupted?: boolean;
  duplicated?: boolean;
  stackSize: number;
  replica: boolean;
  veiled: boolean;
  synthesised?: boolean;
  fractured?: boolean;
  explicitMods: string[];
  implicitMods: string[];
  enchantMods: string[];
  w: number;
  h: number;
  value: number;
  secretName?: string;
  area?: string;
  map_id?: string;
  stashTabId?: string;
};

export type { Run, Order, RunInfo, StashTabData, ItemData };
