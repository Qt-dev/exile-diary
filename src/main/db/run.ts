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
  stackSize: number;
  maxStackSize: number;
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
};

type Item = {
  id: string;
  rarity: string;
  icon: string;
  value: number;
  original_value: number;
  stacksize: number;
  rawdata: string;
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
  getLastRuns: async (numberOfRunsToShow: number) => {
    logger.info(
      `Getting last ${
        numberOfRunsToShow === Number.MAX_SAFE_INTEGER ? 'all' : numberOfRunsToShow
      } runs from DB`
    );
    const lastRunsQuery = `
      select mapruns.id, name, level, depth, iiq, iir, packsize, firstevent, lastevent,
        (mapruns.xp - (select xp from mapruns m where m.id < mapruns.id and xp is not null order by m.id desc limit 1)) xpgained,
        (select count(1) from events where event_type='slain' and events.id between firstevent and lastevent) deaths,
        gained, kills, runinfo
      from areainfo, mapruns
      where areainfo.id = mapruns.id
        and json_extract(runinfo, '$.ignored') is null
      order by mapruns.id desc
      limit ?
    `;

    const runData = await DB.all(lastRunsQuery, [numberOfRunsToShow]);

    return runData;
  },

  getRunMods: async (mapId: number): Promise<any> => {
    logger.info(`Getting mods for run ${mapId}`);
    const mapModsQuery = `
      select mod
      from mapmods
      where id = ?
    `;

    const mapMods = await DB.all(mapModsQuery, [mapId]);

    return mapMods;
  },

  getEvents: async (mapId: number) => {
    logger.info(`Getting events for run ${mapId}`);
    const eventsQuery = `
      select events.* from mapruns, events 
      where mapruns.id = ?
      and events.id between mapruns.firstevent and mapruns.lastevent 
      order by events.id;
    `;

    const events = await DB.all(eventsQuery, [mapId]);

    return events;
  },

  getRunInfo: async (mapId: number): Promise<any> => {
    logger.info(`Getting run info for run ${mapId}`);
    const mapInfoQuery = `
      select mapruns.id, name, level, depth, iiq, iir, packsize, xp, kills, runinfo, firstevent, lastevent, gained,
      (mapruns.xp - (select xp from mapruns m where m.id < mapruns.id and xp is not null order by m.id desc limit 1)) xpgained,
      (select xp from mapruns m where m.id < mapruns.id and xp is not null order by m.id desc limit 1) prevxp,
      (select league from leagues where timestamp < lastevent order by timestamp desc limit 1) league
      from areainfo, mapruns where mapruns.id = ?
        and areainfo.id = ?
    `;

    const mapInfo = await DB.get(mapInfoQuery, [mapId, mapId]);

    return mapInfo;
  },

  getItems: async (mapId: number) => {
    logger.info(`Getting items for run ${mapId}`);
    const itemsQuery = `
      select events.id, items.rarity, items.icon, items.value, items.original_value, items.stacksize, items.rawdata from mapruns, events, items
      where mapruns.id = ?
      and events.id between mapruns.firstevent and mapruns.lastevent
      and items.event_id = events.id;
    `;

    const items = (await DB.all(itemsQuery, [mapId])) as Item[];
    if (!items) return [];
    const formattedItems: any = {};

    for (const item of items) {
      const rawData: ItemRawData = JSON.parse(item.rawdata);
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

      if (secretName || item.value || item.stacksize) {
        if (secretName) rawData.secretName = secretName;
        if (item.value) rawData.value = item.value;
        if (item.original_value) rawData.originalValue = item.original_value;
        if (item.stacksize) rawData.pickupStackSize = item.stacksize;
        formattedItems[item.id].push(JSON.stringify(rawData));
      } else {
        formattedItems[item.id].push(item.rawdata);
      }
    }
    return formattedItems;
  },

  updateItemValues: async (items: any) => {
    logger.info(`Updating item values for ${items.length} items`);
    const query = 'UPDATE items SET value = ? WHERE id = ? AND event_id = ?';
    const params = items.map((item: any) => [item.value, item.id, item.eventId]);
    try {
      DB.transaction(query, params);
      return true;
    } catch (err) {
      logger.error(`Error updating item values: ${JSON.stringify(err)}`);
      return false;
    }
  },

  updateProfit: async (mapId: number, profit: number) => {
    logger.info(`Updating profit for run ${mapId}`);
    const query = 'UPDATE mapruns SET gained = ? WHERE id = ?';
    try {
      DB.run(query, [profit, mapId]);
      return true;
    } catch (err) {
      logger.error(`Error updating profit for ${mapId}: ${JSON.stringify(err)}`);
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
    const query = 'select * from areainfo where id = ?';
    const areaInfo = (await DB.get(query, [areaId])) as AreaInfo;
    return areaInfo;
  },

  insertAreaInfo: async ({
    id,
    name,
    level,
    depth,
  }: {
    id: number;
    name?: string;
    level?: number;
    depth?: number;
  }) => {
    const currentInfo: any = Runs.getAreaInfo(id);
    const query =
      'INSERT INTO areainfo(id, name, level, depth) VALUES(?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = ?, level = ?, depth = ?';
    try {
      if (!name && !level && !depth) throw 'No areaInfo provided';
      const params = [
        id,
        name ?? currentInfo.name,
        level ?? currentInfo.level,
        depth ?? currentInfo.depth,
        name ?? currentInfo.name,
        level ?? currentInfo.level,
        depth ?? currentInfo.depth,
      ];
      DB.run(query, params);
      return true;
    } catch (err) {
      logger.error(err);
      logger.error(`Error inserting new areaInfo for ${name}(${id}): ${JSON.stringify(err)}`);
      return false;
    }
  },

  deleteAreaInfo: async (areaId: number) => {
    const query = 'DELETE FROM areainfo WHERE id = ?';
    try {
      DB.run(query, [areaId]);
      return true;
    } catch (err) {
      logger.error(`Error deleting areaInfo for ${areaId}: ${JSON.stringify(err)}`);
      return false;
    }
  },

  insertMapMods: async (mapId: number, mods: string[]) => {
    const query = 'INSERT INTO mapmods(area_id, id, mod) VALUES(?, ?, ?)';
    try {
      mods.forEach((mod, i) => {
        DB.run(query, [mapId, i, mod]);
      });
      return true;
    } catch (err) {
      logger.error(`Error inserting new mapMods for ${mapId}:`);
      logger.error(err);
      return false;
    }
  },

  deleteMapMods: async (mapId: number) => {
    const query = 'DELETE FROM mapmods WHERE id = ?';
    try {
      DB.run(query, [mapId]);
      return true;
    } catch (err) {
      logger.error(`Error deleting mapMods for ${mapId}: ${JSON.stringify(err)}`);
      return false;
    }
  },

  getAreaName: async (timestamp: string) => {
    const query =
      "select event_text as area from events where event_type='entered' and id < ? order by id desc limit 1";
    const { area } = (await DB.get(query, [timestamp])) as { area: string };
    return area;
  },

  getRunsFromDates: async (from: number, to: number) => {
    logger.info(`Getting items from date ${from} to ${to}`);
    const itemsQuery = `
      SELECT areainfo.name, mapruns.id, firstevent, lastevent, gained
      FROM mapruns, areainfo
      WHERE mapruns.gained > -1
      AND areainfo.id = mapruns.id
      AND mapruns.id BETWEEN ? AND ?;
    `;

    const runs = await DB.all(itemsQuery, [from, to]);

    return runs;
  },

  getItemsFromRun: async (mapRunId: string) => {
    logger.info(`Getting items from run: ${mapRunId}`);
    const itemsQuery = `
      SELECT items.*
      FROM items, mapruns
      WHERE mapruns.id = ? 
      AND items.event_id BETWEEN mapruns.firstevent AND mapruns.lastevent
      GROUP BY items.id, items.event_id;
    `;

    const items = await DB.all(itemsQuery, [mapRunId]);

    return items;
  },
};

export default Runs;
