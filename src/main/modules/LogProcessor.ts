import EventEmitter from 'events';
import Logger from 'electron-log';
import { v4 as uuidv4 } from 'uuid';
import RunParser from './RunParser';
import DB from '../db/run';
import SettingsManager from '../SettingsManager';
import SkillTreeWatcher from './SkillTreeWatcher';
import InventoryGetter from './InventoryGetter';
import ItemParser from './ItemParser';
import Constants from '../../helpers/constants';
import Utils from './Utils';

const logger = Logger.scope('LogProcessor');

class LogProcessorScheduler {
  tasks: string[] = [];
  isBusy: boolean = true;
  eventEmitter: EventEmitter = new EventEmitter();
  constructor() {
    logger.info('Starting Log Processor');
    this.eventEmitter.on('task:added', () => {
      this.runTasks();
    });
    this.eventEmitter.on('task:ended', () => {
      this.runTasks();
    });
    this.isBusy = false;
    this.runTasks();
  }

  runTasks() {
    if (this.isBusy) {
      return;
    } else {
      const nextId = this.tasks.shift();
      if (nextId) {
        this.isBusy = true;
        this.eventEmitter.once(`task:end:${nextId}`, () => {
          this.isBusy = false;
          this.eventEmitter.emit(`task:ended`);
        });
        this.eventEmitter.emit(`task:start:${nextId}`);
      }
    }
  }

  runTask(task: Function): Promise<any> {
    const id = uuidv4();
    return new Promise((resolve) => {
      this.eventEmitter.once(`task:start:${id}`, async () => {
        // logger.info(`Running task ${id}`);
        const result = await task();
        this.eventEmitter.emit(`task:end:${id}`);
        resolve(result);
      });
      // logger.info(`Adding task ${id}`);
      this.tasks.push(id);
      this.eventEmitter.emit(`task:added`);
    });
  }
}

const scheduler = new LogProcessorScheduler();
const emitter = new EventEmitter();

const generationRegex = /.*level\s(?<level>\d+)\sarea\s"(?<areaId>\S+)".*seed\s(?<seed>\d+)/;
const allocationRegex =
  /Successfully (?<verb>(allocated|unallocated)).*id:\s(?<id>.*),.*name:\s(?<name>.*)$/;
const enteredRegex = /You have entered (?<area>.*)\.$/;
const levelUpRegex = /is now level (?<level>\d+)/;
const chatRegex = /(?<verb>To|From)\s(\<.*\>)\s(?<character>.*):\s(?<text>.*)/;
const instanceServerRegex =
  /Connecting to instance server.*\s((?:[0-9]{1,3}\.){3}[0-9]{1,3}:\d{1,5})/;

