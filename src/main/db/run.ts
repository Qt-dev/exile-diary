import DB from './index';
import constants from '../../helpers/constants';
import Logger from 'electron-log';
const logger = Logger.scope('db/run');

type ItemProperty = {
  name: string;
  values: any[];
  displayMode: number;
  type: number;
};

type ItemRawData = {
  verified: boolean;
  icon: string;
  stack_size: number;
  max_stack_size: number;
  league: string;
  id: string;
  name: string;
  typeLine: string;
  baseType: string;
  identified: boolean;
  ilvl: number;
  properties: ItemProperty[];
  explicitMods: string[];
  descrText: string;
  frameType: number;
  elder?: boolean;
  secretName?: string;
  value?: number;
  originalValue: number;
  pickupStackSize?: number;
  rarity?: string;
  isIgnored?: boolean;
};

type Item = {
  id: string;
  rarity: string;
  icon: string;
  value: number;
  original_value: number;
  stack_size: number;
  raw_data: string;
  ignored: boolean;
};

type AreaInfo = {
  id: number;
  name: string;
  level: number;
  depth: number;
};

const getItemNameFromIcon = (iconUrl: string) => {
  if (iconUrl.includes('?')) {
    iconUrl = iconUrl.substring(0, iconUrl.indexOf('?'));
  }

  // Items can have encoded URLs, need to extract item ID from base64 encoded string
  if (iconUrl.includes('https://web.poecdn.com/gen/image/')) {
    let iconPath = iconUrl.replace('https://web.poecdn.com/gen/image/', '');
    iconPath = iconPath.substring(0, iconPath.indexOf('/'));
    const decodedPath = JSON.parse(Buffer.from(iconPath, 'base64').toString('utf8'))[2].f.replace(
      '2DItems/',
      ''
    );

    if (decodedPath.includes('/Flasks/')) {
      const flaskId = decodedPath.replace('Art/', '').replace('Flasks/', '');
      return constants.uniqueFlasks[flaskId] || null;
    } else if (decodedPath.includes('/Maps/')) {
      const mapId = decodedPath.replace('Art/', '').replace('Maps/', '');
      return constants.uniqueMaps[mapId] || null;
    } else {
      return constants.uniqueIconsNew[decodedPath] || null;
    }
  } else {
    return constants.uniqueIcons[iconUrl] || null;
  }
};

