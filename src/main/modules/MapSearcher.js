const qs = require('querystring');
const EventEmitter = require('events');
const dayjs = require('dayjs');
const logger = require('electron-log');
const Utils = require('./Utils').default;
const ItemData = require('./ItemData');
const ItemPricer = require('./ItemPricer');
const ItemCategoryParser = require('../../helpers/item').default;
const DB = require('../db').default;

const encounters = {
  alva: 'Alva, Master Explorer',
  einhar: 'Einhar, Beastmaster',
  jun: 'Jun, Veiled Master',
  niko: 'Niko, Master of the Depths',
  zana: 'Zana, Master Cartographer',
  blight: 'blightEncounter',
  blightedmap: 'blightedMap',
  delirium: 'strangeVoiceEncountered',
  oshabi: 'oshabiBattle',
  metamorph: 'metamorph',
  hunter: 'Al-Hezmin, the Hunter',
  crusader: 'Baran, the Crusader',
  warlord: 'Drox, the Warlord',
  redeemer: 'Veritania, the Redeemer',
  maven: 'maven',
  abnormaldisconnect: 'abnormalDisconnect',
  vaalsidearea: 'vaalSideAreas',
};

var emitter = new EventEmitter();
var settings;
var pseudoItemPriceCache;
var DB;

function search(formData) {
  settings = require('./settings').get();
  pseudoItemPriceCache = {};
  var data = qs.parse(formData);
  var query = getSQL(data);
  var mapIDs = [];
  logger.info(query.sql);
  logger.info(`Params: ${query.params}`);
  DB.all(query.sql, query.params)
    .then((rows) => {
      var totalXP = 0;
      var totalKills = 0;
      logger.info(`${rows.length} rows returned`);
      rows.forEach((row) => {
        totalXP += row.xpgained;
        totalKills += row.kills || 0;
        mapIDs.push(row.id);
      });
      emitter.emit('mapSearchResults', rows);
      if (data.getItems) {
        getStatSummary(totalXP, totalKills, mapIDs);
      } else {
        logger.info('Not getting items');
      }
    })
    .catch((err) => {
      logger.info(`Error retrieving search results: ${err}`);
    });
}

async function getStatSummary(totalXP, totalKills, mapIDs) {
  var totalTime = 0;
  logger.info('Getting items for map summary');
  var allItems = [];
  var profitByMap = {};
  for (var i = 0; i < mapIDs.length; i++) {
    totalTime += await getTime(mapIDs[i]);
    var mapItems = await getItems(mapIDs[i]);
    profitByMap[mapIDs[i]] = getProfitByCategory(mapItems);
    allItems = allItems.concat(mapItems);
  }
  allItems = mergeItems(allItems);
  logger.info('Done getting items');
  emitter.emit('mapSummaryResults', {
    numMaps: mapIDs.length,
    totalXP: totalXP,
    totalKills: totalKills,
    totalTime: totalTime,
    profitByMap: profitByMap,
    allItems: allItems,
  });
}

function getProfitByCategory(items) {
  let profit = {
    currency: 0,
    maps: 0,
    divCards: 0,
    other: 0,
  };
  for (let i = 0; i < items.length; i++) {
    let cat = ItemCategoryParser.getCategory(items[i]);
    switch (cat) {
      case 'Currency':
      case 'Stackable Currency':
        profit.currency += items[i].chaosValue;
        break;
      case 'Maps':
        profit.maps += items[i].chaosValue;
        break;
      case 'Divination Card':
        profit.divCards += items[i].chaosValue;
        break;
      default:
        profit.other += items[i].chaosValue;
        break;
    }
  }
  return profit;
}

