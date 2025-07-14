const Tail = require('tail').Tail;
const logger = require('electron-log');
const EventEmitter = require('events');
const InventoryGetter = require('./InventoryGetter');
const ItemParser = require('./ItemParser');
const RunParser = require('./RunParser').default;
const SkillTreeWatcher = require('./SkillTreeWatcher');
const dayjs = require('dayjs');
const Utils = require('./Utils').default;
const Constants = require('../../helpers/constants').default;
const SettingsManager = require('../SettingsManager').default;
const RunDB = require('../db/run').default;
const fs = require('fs').promises;

let tail;
let inv;
let tree;
let emitter = new EventEmitter();

let lastInstanceServer = null;
let instanceServerFound = false;

// Line Parsing Regular Expressions
const instanceServerRegex = /Connecting to instance server.*\s((?:[0-9]{1,3}\.){3}[0-9]{1,3}:\d{1,5})/;
const generationRegex = /(?<timestamp>.{19}).*level\s(?<level>\d+)\sarea\s"(?<areaId>\S+)".*seed\s(?<seed>\d+)/;
const lineParseRegex = /^(?<timestamp>.{19}).*]\s(?<line>.*)$/;
const allocationRegex = /Successfully (?<verb>(allocated|unallocated)).*id:\s(?<id>.*),.*name:\s(?<name>.*)$/
const enteredRegex = /You have entered (?<area>.*)\.$/;
const levelUpRegex = /is now level (?<level>\d+)/;
const chatRegex = /(?<verb>To|From)\s(\<.*\>)\s(?<character>.*):\s(?<text>.*)/;

