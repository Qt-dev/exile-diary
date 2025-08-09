const URL = require('url');
const Query = require('querystring');
const Constants = require('../../helpers/constants').default;
const ItemCategoryParser = require('../../helpers/item').default;
const ItemData = require('./ItemData');
const logger = require('electron-log');
const dayjs = require('dayjs');
const zlib = require('zlib');

const Utils = {
  getParams: (url) => {
    try {
      return Query.parse(URL.parse(url).query);
    } catch (err) {
      return null;
    }
  },

  getArea: (name) => {
    const area = Object.values(Constants.worldAreas).find((area) => area.name === name);
    return area ?? null;
  },

  isTown: (name) => {
    const area = Utils.getArea(name);
    if (area) {
      return area.isTown || area.isHideout || area.isLabyrinthAirlock;
    }

    return false;
  },

  isVaalArea: (name) => {
    const area = Utils.getArea(name);
    if (area) {
      return area.isVaalArea;
    }
    return false;
  },

  isLabArea: (name) => {
    const area = Utils.getArea(name);
    if (area) {
      return area.isLabyrinthArea || area.isLabyrinthAirlock || area.isLabyrinthBossArea;
    }
    return false;
  },

  getDisplayName: (item) => {
    let baseName = Utils.getBaseName(item);
    let uniqueName = item.secretName || Utils.getItemName(item.icon);
    let suffix = Utils.getSuffix(item);

    let displayName = '';

    if (uniqueName) {
      if (item.replica) {
        uniqueName = 'Replica ' + uniqueName;
      }
      displayName = uniqueName + ', ';
    }

    if (!item.typeLine.endsWith('Map')) {
      displayName += baseName;
    } else {
      displayName += item.typeLine;
    }

    if (suffix) {
      displayName += `<br/><span class='itemSuffix'>(${suffix})</span>`;
    }

    return displayName;
  },

  getBaseName: (item) => {
    if (item.typeLine) {
      return Utils.getBaseNameJSON(item);
    } else {
      logger.info('Invalid item format:');
      logger.info(JSON.stringify(item, null, ' '));
    }
  },

  getSuffix: (item) => {
    // special case for pseudo-items
    if (item.typeLine === '6-link Items' || item.typeLine === '6-socket Items') {
      return '';
    }

    if (item.frameType === 4) {
      // skill gems

      var suffix = '';
      var name = item.typeLine.replace('Superior ', '');
      var level = ItemData.getGemLevel(item);
      var quality = ItemData.getQuality(item);

      switch (name) {
        case 'Empower Support':
        case 'Enlighten Support':
        case 'Enhance Support':
          if (level >= 2) {
            return `Level ${level}`;
          }
          break;
        default:
          if (level >= 20 || (name === 'Brand Recall' && level >= 6)) {
            suffix += `Level ${level}`;
          }
          if (quality >= 20) {
            suffix += `${suffix ? ', ' : ''}${quality}% Quality`;
          }
          return suffix;
          break;
      }
    } else if (item.icon.includes('Helmets') && item.enchantMods) {
      //enchanted helmets

      return `${item.enchantMods[0]}`;
    } else if (item.typeLine.endsWith('Map') && !item.typeLine.startsWith('Maligaro')) {
      for (let i = 0; i < item.properties.length; i++) {
        let prop = item.properties[i];
        if (prop.name === 'Map Tier') {
          return `T${prop.values[0][0]}`;
        }
      }
      return '';
    } else if (item.typeLine === 'Ivory Watchstone') {
      if (!item.identified) {
        var name = Utils.getItemName(item.icon);
        if (Constants.watchstoneMaxCharges[name]) {
          return `${Constants.watchstoneMaxCharges[name]} uses remaining`;
        }
      } else {
        for (var i = 0; i < item.explicitMods.length; i++) {
          var mod = item.explicitMods[i];
          if (mod.endsWith('uses remaining')) {
            return mod;
            break;
          }
        }
      }
    } else {
      // suffix only displayed for normal, magic, rare, unique equipment
      if (!ItemCategoryParser.isNonStackable(item.typeLine) || item.frameType > 3) {
        return '';
      }

      let suffixes = [];

      // ilvl and influence are irrelevant for uniques
      if (item.frameType !== 3) {
        if (item.influences) {
          Object.keys(item.influences).forEach((inf) =>
            suffixes.push(`${inf.charAt(0).toUpperCase()}${inf.slice(1)}`)
          );
        }
        if (item.frameType !== 3 && item.ilvl && item.ilvl >= 82) {
          suffixes.push(`Lvl ${item.ilvl}`);
        }
      }

      var sockets = ItemData.getSockets(item);
      for (var i = 0; i < sockets.length; i++) {
        if (sockets[i].length >= 5) {
          suffixes.push(`${sockets[i].length}L`);
        }
      }

      return suffixes.join(', ');
    }
  },

  // for items in JSON format
  getBaseNameJSON: (item) => {
    // 3.10 clean basetype finally included in itemdata hallelujah!!!!!!
    if (item.extended && item.extended.baseType) {
      return item.extended.baseType;
    }

    var name = item.typeLine.replace('Superior ', '');
    if (item.frameType === 3 && item.typeLine.endsWith(' Map')) {
      name = item.identified ? item.name : Utils.getUniqueMap(name);
    } else if (item.identified && item.frameType === 1 && item.typeLine.includes(' Map')) {
      name = Utils.getBaseFromMagicMap(name);
    }
    return name;
  },

  getUniqueMap: (m) => {
    return Constants.uniqueMaps[m.replace('Superior ', '')];
  },

  getBaseFromMagicMap: (m) => {
    var baseMap = '';
    for (var i = 0; i < Constants.baseMaps.length; i++) {
      var elder = 'Elder ' + Constants.baseMaps[i];
      var shaped = 'Shaped ' + Constants.baseMaps[i];
      var blighted = 'Blighted ' + Constants.baseMaps[i];
      if (m.indexOf(shaped) !== -1 && shaped.length > baseMap.length) {
        baseMap = shaped;
      } else if (m.indexOf(elder) !== -1 && elder.length > baseMap.length) {
        baseMap = elder;
      } else if (m.indexOf(blighted) !== -1 && blighted.length > baseMap.length) {
        baseMap = blighted;
      } else if (
        m.indexOf(Constants.baseMaps[i]) !== -1 &&
        Constants.baseMaps[i].length > baseMap.length
      ) {
        baseMap = Constants.baseMaps[i];
      }
    }
    return baseMap;
  },

  getDeathCount: (deaths) => {
    return deaths === 0 ? '-' : deaths <= 6 ? '&#x1f480;'.repeat(deaths) : `&#x1f480; x ${deaths}`;
  },

  getMapTierString: (map) => {
    if (map.depth) {
      return `D${map.depth}`;
    } else if (map.level) {
      return map.level <= 67 ? `L${map.level}` : `T${map.level - 67}`;
    } else {
      return '';
    }
  },

  formatSignedNumber: (n, parens = false) => {
    var f = new Intl.NumberFormat();
    var sign = n > 0 ? '+' : '';
    var css = n < 0 ? 'negative' : 'positive';
    return `<span class='${css}'>${parens ? '(' : ''}${sign}${f.format(n)}${
      parens ? ')' : ''
    }</span>`;
  },

  getSockets: (item) => {
    if (!item.sockets) return null;

    var sockets = item.sockets;

    var currGroup = 0;
    var currSockets = '';
    var str = '';

    sockets.forEach((sock) => {
      if (sock.group === currGroup) {
        if (currSockets.length > 0) currSockets += '-';
        currSockets += sock.sColour;
      } else {
        str += (str.length > 0 ? ' ' : '') + currSockets;
        currGroup = sock.group;
        currSockets = sock.sColour;
      }
    });

    str += (str.length > 0 ? ' ' : '') + currSockets;

    return str;
  },

  getRunningTime: (firstevent, lastevent, format = 'HH:mm:ss', options) => {
    return dayjs
      .duration(dayjs(lastevent, 'YYYYMMDDHHmmss').diff(dayjs(firstevent, 'YYYYMMDDHHmmss')))
      .format(format, options);
  },

  getXPRate: (xp, firstevent, lastevent) => {
    var time = dayjs
      .duration(dayjs(lastevent, 'YYYYMMDDHHmmss').diff(dayjs(firstevent, 'YYYYMMDDHHmmss')))
      .format('s', { useGrouping: false });
    var f = new Intl.NumberFormat();
    return f.format(Math.round((xp * 3600) / time));
  },

  compress: (data) => {
    var json = JSON.stringify(data);
    return new Promise((resolve, reject) => {
      zlib.deflate(json, (err, buffer) => {
        if (err) {
          logger.info(`Error compressing JSON data: ${err}`);
          throw err;
        } else {
          logger.info(
            `JSON data successfully compressed (${json.length} to ${buffer.length} bytes)`
          );
          resolve(buffer);
        }
      });
    });
  },

  sleep: (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  getItemName: (icon) => {
    if (icon.includes('?')) {
      icon = icon.substring(0, icon.indexOf('?'));
    }
    // unique flasks have encoded URLs, need to extract flask ID
    if (
      icon.includes('https://web.poecdn.com/gen/image/') ||
      icon.includes('https://www.pathofexile.com/gen/image/')
    ) {
      var jsonData = Utils.getBase64EncodedData(icon);
      let path = jsonData.f.replace('2DItems/', '');
      if (Constants.uniques.byIconPath[path]) {
        return Constants.uniques.byIconPath[path];
      } else return null;
    } else {
      return Constants.uniqueIcons[icon] || null;
    }
  },

  getWatchstoneBaseType: (itemName) => {
    let t = Constants.craftableWatchstoneBaseTypes;
    for (let i = 0; i < t.length; i++) {
      if (itemName.includes(t[i])) {
        return t[i];
      }
    }
    return itemName;
  },

  getBase64EncodedData: (iconURL) => {
    var str = iconURL
      .replace('https://web.poecdn.com/gen/image/', '')
      .replace('https://www.pathofexile.com/gen/image/', '');
    str = str.substr(0, str.indexOf('/'));
    return JSON.parse(Buffer.from(str, 'base64').toString('utf8'))[2];
  },

  getTempleRoom: (q) => {
    return Constants.templeRoomQuotes[q] || null;
  },

  getPseudoItem: (itemType) => {
    switch (itemType) {
      case '6L':
        return {
          pseudo: true,
          w: 1,
          h: 1,
          icon: 'https://web.poecdn.com/image/Art/2DItems/Currency/CurrencyModValues.png?scale=1&scaleIndex=0',
          id: '6L',
          name: '6-link Items',
          typeLine: '6-link Items',
          ilvl: 0,
          frameType: 5,
        };
      case '6S':
        return {
          pseudo: true,
          w: 1,
          h: 1,
          icon: 'https://web.poecdn.com/image/Art/2DItems/Currency/CurrencyRerollSocketNumbers.png?scale=1&scaleIndex=0',
          id: '6S',
          name: '6-socket Items',
          typeLine: '6-socket Items',
          ilvl: 0,
          frameType: 5,
        };
      case 'GCP':
        return {
          pseudo: true,
          w: 1,
          h: 1,
          icon: 'https://web.poecdn.com/image/Art/2DItems/Currency/CurrencyGemQuality.png?scale=1&scaleIndex=0',
          id: 'GCP',
          name: '20% quality Gems',
          typeLine: '20% quality Gems',
          ilvl: 0,
          frameType: 5,
        };
      case 'RGB':
        return {
          pseudo: true,
          w: 1,
          h: 1,
          icon: 'https://web.poecdn.com/image/Art/2DItems/Currency/CurrencyRerollSocketColours.png?scale=1&scaleIndex=0',
          id: 'RGB',
          name: 'R-G-B linked Items',
          typeLine: 'R-G-B linked Items',
          ilvl: 0,
          frameType: 5,
        };
      default:
        throw new Exception(`Invalid pseudo item ${itemType}`);
    }
  },

  getAreaType: (area) => {
    let types = Object.keys(Constants.areas);
    for (let i = 0; i < types.length; i++) {
      let t = Constants.areas[types[i]];
      if (t.includes(area)) {
        return types[i];
      }
    }
    logger.info(`No area type found for "${area}"`);
    return 'Other';
  },

  // private league IDs end with (PL#####)
  isPrivateLeague: (league) => {
    if (!league) {
      return false;
    } else {
      return league.match(/\(PL[0-9]+\)$/);
    }
  },

  getEncounterIcon: (id) => {
    return `<img src='res/img/encountericons/${id}.png'/>`;
  },

  poeRunning: async () => {
    const processList = await require('ps-list')();
    return processList.some((proc) => {
      // cannot use Process for var name
      const formattedProcess = proc.name.toLowerCase();
      return (
        formattedProcess.startsWith('pathofexile') || formattedProcess.includes('pathofexile.exe')
      );
    });
  },
};

export default Utils;
