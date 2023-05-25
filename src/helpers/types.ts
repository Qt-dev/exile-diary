type RunInfo = {
  blightedMap?: string;
  maven?: {
    crucibleCompleted?: boolean;
    mavenDefeated?: boolean;
  };
  shaperBattle?: {
    completed: boolean;
  };
  mastermindBattle?: {
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
    }
  }
  masters?: {
    [key: string]: {
      completed: boolean;
      tier3Rooms?: string[]
      missionMap?: boolean;
      isTemple?: boolean;
    };
  };
  syndicate?: {
    [key: string]: {
      defeated: boolean
      killedPlayer: boolean;
      safehouseLeaderDefeated: boolean;
    };
  };
  sirusBattle?: {
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
  name: string;
  runinfo: string;
  areaType: string;
  parsedRunInfo?: RunInfo,
  kills?: number;
  gained?: number;
  firstevent: number;
  lastevent: number;
  deaths?: number;
};


export type { Run };