function start() {
  const settings = SettingsManager.getAll();

  if (tail) {
    try {
      tail.unwatch();
    } catch (err) {
      logger.error('Error resetting tail watcher:');
      logger.error(err);
    }
  }

  if (settings.clientTxt) {
    checkValidLogfile(settings.clientTxt);

    const tailOptions = {
      fromBeginning: false,
      follow: true,
      useWatchFile: true,
      fsWatchOptions: {
        persistent: true,
        interval: 500,
      },
    };
    logger.info(`Watching ${settings.clientTxt}`, tailOptions);

    tail = new Tail(`${settings.clientTxt}`, tailOptions);
    inv = new InventoryGetter();
    tree = SkillTreeWatcher;

    tail.on('line', (line) => {
      // logger.debug(`Client.txt line: ${line}`);
      const lowerCaseLine = line.toLowerCase();

      const stringPatterns = {
        end: [
          `] @to ${settings.activeProfile.characterName.toLowerCase()}: end`,
          `] ${settings.activeProfile.characterName.toLowerCase()}: end`,
        ],
        generating: [
          'generating'
        ],
      }

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

      if (stringPatterns.end.some(pattern => lowerCaseLine.endsWith(pattern))) { // Check for end map signal
        logger.info('Detected chat map end signal in client log, processing last map run');
        try {
          RunParser.tryProcess();
        } catch (err) {
          logger.error(`Error processing last map run: ${err}`);
        }
      } else if (stringPatterns.generating.some(pattern => lowerCaseLine.includes(pattern))) { // Check for area generation
        // 2023/09/22 23:53:40 90163078 1186a0e2 [DEBUG Client 5808] Generating level 83 area "MapWorldsIvoryTemple" with seed 2066513710
        const match = generationRegex.exec(line);
        if (!match) {
          logger.error(`Failed to parse map generation line: ${line}`);
          return;
        }
        // Extract timestamp, level, areaId, and seed from the line
        const { timestamp, level, areaId, seed } = match.groups;
        logger.info(`Detected map generation: ${timestamp}, level: ${level}, areaId: ${areaId}, seed: ${seed}`);
        // Emit the generatedMap event with the extracted data
        emitter.emit('client-logs:generated-map', {
          timestamp: timestamp.replace(/[^0-9]/g, ''), // Clean timestamp to only contain digits
          level: level,
          areaId: areaId,
          seed: seed,
        });
      } else if (line.includes('Connecting to instance server at')) { // Check for disabled local chat using the instance server pattern
        lastInstanceServer = instanceServerRegex.exec(line)[1];
        logger.info('Instance server found: ' + lastInstanceServer);
        // if two consecutive instance server lines occur without a "you have entered" line,
        // prompt to turn on local chat
        if (instanceServerFound) {
          emitter.emit('client-logs:error:local-chat-disabled');
        } else {
          instanceServerFound = true;
        }
      } else {
        const match = lineParseRegex.exec(line);
        if (!match) {
          logger.error(`Failed to parse line: ${line}`);
          return;
        }
        // Extract timestamp and line content from the match
        const { timestamp: originalTimestamp, line: content } = match.groups;
        const timestamp = dayjs(originalTimestamp, 'YYYY/MM/DD HH:mm:ss').toISOString(); 

        // logger.debug(`Parsed line: ${timestamp} - ${content}`);
        const event = getEvent(content);

        if (event) {
          try {
            // Save the event to the database
            RunDB.insertEvent({timestamp, event_type: event.type, event_text: event.text, server: event.instanceServer});

            // If we just entered a new map area, try to process the previous area
            if (event.type === 'entered') {
              logger.debug('Entered new map area: ' + event.text);

              // Reset the instance server found flag for Local Chat check
              instanceServerFound = false;
              if (!Utils.isTown(event.text)) {
                logger.info(`Entered map area ${event.text}, will try processing previous area`);
                emitter.emit('enteredMap', {
                  area: event.text,
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

  try {
    const stats = await fs.stat(path);
    let timeSinceLastUpdate = Date.now() - stats.mtime;
    logger.info(`Client.txt last updated: ${stats.mtime}`);
    if (poeRunning && timeSinceLastUpdate > 24 * 60 * 60 * 1000) {
      logger.warn(`Client.txt file is older than 24 hours, please check if PoE is running.`);
      emitter.emit('clientTxtNotUpdated', path);
    }
  } catch (err) {
    logger.error(`Client.txt file not found at ${path}`);
    emitter.emit('clientTxtFileError', path);
    return;
  }
}

// Get the event data from the content of a line in client.txt
function getEvent(content) {
  const settings = SettingsManager.getAll();
  // logger.debug(`Getting event for content: ${content}`);

  const masterString = parseMaster(content);
  if (masterString) {
    return {
      type: 'master',
      text: masterString,
      instanceServer: '',
    };
  }

  const conquerorString = parseConqueror(content);
  if (conquerorString) {
    return {
      type: 'conqueror',
      text: conquerorString,
    };
  }

  const npcString = parseNPC(content);
  if (npcString) {
    return {
      type: 'leagueNPC',
      text: npcString,
    };
  }

  const mapBossString = parseMapBoss(content);
  if (mapBossString) {
    return {
      type: 'mapBoss',
      text: mapBossString,
    };
  }

  if (content.startsWith('Abnormal disconnect')) {
    return {
      type: 'abnormalDisconnect',
      text: content.substr(content.indexOf(': ') + 2), // Get the error text from after the colon
    };
  }

  // exec allocationRegex to check for allocation or unallocation messages
  const allocationMatch = allocationRegex.exec(content);
  if (allocationMatch) {
    const { verb, id, name } = allocationMatch.groups;
    return {
      type: verb,
      text: `${id.trim()} (${name.trim()})`,
    };
  }

  if (content.startsWith(':')) {
    logger.debug(`Processing line starting with ':': ${content}`);
    if (content.includes('You have entered')) {
      logger.debug(`Processing 'You have entered' line: ${content}`);
      const match = enteredRegex.exec(content);
      if (!match) {
        logger.error(`Failed to parse 'You have entered' line: ${content}`);
        return;
      }
      // Extract the area name from the match
      const areaName = match.groups.area.trim();
      logger.debug(`Entered area: ${areaName}`);

      return {
        type: 'entered',
        text: areaName,
        instanceServer: lastInstanceServer,
      };
    } else if (
      content.includes(`${settings.activeProfile.characterName} has been slain`) ||
      content.includes(`${settings.activeProfile.characterName} has committed suicide`)
    ) {
      return {
        type: 'slain',
      };
    } else if (content.includes('is now level')) {
      const match = levelUpRegex.exec(content);
      if (!match) {
        logger.error(`Failed to parse 'is now level' line: ${content}`);
        return;
      }
      return {
        type: 'level',
        text: Number.parseInt(match.groups.level),
      };
    } else {
      const cleanContent = content.substring(2).trim();
      if (Constants.shrineQuotes[cleanContent] || Constants.darkshrineQuotes.includes(cleanContent)) {
        return {
          type: 'shrine',
          text: cleanContent,
        };
      }
    }
  } else if (content.startsWith('@') && (content.includes('@From') || content.includes('@To'))) {
    const characterName = settings.activeProfile.characterName;
    // If the chat is from the active character, save it as a note as long as it is not 'end'.

    const match = chatRegex.exec(content);
    if (match) {
      const { verb, character, text } = match.groups;
      if (verb === 'From' && character === characterName) {
        // If the chat is to the active character, return it as a note
        if (text === 'end') {
          return;
        } else {
          return {
            type: 'note',
            text: text.trim(),
          };
        }
      }

      if( verb === 'To' && character === characterName) {
        // If the chat is to the active character, we don't care about it
        return;
      }

      return {
        type: 'chat',
        text: `@${verb} ${character}: ${text.trim()}`,
      };
    }
  }
}

// Parse Spectific NPC lines from the content
function parseMaster(content) {
  const mastersRegex = new RegExp(
    `(?<text>(${Constants.masters.join('|')}):.*)$`,
    'i');
    
  const match = mastersRegex.exec(content); 
  if (match) {
    return match.groups.text.trim();
  }

  // 3.8.0: Jun sometimes does not talk at all during missions; scan for Syndicate member lines instead
  const junRegex = new RegExp(
    `(?<master>${Constants.syndicateMembers.join('|')}): (?<text>.*)$`,
    'i');
  
  const junMatch = junRegex.exec(content);
  if (junMatch) {
    return `Jun, Veiled Master: ${junMatch.groups.text.trim()}`;
  }

  // If no master or syndicate member is found, return null
  return null;
}

function parseConqueror(content) {
  const conquerorRegex = new RegExp(
    `(?<text>(${Constants.conquerors.join('|')}): .*)$`,
    'i');
  const match = conquerorRegex.exec(content);
  if (match) {
    return match.groups.text.trim();
  }
  return null;
}

function parseNPC(content) {
  const npcRegex = new RegExp(
    `^(?<text>(${Constants.leagueNPCs.join('|')}): .*)$`,
    'i');
  const match = npcRegex.exec(content);
  if (match) {
    // If a NPC is found, return the full string
    return match.groups.text.trim();
  }
  return null;
}

function parseMapBoss(content) {
  const mapBossesRegex = new RegExp(
    `^(?<text>(${Constants.mapBosses.join('|')}): .*)$`,
    'i');
  const match = mapBossesRegex.exec(content);
  if (match) {
    // If a map boss is found, return the full string
    return match.groups.text.trim();
  }
  return null;
}



module.exports.start = start;
module.exports.emitter = emitter;
module.exports.checkValidLogfile = checkValidLogfile;