// Get the event data from the content of a line in client.txt
function getEvent(content: string, server: string) {
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
    const { verb, id, name } = allocationMatch.groups as { verb: string; id: string; name: string };
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
      const areaName = (match.groups as { area: string }).area.trim();
      logger.debug(`Entered area: ${areaName}`);

      return {
        type: 'entered',
        text: areaName,
        instanceServer: server,
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
        text: Number.parseInt((match.groups as { level: string }).level),
      };
    } else {
      const cleanContent = content.substring(2).trim();
      if (
        Constants.shrineQuotes[cleanContent] ||
        Constants.darkshrineQuotes.includes(cleanContent)
      ) {
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
      const { verb, character, text } = match.groups as {
        verb: string;
        character: string;
        text: string;
      };
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

      if (verb === 'To' && character === characterName) {
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
  const mastersRegex = new RegExp(`(?<text>(${Constants.masters.join('|')}):.*)$`, 'i');

  const match = mastersRegex.exec(content);
  if (match) {
    return (match.groups as { text: string }).text.trim();
  }

  // 3.8.0: Jun sometimes does not talk at all during missions; scan for Syndicate member lines instead
  const junRegex = new RegExp(
    `(?<master>${Constants.syndicateMembers.join('|')}): (?<text>.*)$`,
    'i'
  );

  const junMatch = junRegex.exec(content);
  if (junMatch) {
    return `Jun, Veiled Master: ${(junMatch.groups as { text: string }).text.trim()}`;
  }

  // If no master or syndicate member is found, return null
  return null;
}

function parseConqueror(content) {
  const conquerorRegex = new RegExp(`(?<text>(${Constants.conquerors.join('|')}): .*)$`, 'i');
  const match = conquerorRegex.exec(content);
  if (match) {
    return (match.groups as { text: string }).text.trim();
  }
  return null;
}

function parseNPC(content) {
  const npcRegex = new RegExp(`^(?<text>(${Constants.leagueNPCs.join('|')}): .*)$`, 'i');
  const match = npcRegex.exec(content);
  if (match) {
    // If a NPC is found, return the full string
    return (match.groups as { text: string }).text.trim();
  }
  return null;
}

function parseMapBoss(content) {
  const mapBossesRegex = new RegExp(`^(?<text>(${Constants.mapBosses.join('|')}): .*)$`, 'i');
  const match = mapBossesRegex.exec(content);
  if (match) {
    // If a map boss is found, return the full string
    return (match.groups as { text: string }).text.trim();
  }
  return null;
}

let parsedInstanceServerTwice = false;
let lastInstanceServer = '';

const LogProcessor = {
  scheduler,
  emitter,
  schedule(task: Function): Promise<any> {
    return this.scheduler.runTask(task);
  },
  processGeneration: async (timestamp: string, line: string) => {
    logger.debug('LogProcessor.processGeneration', timestamp, line);
    const match = generationRegex.exec(line);
    if (!match) {
      logger.error(`Failed to parse map generation line: ${line}`);
      return;
    }
    // Extract timestamp, level, areaId, and seed from the line
    const { level, areaId, seed } = match.groups as { level: string; areaId: string; seed: string };

    // Extract map data from Constants
    const area = RunParser.getAreaFromId(areaId);
    const { name: areaName, baseLevel } = area;

    // If level is not set (never seen that but who knows), use baseLevel
    const actualLevel = level ?? baseLevel;
    logger.info(
      `Detected map generation: ${timestamp}, level: ${actualLevel}, areaName: ${areaName},areaId: ${areaId}, seed: ${seed}`
    );

    // We insert an event into the database to track generated maps
    await RunParser.insertEvent({
      event_type: 'generatedArea',
      event_text: JSON.stringify({
        areaName,
        areaId,
        level: actualLevel,
        seed,
      }),
      timestamp,
    });

    // Special case for the very first run in DB
    const isFirstRun = await DB.isFirstRun();
    // Try to process the run if it's a town or a hideout
    let hasProcessed = false;
    if (!area.isTown && !area.isHideout) {
      hasProcessed = await RunParser.tryProcess({
        event: { timestamp, server: lastInstanceServer },
      });
    }
    // If there is a map run ongoing, we don't create a new one
    const hasOngoingMap = await RunParser.hasOngoingMapRun();
    if (
      (isFirstRun || hasProcessed || !hasOngoingMap) &&
      !area.isTown &&
      !area.isHideout &&
      !area.isLabyrinthAirlock &&
      !area.isLabyrinthBossArea
    ) {
      logger.info(`Creating new map run from generated logs for area ${areaId}.`);
      const runId = await RunParser.createNewMapRun({
        areaId: areaId,
        areaName: areaName,
        level: actualLevel,
        seed,
        timestamp,
      });
      logger.info(
        `New map run created for area ${areaId} with level ${actualLevel} and seed ${seed}. Run ID: ${runId}`
      );

      emitter.emit('client-logs:generated-run', {
        areaName,
        timestamp,
        level,
        areaId,
        seed,
        runId,
      });
    }
  },
  processEnd: async (timestamp: string, line: string) => {
    logger.debug('LogProcessor.processEnd', timestamp, line);
    try {
      await RunParser.tryProcess({ event: { timestamp, server: lastInstanceServer } });
    } catch (err) {
      logger.error(`Error processing last map run: ${err}`);
    }
  },
  processNewInstance: async (timestamp: string, line: string) => {
    logger.debug('LogProcessor.processNewInstance', timestamp, line);
    lastInstanceServer = instanceServerRegex.exec(line)?.[1] ?? '';
    logger.info('Instance server found: ' + lastInstanceServer);
    // if two consecutive instance server lines occur without a "you have entered" line,
    // prompt to turn on local chat
    if (parsedInstanceServerTwice) {
      emitter.emit('client-logs:error:local-chat-disabled');
    } else {
      parsedInstanceServerTwice = true;
    }
  },

  processOther: async (timestamp: string, line: string) => {
    // logger.debug('LogProcessor.processOther', timestamp, line);
    const event = getEvent(line, lastInstanceServer);

    if (event) {
      try {
        // Save the event to the database
        await DB.insertEvent({
          timestamp,
          event_type: event.type,
          event_text: event.text,
          server: lastInstanceServer,
        });

        // If we just entered a new map area, try to process the previous area
        if (event.type === 'entered') {
          logger.debug('Entered new map area: ' + event.text);

          // Reset the instance server found flag for Local Chat check since we are parsing something else
          parsedInstanceServerTwice = false;
          if (!Utils.isTown(event.text)) {
            logger.info(`Entered map area ${event.text}, will try updating current area`);
            emitter.emit('client-logs:entered-map', {
              area: event.text,
              event: { timestamp: timestamp, area: event.text, server: event.instanceServer },
              mode: 'automatic',
            });
          }
          await SkillTreeWatcher.saveNewTree(timestamp); // Async but we dont care about the result here
          await InventoryGetter.getInventoryDiffs(timestamp).then(async (diff) => {
            // Async but we dont care about the result here
            if (diff && Object.keys(diff).length > 0) {
              await ItemParser.insertItems(diff, timestamp);
            }
          });
        }
      } catch (e) {
        logger.error(`Error processing event: ${e}`);
      }
    }
  },
};

export default LogProcessor;
