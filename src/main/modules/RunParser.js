import GGGAPI from '../GGGAPI';
import DB from '../db/run';
import dayjs from 'dayjs';
import RendererLogger from '../RendererLogger';
import SettingsManager from '../SettingsManager';
import OldDB from '../db';
const logger = require('electron-log');
const Utils = require('./Utils').default;
const EventEmitter = require('events');
const ItemPricer = require('./ItemPricer');
const XPTracker = require('./XPTracker');
const Constants = require('../../helpers/constants').default;

var emitter = new EventEmitter();
let latestGeneratedArea = null;

function setLatestGeneratedArea(area) {
  latestGeneratedArea = area;
}

async function tryProcess(obj) {
  var event = obj.event;
  var mode = obj.mode;
  var lastUsedEvent = await getLastUsedEvent();
  if (!lastUsedEvent) return;

  var firstEvent = await getNextMapEvent(lastUsedEvent);
  if (!firstEvent) return;
  logger.info('Map event found:');
  logger.info(JSON.stringify(firstEvent));

  logger.info(`${event.area} -> ${firstEvent.area}`);
  if (Utils.isLabArea(event.area) && Utils.isLabArea(firstEvent.area)) {
    logger.info('Still in lab, not processing');
    return;
  } else if (event.area === firstEvent.area) {
    if (event.area === 'Azurite Mine') {
      logger.info('Still in delve, not processing');
      return;
    } else if (event.area === 'Memory Void') {
      logger.info('Still in memory, not processing');
      return;
    } else if (event.server === firstEvent.server) {
      logger.info(`Still in same area ${event.area}, not processing`);
      return;
    }
  }

  var prevMapStartEvent = await getPrevMapStartEvent();
  logger.info('Prev map start event found:');
  logger.info(JSON.stringify(prevMapStartEvent));
  if (
    prevMapStartEvent.area === firstEvent.area &&
    prevMapStartEvent.server === firstEvent.server
  ) {
    logger.info(`Previous map run in ${firstEvent.area} was already processed`);
    logger.info(`prevmapstart: ${prevMapStartEvent.area} ${prevMapStartEvent.server}`);
    logger.info(`firstevent: ${firstEvent.area} ${firstEvent.server}`);
    logger.info(`event: ${event.area} ${event.server}`);
    return;
  }

  var lastEvent = await getLastTownEvent(event, firstEvent, mode);
  if (!lastEvent) return;
  logger.info('Last town event found:');
  logger.info(JSON.stringify(lastEvent));

  var mapStats;
  var mapMods;
  var areaInfo = await getAreaInfo(firstEvent, lastEvent);
  if (areaInfo) {
    mapMods = await getMapMods(areaInfo.id);
    mapStats = getMapStats(mapMods);
  } else {
    areaInfo = {
      id: firstEvent.timestamp,
      name: firstEvent.area,
    };
    mapStats = {
      iiq: null,
      iir: null,
      packsize: null,
    };
  }
  logger.info(`Stats: ${areaInfo}`);

  var xp = XPTracker.isMaxXP()
    ? Constants.MAX_XP
    : await getXP(firstEvent.timestamp, lastEvent.timestamp);
  var xpDiff = await getXPDiff(xp);
  var items = await checkItems(areaInfo, firstEvent.timestamp, lastEvent.timestamp);
  var killCount = await getKillCount(firstEvent.timestamp, lastEvent.timestamp);
  var extraInfo = await getMapExtraInfo(
    areaInfo.name,
    firstEvent.timestamp,
    lastEvent.timestamp,
    items,
    mapMods
  );

  var ignoreMapRun = false;

  OldDB.run('insert into areainfo(id, name, level, depth) values(?, ?, ?, ?)', [
    firstEvent.timestamp,
    firstEvent.area,
    latestGeneratedArea?.level ?? 0,
    latestGeneratedArea?.depth ?? 0,
  ]).catch((err) => {
    logger.info(
      `Error manually inserting areainfo (${firstEvent.timestamp} ${firstEvent.area}): ${err}`
    );
  });

  // if no items picked up, no kills, and no xp gained, log map run but ignore it (profit = -1, kills = -1)
  if (!items.count && !xpDiff && !killCount) {
    items.value = -1;
    killCount = -1;
    extraInfo.ignored = true;
    ignoreMapRun = true;
    logger.info('No items or xp gained, map run will be logged as invisible');
  }
  logger.info(`Map stats: ${JSON.stringify(mapStats)}`);

  var runArr = [
    areaInfo.id,
    firstEvent.timestamp,
    lastEvent.timestamp,
    mapStats.iiq || null,
    mapStats.iir || null,
    mapStats.packsize || null,
    items.value,
    xp,
    killCount,
    JSON.stringify(extraInfo),
  ];
  insertMapRun(runArr).then(() => {
    if (!ignoreMapRun) {
      emitter.emit('runProcessed', {
        name: areaInfo.name,
        id: areaInfo.id,
        gained: items.value,
        xp: xpDiff,
        kills: killCount,
        firstevent: firstEvent.timestamp,
        lastevent: lastEvent.timestamp,
      });
    }
  });

  return 1;

  function getNextMapEvent(lastUsedEvent) {
    logger.info(`Last used event is ${lastUsedEvent}`);
    return new Promise((resolve, reject) => {
      OldDB.all(
        `
          select id, event_text, server from events 
          where event_type='entered' 
          and (event_text <> ifnull((select event_text from events, mapruns where mapruns.lastevent = ? and events.id = mapruns.firstevent), '')
          or server <> ifnull((select server from events, mapruns where mapruns.lastevent = ? and events.id = mapruns.firstevent), ''))
          and id > ?
          order by id
        `,
        [lastUsedEvent, lastUsedEvent, lastUsedEvent]
      )
        .then((rows) => {
          if (!rows) {
            logger.info('No valid next map event found');
            resolve();
          } else {
            var foundEvent = false;
            for (var i = 0; i < rows.length; i++) {
              if (!Utils.isTown(rows[i].event_text)) {
                foundEvent = true;
                resolve({
                  timestamp: rows[i].id,
                  area: rows[i].event_text,
                  server: rows[i].server,
                });
              }
            }
            if (!foundEvent) {
              logger.info('No valid next map event found');
              resolve();
            }
          }
        })
        .catch((err) => {
          logger.error(`Unable to get next map event: ${err}`);
          resolve();
        });
    });
  }

  function getLastTownEvent(currEvent, mapEvent, mode) {
    var sql;
    switch (mode) {
      case 'automatic':
        sql =
          "select * from events where event_type='entered' and id > ? and id < ? order by id desc";
        break;
      case 'manual':
        sql =
          "select * from events where event_type='entered' and id > ? and id <= ? order by id desc";
        break;
      default:
        logger.info(`Invalid mode for getLastTownEvent: ${mode}`);
        return;
    }

    return new Promise((resolve) => {
      OldDB.all(sql, [mapEvent.timestamp, currEvent.timestamp])
        .then((rows) => {
          var lastTownVisit = null;
          for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            if (Utils.isTown(row.event_text)) {
              lastTownVisit = {
                timestamp: rows[i].id,
                area: rows[i].event_text,
                server: rows[i].server,
              };
            } else {
              break;
            }
          }
          if (!lastTownVisit) {
            logger.info('No last event found!');
            resolve();
          } else {
            resolve(lastTownVisit);
          }
        })
        .catch((err) => {
          logger.error(`Unable to get last town event: ${err}`);
          resolve();
        });
    });
  }

  function getAreaInfo(firstEvent, lastEvent) {
    return new Promise((resolve, reject) => {
      OldDB.get('select * from areainfo where id > ? and id < ? and name = ? order by id desc', [
        firstEvent.timestamp,
        lastEvent.timestamp,
        firstEvent.area,
      ])
        .then((row) => {
          if (!row) {
            logger.info(
              `No area info found between ${firstEvent.timestamp} and ${lastEvent.timestamp}`
            );
            resolve();
          }
          resolve(row);
        })
        .catch((err) => {
          logger.error(`Unable to get area info: ${err}`);
          resolve();
        });
    });
  }
}

