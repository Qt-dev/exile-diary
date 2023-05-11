import DB from '../db/skilltree';
import API from '../GGGAPI'
import logger from 'electron-log';
import EventEmitter from 'events';
const emitter = new EventEmitter();

// class SkillTreeWatcher {
//   constructor() {
//     DB = require('./DB').getDB();
//     settings = require('./settings').get();

//     var league = encodeURIComponent(settings.activeProfile.league);
//     var accountName = encodeURIComponent(settings.accountName);
//     var characterName = encodeURIComponent(settings.activeProfile.characterName);

//     this.queryPath = `/character-window/get-passive-skills?league=${league}&accountName=${accountName}&character=${characterName}`;

//     logger.info(`Skill tree watcher started with query path ${this.queryPath}`);
//   }

//   async checkPassiveTree(timestamp) {
//     const previousTree = await this.getPrevTree();
//     return true;
//     // var prevTree = await this.getPrevTree();
//     // var requestParams = require('./Utils').getRequestParams(this.queryPath, settings.poesessid);

//     // return new Promise((resolve, reject) => {
//     //   var request = https.request(requestParams, (response) => {
//     //     var body = '';
//     //     response.setEncoding('utf8');
//     //     response.on('data', (chunk) => {
//     //       body += chunk;
//     //     });
//     //     response.on('end', () => {
//     //       try {
//     //         var data = JSON.parse(body);
//     //         if (data.error && data.error.message === 'Forbidden') {
//     //           emitter.emit('invalidSessionID');
//     //           resolve({});
//     //         } else {
//     //           let currTree = JSON.stringify(data.hashes);
//     //           if (currTree !== prevTree) {
//     //             logger.info(`prevtree: ${prevTree}`);
//     //             logger.info(`currtree: ${currTree}`);
//     //             this.insertPassiveTree(timestamp, currTree);
//     //           }
//     //         }
//     //       } catch (err) {
//     //         logger.info(`Failed to get current skill tree: ${err}`);
//     //         resolve({});
//     //       }
//     //     });
//     //     response.on('error', (err) => {
//     //       logger.info(`Failed to get current skill tree: ${err}`);
//     //       resolve({});
//     //     });
//     //   });
//     //   request.on('error', (err) => {
//     //     logger.info(`Failed to get current skill tree: ${err}`);
//     //     resolve({});
//     //   });
//     //   request.end();
//     // });
//   }

//   async getPrevTree() {
//     return DB.;
//   }

//   insertPassiveTree(timestamp, data) {
//     DB.run('insert into passives(timestamp, data) values(?, ?)', [timestamp, data], (err) => {
//       if (err) {
//         logger.info(`Unable to insert current passive tree: ${err}`);
//       } else {
//         logger.info(`Updated current passive tree at ${timestamp} (length: ${data.length})`);
//       }
//     });
//   }
// }


const SkillTreeWatcher = {
  insertPassiveTree: DB.insertPassiveTree,
  getPreviousTree: DB.getPreviousTree,
  getSkillTree: API.getSkillTree,
  saveNewTree: async (timestamp) => {
    logger.info(`Checking for new skill tree at ${timestamp}`);
    const previousTree = await SkillTreeWatcher.getPreviousTree();
    const newTree = JSON.stringify(await SkillTreeWatcher.getSkillTree(timestamp).hashes);

    if (previousTree && newTreee && newTree !== previousTree) {
      logger.info(`New skill tree found at ${timestamp}`);
      logger.info(`Previous Skill Tree: ${previousTree}`);
      logger.info(`New Skill Tree: ${newTree}`);
      SkillTreeWatcher.insertPassiveTree(timestamp, newTree);
    }
  }
}

module.exports = SkillTreeWatcher;
module.exports.emitter = emitter;
