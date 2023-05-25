import DB from "./db/stats";
import { Run } from "../helpers/types";
import Constant from "../helpers/constants";
import logger from "electron-log";
import moment from "moment";
const { areas } = Constant;

type GetStatsParams = {
  league: string;
  characterName: string;
}

const booleanStatsKeys = [
  'abyssalDepths',
  'vaalSideAreas',
  'blightedMap',
  'blightEncounter',
  'strangeVoiceEncountered',
  'elderDefeated',
];

const countableStatsKeys = [
  'beastRecipes',
  'deaths',
  'abnormalDisconnect'
];

const shaperBattlePhases = [
  { name: 'start' },
  { name: 'boss1', endpoint: true },
  { name: 'boss2', endpoint: true },
  { name: 'boss3', endpoint: true },
  { name: 'boss4', endpoint: true },
  { name: 'phase1start' },
  { name: 'phase2start', endpoint: true },
  { name: 'phase3start', endpoint: true },
  { name: 'completed', endpoint: true },
];

const getAreaType = (area: string) => {
  const keys = Object.keys(areas).filter((areaType) => areas[areaType].includes(area));
  if(keys.length > 0) {
    // logger.debug(`Found area type ${keys[0]} for "${area}"`);
    return keys[0];
  }
  logger.info(`No area type found for "${area}"`);
  return 'Other';
}


const formatRun = (run : Run) : Run => {
  const newRun = { ...run };
  if(newRun.runinfo) {
    newRun.parsedRunInfo = JSON.parse(newRun.runinfo);
    if(!newRun.parsedRunInfo) return newRun;

    newRun.areaType = newRun.parsedRunInfo.blightedMap ? 'blightedMaps' : getAreaType(newRun.name);

    // Check if this is a heist run
    if (
      newRun.name === 'Laboratory' &&
      newRun.parsedRunInfo.heistRogues &&
      Object.keys(newRun.parsedRunInfo.heistRogues).length > 0
    ) {
      newRun.areaType = 'heist';
    }

    // Check if this is a grand heist run
    if (
      newRun.areaType === 'heist' &&
      newRun.parsedRunInfo.heistRogues &&
      Object.keys(newRun.parsedRunInfo.heistRogues).length > 1
    ) {
      newRun.areaType = 'grandHeist';
    }
  }

  return newRun;
}

class StatsManager {
  stats: any = {
    misc: {
      xp: 0,
      kills: 0,
      shrines: {
        total: 0,
        types: {}
      },
      abyssalDepths: 0,
      vaalSideAreas: 0,
      blightedMap: 0,
      blightEncounter: 0,
      strangeVoiceEncountered: 0,
      elderDefeated: 0,
      beastRecipes: 0,
      deaths: 0,
      abnormalDisconnect: 0,
      envoy: {
        encounters: 0,
        words: 0,
      },
      maven: {
        crucible: {
          started: 0,
          completed: 0,
        },
        battle: {
          started: 0,
          completed: 0,
        },
      },
      sirus: {
        started: 0,
        completed: 0,
        dieBeamsFired: 0,
        dieBeamKills: 0,
        orbs: 0,
        lastPhaseTime: 0,
      },
      simulacrum: {
        encounters: 0,
        splinters: 0,
      },
      shaper: {
        started: 0,
        completed: 0,
        phases: {
        }
      },
      mastermind: {
        started: 0,
        completed: 0,
      },
      labyrinth: {
        started: 0,
        completed: 0,
        argusKilled: 0,
        darkshrines: {},
      },
      masters: {
        alva: {
          fullName: 'Alva, Master Explorer',
          started: 0,
          completed: 0,
          missionMaps: 0,
          details: {
            incursions: 0,
            temples: 0,
            tier3Rooms: {},
          }
        },
        einhar: {
          fullName: 'Einhar, Beastmaster',
          started: 0,
          completed: 0,
          missionMaps: 0,
          details: {
            beasts: 0,
            redBeasts: 0,
            yellowBeasts: 0,
          }
        },
        jun: {
          fullName: 'Jun, Veiled Master',
          started: 0,
          completed: 0,
          missionMaps: 0,
        },
        niko: {
          fullName: 'Niko, Master of the Depths',
          started: 0,
          completed: 0,
          missionMaps: 0,
          details: {
            sulphite: 0,
          }
        },
      },
      legionGenerals: {
        encounters: 0,
        kills: 0,
        generals: {},
      },
      conquerors: {},
      heist: {
        heists: 0,
        heistCompleted: 0,
        grandHeists: 0,
        rogues: {},
      },
      syndicate: {
        encounters: 0,
        safehouses: 0,
        members: {},
      },
      metamorph: {
        encounters: 0,
        organs: {},
      },
    },
    areas: {},
    bosses: {},
  };
  constructor(runs: Run[] = []) {
    for(const phase of shaperBattlePhases) {
      this.stats.misc.shaper.phases[phase.name] = { count: 0, totalTime: 0 };
    }
    for(const run of runs) {
      this.addStatsForRun(run);
    }
  }

