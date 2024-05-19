const logger = require('electron-log');
const Constants = require('../../helpers/constants').default;
const DB = require('../db').default;

var maxXP = false;

function isMaxXP() {
  return maxXP;
}

async function logXP(timestamp, currXP) {
  if (maxXP) {
    return;
  }
  var prevXP = await getPrevXP(DB);
  if (prevXP !== currXP) {
    logger.info(`XP update ${timestamp}: ${prevXP} -> ${currXP}`);
    DB.run('insert into xp(timestamp, xp) values(?, ?)', [timestamp, currXP])
      .catch((err) => {
        logger.info(`Error inserting xp (${currXP} for ${timestamp}): ${err}`);
      });
  }
}

function getPrevXP(DB) {
  return new Promise((resolve) => {
    DB.get('select xp from xp order by timestamp desc limit 1')
      .then((row) => {
        if (row) {
          if (row.xp === Constants.MAX_XP) {
            logger.info(`Max XP ${row.xp} reached, XP will now be ignored`);
            maxXP = true;
          }
          resolve(row.xp);
        } else {
          resolve(0);
        } 
      })
      .catch((err) => {
        logger.info(`Error getting previous XP: ${err}`);
        resolve(0);
      });
  });
}

module.exports.logXP = logXP;
module.exports.isMaxXP = isMaxXP;