async function process() {
  var currArea = await getCurrAreaInfo();
  if (!currArea) {
    logger.info('No unprocessed area info found');
    var lastEvent = await new Promise(async (resolve, reject) => {
      OldDB.get(" select * from events where event_type='entered' order by id desc ")
        .then((row) => {
          if (!row) {
            logger.info('No last inserted event found!');
            resolve();
          } else {
            resolve({
              timestamp: row.id,
              area: row.event_text,
              server: row.server,
            });
          }
        })
        .catch((err) => {
          logger.info(`Error getting last inserted event: ${err}`);
          resolve();
        });
    });
    if (lastEvent) {
      logger.info('Will try processing from event: ' + JSON.stringify(lastEvent));
      tryProcess({
        event: lastEvent,
        mode: 'manual',
      });
    }
    return;
  }

  var mods = await getMapMods(currArea.id);
  if (!mods) return;

  logger.info(`Processing run in ${currArea.name}`);

  var mapStats = getMapStats(mods);
  logger.info(`Map stats: ${JSON.stringify(mapStats)}, mods: ${JSON.stringify(mods)}`);

  var lastUsedEvent = await getLastUsedEvent();
  if (!lastUsedEvent) return;

  var firstEvent = await getFirstEvent(currArea, lastUsedEvent);
  if (!firstEvent) return;

  var lastEvent = await getLastEvent(currArea, firstEvent);
  if (!lastEvent) return;

  var xp = XPTracker.isMaxXP() ? Constants.MAX_XP : await getXP(firstEvent, lastEvent);
  var xpDiff = await getXPDiff(xp);
  var items = await checkItems(currArea, firstEvent, lastEvent);
  var killCount = await getKillCount(firstEvent, lastEvent);
  var extraInfo = await getMapExtraInfo(currArea.name, firstEvent, lastEvent, items, mods);
  var ignoreMapRun = false;

  // if no items picked up, no kills, and no xp gained, log map run but ignore it (profit = -1, kills = -1)
  if (!items.count && !xpDiff && !killCount) {
    items.value = -1;
    killCount = -1;
    ignoreMapRun = true;
    extraInfo.ignored = true;
    logger.info('No items or xp gained, map run will be logged as invisible');
  }

  var runArr = [
    currArea.id,
    firstEvent,
    lastEvent,
    mapStats.iiq,
    mapStats.iir,
    mapStats.packsize,
    items.value,
    xp,
    killCount,
    JSON.stringify(extraInfo),
  ];
  insertMapRun(runArr).then(() => {
    if (!ignoreMapRun) {
      emitter.emit('runProcessed', {
        name: currArea.name,
        id: currArea.id,
        gained: items.value,
        xp: xpDiff,
        kills: killCount,
        firstevent: firstEvent,
        lastevent: lastEvent,
      });
    }
  });

  return 1;
}

async function getKillCount(firstEvent, lastEvent) {
  logger.info(`Kill count between ${firstEvent} and ${lastEvent}`);
  return new Promise((resolve, reject) => {
    var totalKillCount = 0;
    OldDB.all(
      `
      select * from incubators where incubators.timestamp = (select max(timestamp) from incubators where timestamp <= ?)
      union all
      select * from incubators where incubators.timestamp between ? and ?
      order by timestamp
    `,
      [firstEvent, firstEvent, lastEvent]
    )
      .then((rows) => {
        if (rows.length > 1) {
          var incubators = [];
          rows.forEach((row) => {
            incubators.push(JSON.parse(row.data));
          });
          for (var i = 1; i < incubators.length; i++) {
            var prev = incubators[i - 1];
            var curr = incubators[i];
            var killCount = 0;
            Object.keys(prev).forEach((key) => {
              if (curr[key] && curr[key].progress - prev[key].progress > killCount) {
                killCount = curr[key].progress - prev[key].progress;
              }
            });
            totalKillCount += killCount;
          }
        }
        logger.info(`Total kill count is ${totalKillCount}`);
        resolve(totalKillCount > 0 ? totalKillCount : null);
      })
      .catch((err) => {
        logger.info(`Failed to get kill count: ${err}`);
        resolve();
      });
  });
}

