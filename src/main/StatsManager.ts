import logger from 'electron-log';
import dayjs, { ManipulateType } from 'dayjs';
import DB from './db/stats';
import RatesManager from './RatesManager';
import { Run } from '../helpers/types';
import Constants from '../helpers/constants';
import ItemPricer from './modules/ItemPricer';
const { areas } = Constants;

type GetStatsParams = {
  league: string;
  characterName: string;
};

const booleanStatsKeys = [
  'abyssalDepths',
  'vaalSideAreas',
  'blightedMap',
  'blightEncounter',
  'strangeVoiceEncountered',
  'elderDefeated',
];

const countableStatsKeys = ['beastRecipes', 'deaths', 'abnormalDisconnect'];

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


const BossStatsConfig = [
  { name: 'Catarina', key: 'betrayal' },
  { name: 'Shaper', key: 'shaper', phases: 3 },
  { name: 'Sirus', key: 'sirus' },
  { name: 'Synthesis', key: 'synthesis' },
  { name: 'Maven', key: 'maven' },
  { name: 'Oshabi', key: 'harvest' },
  { name: 'Conquerors', key: 'conquerors' },
  // { name: 'Elder', key: 'elder', start: false } // No start there
]

const getAreaType = (area: string) => {
  const keys = Object.keys(areas).filter((areaType) => areas[areaType].includes(area));
  if (keys.length > 0) {
    // logger.debug(`Found area type ${keys[0]} for "${area}"`);
    return keys[0];
  }
  logger.warn(`No area type found for "${area}"`);
  return 'Other';
};