const Runs = {
  getAreaId: async (): Promise<number> => {
    logger.info('Getting area ID from DB');
    const query = `
      SELECT id FROM run
      ORDER BY id DESC
      LIMIT 1;
    `;
    const result = await DB.get(query);
    logger.info(`Last area ID: ${result.id}`);
    return result ? result.id : 0;
  },

  insertMapRun: async (mapData: any): Promise<any> => {
    const formattedMapData = mapData.map((item) => {
      if (typeof item === 'boolean') {
        return +item; // Convert boolean to number (0 or 1)
      }
      return item;
    });
    logger.debug('Inserting map run:', formattedMapData);
    return DB.run(
      'INSERT INTO run(first_event, last_event, iiq, iir, pack_size, xp, kills, run_info, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      formattedMapData
    );
  },

  getLastRuns: async (numberOfRunsToShow: number) => {
    logger.info(
      `Getting last ${
        numberOfRunsToShow === Number.MAX_SAFE_INTEGER ? 'all' : numberOfRunsToShow
      } runs from DB`
    );
    const lastRunsQuery = `
      SELECT run.id, name, level, depth, iiq, iir, pack_size, first_event, last_event,
        (run.xp - (SELECT xp FROM run m WHERE m.id < run.id AND xp IS NOT null ORDER BY m.id desc limit 1)) xpgained,
        (SELECT count(1) FROM event WHERE event_type='slain' AND DATETIME(event.timestamp) between DATETIME(first_event) AND DATETIME(last_event)) deaths,
        (SELECT COALESCE(SUM(value),0) FROM item, event WHERE item.event_id = event.id AND DATETIME(event.timestamp) BETWEEN DATETIME(first_event) AND DATETIME(last_event) AND ignored = 0) gained,
        kills, run_info
      FROM area_info, run
      WHERE area_info.run_id = run.id
        AND json_extract(run_info, '$.ignored') IS null
      ORDER BY run.id desc
      LIMIT ?
    `;

    const runData = await DB.all(lastRunsQuery, [numberOfRunsToShow]);

    return runData;
  },

  getRunMods: async (mapId: number): Promise<any> => {
    const mapModsQuery = `
      SELECT mod
      FROM mapmod
      WHERE run_id = ?
      ORDER BY id;
    `;

    const mapMods = await DB.all(mapModsQuery, [BigInt(mapId)]);
    return mapMods;
  },

  getEvents: async (mapId: number) => {
    logger.info(`Getting events for run ${mapId}`);
    const eventsQuery = `
      SELECT event.* FROM run, event
      WHERE run.id = ?
      AND DATETIME(event.timestamp) BETWEEN DATETIME(run.first_event) AND DATETIME(run.last_event)
      ORDER BY event.id;
    `;

    const events = await DB.all(eventsQuery, [mapId]);

    return events;
  },

  getRunInfo: async (mapId: number): Promise<any> => {
    logger.info(`Getting run info for run ${mapId}`);
    const mapInfoQuery = `
      SELECT run.id, name, level, depth, iiq, iir, pack_size, xp, kills, run_info, first_event, last_event,
      (SELECT COALESCE(SUM(value),0) FROM item, event WHERE item.event_id = event.id AND DATETIME(event.timestamp) BETWEEN DATETIME(first_event) AND DATETIME(last_event) AND ignored = 0) gained,
      (run.xp - (SELECT xp FROM run m WHERE m.id < run.id AND xp IS NOT null ORDER BY m.id desc LIMIT 1)) xpgained,
      (SELECT xp FROM run m WHERE m.id < run.id AND xp IS NOT null ORDER BY m.id desc LIMIT 1) prevxp,
      (SELECT name FROM league WHERE DATETIME(timestamp) < DATETIME(last_event) ORDER BY timestamp desc LIMIT 1) league
      FROM area_info, run WHERE run.id = ?
        AND area_info.run_id = run.id
    `;

    const mapInfo = await DB.get(mapInfoQuery, [mapId]);

    return mapInfo;
  },

  getItems: async (mapId: number) => {
    logger.info(`Getting items for run ${mapId}`);
    const itemsQuery = `
      SELECT event.id, item.rarity, item.icon, item.value, item.original_value, item.stack_size, item.raw_data, item.ignored
      FROM run, event, item
      WHERE run.id = ?
      AND DATETIME(event.timestamp) BETWEEN DATETIME(run.first_event) AND DATETIME(run.last_event)
      AND item.event_id = event.id;
    `;

    const items = (await DB.all(itemsQuery, [mapId])) as Item[];
    if (!items) return [];
    const formattedItems: any = {};

    for (const item of items) {
      const rawData: ItemRawData = JSON.parse(item.raw_data);
      rawData.rarity = item.rarity;
      if (!formattedItems.hasOwnProperty(item.id)) {
        formattedItems[item.id] = [];
      }
      let secretName = '';
      if (item.rarity === 'Unique') {
        secretName = getItemNameFromIcon(item.icon);
      }
      if (secretName && secretName === 'Starforge' && rawData.elder) {
        secretName = 'Voidforge';
      }

      if (secretName || item.value || item.value === 0 || item.stack_size) {
        if (secretName) rawData.secretName = secretName;
        if (item.value || item.value === 0) rawData.value = item.value;
        if (item.original_value) rawData.originalValue = item.original_value;
        if (item.stack_size) rawData.pickupStackSize = item.stack_size;
      }
      rawData.isIgnored = !!item.ignored;
      formattedItems[item.id].push(JSON.stringify(rawData));
    }
    return formattedItems;
  },

  updateItemValues: async (items: any) => {
    logger.info(`Updating item values for ${items.length} items`);
    const query = 'UPDATE item SET value = ? WHERE id = ? AND event_id = ?';
    const params = items.map((item: any) => [item.value, item.id, item.eventId]);
    try {
      await DB.transaction(query, params);
      return true;
    } catch (err) {
      logger.error(`Error updating item values: ${JSON.stringify(err)}`);
      return false;
    }
  },

  getRun: async (mapId: number) => {
    logger.info(`Getting run ${mapId}`);
    const mapInfo = await Runs.getRunInfo(mapId);
    const mods = await Runs.getRunMods(mapId);
    const events = await Runs.getEvents(mapId);
    const items = await Runs.getItems(mapId);

    const run = {
      ...mapInfo,
      events,
      items,
      mods,
    };

    return run;
  },

  getAreaInfo: async (areaId: number) => {
    const query = 'SELECT * FROM area_info WHERE run_id = ?';
    const areaInfo = (await DB.get(query, [areaId])) as AreaInfo;
    return areaInfo;
  },

  insertAreaInfo: async ({
    areaId,
    name,
    level,
    depth,
  }: {
    areaId: number;
    name?: string;
    level?: number;
    depth?: number;
  }) => {
    const currentInfo: any = await Runs.getAreaInfo(areaId);
    const query =
      'INSERT INTO area_info(run_id, name, level, depth) VALUES(?, ?, ?, ?) ON CONFLICT(run_id) DO UPDATE SET name = ?, level = ?, depth = ?';
    try {
      if (!name && !level && !depth) throw 'No areaInfo provided';
      const params = [
        areaId,
        name ?? (currentInfo ? currentInfo.name : 'Unknown Area'),
        level ?? (currentInfo ? currentInfo.level : null),
        depth ?? (currentInfo ? currentInfo.depth : null),
        name ?? (currentInfo ? currentInfo.name : 'Unknown Area'),
        level ?? (currentInfo ? currentInfo.level : null),
        depth ?? (currentInfo ? currentInfo.depth : null),
      ];
      await DB.run(query, params);
      return true;
    } catch (err) {
      logger.error(err);
      logger.error(`Error inserting new areaInfo for ${name}(${areaId}): ${JSON.stringify(err)}`);
      return false;
    }
  },

  deleteAreaInfo: async (runId: number) => {
    const query = 'DELETE FROM areainfo WHERE run_id = ?';
    try {
      await DB.run(query, [runId]);
      return true;
    } catch (err) {
      logger.error(`Error deleting areaInfo for ${runId}: ${JSON.stringify(err)}`);
      return false;
    }
  },

  insertMapMods: async (mapId: number, mods: string[]) => {
    const query = 'INSERT INTO mapmod(run_id, mod) VALUES(?, ?)';
    try {
      await Promise.all(mods.map(async (mod) => {
        await DB.run(query, [mapId, mod]);
      }));
      return true;
    } catch (err) {
      logger.error(`Error inserting new mapMods for ${mapId}:`);
      logger.error(err);
      return false;
    }
  },

  replaceMapMods: async (mapId: number, mods: string[]) => {
    await Runs.deleteMapMods(mapId);
    await Runs.insertMapMods(mapId, mods);
  },

  deleteMapMods: async (mapId: number) => {
    const query = 'DELETE FROM mapmod WHERE mapmod.run_id = ?';
    try {
      await DB.run(query, [mapId]); 
      return true;
    } catch (err) {
      logger.error(`Error deleting mapMods for ${mapId}: ${JSON.stringify(err)}`);
      return false;
    }
  },

  getAreaName: async (timestamp: string) => {
    const query =
      "SELECT event_text AS area FROM event WHERE event_type='entered' AND id < ? ORDER BY id DESC LIMIT 1";
    const { area } = (await DB.get(query, [timestamp])) as { area: string };
    return area;
  },

  getRunsFromDates: async (from: string, to: string) => {
    logger.info(`Getting items from date ${from} to ${to}`);
    const itemsQuery = `
      SELECT areainfo.name, run.id, first_event, last_event,
      (SELECT COALESCE(SUM(value),0) FROM item, event WHERE event.id = item.event_id AND DATETIME(event.timestamp) BETWEEN DATETIME(first_event) AND DATETIME(last_event) AND ignored = 0) gained
      FROM run, areainfo
      WHERE gained > -1
      AND areainfo.run_id = run.id
      AND DATETIME(run.first_event) BETWEEN DATETIME(?) AND DATETIME(?);
    `;

    const runs = await DB.all(itemsQuery, [from, to]);

    return runs;
  },

  getItemsFromRun: async (mapRunId: string) => {
    logger.info(`Getting items from run: ${mapRunId}`);
    const itemsQuery = `
      SELECT item.*, event.timestamp AS drop_time
      FROM item, run, event
      WHERE item.event_id = event.id
      AND run.id = ? 
      AND DATETIME(event.timestamp) BETWEEN DATETIME(run.first_event) AND DATETIME(run.last_event)
      GROUP BY item.id, item.event_id;
    `;

    const items = await DB.all(itemsQuery, [mapRunId]);

    return items;
  },

  insertEvent: async (event: any) => {
    logger.info(`Inserting event: ${JSON.stringify(event)}`);
    const query = `
      INSERT INTO event( event_type, event_text, timestamp, server)
      VALUES(?, ?, ?, ?)
    `;
    try {
      await DB.run(query, [
        event.event_type,
        event.event_text,
        event.timestamp,
        event.server,
      ]);
      return true;
    } catch (err) {
      logger.error(`Error inserting event: ${JSON.stringify(err)}`);
      return false;
    }
  },

  setCurrentAreaInfo: async ({
    name,
    level,
    depth,
  }: {
    name: string;
    level: number;
    depth: number;
  }) => {
    const runId = await Runs.getAreaId();
    logger.info(`Setting current map stats for run ${runId}: ${name} (${level}, ${depth})`);
    const query = `
      INSERT INTO area_info (name, level, depth, run_id)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(run_id) DO
      UPDATE SET
        name = ?,
        level = ?,
        depth = ?;
    `;
    try {
      await DB.run(query, [name, level, depth, runId, name, level, depth]);
      return true;
    } catch (err) {
      logger.error(`Error setting current map stats: ${JSON.stringify(err)}`);
      return false;
    }
  },

  setCurrentRunStats: async ({
    iir,
    iiq,
    pack_size
  }: {
    iir: number;
    iiq: number;
    pack_size: number;
  }) => {
    const runId = await Runs.getAreaId();
    logger.info(`Setting current run stats for ${runId}: IIR: ${iir}, IIQ: ${iiq}, Pack Size: ${pack_size}`);
    const query = `
    UPDATE run SET
      iir = ?,
      iiq = ?,
      pack_size = ?
    WHERE id = ?
    `;
    try {
      await DB.run(query, [iir, iiq, pack_size, runId]);
      return true;
    } catch (err) {
      logger.error(`Error setting current run stats: ${JSON.stringify(err)}`);
      return false;
    }
  },

  getRunIdFromTimestamp: async (timestamp: string): Promise<number | null> => {
    logger.info(`Getting run ID from timestamp: ${timestamp}`);
    const query = `
      SELECT id FROM run
      WHERE DATETIME(?) BETWEEN first_event AND last_event
    `;
    const result = await DB.get(query, [timestamp]);
    return result ? result.id : null;
  },

};

export default Runs;
