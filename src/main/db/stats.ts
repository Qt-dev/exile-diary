import DB from './index';
import logger from 'electron-log';
import { Run } from '../../helpers/types';

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
      const maps = (await DB.all(query)) as Run[];
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
      const items = await DB.all(query);
      return items ?? [];
    } catch (err) {
      logger.error(`Error getting all loot: ${JSON.stringify(err)}`);
      return [];
    }
  },
};
