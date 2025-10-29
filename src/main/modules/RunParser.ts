import GGGAPI from '../GGGAPI';
import DB from '../db/run';
import dayjs from 'dayjs';
import RendererLogger from '../RendererLogger';
import SettingsManager from '../SettingsManager';
import WorldAreas from '../../helpers/data/worldAreas.json';
import OldDB from '../db';
import { globalShortcut } from 'electron';
import Utils from './Utils';
import minMax from 'dayjs/plugin/minMax'; // ES 2015
import EventParser from './EventParser';
import LogProcessor from './LogProcessor';
const logger = require('electron-log');
const EventEmitter = require('events');
const ItemPricer = require('./ItemPricer');
const XPTracker = require('./XPTracker');
const Constants = require('../../helpers/constants').default;
 
dayjs.extend(minMax);

type ParsedEvent = {
  timestamp: string;
  area?: string;
  server?: string;
};

type Event = {
  event_type: string;
  event_text: string;
  server?: string;
  timestamp?: string;
};

type AreaInfo = {
  run_id: number;
  name: string;
  level: number;
  depth: number;
  seed?: number;
  iir?: number;
  pack_size?: number;
  iiq?: number;
};

type ItemStats = {
  count: number;
  value: number;
  importantDrops: any;
};

type Item = {
  raw_data: string;
  category: string;
  typeline: string;
  id: number;
  event_id: number;
};

type MapData = [
  string, // firstevent
  string, // lastevent
  number | null, // iiq
  number | null, // iir
  number | null, // packsize
  number, // xp
  number | null, // kills
  string, // run info
  boolean // completed
];

