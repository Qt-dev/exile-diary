import GGGAPI from '../GGGAPI';
import DB from '../db/run';
import dayjs from 'dayjs';
import RendererLogger from '../RendererLogger';
import SettingsManager from '../SettingsManager';
import OldDB from '../db';
import { globalShortcut } from 'electron';
const logger = require('electron-log');
const Utils = require('./Utils').default;
const EventEmitter = require('events');
const ItemPricer = require('./ItemPricer');
const XPTracker = require('./XPTracker');
const Constants = require('../../helpers/constants').default;
const ParseShortcut = 'CommandOrControl+F10';

type ParsedEvent = {
  timestamp: number;
  area: string;
  server: string;
};

type Event = {
  event_type: string;
  event_text: string;
  server: string;
  id: number;
};

type AreaInfo = {
  id: number;
  name: string;
  level?: number;
  depth?: number;
};

type ItemStats = {
  count: number;
  value: number;
  importantDrops: any;
};

type Item = {
  rawdata: string;
  category: string;
  typeline: string;
  id: number;
  event_id: number;
};

type MapData = [
  number,
  number,
  number,
  number | null,
  number | null,
  number | null,
  number,
  number | null,
  string
];

const RunParser = {
  latestGeneratedArea: {
    id: 0,
    name: '',
  } as AreaInfo,
  emitter: new EventEmitter(),

  setLatestGeneratedArea: (area: AreaInfo) => {
    RunParser.latestGeneratedArea = area;
  },

  setLatestGeneratedAreaLevel: (level: number) => {
    RunParser.latestGeneratedArea.level = level;
  },

  getAreaInfo: async (
    firstEvent: ParsedEvent,
    lastEvent: ParsedEvent
  ): Promise<AreaInfo | undefined> => {
    return OldDB.get(
      'SELECT * FROM areainfo WHERE id > ? AND id < ? AND name = ? ORDER BY id DESC',
      [firstEvent.timestamp, lastEvent.timestamp, firstEvent.area]
    )
      .then((row) => {
        if (!row) {
          logger.debug(
            `No area info found between ${firstEvent.timestamp} and ${lastEvent.timestamp}`
          );
          return null;
        }
        return row;
      })
      .catch((err) => {
        logger.error(`Unable to get area info: ${err}`);
        return null;
      });
  },

  getMapMods: async (id: number): Promise<string[]> => {
    return OldDB.all('select mod from mapmods where area_id = ? order by cast(id as integer)', [id])
      .then((rows) => {
        var mods = rows.map((row) => row.mod);
        return mods;
      })
      .catch((err) => {
        logger.error(`Unable to get last map mods: ${err}`);
        return [];
      });
  },

  getMapStats: (mods: string[] | null): { iir: number; iiq: number; packsize: number } => {
    const mapStats = {
      iir: 0,
      iiq: 0,
      packsize: 0,
    };

    mods &&
      mods.forEach((mod) => {
        if (mod.endsWith('% increased Rarity of Items found in this Area')) {
          mapStats['iir'] = parseInt(mod.match(/[0-9]+/)?.[0] ?? '0');
        } else if (mod.endsWith('% increased Quantity of Items found in this Area')) {
          mapStats['iiq'] = parseInt(mod.match(/[0-9]+/)?.[0] ?? '0');
        } else if (mod.endsWith('% increased Pack size')) {
          mapStats['packsize'] = parseInt(mod.match(/[0-9]+/)?.[0] ?? '0');
        }
      });
    return mapStats;
  },

  getXP: async (
    firstEventTimestamp: number,
    lastEventTimestamp: number
  ): Promise<number | null> => {
    return OldDB.get(
      'SELECT timestamp, xp FROM xp WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp DESC LIMIT 1 ',
      [firstEventTimestamp, lastEventTimestamp]
    )
      .then((row) => {
        logger.debug(`Got XP from DB: ${row.xp} at ${row.timestamp}`);
        return row.xp;
      })
      .catch(async (err) => {
        logger.error(
          `Failed to get XP between ${firstEventTimestamp} and ${lastEventTimestamp} from local DB, retrieving from API`
        );
        const { experience } = await GGGAPI.getDataForInventory();
        return experience;
      })
      .catch((err) => {
        logger.error(`Failed to get XP from API: ${err}`);
        return null;
      });
  },

  getXPDiff: async (currentXP: number | null): Promise<number | null> => {
    if (currentXP === null) return null;
    let xp: number | null = null;
    try {
      await OldDB.get(' select xp from mapruns order by id desc limit 1 ').then((row) => {
        if (!row.xp) {
          // first map recorded - xp diff can't be determined in this case, return current XP
          xp = currentXP;
        } else {
          xp = currentXP - row.xp;
        }
      });
    } catch (err) {
      logger.info(`Error getting XP diff: ${err}`);
    }
    return xp;
  },

  updateItemValues: (arr): Promise<void> => {
    return OldDB.transaction(`update items set value = ? where id = ? and event_id = ?`, arr).catch(
      (err) => {
        logger.warn(`Error inserting items: ${err}`);
      }
    );
  },

  parseItems: async (
    items: Item[]
  ): Promise<{ count: number; value: number; importantDrops: any }> => {
    logger.debug('Parsing items', items);
    let count = 0;
    let totalValue = 0;
    const importantDrops = {};
    const formattedItems: [number, number, number][] = [];
    for (let item of items) {
      const jsonData = JSON.parse(item.rawdata);
      if (jsonData.inventoryId === 'MainInventory') {
        count++;
        if (item.category === 'Metamorph Sample') {
          const organ = item.typeline.slice(item.typeline.lastIndexOf(' ') + 1).toLowerCase();
          importantDrops[organ] = (importantDrops[organ] || 0) + 1;
        } else if (item.typeline.endsWith("'s Exalted Orb") || item.typeline === "Awakener's Orb") {
          importantDrops[item.typeline] = (importantDrops[item.typeline] || 0) + 1;
        }

        let price = await ItemPricer.price(item);
        logger.debug('Found price: ', price);
        if (price.isVendor) {
          totalValue += price.value;
          price = 0;
        } else {
          totalValue += price.value;
        }
        formattedItems.push([price.value ?? 0, item.id, item.event_id]);
      }
    }

    if (formattedItems.length > 0) {
      RunParser.updateItemValues(formattedItems);
    }

    return { count, value: totalValue, importantDrops };
  },

  generateItemStats: async (
    areaID: string,
    firstEventTimestamp: number,
    lastEventTimestamp: number
  ) => {
    logger.debug(
      `Getting item values for ${areaID} between ${firstEventTimestamp} and ${lastEventTimestamp}`
    );
    const query = `
      SELECT event_text, items.*
      FROM events LEFT JOIN items ON items.event_id = events.id
      WHERE
        event_type = 'entered'
        AND
          (
            event_id BETWEEN ? AND ?
            OR events.id BETWEEN ? AND ?
          )
    `;
    type Zone = { event_text: string; id: number };
    try {
      const rows = await OldDB.all(query, [
        firstEventTimestamp,
        lastEventTimestamp,
        firstEventTimestamp,
        lastEventTimestamp,
      ]);
      let itemsCount = 0;
      let totalProfit = 0;
      let importantDrops = {};

      const zones: Zone[] = rows
        .map((row) => ({ event_text: row.event_text, id: row.event_id }))
        .filter((zone, index, self) => self.findIndex((t) => t.id === zone.id) === index);

      logger.debug(`Got ${zones.length} zones`);

      for (let zone of zones) {
        const index = zones.findIndex((z) => z.id === zone.id);
        logger.debug('Zone: ', zone, index, zones);
        const lastZone: any = zones[index - 1];
        if (!lastZone) {
          logger.debug('No last zone', lastZone, zone, index);
          continue;
        }
        if (!Utils.isTown(lastZone.event_text)) {
          // We are in a town but were not in the previous step
          logger.debug(`Getting items picked up in ${lastZone.id} ${lastZone.event_text}`);
          const items = rows.filter((row) => row.event_id === zone.id);
          logger.debug(items.length, rows.length);
          const itemsData = await RunParser.parseItems(items);
          itemsCount += itemsData.count;
          totalProfit += itemsData.value;
          if (itemsData.importantDrops) {
            for (let m in itemsData.importantDrops) {
              importantDrops[m] = (importantDrops[m] || 0) + itemsData.importantDrops[m];
            }
          }
        } else {
          logger.debug(
            `Ignoring items picked up in town area ${lastZone.id} ${lastZone.event_text}`
          );
        }
      }

      totalProfit = parseFloat(Number(totalProfit).toFixed(2));
      return { count: itemsCount, value: totalProfit, importantDrops };
    } catch (err) {
      logger.info(`Unable to get item values for ${areaID}: ${err}`);
      return false;
    }
  },

  getLastInventoryTimestamp: async (): Promise<number | null> => {
    return OldDB.get('SELECT timestamp FROM lastinv')
      .then((row) => {
        if (!row) {
          logger.info('No last inventory yet');
          return null;
        } else {
          return row.timestamp;
        }
      })
      .catch((err) => {
        logger.info(`Error getting timestamp for last inventory: ${err}`);
        return null;
      });
  },

  getItemStats: async (
    area: { id: number; name: string },
    firsteventTimestamp: number,
    lasteventTimestamp: number
  ): Promise<ItemStats | false> => {
    let lastInventoyTimestamp: number;
    let timestampCheckCount = 0;

    // Make sure the last inventory has been processed, wait 3s at a time until we're good
    // Fails after 3 attempts
    while (timestampCheckCount < 3) {
      timestampCheckCount++;
      logger.debug('Getting latest inventory timestamp');
      lastInventoyTimestamp = (await RunParser.getLastInventoryTimestamp()) ?? 0;
      logger.debug('Found ' + lastInventoyTimestamp);
      if (lastInventoyTimestamp >= lasteventTimestamp) {
        break;
      } else {
        if (timestampCheckCount >= 3) {
          logger.error('Unable to get the latest inventory from the DB, timestamp is too new');
          return false;
        } else {
          logger.error(
            `Last inventory not yet processed (${lastInventoyTimestamp} < ${lasteventTimestamp}), waiting 3 seconds`
          );
          await Utils.sleep(3000);
        }
      }
    }

    logger.debug(`Getting chaos value of items from ${area.id} ${area.name}`);
    try {
      const itemStats = (await RunParser.generateItemStats(
        `${area.id}`,
        firsteventTimestamp,
        lasteventTimestamp
      )) as ItemStats;
      if (itemStats) logger.debug(`Total profit is ${itemStats.value} in ${itemStats.count} items`);
      return itemStats;
    } catch (err) {
      logger.error(`Unable to get item values for ${area.id} ${area.name}: ${err}`);
      return false;
    }
  },

  getKillCount: async (firsteventTimestamp: number, lasteventTimestamp: number) => {
    logger.debug(`Getting Kill count between ${firsteventTimestamp} and ${lasteventTimestamp}`);
    let totalKillCount = 0;
    return OldDB.all(
      `
          SELECT * FROM incubators 
          WHERE incubators.timestamp BETWEEN ? AND ?
          ORDER BY timestamp
        `,
      [firsteventTimestamp, lasteventTimestamp]
    )
      .then((rows) => {
        if (rows.length > 1) {
          rows.forEach((row, index) => {
            if (index === 0) return;
            const incubator = JSON.parse(row.data);
            const previousIncubator = JSON.parse(rows[index - 1].data);
            let killCount = 0;
            Object.keys(previousIncubator).forEach((key) => {
              if (
                incubator[key] &&
                incubator[key].progress - previousIncubator[key].progress > killCount
              ) {
                killCount = incubator[key].progress - previousIncubator[key].progress;
              }
            });
            totalKillCount += killCount;
          });
        }
        logger.info(`Total kill count is ${totalKillCount}`);
        return totalKillCount > 0 ? totalKillCount : -1;
      })
      .catch((err) => {
        logger.info(`Failed to get kill count: ${err}`);
        return -1;
      });
  },

  getEvents: async (firstEventTimestamp: number, lasteventTimestamp: number) => {
    return OldDB.all('SELECT * FROM events WHERE id BETWEEN ? AND ? ORDER BY id', [
      firstEventTimestamp,
      lasteventTimestamp,
    ]).catch((err) => {
      logger.error(`Unable to get events: ${err}`);
      return [];
    });
  },

  countDeaths: (events: Event[], start: number, end: number) => {
    return events.filter(
      (event) => event.event_type === 'slain' && event.id > start && event.id < end
    ).length;
  },

  getZanaMissionMap: (events: Event[]) => {
    let start = events[0];
    let missionMap: string | null = null;
    const firstEnteredEvent = events
      .filter((event) => event.event_type === 'entered')
      .find((event) => {
        return (
          (event.event_text !== start.event_text || event.server !== start.server) &&
          (Constants.areas.normalMaps.includes(event.event_text) ||
            Constants.areas.uniqueMaps.includes(event.event_text))
        );
      });

    if (firstEnteredEvent) {
      missionMap = firstEnteredEvent.event_text;
    }

    return missionMap;
  },

  getRunAreaTimes: (
    events: { event_type: string; event_text: string; id: number }[]
  ): { [key: string]: number } => {
    const times = {};

    events
      .filter((event) => event.event_type === 'entered')
      .forEach((event, index, array) => {
        const nextEvent = array[index + 1];
        if (nextEvent) {
          const area = event.event_text;
          const runningTime = Utils.getRunningTime(event.id, nextEvent.id, 's', {
            useGrouping: false,
          });
          times[area] = (times[area] || 0) + Number(runningTime);
        }
      });

    return times;
  },

  getMaster: (previousEvent: Event, nextEvent: Event) => {
    if (previousEvent.event_type === 'master') {
      const master = Constants.masters.find((master) =>
        previousEvent.event_text.startsWith(master)
      );
      if (master) return master;
    }
    if (nextEvent.event_type === 'master') {
      const master = Constants.masters.find((master) => nextEvent.event_text.startsWith(master));
      if (master) return master;
    }

    // if no completion quote found, must be a zana mission
    return 'Zana, Master Cartographer';
  },

  getNPCLine: (eventText: string): { npc: string; text: string } | null => {
    if (!eventText || eventText.indexOf(':') < 0) {
      return null;
    }
    return {
      npc: eventText.slice(0, eventText.indexOf(':')).trim(),
      text: eventText.slice(eventText.indexOf(':') + 1).trim(),
    };
  },

  getMapExtraInfo: async (
    areaName: string,
    firsteventTimestamp: number,
    lasteventTimestamp: number,
    items: ItemStats,
    areaMods: string[]
  ) => {
    logger.info(
      `Getting map extra info for ${areaName} between ${firsteventTimestamp} and ${lasteventTimestamp}`
    );

    let events = await RunParser.getEvents(firsteventTimestamp, lasteventTimestamp);

    let run: any = {};
    let lastEnteredArea = '';
    let blightCount = 0;

    if (Constants.atlasRegions[areaName]) {
      run.atlasRegion = Constants.atlasRegions[areaName];
    }

    run.areaTimes = RunParser.getRunAreaTimes(events);

    for (let i = 0; i < events.length; i++) {
      let evt = events[i];
      let line: { npc: string; text: string } | null;

      switch (evt.event_type) {
        case 'entered':
          let area = evt.event_text;
          lastEnteredArea = area;
          if (area === 'Abyssal Depths') {
            run.abyssalDepths = true;
          } else if (Constants.areas.vaalSideAreas.includes(area)) {
            run.vaalSideAreas = true;
          }
          continue;
        case 'slain':
          run.deaths = ++run.deaths || 1;
          continue;
        case 'abnormalDisconnect':
          run.abnormalDisconnect = ++run.abnormalDisconnect || 1;
          continue;
        // Retired, there is no favour anymore
        // case 'favourGained':
        //   // no need for null checking adjacent events, map runs must always start and end with an "entered" event
        //   let master = RunParser.getMaster(events[i - 1], events[i + 1]);
        //   run.masters = run.masters || {};
        //   run.masters[master] = run.masters[master] || { encountered: true };
        //   run.masters[master].favourGained =
        //     (run.masters[master].favourGained || 0) + Number(evt.event_text);
        //   continue;
        case 'shrine':
          if (Constants.darkshrineQuotes[evt.event_text]) {
            run.labyrinth = run.labyrinth || {};
            run.labyrinth.darkshrines = run.labyrinth.darkshrines || [];
            run.labyrinth.darkshrines.push(evt.event_text);
          } else {
            run.shrines = run.shrines || [];
            run.shrines.push(Constants.shrineQuotes[evt.event_text]);
          }
          continue;
        case 'mapBoss':
          line = RunParser.getNPCLine(evt.event_text);
          // use lastEnteredArea instead of areaName to handle Zana map missions
          if (
            line &&
            Constants.mapBossBattleStartQuotes[lastEnteredArea] &&
            Constants.mapBossBattleStartQuotes[lastEnteredArea].includes(line.text)
          ) {
            run.mapBoss = run.mapBoss || {};
            run.mapBoss[lastEnteredArea] = run.mapBoss[lastEnteredArea] || {};
            // only take the earliest possible battle start
            if (!run.mapBoss[lastEnteredArea].battleStart) {
              run.mapBoss[lastEnteredArea].battleStart = evt.id;
            }
          }
          if (
            line &&
            Constants.mapBossKilledQuotes[lastEnteredArea] &&
            Constants.mapBossKilledQuotes[lastEnteredArea].includes(line.text)
          ) {
            run.mapBoss = run.mapBoss || {};
            run.mapBoss[lastEnteredArea] = run.mapBoss[lastEnteredArea] || {};
            // cold river map has two bosses that both emit death lines - take the latest
            run.mapBoss[lastEnteredArea].bossKilled = evt.id;
          }
          continue;
        case 'master':
        case 'conqueror':
        case 'leagueNPC':
          line = RunParser.getNPCLine(evt.event_text);
          break;
        default:
          // ignore other event types
          continue;
      }

      if (line === null) continue;
      switch (line.npc) {
        case 'The Envoy':
          run.envoy = run.envoy || { words: 0 };
          run.envoy.words += line.text.split(' ').length;
          continue;
        case 'The Maven':
          if (!run.maven) {
            run.maven = { firstLine: evt.id };
          } else {
            let eventType = Constants.mavenQuotes[line.text];
            if (eventType) {
              run.maven[eventType] = evt.id;
            }
          }
          continue;
        case 'Sister Cassia':
          if (Constants.blightBranchQuotes.includes(line.text)) {
            blightCount++;
          }
          continue;
        case 'Strange Voice':
          if (Constants.areas.delirium.includes(areaName)) {
            if (Constants.simulacrumWaveQuotes[line.text]) {
              run.simulacrumProgress = run.simulacrumProgress || {};
              run.simulacrumProgress[Constants.simulacrumWaveQuotes[line.text]] = evt.id;
            }
          } else {
            run.strangeVoiceEncountered = true;
          }
          continue;
        case 'The Shaper':
          if (areaName === "The Shaper's Realm" && Constants.shaperBattleQuotes[line.text]) {
            run.shaperBattle = run.shaperBattle || {};
            run.shaperBattle[Constants.shaperBattleQuotes[line.text]] = evt.id;
          } else if (
            Constants.mapBossKilledQuotes[lastEnteredArea] &&
            Constants.mapBossKilledQuotes[lastEnteredArea].includes(line.text)
          ) {
            // "This is the key to a crucible that stretches the sanity of the mind"
            run.mapBoss = run.mapBoss || {};
            run.mapBoss[lastEnteredArea] = run.mapBoss[lastEnteredArea] || {};
            run.mapBoss[lastEnteredArea].bossKilled = evt.id;
          }
          continue;
        case 'Catarina, Master of Undeath':
          if (areaName === "Mastermind's Lair" && Constants.mastermindBattleQuotes[line.text]) {
            run.mastermindBattle = run.mastermindBattle || {};
            run.mastermindBattle[Constants.mastermindBattleQuotes[line.text]] = evt.id;
          }
          continue;
        case 'Izaro':
          if (Constants.labyrinthQuotes[line.text]) {
            run.labyrinth = run.labyrinth || {};
            run.labyrinth[Constants.labyrinthQuotes[line.text]] = evt.id;
          }
          continue;
        case 'Einhar, Beastmaster':
          if (areaName === 'The Menagerie') {
            if (Constants.beastRecipeQuotes.includes(line.text)) {
              run.beastRecipes = ++run.beastRecipes || 1;
            }
          } else {
            run.masters = run.masters || {};
            run.masters[line.npc] = run.masters[line.npc] || { encountered: true };
            if (Constants.beastCaptureQuotes[line.text]) {
              run.masters[line.npc].beasts = ++run.masters[line.npc].beasts || 1;
              switch (Constants.beastCaptureQuotes[line.text]) {
                case 'yellow':
                  run.masters[line.npc].yellowBeasts = ++run.masters[line.npc].yellowBeasts || 1;
                  break;
                case 'red':
                  run.masters[line.npc].redBeasts = ++run.masters[line.npc].redBeasts || 1;
                  break;
                default:
                  // no difference between yellow and red in Einhar's "mission complete" quote;
                  // this means that the last beast in an area can't be identified
                  break;
              }
            }
          }
          continue;
        case 'Alva, Master Explorer':
          run.masters = run.masters || {};
          run.masters[line.npc] = run.masters[line.npc] || {};
          if (areaName === 'The Temple of Atzoatl') {
            if (Constants.templeRoomQuotes[line.text]) {
              run.masters[line.npc].tier3Rooms = run.masters[line.npc].tier3Rooms || [];
              run.masters[line.npc].tier3Rooms.push(Constants.templeRoomQuotes[line.text]);
            }
          } else {
            run.masters[line.npc].encountered = true;
            if (line.text.includes('Good job')) {
              run.masters[line.npc].incursions = ++run.masters[line.npc].incursions || 1;
            }
          }
          continue;
        case 'Niko, Master of the Depths':
          run.masters = run.masters || {};
          run.masters[line.npc] = run.masters[line.npc] || { encountered: true };
          run.masters[line.npc].sulphite = ++run.masters[line.npc].sulphite || 1;
          continue;
        case 'Zana, Master Cartographer':
          if (areaName === 'Absence of Value and Meaning') {
            if (Constants.elderDefeatedQuotes.includes(line.text)) {
              run.elderDefeated = true;
            }
          } else {
            if (areaName !== "The Shaper's Realm" && areaName !== 'Eye of the Storm') {
              run.masters = run.masters || {};
              run.masters[line.npc] = run.masters[line.npc] || { encountered: true };
              let missionMap = RunParser.getZanaMissionMap(events);
              if (missionMap) {
                run.masters[line.npc].missionMap = missionMap;
              }
            }
          }
          continue;
        case 'Jun, Veiled Master':
          if (areaName !== 'Syndicate Hideout' && areaName !== "Mastermind's Lair") {
            run.masters = run.masters || {};
            run.masters[line.npc] = run.masters[line.npc] || { encountered: true };
          }
          if (line.text.includes('[')) {
            let subLine = RunParser.getNPCLine(line.text.slice(1, line.text.length - 1));
            if (!subLine) continue;
            run.syndicate = run.syndicate || {};
            run.syndicate[subLine.npc] = run.syndicate[subLine.npc] || { encountered: true };
            let quote = Constants.syndicateMemberQuotes[subLine.npc];
            if (quote.defeated.includes(subLine.text)) {
              run.syndicate[subLine.npc].defeated = ++run.syndicate[subLine.npc].defeated || 1;
            } else if (quote.killPlayer.includes(subLine.text)) {
              run.syndicate[subLine.npc].killedPlayer =
                ++run.syndicate[subLine.npc].killedPlayer || 1;
            } else if (quote.safehouseLeaderDefeated === subLine.text) {
              run.syndicate[subLine.npc].safehouseLeaderDefeated = true;
            }
          } else {
            let member = Constants.syndicateMemberQuotes.jun[line.text];
            if (member) {
              run.syndicate = run.syndicate || {};
              run.syndicate[member] = run.syndicate[member] || { encountered: true };
              run.syndicate[member].defeated = ++run.syndicate[member].defeated || 1;
            }
          }
          continue;
        case 'Al-Hezmin, the Hunter':
        case 'Baran, the Crusader':
        case 'Drox, the Warlord':
        case 'Veritania, the Redeemer':
          run.conqueror = run.conqueror || {};
          run.conqueror[line.npc] = run.conqueror[line.npc] || {};
          let battleQuotes = Constants.conquerorBattleStartQuotes[line.npc];
          for (let j = 0; j < battleQuotes.length; j++) {
            if (line.text.includes(battleQuotes[j])) {
              run.conqueror[line.npc].battle = true;
            }
          }
          if (run.conqueror[line.npc].battle) {
            let deathQuotes = Constants.conquerorDeathQuotes[line.npc];
            for (let j = 0; j < deathQuotes.length; j++) {
              if (line.text.includes(deathQuotes[j])) {
                run.conqueror[line.npc].defeated = true;
              }
            }
          } else {
            run.conqueror[line.npc].encounter = true;
          }
          continue;
        case 'Sirus, Awakener of Worlds':
          run.sirusBattle = run.sirusBattle || {};
          if (Constants.sirusBattleQuotes[line.text]) {
            run.sirusBattle[Constants.sirusBattleQuotes[line.text]] = evt.id;
          } else if (line.text === 'Die.') {
            run.sirusBattle.dieBeamsFired = ++run.sirusBattle.dieBeamsFired || 1;
            if (events[i + 1] && events[i + 1].event_type === 'slain') {
              run.sirusBattle.dieBeamKills = ++run.sirusBattle.dieBeamKills || 1;
            }
          }
          continue;
        case 'Queen Hyrri Ngamaku':
        case 'General Marceus Lioneye':
        case 'Viper Napuatzi':
        case 'Cardinal Sanctus Vox':
        case 'Aukuna, the Black Sekhema':
          if (areaName !== 'Domain of Timeless Conflict') {
            run.legionGenerals = run.legionGenerals || {};
            run.legionGenerals[line.npc] = run.legionGenerals[line.npc] || { encountered: true };
            if (Constants.legionDeathQuotes[line.npc].includes(line.text)) {
              run.legionGenerals[line.npc].defeated = ++run.legionGenerals[line.npc].defeated || 1;
            }
          }
          continue;
        case 'Oshabi':
          if (Constants.oshabiBattleQuotes[line.text]) {
            run.oshabiBattle = run.oshabiBattle || {};
            // don't log duplicate events
            if (!run.oshabiBattle[Constants.oshabiBattleQuotes[line.text]]) {
              run.oshabiBattle[Constants.oshabiBattleQuotes[line.text]] = evt.id;
            }
          }
          continue;
        case 'Venarius':
          if (Constants.venariusBattleQuotes[line.text]) {
            run.venariusBattle = run.venariusBattle || {};
            // don't log duplicate events
            if (!run.venariusBattle[Constants.venariusBattleQuotes[line.text]]) {
              run.venariusBattle[Constants.venariusBattleQuotes[line.text]] = evt.id;
            }
          }
          continue;
        case 'The Trialmaster':
          // need an array because there can be multiple ultimatums in a map run (campaign areas, Zana missions)
          run.ultimatum = run.ultimatum || [];
          if (Constants.ultimatumQuotes.start.includes(line.text)) {
            run.ultimatum.push({ start: evt.id });
          } else {
            let currUlt = run.ultimatum[run.ultimatum.length - 1];
            if (!currUlt) {
              // ????
              logger.info(`Ultimatum event without start event: [${evt.id} ${line.text}]`);
              continue;
            }
            if (Constants.ultimatumQuotes.lost.includes(line.text)) {
              currUlt.lost = evt.id;
            } else if (Constants.ultimatumQuotes.tookReward.includes(line.text)) {
              currUlt.tookReward = evt.id;
            } else if (Constants.ultimatumQuotes.won.includes(line.text)) {
              currUlt.won = evt.id;
            } else if (Constants.ultimatumQuotes.trialmasterDefeated.includes(line.text)) {
              currUlt.trialmasterDefeated = evt.id;
            } else if (Constants.ultimatumQuotes.mods[line.text]) {
              currUlt.rounds = currUlt.rounds || {};
              currUlt.rounds[evt.id] = Constants.ultimatumQuotes.mods[line.text];
              if (currUlt.rounds[evt.id].includes('/') && currUlt.rounds[evt.id].includes('Ruin')) {
                currUlt.isAmbiguous = true;
              }
            }
          }
          continue;
      }
    }

    if (run.ultimatum) {
      // TODO: Update this with new Ultimatum patterns
      // We are jumping through these convoluted hoops because GGG couldn't give a unique quote to each type of mod >:\
      // Ailment and Curse Reflection is completely indistinguishable from Hindering Flasks, but for the ones below we can at least try
      for (let ultimatum of run.ultimatum) {
        if (!ultimatum.isAmbiguous) continue;

        delete ultimatum.isAmbiguous;

        let keys = Object.keys(ultimatum.rounds);
        let ruin = false,
          ruin2 = false,
          ruin3 = false,
          sruin = false,
          sruin2 = false,
          sruin3 = false;

        for (let i = 0; i < keys.length; i++) {
          let mod = ultimatum.rounds[keys[i]];
          switch (mod) {
            case 'Ruin II':
              ruin2 = true;
              break;
            case 'Ruin III':
              ruin3 = true;
              break;
            case 'Stalking Ruin':
              sruin = true;
              break;
            case 'Ruin / Stalking Ruin III':
              if (i === 0 || !sruin2 || sruin3) {
                ultimatum.rounds[keys[i]] = 'Ruin';
                ruin = true;
              } else if (ruin) {
                ultimatum.rounds[keys[i]] = 'Stalking Ruin III';
                sruin3 = true;
              }
              break;
            case 'Ruin II / Stalking Ruin II':
              if (sruin2 || (ruin && !sruin)) {
                ultimatum.rounds[keys[i]] = 'Ruin II';
                ruin2 = true;
              } else if (ruin2 || (sruin && !ruin)) {
                ultimatum.rounds[keys[i]] = 'Stalking Ruin II';
                sruin2 = true;
              }
              break;
          }
        }

        // make a second pass if needed
        if (
          Object.values(ultimatum.rounds).includes('Ruin / Stalking Ruin III') ||
          Object.values(ultimatum.rounds).includes('Ruin II / Stalking Ruin II')
        ) {
          for (let i = 0; i < keys.length; i++) {
            let mod = ultimatum.rounds[keys[i]];
            switch (mod) {
              case 'Ruin / Stalking Ruin III':
                if (sruin3 || (ruin2 && !ruin)) {
                  ultimatum.rounds[keys[i]] = 'Ruin';
                  ruin = true;
                } else if (!sruin3) {
                  // if only sruin and sruin2 are true, this case is STILL ambiguous, but fuck it let's just assume this
                  ultimatum.rounds[keys[i]] = 'Stalking Ruin III';
                  sruin3 = true;
                }
                break;
              case 'Ruin II / Stalking Ruin II':
                if (ruin && ruin3 && !ruin2) {
                  ultimatum.rounds[keys[i]] = 'Ruin II';
                  ruin2 = true;
                } else if (sruin && sruin3 && !sruin2) {
                  ultimatum.rounds[keys[i]] = 'Stalking Ruin II';
                  sruin2 = true;
                } else if (ruin && sruin && !ruin3 && !sruin3) {
                  // again, fuck it
                  ultimatum.rounds[keys[i]] = Math.random() > 0.5 ? 'Ruin II' : 'Stalking Ruin II';
                }
                break;
            }
          }
        }
      }
    }

    if (blightCount > 0) {
      // 3.13 update: Zana can give blighted mission maps
      if (blightCount > 8) {
        if (run.masters && run.masters['Zana, Master Cartographer']) {
          run.masters['Zana, Master Cartographer'].blightedMissionMap = true;
        } else {
          run.blightedMap = true;
        }
      } else {
        run.blightEncounter = true;
      }
    }

    let bossBattleStart;
    if (run.maven && run.maven.firstLine) {
      bossBattleStart = run.maven.firstLine;
    }
    // take the earliest possible boss battle start
    if (run.mapBoss && run.mapBoss[areaName] && run.mapBoss[areaName].battleStart) {
      bossBattleStart = Math.min(
        bossBattleStart || Number.MAX_SAFE_INTEGER,
        run.mapBoss[areaName].battleStart
      );
    }

    let bossBattleEnd: number | undefined;
    if (run.maven && run.maven.bossKilled) {
      bossBattleEnd = run.maven.bossKilled;
    }
    // take the latest possible boss kill time - to handle cold river multiboss
    if (run.mapBoss && run.mapBoss[areaName] && run.mapBoss[areaName].bossKilled) {
      bossBattleEnd = Math.max(bossBattleEnd || 0, run.mapBoss[areaName].bossKilled);
    }

    if (bossBattleStart && bossBattleEnd) {
      run.bossBattle = {};
      run.bossBattle.time = Utils.getRunningTime(bossBattleStart, bossBattleEnd, 's', {
        useGrouping: false,
      });
      let bossBattleDeaths = RunParser.countDeaths(events, bossBattleStart, bossBattleEnd);
      if (bossBattleDeaths) {
        run.bossBattle.deaths = bossBattleDeaths;
      }
    }

    // handle map boss stats in sub-areas
    if (run.mapBoss) {
      let areas = Object.keys(run.mapBoss);
      for (let i = 0; i < areas.length; i++) {
        let a = areas[i];
        if (a !== areaName && run.mapBoss[a].battleStart && run.mapBoss[a].bossKilled) {
          run.mapBoss[a].time = Utils.getRunningTime(
            run.mapBoss[a].battleStart,
            run.mapBoss[a].bossKilled,
            's',
            { useGrouping: false }
          );
          let deaths = RunParser.countDeaths(
            events,
            run.mapBoss[a].battleStart,
            run.mapBoss[a].bossKilled
          );
          if (deaths) {
            run.mapBoss[a].deaths = deaths;
          }
        }
      }
    }

    // minor manual fixing - if Einhar mission was completed in an area, and all beasts except for the last are yellow,
    // the last remaining one must be a red beast
    if (run.masters && run.masters['Einhar, Beastmaster']) {
      let einharData = run.masters['Einhar, Beastmaster'];
      if (einharData.favourGained && einharData.yellowBeasts === einharData.beasts - 1) {
        einharData.redBeasts = 1;
      }
    }

    if (areaMods) {
      let elderGuardian = Constants.elderGuardians.find((guardian) =>
        areaMods.some((mod) => mod.endsWith(guardian))
      );
      if (elderGuardian) {
        run.elderGuardian = elderGuardian;
      }
    }

    if (items && items.importantDrops) {
      for (var key in items.importantDrops) {
        switch (key) {
          case 'brain':
          case 'lung':
          case 'heart':
          case 'eye':
          case 'liver':
            run.metamorph = run.metamorph || {};
            run.metamorph[key] = (run.metamorph[key] || 0) + items.importantDrops[key];
            break;
          case "Hunter's Exalted Orb":
            if (
              run.conqueror &&
              run.conqueror['Al-Hezmin, the Hunter'] &&
              run.conqueror['Al-Hezmin, the Hunter'].defeated
            ) {
              run.conqueror['Al-Hezmin, the Hunter'].droppedOrb = true;
            }
            break;
          case "Warlord's Exalted Orb":
            if (
              run.conqueror &&
              run.conqueror['Drox, the Warlord'] &&
              run.conqueror['Drox, the Warlord'].defeated
            ) {
              run.conqueror['Drox, the Warlord'].droppedOrb = true;
            }
            break;
          case "Redeemer's Exalted Orb":
            if (
              run.conqueror &&
              run.conqueror['Veritania, the Redeemer'] &&
              run.conqueror['Veritania, the Redeemer'].defeated
            ) {
              run.conqueror['Veritania, the Redeemer'].droppedOrb = true;
            }
            break;
          case "Crusader's Exalted Orb":
            if (
              run.conqueror &&
              run.conqueror['Baran, the Crusader'] &&
              run.conqueror['Baran, the Crusader'].defeated
            ) {
              run.conqueror['Baran, the Crusader'].droppedOrb = true;
            }
            break;
          case "Awakener's Orb":
            if (run.sirusBattle && run.sirusBattle.completed) {
              run.sirusBattle.droppedOrb = true;
            }
            break;
        }
      }
    }

    return run;
  },

  addMapInfo: async (areaInfo: {
    mapFirstEvent: ParsedEvent;
    latestGeneratedArea: AreaInfo | null;
  }) => {
    const { mapFirstEvent, latestGeneratedArea } = areaInfo;
    return OldDB.run('INSERT OR REPLACE INTO areainfo(id, name, level, depth) values(?, ?, ?, ?)', [
      mapFirstEvent.timestamp,
      mapFirstEvent.area,
      latestGeneratedArea?.level ?? 0,
      latestGeneratedArea?.depth ?? 0,
    ]).catch((err) => {
      logger.info(
        `Error manually inserting areainfo (${mapFirstEvent.timestamp} ${mapFirstEvent.area}): ${err}`
      );
    });
  },

  insertMapRun: async (mapData: MapData): Promise<void> => {
    logger.debug('Inserting map run:', mapData);
    return OldDB.run(
      'INSERT OR REPLACE INTO mapruns(id, firstevent, lastevent, iiq, iir, packsize, xp, kills, runinfo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ',
      mapData
    )
      .then(() => {
        logger.debug(`Map run processed successfully: ${JSON.stringify(mapData)}`);
      })
      .catch((err) => {
        logger.error(`Unable to insert map run ${JSON.stringify(mapData)}: ${err}`);
      });
  },

  getLastMapEnterEvent: async () => {
    return OldDB.get(
      `
      SELECT * FROM events
      WHERE event_type='entered'
      AND events.id >= (SELECT MAX(lastevent) FROM mapruns)
      ORDER BY id ASC
      `
    )
      .then((row) => {
        if (!row) {
          logger.info('No last inserted event found!');
          return null;
        } else {
          return {
            timestamp: row.id,
            area: row.event_text,
            server: row.server,
          };
        }
      })
      .catch((err) => {
        logger.error(`Unable to get last event: ${err}`);
        return null;
      });
  },

  getLatestUnusedMapEnteredEvents: async (): Promise<ParsedEvent[]> => {
    const query = `
      SELECT id, event_text, server
      FROM 
        events
      WHERE 
        event_type='entered'
        AND id > (SELECT MAX(lastevent) FROM mapruns)
      ORDER BY id
    `;

    try {
      const rows = await OldDB.all(query);
      return rows.map((row) => {
        return {
          timestamp: row.id,
          area: row.event_text,
          server: row.server,
        };
      });
    } catch (err) {
      logger.error(`Unable to get latest unused map entering events: ${err}`);
      return [];
    }
  },

  processRun: async (mapFirstEvent: ParsedEvent, lastEvent: ParsedEvent) => {
    let mapStats = {
      iiq: 0,
      iir: 0,
      packsize: 0,
    };
    let mapMods: any[] = [];
    let areaInfo = await RunParser.getAreaInfo(mapFirstEvent, lastEvent);
    if (areaInfo) {
      mapMods = (await RunParser.getMapMods(areaInfo.id)) as any[];
      mapStats = RunParser.getMapStats(mapMods);
    } else {
      areaInfo = {
        id: mapFirstEvent.timestamp,
        name: mapFirstEvent.area,
      };
    }
    logger.debug('Map AreaInfo', areaInfo);

    const xp = XPTracker.isMaxXP()
      ? Constants.MAX_XP
      : await RunParser.getXP(mapFirstEvent.timestamp, lastEvent.timestamp);
    const xpDiff = await RunParser.getXPDiff(xp);
    const itemStats = await RunParser.getItemStats(
      areaInfo,
      mapFirstEvent.timestamp,
      lastEvent.timestamp
    );
    const items = itemStats ? itemStats : { count: 0, value: 0, importantDrops: {} };
    let killCount = await RunParser.getKillCount(mapFirstEvent.timestamp, lastEvent.timestamp);
    const extraInfo = await RunParser.getMapExtraInfo(
      areaInfo.name,
      mapFirstEvent.timestamp,
      lastEvent.timestamp,
      items,
      mapMods
    );

    let ignoreMapRun = false;

    RunParser.addMapInfo({ mapFirstEvent, latestGeneratedArea: RunParser.latestGeneratedArea });

    // if no items picked up, no kills, and no xp gained, log map run but ignore it (profit = -1, kills = -1)
    if (!items.count && !xpDiff && !killCount) {
      items.value = -1;
      killCount = -1;
      extraInfo.ignored = true;
      ignoreMapRun = true;
      logger.info('No items or xp gained, map run will be logged as invisible');
    }
    logger.debug(`Map stats: ${JSON.stringify(mapStats)}`);

    let runArr: MapData = [
      areaInfo.id,
      mapFirstEvent.timestamp,
      lastEvent.timestamp,
      mapStats.iiq || null,
      mapStats.iir || null,
      mapStats.packsize || null,
      xp,
      killCount > -1 ? killCount : null,
      JSON.stringify(extraInfo),
    ];
    RunParser.insertMapRun(runArr).then(() => {
      if (!ignoreMapRun) {
        RunParser.emitter.emit('runProcessed', {
          name: areaInfo.name,
          id: areaInfo.id,
          gained: items.value,
          xp: xpDiff,
          kills: killCount > -1 ? killCount : null,
          firstevent: mapFirstEvent.timestamp,
          lastevent: lastEvent.timestamp,
        });
      }
    });
  },

  tryProcess: async (parameters: { event: ParsedEvent } | null) => {
    let event: ParsedEvent;
    if (parameters && parameters.event) {
      event = parameters.event;
    } else {
      logger.debug('No event found, looking up in db');
      let lastEvent = await RunParser.getLastMapEnterEvent();
      logger.debug('Last event:', lastEvent);
      if (!lastEvent) return;
      event = lastEvent;
    }
    const mapEvents = await RunParser.getLatestUnusedMapEnteredEvents();
    if (mapEvents.length < 1) {
      logger.debug('No map enter events found');
      return;
    }

    const mapFirstEvent = mapEvents.find((event) => !Utils.isTown(event.area));
    if (!mapFirstEvent) {
      logger.debug('No map first map enter event found');
      return;
    }

    logger.debug('Map enter event found:\n', JSON.stringify(mapFirstEvent));
    logger.debug(`${event.area} -> ${mapFirstEvent.area}`);

    if (Utils.isLabArea(event.area) && Utils.isLabArea(mapFirstEvent.area)) {
      logger.debug('Still in lab, not processing');
      return;
    } else if (event.area === mapFirstEvent.area) {
      if (event.area === 'Azurite Mine') {
        logger.debug('Still in delve, not processing');
        return;
      } else if (event.area === 'Memory Void') {
        logger.debug('Still in memory, not processing');
        return;
      } else if (event.server === mapFirstEvent.server) {
        logger.debug(`Still in same area ${event.area}, not processing`);
        return;
      }
    }

    const lastEvent = mapEvents.reverse().find((event) => Utils.isTown(event.area));
    if (!lastEvent) return;

    logger.debug('Last town event found:\n', JSON.stringify(lastEvent));
    try {
      await RunParser.processRun(mapFirstEvent, lastEvent);
    } catch (e) {
      logger.error(`Error processing run: ${e}`);
      return;
    }

    return 1;
  },

  recheckGained: async (from = 0, to = parseInt(dayjs().format('YYYYMMDDHHmmss'))) => {
    RendererLogger.log({
      messages: [
        { text: 'Rechecking map profits from ' },
        { text: `${from}`, type: 'important' },
        { text: ' to ' },
        { text: `${to}`, type: 'important' },
        { text: '...' },
      ],
    });
    const startTime = dayjs();
    const runs = await DB.getRunsFromDates(from, to);
    for (const run of runs) {
      await ItemPricer.getRatesFor(run.id);
    }

    const checks = runs.map(async (run) => {
      const items = await DB.getItemsFromRun(run.id);
      let totalProfit = 0;
      let oldTotalProfit = 0;
      let itemsToUpdate: { value: number; id: number; eventId: number }[] = [];
      for (const item of items) {
        const { value } = await ItemPricer.price(
          { event_id: dayjs().format('YYYYMMDD'), ...item },
          SettingsManager.get('activeProfile').league,
          true
        );
        oldTotalProfit += item.value;
        totalProfit += value;
        if (value !== item.value) {
          itemsToUpdate.push({ value, id: item.id, eventId: item.event_id });
        }
      }
      if (itemsToUpdate.length > 0) {
        DB.updateItemValues(itemsToUpdate);
      }
      const profitDifference = totalProfit - oldTotalProfit;
      if (profitDifference !== 0) {
        logger.info(`Updating profit from ${run.gained} to ${totalProfit}`);
      } else {
        logger.info(`No profit difference for ${run.id}`);
      }
    });

    return Promise.all(checks).then(() => {
      const endTime = dayjs();
      const timeTaken = endTime.diff(startTime, 'millisecond');
      logger.info(`Recheck from ${from} to ${to} took ${timeTaken} ms`);
      RendererLogger.log({
        messages: [
          { text: 'Recheck complete - Checked map profits from ' },
          { text: `${from}`, type: 'important' },
          { text: ' to ' },
          { text: `${to}`, type: 'important' },
          { text: ' in ' },
          { text: `${timeTaken}`, type: 'important' },
          { text: 'ms.' },
        ],
      });
    });
  },

  ParseShortcut, // Exposed for testing

  registerRunParseShortcut: () => {
    globalShortcut.register(RunParser.ParseShortcut, () => {
      RunParser.tryProcess(null);
    });
  },

  unregisterRunParseShortcut: () => {
    globalShortcut.unregister(RunParser.ParseShortcut);
  },

  toggleRunParseShortcut: (state) => {
    if (state) {
      RunParser.registerRunParseShortcut();
    } else {
      RunParser.unregisterRunParseShortcut();
    }
  },
};

export default RunParser;
