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
        area_info.name, run.*,
        (SELECT COALESCE(SUM(value),0) FROM item, event WHERE event.id = item.event_id AND DATETIME(event.timestamp) BETWEEN DATETIME(first_event) AND DATETIME(last_event) AND ignored = 0) gained,
        (SELECT count(1) FROM event WHERE conquerortimes.run_id = run.id AND event.id BETWEEN conquerortimes.start AND conquerortimes.end AND event.event_type = 'slain' ) AS conqueror_deaths,
        (SELECT count(1) FROM event WHERE json_extract(run.run_info, '$.mastermindBattle') IS NOT NULL AND event.id BETWEEN json_extract(run.run_info, '$.mastermindBattle.battle2start') AND min(json_extract(run.run_info, '$.mastermindBattle.completed'), run.last_event) AND event.event_type = 'slain' ) AS mastermind_deaths,
        (SELECT count(1) FROM event WHERE json_extract(run.run_info, '$.sirusBattle') IS NOT NULL AND event.id BETWEEN json_extract(run.run_info, '$.sirusBattle.start') AND min(json_extract(run.run_info, '$.sirusBattle.completed'), run.last_event) AND event.event_type = 'slain' ) AS sirus_deaths,
        (SELECT count(1) FROM event WHERE json_extract(run.run_info, '$.shaperBattle') IS NOT NULL AND event.id BETWEEN json_extract(run.run_info, '$.shaperBattle.phase1start') AND min(json_extract(run.run_info, '$.shaperBattle.completed'), run.last_event) AND event.event_type = 'slain' ) AS shaper_deaths,
        (SELECT count(1) FROM event WHERE json_extract(run.run_info, '$.maven.mavenDefeated') IS NOT NULL AND event.id BETWEEN json_extract(run.run_info, '$.maven.firstline') AND min(json_extract(run.run_info, '$.maven.mavenDefeated'), run.last_event) AND event.event_type = 'slain' ) AS maven_deaths,
        (SELECT count(1) FROM event WHERE json_extract(run.run_info, '$.oshabiBattle') IS NOT NULL AND event.id BETWEEN json_extract(run.run_info, '$.oshabiBattle.start') AND min(json_extract(run.run_info, '$.oshabiBattle.completed'), run.last_event) AND event.event_type = 'slain' ) AS oshabi_deaths,
        (SELECT count(1) FROM event WHERE json_extract(run.run_info, '$.venariusBattle') IS NOT NULL AND event.id BETWEEN json_extract(run.run_info, '$.venariusBattle.start') AND min(json_extract(run.run_info, '$.venariusBattle.completed'), run.last_event) AND event.event_type = 'slain' ) AS venarius_deaths

      FROM area_info, run
      LEFT JOIN
          (
            SELECT run.id AS run_id,
              min(event.id) AS start,
              max(event.id) AS end
            FROM event, run
            WHERE 
              DATETIME(event.timestamp) BETWEEN DATETIME(run.first_event)
              AND DATETIME(run.last_event)
              AND event.event_type = 'conqueror'
              AND json_extract(run.run_info, '$.conqueror') IS NOT NULL
            GROUP BY run.id
          ) as conquerortimes
        ON conquerortimes.run_id = run.id
      WHERE run.id = area_info.run_id
      AND json_extract(run_info, '$.ignored') is null
      ORDER BY run.id desc
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
      SELECT run.id AS map_id, area_info.name AS area, item.*
      FROM item, run, area_info, event
      WHERE event.id = item.event_id
      AND item.ignored = 0
      AND DATETIME(event.timestamp) BETWEEN DATETIME(run.first_event) AND DATETIME(run.last_event)
      AND run.id = area_info.run_id
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
      SELECT run.id, area_info.name AS area, item.*
      FROM item, run, area_info, event
      WHERE item.value > ?
      AND item.event_id = event.id
      AND item.ignored = 0
      AND DATETIME(event.timestamp) BETWEEN DATETIME(run.first_event) AND DATETIME(run.last_event)
      AND run.id = area_info.run_id
      AND DATETIME(run.first_event) BETWEEN DATETIME(?) AND DATETIME(?)
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
        area_info.*, run.*,
        (run.xp - (SELECT xp FROM run m WHERE m.id < run.id AND xp IS NOT null ORDER BY m.id desc LIMIT 1)) xpgained,
        (SELECT COALESCE(SUM(value),0) FROM item, event WHERE event.id = item.event_id AND DATETIME(event.timestamp) BETWEEN DATETIME(first_event) AND DATETIME(last_event) AND ignored = 0) gained,
        (SELECT count(1) FROM event WHERE event_type='slain' AND DATETIME(event.timestamp) BETWEEN DATETIME(first_event) AND DATETIME(last_event)) deaths

      FROM area_info, run

      LEFT JOIN
            (
              SELECT count(item.id) AS items, run.id AS run_id
              FROM item, run, event
              WHERE item.event_id = event.id
              AND DATETIME(event.timestamp) BETWEEN DATETIME(run.first_event) AND DATETIME(run.last_event)
              ${neededItemName ? 'AND item.typeline = ?' : ''}
              GROUP BY run_id
            ) as itemcount
            ON itemcount.run_id = run.id

      WHERE run.id = area_info.run_id
      ${
        selectedMods.length > 0
          ? `AND (
          SELECT count(*) as has_mod
          FROM mapmod
          WHERE run.id = mapmod.run_id
          AND ( ${selectedMods.map(() => ` mapmod.mod LIKE ? ESCAPE '^'`).join(' OR ')} )
          ) > 0 `
          : ''
      }
      ${
        selectedMaps.length > 0
          ? `AND area_info.name IN (${'?,'.repeat(selectedMaps.length).slice(0, -1)}) `
          : ''
      }
      ${
        iiq
          ? `AND (run.iiq BETWEEN ${iiq.min} AND ${iiq.max}${
              iiq.min < 1 ? ' OR run.iiq IS NULL' : ''
            })`
          : ''
      }
      ${
        iir
          ? `AND (run.iir BETWEEN ${iir.min} AND ${iir.max}${
              iir.min < 1 ? ' OR run.iir IS NULL' : ''
            }) `
          : ''
      }
      ${
        packSize
          ? `AND (run.pack_size BETWEEN ${packSize.min} AND ${packSize.max}${
              packSize.min < 1 ? ' OR run.pack_size IS NULL' : ''
            }) `
          : ''
      }
      ${
        mapLevel
          ? `AND (area_info.level BETWEEN ${mapLevel.min} AND ${mapLevel.max}${
              mapLevel.min < 1 ? ' OR area_info.level IS NULL' : ''
            }) `
          : ''
      }
      ${deaths ? `AND deaths BETWEEN ${deaths.min} AND ${deaths.max} ` : ''}
      AND itemcount.items > 0
      AND json_extract(run_info, '$.ignored') IS NULL
      AND gained > ?
      AND DATETIME(run.first_event) BETWEEN DATETIME(?) AND DATETIME(?)
      ORDER BY run.id desc
    `;

    logger.info(query);

    try {
      const queryArgs: any[] = [];
      if (neededItemName) queryArgs.push(neededItemName);
      if (selectedMods.length > 0)
        queryArgs.push(...selectedMods.map((mod) => mod.replace(/\%/g, '^%').replace(/#/g, '%')));
      if (selectedMaps.length > 0) queryArgs.push(...selectedMaps);
      queryArgs.push(minMapValue);
      queryArgs.push(from);
      queryArgs.push(to);
      logger.info(queryArgs);
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
      SELECT run.id AS map_id, area_info.name AS area, item.*
      FROM item, run, area_info, event
      WHERE item.value > ?
      AND item.event_id = event.id
      AND item.ignored = 0
      AND DATETIME(event.timestamp) BETWEEN DATETIME(run.first_event) AND DATETIME(run.last_event)
      AND map_id = area_info.run_id
      AND run.id IN (${runs.map((r) => r.id).join(',')})
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
      SELECT DISTINCT area_info.name
      FROM area_info, run
      WHERE run.id = area_info.run_id
      AND json_extract(run_info, '$.ignored') is null
      ORDER BY area_info.name asc
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
    FROM mapmod
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
    beginningOfTracking = dayjs().subtract(1, 'day').toISOString()
  ): Promise<number> => {
    const query = `
    SELECT 
    SUM(item.value) as total_profit,
    (
      SELECT SUM(JULIANDAY(run.last_event) - JULIANDAY(run.first_event)) * 24 * 60 * 60
      FROM run
      WHERE run.first_event > ?
    ) AS total_time_seconds,
    COUNT(DISTINCT item.id) AS items,
    COUNT(DISTINCT run.id) AS runs
    FROM  run
      JOIN item, event
      ON item.event_id = event.id
      AND DATETIME(event.timestamp) BETWEEN DATETIME(run.first_event) AND DATETIME(run.last_event)
    WHERE run.first_event > ?
    AND item.ignored = 0
    `;

    logger.debug(`Getting profit per hour since ${beginningOfTracking}`);

    try {
      const {
        total_time_seconds: totalTime,
        total_profit: profit,
        runs,
        items,
      } = (await DB.get(query, [beginningOfTracking, beginningOfTracking])) as {
        total_time_seconds: number;
        total_profit: number;
        runs: number;
        items: number;
      };
      logger.debug(
        `Total profit: ${profit}, Total time: ${totalTime} seconds for ${runs} runs and ${items} items`
      );
      const profitPerHour = totalTime > 0 ? (profit / totalTime) * 3600 : 0;
      return parseFloat(profitPerHour.toFixed(2)) ?? 0;
    } catch (err) {
      logger.error(`Error getting profit: ${JSON.stringify(err)}`);
      return 0;
    }
  },
};

export default stats;
