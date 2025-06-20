const Tail = require('nodejs-tail');
const logger = require('electron-log');
const EventEmitter = require('events');
const InventoryGetter = require('./InventoryGetter');
const ItemParser = require('./ItemParser');
const RunParser = require('./RunParser').default;
const SkillTreeWatcher = require('./SkillTreeWatcher');
const Utils = require('./Utils').default;
const Constants = require('../../helpers/constants').default;
const SettingsManager = require('../SettingsManager').default;
const DB = require('../db').default;

var tail;
var inv;
var tree;
var emitter = new EventEmitter();

var lastInstanceServer = null;
var instanceServerFound = false;
let currentInstance = null;
const instanceServerRegex = /((?:[0-9]{1,3}\.){3}[0-9]{1,3}:\d{1,5})/;

function start() {
  const settings = SettingsManager.getAll();

  if (tail) {
    try {
      tail.close();
    } catch (err) {
      logger.error(err);
    }
  }

  if (settings.clientTxt) {
    checkValidLogfile(settings.clientTxt);

    logger.info(`Watching ${settings.clientTxt}`);

    tail = new Tail(`${settings.clientTxt}`, { usePolling: true, disableGlobbing: true });
    inv = new InventoryGetter();
    tree = SkillTreeWatcher;

    tail.on('line', (line) => {
      if (process.platform === 'linux') {
        // Remove carriage return
        // NOTE: PoE run on wine, the client.txt file has Windows carriage return
        //       This cause an error when trying to execute the regexp on the line
        line = JSON.stringify(line).replace(/(\\r\\n|\\n|\\r)/, '');
        line = JSON.parse(line);
      }

      // set afk flag to avoid unnecessary net worth checking
      if (line.includes('] : AFK mode is now ON. Autoreply')) {
        logger.info('Setting AFK mode to ON');
        global.afk = true;
        return;
      } else {
        if (global.afk) {
          logger.info('Setting AFK mode to OFF');
        }
        global.afk = false;
      }

      if (
        line
          .toLowerCase()
          .endsWith(`] @to ${settings.activeProfile.characterName.toLowerCase()}: end`) ||
        line.toLowerCase().endsWith(`] ${settings.activeProfile.characterName.toLowerCase()}: end`)
      ) {
        logger.info('Detected map end signal, processing last map run');
        try {
          RunParser.tryProcess();
        } catch (err) {
          logger.error(`Error processing last map run: ${err}`);
        }
      } else if (line.includes('Generating')) {
        // 2023/09/22 23:53:40 90163078 1186a0e2 [DEBUG Client 5808] Generating level 83 area "MapWorldsIvoryTemple" with seed 2066513710
        const timestamp = line.substring(0, 19).replace(/[^0-9]/g, '');
        const level = line.substring(line.indexOf('level') + 6, line.indexOf('area') - 1);
        const seed = line.substring(line.indexOf('seed') + 5);
        emitter.emit('generatedMap', { timestamp, level, seed });
      } else if (line.includes('Connecting to instance server at')) {
        lastInstanceServer = instanceServerRegex.exec(line)[0];
        logger.info('Instance server found: ' + lastInstanceServer);
        // if two consecutive instance server lines occur without a "you have entered" line,
        // prompt to turn on local chat
        if (instanceServerFound) {
          emitter.emit('localChatDisabled');
        } else {
          instanceServerFound = true;
        }
      } else {
        var timestamp = line.substring(0, 19).replace(/[^0-9]/g, '');
        var event = getEvent(line);
        if (event) {
          try {
            insertEvent(event, timestamp);
            if (event.type === 'entered') {
              // corresponding "you have entered" line found for instance server; clear flag
              instanceServerFound = false;
              if (!Utils.isTown(event.text)) {
                logger.info(`Entered map area ${event.text}, will try processing previous area`);
                currentInstance = event.text;
                emitter.emit('enteredMap', event.text);
                RunParser.tryProcess({
                  event: { timestamp: timestamp, area: event.text, server: event.instanceServer },
                  mode: 'automatic',
                });
              }
              tree.saveNewTree(timestamp);
              inv.getInventoryDiffs(timestamp).then(async (diff) => {
                if (diff && Object.keys(diff).length > 0) {
                  await ItemParser.insertItems(diff, timestamp);
                }
              });
            }
          } catch (e) {
            logger.error(`Error processing event: ${e}`);
          }
        }
      }
    });
    tail.on('error', (error) => {
      logger.error(`Error reading client.txt: ${error}`);
    });
    tail.watch();
  }
}