async function getXP(firstEvent, lastEvent) {
  return new Promise((resolve) => {
    OldDB.get(
      ' select timestamp, xp from xp where timestamp between ? and ? order by timestamp desc limit 1 ',
      [firstEvent, lastEvent]
    )
      .then((row) => {
        logger.info(`Got XP from DB: ${row.xp} at ${row.timestamp}`);
        resolve(row.xp);
      })
      .catch((err) => {
        logger.info(
          `Failed to get XP between ${firstEvent} and ${lastEvent} from local DB, retrieving manually`
        );
        resolve(getXPManual());
      });
  });
}

async function getXPManual() {
  const { experience } = await GGGAPI.getDataForInventory();
  return experience;
}

async function getLastInventoryTimestamp() {
  return new Promise((resolve) => {
    OldDB.get('select timestamp from lastinv')
      .then((row) => {
        if (!row) {
          logger.info('No last inventory yet');
          resolve(-1);
        } else {
          resolve(row.timestamp);
        }
      })
      .catch((err) => {
        logger.info(`Error getting timestamp for last inventory: ${err}`);
        resolve(-1);
      });
  });
}

async function checkItems(area, firstevent, lastevent) {
  var lastinv;

  while (true) {
    logger.info('Getting inventory timestamp');
    lastinv = await getLastInventoryTimestamp();
    logger.info('Got ' + lastinv);
    if (lastinv >= lastevent) {
      break;
    } else {
      logger.info(
        `Last inventory not yet processed (${lastinv} < ${lastevent}), waiting 3 seconds`
      );
      await Utils.sleep(3000);
    }
  }

  logger.info(`Getting chaos value of items from ${area.id} ${area.name}`);
  var allItems = await getItems(area.id, firstevent, lastevent);
  logger.info(`Total profit is ${allItems.value} in ${allItems.count} items`);
  return allItems;
}

function getXPDiff(currentXP) {
  return new Promise((resolve) => {
    OldDB.get(' select xp from mapruns order by id desc limit 1 ')
      .then((row) => {
        if (!row.xp) {
          // first map recorded - xp diff can't be determined in this case, return 0
          resolve(0);
        } else {
          resolve(currentXP - row.xp);
        }
      })
      .catch((err) => {
        logger.info(`Error getting XP gained: ${err}`);
        resolve(null);
      });
  });
}

function getItems(areaID, firstEvent, lastEvent) {
  return new Promise((resolve, reject) => {
    OldDB.all(
      " select id, event_text from events where id between ? and ? and event_type = 'entered' order by id ",
      [firstEvent, lastEvent]
    )
      .then(async (rows) => {
        var numItems = 0;
        var totalProfit = 0;
        var importantDrops = {};
        for (var i = 1; i < rows.length; i++) {
          var prevRow = rows[i - 1];
          if (!Utils.isTown(prevRow.event_text)) {
            logger.info(`Getting items picked up in ${prevRow.id} ${prevRow.event_text}`);
            var items = await getItemsFor(rows[i].id);
            numItems += items.count;
            totalProfit += Number.parseFloat(items.value);
            if (items.importantDrops) {
              for (let m in items.importantDrops) {
                importantDrops[m] = (importantDrops[m] || 0) + items.importantDrops[m];
              }
            }
          } else {
            logger.info(
              `Ignoring items picked up in town area ${prevRow.id} ${prevRow.event_text}`
            );
          }
        }
        totalProfit = Number(totalProfit).toFixed(2);
        resolve({ count: numItems, value: totalProfit, importantDrops: importantDrops });
      })
      .catch((err) => {
        logger.info(`Unable to get item values for ${areaID}: ${err}`);
        resolve(false);
      });
  });
}

function getItemsFor(evt) {
  var count = 0;
  var totalValue = 0;
  var importantDrops = {};
  var itemArr = [];
  return new Promise((resolve) => {
    OldDB.all(' select * from items where event_id = ? ', [evt])
      .then(async (rows) => {
        for (var i = 0; i < rows.length; i++) {
          var item = rows[i];
          // ignore items that are equipped
          var jsonData = JSON.parse(item.rawdata);
          if (jsonData.inventoryId === 'MainInventory') {
            count++;

            if (item.category === 'Metamorph Sample') {
              let organ = item.typeline.substr(item.typeline.lastIndexOf(' ') + 1).toLowerCase();
              importantDrops[organ] = (importantDrops[organ] || 0) + 1;
            } else if (
              item.typeline.endsWith("'s Exalted Orb") ||
              item.typeline === "Awakener's Orb"
            ) {
              importantDrops[item.typeline] = (importantDrops[item.typeline] || 0) + 1;
            }

            let price = (await ItemPricer.price(item)) ?? { isVendor: false, value: 0 };
            if (price.isVendor) {
              totalValue += price.value;
              price = 0;
            } else {
              totalValue += price.value;
            }
            itemArr.push([price.value ?? 0, item.id, item.event_id]);
          }
        }

        if (itemArr.length > 0) {
          updateItemValues(itemArr);
        }

        resolve({ count: count, value: totalValue, importantDrops: importantDrops });
      })
      .catch((err) => {
        logger.info(`Error getting item values for ${evt}: ${err}`);
        resolve(null);
      });
  });
}

function updateItemValues(arr) {
  OldDB.transaction(`update items set value = ? where id = ? and event_id = ?`, arr).catch(
    (err) => {
      logger.warn(`Error inserting items: ${err}`);
    }
  );
}

async function insertMapRun(arr) {
  return new Promise((resolve, reject) => {
    OldDB.run(
      `
        insert into mapruns(id, firstevent, lastevent, iiq, iir, packsize, gained, xp, kills, runinfo) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
      `,
      arr
    )
      .then(() => {
        logger.info(`Map run processed successfully: ${JSON.stringify(arr)}`);
      })
      .catch((err) => {
        logger.error(`Unable to insert map run ${JSON.stringify(arr)}: ${err}`);
      })
      .finally(() => {
        resolve();
      });
  });
}

