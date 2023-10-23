import DB from './index';
import Logger from 'electron-log';
import { Run } from '../../helpers/types';
const logger = Logger.scope('db/stats');

export default {
  getAllRuns: async (league: string): Promise<Run[]> => {
    logger.info('Getting all maps');
    const query = `
      SELECT
        areainfo.name, mapruns.*,	(SELECT count(1) FROM events WHERE conquerortimes.run_id = mapruns.id AND events.id BETWEEN conquerortimes.start AND conquerortimes.end AND events.event_type = 'slain' ) AS conqueror_deaths,
        (SELECT count(1) FROM events WHERE json_extract(mapruns.runinfo, '$.mastermindBattle') IS NOT NULL AND events.id BETWEEN json_extract(mapruns.runinfo, '$.mastermindBattle.battle2start') AND min(json_extract(mapruns.runinfo, '$.mastermindBattle.completed'), mapruns.lastevent) AND events.event_type = 'slain' ) AS mastermind_deaths,
        (SELECT count(1) FROM events WHERE json_extract(mapruns.runinfo, '$.sirusBattle') IS NOT NULL AND events.id BETWEEN json_extract(mapruns.runinfo, '$.sirusBattle.start') AND min(json_extract(mapruns.runinfo, '$.sirusBattle.completed'), mapruns.lastevent) AND events.event_type = 'slain' ) AS sirus_deaths,
        (SELECT count(1) FROM events WHERE json_extract(mapruns.runinfo, '$.shaperBattle') IS NOT NULL AND events.id BETWEEN json_extract(mapruns.runinfo, '$.shaperBattle.phase1start') AND min(json_extract(mapruns.runinfo, '$.shaperBattle.completed'), mapruns.lastevent) AND events.event_type = 'slain' ) AS shaper_deaths,
        (SELECT count(1) FROM events WHERE json_extract(mapruns.runinfo, '$.maven.mavenDefeated') IS NOT NULL AND events.id BETWEEN json_extract(mapruns.runinfo, '$.maven.firstline') AND min(json_extract(mapruns.runinfo, '$.maven.mavenDefeated'), mapruns.lastevent) AND events.event_type = 'slain' ) AS maven_deaths,
        (SELECT count(1) FROM events WHERE json_extract(mapruns.runinfo, '$.oshabiBattle') IS NOT NULL AND events.id BETWEEN json_extract(mapruns.runinfo, '$.oshabiBattle.start') AND min(json_extract(mapruns.runinfo, '$.oshabiBattle.completed'), mapruns.lastevent) AND events.event_type = 'slain' ) AS oshabi_deaths,
        (SELECT count(1) FROM events WHERE json_extract(mapruns.runinfo, '$.venariusBattle') IS NOT NULL AND events.id BETWEEN json_extract(mapruns.runinfo, '$.venariusBattle.start') AND min(json_extract(mapruns.runinfo, '$.venariusBattle.completed'), mapruns.lastevent) AND events.event_type = 'slain' ) AS venarius_deaths

      FROM areainfo, mapruns ${league ? ', leaguedates' : ''}
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
      ${league ? ` AND leaguedates.league = '${league}' ` : ''}
      ${league ? ' AND mapruns.id BETWEEN leaguedates.start AND leaguedates.end ' : ''}
      ORDER BY mapruns.id desc
    `;

    try {
      const maps = (DB.all(query)) as Run[];
      return maps;
    } catch (err) {
      logger.error(`Error getting all maps: ${JSON.stringify(err)}`);
      return [];
    }
  },
  getAllItems: async (league: string): Promise<any[]> => {
    const query = `
      SELECT leaguedates.league, mapruns.id AS map_id, areainfo.name AS area, items.*
      FROM items, mapruns, areainfo, leaguedates
      WHERE items.value > 10 
      AND items.event_id BETWEEN mapruns.firstevent AND mapruns.lastevent
      AND mapruns.id = areainfo.id
      ${league ? ` AND leaguedates.league = '${league}' ` : ''}
      AND map_id BETWEEN leaguedates.start AND leaguedates.end
    `;

    try {
      const items = DB.all(query);
      return items ?? [];
    } catch (err) {
      logger.error(`Error getting all loot: ${JSON.stringify(err)}`);
      return [];
    }
  },
  getAllItemsForDates: async (from: string, to: string, minLootValue: number = 0): Promise<any[]> => {
    const query = `
      SELECT mapruns.id AS map_id, areainfo.name AS area, items.*
      FROM items, mapruns, areainfo, leaguedates
      WHERE items.value > ?
      AND items.event_id BETWEEN mapruns.firstevent AND mapruns.lastevent
      AND map_id = areainfo.id
      AND map_id BETWEEN ? AND ?
    `;

    try {
      const items = DB.all(query, [ minLootValue, from, to ]);
      return items ?? [];
    } catch (err) {
      logger.error(`Error getting loot: ${JSON.stringify(err)}`);
      return [];
    }
  },
  getAllRunsForDates: async ({from, to, neededItemName, selectedMaps, minMapValue}: {from: string, to: string, neededItemName: string, selectedMaps: string[], minMapValue: number}): Promise<any[]> => {
    const query = `
      SELECT
        areainfo.*, mapruns.*,
        (mapruns.xp - (select xp from mapruns m where m.id < mapruns.id and xp is not null order by m.id desc limit 1)) xpgained,
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
      ${selectedMaps.length > 0 ? ` AND areainfo.name IN (${selectedMaps.map(m => `'${m}'`).join(',')}) ` : ''}
      AND itemcount.items > 0
      AND json_extract(runinfo, '$.ignored') is null
      AND mapruns.gained > ?
      AND mapruns.id BETWEEN ? AND ?
      ORDER BY mapruns.id desc
    `;

    try {
      const queryArgs : any[] = [];
      if(neededItemName) queryArgs.push(neededItemName);
      queryArgs.push(minMapValue);
      queryArgs.push(from);
      queryArgs.push(to);
      const runs = DB.all(query, queryArgs);
      return runs ?? [];
    } catch (err) {
      logger.error(`Error getting maps for ${from}-${to}:`);
      logger.error(err);
      return [];
    }
  },
  getAllItemsForRuns: async ({ runs, minLootValue = 0 } : { runs: Run[], minLootValue: number }): Promise<any[]> => {
    const query = `
      SELECT mapruns.id AS map_id, areainfo.name AS area, items.*
      FROM items, mapruns, areainfo
      WHERE items.value > ?
      AND items.event_id BETWEEN mapruns.firstevent AND mapruns.lastevent
      AND map_id = areainfo.id
      AND mapruns.id IN (${runs.map(r => r.id).join(',')})
    `;

    try {
      const items = DB.all(query, [ minLootValue ]);
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
      const maps = DB.all(query) as string[];
      logger.info(`Got ${maps.length} map names`);
      return maps ?? [];
    } catch (err) {
      logger.error(`Error getting all map names: ${JSON.stringify(err)}`);
      return [];
    }
  },
};