async function checkValidLogfile(path) {
  let poeRunning = await Utils.poeRunning();

  require('fs').stat(path, (err, stats) => {
    if (err) {
      logger.info(`Error checking Client.txt last update time`);
      emitter.emit('clientTxtFileError', path);
    } else {
      let timeSinceLastUpdate = Date.now() - stats.mtime;
      logger.info(`Client.txt last updated: ${stats.mtime}`);
      if (poeRunning && timeSinceLastUpdate > 24 * 60 * 60 * 1000) {
        emitter.emit('clientTxtNotUpdated', path);
      }
    }
  });
}

function insertEvent(event, timestamp) {
  DB.run('insert into events(id, event_type, event_text, server) values(?, ?, ?, ?)', [
    timestamp,
    event.type,
    event.text,
    event.instanceServer,
  ])
    .then(() => {
      if (event.type !== 'chat' && event.type !== 'note') {
        logger.info(
          `Inserted event ${timestamp} -> ${event.type} ${event.text} ${event.instanceServer || ''}`
        );
      }
    })
    .catch((err) => {
      logger.error(
        `Error inserting event ${timestamp} -> ${event.type} ${event.text} ${
          event.instanceServer || ''
        }  : ${err}`
      );
    });
}

function getEvent(arg) {
  const settings = SettingsManager.getAll();
  var str = arg.substring(arg.indexOf('] ') + 2);

  var masterString = hasMaster(str);
  if (masterString) {
    return {
      type: 'master',
      text: masterString.trim(),
      instanceServer: '',
    };
  }

  var conquerorString = hasConqueror(str);
  if (conquerorString) {
    return {
      type: 'conqueror',
      text: conquerorString.trim(),
    };
  }

  var npcString = hasNPC(str);
  if (npcString) {
    return {
      type: 'leagueNPC',
      text: npcString.trim(),
    };
  }

  var mapBossString = hasMapBoss(str);
  if (mapBossString) {
    return {
      type: 'mapBoss',
      text: mapBossString.trim(),
    };
  }

  if (str.startsWith('Abnormal disconnect')) {
    return {
      type: 'abnormalDisconnect',
      text: str.substr(str.indexOf(': ') + 2),
    };
  }

  if (str.startsWith('Successfully allocated')) {
    return {
      type: 'allocated',
      text: `${str.substring(str.indexOf('id:') + 4, str.indexOf('name:') - 2)} (${str.substring(
        str.indexOf('name:') + 6
      )})`,
    };
  }
  if (str.startsWith('Successfully unallocated')) {
    return {
      type: 'unallocated',
      text: `${str.substring(str.indexOf('id:') + 4, str.indexOf('name:') - 2)} (${str.substring(
        str.indexOf('name:') + 6
      )})`,
    };
  }

  if (str.startsWith(':')) {
    if (str.includes('You have entered')) {
      var area = str.substring(str.indexOf('You have entered') + 17);
      return {
        type: 'entered',
        text: area.substring(0, area.length - 1),
        instanceServer: lastInstanceServer,
      };
    } else if (
      str.includes(`${settings.activeProfile.characterName} has been slain`) ||
      str.includes(`${settings.activeProfile.characterName} has committed suicide`)
    ) {
      return {
        type: 'slain',
      };
    } else if (str.includes('is now level')) {
      return {
        type: 'level',
        text: Number.parseInt(str.substring(str.indexOf('is now level') + 12)),
      };
    } else if (str.includes('Mission Complete')) {
      return {
        type: 'favourGained',
        text: str.replace(/[^0-9]/g, ''),
      };
    } else {
      let text = str.substring(2).trim();
      if (Constants.shrineQuotes[text] || Constants.darkshrineQuotes.includes(text)) {
        return {
          type: 'shrine',
          text: text,
        };
      }
    }
  } else if (str.startsWith('@') && (str.includes('@From') || str.includes('@To'))) {
    var fromString = `@from ${settings.activeProfile.characterName.toLowerCase()}:`;
    if (str.toLowerCase().indexOf(fromString) > -1) {
      var msg = str.substring(str.toLowerCase().indexOf(fromString) + fromString.length).trim();
      if (msg === 'end') {
        return;
      } else {
        return {
          type: 'note',
          text: msg,
        };
      }
    }
    if (str.toLowerCase().includes(`@to ${settings.activeProfile.characterName.toLowerCase()}`)) {
      return;
    }
    return {
      type: 'chat',
      text: str.substring(str.indexOf('@')).trim(),
    };
  }
}