/*
 *  first event: first time the current map area is entered
 *  only start checking events after the end of the previous map (lastUsedEvent))
 */
function getFirstEvent(area, lastUsedEvent) {
  return new Promise((resolve) => {
    OldDB.get(
      "select id from events where event_type='entered' and event_text = ? and id > ? order by id",
      [area.name, lastUsedEvent]
    )
      .then((row) => {
        if (!row) {
          logger.info('No valid first event found');
          resolve();
        } else {
          resolve(row.id);
        }
      })
      .catch((err) => {
        logger.error(`Unable to get first event: ${err}`);
        resolve();
      });
  });
}

/*
 *  last event: first visit to a town after the last time the current map area is entered
 *  work backward from the last event recorded in the database
 */
function getLastEvent(area, firstEvent) {
  return new Promise((resolve) => {
    OldDB.all("select * from events where event_type='entered' and id >= ? order by id desc", [
      firstEvent,
    ])
      .then((rows) => {
        var lastTownVisit = null;
        var areaVisitFound = false;
        for (var i = 0; i < rows.length; i++) {
          var row = rows[i];
          if (Utils.isTown(row.event_text)) {
            lastTownVisit = row.id;
          } else if (row.event_text === area.name && lastTownVisit) {
            areaVisitFound = true;
            resolve(lastTownVisit);
            break;
          }
        }
        if (!lastTownVisit && !areaVisitFound) {
          logger.info('No last event found!');
          resolve();
        }
      })
      .catch((err) => {
        logger.error(`Unable to get last event: ${err}`);
        resolve();
      });
  });
}

function getCurrAreaInfo() {
  return new Promise((resolve) => {
    OldDB.get('select * from areainfo where id > (select max(id) from mapruns) order by id desc')
      .then((row) => {
        resolve(row);
      })
      .catch((err) => {
        logger.error(`Unable to get current area info: ${err}`);
        resolve();
      });
  });
}

function getLastUsedEvent() {
  return new Promise((resolve, reject) => {
    OldDB.get('select max(lastevent) as lastevent from mapruns')
      .then((row) => {
        if (!row) {
          logger.info('No last used event found');
          resolve('');
        } else {
          resolve(row.lastevent);
        }
      })
      .catch((err) => {
        logger.error(`Unable to get last used event: ${err}`);
        resolve();
      });
  });
}

function getPrevMapStartEvent() {
  return new Promise((resolve, reject) => {
    OldDB.get(
      'select * from events where id = (select firstevent from mapruns order by id desc limit 1);'
    )
      .then((row) => {
        if (!row) {
          logger.info('No previous map start event found');
          resolve('');
        } else {
          resolve({
            area: row.event_text,
            server: row.server,
          });
        }
      })
      .catch((err) => {
        logger.error(`Unable to get previous map start event: ${err}`);
        resolve('');
      });
  });
}

function getMapMods(id) {
  return new Promise((resolve, reject) => {
    OldDB.all('select mod from mapmods where area_id = ? order by cast(id as integer)', [id])
      .then((rows) => {
        var mods = rows.map((row) => row.mod);
        resolve(mods);
      })
      .catch((err) => {
        logger.error(`Unable to get last map mods: ${err}`);
      });
  });
}

function getMapStats(arr) {
  var mapStats = {};
  arr.forEach((mod) => {
    if (mod.endsWith('% increased Rarity of Items found in this Area')) {
      mapStats['iir'] = mod.match(/[0-9]+/)[0];
    } else if (mod.endsWith('% increased Quantity of Items found in this Area')) {
      mapStats['iiq'] = mod.match(/[0-9]+/)[0];
    } else if (mod.endsWith('% increased Pack size')) {
      mapStats['packsize'] = mod.match(/[0-9]+/)[0];
    }
  });
  return mapStats;
}