const formatRun = (run: Run): Run => {
  const newRun = { ...run };
  if (newRun.run_info) {
    newRun.parsedRunInfo = JSON.parse(newRun.run_info);
    if (!newRun.parsedRunInfo) return newRun;

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
};

class StatsManager {
  stats: any = {
    misc: {
      xp: 0,
      kills: 0,
      shrines: {
        total: 0,
        types: {},
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
        phases: {},
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
          },
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
          },
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
          },
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
        encountered: 0,
        organs: {},
      },
      bestiary: {
        captured: {
          yellow: 0,
          red: 0,
        },
        crafted: {
          time: {
            total: 0,
            min: 999999999,
            max: 0,
          },
          count: 0,
        },
      },
      incursion: {
        unlocks: {
          count: 0,
          time: {
            total: 0,
            min: 999999999,
            max: 0
          }
        },
        rooms: {
          count: 0,
          types: {}
        }
      },
      delve: {
        niko: 0,
        sulphiteNodes: 0
      },
      betrayal: {
        junCounter: 0,
        memberEncounters: 0,
        members: {},
        boss: {
          started: 0,
          finished: 0
        }
      },
      blight: {
        encounters: 0,
        lanes: {
          total: 0,
          min: 9999,
          max: 0
        },
        maps: 0
      },
      legion: {
        generals: {
          encounters: 0,
          kills: 0
        }
      }
    },
    areas: {},
    bosses: {
      maps: {
        name: 'Map Bosses',
        count: 0,
        totalTime: 0,
        fastest: Number.MAX_SAFE_INTEGER,
        deaths: 0,
        details: {},
      },
      shaperGuardians: {
        name: 'Shaper Guardians',
        count: 0,
        totalTime: 0,
        fastest: Number.MAX_SAFE_INTEGER,
        deaths: 0,
        details: {},
      },
      elderGuardians: {
        name: 'Elder Guardians',
        count: 0,
        totalTime: 0,
        fastest: Number.MAX_SAFE_INTEGER,
        deaths: 0,
        details: {},
      },
      conquerors: {
        name: 'Conquerors',
        count: 0,
        totalTime: 0,
        fastest: Number.MAX_SAFE_INTEGER,
        deaths: 0,
        details: {},
      },
      legion: {
        name: 'Legion Generals',
        count: 0,
        totalTime: 0,
        fastest: Number.MAX_SAFE_INTEGER,
        deaths: 0,
        details: {},
      },
      betrayal: {
        name: 'Catarina, Master of Undeath',
        count: 0,
        totalTime: 0,
        fastest: Number.MAX_SAFE_INTEGER,
        deaths: 0,
      },
      sirus: {
        name: 'Sirus, Awakener of Worlds',
        count: 0,
        totalTime: 0,
        fastest: Number.MAX_SAFE_INTEGER,
        deaths: 0,
      },
      shaper: {
        name: 'The Shaper',
        count: 0,
        totalTime: 0,
        fastest: Number.MAX_SAFE_INTEGER,
        deaths: 0,
      },
      harvest: {
        name: 'Oshabi, Avatar of the Grove',
        count: 0,
        totalTime: 0,
        fastest: Number.MAX_SAFE_INTEGER,
        deaths: 0,
      },
      maven: {
        name: 'The Maven',
        count: 0,
        totalTime: 0,
        fastest: Number.MAX_SAFE_INTEGER,
        deaths: 0,
      },
      synthesis: {
        name: 'Venarius, the Eternal',
        count: 0,
        totalTime: 0,
        fastest: Number.MAX_SAFE_INTEGER,
        deaths: 0,
      },
    },
    items: {
      divinePrice: 0,
      loot: [],
    },
  };
  constructor(
    { runs, items, divinePrice }: { runs: Run[]; items: any[]; divinePrice: number } = {
      runs: [],
      items: [],
      divinePrice: 0,
    }
  ) {
    for (const phase of shaperBattlePhases) {
      this.stats.misc.shaper.phases[phase.name] = { count: 0, totalTime: 0 };
    }
    for (const run of runs) {
      this.addStatsForRun(run);
      this.addBossStats(run);
    }
    this.stats.items.divinePrice = divinePrice;
    this.stats.items.loot = items;
    this.stats.misc.rawDivineDrops = items.filter((item) => item.typeline === 'Divine Orb').length;
    this.stats.misc.valueOfDrops = items.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  }

  addStatsForRun(run: Run) {
    this.stats.misc.xp += Number(run.gained);
    this.stats.misc.kills += Number(run.kills);

    // Count boolean stats
    for (const key of booleanStatsKeys) {
      if (run.parsedRunInfo?.[key]) {
        if (!this.stats.misc[key]) {
          this.stats.misc[key] = 0;
        }
        this.stats.misc[key] = ++this.stats.misc[key];
      }
    }

    // Count basic countable stats
    for (const key of countableStatsKeys) {
      if (run.parsedRunInfo?.[key]) {
        this.stats.misc[key] = (this.stats.misc[key] ?? 0) + Number(run.parsedRunInfo[key]);
      }
    }

    // Add Maven stats
    if (run.parsedRunInfo?.maven) {
      switch (run.name) {
        case "The Maven's Crucible":
          this.stats.misc.maven.crucible.started++;
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
    if (run.parsedRunInfo?.envoy) {
      this.stats.misc.envoy = this.stats.misc.envoy || { encounters: 1, words: 0 };
      this.stats.misc.envoy.words += run.parsedRunInfo.envoy.words;
    }

    // Shrines info
    if (run.parsedRunInfo?.shrines) {
      for (const shrine of run.parsedRunInfo.shrines) {
        if (shrine) {
          this.stats.misc.shrines.total++;
          this.stats.misc.shrines.types[shrine] ||= 0;
          this.stats.misc.shrines.types[shrine]++;
        }
      }
    }

    // Simulacrum info
    if (run.parsedRunInfo?.simulacrumProgress) {
      this.stats.misc.simulacrum.encounters++;
      this.stats.misc.simulacrum.splinters += run.parsedRunInfo.simulacrumProgress.splinters;
    }

    // Labyrinth info
    if (run.parsedRunInfo?.labyrinth) {
      this.stats.misc.labyrinth.started++;
      if (run.parsedRunInfo.labyrinth.completed) {
        this.stats.misc.labyrinth.completed++;
      }
      if (run.parsedRunInfo.labyrinth.argusKilled) {
        this.stats.misc.labyrinth.argusKilled++;
      }
      if (run.parsedRunInfo.labyrinth.darkshrines) {
        for (const shrine in run.parsedRunInfo.labyrinth.darkshrines) {
          this.stats.misc.labyrinth.darkshrines[shrine] =
            (this.stats.misc.labyrinth.darkshrines[shrine] ?? 0) +
            run.parsedRunInfo.labyrinth.darkshrines[shrine];
        }
      }
    }

    // Masters info
    if (run.parsedRunInfo?.masters) {
      for (const master in run.parsedRunInfo.masters) {
        const masterPrefix = master.replace(',', '').split(' ')[0].toLowerCase();
        this.stats.misc.masters[masterPrefix] = this.stats.misc.masters[masterPrefix] ?? {
          started: 0,
          completed: 0,
          missionMaps: 0,
        };
        const stats = this.stats.misc.masters[masterPrefix];
        const parsedStats = run.parsedRunInfo.masters[master];
        stats.started++;
        if (parsedStats.completed) {
          stats.completed = stats.completed++;
        }

        for (const stat in stats?.details) {
          if (typeof stats.details[stat] === 'number' && !!parsedStats[stat]) {
            stats.details[stat] += parsedStats[stat];
          }
        }

        if (parsedStats.isTemple) stats.detals.temples++;

        if (parsedStats.tier3Rooms) {
          for (const room of parsedStats.tier3Rooms) {
            if (stats.details.tier3Rooms[room] === undefined) {
              stats.details.tier3Rooms[room] = 0;
            }
            stats.details.tier3Rooms[room] = ++stats.details.tier3Rooms[room];
          }
        }

        if (parsedStats.missionMap) {
          stats.details.missionMaps++;
        }
      }
    }

    // Metamorph Info
    if (run.parsedRunInfo?.metamorph) {
      for (const metamorphId in run.parsedRunInfo.metamorph) {
        const parsedStats = run.parsedRunInfo.metamorph[metamorphId];
        this.stats.misc.metamorph.encountered++;
        this.stats.misc.metamorph.organs[metamorphId] =
          (this.stats.misc.metamorph.organs[metamorphId] ?? 0) + parsedStats;
      }
    }

    // Heist Info
    if (run.parsedRunInfo?.heistRogues && Object.keys(run.parsedRunInfo?.heistRogues).length > 0) {
      let isNormalHeist = false;
      const rogues = Object.keys(run.parsedRunInfo.heistRogues);
      if (rogues.length === 1) {
        // Normal heist map
        isNormalHeist = true;
        this.stats.misc.heist.heists++;
        if (run.parsedRunInfo?.heistCompleted) {
          // TODO: Change this data to fit into the heist stuff... seriously
          this.stats.misc.heist.heistsCompleted++;
        }
      } else if (rogues.length > 1) {
        // Grand Heist
        this.stats.misc.heist.grandHeists++;
      }
      for (const rogue of rogues) {
        this.stats.misc.heist.rogues[rogue] = this.stats.misc.heist.rogues[rogue] ?? {
          heists: 0,
          heistsCompleted: 0,
          grandHeists: 0,
        };
        if (isNormalHeist) {
          this.stats.misc.heist.rogues[rogue].heists++;
          if (run.parsedRunInfo?.heistCompleted) {
            this.stats.misc.heist.rogues[rogue].heistsCompleted++;
          }
        } else {
          this.stats.misc.heist.rogues[rogue].grandHeists++;
        }
      }
    }

    // Area Stats
    const time = Number(this.getRunningTime(run.first_event, run.last_event));

    this.stats.areas[run.areaType] = this.stats.areas[run.areaType] ?? {
      count: 0,
      gained: 0,
      kills: 0,
      time: 0,
      deaths: 0,
    };
    const stats = this.stats.areas[run.areaType];
    stats.name = run.areaType;
    stats.count++;
    stats.gained += run.gained;
    stats.kills += run.kills;
    stats.time += time;
    stats.profitPerHour = stats.gained / (stats.time / 3600);

    if (run.parsedRunInfo?.deaths && run.parsedRunInfo.deaths > 0) {
      stats.deaths += run.parsedRunInfo.deaths;
    }

    stats.areas = stats.areas ?? {};
    stats.areas[run.name] = stats.areas[run.name] ?? {
      count: 0,
      gained: 0,
      kills: 0,
      time: 0,
      deaths: 0,
    };
    const areaStats = stats.areas[run.name];
    areaStats.name = run.name;
    areaStats.count++;
    areaStats.gained += run.gained;
    areaStats.kills += run.kills;
    areaStats.time += time;
    areaStats.profitPerHour = areaStats.time > 0 ? areaStats.gained / (areaStats.time / 3600) : 0;
    if (run.parsedRunInfo?.deaths && run.parsedRunInfo?.deaths > 0) {
      areaStats.deaths += run.parsedRunInfo?.deaths;
    }

    areaStats.maps = areaStats.maps ?? [];
    areaStats.maps.push({
      id: run.id,
      date: run.first_event,
      time: time,
      gained: run.gained,
      profitPerHour: !!run.gained && time > 0 ? run.gained / (time / 3600) : 0,
      kills: run.kills ?? 0,
      deaths: run.parsedRunInfo?.deaths ?? 0,
    });

    this.addBeastsStats(run);
    this.addBetrayalStats(run);
    this.addBlightStats(run);
    this.addIncursionStats(run);
    this.addDelveStats(run);
    this.addLegionStats(run);
  }

  addBlightStats(run: Run) {
    if(run.parsedRunInfo?.blight) {
      for(const event of run.parsedRunInfo.blight.events) {
        if(event.action === 'start') {
          this.stats.misc.blight.encounters++;
        } else if (event.action === 'newLane') {
          this.stats.misc.blight.lanes.total++;
        }
      }
      const lanes = run.parsedRunInfo.blight.events.filter(e => e.action === 'newLane').length + 1;
      this.stats.misc.blight.lanes.total += lanes;
      this.stats.misc.blight.lanes.min = Math.min(this.stats.misc.blight.lanes.min, lanes);
      this.stats.misc.blight.lanes.max = Math.max(this.stats.misc.blight.lanes.max, lanes);
      if(lanes > 8) {
        this.stats.misc.blight.maps++;
      }
    }
  }

  addBetrayalStats(run: Run) {
    if (run.parsedRunInfo?.betrayal) {
      if(run.parsedRunInfo.betrayal.fights) {
        this.stats.misc.betrayal.junCounter++;
        for(const fight of run.parsedRunInfo.betrayal.fights) {
          this.stats.misc.betrayal.memberEncounters = this.stats.misc.betrayal.memberEncounters ?? 0;
          this.stats.misc.betrayal.memberEncounters++;
          this.stats.misc.betrayal.members[fight.npc] = this.stats.misc.betrayal.members[fight.npc] ?? {
            encounters: 0,
            killedPlayers: 0,
            defeated: 0,
            defeatedAsLeader: 0
          };
          switch(fight.action) {
            case 'killedPlayer':
              this.stats.misc.betrayal.members[fight.npc].killedPlayers++;
              break;
            case 'defeated':
              this.stats.misc.betrayal.members[fight.npc].defeated++;
              break;
            case 'defeatedAsLeader':
              this.stats.misc.betrayal.members[fight.npc].defeatedAsLeader++;
              break;
          }
          this.stats.misc.betrayal.members[fight.npc].encounters++;
        }
      }
      if(run.parsedRunInfo.betrayal.bossfights) {
        for(const fight of run.parsedRunInfo.betrayal.bossfights) {
          this.stats.misc.betrayal.boss.started++;
          if(fight.finished) {
            this.stats.misc.betrayal.boss.finished++;
          }
        }
      }
    }
  }

  addIncursionStats(run: Run) {
    if (run.parsedRunInfo?.incursion) {
      if(run.parsedRunInfo.incursion.unlocked) {
        this.stats.misc.incursion.unlocks.count += run.parsedRunInfo.incursion.unlocked.length;
        for(const unlock of run.parsedRunInfo.incursion.unlocked) {
          const runningTime = this.getRunningTime(
            unlock.started,
            unlock.finished
          );
          this.stats.misc.incursion.unlocks.time.total += runningTime;
          this.stats.misc.incursion.unlocks.time.max = Math.max(this.stats.misc.incursion.unlocks.time.max, runningTime);
          this.stats.misc.incursion.unlocks.time.min = Math.min(this.stats.misc.incursion.unlocks.time.min, runningTime);
        }
      }
      if(run.parsedRunInfo.incursion.rooms) {
        this.stats.misc.incursion.rooms.temples++;
        this.stats.misc.incursion.rooms.count += run.parsedRunInfo.incursion.rooms.length;
        for(const room of run.parsedRunInfo.incursion.rooms) {
          this.stats.misc.incursion.rooms.types[room.roomName] = (this.stats.misc.incursion.rooms.types[room.roomName] ?? 0) + 1;
        }
      }
    }
  }

  addBeastsStats(run: Run) {
    if (run.parsedRunInfo?.beasts) {
      if(run.parsedRunInfo.beasts.captured) {
        this.stats.misc.bestiary.captured.yellow += run.parsedRunInfo.beasts.captured.yellow;
        this.stats.misc.bestiary.captured.red += run.parsedRunInfo.beasts.captured.red
      }
      if (run.parsedRunInfo.beasts.crafted) {
        this.stats.misc.bestiary.crafted.count += run.parsedRunInfo.beasts.crafted.length;
        for(const craft of run.parsedRunInfo.beasts.crafted) {
          const runningTime = this.getRunningTime(
            craft.started,
            craft.finished
          );
          this.stats.misc.bestiary.crafted.time.total += runningTime;
          this.stats.misc.bestiary.crafted.time.max = Math.max(this.stats.misc.bestiary.crafted.time.max, runningTime);
          this.stats.misc.bestiary.crafted.time.min = Math.min(this.stats.misc.bestiary.crafted.time.min, runningTime);
        }
      }
    }
  }

  addDelveStats(run: Run) {
    if(run.parsedRunInfo?.delve) {
      this.stats.misc.delve.niko += run.parsedRunInfo.delve.niko ? 1 : 0;
      this.stats.misc.delve.sulphiteNodes += run.parsedRunInfo.delve.sulphiteNodes ?? 0;
    }
  }

  addLegionStats(run: Run) {
    if(run.parsedRunInfo?.legion?.bossFights) {
      this.stats.misc.legion.generals.encounters += run.parsedRunInfo.legion.bossFights.length;
      this.stats.misc.legion.generals.kills += run.parsedRunInfo.legion.bossFights.filter((f: any) => f.finished).length;

      for(const fight of run.parsedRunInfo.legion.bossFights) {
        this.stats.bosses.legion.details[fight.bossName] = this.stats.bosses.legion.details[fight.bossName] ?? {
          name: fight.bossName,
          count: 0,
          totalTime: 0,
          fastest: Number.MAX_SAFE_INTEGER,
          deaths: 0,
        };
        const stats = this.stats.bosses.legion.details[fight.bossName];
        stats.count++;
      }
    }
  }

  addBossStats(run: Run) {
    const detectedBosses: string[] = [];

    for(const config of BossStatsConfig) {
      if (run.parsedRunInfo?.[config.key]?.bossFights) {
        detectedBosses.push(config.name);
      } else {
        continue;
      }

      this.stats.bosses[config.key] = this.stats.bosses[config.key] ?? {
        name: run.parsedRunInfo?.[config.key].boss,
        count: 0,
        totalTime: 0,
        fastest: Number.MAX_SAFE_INTEGER,
        deaths: 0,
      };

      const stats = this.stats.bosses[config.key];
      stats.count++;
      if(run.parsedRunInfo[config.key].bossFights[0].started) {
        const battleTime = this.getRunningTime(
          run.parsedRunInfo[config.key].bossFights[0].started,
          run.parsedRunInfo[config.key].bossFights[run.parsedRunInfo[config.key].bossFights.length - 1].finished
        );
        stats.totalTime += battleTime;
        stats.fastest = Number(Math.min(stats.fastest, battleTime));
        stats.deaths += Number(run.parsedRunInfo?.deaths ?? 0);
      }
    }

    // Special handling for elder guardian bosses
    if (run.parsedRunInfo?.bossBattle && run.parsedRunInfo.elderGuardian) {
      const name = run.parsedRunInfo.elderGuardian;
      let statKey = 'elderGuardians';
      this.stats.bosses[statKey].details[name] = this.stats.bosses[statKey].details[name] ?? {
        name,
        count: 0,
        totalTime: 0,
        fastest: Number.MAX_SAFE_INTEGER,
        deaths: 0,
      };
      const stats = this.stats.bosses[statKey].details[name];
      const totalStats = this.stats.bosses[statKey];
      const battleTime = Number(run.parsedRunInfo.bossBattle.time ?? 0);

      stats.count++;
      stats.totalTime += battleTime;
      stats.fastest = Math.min(stats.fastest, battleTime);
      stats.deaths += Number(run.parsedRunInfo?.bossBattle.deaths ?? 0);
      totalStats.count++;
      totalStats.totalTime += battleTime;
      totalStats.fastest = Math.min(totalStats.fastest, battleTime);
      totalStats.deaths += Number(run.parsedRunInfo?.bossBattle.deaths ?? 0);
    }

    if (run.parsedRunInfo?.maven?.witnesses && run.parsedRunInfo?.shaper?.guardians) {
      for(const bossData of run.parsedRunInfo.shaper.guardians) {
        const boss = bossData.guardianName;
        let statKey = 'shaperGuardians';
        this.stats.bosses[statKey].details[boss] = this.stats.bosses[statKey].details[boss] ?? {
          name: boss,
          count: 0,
          totalTime: 0,
          fastest: Number.MAX_SAFE_INTEGER,
          deaths: 0,
        };
        const stats = this.stats.bosses[statKey].details[boss];
        const totalStats = this.stats.bosses[statKey];


        const battleTime =  this.getRunningTime(
          run.parsedRunInfo?.maven.witnesses[0].started || run.first_event,
          run.parsedRunInfo?.maven.witnesses[run.parsedRunInfo?.maven.witnesses.length - 1].finished || run.last_event
        );
        stats.count++;
        stats.totalTime += battleTime;
        stats.fastest =
          battleTime > 0 ? Number(Math.min(stats.fastest, battleTime)) : stats.fastest;
        stats.deaths += bossData.deaths ?? 0;

        totalStats.count++;
        totalStats.totalTime += battleTime;
        totalStats.fastest =
          battleTime > 0 ? Number(Math.min(stats.fastest, battleTime)) : stats.fastest;
        totalStats.deaths += bossData.deaths ?? 0;
      }
    }

    // Manually detected Bosses
    if (run.parsedRunInfo?.mapBoss) {
      for (let boss in run.parsedRunInfo.mapBoss) {
        if (detectedBosses.includes(boss)) continue;
        let statKey;
        if (Constants.shaperGuardiansMaps.includes(boss)) {
          statKey = 'shaperGuardians';
        } else {
          statKey = 'maps';
        }
        this.stats.bosses[statKey].details[boss] = this.stats.bosses[statKey].details[boss] ?? {
          name: boss,
          count: 0,
          totalTime: 0,
          fastest: Number.MAX_SAFE_INTEGER,
          deaths: 0,
        };
        const stats = this.stats.bosses[statKey].details[boss];
        const totalStats = this.stats.bosses[statKey];
        const parsedStats = run.parsedRunInfo.mapBoss[boss];
        const battleTime = run.parsedRunInfo?.bossBattle?.time
          ? Number(run.parsedRunInfo.bossBattle.time)
          : 0;
        logger.debug(run.parsedRunInfo, battleTime);
        stats.count++;
        stats.totalTime += battleTime;
        stats.fastest =
          battleTime > 0 ? Number(Math.min(stats.fastest, battleTime)) : stats.fastest;
        stats.deaths += parsedStats.deaths ?? 0;

        totalStats.count++;
        totalStats.totalTime += battleTime;
        totalStats.fastest =
          battleTime > 0 ? Number(Math.min(stats.fastest, battleTime)) : stats.fastest;
        totalStats.deaths += parsedStats.deaths ?? 0;
      }
    }
  }

  // Utility functions
  getRunningTime(
    firstevent: string | number | dayjs.Dayjs,
    lastevent: string | number | dayjs.Dayjs,
    format: ManipulateType = 'seconds'
  ) {
    const duration = dayjs.duration(
      dayjs(lastevent, 'YYYYMMDDHHmmss').diff(dayjs(firstevent, 'YYYYMMDDHHmmss'))
    );
    return duration.as(format);
  }
}

class ProfitTracker {
  announcer: { announce: Function } | null;
  announceTimer: NodeJS.Timeout;
  announceTimerCooldown: number = 30000; // 30 seconds
  constructor() {
    this.announcer = null;
    this.announceTimer = setInterval(() => {
      this.refreshProfitPerHour();
    }, this.announceTimerCooldown);
  }
  async refreshProfitPerHour() {
    if (this.announcer) {
      const profitPerHour = {
        daily: await this.getProfitPerHourForLastDay(),
        hourly: await this.getProfitPerHourForLastHour(),
      };
      logger.debug(`Updating profit per hour to `, profitPerHour);

      this.announcer.announce(profitPerHour, await ItemPricer.getCurrencyByName('Divine Orb'));
    }
  }
  getProfitPerHourForLastHour() {
    return DB.getProfitPerHour(dayjs().subtract(1, 'hour').toISOString());
  }
  getProfitPerHourForLastDay() {
    return DB.getProfitPerHour();
  }
  setProfitPerHourAnnouncer(callback) {
    this.announcer = { announce: callback };
  }
}

const profitTracker = new ProfitTracker();

const statsManager = {
  getAllStats: async ({ league, characterName }: GetStatsParams) => {
    const times: {step: string, timestamp: number}[] = [];
    times.push({step: 'start', timestamp: performance.now()});
    const runs = (await DB.getAllRuns())?.map(formatRun);
    times.push({step: 'retrieved runs', timestamp: performance.now()});
    logger.debug(`Successfully retrieved ${runs.length} runs in ${times[1].timestamp - times[0].timestamp} ms`);
    const items = await DB.getAllItems(league);
    times.push({step: 'retrieved items', timestamp: performance.now()});
    logger.debug(`Successfully retrieved ${items.length} items in ${times[2].timestamp - times[1].timestamp} ms`);
    const divinePrice = await RatesManager.getCurrencyValue(
      league,
      dayjs().format('YYYYMMDD'),
      'Divine Orb'
    );
    times.push({step: 'retrieved divine price', timestamp: performance.now()});
    logger.debug(`Successfully retrieved divine price of ${divinePrice} in ${times[3].timestamp - times[2].timestamp} ms`);
    const manager = new StatsManager({ runs, items, divinePrice });
    times.push({step: 'created manager', timestamp: performance.now()});
    logger.debug(`Successfully created manager in ${times[4].timestamp - times[3].timestamp} ms`);
    return manager.stats;
  },
  getAllMapNames: async () => {
    const mapNames = await DB.getAllMapNames();
    return mapNames;
  },

  getAllPossibleMods: async () => {
    const mods = await DB.getAllPossibleMods();
    return mods;
  },

  registerProfitPerHourAnnouncer: (callback) => {
    profitTracker.setProfitPerHourAnnouncer(callback);
  },

  triggerProfitPerHourAnnouncer: () => {
    profitTracker.refreshProfitPerHour();
  },
};

export default statsManager;