function mergeItems(arr) {
  var items = {};
  for (var i = 0; i < arr.length; i++) {
    var item = arr[i];
    if (!item.chaosValue) {
      item.chaosValue = 0;
    }
    if (!item.stackSize) item.stackSize = 1;
    var typeLine = Utils.getBaseName(item);
    var suffix = Utils.getSuffix(item);
    if (item.frameType === 3) {
      typeLine += ' ' + item.icon;
    }
    if (suffix) {
      typeLine += ' ' + suffix;
    }
    if (items[typeLine]) {
      items[typeLine].stackSize += item.stackSize;
      items[typeLine].chaosValue += item.chaosValue;
    } else {
      items[typeLine] = item;
    }
  }
  return Object.values(items);
}

async function getItems(mapID) {
  var items = [];
  return new Promise((resolve, reject) => {
    DB.all(
      `
      select e.id, e.event_text
      from mapruns m, events e 
      where m.id = ? and e.id between m.firstevent and m.lastevent and e.event_type='entered'
    `,
      [mapID]
    )
      .then(async (rows) => {
        for (var i = 1; i < rows.length; i++) {
          if (!Utils.isTown(rows[i - 1].event_text)) {
            items = items.concat(await getItemsFromEvent(mapID, rows[i].id));
          }
        }
        resolve(items);
      })
      .catch((err) => {
        logger.info(`Error getting items: ${err}`);
        resolve(null);
      });
  });
}

async function getPseudoItemPriceFor(date) {
  // Recipe Pricing
  // TODO: Centralize these
  if (!pseudoItemPriceCache[date]) {
    pseudoItemPriceCache[date] = {
      sixSocketValue: 7 * (await ItemPricer.getCurrencyByName("Jeweller's Orb", date)),
      sixLinkValue: 20 * (await ItemPricer.getCurrencyByName('Orb of Fusing', date)),
      rgbLinkedValue: await ItemPricer.getCurrencyByName('Chromatic Orb', date),
      gcpValue: await ItemPricer.getCurrencyByName("Gemcutter's Prism", date),
    };
  }
  return pseudoItemPriceCache[date];
}

async function getItemsFromEvent(mapID, eventID) {
  var items = [];
  return new Promise((resolve, reject) => {
    DB.all('select rawdata, stacksize, category, sockets, value from items where event_id = ?', [
      eventID,
    ])
      .then(async (rows) => {
        let date = mapID.substring(0, 8);
        let rates = await getPseudoItemPriceFor(date);

        let sixSocketItems = 0;
        let sixLinkItems = 0;
        let rgbLinkedItems = 0;
        let gcpItems = 0;

        for (let i = 0; i < rows.length; i++) {
          var item = JSON.parse(rows[i].rawdata);

          item.chaosValue = rows[i].value || 0;

          // check if vendor recipe
          var sockets = ItemData.getSockets(item);
          let hasVendorValue = false;
          if (sockets.length) {
            if (ItemData.countSockets(sockets) === 6) {
              if (sockets.length === 1) {
                if (item.chaosValue <= rates.sixLinkValue) {
                  item.chaosValue = 0;
                  hasVendorValue = true;
                  sixLinkItems += item.stackSize || 1;
                } else {
                  //logger.info(`${mapID} ${item.typeLine} value ${item.chaosValue} > 6L ${rates.sixLinkValue}`);
                }
              } else {
                if (item.chaosValue <= rates.sixSocketValue) {
                  item.chaosValue = 0;
                  hasVendorValue = true;
                  sixSocketItems += item.stackSize || 1;
                } else {
                  //logger.info(`${mapID} ${item.typeLine} value ${item.chaosValue} > 6S ${rates.sixSocketValue}`);
                }
              }
            } else {
              for (let j = 0; j < sockets.length; j++) {
                if (
                  sockets[j].includes('R') &&
                  sockets[j].includes('G') &&
                  sockets[j].includes('B')
                ) {
                  if (item.chaosValue <= rates.rgbLinkedValue) {
                    item.chaosValue = 0;
                    hasVendorValue = true;
                    rgbLinkedItems += item.stackSize || 1;
                  } else {
                    //logger.info(`${mapID} ${item.typeLine} value ${item.chaosValue} > RGB ${rates.rgbLinkedValue}`);
                  }
                  break;
                }
              }
            }
          } else {
            if (ItemData.getQuality(item) >= 20 && item.frameType === 4) {
              if (item.chaosValue <= rates.gcpValue) {
                item.chaosValue = 0;
                hasVendorValue = true;
                gcpItems++;
              } else {
                //logger.info(`${mapID} ${item.typeLine} value ${item.chaosValue} > GCP ${rates.gcpValue}`);
              }
            }
          }

          // also list items with no value assigned; exclude items with only vendor value
          if (item.chaosValue || !hasVendorValue) {
            item.mapID = mapID;
            items.push(item);
          }
        }

        if (sixSocketItems > 0) {
          let tempItem = Utils.getPseudoItem('6S');
          tempItem.stackSize = sixSocketItems;
          tempItem.chaosValue = sixSocketItems * rates.sixSocketValue;
          items.push(tempItem);
        }
        if (sixLinkItems > 0) {
          let tempItem = Utils.getPseudoItem('6L');
          tempItem.stackSize = sixLinkItems;
          tempItem.chaosValue = sixLinkItems * rates.sixLinkValue;
          items.push(tempItem);
        }
        if (rgbLinkedItems > 0) {
          let tempItem = Utils.getPseudoItem('RGB');
          tempItem.stackSize = rgbLinkedItems;
          tempItem.chaosValue = rgbLinkedItems * rates.rgbLinkedValue;
          items.push(tempItem);
        }
        if (gcpItems > 0) {
          let tempItem = Utils.getPseudoItem('GCP');
          tempItem.stackSize = gcpItems;
          tempItem.chaosValue = gcpItems * rates.gcpValue;
          items.push(tempItem);
        }

        resolve(items);
      })
      .catch((err) => {
        logger.info(`Error getting items: ${err}`);
        resolve(null);
      });
  });
}