async function getMapExtraInfo(areaName, firstevent, lastevent, items, areaMods) {
  logger.info(`Getting map extra info for ${areaName} between ${firstevent} and ${lastevent}`);

  let events = await getEvents(firstevent, lastevent);

  let run = {};
  let lastEnteredArea = '';
  let blightCount = 0;

  if (Constants.atlasRegions[areaName]) {
    run.atlasRegion = Constants.atlasRegions[areaName];
  }

  run.areaTimes = getRunAreaTimes(events);

  for (let i = 0; i < events.length; i++) {
    let evt = events[i];
    let line;

    switch (evt.event_type) {
      case 'entered':
        let area = evt.event_text;
        lastEnteredArea = area;
        if (area === 'Abyssal Depths') {
          run.abyssalDepths = true;
        } else if (Constants.areas.vaalSideAreas.includes(area)) {
          run.vaalSideAreas = true;
        }
        continue;
      case 'slain':
        run.deaths = ++run.deaths || 1;
        continue;
      case 'abnormalDisconnect':
        run.abnormalDisconnect = ++run.abnormalDisconnect || 1;
        continue;
      case 'favourGained':
        // no need for null checking adjacent events, map runs must always start and end with an "entered" event
        let master = getMasterFavour(events[i - 1], events[i + 1]);
        run.masters = run.masters || {};
        run.masters[master] = run.masters[master] || { encountered: true };
        run.masters[master].favourGained =
          (run.masters[master].favourGained || 0) + Number(evt.event_text);
        continue;
      case 'shrine':
        if (Constants.darkshrineQuotes[evt.event_text]) {
          run.labyrinth = run.labyrinth || {};
          run.labyrinth.darkshrines = run.labyrinth.darkshrines || [];
          run.labyrinth.darkshrines.push(evt.event_text);
        } else {
          run.shrines = run.shrines || [];
          run.shrines.push(Constants.shrineQuotes[evt.event_text]);
        }
        continue;
      case 'mapBoss':
        line = getNPCLine(evt.event_text);
        // use lastEnteredArea instead of areaName to handle Zana map missions
        if (
          Constants.mapBossBattleStartQuotes[lastEnteredArea] &&
          Constants.mapBossBattleStartQuotes[lastEnteredArea].includes(line.text)
        ) {
          run.mapBoss = run.mapBoss || {};
          run.mapBoss[lastEnteredArea] = run.mapBoss[lastEnteredArea] || {};
          // only take the earliest possible battle start
          if (!run.mapBoss[lastEnteredArea].battleStart) {
            run.mapBoss[lastEnteredArea].battleStart = evt.id;
          }
        }
        if (
          Constants.mapBossKilledQuotes[lastEnteredArea] &&
          Constants.mapBossKilledQuotes[lastEnteredArea].includes(line.text)
        ) {
          run.mapBoss = run.mapBoss || {};
          run.mapBoss[lastEnteredArea] = run.mapBoss[lastEnteredArea] || {};
          // cold river map has two bosses that both emit death lines - take the latest
          run.mapBoss[lastEnteredArea].bossKilled = evt.id;
        }
        continue;
      case 'master':
      case 'conqueror':
      case 'leagueNPC':
        line = getNPCLine(evt.event_text);
        break;
      default:
        // ignore other event types
        continue;
    }

    switch (line.npc) {
      case 'The Envoy':
        run.envoy = run.envoy || { words: 0 };
        run.envoy.words += line.text.split(' ').length;
        continue;
      case 'The Maven':
        if (!run.maven) {
          run.maven = { firstLine: evt.id };
        } else {
          let eventType = Constants.mavenQuotes[line.text];
          if (eventType) {
            run.maven[eventType] = evt.id;
          }
        }
        continue;
      case 'Sister Cassia':
        if (Constants.blightBranchQuotes.includes(line.text)) {
          blightCount++;
        }
        continue;
      case 'Strange Voice':
        if (Constants.areas.delirium.includes(areaName)) {
          if (Constants.simulacrumWaveQuotes[line.text]) {
            run.simulacrumProgress = run.simulacrumProgress || {};
            run.simulacrumProgress[Constants.simulacrumWaveQuotes[line.text]] = evt.id;
          }
        } else {
          run.strangeVoiceEncountered = true;
        }
        continue;
      case 'The Shaper':
        if (areaName === "The Shaper's Realm" && Constants.shaperBattleQuotes[line.text]) {
          run.shaperBattle = run.shaperBattle || {};
          run.shaperBattle[Constants.shaperBattleQuotes[line.text]] = evt.id;
        } else if (
          Constants.mapBossKilledQuotes[lastEnteredArea] &&
          Constants.mapBossKilledQuotes[lastEnteredArea].includes(line.text)
        ) {
          // "This is the key to a crucible that stretches the sanity of the mind"
          run.mapBoss = run.mapBoss || {};
          run.mapBoss[lastEnteredArea] = run.mapBoss[lastEnteredArea] || {};
          run.mapBoss[lastEnteredArea].bossKilled = evt.id;
        }
        continue;
      case 'Catarina, Master of Undeath':
        if (areaName === "Mastermind's Lair" && Constants.mastermindBattleQuotes[line.text]) {
          run.mastermindBattle = run.mastermindBattle || {};
          run.mastermindBattle[Constants.mastermindBattleQuotes[line.text]] = evt.id;
        }
        continue;
      case 'Izaro':
        if (Constants.labyrinthQuotes[line.text]) {
          run.labyrinth = run.labyrinth || {};
          run.labyrinth[Constants.labyrinthQuotes[line.text]] = evt.id;
        }
        continue;
      case 'Einhar, Beastmaster':
        if (areaName === 'The Menagerie') {
          if (Constants.beastRecipeQuotes.includes(line.text)) {
            run.beastRecipes = ++run.beastRecipes || 1;
          }
        } else {
          run.masters = run.masters || {};
          run.masters[line.npc] = run.masters[line.npc] || { encountered: true };
          if (Constants.beastCaptureQuotes[line.text]) {
            run.masters[line.npc].beasts = ++run.masters[line.npc].beasts || 1;
            switch (Constants.beastCaptureQuotes[line.text]) {
              case 'yellow':
                run.masters[line.npc].yellowBeasts = ++run.masters[line.npc].yellowBeasts || 1;
                break;
              case 'red':
                run.masters[line.npc].redBeasts = ++run.masters[line.npc].redBeasts || 1;
                break;
              default:
                // no difference between yellow and red in Einhar's "mission complete" quote;
                // this means that the last beast in an area can't be identified
                break;
            }
          }
        }
        continue;
      case 'Alva, Master Explorer':
        run.masters = run.masters || {};
        run.masters[line.npc] = run.masters[line.npc] || {};
        if (areaName === 'The Temple of Atzoatl') {
          if (Constants.templeRoomQuotes[line.text]) {
            run.masters[line.npc].tier3Rooms = run.masters[line.npc].tier3Rooms || [];
            run.masters[line.npc].tier3Rooms.push(Constants.templeRoomQuotes[line.text]);
          }
        } else {
          run.masters[line.npc].encountered = true;
          if (line.text.includes('Good job')) {
            run.masters[line.npc].incursions = ++run.masters[line.npc].incursions || 1;
          }
        }
        continue;
      case 'Niko, Master of the Depths':
        run.masters = run.masters || {};
        run.masters[line.npc] = run.masters[line.npc] || { encountered: true };
        run.masters[line.npc].sulphite = ++run.masters[line.npc].sulphite || 1;
        continue;
      case 'Zana, Master Cartographer':
        if (areaName === 'Absence of Value and Meaning') {
          if (Constants.elderDefeatedQuotes.includes(line.text)) {
            run.elderDefeated = true;
          }
        } else {
          if (areaName !== "The Shaper's Realm" && areaName !== 'Eye of the Storm') {
            run.masters = run.masters || {};
            run.masters[line.npc] = run.masters[line.npc] || { encountered: true };
            let missionMap = getZanaMissionMap(events);
            if (missionMap) {
              run.masters[line.npc].missionMap = missionMap;
            }
          }
        }
        continue;
      case 'Jun, Veiled Master':
        if (areaName !== 'Syndicate Hideout' && areaName !== "Mastermind's Lair") {
          run.masters = run.masters || {};
          run.masters[line.npc] = run.masters[line.npc] || { encountered: true };
        }
        if (line.text.includes('[')) {
          let subLine = getNPCLine(line.text.substring(1, line.text.length - 1));
          run.syndicate = run.syndicate || {};
          run.syndicate[subLine.npc] = run.syndicate[subLine.npc] || { encountered: true };
          let q = Constants.syndicateMemberQuotes[subLine.npc];
          if (q.defeated.includes(subLine.text)) {
            run.syndicate[subLine.npc].defeated = ++run.syndicate[subLine.npc].defeated || 1;
          } else if (q.killPlayer.includes(subLine.text)) {
            run.syndicate[subLine.npc].killedPlayer =
              ++run.syndicate[subLine.npc].killedPlayer || 1;
          } else if (q.safehouseLeaderDefeated === subLine.text) {
            run.syndicate[subLine.npc].safehouseLeaderDefeated = true;
          }
        } else {
          let member = Constants.syndicateMemberQuotes.jun[line.text];
          if (member) {
            run.syndicate = run.syndicate || {};
            run.syndicate[member] = run.syndicate[member] || { encountered: true };
            run.syndicate[member].defeated = ++run.syndicate[member].defeated || 1;
          }
        }
        continue;
      case 'Al-Hezmin, the Hunter':
      case 'Baran, the Crusader':
      case 'Drox, the Warlord':
      case 'Veritania, the Redeemer':
        run.conqueror = run.conqueror || {};
        run.conqueror[line.npc] = run.conqueror[line.npc] || {};
        let battleQuotes = Constants.conquerorBattleStartQuotes[line.npc];
        for (let j = 0; j < battleQuotes.length; j++) {
          if (line.text.includes(battleQuotes[j])) {
            run.conqueror[line.npc].battle = true;
          }
        }
        if (run.conqueror[line.npc].battle) {
          let deathQuotes = Constants.conquerorDeathQuotes[line.npc];
          for (let j = 0; j < deathQuotes.length; j++) {
            if (line.text.includes(deathQuotes[j])) {
              run.conqueror[line.npc].defeated = true;
            }
          }
        } else {
          run.conqueror[line.npc].encounter = true;
        }
        continue;
      case 'Sirus, Awakener of Worlds':
        run.sirusBattle = run.sirusBattle || {};
        if (Constants.sirusBattleQuotes[line.text]) {
          run.sirusBattle[Constants.sirusBattleQuotes[line.text]] = evt.id;
        } else if (line.text === 'Die.') {
          run.sirusBattle.dieBeamsFired = ++run.sirusBattle.dieBeamsFired || 1;
          if (events[i + 1] && events[i + 1].event_type === 'slain') {
            run.sirusBattle.dieBeamKills = ++run.sirusBattle.dieBeamKills || 1;
          }
        }
        continue;
      case 'Queen Hyrri Ngamaku':
      case 'General Marceus Lioneye':
      case 'Viper Napuatzi':
      case 'Cardinal Sanctus Vox':
      case 'Aukuna, the Black Sekhema':
        if (areaName !== 'Domain of Timeless Conflict') {
          run.legionGenerals = run.legionGenerals || {};
          run.legionGenerals[line.npc] = run.legionGenerals[line.npc] || { encountered: true };
          if (Constants.legionDeathQuotes[line.npc].includes(line.text)) {
            run.legionGenerals[line.npc].defeated = ++run.legionGenerals[line.npc].defeated || 1;
          }
        }
        continue;
      case 'Oshabi':
        if (Constants.oshabiBattleQuotes[line.text]) {
          run.oshabiBattle = run.oshabiBattle || {};
          // don't log duplicate events
          if (!run.oshabiBattle[Constants.oshabiBattleQuotes[line.text]]) {
            run.oshabiBattle[Constants.oshabiBattleQuotes[line.text]] = evt.id;
          }
        }
        continue;
      case 'Venarius':
        if (Constants.venariusBattleQuotes[line.text]) {
          run.venariusBattle = run.venariusBattle || {};
          // don't log duplicate events
          if (!run.venariusBattle[Constants.venariusBattleQuotes[line.text]]) {
            run.venariusBattle[Constants.venariusBattleQuotes[line.text]] = evt.id;
          }
        }
        continue;
      case 'The Trialmaster':
        // need an array because there can be multiple ultimatums in a map run (campaign areas, Zana missions)
        run.ultimatum = run.ultimatum || [];
        if (Constants.ultimatumQuotes.start.includes(line.text)) {
          run.ultimatum.push({ start: evt.id });
        } else {
          let currUlt = run.ultimatum[run.ultimatum.length - 1];
          if (!currUlt) {
            // ????
            logger.info(`Ultimatum event without start event: [${evt.id} ${line.text}]`);
            continue;
          }
          if (Constants.ultimatumQuotes.lost.includes(line.text)) {
            currUlt.lost = evt.id;
          } else if (Constants.ultimatumQuotes.tookReward.includes(line.text)) {
            currUlt.tookReward = evt.id;
          } else if (Constants.ultimatumQuotes.won.includes(line.text)) {
            currUlt.won = evt.id;
          } else if (Constants.ultimatumQuotes.trialmasterDefeated.includes(line.text)) {
            currUlt.trialmasterDefeated = evt.id;
          } else if (Constants.ultimatumQuotes.mods[line.text]) {
            currUlt.rounds = currUlt.rounds || {};
            currUlt.rounds[evt.id] = Constants.ultimatumQuotes.mods[line.text];
            if (currUlt.rounds[evt.id].includes('/') && currUlt.rounds[evt.id].includes('Ruin')) {
              currUlt.isAmbiguous = true;
            }
          }
        }
        continue;
    }
  }

  if (run.ultimatum) {
    // We are jumping through these convoluted hoops because GGG couldn't give a unique quote to each type of mod >:\
    // Ailment and Curse Reflection is completely indistinguishable from Hindering Flasks, but for the ones below we can at least try
    for (let u of run.ultimatum) {
      if (!u.isAmbiguous) continue;

      delete u.isAmbiguous;

      let keys = Object.keys(u.rounds);
      let ruin = false,
        ruin2 = false,
        ruin3 = false,
        sruin = false,
        sruin2 = false,
        sruin3 = false;

      for (let i = 0; i < keys.length; i++) {
        let mod = u.rounds[keys[i]];
        switch (mod) {
          case 'Ruin II':
            ruin2 = true;
            break;
          case 'Ruin III':
            ruin3 = true;
            break;
          case 'Stalking Ruin':
            sruin = true;
            break;
          case 'Ruin / Stalking Ruin III':
            if (i === 0 || !sruin2 || sruin3) {
              u.rounds[keys[i]] = 'Ruin';
              ruin = true;
            } else if (ruin) {
              u.rounds[keys[i]] = 'Stalking Ruin III';
              sruin3 = true;
            }
            break;
          case 'Ruin II / Stalking Ruin II':
            if (sruin2 || (ruin && !sruin)) {
              u.rounds[keys[i]] = 'Ruin II';
              ruin2 = true;
            } else if (ruin2 || (sruin && !ruin)) {
              u.rounds[keys[i]] = 'Stalking Ruin II';
              sruin2 = true;
            }
            break;
        }
      }

      // make a second pass if needed
      if (
        Object.values(u.rounds).includes('Ruin / Stalking Ruin III') ||
        Object.values(u.rounds).includes('Ruin II / Stalking Ruin II')
      ) {
        for (let i = 0; i < keys.length; i++) {
          let mod = u.rounds[keys[i]];
          switch (mod) {
            case 'Ruin / Stalking Ruin III':
              if (sruin3 || (ruin2 && !ruin)) {
                u.rounds[keys[i]] = 'Ruin';
                ruin = true;
              } else if (!sruin3) {
                // if only sruin and sruin2 are true, this case is STILL ambiguous, but fuck it let's just assume this
                u.rounds[keys[i]] = 'Stalking Ruin III';
                sruin3 = true;
              }
              break;
            case 'Ruin II / Stalking Ruin II':
              if (ruin && ruin3 && !ruin2) {
                u.rounds[keys[i]] = 'Ruin II';
                ruin2 = true;
              } else if (sruin && sruin3 && !sruin2) {
                u.rounds[keys[i]] = 'Stalking Ruin II';
                sruin2 = true;
              } else if (ruin && sruin && !ruin3 && !sruin3) {
                // again, fuck it
                u.rounds[keys[i]] = Math.random() > 0.5 ? 'Ruin II' : 'Stalking Ruin II';
              }
              break;
          }
        }
      }
    }
  }

  if (blightCount > 0) {
    // 3.13 update: Zana can give blighted mission maps
    if (blightCount > 8) {
      if (run.masters && run.masters['Zana, Master Cartographer']) {
        run.masters['Zana, Master Cartographer'].blightedMissionMap = true;
      } else {
        run.blightedMap = true;
      }
    } else {
      run.blightEncounter = true;
    }
  }

  let bossBattleStart;
  if (run.maven && run.maven.firstLine) {
    bossBattleStart = run.maven.firstLine;
  }
  // take the earliest possible boss battle start
  if (run.mapBoss && run.mapBoss[areaName] && run.mapBoss[areaName].battleStart) {
    bossBattleStart = Math.min(
      bossBattleStart || Number.MAX_SAFE_INTEGER,
      run.mapBoss[areaName].battleStart
    );
  }

  let bossBattleEnd;
  if (run.maven && run.maven.bossKilled) {
    bossBattleEnd = run.maven.bossKilled;
  }
  // take the latest possible boss kill time - to handle cold river multiboss
  if (run.mapBoss && run.mapBoss[areaName] && run.mapBoss[areaName].bossKilled) {
    bossBattleEnd = Math.max(bossBattleEnd || 0, run.mapBoss[areaName].bossKilled);
  }

  if (bossBattleStart && bossBattleEnd) {
    run.bossBattle = {};
    run.bossBattle.time = Utils.getRunningTime(bossBattleStart, bossBattleEnd, 's', {
      useGrouping: false,
    });
    let bossBattleDeaths = countDeaths(events, bossBattleStart, bossBattleEnd);
    if (bossBattleDeaths) {
      run.bossBattle.deaths = bossBattleDeaths;
    }
  }

  // handle map boss stats in sub-areas
  if (run.mapBoss) {
    let areas = Object.keys(run.mapBoss);
    for (let i = 0; i < areas.length; i++) {
      let a = areas[i];
      if (a !== areaName && run.mapBoss[a].battleStart && run.mapBoss[a].bossKilled) {
        run.mapBoss[a].time = Utils.getRunningTime(
          run.mapBoss[a].battleStart,
          run.mapBoss[a].bossKilled,
          's',
          { useGrouping: false }
        );
        let deaths = countDeaths(events, run.mapBoss[a].battleStart, run.mapBoss[a].bossKilled);
        if (deaths) {
          run.mapBoss[a].deaths = deaths;
        }
      }
    }
  }

  // minor manual fixing - if Einhar mission was completed in an area, and all beasts except for the last are yellow,
  // the last remaining one must be a red beast
  if (run.masters && run.masters['Einhar, Beastmaster']) {
    let b = run.masters['Einhar, Beastmaster'];
    if (b.favourGained && b.yellowBeasts === b.beasts - 1) {
      b.redBeasts = 1;
    }
  }

  if (areaMods) {
    let elderGuardian = Constants.elderGuardians.find((guardian) =>
      areaMods.some((mod) => mod.endsWith(guardian))
    );
    if (elderGuardian) {
      run.elderGuardian = elderGuardian;
    }
  }

  if (items && items.importantDrops) {
    for (var key in items.importantDrops) {
      switch (key) {
        case 'brain':
        case 'lung':
        case 'heart':
        case 'eye':
        case 'liver':
          run.metamorph = run.metamorph || {};
          run.metamorph[key] = (run.metamorph[key] || 0) + items.importantDrops[key];
          break;
        case "Hunter's Exalted Orb":
          if (
            run.conqueror &&
            run.conqueror['Al-Hezmin, the Hunter'] &&
            run.conqueror['Al-Hezmin, the Hunter'].defeated
          ) {
            run.conqueror['Al-Hezmin, the Hunter'].droppedOrb = true;
          }
          break;
        case "Warlord's Exalted Orb":
          if (
            run.conqueror &&
            run.conqueror['Drox, the Warlord'] &&
            run.conqueror['Drox, the Warlord'].defeated
          ) {
            run.conqueror['Drox, the Warlord'].droppedOrb = true;
          }
          break;
        case "Redeemer's Exalted Orb":
          if (
            run.conqueror &&
            run.conqueror['Veritania, the Redeemer'] &&
            run.conqueror['Veritania, the Redeemer'].defeated
          ) {
            run.conqueror['Veritania, the Redeemer'].droppedOrb = true;
          }
          break;
        case "Crusader's Exalted Orb":
          if (
            run.conqueror &&
            run.conqueror['Baran, the Crusader'] &&
            run.conqueror['Baran, the Crusader'].defeated
          ) {
            run.conqueror['Baran, the Crusader'].droppedOrb = true;
          }
          break;
        case "Awakener's Orb":
          if (run.sirusBattle && run.sirusBattle.completed) {
            run.sirusBattle.droppedOrb = true;
          }
          break;
      }
    }
  }

  return run;

  function countDeaths(events, start, end) {
    let deaths = 0;
    for (let i = 0; i < events.length; i++) {
      if (events[i].event_type === 'slain' && events[i].id > start && events[i].id < end) {
        deaths++;
      }
    }
    return deaths;
  }

  function getZanaMissionMap(events) {
    let start = events[0];
    for (let i = 1; i < events.length; i++) {
      let curr = events[i];
      if (curr.event_type !== 'entered') continue;
      if (curr.event_text !== start.event_text || curr.server !== start.server) {
        if (
          Constants.areas.normalMaps.includes(curr.event_text) ||
          Constants.areas.uniqueMaps.includes(curr.event_text)
        ) {
          return curr.event_text;
        }
      }
    }
    return null;
  }

  function getRunAreaTimes(e) {
    let events = [];
    for (let i = 0; i < e.length; i++) {
      if (e[i].event_type === 'entered') {
        events.push(e[i]);
      }
    }

    let times = {};
    for (let k = 0; k < events.length - 1; k++) {
      let curr = events[k];
      let next = events[k + 1];
      let area = curr.event_text;
      let runningTime = Utils.getRunningTime(curr.id, next.id, 's', { useGrouping: false });
      times[area] = (times[area] || 0) + Number(runningTime);
    }

    return times;
  }

  function getMasterFavour(prevEvt, nextEvt) {
    if (prevEvt.event_type === 'master') {
      for (let i = 0; i < Constants.masters.length; i++) {
        if (prevEvt.event_text.startsWith(Constants.masters[i])) {
          return Constants.masters[i];
        }
      }
    }

    if (nextEvt.event_type === 'master') {
      for (let i = 0; i < Constants.masters.length; i++) {
        if (nextEvt.event_text.startsWith(Constants.masters[i])) {
          return Constants.masters[i];
        }
      }
    }

    // if no completion quote found, must be a zana mission
    return 'Zana, Master Cartographer';
  }
}