const RunParser = {
  latestGeneratedArea: {
    run_id: 0,
    level: 0,
    depth: 0,
    // seed: 0,
    name: '',
    iir: 0,
    pack_size: 0,
    iiq: 0,
  } as AreaInfo,
  emitter: new EventEmitter(),

  refreshTracking: async () => {
    logger.info('Refreshing RunParser tracking');
    const data = (await DB.getCurrentAreaData()) ?? {
      run_id: 0,
      level: 0,
      depth: 0,
      name: 'No Area',
      seed: 0,
      iir: 0,
      pack_size: 0,
      iiq: 0,
    };

    RunParser.setLatestGeneratedArea({
      run_id: data.run_id,
      level: data.level,
      depth: data.depth,
      name: data.name,
      iir: data.iir,
      pack_size: data.pack_size,
      iiq: data.iiq,
    });

    RunParser.emitter.emit('run-parser:latest-area-updated', RunParser.latestGeneratedArea);
  },

  setLatestGeneratedArea: (area: AreaInfo) => {
    RunParser.latestGeneratedArea = area;
  },

  setLatestGeneratedAreaData: (level: number, name: string, seed: number, runId: number) => {
    RunParser.latestGeneratedArea.level = level;
    RunParser.latestGeneratedArea.name = name;
    RunParser.latestGeneratedArea.seed = seed;
    RunParser.latestGeneratedArea.run_id = runId;
  },

  resetRunData: () => {
    RunParser.latestGeneratedArea = {
      run_id: 0,
      level: 0,
      depth: 0,
      name: '',
    };
  },

  getAreaInfo: async (areaId: number): Promise<AreaInfo | undefined> => {
    return OldDB.get('SELECT * FROM area_info WHERE run_id = ?', [areaId])
      .then((row) => {
        if (!row) {
          logger.debug(`No area info found for run_id ${areaId}`);
          return null;
        }
        return row;
      })
      .catch((err) => {
        logger.error(`Unable to get area info: ${err}`);
        return null;
      });
  },

  getMapMods: async (areaId: number): Promise<string[]> => {
    return OldDB.all('SELECT mod FROM mapmod WHERE run_id = ? ORDER BY id', [areaId])
      .then((rows) => {
        var mods = rows.map((row) => row.mod);
        return mods;
      })
      .catch((err) => {
        logger.error(`Unable to get last map mods: ${err}`);
        return [];
      });
  },

  getMapStats: (mods: string[] | null): { iir: number; iiq: number; pack_size: number } => {
    const mapStats = {
      iir: 0,
      iiq: 0,
      pack_size: 0,
    };

    mods &&
      mods.forEach((mod) => {
        if (mod.endsWith('% increased Rarity of Items found in this Area')) {
          mapStats['iir'] = parseInt(mod.match(/[0-9]+/)?.[0] ?? '0');
        } else if (mod.endsWith('% increased Quantity of Items found in this Area')) {
          mapStats['iiq'] = parseInt(mod.match(/[0-9]+/)?.[0] ?? '0');
        } else if (mod.endsWith('% increased Pack size')) {
          mapStats['pack_size'] = parseInt(mod.match(/[0-9]+/)?.[0] ?? '0');
        }
      });
    return mapStats;
  },

  getMapRun: async (
    runId: number
  ): Promise<{ first_event: string; last_event: string; completed: boolean }> => {
    const mapRun = await OldDB.get(
      'SELECT first_event, last_event, completed FROM run WHERE id = ?',
      [runId]
    );
    return mapRun;
  },

  getXP: async (runId: number, lastEventTimestamp?: string): Promise<number | null> => {
    let first_event: string | null = null;
    let completed: boolean = false;
    let shouldQueryAPI = false;
    let experience: number | null = null;
    try {
      ({ first_event, completed } = await RunParser.getMapRun(runId));
    } catch (error) {
      logger.error(`Failed to get map run for runId ${runId}: ${error}`);
    }

    try {
      if (!first_event) throw new Error('First event is null');
      const row = await OldDB.get(
        'SELECT timestamp, xp FROM xp WHERE DATETIME(timestamp) BETWEEN DATETIME(?) AND DATETIME(?) ORDER BY timestamp DESC LIMIT 1 ',
        [first_event, lastEventTimestamp]
      );
      logger.debug(`Got XP from DB: ${row.xp} at ${row.timestamp}`);
      experience = row.xp;
    } catch (err) {
      logger.error(
        `Failed to get XP between ${first_event} and ${lastEventTimestamp} from local DB, retrieving from API`
      );
      shouldQueryAPI = true;
    }

    if (shouldQueryAPI && !completed) {
      try {
        const { experience: GGGExperience } = await GGGAPI.getDataForInventory();
        experience = GGGExperience;
      } catch (err) {
        logger.error(`Failed to get XP from API: ${err}`);
      }
    }
    return experience;
  },

  getXPDiff: async (currentXP: number | null): Promise<number | null> => {
    if (currentXP === null) return null;
    let xp: number | null = null;
    try {
      await OldDB.get('SELECT xp FROM run ORDER BY id DESC LIMIT 1').then((row) => {
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
    return OldDB.transaction(`UPDATE item SET value = ? WHERE id = ? AND event_id = ?`, arr).catch(
      (err) => {
        logger.warn(`Error inserting items: ${err}`);
      }
    );
  },

  /**
   * Parses the items from a run and extracts relevant information.
   * @param items The items to parse.
   * @returns An object containing the count of items, total value, and important drops.
   */
  parseItems: async (
    items: Item[]
  ): Promise<{ count: number; value: number; importantDrops: any }> => {
    // logger.debug('Parsing items', items);
    let count = 0;
    let totalValue = 0;
    const importantDrops = {};
    const formattedItems: [number, number, number][] = [];
    for (let item of items) {
      if (!item.raw_data) continue;

      const jsonData = JSON.parse(item.raw_data);
      if (jsonData && jsonData.inventoryId === 'MainInventory') {
        count++;
        if (item.category === 'Metamorph Sample') {
          const organ = item.typeline.slice(item.typeline.lastIndexOf(' ') + 1).toLowerCase();
          importantDrops[organ] = (importantDrops[organ] || 0) + 1;
        } else if (item.typeline.endsWith("'s Exalted Orb") || item.typeline === "Awakener's Orb") {
          importantDrops[item.typeline] = (importantDrops[item.typeline] || 0) + 1;
        }

        let price = await ItemPricer.price(item);
        // logger.debug('Found price: ', price, item);
        if (price.isVendor) {
          totalValue += price.value;
          price = 0;
        } else {
          totalValue += price.value;
        }
        if (!price.value) {
          logger.debug(`Found an item with price: ${price.value}`, item);
        }
        formattedItems.push([price.value ?? 0, item.id, item.event_id]);
      }
    }

    if (formattedItems.length > 0) {
      logger.debug(formattedItems);
      RunParser.updateItemValues(formattedItems);
    }

    return { count, value: totalValue, importantDrops };
  },

  generateItemStats: async (
    runId: string,
    firstEventTimestamp: string,
    lastEventTimestamp: string
  ) => {
    logger.debug(
      `Getting item values for ${runId} between ${firstEventTimestamp} and ${lastEventTimestamp}`
    );
    type Zone = { event_text: string; id: number };
    try {
      const rows = await DB.getItemsBetweenEvents(firstEventTimestamp, lastEventTimestamp);
      let itemsCount = 0;
      let totalProfit = 0;
      let importantDrops = {};

      // Get Zones from the items list
      const zones: Zone[] = rows
        .map((row) => ({ event_text: row.event_text, id: row.event_id }))
        .filter((zone, index, self) => self.findIndex((t) => t.id === zone.id) === index);
      logger.debug(`Got ${zones.length} zones`);
      logger.debug(zones);

      for (let zone of zones) {
        const index = zones.findIndex((z) => z.id === zone.id);
        logger.debug(`Handling items for zone: ${zone.event_text} (id:${index})`);

        // Bail if you are in the first zone since there's no previous zone to compare with
        const lastZone: any = zones[index - 1];
        if (!lastZone) {
          logger.debug('No last zone', lastZone, zone, index);
          continue;
        }

        // If the previous zone was not a town, check the loot difference in the current zone
        if (!Utils.isTown(lastZone.event_text)) {
          // We are in a town but were not in the previous step
          logger.debug(`Getting items picked up in ${lastZone.id} ${lastZone.event_text}`);
          const items = rows.filter((row) => row.event_id === zone.id);
          logger.debug(`Found ${items.length} items in ${rows.length} rows`);

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
      logger.info(`Unable to get item values for ${runId}: ${err}`);
      return false;
    }
  },

  getLastInventoryTimestamp: async (): Promise<string | null> => {
    return OldDB.get('SELECT timestamp FROM last_inventory ORDER BY id DESC LIMIT 1')
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
    area: { run_id: number; name: string },
    firsteventTimestamp: string,
    lasteventTimestamp: string
  ): Promise<ItemStats | false> => {
    logger.debug(
      `Getting item stats for (${area.run_id}) ${area.name} between ${firsteventTimestamp} and ${lasteventTimestamp}`
    );
    let lastInventoryTimestamp: string;
    let timestampCheckCount = 0;

    // Make sure the last inventory has been processed, wait 3s at a time until we're good
    // Fails after 3 attempts
    while (timestampCheckCount < 3) {
      timestampCheckCount++;
      logger.debug('Getting latest inventory timestamp');
      lastInventoryTimestamp =
        (await RunParser.getLastInventoryTimestamp()) ?? dayjs.unix(0).toISOString();
      if (
        dayjs().isSameOrAfter(dayjs(lasteventTimestamp)) ||
        dayjs(lastInventoryTimestamp).isSameOrAfter(
          dayjs(lasteventTimestamp).subtract(5, 'seconds')
        ) // Last inventory is newer than the last event + cache
      ) {
        break;
      } else {
        if (timestampCheckCount >= 3) {
          logger.error('Unable to get the latest inventory from the DB, timestamp is too new');
          return false;
        } else {
          logger.error(
            `Last inventory not yet processed (${dayjs(lastInventoryTimestamp)} < ${dayjs(
              lasteventTimestamp
            ).subtract(5, 'seconds')}), waiting 3 seconds`
          );
          await Utils.sleep(3000);
        }
      }
    }

    logger.debug(`Getting chaos value of items from ${area.run_id} ${area.name}`);
    try {
      const itemStats = (await RunParser.generateItemStats(
        `${area.run_id}`,
        firsteventTimestamp,
        lasteventTimestamp
      )) as ItemStats;
      if (itemStats) logger.debug(`Total profit is ${itemStats.value} in ${itemStats.count} items`);
      return itemStats;
    } catch (err) {
      logger.error(`Unable to get item values for ${area.run_id} ${area.name}: ${err}`);
      return false;
    }
  },

  getKillCount: async (firsteventTimestamp: string, lasteventTimestamp: string) => {
    logger.debug(`Getting Kill count between ${firsteventTimestamp} and ${lasteventTimestamp}`);
    let totalKillCount = 0;
    return DB.getIncubatorDataBetweenEvents(firsteventTimestamp, lasteventTimestamp)
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

  getEvents: async (firstEventTimestamp: string, lasteventTimestamp: string) => {
    return OldDB.all(
      'SELECT * FROM event WHERE DATETIME(timestamp) BETWEEN DATETIME(?) AND DATETIME(?) ORDER BY id',
      [firstEventTimestamp, lasteventTimestamp]
    ).catch((err) => {
      logger.error(`Unable to get events: ${err}`);
      return [];
    });
  },

  countDeaths: (events: Event[], start: string, end: string) => {
    return events.filter(
      (event) =>
        event.event_type === 'slain' &&
        !!event.timestamp &&
        dayjs(event.timestamp).isAfter(dayjs(start, 'YYYYMMDDHHmmss')) &&
        dayjs(event.timestamp).isBefore(dayjs(end, 'YYYYMMDDHHmmss'))
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
    events: { event_type: string; event_text: string; timestamp: number }[]
  ): { [key: string]: number } => {
    const times = {};

    events
      .filter((event) => event.event_type === 'entered')
      .forEach((event, index, array) => {
        const nextEvent = array[index + 1];
        if (nextEvent) {
          const area = event.event_text;
          const runningTime = Utils.getRunningTime(event.timestamp, nextEvent.timestamp, 's', {
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
    firsteventTimestamp: string,
    lasteventTimestamp: string,
    items: ItemStats,
    areaMods: string[]
  ) => {
    logger.info(
      `Getting map extra info for ${areaName} between ${firsteventTimestamp} and ${lasteventTimestamp}`
    );

    let events = await RunParser.getEvents(firsteventTimestamp, lasteventTimestamp);

    let run: any = {};
    let lastEnteredArea = '';

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
          if (
            run.shaper?.guardians?.length >= 1 &&
            run.maven?.witnesses?.[run.maven?.witnesses?.length - 1].started
          ) {
            run.shaper.guardians[run.shaper.guardians.length - 1].deaths =
              ++run.shaper.guardians[run.shaper.guardians.length - 1].deaths || 1;
          }
          continue;
        case 'abnormalDisconnect':
          run.abnormalDisconnect = ++run.abnormalDisconnect || 1;
          continue;
          // case 'shrine':
          //   if (Constants.darkshrineQuotes[evt.event_text]) {
          //     run.labyrinth = run.labyrinth || {};
          //     run.labyrinth.darkshrines = run.labyrinth.darkshrines || [];
          //     run.labyrinth.darkshrines.push(evt.event_text);
          //   }
          //  else {
          //   run.shrines = run.shrines || [];
          //   run.shrines.push(Constants.shrineQuotes[evt.event_text]);
          // }
          continue;
        // case 'master':
        // case 'conqueror':
        // case 'leagueNPC':
        //   line = RunParser.getNPCLine(evt.event_text);
        //   break;
        default:
          const parsedEvent = EventParser.parseEventData(run, evt);
          if (parsedEvent) continue;
      }

      line = LogProcessor.readLine(evt.event_text);

      if (line === null) continue;
      switch (line.npc) {
        case 'The Envoy':
          run.envoy = run.envoy || { words: 0 };
          run.envoy.words += line.text.split(' ').length;
          continue;
        case 'Strange Voice':
          run.strangeVoiceEncountered = true;
          continue;
        case 'Niko, Master of the Depths':
          run.delve = run.delve || {};
          run.delve.niko = true;
          run.delve.sulphiteNodes = ++run.delve.sulphiteNodes || 1;
          continue;
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

  updateMapRun: async (areaId: number, mapData: MapData): Promise<void> => {
    logger.debug('Updating map run:', mapData);
    const formattedMapData = mapData.map((item) => {
      if (typeof item === 'boolean') {
        return +item;
      }
      return item;
    });
    return DB.updateRunInfo(areaId, formattedMapData)
      .then(() => {
        logger.debug(
          `Map run ${areaId} processed successfully with these arguments: ${JSON.stringify(
            mapData
          )}`
        );
      })
      .catch((err) => {
        logger.error(
          `Unable to update map run ${areaId} with these arguments: ${JSON.stringify(
            mapData
          )}.\nError: ${err}`
        );
      });
  },

  getLastMapEnterEvent: async () => {
    return OldDB.get(
      `
      SELECT * FROM event
      WHERE event_type='entered'
      AND 
        (
          DATETIME(event.timestamp) > (SELECT MAX(DATETIME(last_event)) FROM run WHERE completed IS 1)
          OR
          DATETIME(event.timestamp) >= (SELECT MAX(DATETIME(first_event)) FROM run WHERE completed IS 0)
        )
      ORDER BY timestamp ASC
      `
    )
      .then((row) => {
        if (!row) {
          logger.info('No last inserted event found!');
          return null;
        } else {
          return {
            timestamp: row.timestamp,
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
      SELECT timestamp, event_text, server
      FROM 
        event
      WHERE 
        event_type='entered'
        AND DATETIME(event.timestamp) >= (SELECT MAX(DATETIME(first_event)) FROM run WHERE completed IS 0)
      ORDER BY timestamp
    `;

    try {
      const rows = await OldDB.all(query);
      return rows.map((row) => {
        return {
          timestamp: row.timestamp,
          area: row.event_text,
          server: row.server,
        };
      });
    } catch (err) {
      logger.error(`Unable to get latest unused map entering events: ${err}`);
      return [];
    }
  },

  getLatestGeneratedEvents: async (): Promise<ParsedEvent[]> => {
    const query = `
      SELECT timestamp, event_text, server
      FROM 
        event
      WHERE 
        event_type='generatedArea'
        AND DATETIME(event.timestamp) >= (SELECT MAX(DATETIME(first_event)) FROM run WHERE completed IS 0)
      ORDER BY timestamp
    `;

    try {
      const rows = await OldDB.all(query);
      return rows.map((row) => {
        const rowData = JSON.parse(row.event_text);
        return {
          timestamp: row.timestamp,
          area: rowData.areaName,
          server: row.server,
        };
      });
    } catch (err) {
      logger.error(`Unable to get latest unused map entering events: ${err}`);
      return [];
    }
  },

  processRun: async (lastEventTimestamp: string, runId: number | null = null) => {
    let mapStats = {
      iiq: 0,
      iir: 0,
      pack_size: 0,
    };
    let mapMods: any[] = [];

    logger.info(`Processing map run ending at ${lastEventTimestamp}`);

    let firstEvent: string | null = null;

    // Read latest Run ID
    if (runId) {
      const RunData = await DB.getRunData(runId);
      if (RunData) {
        lastEventTimestamp = RunData.last_event;
        firstEvent = RunData.first_event;
      }
    } else {
      const RunData = await DB.getLatestUncompletedRun();
      if (RunData) {
        runId = RunData.id;
        firstEvent = RunData.first_event;
      }
    }
    if (!runId || !firstEvent) {
      logger.info('No uncompleted map run found');
      return false;
    }

    let areaInfo = await RunParser.getAreaInfo(runId);
    if (areaInfo) {
      mapMods = (await RunParser.getMapMods(runId)) as any[];
      logger.debug(`Map mods: ${JSON.stringify(mapMods)}`);
      mapStats = RunParser.getMapStats(mapMods);
      logger.debug(`Map stats: ${JSON.stringify(mapStats)}`);
    } else {
      areaInfo = {
        run_id: runId,
        level: 0,
        depth: 0,
        name: '',
      };
    }
    logger.debug('Run AreaInfo', areaInfo);

    // Calculate XP -- OLD
    // TODO: Clean that up
    const xp = XPTracker.isMaxXP()
      ? Constants.MAX_XP
      : await RunParser.getXP(runId, lastEventTimestamp);
    const xpDiff = await RunParser.getXPDiff(xp);

    // Get Item Stats
    const itemStats = await RunParser.getItemStats(areaInfo, firstEvent, lastEventTimestamp);
    // If no item stats are found, set default values
    const items = itemStats ? itemStats : { count: 0, value: 0, importantDrops: {} };

    // Get the kill count if possible
    let killCount = await RunParser.getKillCount(firstEvent, lastEventTimestamp);

    // Get all the extra info (like Maven, Atlas Region, etc.)
    const extraInfo = await RunParser.getMapExtraInfo(
      areaInfo.name,
      firstEvent,
      lastEventTimestamp,
      items,
      mapMods
    );

    let runArguments: MapData = [
      firstEvent,
      lastEventTimestamp,
      mapStats.iiq || null,
      mapStats.iir || null,
      mapStats.pack_size || null,
      xp,
      killCount > -1 ? killCount : null, // if killCount is -1, set it to null
      JSON.stringify(extraInfo),
      true, // completed
    ];

    await RunParser.updateMapRun(runId, runArguments);
    return {
      name: areaInfo.name,
      gained: items.value,
      xp: xpDiff,
      kills: killCount > -1 ? killCount : null,
      firstEvent,
      lastEvent: lastEventTimestamp,
    };
  },

  reprocessRuns: async () => {
    const runIds = await DB.getAllRunIds();
    for (const runId of runIds) {
      await RunParser.reprocessRun(runId);
    }
  },

  reprocessRun: async (runId: number) => {
    // Reprocess the run
    await LogProcessor.reprocessEvents(runId);
    return RunParser.processRun('', runId);
  },

  /**
   * Tries to process a map run event.
   * @param parameters - The parameters containing the event to process. (Optional)
   * @returns A promise that resolves when the processing is complete or when it does not need to process.
   * If a map run is processed, it returns 1.
   * If no map run is processed, it returns undefined.
   * @throws Will log an error if processing fails.
   */
  tryProcess: async (parameters: { event: ParsedEvent } | null) => {
    let event: ParsedEvent;
    let wasGivenEvent: boolean = false;
    logger.debug('RunParser.tryProcess', parameters);
    if (parameters && parameters.event) {
      event = parameters.event;
      wasGivenEvent = true;
    } else {
      // If no event is provided, we try to get the last map enter event from the database
      logger.debug('No event found, looking up in db');
      let lastEvent = await DB.getLastMapEnterEvent();
      logger.debug('Last event:', lastEvent);
      if (!lastEvent) return false;
      event = lastEvent;
    }

    // = The last map area event, the one that triggers this processing
    const latestGeneratedEvent = await DB.getLastMapGeneratedEvent();
    logger.debug('Latest generated event:', latestGeneratedEvent);

    if (latestGeneratedEvent && latestGeneratedEvent.event_text) {
      try {
        const eventData = typeof latestGeneratedEvent.event_text === 'string'
          ? JSON.parse(latestGeneratedEvent.event_text)
          : latestGeneratedEvent.event_text;
        event.area = event.area ?? eventData.areaName;
      } catch (e) {
        logger.error('Failed to parse latest generated event:', e);
      }
    }

    if (!event.area) {
      logger.debug('No area found in event, cannot process run');
      return false;
    }

    // Update the last event timestamp in the database
    await DB.updateLastEvent(event.timestamp);

    const lastEventTimestamp = event.timestamp;

    // Get all the enter events from the beginning of the latest uncompleted run
    const mapEvents = await RunParser.getLatestUnusedMapEnteredEvents();
    if (mapEvents.length < 1) {
      logger.debug('No map enter events found');
      return false;
    }

    // Check if we have one of the enter events that is not a town
    const mapFirstEvent = mapEvents.find((event) => !Utils.isTown(event.area));
    if (!mapFirstEvent) {
      logger.debug('No map first map enter event found');
      return false;
    }

    logger.debug('Map enter event found:\n', JSON.stringify(mapFirstEvent));
    logger.debug(`${event.area} -> ${mapFirstEvent.area}`);

    // If we are in the lab, do not process
    if (Utils.isLabArea(event.area) && Utils.isLabArea(mapFirstEvent.area)) {
      logger.debug('Still in lab, not processing');
      return false;
    } else if (Utils.isVaalArea(event.area)) {
      logger.debug('Entered a vaal area, not processing');
      return false;
    } else if (event.area === 'Abyssal Depths') {
      logger.debug('Entered Abyssal Depths, not processing');
      return false;
    } else if (Utils.isLabTrial(event.area)) {
      logger.debug('Entered a lab trial, not processing');
      return false;
    } else if (event.area === mapFirstEvent.area) {
      // If in the mine, do not process
      // TODO: make it work?
      if (event.area === 'Azurite Mine') {
        logger.debug('Still in delve, not processing');
        return false;
      }
      // Check if the server of the event matches the first event's server ??
      else if (wasGivenEvent && event.server && event.server === mapFirstEvent.server) {
        logger.debug(`Still in same area ${event.area}, not processing`);
        return false;
      }
    }

    // Check for the run's last town event?
    // const lastEvent = mapEvents.reverse().find((event) => Utils.isTown(event.area));
    // if (!lastEvent) return;
    // logger.debug('Last town event found:\n', JSON.stringify(lastEvent));

    try {
      logger.debug(`Processing run for area: ${event.area} at ${lastEventTimestamp}`);
      const runData = await RunParser.processRun(lastEventTimestamp);
      RunParser.emitter.emit('run-parser:run-processed', runData);
      RunParser.resetRunData();
    } catch (e) {
      logger.error(`Error processing run: ${e}`);
      return false;
    }

    return true;
  },

  recheckGained: async (from = dayjs.unix(0).toISOString(), to = dayjs().toISOString()) => {
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
      await ItemPricer.getRatesFor(run.first_event);
    }

    const checks = runs.map(async (run) => {
      const items = await DB.getItemsFromRun(run.id);
      let totalProfit = 0;
      let oldTotalProfit = 0;
      let itemsToUpdate: { value: number; id: number; eventId: number }[] = [];
      for (const item of items) {
        const { value } = await ItemPricer.price(
          item,
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
        logger.debug(`Updating ${itemsToUpdate.length} items for run ${run.id}`, itemsToUpdate);
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



  getAreaFromId: (areaId: string): any => {
    logger.info(`Getting area name for ID: ${areaId}`);
    // logger.debug(WorldAreas)
    const worldArea = WorldAreas[areaId] ?? {
      name: 'Unknown Area',
      baseLevel: 0,
    };
    logger.debug(worldArea);
    return worldArea;
  },

  insertEvent: async (event: Event) => {
    logger.debug('Inserting event:', event);
    await DB.insertEvent(event);
  },

  startRun: async (area: string, level: number, name: string) => {
    logger.debug('Starting run in area:', area, 'level:', level);
    const data = await DB.insertMapRun([
      dayjs().toISOString(), // first event timestamp
      dayjs().toISOString(), // last event timestamp
      0, // iiq
      0, // iir
      0, // packsize
      0, // xp
      0, // kills
      JSON.stringify({ area, level }), // run info
      false, // completed
    ]);
    const areaId = data.lastInsertRowid;
    await DB.insertAreaInfo({
      areaId,
      name,
      level,
    });
    logger.info(`Started run in ${area} (${level})`);
  },

  setCurrentMapStats: async (stats: {
    name: string;
    level: number;
    depth: number;
    iir: number;
    iiq: number;
    pack_size: number;
  }) => {
    await DB.setCurrentRunStats({
      iir: stats.iir,
      iiq: stats.iiq,
      pack_size: stats.pack_size,
    });
  },

  insertGeneratedMap: async (data: {
    timestamp: string;
    areaId: string;
    areaName: string;
    level: number;
    seed: number;
  }) => {
    logger.debug('Inserting generated map:', data);
    await DB.insertGeneratedMap(data);
  },

  hasOngoingMapRun: async () => {
    const ongoingRun = await DB.getOngoingMapRun();
    logger.debug('Checking for ongoing map run:', ongoingRun, ' - exists:', !!ongoingRun);
    return !!ongoingRun;
  },

  createNewMapRun: async ({ areaId, areaName, level, seed, timestamp }) => {
    logger.debug('Creating new map run:', areaId, areaName, level, seed);
    const { lastInsertRowid: runId } = await DB.insertMapRun([
      timestamp, // first event timestamp
      timestamp, // last event timestamp
      0, // iiq
      0, // iir
      0, // packsize
      0, // xp
      0, // kills
      JSON.stringify({ areaId, areaName, level, seed }), // run info
      false, // completed
    ]);
    logger.info(`Created new map run: ${runId}`);

    await DB.insertAreaInfo({
      areaId: runId,
      name: areaName,
      level: level,
    });
    logger.info(`Inserted area info for run ${runId}: ${areaName} (level ${level})`);

    return runId;
  },

  tryUpdateCurrentArea: async () => {
    logger.debug('Trying to start current run if not already started');
    return await DB.updateCurrentRunFirstEvent();
  },
};

export default RunParser;
