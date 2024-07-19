import DB from './index';
import Logger from 'electron-log';
import { Run } from '../../helpers/types';
import dayjs from 'dayjs';
const logger = Logger.scope('db/stats');

type GetAllRunsForDatesParams = {
  from: string;
  to: string;
  neededItemName: string;
  selectedMaps: string[];
  selectedMods: string[];
  minMapValue: number;
  iiq?: {
    min: number;
    max: number;
  };
  iir?: {
    min: number;
    max: number;
  };
  mapLevel?: {
    min: number;
    max: number;
  };
  packSize?: {
    min: number;
    max: number;
  };
  deaths?: {
    min: number;
    max: number;
  };
};

const stats = {
  getAllRuns: async (): Promise<Run[]> => {
    logger.debug('Getting all maps');
    const query = `
      SELECT
        areainfo.name, mapruns.*,	(SELECT count(1) FROM events WHERE conquerortimes.run_id = mapruns.id AND events.id BETWEEN conquerortimes.start AND conquerortimes.end AND events.event_type = 'slain' ) AS conqueror_deaths,
        (SELECT count(1) FROM events WHERE json_extract(mapruns.runinfo, '$.mastermindBattle') IS NOT NULL AND events.id BETWEEN json_extract(mapruns.runinfo, '$.mastermindBattle.battle2start') AND min(json_extract(mapruns.runinfo, '$.mastermindBattle.completed'), mapruns.lastevent) AND events.event_type = 'slain' ) AS mastermind_deaths,
        (SELECT count(1) FROM events WHERE json_extract(mapruns.runinfo, '$.sirusBattle') IS NOT NULL AND events.id BETWEEN json_extract(mapruns.runinfo, '$.sirusBattle.start') AND min(json_extract(mapruns.runinfo, '$.sirusBattle.completed'), mapruns.lastevent) AND events.event_type = 'slain' ) AS sirus_deaths,
        (SELECT count(1) FROM events WHERE json_extract(mapruns.runinfo, '$.shaperBattle') IS NOT NULL AND events.id BETWEEN json_extract(mapruns.runinfo, '$.shaperBattle.phase1start') AND min(json_extract(mapruns.runinfo, '$.shaperBattle.completed'), mapruns.lastevent) AND events.event_type = 'slain' ) AS shaper_deaths,
        (SELECT count(1) FROM events WHERE json_extract(mapruns.runinfo, '$.maven.mavenDefeated') IS NOT NULL AND events.id BETWEEN json_extract(mapruns.runinfo, '$.maven.firstline') AND min(json_extract(mapruns.runinfo, '$.maven.mavenDefeated'), mapruns.lastevent) AND events.event_type = 'slain' ) AS maven_deaths,
        (SELECT count(1) FROM events WHERE json_extract(mapruns.runinfo, '$.oshabiBattle') IS NOT NULL AND events.id BETWEEN json_extract(mapruns.runinfo, '$.oshabiBattle.start') AND min(json_extract(mapruns.runinfo, '$.oshabiBattle.completed'), mapruns.lastevent) AND events.event_type = 'slain' ) AS oshabi_deaths,
        (SELECT count(1) FROM events WHERE json_extract(mapruns.runinfo, '$.venariusBattle') IS NOT NULL AND events.id BETWEEN json_extract(mapruns.runinfo, '$.venariusBattle.start') AND min(json_extract(mapruns.runinfo, '$.venariusBattle.completed'), mapruns.lastevent) AND events.event_type = 'slain' ) AS venarius_deaths

      FROM areainfo, mapruns
      LEFT JOIN
          (
            SELECT mapruns.id AS run_id,
              min(events.id) AS start,
              max(events.id) AS end
            FROM events, mapruns
            WHERE 
              events.id between mapruns.firstevent
              AND mapruns.lastevent
              AND events.event_type = 'conqueror'
              AND json_extract(mapruns.runinfo, '$.conqueror') IS NOT NULL
            GROUP BY mapruns.id
          ) as conquerortimes
        ON conquerortimes.run_id = mapruns.id
      WHERE mapruns.id = areainfo.id
      AND json_extract(runinfo, '$.ignored') is null
      ORDER BY mapruns.id desc
      `;

    try {
      const maps = (await DB.all(query)) as Run[];
      return maps;
    } catch (err) {
      logger.error(`Error getting all maps: ${JSON.stringify(err)}`);
      return [];
    }
  },
  getAllItems: async (league: string): Promise<any[]> => {
    const query = `
      SELECT mapruns.id AS map_id, areainfo.name AS area, items.*
      FROM items, mapruns, areainfo
      WHERE items.value > 10 
      AND items.event_id BETWEEN mapruns.firstevent AND mapruns.lastevent
      AND mapruns.id = areainfo.id
    `;

    try {
      const items = await DB.all(query);
      return items ?? [];
    } catch (err) {
      logger.error(`Error getting all loot: ${JSON.stringify(err)}`);
      return [];
    }
  },
  getAllItemsForDates: async (
    from: string,
    to: string,
    minLootValue: number = 0
  ): Promise<any[]> => {
    const query = `
      SELECT mapruns.id AS map_id, areainfo.name AS area, items.*
      FROM items, mapruns, areainfo, leaguedates
      WHERE items.value > ?
      AND items.event_id BETWEEN mapruns.firstevent AND mapruns.lastevent
      AND map_id = areainfo.id
      AND map_id BETWEEN ? AND ?
    `;

    try {
      const items = await DB.all(query, [minLootValue, from, to]);
      return items ?? [];
    } catch (err) {
      logger.error(`Error getting loot: ${JSON.stringify(err)}`);
      return [];
    }
  },
  getAllRunsForDates: async (params: GetAllRunsForDatesParams): Promise<any[]> => {
    const {
      from,
      to,
      neededItemName,
      selectedMaps,
      selectedMods,
      minMapValue,
      iiq,
      iir,
      mapLevel,
      packSize,
      deaths,
    } = params;
    const query = `
      SELECT
        areainfo.*, mapruns.*,
        (mapruns.xp - (select xp from mapruns m where m.id < mapruns.id and xp is not null order by m.id desc limit 1)) xpgained,
        (SELECT COALESCE(SUM(value),0) FROM items WHERE items.event_id BETWEEN firstevent AND lastevent AND ignored = 0) gained,
        (select count(1) from events where event_type='slain' and events.id between firstevent and lastevent) deaths

      FROM areainfo, mapruns

      LEFT JOIN
            (
              SELECT count(items.id) AS items, mapruns.id AS run_id
              FROM items, mapruns
              WHERE items.event_id BETWEEN mapruns.firstevent AND mapruns.lastevent
              ${neededItemName ? 'AND items.typeline = ?' : ''}
              GROUP BY run_id
            ) as itemcount
            ON itemcount.run_id = mapruns.id

      WHERE mapruns.id = areainfo.id
      ${
        selectedMods.length > 0
          ? `AND (
          SELECT count(*) as has_mod
          FROM mapruns, mapmods
          WHERE mapruns.id = mapmods.area_id
          AND ( ${selectedMods.map(() => ` mapmods.mod LIKE ? `).join(' OR ')} )
          ) > 0 `
          : ''
      }
      ${
        selectedMaps.length > 0
          ? `AND areainfo.name IN (${'?,'.repeat(selectedMaps.length).slice(0, -1)}) `
          : ''
      }
      ${
        iiq
          ? `AND (mapruns.iiq BETWEEN ${iiq.min} AND ${iiq.max}${
              iiq.min < 1 ? ' OR mapruns.iiq IS NULL' : ''
            })`
          : ''
      }
      ${
        iir
          ? `AND (mapruns.iir BETWEEN ${iir.min} AND ${iir.max}${
              iir.min < 1 ? ' OR mapruns.iir IS NULL' : ''
            }) `
          : ''
      }
      ${
        packSize
          ? `AND (mapruns.packsize BETWEEN ${packSize.min} AND ${packSize.max}${
              packSize.min < 1 ? ' OR mapruns.packsize IS NULL' : ''
            }) `
          : ''
      }
      ${
        mapLevel
          ? `AND (areainfo.level BETWEEN ${mapLevel.min} AND ${mapLevel.max}${
              mapLevel.min < 1 ? ' OR areainfo.level IS NULL' : ''
            }) `
          : ''
      }
      ${deaths ? `AND deaths BETWEEN ${deaths.min} AND ${deaths.max} ` : ''}
      AND itemcount.items > 0
      AND json_extract(runinfo, '$.ignored') is null
      AND gained > ?
      AND mapruns.id BETWEEN ? AND ?
      ORDER BY mapruns.id desc
    `;

    try {
      const queryArgs: any[] = [];
      if (neededItemName) queryArgs.push(neededItemName);
      if (selectedMods.length > 0) queryArgs.push(...selectedMods);
      if (selectedMaps.length > 0) queryArgs.push(...selectedMaps);
      queryArgs.push(minMapValue);
      queryArgs.push(from);
      queryArgs.push(to);
      const runs = await DB.all(query, queryArgs);
      return runs ?? [];
    } catch (err) {
      logger.error(`Error getting maps for ${from}-${to}:`);
      logger.error(err);
      return [];
    }
  },
  getAllItemsForRuns: async ({
    runs,
    minLootValue = 0,
  }: {
    runs: Run[];
    minLootValue: number;
  }): Promise<any[]> => {
    const query = `
      SELECT mapruns.id AS map_id, areainfo.name AS area, items.*
      FROM items, mapruns, areainfo
      WHERE items.value > ?
      AND items.event_id BETWEEN mapruns.firstevent AND mapruns.lastevent
      AND map_id = areainfo.id
      AND mapruns.id IN (${runs.map((r) => r.id).join(',')})
    `;

    try {
      const items = await DB.all(query, [minLootValue]);
      return items ?? [];
    } catch (err) {
      logger.error(`Error getting loot: ${JSON.stringify(err)}`);
      return [];
    }
  },

  getAllMapNames: async (): Promise<string[]> => {
    const query = `
      SELECT DISTINCT areainfo.name
      FROM areainfo, mapruns
      WHERE mapruns.id = areainfo.id
      AND json_extract(runinfo, '$.ignored') is null
      ORDER BY areainfo.name asc
    `;

    try {
      const maps = (await DB.all(query)) as string[];
      logger.debug(`Got ${maps.length} map names`);
      return maps ?? [];
    } catch (err) {
      logger.error(`Error getting all map names: ${JSON.stringify(err)}`);
      return [];
    }
  },

  getAllPossibleMods: async (): Promise<string[]> => {
    const query = `
    SELECT DISTINCT(REGEXP_REPLACE(mod, '\\d+', '#')) AS mod
    FROM mapmods
    ORDER BY mod ASC`;

    try {
      const mods = (await DB.all(query)) as string[];
      logger.debug(`Got ${mods.length} mods`);
      return mods ?? [];
    } catch (err) {
      logger.error(`Error getting all mods: ${JSON.stringify(err)}`);
      return [];
    }
  },

  getProfitPerHour: async (
    beginningOfTracking = dayjs().subtract(1, 'day').format('YYYYMMDDHHmmss')
  ): Promise<number> => {
    const query = `
    SELECT 
    SUM(items.value) as total_profit,
    (
      SELECT SUM(
          STRFTIME(
            '%s',
            substr(mapruns.lastevent, 1, 4) || '-' || substr(mapruns.lastevent, 5, 2) || '-' || substr(mapruns.lastevent, 7, 2) || ' ' || substr(mapruns.lastevent, 9, 2) ||  ':' ||substr(mapruns.lastevent, 11, 2) || ':' || substr(mapruns.lastevent, 13, 2)
          )
        - 	STRFTIME(
            '%s',
            substr(mapruns.firstevent, 1, 4) || '-' || substr(mapruns.firstevent, 5, 2) || '-' || substr(mapruns.firstevent, 7, 2) || ' ' || substr(mapruns.firstevent, 9, 2) ||  ':' ||substr(mapruns.firstevent, 11, 2) || ':' || substr(mapruns.firstevent, 13, 2)
          )
      )
      FROM mapruns
      WHERE mapruns.id > ?
    ) AS total_time_seconds,
    COUNT(DISTINCT items.id) AS items,
    COUNT(DISTINCT mapruns.id) AS runs
    FROM  mapruns
      JOIN items
      ON items.event_id >= mapruns.firstevent
      AND items.event_id <= mapruns.lastevent
    WHERE mapruns.id > ?   
    `;

    try {
      const { total_time_seconds: totalTime, total_profit: profit } = (await DB.get(query, [
        beginningOfTracking,
        beginningOfTracking,
      ])) as {
        total_time_seconds: number;
        total_profit: number;
        runs: number;
        items: number;
      };
      const profitPerHour = totalTime > 0 ? (profit / totalTime) * 3600 : 0;
      return parseFloat(profitPerHour.toFixed(2)) ?? 0;
    } catch (err) {
      logger.error(`Error getting profit: ${JSON.stringify(err)}`);
      return 0;
    }
  },
};

export default stats;
