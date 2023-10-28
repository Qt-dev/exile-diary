import logger from 'electron-log';
import dayjs, { ManipulateType } from 'dayjs';
import DB from './db/stats';
import RatesManager from './RatesManager';
import { Run } from '../helpers/types';
import Constants from '../helpers/constants';
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

const getAreaType = (area: string) => {
  const keys = Object.keys(areas).filter((areaType) => areas[areaType].includes(area));
  if (keys.length > 0) {
    // logger.debug(`Found area type ${keys[0]} for "${area}"`);
    return keys[0];
  }
  logger.info(`No area type found for "${area}"`);
  return 'Other';
};

const formatRun = (run: Run): Run => {
  const newRun = { ...run };
  if (newRun.runinfo) {
    newRun.parsedRunInfo = JSON.parse(newRun.runinfo);
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
      mastermind: {
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
      oshabi: {
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
      venarius: {
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
        this.stats.misc[key] = ++this.stats.misc[key] ?? 1;
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
        this.stats.misc.shrines.total++;
        this.stats.misc.shrines.types[shrine] ||= 0;
        this.stats.misc.shrines.types[shrine]++;
      }
    }

    // Simulacrum info
    if (run.parsedRunInfo?.simulacrumProgress) {
      this.stats.misc.simulacrum.encounters++;
      this.stats.misc.simulacrum.splinters += run.parsedRunInfo.simulacrumProgress.splinters;
    }

    // Shaper battles
    if (run.parsedRunInfo?.shaperBattle) {
      this.stats.misc.shaper.started++;
      if (run.parsedRunInfo.shaperBattle.completed) {
        this.stats.misc.shaper.completed++;
      }

      shaperBattlePhases.forEach((phase, index) => {
        if (phase.endpoint) {
          const currentPhaseName = phase.name;
          const previousPhaseName = shaperBattlePhases[index - 1]?.name;
          if (
            !!run.parsedRunInfo?.shaperBattle?.[previousPhaseName] &&
            !!run.parsedRunInfo?.shaperBattle?.[currentPhaseName]
          ) {
            const runningTime = this.getRunningTime(
              run.parsedRunInfo?.shaperBattle?.[previousPhaseName],
              run.parsedRunInfo?.shaperBattle?.[currentPhaseName]
            );
            this.stats.misc.shaper.phases[currentPhaseName].count++;
            this.stats.misc.shaper.phases[currentPhaseName].totalTime += Number(runningTime);
          }
        }
      });
    }

    // Mastermind Battles
    if (run.parsedRunInfo?.mastermindBattle) {
      this.stats.misc.mastermind.started++;
      if (run.parsedRunInfo.mastermindBattle.completed) {
        this.stats.misc.mastermind.completed++;
      }
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
            stats.details.tier3Rooms[room] = stats.details.tier3Rooms[room]++ ?? 1;
          }
        }

        if (parsedStats.missionMap) {
          stats.details.missionMaps++;
        }
      }
    }

    // syndicate info
    if (run.parsedRunInfo?.syndicate) {
      let isSafeHouse = false;
      for (const member in run.parsedRunInfo.syndicate) {
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
        if (parsedStats.defeated) {
          stats.kills++;
        }
        if (parsedStats.killedPlayer) {
          stats.killedBy++;
        }
        if (parsedStats.safehouseLeaderDefeated) {
          isSafeHouse = true;
          stats.safehouseLeaderKills++;
        }
      }
      if (isSafeHouse) this.stats.misc.syndicate.safehouses++;
    }

    // Sirus Battle info
    if (run.parsedRunInfo?.sirusBattle) {
      this.stats.misc.sirus.started++;
      if (run.parsedRunInfo.sirusBattle.completed) {
        this.stats.misc.sirus.completed++;
        if (run.parsedRunInfo.sirusBattle.finalPhaseStart) {
          let lastPhaseTime = this.getRunningTime(
            run.parsedRunInfo.sirusBattle.finalPhaseStart,
            run.parsedRunInfo.sirusBattle.completed
          );
          this.stats.misc.sirus.lastPhaseTime += Number(lastPhaseTime);
        }
      }
      if (run.parsedRunInfo.sirusBattle.dieBeamsFired) {
        this.stats.misc.sirus.dieBeamsFired += run.parsedRunInfo.sirusBattle.dieBeamsFired;
      }
      if (run.parsedRunInfo.sirusBattle.dieBeamKills) {
        this.stats.misc.sirus.dieBeamKills += run.parsedRunInfo.sirusBattle.dieBeamKills;
      }
      if (run.parsedRunInfo.sirusBattle.droppedOrb) {
        this.stats.misc.sirus.droppedOrb++;
      }
    }

    // Legion Generals Info
    if (run.parsedRunInfo?.legionGenerals) {
      for (const general in run.parsedRunInfo.legionGenerals) {
        this.stats.misc.legionGenerals.generals[general] = this.stats.misc.legionGenerals.generals[
          general
        ] ?? {
          encounters: 0,
          kills: 0,
        };
        const stats = this.stats.misc.legionGenerals.generals[general];
        const parsedStats = run.parsedRunInfo.legionGenerals[general];
        stats.encounters++;
        this.stats.misc.legionGenerals.encounters++;
        if (parsedStats.defeated) {
          stats.kills++;
          this.stats.misc.legionGenerals.kills++;
        }
      }
    }

    // Conquerors Info
    if (run.parsedRunInfo?.conqueror) {
      for (const conqueror in run.parsedRunInfo.conqueror) {
        if (!this.stats.misc.conquerors[conqueror]) {
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
        if (parsedStats.battle) {
          stats.battles++;
        }
        if (parsedStats.defeated) {
          stats.defeated++;
        }
        if (parsedStats.droppedOrb) {
          stats.droppedOrb++;
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
    const time = Number(this.getRunningTime(run.firstevent, run.lastevent));

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
      date: run.firstevent,
      time: time,
      gained: run.gained,
      profitPerHour: !!run.gained && time > 0 ? run.gained / (time / 3600) : 0,
      kills: run.kills ?? 0,
      deaths: run.parsedRunInfo?.deaths ?? 0,
    });
  }

  addBossStats(run: Run) {
    const detectedBosses: string[] = [];

    if (run.parsedRunInfo?.conqueror) {
      for (let conquerorName in run.parsedRunInfo.conqueror) {
        detectedBosses.push(conquerorName);
        this.stats.bosses.conquerors[conquerorName] = this.stats.bosses.conquerors[
          conquerorName
        ] ?? {
          name: conquerorName,
          count: 0,
          totalTime: 0,
          fastest: Number.MAX_SAFE_INTEGER,
          deaths: 0,
        };
        const stats = this.stats.bosses.conquerors[conquerorName];

        stats.count++;
        const battleTime = Number(run.conqueror_time ?? 0);
        stats.totalTime += battleTime;
        stats.fastest = Number(Math.min(stats.fastest, battleTime));
        stats.deaths += Number(run.conqueror_deaths ?? 0);
      }
    }

    if (
      run.parsedRunInfo?.mastermindBattle &&
      run.parsedRunInfo.mastermindBattle.battle2start &&
      run.parsedRunInfo.mastermindBattle.completed
    ) {
      const boss = 'Catarina, Master of Undeath';
      detectedBosses.push(boss);
      const stats = this.stats.bosses.mastermind;

      stats.count++;
      const battleTime = this.getRunningTime(
        run.parsedRunInfo.mastermindBattle.battle2start,
        run.parsedRunInfo.mastermindBattle.completed
      );
      stats.totalTime += battleTime;
      stats.fastest = Number(Math.min(stats.fastest, battleTime));
      stats.deaths += Number(run.mastermind_deaths ?? 0);
    }

    if (
      run.parsedRunInfo?.sirusBattle &&
      run.parsedRunInfo.sirusBattle.start &&
      run.parsedRunInfo.sirusBattle.completed
    ) {
      const boss = 'Sirus, Awakener of Worlds';
      detectedBosses.push(boss);
      const stats = this.stats.bosses.sirus;

      stats.count++;
      const battleTime = this.getRunningTime(
        run.parsedRunInfo.sirusBattle.start,
        run.parsedRunInfo.sirusBattle.completed
      );
      stats.totalTime += battleTime;
      stats.fastest = Number(Math.min(stats.fastest, battleTime));
      stats.deaths += Number(run.sirus_deaths ?? 0);
    }

    if (
      run.parsedRunInfo?.shaperBattle &&
      run.parsedRunInfo.shaperBattle.phase1start &&
      run.parsedRunInfo.shaperBattle.completed
    ) {
      const boss = 'The Shaper';
      detectedBosses.push(boss);
      const stats = this.stats.bosses.shaper;

      stats.count++;
      const battleTime = this.getRunningTime(
        run.parsedRunInfo.shaperBattle.phase1start,
        run.parsedRunInfo.shaperBattle.completed
      );
      stats.totalTime += battleTime;
      stats.fastest = Number(Math.min(stats.fastest, battleTime));
      stats.deaths += Number(run.shaper_deaths ?? 0);
    }

    if (
      run.parsedRunInfo?.maven &&
      run.parsedRunInfo.maven.firstLine &&
      run.parsedRunInfo.maven.mavenDefeated
    ) {
      const boss = 'The Maven';
      detectedBosses.push(boss);
      const stats = this.stats.bosses.maven;

      stats.count++;
      const battleTime = this.getRunningTime(
        run.parsedRunInfo.maven.firstLine,
        run.parsedRunInfo.maven.mavenDefeated
      );
      stats.totalTime += battleTime;
      stats.fastest = Number(Math.min(stats.fastest, battleTime));
      stats.deaths += Number(run.maven_deaths ?? 0);
    }

    if (
      run.parsedRunInfo?.oshabiBattle &&
      run.parsedRunInfo.oshabiBattle.start &&
      run.parsedRunInfo.oshabiBattle.completed
    ) {
      const boss = 'Oshabi, Avatar of the Grove';
      detectedBosses.push(boss);
      const stats = this.stats.bosses.oshabi;

      stats.count++;
      const battleTime = this.getRunningTime(
        run.parsedRunInfo.oshabiBattle.start,
        run.parsedRunInfo.oshabiBattle.completed
      );
      stats.totalTime += battleTime;
      stats.fastest = Number(Math.min(stats.fastest, battleTime));
      stats.deaths += Number(run.oshabi_deaths ?? 0);
    }

    if (
      run.parsedRunInfo?.venariusBattle &&
      run.parsedRunInfo.venariusBattle.start &&
      run.parsedRunInfo.venariusBattle.completed
    ) {
      const boss = 'Venarius, the Eternal';
      detectedBosses.push(boss);
      const stats = this.stats.bosses.venarius;

      stats.count++;
      const battleTime = this.getRunningTime(
        run.parsedRunInfo.venariusBattle.start,
        run.parsedRunInfo.venariusBattle.completed
      );
      stats.totalTime += battleTime;
      stats.fastest = Number(Math.min(stats.fastest, battleTime));
      stats.deaths += Number(run.venarius_deaths ?? 0);
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
    logger.info('getRunningTime', firstevent, lastevent, format);
    const duration = dayjs.duration(
      dayjs(lastevent, 'YYYYMMDDHHmmss').diff(dayjs(firstevent, 'YYYYMMDDHHmmss'))
    );
    return duration.as(format);
  }
}

export default {
  getAllStats: async ({ league, characterName }: GetStatsParams) => {
    const runs = (await DB.getAllRuns(league))?.map(formatRun);
    const items = await DB.getAllItems(league);
    const divinePrice = await RatesManager.getCurrencyValue(
      league,
      dayjs().format('YYYYMMDD'),
      'Divine Orb'
    );
    const manager = new StatsManager({ runs, items, divinePrice });

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
};
