type BossFights = {
      bossName?: string;
      action: string;
      started?: string;
      finished?: string;
      enemy?: string;
      phase?: number;
    }[];

type RunInfo = {
  blightedMap?: string;
  beasts?: {
    captured: {
      yellow: number;
      red: number;
    },
    crafted: {
      started: string;
      finished: string;
    }[];
  };
  incursion?: {
    unlocked: { started: string, finished: string }[];
    rooms: { roomName: string, roomId: boolean, timestamp: string }[];
  };
  maven?: {
    crucibleCompleted?: number;
    mavenDefeated?: number;
    firstLine: number;
    witnesses?: {
      started?: string;
      finished?: string;
    }[];
  };
  harvest?: {
    bossFights: BossFights;
  };
  synthesis?: {
    bossFights: BossFights;
  };
  shaper?: {
    bossFights: BossFights;
    guardians?: {
      guardianName: string;
      started: string;
      deaths: number;
    }[]
  };
  envoy?: {
    words: number;
  };
  shrines?: string[];
  simulacrumProgress?: {
    splinters: number;
  };
  labyrinth?: {
    completed: number;
    argusKilled: number;
    darkshrines: {
      [key: string]: number;
    };
  };
  masters?: {
    [key: string]: {
      completed: number;
      tier3Rooms?: string[];
      missionMap?: boolean;
      isTemple?: boolean;
    };
  };
  betrayal?: {
    fights?: {
      npc: string;
      action: string;
      timestamp: string;
    }[];
    bossfights: BossFights;
  };
  sirus?: {
    bossFights: BossFights;
  };
  legion?: {
    bossFights: {
      bossName: string;
      finished: string;
    }[];
  };
  conqueror: {
    bossFights: BossFights;
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
  delve: {
    niko: boolean,
    sulphiteNodes: number
  };
  blight: {
    events: {
      action: string;
      timestamp: string;
    }[];
  }
};

type Run = {
  id: string;
  name: string;
  run_info: string;
  areaType: string;
  parsedRunInfo?: RunInfo;
  kills?: number;
  gained?: number;
  first_event: number;
  last_event: number;
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
};

type StashTabData = {
  id: string;
  name: string;
  type: string;
  index?: number;
  metadata: {
    public?: boolean;
    folder?: boolean;
    color?: string; // 6 digits hex color
  };
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
  originalValue: number;
  secretName?: string;
  area?: string;
  map_id?: string;
  stashTabId?: string;
  inventoryId: string;
  isIgnored: boolean;
  incubatedItem?: {
    name: string;
    level: number;
    progress: number;
    total: number;
  };
};

export type { Run, Order, RunInfo, StashTabData, ItemData, StashTab };