  addStatsForRun(run: Run) {
    this.stats.misc.xp += Number(run.gained);
    this.stats.misc.kills += Number(run.kills);

    // Count boolean stats
    for(const key of booleanStatsKeys) {
      if(run.parsedRunInfo?.[key]) {
        this.stats.misc[key] = ++this.stats.misc[key] ?? 1;
      }
    }

    // Count basic countable stats
    for(const key of countableStatsKeys) {
      if(run.parsedRunInfo?.[key]) {
        this.stats.misc[key] = (this.stats.misc[key] ?? 0) + Number(run.parsedRunInfo[key]);
      }
    }

    // Add Maven stats
    if(run.parsedRunInfo?.maven) {
      switch (run.name) {
        case "The Maven's Crucible":
          this.stats.misc.maven.crucible.started++
          if (run.parsedRunInfo?.maven.crucibleCompleted) {
            this.stats.misc.maven.crucible.completed++;
          }
          break;
        case 'Absence of Mercy and Empathy':
          this.stats.misc.mavenBattle = this.stats.misc.mavenBattle ?? { started: 1, completed: 0 };
          if (run.parsedRunInfo?.maven.mavenDefeated) {
            this.stats.misc.mavenBattle.completed++;
          }
          break;
        default:
          break;
      }
    }

    // Envoy stats
    if(run.parsedRunInfo?.envoy) {
      this.stats.misc.envoy = this.stats.misc.envoy || { encounters: 1, words: 0 };
      this.stats.misc.envoy.words += run.parsedRunInfo.envoy.words;
    }

    // Shrines info
    if(run.parsedRunInfo?.shrines) {
      for(const shrine of run.parsedRunInfo.shrines) {
        this.stats.misc.shrines.total++;
        this.stats.misc.shrines.types[shrine] ||= 0;
        this.stats.misc.shrines.types[shrine]++;
      }
    }

    // Simulacrum info
    if(run.parsedRunInfo?.simulacrumProgress) {
      this.stats.misc.simulacrum.encounters++;
      this.stats.misc.simulacrum.splinters += run.parsedRunInfo.simulacrumProgress.splinters;
    }

    // Shaper battles
    if(run.parsedRunInfo?.shaperBattle) {
      this.stats.misc.shaperBattle.started++;
      if(run.parsedRunInfo.shaperBattle.completed) {
        this.stats.misc.shaperBattle.completed++;
      }

      shaperBattlePhases.forEach((phase, index) => {
        if(phase.endpoint) {
          const currentPhaseName = phase.name;
          const previousPhaseName = shaperBattlePhases[index - 1]?.name;
            if(
              !!run.parsedRunInfo?.shaperBattle?.[previousPhaseName] &&
              !!run.parsedRunInfo?.shaperBattle?.[currentPhaseName]) {
                const runningTime = this.getRunningTime(run.parsedRunInfo?.shaperBattle?.[previousPhaseName], run.parsedRunInfo?.shaperBattle?.[currentPhaseName], 's');
                this.stats.misc.shaper.phases[currentPhaseName].count++;
                this.stats.misc.shaper.phases[currentPhaseName].totalTime += Number(runningTime);
          }
        }
      });
    }

    // Mastermind Battles
    if(run.parsedRunInfo?.mastermindBattle) {
      this.stats.misc.mastermind.started++;
      if(run.parsedRunInfo.mastermindBattle.completed) {
        this.stats.misc.mastermind.completed++;
      }
    }

    // Labyrinth info
    if(run.parsedRunInfo?.labyrinth) {
      this.stats.misc.labyrinth.started++;
      if(run.parsedRunInfo.labyrinth.completed) {
        this.stats.misc.labyrinth.completed++;
      }
      if(run.parsedRunInfo.labyrinth.argusKilled) {
        this.stats.misc.labyrinth.argusKilled++;
      }
      if(run.parsedRunInfo.labyrinth.darkshrines) {
        for(const shrine in run.parsedRunInfo.labyrinth.darkshrines) {
          this.stats.misc.labyrinth.darkshrines[shrine] = (this.stats.misc.labyrinth.darkshrines[shrine] ?? 0) + run.parsedRunInfo.labyrinth.darkshrines[shrine];
        }
      }
    }

    // Masters info
    if(run.parsedRunInfo?.masters) {
      for(const master in run.parsedRunInfo.masters) {
        const masterPrefix = master.replace(',', '').split(' ')[0].toLowerCase();
        this.stats.misc.masters[masterPrefix] = this.stats.misc.masters[masterPrefix] ?? { started: 0, completed: 0, missionMaps: 0 }
        const stats = this.stats.misc.masters[masterPrefix];
        const parsedStats = run.parsedRunInfo.masters[master];
        stats.started++;
        if(parsedStats.completed) {
          stats.completed = stats.completed++;
        }

        for(const stat in stats?.details) {
          if (typeof stats.details[stat] === 'number' && !!parsedStats[stat]) {
            stats.details[stat] += parsedStats[stat];
          }
        }

        if(parsedStats.isTemple) stats.detals.temples++;

        if(parsedStats.tier3Rooms) {
          for(const room of parsedStats.tier3Rooms) {
            stats.details.tier3Rooms[room] = (stats.details.tier3Rooms[room]++ ?? 1);
          }
        }

        if(parsedStats.missionMap) {
          stats.details.missionMaps++;
        }
      }
    }

    // syndicate info
    if(run.parsedRunInfo?.syndicate) {
      let isSafeHouse = false;
      for(const member in run.parsedRunInfo.syndicate) {
        this.stats.misc.syndicate.encounters++;
        this.stats.misc.syndicate.members[member] = this.stats.misc.syndicate.members[member] ?? {
          encounters: 0,
          kills: 0,
          killedBy: 0,
          safehouseLeaderKills: 0,
        };
        const stats = this.stats.misc.syndicate.members[member];
        const parsedStats = run.parsedRunInfo.syndicate[member];
        stats.encounters++;
        if(parsedStats.defeated) {
          stats.kills++;
        }
        if(parsedStats.killedPlayer) {
          stats.killedBy++;
        }
        if(parsedStats.safehouseLeaderDefeated) {
          isSafeHouse = true;
          stats.safehouseLeaderKills++;
        }
      }
      if(isSafeHouse) this.stats.misc.syndicate.safehouses++;
    }

    // Sirus Battle info
    if(run.parsedRunInfo?.sirusBattle) {
      this.stats.misc.sirus.started++;
      if(run.parsedRunInfo.sirusBattle.completed) {
        this.stats.misc.sirus.completed++;
        if(run.parsedRunInfo.sirusBattle.finalPhaseStart) {
          let lastPhaseTime = this.getRunningTime(
            run.parsedRunInfo.sirusBattle.finalPhaseStart,
            run.parsedRunInfo.sirusBattle.completed,
            's'
          );
          this.stats.misc.sirus.lastPhaseTime += Number(lastPhaseTime);
        }
      }
      if(run.parsedRunInfo.sirusBattle.dieBeamsFired) {
        this.stats.misc.sirus.dieBeamsFired += run.parsedRunInfo.sirusBattle.dieBeamsFired;
      }
      if(run.parsedRunInfo.sirusBattle.dieBeamKills) {
        this.stats.misc.sirus.dieBeamKills += run.parsedRunInfo.sirusBattle.dieBeamKills;
      }
      if(run.parsedRunInfo.sirusBattle.droppedOrb) {
        this.stats.misc.sirus.droppedOrb++;
      }
    }

    // Legion Generals Info
    if(run.parsedRunInfo?.legionGenerals) {
      for(const general in run.parsedRunInfo.legionGenerals) {
        this.stats.misc.legionGenerals.generals[general] = this.stats.misc.legionGenerals.generals[general] ?? {
          encounters: 0,
          kills: 0,
        };
        const stats = this.stats.misc.legionGenerals.generals[general];
        const parsedStats = run.parsedRunInfo.legionGenerals[general];
        stats.encounters++;
        this.stats.misc.legionGenerals.encounters++;
        if(parsedStats.defeated) {
          stats.kills++;
          this.stats.misc.legionGenerals.kills++;
        }
      }
    }

    // Conquerors Info
    if(run.parsedRunInfo?.conqueror) {
      for(const conqueror in run.parsedRunInfo.conqueror) {
        if(!this.stats.misc.conquerors[conqueror]) {
          this.stats.misc.conquerors[conqueror] = {
            encounters: 0,
            battles: 0,
            defeated: 0,
            droppedOrb: 0,
          };
        }
        const stats = this.stats.misc.conquerors[conqueror];
        const parsedStats = run.parsedRunInfo.conqueror[conqueror];
        stats.encounters++;
        if(parsedStats.battle) {
          stats.battles++;
        }
        if(parsedStats.defeated) {
          stats.defeated++;
        }
        if(parsedStats.droppedOrb) {
          stats.droppedOrb++;
        }
      }
    }

    // Metamorph Info
    if(run.parsedRunInfo?.metamorph) {
      for(const metamorphId in run.parsedRunInfo.metamorph) {
        const parsedStats = run.parsedRunInfo.metamorph[metamorphId];
        this.stats.misc.metamorph.encountered++;
        this.stats.misc.metamorph.organs[metamorphId] = (this.stats.misc.metamorph.organs[metamorphId] ?? 0) + parsedStats;
      }
    }

    // Heist Info
    if(run.parsedRunInfo?.heistRogues && Object.keys(run.parsedRunInfo?.heistRogues).length > 0) {
      let isNormalHeist = false;
      const rogues = Object.keys(run.parsedRunInfo.heistRogues);
      if(rogues.length === 1) {
        // Normal heist map
        isNormalHeist = true;
        this.stats.misc.heist.heists++;
        if(run.parsedRunInfo?.heistCompleted) { // TODO: Change this data to fit into the heist stuff... seriously
          this.stats.misc.heist.heistsCompleted++;
        }
      } else if (rogues.length > 1) {
        // Grand Heist
        this.stats.misc.heist.grandHeists++;
      }
      for(const rogue of rogues) {
        this.stats.misc.heist.rogues[rogue] = this.stats.misc.heist.rogues[rogue] ?? { heists: 0, heistsCompleted: 0, grandHeists: 0 };
        if(isNormalHeist) {
          this.stats.misc.heist.rogues[rogue].heists++;
          if(run.parsedRunInfo?.heistCompleted) {
            this.stats.misc.heist.rogues[rogue].heistsCompleted++;
          }
        } else {
          this.stats.misc.heist.rogues[rogue].grandHeists++;
        }
      }
    }

    // Area Stats
    this.stats.areas[run.areaType] = this.stats.areas[run.areaType] ?? { count: 0, gained: 0, kills: 0, time: 0, deaths: 0 };
    const stats = this.stats.areas[run.areaType];
    stats.count++;
    stats.gained += run.gained;
    stats.kills += run.kills;
    stats.time += Number(this.getRunningTime(run.firstevent, run.lastevent, 's'));

    if(run?.deaths && run.deaths > 0) {
      stats.deaths += run.deaths;
    }

    stats.areas = stats.areas ?? {};
    stats.areas[run.name] = stats.areas[run.name] ?? { count: 0, gained: 0, kills: 0, time: 0, deaths: 0 };
    const areaStats = stats.areas[run.name];
    areaStats.count++;
    areaStats.gained += run.gained;
    areaStats.kills += run.kills;
    areaStats.time += Number(this.getRunningTime(run.firstevent, run.lastevent, 's'));
    if(run.parsedRunInfo?.deaths && run.parsedRunInfo?.deaths > 0) {
      areaStats.deaths += run.parsedRunInfo?.deaths;
    }
  }