function getEvents(firstevent, lastevent) {
  return new Promise((resolve) => {
    OldDB.all('select * from events where id between ? and ? order by id', [firstevent, lastevent])
      .then((rows) => {
        resolve(rows);
      })
      .catch((err) => {
        logger.error(`Unable to get events: ${err}`);
        resolve([]);
      });
  });
}

function getNPCLine(str) {
  if (str.indexOf(':') < 0) {
    return null;
  }
  return {
    npc: str.substr(0, str.indexOf(':')).trim(),
    text: str.substr(str.indexOf(':') + 1).trim(),
  };
}

async function recheckGained(from = 0, to = dayjs().format('YYYYMMDDHHmmss')) {
  RendererLogger.log({
    messages: [
      { text: 'Rechecking map profits from ' },
      { text: from, type: 'important' },
      { text: ' to ' },
      { text: to, type: 'important' },
      { text: '...' },
    ],
  });
  const startTime = dayjs();
  const runs = await DB.getRunsFromDates(from, to);
  for (const run of runs) {
    await ItemPricer.getRatesFor(run.id);
  }

  const checks = runs.map(async (run) => {
    const items = await DB.getItemsFromRun(run.id);
    let totalProfit = 0;
    let oldTotalProfit = 0;
    let itemsToUpdate = [];
    for (const item of items) {
      const { value } = await ItemPricer.price(
        { event_id: dayjs().format('YYYYMMDD'), ...item },
        SettingsManager.get('activeProfile').league,
        true
      );
      oldTotalProfit += item.value;
      totalProfit += value;
      if (value !== item.value) {
        itemsToUpdate.push({ value, id: item.id, eventId: item.event_id });
      }
    }
    if (itemsToUpdate.length > 0) {
      DB.updateItemValues(itemsToUpdate);
    }
    const profitDifference = totalProfit - oldTotalProfit;
    if (profitDifference !== 0) {
      logger.info(`Updating profit from ${run.gained} to ${totalProfit}`);
    } else {
      logger.info(`No profit difference for ${run.id}`);
    }
  });

  return Promise.all(checks).then(() => {
    const endTime = dayjs();
    const timeTaken = endTime.diff(startTime, 'millisecond');
    logger.info(`Recheck from ${from} to ${to} took ${timeTaken} ms`);
    RendererLogger.log({
      messages: [
        { text: 'Recheck complete - Checked map profits from ' },
        { text: from, type: 'important' },
        { text: ' to ' },
        { text: to, type: 'important' },
        { text: ' in ' },
        { text: `${timeTaken}`, type: 'important' },
        { text: 'ms.' },
      ],
    });
  });
}

export default {
  process,
  tryProcess,
  setLatestGeneratedArea,
  emitter,
  recheckGained,
  getEvents,
  getNPCLine,
  getMapExtraInfo,
  getMapStats,
};
