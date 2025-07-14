const logger = require('electron-log');
const Constants = require('../../helpers/constants').default;
const EventEmitter = require('events');
const Parser = require('./FilterParser');
const ClientTxtWatcher = require('./ClientTxtWatcher');
const Utils = require('./Utils').default;
const DB = require('../db').default;

class MapRun extends EventEmitter {
  constructor(mapID, char) {
    super();
    this.init(mapID, char);
  }

  async init(mapID, char) {
    this.id = mapID;
    this.parser = await Parser.get(mapID, char);
    this.nav = {
      prev: await this.getPrevMap(mapID),
      next: await this.getNextMap(mapID),
    };
    this.info = await this.getInfo(mapID);
    this.mods = await this.getMods(mapID);
    this.events = await this.getEvents(mapID);
    this.items = await this.getItems(mapID);
    this.league = await this.getLeague(mapID);

    if (this.info.level) {
      this.parser.setAreaLevel(this.info.level);
    }

    this.emit('MapRunReady', mapID);
  }

  async getPrevMap(mapID) {
    return new Promise((resolve) => {
      DB.get(
        "select id from mapruns where id < ? and json_extract(runinfo, '$.ignored') is null order by id desc limit 1",
        [mapID]
      )
        .then((row) => {
          resolve(row && row.id !== -1 ? row.id : null);
        })
        .catch((err) => {
          logger.error(`Unable to get previous map: ${err}`);
          resolve(null);
        });
    });
  }

  async getNextMap(mapID) {
    return new Promise((resolve) => {
      DB.get(
        "select id from mapruns where id > ? and json_extract(runinfo, '$.ignored') is null order by id limit 1",
        [mapID]
      )
        .then((row) => {
          resolve(row && row.id !== -1 ? row.id : null);
        })
        .catch((err) => {
          logger.error(`Unable to get next map: ${err}`);
          resolve(null);
        });
    });
  }

  async getInfo(mapID) {
    return new Promise((resolve) => {
      DB.get(
        'select name, level, depth, iiq, iir, packsize, xp, kills, runinfo from areainfo, mapruns where mapruns.id = ? and areainfo.id = ?',
        [mapID, mapID]
      )
        .then((row) => {
          let info = {
            name: row.name,
            level: row.level,
            depth: row.depth,
            iiq: row.iiq,
            iir: row.iir,
            packsize: row.packsize,
            xp: row.xp,
            prevxp: row.prevxp,
            kills: row.kills,
          };
          Object.assign(info, JSON.parse(row.runinfo));
          resolve(info);
        })
        .catch((err) => {
          logger.error(`Unable to get map info: ${err}`);
          resolve(null);
        });
    });
  }

  async getMods(mapID) {
    return new Promise((resolve) => {
      DB.all('select mod from mapmods where area_id = ? order by cast(id as integer)', [mapID])
        .then((rows) => {
          resolve(rows.map((row) => row.mod));
        })
        .catch((err) => {
          logger.error(`Unable to get map mods: ${err}`);
          resolve(null);
        });
    });
  }

  async getEvents(mapID) {
    return new Promise((resolve) => {
      DB.all(
        `
          select events.* from mapruns, events 
          where mapruns.id = ?
          and events.id between mapruns.firstevent and mapruns.lastevent 
          order by events.id;
        `,
        [mapID]
      )
        .then((rows) => {
          resolve(
            rows
              .filter((row) => row.event_type !== 'chat')
              .map((row) => {
                return {
                  id: row.id,
                  event_type: row.event_type,
                  event_text: row.event_text,
                };
              })
          );
        })
        .catch((err) => {
          logger.error(`Failed to get run events: ${err}`);
          resolve(null);
        });
    });
  }

  async getItems(mapID) {
    return new Promise((resolve) => {
      DB.all(
        `
          select event.id, item.rarity, item.icon, item.value, item.stack_size, item.raw_data from run, event, item
          where run.id = ?
          and DATETIME(event.timestamp) between DATETIME(run.first_event) and DATETIME(run.last_event)
          and item.event_id = event.id;
        `,
        [mapID]
      )
        .then((rows) => {
          let items = {};
          rows.forEach((row) => {
            let data = JSON.parse(row.raw_data);
            if (!items[row.id]) {
              items[row.id] = [];
            }
            let secretName = '';
            if (row.rarity === 'Unique') {
              secretName = Utils.getItemName(row.icon);
              if (secretName) {
                if (secretName === 'Starforge' && data.elder) {
                  secretName = 'Voidforge';
                }
              }
            }
            if (secretName || row.value || row.stack_size) {
              if (secretName) data.secretName = secretName;
              if (row.value) data.value = row.value;
              if (row.stack_size) data.pickupStackSize = row.stacksize;
              items[row.id].push(JSON.stringify(data));
            } else {
              items[row.id].push(row.raw_data);
            }
          });
          resolve(items);
        })
        .catch((err) => {
          logger.error(`Failed to get run events: ${err}`);
          resolve(null);
        });
    });
  }

  async getLeague(mapID) {
    return new Promise((resolve) => {
      DB.get('SELECT name FROM league WHERE DATETIME(timestamp) < DATETIME(?) ORDER BY timestamp DESC LIMIT 1', [
        mapID,
      ])
        .then((row) => {
          resolve(row.name);
        })
        .catch((err) => {
          logger.error(`Failed to get league: ${err}`);
          resolve(null);
        });
    });
  }
} 

module.exports = MapRun;
