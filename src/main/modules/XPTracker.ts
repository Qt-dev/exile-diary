import logger from 'electron-log';
import Constants from '../../helpers/constants';
import DB from '../db';

let maxXP = false;

export function isMaxXP() {
  return maxXP;
}

export async function logXP(timestamp: string, currentXP: number) {
  if (maxXP) {
    return;
  }

  const previousXP = await getPreviousXP();
  if (previousXP !== currentXP) {
    logger.info(`XP update ${timestamp}: ${previousXP} -> ${currentXP}`);
    DB.run('insert into xp(timestamp, xp) values(?, ?)', [timestamp, currentXP]).catch((err) => {
      logger.info(`Error inserting xp (${currentXP} for ${timestamp}): ${err}`);
    });
  }
}

async function getPreviousXP() {
  try {
    const row = await DB.get('select xp from xp order by timestamp desc limit 1');
    if (!row) {
      return 0;
    }

    if (row.xp === Constants.MAX_XP) {
      logger.info(`Max XP ${row.xp} reached, XP will now be ignored`);
      maxXP = true;
    }

    return row.xp;
  } catch (err) {
    logger.info(`Error getting previous XP: ${err}`);
    return 0;
  }
}

export default {
  logXP,
  isMaxXP,
};
