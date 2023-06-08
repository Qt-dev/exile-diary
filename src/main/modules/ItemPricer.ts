import SettingsManager from '../SettingsManager';
import RatesManager from '../RatesManager';
const logger = require('electron-log');
const Constants = require('../../helpers/constants').default;
const ItemData = require('./ItemData');
const ItemCategoryParser = require('./ItemCategoryParser');
const ItemFilter = require('./ItemFilter');
const Utils = require('./Utils').default;

const baseTypeRarities = ['Normal', 'Magic', 'Rare'];
const nonPricedCategories = [
  // captured beasts are not acquired as map loot
  // might be relevant for calculating net worth though?
  'Captured Beast',
  // value not tracked for heist items
  'Contract',
  'Blueprint',
  'Trinket',
  'Heist Brooch',
  'Heist Cloak',
  'Heist Gear',
  'Heist Tool',
];

const log = false;

let ratesCache = {};

async function getRatesFor(eventId : string, league = SettingsManager.get('activeProfile').league) {
  const date = eventId.slice(0, 8);
  if(!ratesCache[date] || !ratesCache[date][league]) {
    logger.info('No rates for this date, fetching...');
    ratesCache[date] = ratesCache[date] || {};
    ratesCache[date][league] = await RatesManager.fetchRatesForDay(league, eventId);
  };
  return ratesCache[date][league] ?? {};
}


