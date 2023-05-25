import DB from './index';
import logger from 'electron-log';
import { Run } from '../../helpers/types';

export default {
  getAllRuns: async (league: string) : Promise<Run[] | null> => {
    logger.info('Getting all maps');
    const query = `
      select areainfo.name, mapruns.* 
      from areainfo, mapruns ${league ? ', leaguedates' : ''}
      where mapruns.id = areainfo.id
      and json_extract(runinfo, '$.ignored') is null
      ${league ? ` and leaguedates.league = '${league}' ` : ''}
      ${league ? ' and mapruns.id between leaguedates.start and leaguedates.end ' : ''}
      order by mapruns.id desc
    `;

    try {
      const maps = await DB.all(query) as Run[];
      return maps;
    } catch (err) {
      logger.error(`Error getting all maps: ${JSON.stringify(err)}`);
      return null;
    }
  }
};