async function getCurrencyValue(timestamp, item) {
  var stackSize = item.stackSize || 1;
  var currency = item.typeLine;

  return new Promise((resolve, reject) => {
    DB.get('select value from rates where date <= ? and item = ? order by date desc limit 1', [
      timestamp,
      currency,
    ])
      .then(async (row) => {
        if (row) {
          resolve(row.value * stackSize);
        } else {
          const currValue = await ItemPricer.getCurrencyByName(currency, timestamp);
          resolve(currValue * stackSize);
        }
      })
      .catch((err) => {
        logger.info(`Error getting currency value: ${err}`);
        resolve(null);
      });
  });
}

async function getTime(mapID) {
  return new Promise((resolve, reject) => {
    DB.get('select firstevent, lastevent from mapruns where id = ?', [mapID])
      .then((row) => {
        var startTime = dayjs(row.firstevent, 'YYYYMMDDHHmmss');
        var endTime = dayjs(row.lastevent, 'YYYYMMDDHHmmss');
        var runningTime = endTime.diff(startTime, 'seconds');
        resolve(runningTime);
      })
      .catch((err) => {
        logger.info(`Error getting running time: ${err}`);
        resolve(null);
      });
  });
}

function getSQL(q) {
  var str = ` 
    select areainfo.*, mapruns.*,
    (mapruns.xp - (select xp from mapruns m where m.id < mapruns.id and xp is not null order by m.id desc limit 1)) xpgained,
    (select count(1) from events e where e.id between mapruns.firstevent and mapruns.lastevent and e.event_type = 'slain') deaths
    from areainfo, 
  `;
  var params = [];

  if (q.mapcount) {
    switch (q.mapcounttype) {
      case 'maps':
        str += ` (select * from mapruns where gained > -1 order by id desc limit ${q.mapcount} ) mapruns `;
        break;
      case 'hours':
      case 'minutes':
      case 'days':
        let diff = {};
        diff[q.mapcounttype] = q.mapcount;
        let minDate = dayjs().subtract(diff).format('YYYYMMDDHHmmss');
        str += ` (select * from mapruns where gained > -1 and id >= ${minDate} order by id desc) mapruns `;
        break;
      default:
        str += ' (select * from mapruns where gained > -1) mapruns ';
        break;
    }
  } else {
    str += ' (select * from mapruns where gained > -1) mapruns ';
  }

  str += " where areainfo.id = mapruns.id and json_extract(runinfo, '$.ignored') is null ";

  if (q.blighted && q.blighted !== 'any') {
    str += ` and json_extract(runinfo, '$.blightedMap') is ${
      q.blighted === 'yes' ? 'not null' : 'null'
    } `;
  }

  if (q.mapname) {
    str += ' and name like ? ';
    params.push(`%${q.mapname}%`);
  }

  if (q.mapregion) {
    if (q.mapregion === 'none') {
      str += " and json_extract(runinfo, '$.atlasRegion') is null ";
    } else {
      str += " and json_extract(runinfo, '$.atlasRegion') = ? ";
      params.push(q.mapregion);
    }
  }

  if (q.mapdatemin && q.mapdatemax) {
    q.mapdatemin = q.mapdatemin.replace(/\D/g, '').padEnd(14, '0');
    q.mapdatemax = q.mapdatemax.replace(/\D/g, '').padEnd(14, '0');
    str += ' and mapruns.id between ? and ? ';
    params.push(q.mapdatemin, q.mapdatemax);
  } else if (q.mapdatemin) {
    q.mapdatemin = q.mapdatemin.replace(/\D/g, '').padEnd(14, '0');
    str += ' and mapruns.id >= ? ';
    params.push(q.mapdatemin);
  } else if (q.mapdatemax) {
    q.mapdatemax = q.mapdatemax.replace(/\D/g, '').padEnd(14, '0');
    str += ' and mapruns.id <= ? ';
    params.push(q.mapdatemax);
  }

  if (q.iiqmin && q.iiqmax) {
    str += ' and iiq between ? and ? ';
    params.push(q.iiqmin, q.iiqmax);
  } else if (q.iiqmin) {
    str += ' and iiq >= ? ';
    params.push(q.iiqmin);
  } else if (q.iiqmax) {
    str += ' and iiq <= ? ';
    params.push(q.iiqmax);
  }

  if (q.iirmin && q.iirmax) {
    str += ' and iir between ? and ? ';
    params.push(q.iirmin, q.iirmax);
  } else if (q.iirmin) {
    str += ' and iir >= ? ';
    params.push(q.iirmin);
  } else if (q.iirmax) {
    str += ' and iir <= ? ';
    params.push(q.iirmax);
  }

  if (q.packsizemin && q.packsizemax) {
    str += ' and packsize between ? and ? ';
    params.push(q.packsizemin, q.packsizemax);
  } else if (q.packsizemin) {
    str += ' and packsize >= ? ';
    params.push(q.packsizemin);
  } else if (q.packsizemax) {
    str += ' and packsize <= ? ';
    params.push(q.packsizemax);
  }

  if (q.playerlevelmin && q.playerlevelmax) {
    if (q.playerlevelmin === q.playerlevelmax) {
      q.playerlevelmax++;
    }
    str += ` and (
      firstevent between
        (select id from events where event_type = 'level' and event_text = ?) 
        and (select id from events where event_type = 'level' and event_text = ?)
      or lastevent between
        (select id from events where event_type = 'level' and event_text = ?) 
        and (select id from events where event_type = 'level' and event_text = ?)
    )`;
    params.push(q.playerlevelmin, q.playerlevelmax, q.playerlevelmin, q.playerlevelmax);
  } else if (q.playerlevelmin) {
    str +=
      " and lastevent > (select id from events where event_type = 'level' and event_text = ?) ";
    params.push(q.playerlevelmin);
  } else if (q.playerlevelmax) {
    str +=
      " and firstevent < (select id from events where event_type = 'level' and event_text = ?) ";
    params.push(q.playerlevelmax);
  }

  if (q.profitmin && q.profitmax) {
    str += ' and gained between ? and ? ';
    params.push(q.profitmin, q.profitmax);
  } else if (q.profitmin) {
    str += ' and gained >= ? ';
    params.push(q.profitmin);
  } else if (q.profitmax) {
    str += ' and gained <= ? ';
    params.push(q.profitmax);
  }

  if (q.levelmode === 'delveDepth') {
    if (q.levelmin && q.levelmax) {
      str += ' and depth between ? and ? ';
      params.push(q.levelmin, q.levelmax);
    } else if (q.levelmin) {
      str += ' and depth >= ? ';
      params.push(q.levelmin);
    } else if (q.levelmax) {
      str += ' and depth <= ? ';
      params.push(q.levelmax);
    }
  } else {
    if (q.levelmode === 'mapTier') {
      if (q.levelmin) q.levelmin = Number(q.levelmin) + 67;
      if (q.levelmax) q.levelmax = Number(q.levelmax) + 67;
    }
    if (q.levelmin && q.levelmax) {
      str += ' and level between ? and ? ';
      params.push(q.levelmin, q.levelmax);
    } else if (q.levelmin) {
      str += ' and level >= ? ';
      params.push(q.levelmin);
    } else if (q.levelmax) {
      str += ' and level <= ? ';
      params.push(q.levelmax);
    }
    if (q.levelmode === 'mapTier' && (q.levelmin || q.levelmax)) {
      str += ' and depth is null ';
    }
  }

  if (q.deathsmin || q.deathsmax) {
    str += `
      and exists( select 1 from (
        select mr.id, ifnull(x.deaths, 0) as deaths 
        from mapruns mr left join 
        (
          select m.id, count(1) as deaths 
          from mapruns m join events e on (e.id between m.firstevent and m.lastevent)
          where e.event_type = 'slain' 
          group by m.id
        ) x 
        on mr.id = x.id
       ) runs
    `;
    if (q.deathsmin && q.deathsmax) {
      str += ' where cast(deaths as integer) between ? and ? ';
      params.push(q.deathsmin, q.deathsmax);
    } else if (q.deathsmin) {
      str += ' where cast(deaths as integer) >= ? ';
      params.push(q.deathsmin);
    } else if (q.deathsmax) {
      str += ' where cast(deaths as integer) <= ? ';
      params.push(q.deathsmax);
    }
    str += ' and runs.id = mapruns.id )';
  }

  let encounterClause = '1=0 ';

  if (q.masters) {
    let arr = Array.isArray(q.masters) ? q.masters : [q.masters];
    let searchTag = q.mastersMissionType === 'any' ? 'encountered' : 'favourGained';
    arr.forEach((m) => {
      encounterClause += ` or json_extract(runinfo, '$.masters."${encounters[m]}".${searchTag}') is not null `;
    });
  }

  if (q.league) {
    let arr = Array.isArray(q.league) ? q.league : [q.league];
    arr.forEach((l) => {
      encounterClause += ` or json_extract(runinfo, '$.${encounters[l]}') is not null `;
    });
  }

  if (q.conquerors) {
    let arr = Array.isArray(q.conquerors) ? q.conquerors : [q.conquerors];
    let searchTag = '';
    switch (q.conquerorType) {
      case 'battle':
        searchTag = 'battle';
        break;
      case 'taunt':
        searchTag = 'encounter';
        break;
    }
    arr.forEach((c) => {
      encounterClause += ` or json_extract(runinfo, '$.conqueror."${encounters[c]}"${
        searchTag ? `.${searchTag}` : ''
      }') is not null `;
    });
  }

  if (q.other) {
    let arr = Array.isArray(q.other) ? q.other : [q.other];
    arr.forEach((o) => {
      encounterClause += ` or json_extract(runinfo, '$.${encounters[o]}') is not null `;
    });
  }

  if (encounterClause.length > 4) {
    str += ` and ( ${encounterClause} ) `;
  }

  return {
    sql: str,
    params: params,
  };
}

module.exports.search = search;
module.exports.emitter = emitter;