  addBossStats(run : Run) {
    // Manually detected Bosses
    if(run.parsedRunInfo?.mapBoss) {
      for(let boss in run.parsedRunInfo.mapBoss) {
        this.stats.misc.mapBoss[boss] = this.stats.misc.mapBoss[boss] ?? { count: 0, totalTime: 0, fastest: Number.MAX_SAFE_INTEGER, deaths: 0 };
        const stats = this.stats.misc.mapBoss[boss];
        const parsedStats = run.parsedRunInfo.mapBoss[boss];
        stats.count++;
        stats.totalTime += Number(parsedStats.time);
        stats.fastest = Math.min(stats.fastest, parsedStats.time);
        if(parsedStats.deaths) {
          stats.deaths += parsedStats.deaths;
        }
      }
    }

    // Special handling for elder guardian bosses
    if(run.parsedRunInfo?.bossBattle) {
      const name = run.parsedRunInfo?.elderGuardian ?? run.name;
      this.stats.boss.kills[name] = this.stats.boss.kills[name] ?? { count: 0, totalTime: 0, fastest: Number.MAX_SAFE_INTEGER, deaths: 0 };
      const stats = this.stats.boss.kills[name];
      stats.count++;
      stats.totalTime += Number(run.parsedRunInfo?.bossBattle.time);
      stats.fastest = Math.min(stats.fastest, run.parsedRunInfo.bossBattle.time);
      if(run.parsedRunInfo?.bossBattle.deaths) {
        stats.deaths += Number(run.parsedRunInfo?.bossBattle.deaths);
      }
    }


// if (r.conqueror) {
//     for (let i = 0; i < Constants.conquerors.length; i++) {
//       let conq = Constants.conquerors[i];
//       if (r.conqueror[conq] && r.conqueror[conq].defeated) {
//         let killInfo = await getConquerorKillInfo(char, map.id);
//         if (killInfo) {
//           bossKills[conq] = bossKills[conq] || {
//             count: 0,
//             totalTime: 0,
//             fastest: Number.MAX_SAFE_INTEGER,
//             deaths: 0,
//           };
//           bossKills[conq].count++;
//           bossKills[conq].fastest = Math.min(bossKills[conq].fastest, killInfo.time);
//           bossKills[conq].totalTime += Number(killInfo.time);
//           bossKills[conq].deaths += Number(killInfo.deaths);
//         }
//       }
//     }
//   }

//   if (r.mastermindBattle && r.mastermindBattle.battle2start && r.mastermindBattle.completed) {
//     let boss = 'Catarina, Master of Undeath';
//     let killInfo = await getKillInfo(
//       char,
//       r.mastermindBattle.battle2start,
//       r.mastermindBattle.completed
//     );
//     if (killInfo) {
//       bossKills[boss] = bossKills[boss] || {
//         count: 0,
//         totalTime: 0,
//         fastest: Number.MAX_SAFE_INTEGER,
//         deaths: 0,
//       };
//       bossKills[boss].count++;
//       bossKills[boss].fastest = Math.min(bossKills[boss].fastest, killInfo.time);
//       bossKills[boss].totalTime += Number(killInfo.time);
//       bossKills[boss].deaths += Number(killInfo.deaths);
//     }
//   }

//   if (r.sirusBattle && r.sirusBattle.start && r.sirusBattle.completed) {
//     let boss = 'Sirus, Awakener of Worlds';
//     let killInfo = await getKillInfo(char, r.sirusBattle.start, r.sirusBattle.completed);
//     if (killInfo) {
//       bossKills[boss] = bossKills[boss] || {
//         count: 0,
//         totalTime: 0,
//         fastest: Number.MAX_SAFE_INTEGER,
//         deaths: 0,
//       };
//       bossKills[boss].count++;
//       bossKills[boss].fastest = Math.min(bossKills[boss].fastest, killInfo.time);
//       bossKills[boss].totalTime += Number(killInfo.time);
//       bossKills[boss].deaths += Number(killInfo.deaths);
//     }
//   }

//   if (r.shaperBattle && r.shaperBattle.phase1start && r.shaperBattle.completed) {
//     let boss = 'The Shaper';
//     let killInfo = await getKillInfo(char, r.shaperBattle.phase1start, r.shaperBattle.completed);
//     if (killInfo) {
//       bossKills[boss] = bossKills[boss] || {
//         count: 0,
//         totalTime: 0,
//         fastest: Number.MAX_SAFE_INTEGER,
//         deaths: 0,
//       };
//       bossKills[boss].count++;
//       bossKills[boss].fastest = Math.min(bossKills[boss].fastest, killInfo.time);
//       bossKills[boss].totalTime += Number(killInfo.time);
//       bossKills[boss].deaths += Number(killInfo.deaths);
//     }
//   }

//   if (r.maven && r.maven.mavenDefeated && r.maven.firstLine) {
//     let boss = 'The Maven';
//     let killInfo = await getKillInfo(char, r.maven.firstLine, r.maven.mavenDefeated);
//     if (killInfo) {
//       bossKills[boss] = bossKills[boss] || {
//         count: 0,
//         totalTime: 0,
//         fastest: Number.MAX_SAFE_INTEGER,
//         deaths: 0,
//       };
//       bossKills[boss].count++;
//       bossKills[boss].fastest = Math.min(bossKills[boss].fastest, killInfo.time);
//       bossKills[boss].totalTime += Number(killInfo.time);
//       bossKills[boss].deaths += Number(killInfo.deaths);
//     }
//   }

//   if (r.oshabiBattle && r.oshabiBattle.start && r.oshabiBattle.completed) {
//     let boss = 'Oshabi, Avatar of the Grove';
//     let killInfo = await getKillInfo(char, r.oshabiBattle.start, r.oshabiBattle.completed);
//     if (killInfo) {
//       bossKills[boss] = bossKills[boss] || {
//         count: 0,
//         totalTime: 0,
//         fastest: Number.MAX_SAFE_INTEGER,
//         deaths: 0,
//       };
//       bossKills[boss].count++;
//       bossKills[boss].fastest = Math.min(bossKills[boss].fastest, killInfo.time);
//       bossKills[boss].totalTime += Number(killInfo.time);
//       bossKills[boss].deaths += Number(killInfo.deaths);
//     }
//   }

//   // special handling for Synthesis unique maps
//   if (r.venariusBattle && r.venariusBattle.start && r.venariusBattle.completed) {
//     let area = map.name;
//     // if it's a Zana mission map, get the sub-area name
//     if (r.masters && r.masters['Zana, Master Cartographer']) {
//       area = r.masters['Zana, Master Cartographer'].missionMap;
//       if (!Constants.synthesisUniqueMaps.includes(area)) {
//         // the Zana mission map isn't a Synthesis map, ???
//         // this should never happen, but if it does, just return
//         return;
//       }
//     } else if (r.maven && r.maven.firstLine && r.maven.bossKilled) {
//       // if it's an actual Synthesis map but already witnessed by the Maven, don't double count
//       return;
//     }

//     let killInfo = await getKillInfo(char, r.venariusBattle.start, r.venariusBattle.completed);
//     if (killInfo) {
//       bossKills[area] = bossKills[area] || {
//         count: 0,
//         totalTime: 0,
//         fastest: Number.MAX_SAFE_INTEGER,
//         deaths: 0,
//       };
//       bossKills[area].count++;
//       bossKills[area].fastest = Math.min(bossKills[area].fastest, killInfo.time);
//       bossKills[area].totalTime += Number(killInfo.time);
//       bossKills[area].deaths += Number(killInfo.deaths);
//     }
//   }
  }

  // Utility functions
  getRunningTime (firstevent, lastevent, format : string | undefined = undefined ) {
    const duration = moment
      .duration(moment(lastevent, 'YYYYMMDDHHmmss').diff(moment(firstevent, 'YYYYMMDDHHmmss')));
    return moment
      .utc(duration.as('milliseconds'))
      .format(format);
  }
}


export default {
  getAllStats: async ({ league, characterName } : GetStatsParams) => {
    const runs = (await DB.getAllRuns(league))?.map(formatRun);
    const manager = new StatsManager(runs);

    return manager.stats;
  }
};