async function price(item, league =  SettingsManager.get('activeProfile').league) {
  // Absolutely unreasonable amounts of pricing trouble. Enough of this!
  if (item.typeline === "Rogue's Marker") {
    return 0;
  }

  if (item.rarity === 'Quest Item') {
    // can't be traded
    return 0;
  }
  if (nonPricedCategories.includes(item.category)) {
    return 0;
  }

  const rates = await getRatesFor(item.event_id, league);
  if (!rates) {
    return 0;
  }

  item.parsedItem = JSON.parse(item.rawdata);

  let minItemValue = 0;
  const filter = ItemFilter.filter(item.parsedItem);
  if (filter && filter.ignore) {
    if (filter.minValue) {
      if (filter.option && filter.option === 'fullStack' && item.parsedItem.maxStackSize) {
        // logger.info(`Minvalue is ${filter.minValue}, stacksize of ${item.parsedItem.typeLine} is ${item.parsedItem.maxStackSize}, minvalue per card is ${filter.minValue/item.parsedItem.maxStackSize}`);
        minItemValue = filter.minValue / item.parsedItem.maxStackSize;
      } else {
        minItemValue = filter.minValue;
      }
    } else {
      // unconditional ignore - stop here and get vendor recipe instead, if any
      return getVendorRecipeValue(item);
    }
  }

  if (item.typeline.includes('Watchstone')) {
    return getWatchstoneValue(item);
  }

  let helmetBaseValue;

  if (item.rarity === 'Unique') {
    if (item.category === 'Maps') {
      return getUniqueMapValue(item);
    } else {
      // handle helmet enchants - if item is a helmet, don't return value yet
      if (item.category === 'Helmets') {
        helmetBaseValue = getUniqueItemValue(item);
      } else {
        return getUniqueItemValue(item);
      }
    }
  } else {
    // value not tracked for non-unique flasks and jewels
    if (
      (item.typeline.includes('Flask') || item.typeline.includes('Jewel')) &&
      baseTypeRarities.includes(item.rarity)
    ) {
      return 0;
    }
  }

  if (item.typeline.includes("Maven's Invitation")) {
    return getValueFromTable(item, 'Invitation', item.typeline);
  }

  //Invitations
  if (item.typeline.includes('Polaric Invitation')) {
    return getValueFromTable(item, 'Invitation', item.typeline);
  }

  if (item.typeline.includes('Screaming Invitation')) {
    return getValueFromTable(item, 'Invitation', item.typeline);
  }

  if (item.typeline.includes('Incandescent Invitation')) {
    return getValueFromTable(item, 'Invitation', item.typeline);
  }

  if (item.typeline.includes('Writhing Invitation')) {
    return getValueFromTable(item, 'Invitation', item.typeline);
  }

  //Memories
  if (item.typeline.includes("'s Memory")) {
    return getValueFromTable(item, 'Fragment', item.typeline);
  }

  if (
    item.category === 'Map Fragments' ||
    (item.category === 'Labyrinth Items' && item.typeline.endsWith('to the Goddess')) ||
    item.typeline === 'Simulacrum Splinter' ||
    item.typeline === 'Crescent Splinter' ||
    (item.typeline.includes('Timeless') && item.typeline.includes('Splinter')) ||
    item.typeline.startsWith('Splinter of')
  ) {
    return getValueFromTable(item, 'Fragment');
  }
  if (item.category === 'Harvest Seed') {
    return getSeedValue(item);
  }
  if (item.rarity === 'Currency' || item.typeline.includes('Incubator')) {
    return getCurrencyValue(item);
  }
  if (item.category === 'Maps') {
    return getMapValue(item);
  }
  if (item.rarity === 'Divination Card') {
    return getValueFromTable(item, 'DivinationCard');
  }
  if (item.rarity === 'Prophecy') {
    return getValueFromTable(item, 'Prophecy');
  }
  if (item.category && item.category.includes('Skill Gems')) {
    return getGemValue(item);
  }

  if (
    baseTypeRarities.includes(item.rarity) &&
    Constants.baseTypeCategories.includes(item.category)
  ) {
    // handle helmet enchants - if item is a helmet, don't return value yet
    if (item.category === 'Helmets') {
      helmetBaseValue = getBaseTypeValue(item);
    } else {
      return getBaseTypeValue(item);
    }
  }

  if (helmetBaseValue >= 0) {
    const helmetEnchantValue = getHelmetEnchantValue(item);
    return Math.max(helmetBaseValue, helmetEnchantValue);
  }

  logger.info(`Unable to get value for item ${item.id || '(no id)'}:`);
  logger.info(JSON.stringify(item.parsedItem));
  return 0;

  /* sub-functions for getting value per item type*/

  function getValueFromTable(item, table, inputIdentifier = '') {
    const { alternateSplinterPricing } = SettingsManager.getAll();

    // RIP harvest :-(
    if (table === 'Seed') return 0;

    if (!rates[table]) {
      logger.info(`No price list found for category ${table}, returning 0`);
      return 0;
    }

    const identifier = inputIdentifier.length > 0 ? inputIdentifier :  item.typeLine;

    // special handling for currency shards - always price at 1/20 of the whole orb
    if (identifier && Constants.shardTypes[identifier]) {
      let wholeOrb = Constants.shardTypes[identifier];
      let shardValue = rates[table][wholeOrb] / 20;
      let stackValue = shardValue * item.stacksize;
      if (log) {
        if (shardValue >= minItemValue) {
          logger.info(
            `[${table}] : ${identifier} => ${shardValue} x ${item.stacksize} = ${stackValue}`
          );
        } else {
          logger.info(`[${table}] : ${identifier} => ${shardValue} < ${minItemValue}, ignoring`);
        }
      }
      return shardValue >= minItemValue ? stackValue : 0;
    }

    if (identifier && !!alternateSplinterPricing && Constants.fragmentTypes[identifier]) {
      let fragmentType = Constants.fragmentTypes[identifier];
      let splinterValue =
        rates[fragmentType.itemType || 'Fragment'][fragmentType.item] / fragmentType.stackSize;
      let stackValue = splinterValue * item.stacksize;
      if (splinterValue >= minItemValue) {
        logger.info(
          `Using alternate splinter pricing : ${identifier} => ${splinterValue} x ${item.stacksize} = ${stackValue}`
        );
      } else {
        logger.info(
          `Using alternate splinter pricing : ${identifier} => ${splinterValue} < ${minItemValue}, ignoring`
        );
      }
      return splinterValue >= minItemValue ? stackValue : 0;
    }

    // handle items that stack - minItemValue is for exactly 1 of the item
    let unitValue = rates[table][identifier];

    if (!unitValue) {
      if (log) {
        logger.info(`[${table}] : ${identifier} => No value found, returning 0`);
      }
      return 0;
    } else if (unitValue < minItemValue) {
      if (log) {
        logger.info(`[${table}] : ${identifier} => ${unitValue} < ${minItemValue}, ignoring`);
      }
      return 0;
    }

    let value = unitValue * (item.stacksize || 1);
    if (log) {
      if (value >= minItemValue) {
        logger.info(`[${table}] : ${identifier} => ${value}`);
      } else {
        logger.info(`[${table}] : ${identifier} => ${value} < ${minItemValue}, ignoring`);
      }
    }
    return value >= minItemValue ? value : 0;
  }

  function getHelmetEnchantValue(item) {
    if (!item.parsedItem.enchantMods) return 0;
    const identifier = item.parsedItem.enchantMods;
    return getValueFromTable(item, 'HelmetEnchant', identifier);
  }

  function getWatchstoneValue(item) {
    let identifier =
      item.rarity === 'Magic'
        ? Utils.getWatchstoneBaseType(item.typeline)
        : item.name || Utils.getItemName(item.icon);
    if (!item.identified) {
      if (Constants.watchstoneMaxCharges[identifier]) {
        identifier += `, ${Constants.watchstoneMaxCharges[identifier]} uses remaining`;
      }
    } else {
      for (let i = 0; i < item.parsedItem.explicitMods.length; i++) {
        const mod = item.parsedItem.explicitMods[i];
        if (mod.endsWith('uses remaining')) {
          identifier += `, ${mod}`;
          break;
        }
      }
    }
    return getValueFromTable(item, 'Watchstone', identifier);
  }

  function getGemValue(item) {
    let typeline = item.typeline.replace('Superior ', '');
    let level = ItemData.getGemLevel(item.parsedItem);
    let quality = ItemData.getQuality(item.parsedItem);
    let corrupted = item.parsedItem.corrupted;
    let identifier = getFullGemIdentifier(typeline, level, quality, corrupted);

    let value = getValueFromTable(item, 'SkillGem', identifier);
    if (!value && item.parsedItem.hybrid && item.parsedItem.hybrid.baseTypeName) {
      let altIdentifier = getFullGemIdentifier(
        item.parsedItem.hybrid.baseTypeName,
        level,
        quality,
        corrupted
      );
      value = value = getValueFromTable(item, 'SkillGem', altIdentifier);
    }

    let vendorValue = getVendorRecipeValue(item);
    return vendorValue ? Math.max(value, vendorValue.val) : value;
  }

  function getFullGemIdentifier(str, level, quality, corrupted) {
    switch (str) {
      case 'Empower Support':
      case 'Enlighten Support':
      case 'Enhance Support':
        if (level >= 2) str += ` L${level}`;
        break;
      case 'Brand Recall':
        if (level >= 6) str += ` L${level}`;
        if (quality >= 20) str += ` Q${quality}`;
        break;
      default:
        if (level >= 20) str += ` L${level}`;
        if (quality >= 20) {
          str += ` Q${quality}`;
        }
        break;
    }
    if (corrupted) {
      str += ' (Corrupted)';
    }
    return str;
  }

  function getMapValue(item) {
    let name = item.typeline.replace('Superior ', '');
    const tier = ItemData.getMapTier(item.parsedItem);
    const series = getSeries(item.parsedItem.icon);

    if (item.rarity === 'Magic' && item.identified) {
      // strip affixes from magic item name
      name = Utils.getBaseFromMagicMap(name);
      // special handling for name collision >:\
      if (name === 'Vaal Temple Map' && tier < 16) {
        name = 'Temple Map';
      }
    }
    const identifier = `${name} T${tier} ${series}`;
    // workaround poe.ninja bug
    const tempIdentifier = identifier.replace('Delirium', 'Delerium');
    return getValueFromTable(item, 'Map', identifier) || getValueFromTable(item, 'Map', tempIdentifier);

    function getSeries(icon) {
      if (icon.includes('https://web.poecdn.com/gen/image/')) {
        return getSeriesBase64(icon);
      }

      if (icon.includes('mn=')) {
        if (icon.includes('mn=1')) return 'Atlas2-3.4';
        if (icon.includes('mn=2')) return 'Atlas2';
        if (icon.includes('mn=3')) return 'Synthesis';
        if (icon.includes('mn=4')) return 'Legion';
        if (icon.includes('mn=5')) return 'Blight';
        if (icon.includes('mn=6')) return 'Metamorph';
        if (icon.includes('mn=7')) return 'Delirium';
        if (icon.includes('mn=8')) return 'Harvest';
        if (icon.includes('mn=9')) return 'Heist';
        if (icon.includes('mn=10')) return 'Ritual';
        if (icon.includes('mn=11')) return 'Expedition';
      } else {
        if (icon.includes('2DItems/Maps/AtlasMaps')) return 'Atlas';
        if (icon.includes('2DItems/Maps/Map')) return 'Pre 2.4';
        if (icon.includes('2DItems/Maps/act4maps')) return 'Pre 2.0';
      }
      logger.info(`Invalid map item icon: ${icon}`);
      return '';
    }
  }

  function getSeriesBase64(icon) {
    const data = Utils.getBase64EncodedData(icon);

    if (data.mn) {
      switch (data.mn) {
        case 1:
          return 'Atlas2-3.4';
        case 2:
          return 'Atlas2';
        case 3:
          return 'Synthesis';
        case 4:
          return 'Legion';
        case 5:
          return 'Blight';
        case 6:
          return 'Metamorph';
        case 7:
          return 'Delirium';
        case 8:
          return 'Harvest';
        case 9:
          return 'Heist';
        case 10:
          return 'Ritual';
        case 11:
          return 'Expedition';
      }
    } else {
      if (data.f.includes('2DItems/Maps/AtlasMaps')) return 'Atlas';
      if (data.f.includes('2DItems/Maps/Map')) return 'Pre 2.4';
      if (data.f.includes('2DItems/Maps/act4maps')) return 'Pre 2.0';
    }

    logger.info(`Invalid map item icon: ${icon}`);
    return '';
  }

  function getSeedValue(item) {
    const identifier = item.typeline + (getSeedLevel(item) >= 76 ? ' L76+' : '');
    return getValueFromTable(item, 'Seed', identifier);

    function getSeedLevel(item) {
      for (let i = 0; i < item.parsedItem.properties.length; i++) {
        let prop = item.parsedItem.properties[i];
        if (prop.name === 'Spawns a Level %0 Monster when Harvested') {
          return prop.values[0][0];
        }
      }
    }
  }

  function getBaseTypeValue(item) {
    if (item.parsedItem.ilvl < 82) {
      return getVendorRecipeValue(item);
    }

    let identifier = item.typeline.replace('Superior ', '');
    if (identifier.endsWith('Talisman')) return 0;

    if (item.rarity === 'Magic' && item.identified) {
      // strip affixes from magic item name
      identifier = ItemCategoryParser.getEquipmentBaseType(identifier);
    }
    identifier += ` L${item.parsedItem.ilvl > 86 ? 86 : item.parsedItem.ilvl}`;
    if (item.parsedItem.influences) {
      let inf = item.parsedItem.influences;
      if (inf.shaper) {
        identifier += ' Shaper';
      } else if (inf.elder) {
        identifier += ' Elder';
      } else if (inf.crusader) {
        identifier += ' Crusader';
      } else if (inf.redeemer) {
        identifier += ' Redeemer';
      } else if (inf.warlord) {
        identifier += ' Warlord';
      } else if (inf.hunter) {
        identifier += ' Hunter';
      }
    }

    let value = getValueFromTable(item, 'BaseType', identifier);
    let vendorValue = getVendorRecipeValue(item);
    return vendorValue ? Math.max(value, vendorValue.val) : value;
  }

  function getVendorRecipeValue(item) {
    let vendorValue;

    const sockets = ItemData.getSockets(item.parsedItem);
    if (sockets.length) {
      if (ItemData.countSockets(sockets) === 6) {
        if (sockets.length === 1) {
          // Recipe Pricing
          // TODO: Centralize these
          vendorValue = rates['Currency']['Orb of Fusing'] * 20;
        } else {
          vendorValue = rates['Currency']["Jeweller's Orb"] * 7;
        }
      } else {
        for (let i = 0; i < sockets.length; i++) {
          if (sockets[i].includes('R') && sockets[i].includes('G') && sockets[i].includes('B')) {
            vendorValue = rates['Currency']['Chromatic Orb'];
          }
        }
      }
    } else if (item.category && item.category.includes('Skill Gems')) {
      let quality = ItemData.getQuality(item.parsedItem);
      if (quality >= 20) {
        vendorValue = rates['Currency']["Gemcutter's Prism"];
      }
    }

    if (!vendorValue) {
      return { isVendor: false, val: 0};
    } else {
      let currFilter = ItemFilter.getForCategory('currency');
      if (currFilter.ignore) {
        if (currFilter.minValue) {
          if (vendorValue < currFilter.minValue) {
            if (log) {
              logger.info(
                `Vendor value ${vendorValue} < currency min value ${currFilter.minValue}, returning`
              );
            }
            return { isVendor: false, val: 0};
          }
        } else {
          if (log) {
            logger.info(`Ignoring currency unconditionally?!? Returning 0`);
          }
          return { isVendor: false, val: 0};
        }
      }

      if (log) {
        logger.info('Returning vendor value ' + vendorValue);
      }
      return { isVendor: true, val: vendorValue };
    }
  }

  function getCurrencyValue(item) {
    // temporary workaround poe.ninja bug
    // if(item.typeline === "Stacked Deck") return 4 * item.stacksize;

    switch (item.typeline) {
      case 'Chaos Orb':
        if (minItemValue > 1) {
          // if we only care about currency greater than 1c in value, chaos orbs are ignored
          return 0;
        } else {
          return item.stacksize;
        }
      case 'Chaos Shard':
        if (minItemValue > 1 / 20) {
          return 0;
        } else {
          return item.stacksize / 20;
        }
      default:
        return getValueFromTable(item, 'Currency');
    }
  }

  function getUniqueMapValue(item) {
    const name = item.name || Utils.getItemName(item.icon);
    const tier = ItemData.getMapTier(item.parsedItem);
    const typeline = item.typeline.replace('Superior ', '');

    const identifier = `${name} T${tier} ${typeline}`;

    return getValueFromTable(item, 'UniqueMap', identifier);
  }

  function getUniqueItemValue(item) {
    let identifier = item.name || Utils.getItemName(item.icon) || item.typeline;

    if (identifier === 'Grand Spectrum' || identifier === 'Combat Focus') {
      identifier += ` ${item.typeline}`;
    } else if (identifier === 'Impresence') {
      const constiant = item.icon
        .replace('https://web.poecdn.com/image/Art/2DItems/Amulets/Elder', '')
        .replace('.png', '');
      identifier += ` (${constiant})`;
    }

    const links = getLinks(item.parsedItem);
    identifier += links;
    identifier += getAbyssSockets(identifier);

    if (item.identified === 0) {
      let possibleIdentifiers : string[] = [];
      if (identifier === 'Agnerod') {
        possibleIdentifiers = [
          `Agnerod East${links}`,
          `Agnerod North${links}`,
          `Agnerod South${links}`,
          `Agnerod West${links}`,
        ];
      } else if (identifier === "Atziri's Splendour") {
        possibleIdentifiers = [
          `Atziri's Splendour${links} (Armour)`,
          `Atziri's Splendour${links} (Armour/ES)`,
          `Atziri's Splendour${links} (Armour/ES/Life)`,
          `Atziri's Splendour${links} (Armour/Evasion)`,
          `Atziri's Splendour${links} (Armour/Evasion/ES)`,
          `Atziri's Splendour${links} (ES)`,
          `Atziri's Splendour${links} (Evasion)`,
          `Atziri's Splendour${links} (Evasion/ES)`,
          `Atziri's Splendour${links} (Evasion/ES/Life)`,
        ];
      } else if (identifier === "Yriel's Fostering") {
        possibleIdentifiers = [
          `Yriel's Fostering${links} (Bleeding)`,
          `Yriel's Fostering${links} (Maim)`,
          `Yriel's Fostering${links} (Poison)`,
        ];
      } else if (identifier === "Doryani's Invitation") {
        possibleIdentifiers = [
          `Doryani's Invitation (Cold)`,
          `Doryani's Invitation (Fire)`,
          `Doryani's Invitation (Lightning)`,
          `Doryani's Invitation (Physical)`,
        ];
      } else if (identifier === "Volkuur's Guidance") {
        possibleIdentifiers = [
          `Volkuur's Guidance (Cold)`,
          `Volkuur's Guidance (Fire)`,
          `Volkuur's Guidance (Lightning)`,
        ];
      } else if (identifier === 'Vessel of Vinktar') {
        possibleIdentifiers = [
          'Vessel of Vinktar (Added Attacks)',
          'Vessel of Vinktar (Penetration)',
          'Vessel of Vinktar (Added Spells)',
          'Vessel of Vinktar (Conversion)',
        ];
      }
      if (possibleIdentifiers.length > 0) {
        return getValueUnidWithconstiants(possibleIdentifiers);
      }
    }

    let value = getValueFromTable(item, 'UniqueItem', identifier);
    let vendorValue = getVendorRecipeValue(item);
    return vendorValue ? Math.max(value, vendorValue.val) : value;
  }

  function getValueUnidWithconstiants(possibleIdentifiers) {
    let min = 9999999;
    let max = -1;

    possibleIdentifiers.forEach((ident) => {
      const val = rates['UniqueItem'][ident];
      if (val < min) min = val;
      if (val > max) max = val;
    });

    const value = (min + max) / 2;
    return value >= minItemValue ? value : 0;
  }

  function getLinks(item) {
    const sockets = ItemData.getSockets(item);
    for (let i = 0; i < sockets.length; i++) {
      if (sockets[i].length >= 5) {
        return ` ${sockets[i].length}L`;
      }
    }
    return '';
  }

  function getAbyssSockets(identifier) {
    const abyssItems = [
      'Bubonic Trail',
      'Tombfist',
      'Lightpoacher',
      'Shroud of the Lightless',
      // currently bugged on poe.ninja
      //"Hale Negator",
      //"Command of the Pit"
    ];
    if (!abyssItems.includes(identifier)) return '';

    const numAbyssSockets = item.sockets.match(/A/g).length;
    switch (numAbyssSockets) {
      case 1:
        return ` (1 Jewel)`;
        break;
      case 2:
        return ` (2 Jewels)`;
        break;
      default:
        return '';
        break;
    }
  }
}

async function getCurrencyByName(timestamp, type, league) {
  const rates = await getRatesFor(timestamp, league);
  if (!rates) {
    return 0;
  }
  const value = rates['Currency'][type];
  if (!value) {
    //logger.info(`Could not find value for ${item.typeline}`);
    return 0;
  } else {
    //logger.info(`${type} => ${value}`);
    return value;
  }
}

module.exports.price = price;
module.exports.getRatesFor = getRatesFor;
module.exports.getCurrencyByName = getCurrencyByName;