function hasMaster(str) {
  let npc = str.substr(0, str.indexOf(':')).trim();
  if (Constants.masters.includes(npc)) {
    return str;
  }
  // 3.8.0: Jun sometimes does not talk at all during missions; scan for Syndicate member lines instead
  if (Constants.syndicateMembers.includes(npc)) {
    return `Jun, Veiled Master: [${str}]`;
  }
  return null;
}

function hasConqueror(str) {
  let npc = str.substr(0, str.indexOf(':')).trim();
  return Constants.conquerors.includes(npc) ? str : null;
}

function hasNPC(str) {
  let npc = str.substr(0, str.indexOf(':')).trim();
  return Constants.leagueNPCs.includes(npc) ? str : null;
}

function hasMapBoss(str) {
  let npc = str.substr(0, str.indexOf(':')).trim();
  return Constants.mapBosses.includes(npc) ? str : null;
}

async function getOldNPCEvents() {
  const settings = SettingsManager.getAll();

  var fs = require('fs');
  var readline = require('readline');

  var bounds = await DB.get('select min(id) as minId, max(id) as maxId from events');

  logger.info(`Adding events in ${JSON.stringify(bounds)}`);

  var rl = readline.createInterface({
    input: fs.createReadStream(settings.clientTxt),
    terminal: false,
  });

  rl.on('line', function (line) {
    var timestamp = line.substring(0, 19).replace(/[^0-9]/g, '');
    if (timestamp < bounds.minId || timestamp > bounds.maxId) return;

    var str = line.substring(line.indexOf('] ') + 2);
    var npcString = hasNPC(str);
    if (npcString) {
      DB.run('insert into events(id, event_type, event_text, server) values(?, ?, ?, ?)', [
        timestamp,
        'leagueNPC',
        npcString.trim(),
        '',
      ])
        .then(() => {
          logger.info(`Inserted league NPC event ${timestamp} -> ${npcString}`);
        })
        .catch((err) => {
          if (!err.message.includes('UNIQUE constraint failed')) {
            logger.info('Failed to insert event: ' + err.message);
          }
        });
      return;
    }

    if (hasConqueror(str)) {
      DB.run('insert into events(id, event_type, event_text, server) values(?, ?, ?, ?)', [
        timestamp,
        'conqueror',
        str.trim(),
        '',
      ])
        .then(() => {
          logger.info(`Inserted conqueror event ${timestamp} -> ${str}`);
        })
        .catch((err) => {
          if (!err.message.includes('UNIQUE constraint failed')) {
            logger.info('Failed to insert event: ' + err.message);
          }
        });
      return;
    }

    if (str.startsWith(':')) {
      str = str.substring(2).trim();
      if (Constants.shrineQuotes[str] || Constants.darkshrineQuotes.includes(str)) {
        DB.run('insert into events(id, event_type, event_text, server) values(?, ?, ?, ?)', [
          timestamp,
          'shrine',
          str,
          '',
        ])
          .then(() => {
            logger.info(`Inserted master event ${timestamp} -> ${str}`);
          })
          .catch((err) => {
            if (!err.message.includes('UNIQUE constraint failed')) {
              logger.info('Failed to insert event: ' + err.message);
            }
          });
      }
    }
  });
}

module.exports.start = start;
module.exports.getOldNPCEvents = getOldNPCEvents;
module.exports.emitter = emitter;
module.exports.currentInstance = currentInstance;
module.exports.checkValidLogfile = checkValidLogfile;
