import SettingsManager from '../SettingsManager';
import RatesManager from '../RatesManager';
import { writeFile } from 'fs/promises';
import Constants from '../../helpers/constants';
import dayjs from 'dayjs';
const logger = require('electron-log');
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
const nonPricedTypelines = ['Talisman'];

const abyssItems = [
  'Bubonic Trail',
  'Tombfist',
  'Lightpoacher',
  'Shroud of the Lightless',
  // Not priced per Socket on poe.ninja
  //"Hale Negator",
  //"Command of the Pit"
];

const log = false;

let ratesCache = {};
let matchers = {};

type PriceMatch = {
  name: string;
  test: (item: any) => boolean;
  calculateValue: (item: any, minItemValue?: number) => number;
};

/**
 * Base function to get all of the rates for one league for one day
 * @param eventId ID of the event we are trying to get the rates for
 * @param league Name of the league we are trying to get the rates for
 * @returns the rates for the given event and league
 */
async function getRatesFor(eventId: string, league = SettingsManager.get('activeProfile').league) {
  const date = eventId.slice(0, 8);
  if (!ratesCache[date] || !ratesCache[date][league]) {
    logger.info('No rates for this date, fetching...');
    ratesCache[date] = ratesCache[date] || {};
    ratesCache[date][league] = await RatesManager.fetchRatesForDay(league, date);
    // writeFile(`./${date}.json`, JSON.stringify(ratesCache[date][league])); // In case you need to inspect the full rates for a day
  }
  return ratesCache[date][league] ?? {};
}

class PriceMatcher {
  ratesCache: {};
  date: string;
  MapSeries = [
    { id: 1, name: 'Atlas2-3.4' },
    { id: 2, name: 'Atlas2' },
    { id: 3, name: 'Synthesis' },
    { id: 4, name: 'Legion' },
    { id: 5, name: 'Blight' },
    { id: 6, name: 'Metamorph' },
    { id: 7, name: 'Delirium' },
    { id: 8, name: 'Harvest' },
    { id: 9, name: 'Heist' },
    { id: 10, name: 'Ritual' },
    { id: 11, name: 'Expedition' },
    { id: 18, name: 'Ancestor' },
  ];

  DefaultGemFormat = {
    test: (name) => true,
    generateString: (name, level, quality, corrupted) => {
      let formattedString = `${name}${level >= 4 ? ` L${level}` : ''}`;
      if (quality === 23) {
        formattedString += ` Q${quality}`;
      } else if (quality >= 20) {
        formattedString += ' Q20';
      }
      return formattedString;
    },
  };

  GemFormats = [
    {
      test: (name) => name.includes('Awakened'),
      generateString: (name, level, quality, corrupted) => {
        let formattedString = `${name}${level >= 4 ? ` L${level}` : ''}`;
        if (quality === 23) {
          formattedString += ` Q${quality}`;
        } else if (quality >= 20) {
          formattedString += ' Q20';
        }
        return formattedString;
      },
    },
    {
      test: (name) =>
        name.includes('Empower') || name.includes('Enlighten') || name.includes('Enhance'),
      generateString: (name, level, quality, corrupted) => {
        return `${name}${level >= 2 ? ` L${level}` : ''}`;
      },
    },
    {
      test: (name) => name.includes('Brand Recall'),
      generateString: (name, level, quality, corrupted) => {
        let formattedString = `${name}${level >= 6 ? ` L${level}` : ''}`;
        if (quality === 23) {
          formattedString += ` Q${quality}`;
        } else if (quality >= 20) {
          formattedString += ' Q20';
        }
        return formattedString;
      },
    },
  ];

  DefaultPriceMatch: PriceMatch = {
    name: 'Default',
    test: (item: any) => true,
    calculateValue: (item: any, minItemValue: number = 0) => 0,
  };
  PriceMatches: PriceMatch[] = [
    {
      name: "Rogue's Marker",
      test: (item: any) => item.typeline === "Rogue's Marker",
      calculateValue: (item: any, minItemValue: number = 0) => 0,
    },
    {
      name: 'Quest Item',
      test: (item: any) => item.rarity === 'Quest Item',
      calculateValue: (item: any, minItemValue: number = 0) => 0,
    },
    {
      name: 'Non-Priced Category',
      test: (item: any) => nonPricedCategories.includes(item.category),
      calculateValue: (item: any, minItemValue: number = 0) => 0,
    },
    {
      name: 'Other Items to Ignore',
      test: (item: any) =>
        !!nonPricedTypelines.find((type) => item.typeline && item.typeline.includes(type)),
      calculateValue: (item: any, minItemValue: number = 0) => 0,
    },
    {
      name: 'Currency Shards',
      test: (item: any) => Constants.shardTypes[item.typeline],
      calculateValue: (item: any, minItemValue: number = 0) =>
        this.getCurrencyShardStackValue(minItemValue, item, item.typeline),
    },
    {
      name: 'Splinters',
      test: (item: any) =>
        !!SettingsManager.get('alternateSplinterPricing') && Constants.fragmentTypes[item.typeline],
      calculateValue: (item: any, minItemValue: number = 0) =>
        this.getSplinterStackValue(minItemValue, item, item.typeline),
    },
    {
      name: 'Other Fragments',
      test: (item: any) =>
        item.category === 'Map Fragments' ||
        (item.category === 'Labyrinth Items' && item.typeline.endsWith('to the Goddess')),
      calculateValue: (item: any, minItemValue: number = 0) =>
        this.getValue(item, 'Fragment', item.typeline, minItemValue),
    },
    {
      name: 'Tattoo',
      test: (item: any) => item.typeline && item.typeline.includes('Tattoo'),
      calculateValue: (item: any, minItemValue: number = 0) =>
        this.getValue(item, 'Tattoo', item.typeline, minItemValue),
    },
    {
      name: 'Omen',
      test: (item: any) => item.typeline && item.typeline.includes('Omen'),
      calculateValue: (item: any, minItemValue: number = 0) =>
        this.getValue(item, 'Omen', item.typeline, minItemValue),
    },
    {
      name: 'Incubator',
      test: (item: any) => item.typeline && item.typeline.includes('Incubator'),
      calculateValue: (item: any, minItemValue: number = 0) =>
        this.getValue(item, 'Currency', item.typeline, minItemValue),
    },
    {
      name: 'Currency',
      test: (item: any) => item.rarity === 'Currency',
      calculateValue: (item: any, minItemValue: number = 0) =>
        this.getValue(item, 'Currency', item.typeline, minItemValue),
    },
    {
      name: 'Unique Maps',
      test: (item: any) => item.category === 'Maps' && item.rarity === 'Unique',
      calculateValue: (item: any, minItemValue: number = 0) =>
        this.getUniqueMapValue(item, minItemValue),
    },
    {
      name: 'Unique Helmets',
      test: (item: any) => item.category === 'Helmets' && item.rarity === 'Unique',
      calculateValue: (item: any, minItemValue: number = 0) =>
        Math.max(
          this.getUniqueItemValue(item, minItemValue),
          this.getHelmetEnchantValue(item, minItemValue)
        ),
    },
    {
      name: 'Non-Unique Flasks and Jewels',
      test: (item: any) =>
        item.typeline &&
        (item.typeline.includes('Flask') || item.typeline.includes('Jewel')) &&
        baseTypeRarities.includes(item.rarity),
      calculateValue: (item: any, minItemValue: number = 0) => 0,
    },
    {
      name: 'Non-Unique Helmets',
      test: (item: any) => item.category === 'Helmets' && baseTypeRarities.includes(item.rarity),
      calculateValue: (item: any, minItemValue: number = 0) =>
        Math.max(
          this.getBaseTypeValue(item, minItemValue),
          this.getHelmetEnchantValue(item, minItemValue)
        ),
    },
    {
      name: 'Skill Gem',
      test: (item: any) => item.category === 'Skill Gems',
      calculateValue: (item: any, minItemValue: number = 0) => this.getGemValue(minItemValue, item),
    },
    {
      name: 'Invitations',
      test: (item: any) => item.typeline && item.typeline.includes('Invitation'),
      calculateValue: (item: any, minItemValue: number = 0) =>
        this.getValue(item, 'Invitation', item.typeline, minItemValue),
    },
    {
      name: 'Memory',
      test: (item: any) => item.typeline && item.typeline.includes("'s Memory"),
      calculateValue: (item: any, minItemValue: number = 0) =>
        this.getValue(item, 'Memory', item.typeline, minItemValue),
    },
    {
      name: 'Map',
      test: (item: any) => item.category === 'Maps',
      calculateValue: (item: any, minItemValue: number = 0) => this.getMapValue(item, minItemValue),
    },
    {
      name: 'Divination Card',
      test: (item: any) => item.category === 'Divination Card',
      calculateValue: (item: any, minItemValue: number = 0) =>
        this.getDivinationCardValue(item, minItemValue),
    },
    {
      name: 'Unique Items',
      test: (item: any) => item.rarity === 'Unique',
      calculateValue: (item: any, minItemValue: number = 0) =>
        this.getUniqueItemValue(item, minItemValue),
    },
    {
      name: 'Non-Unique Bases',
      test: (item: any) => baseTypeRarities.includes(item.rarity),
      calculateValue: (item: any, minItemValue: number = 0) =>
        this.getBaseTypeValue(item, minItemValue),
    },
    // // Removed from Poe.Ninja
    // {
    //   name: "Watchstone",
    //   test: (item: any) => item.typeline.includes('Watchstone'),
    //   calculateValue: (item : any, minItemValue: number = 0) => this.getWatchstoneValue(item),
    // },
    // // Removed from Poe.Ninja
    // {
    //   name: "Seeds",
    //   test: (item: any) => item.category === 'Harvest Seed',
    //   calculateValue: (item : any, minItemValue: number = 0) => this.getSeedValue(item),
    // },
    // // Removed from Poe.Ninja
    // {
    //   name: "Prophecy",
    //   test: (item: any) => item.category === 'Stackable Currency' && item.typeline.includes('Prophecy'),
    //   calculateValue: (item : any, minItemValue: number = 0) => this.getValue(item, 'Prophecy', item.typeline, minItemValue),
    // },
  ];

  constructor(date: string) {
    this.date = date;
    this.ratesCache = {};
  }

  async fetchRates(league = SettingsManager.get('activeProfile').league) {
    this.ratesCache = await getRatesFor(this.date, league);
  }

  hasBrokenRates() {
    return Object.keys(this.ratesCache).length === 0;
  }

  /**
   * Base function to get value from the rates table
   * @param {any}     item                  Item to get the value of
   * @param {string}  table                 Name of the table to get the value from
   * @param {string}  [inputIdentifier='']  Override of an item identifier if need be
   * @returns {number}  Value of the item in chaos
   */
  getValue(item: any, table: string, inputIdentifier: string = '', minItemValue = 0): number {
    if (!this.ratesCache[table]) {
      logger.info(`No price list found for category ${table}, returning 0`);
      return 0;
    }

    const identifier = inputIdentifier.length > 0 ? inputIdentifier : item.typeline;

    // handle items that stack - minItemValue is for exactly 1 of the item
    const unitValue = this.ratesCache[table][identifier];

    if (!unitValue) {
      if (log) {
        logger.info(`[${table}] : ${identifier} => No value found, returning 0`);
      }
      return 0;
    }

    const value = unitValue * (item.stacksize || 1);
    if (log) {
      logger.info(`[${table}] : ${identifier} => ${value}`);
    }
    return minItemValue < value ? value : 0;
  }

  /**
   * Gets the first pricing rule that matches the item
   * @param {any} item Item to get the value of
   * @returns {PriceMatch}  The first pricing rule that matches the item
   */
  match(item: any): PriceMatch {
    return this.PriceMatches.find((match) => match.test(item)) ?? this.DefaultPriceMatch;
    // return this.DefaultPriceMatch;
  }

  /**
   * Get the price of an item
   * @param {any}     item Item to get the value of
   * @param {number}  minItemValue Minimum value of an item. Anything below this will make the function return 0
   * @returns {number}  Price of an item based on the first pricing rule that matches it
   */
  price(item: any, minItemValue: number): number {
    const pricingRule = this.match(item);
    const calculatedValue = pricingRule.calculateValue(item, minItemValue);
    if (log) {
      logger.info(
        `Calculated Value: ${calculatedValue} for ${item.typeline} using Rule: ${pricingRule.name} (minItemValue: ${minItemValue})`
      );
    }
    return calculatedValue;
  }

  // Utilities
  /**
   * Get the string value of the number of links used by Poe.ninja
   * @param {any} parsedItem Full parsed item from the API
   * @returns {string} String representing the number of links on the item in the format used by poe.ninja
   */
  getLinks(parsedItem: any): string {
    const sockets = ItemData.getSockets(parsedItem);
    for (let i = 0; i < sockets.length; i++) {
      if (sockets[i].length >= 5) {
        return ` ${sockets[i].length}L`;
      }
    }
    return '';
  }

  /**
   * Get the string value of the number of abyss sockets used by Poe.ninja
   * @param {string} sockets Sockets array from the item representation in the API
   * @param {string} identifier Identifier of the item
   * @returns {string} String representing the number of abyss sockets on the item in the format used by poe.ninja
   */
  getAbyssSockets(sockets: string, identifier: string): string {
    if (!abyssItems.includes(identifier)) return '';
    const numAbyssSockets = sockets.match(/A/g)?.length;
    switch (numAbyssSockets) {
      case 1:
        return ` (1 Jewel)`;
      case 2:
        return ` (2 Jewels)`;
      default:
        return '';
    }
  }

  /**
   * Get the Mean value of items from a list, to be used for unid items
   * @param {string[]}  possibleIdentifiers List of all possible entries to look for in the rates
   * @param {number}    minItemValue  Minimum value of an item. Anything below this will make the function return 0
   * @returns {number}  Mean value of these items
   */
  getUnidMeanValue(possibleIdentifiers: string[], minItemValue: number): number {
    const possibleValues = possibleIdentifiers.map((identifier: string) => {
      return this.getValue({ typeline: identifier }, 'UniqueItem', identifier, minItemValue);
    });

    const min = Math.min(...possibleValues);
    const max = Math.max(...possibleValues);

    const value = (min + max) / 2;
    return value;
    // return value >= minItemValue ? value : 0;
  }

  /**
   * Get the value of an item's vendor recipe if it is part of one
   * @param {any}     item Item to get the value of
   * @param {number}  minItemValue Minimum value of an item. Anything below this will make the function return 0
   * @returns {number}  The value the vendor will give for this item if it is part of a Vendor recipe
   */
  getVendorRecipeValue(item: any, minItemValue: number): number {
    let vendorValue: number = 0;

    const sockets = ItemData.getSockets(item.parsedItem);
    if (sockets.length) {
      if (ItemData.countSockets(sockets) === 6) {
        if (sockets.length === 1) {
          // 6L Recipe pricing
          // TODO: Centralize these
          vendorValue =
            this.getValue({ typeline: 'Orb of Fusing' }, 'Currency', 'Orb of Fusing') * 20;
        } else {
          // 6S Recipe pricing
          vendorValue =
            this.getValue({ typeline: "Jeweller's Orb" }, 'Currency', "Jeweller's Orb") * 7;
        }
      } else {
        for (let i = 0; i < sockets.length; i++) {
          if (sockets[i].includes('R') && sockets[i].includes('G') && sockets[i].includes('B')) {
            vendorValue = this.getValue({ typeline: 'Chromatic Orb' }, 'Currency', 'Chromatic Orb');
          }
        }
      }
    } else if (item.category && item.category.includes('Skill Gems')) {
      let quality = ItemData.getQuality(item.parsedItem);
      if (quality >= 20) {
        vendorValue = this.getValue(
          { typeline: "Gemcutter's Prism" },
          'Currency',
          "Gemcutter's Prism"
        );
      }
    }

    if (log) {
      logger.info('Returning vendor value ' + vendorValue);
    }
    return minItemValue && minItemValue < vendorValue ? vendorValue : 0;
  }

  /**
   * Checks if an item is part of a vendor recipe
   * @param {any}   item Item to check vendor recipe for
   * @returns {boolean} Whether or not this item is part of a vendor recipe
   */
  isVendorRecipe(item: any): boolean {
    const sockets = ItemData.getSockets(item.parsedItem);
    return (
      ItemData.countSockets(sockets) === 6 || // 6L or 6S
      sockets.some(
        (socket) => socket.includes('R') && socket.includes('G') && socket.includes('B')
      ) || // RGB
      (item.category &&
        item.category.includes('Skill Gems') &&
        ItemData.getQuality(item.parsedItem) >= 20)
    ); // 20% quality Gem
  }

  /**
   * [REMOVED FROM POE.NINJA] Get the level of a Seed item. That was used in Harvest League
   * @param {any} item Seed item to get the level of
   * @returns {number} Level of the seed item
   */
  getSeedLevel(item: any): number {
    for (let i = 0; i < item.parsedItem.properties.length; i++) {
      let prop = item.parsedItem.properties[i];
      if (prop.name === 'Spawns a Level %0 Monster when Harvested') {
        return prop.values[0][0];
      }
    }
    return 0;
  }

  /**
   * Get the league name of a map based on its icon path encoded in Base64
   * @param {string}  icon    Path to the map Icon
   * @returns {string}        Name of the league the map belongs to
   */
  getMapSeriesFromBase64Icon(icon: string): string {
    const data = Utils.getBase64EncodedData(icon);
    const seriesFromMn = data.mn ? this.MapSeries.find((series) => series.id === data.mn) : false;
    if (seriesFromMn) {
      return seriesFromMn.name;
    } else {
      if (data.f.includes('2DItems/Maps/AtlasMaps')) return 'Atlas';
      if (data.f.includes('2DItems/Maps/Atlas2Maps')) return 'Ancestor';
      if (data.f.includes('2DItems/Maps/Map')) return 'Pre 2.4';
      if (data.f.includes('2DItems/Maps/act4maps')) return 'Pre 2.0';
    }

    logger.info(`Invalid map item icon: ${icon}`);
    return '';
  }

  /**
   * Get the Map Series from the icon path
   * @param {string}  icon  Path to the map Icon
   * @returns {string}      Name of the series the map belongs to
   */
  getMapSeries(icon: string): string {
    if (
      icon.includes('https://web.poecdn.com/gen/image/') ||
      icon.includes('https://www.pathofexile.com/gen/image/')
    ) {
      return this.getMapSeriesFromBase64Icon(icon);
    }

    const seriesFromMn = icon.includes('mn=')
      ? this.MapSeries.find((series) => icon.includes(`mn=${series.id}`))
      : false;

    if (seriesFromMn) {
      return seriesFromMn.name;
    } else {
      if (icon.includes('2DItems/Maps/AtlasMaps')) return 'Atlas';
      if (icon.includes('2DItems/Maps/Atlas2Maps')) return 'Ancestor';
      if (icon.includes('2DItems/Maps/Map')) return 'Pre 2.4';
      if (icon.includes('2DItems/Maps/act4maps')) return 'Pre 2.0';
    }
    logger.info(`Invalid map item icon: ${icon}`);
    return '';
  }

  /**
   * Get the Identifier of a gem in the right Poe.ninja format
   * @param {string}  name    Name of the Gem
   * @param {number}  level   Level of the Gem
   * @param {number}  quality Quality of the Gem
   * @param {boolean} corrupted  Whether or not the Gem is corrupted
   * @returns {string} Formatted identifier of the gem
   */
  getFullGemIdentifier(name: string, level: number, quality: number, corrupted: boolean): string {
    const formatter = this.GemFormats.find((match) => match.test(name)) ?? this.DefaultGemFormat;
    let formattedString = formatter.generateString(name, level, quality, corrupted);

    if (corrupted) {
      formattedString += ' (Corrupted)';
    }
    return formattedString;
  }

  // Specific Pricing Calculations

  /**
   * Get the value of a currency shard stack. Takes minItemValue into account by itself, to output 0 if the value of one shard is below the value.
   * @param {number}  minItemValue Minimum value of an item. Anything below this will make the function return 0
   * @param {any}     item Item to get the value of
   * @param {string}  identifier Identifier of the item
   * @returns {number}  Value of the item in chaos
   */
  getCurrencyShardStackValue(minItemValue: number, item: any, identifier: string): number {
    const wholeOrbName = Constants.shardTypes[identifier];
    const shardValue = this.getValue(item, 'Currency', wholeOrbName) / 20;
    const stackValue = shardValue * item.stacksize;
    if (log) {
      if (shardValue >= minItemValue) {
        logger.info(
          `[Currency] : ${identifier} => ${shardValue} x ${item.stacksize} = ${stackValue}`
        );
      } else {
        logger.info(`[Currency] : ${identifier} => ${shardValue} < ${minItemValue}, ignoring`);
      }
    }
    return shardValue >= minItemValue ? stackValue : 0;
  }

  /**
   * Get the value of Splinters based on the result item of a stack. Takes minItemValue into account by itself, to output 0 if the value of one splinter is below the value.
   * @param {number}  minItemValue  Minimum value of an item. Anything below this will make the function return 0
   * @param {any}     item          Item to get the value of
   * @param {string}  identifier    Identifier of the item
   * @returns {number}  Value of the item in chaos
   */
  getSplinterStackValue(minItemValue: number, item: any, identifier: string): number {
    const fragmentType = Constants.fragmentTypes[identifier];
    const type = fragmentType.itemType ?? 'Fragment';
    const splinterValue = this.getValue(item, type, fragmentType.item) / fragmentType.stackSize;
    const stackValue = splinterValue * item.stacksize;
    if (log) {
      if (splinterValue >= minItemValue) {
        logger.info(
          `Using alternate splinter pricing : ${identifier} => ${splinterValue} x ${item.stacksize} = ${stackValue}`
        );
      } else {
        logger.info(
          `Using alternate splinter pricing : ${identifier} => ${splinterValue} < ${minItemValue}, ignoring`
        );
      }
    }
    return splinterValue >= minItemValue ? stackValue : 0;
  }

  /**
   * Get the value of a helmet based on the current enchantment
   * @param {any}     item Item to get the value of
   * @param {number}  minItemValue  Minimum value of an item. Anything below this will make the function return 0
   * @returns {number}  Value of a helmet with this enchantment if there is an enchantment
   */
  getHelmetEnchantValue(item: any, minItemValue: number): number {
    if (!item.parsedItem.enchantMods) return 0;
    const identifier = item.parsedItem.enchantMods[0];
    return this.getValue(item, 'HelmetEnchant', identifier, minItemValue);
  }

  /**
   * [REMOVED FROM POE.NINJA] Get the value of a Watchstone
   * @param {any}     item Item to get the value of
   * @returns {number}  Value of a watchstone
   */
  getWatchstoneValue(item: any): number {
    let identifier =
      item.rarity === 'Magic'
        ? Constants.craftableWatchstoneBaseTypes.find((type) => type.includes(item.typeline))
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
    return this.getValue(item, 'Watchstone', identifier);
  }

  /**
   * Get the value of a unique map based on its name, tier, and series
   * @param {any}     item Item to get the value of
   * @param {number}  minItemValue  Minimum value of an item. Anything below this will make the function return 0
   * @returns {number}  Value of the unique map
   */
  getUniqueMapValue(item: any, minItemValue: number): number {
    const name = item.name || Utils.getItemName(item.icon);
    const tier = ItemData.getMapTier(item.parsedItem);
    const typeline = item.typeline.replace('Superior ', '');

    const identifier = `${name} T${tier} ${typeline}`;

    return this.getValue(item, 'UniqueMap', identifier, minItemValue);
  }

  /**
   * Get the value of an unique Item.
   * @param {any} item Item to get the value of
   * @param {number} minItemValue Minimum value of an item. Anything below this will make the function return 0
   * @returns {number} Value of a unique item
   */
  getUniqueItemValue(item: any, minItemValue: number): number {
    let identifier =
      item.name ??
      Utils.getItemName(item.icon) ??
      Utils.getItemName(item.parsedItem.icon) ??
      item.typeline;
    // let identifier = item.name || Utils.getItemName(item.icon) || item.typeline;

    if (identifier === 'Grand Spectrum' || identifier === 'Combat Focus') {
      // These are priced as "Grand Spectrum TYPE" (ex: Grand Spectrum Cobalt Jewel)
      identifier += ` ${item.typeline}`;
    } else if (identifier === 'Impresence') {
      // Impresences are priced as "Impresence (ELEMENT)" (ex: Impresence (Cold))
      const element = item.icon
        .replace('https://web.poecdn.com/image/Art/2DItems/Amulets/Elder', '')
        .replace('https://www.pathofexile.com/image/Art/2DItems/Amulets/Elder', '')
        .replace('.png', '');
      identifier += ` (${element})`;
    }

    const links = this.getLinks(item.parsedItem);
    identifier += links;
    identifier += this.getAbyssSockets(item.sockets, identifier);

    if (item.identified === 0) {
      let possibleIdentifiers: string[] = [];
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
        return this.getUnidMeanValue(possibleIdentifiers, minItemValue);
      }
    }

    const value = this.getValue(item, 'UniqueItem', identifier, minItemValue);
    const vendorValue = this.getVendorRecipeValue(item, minItemValue);
    return Math.max(value, vendorValue);
  }

  /**
   * [REMOVED FROM POE.NINJA] Get the value of a seed. Used in Harvest League
   * @param {any} item
   * @returns {number} Value of the seed
   */
  getSeedValue(item: any): number {
    const identifier = item.typeline + (this.getSeedLevel(item) >= 76 ? ' L76+' : '');
    return this.getValue(item, 'Seed', identifier);
  }

  /**
   * Get the value of a Map item
   * @param {any} item Map Representation from the GGG API
   * @param {number} minItemValue Minimum value of an item. Anything below this will make the function return 0
   * @returns {number} Value of the map
   */
  getMapValue(item: any, minItemValue: number): number {
    let name = item.typeline.replace('Superior ', '');
    const tier = ItemData.getMapTier(item.parsedItem);
    const series = this.getMapSeries(item.parsedItem.icon);

    if (item.rarity === 'Magic' && item.identified) {
      // Strip affixes from magic item name
      name = Utils.getBaseFromMagicMap(name);
      // Special handling for name collision for Corrupted Temple maps below t16
      if (name === 'Vaal Temple Map' && tier < 16) {
        name = 'Temple Map';
      }
    }
    const identifier = `${name} T${tier} ${series}`;
    return this.getValue(item, 'Map', identifier, minItemValue);
  }

  /**
   * Get the value of a Gem
   * @param {number} minItemValue Minimum value of an item. Anything below this will make the function return 0
   * @param {any} item Item to get the value of
   * @returns {number}  Value of the item in chaos
   */
  getGemValue(minItemValue: number, item: any): number {
    const typeline = item.typeline.replace('Superior ', '');
    const level = ItemData.getGemLevel(item.parsedItem);
    const quality = ItemData.getQuality(item.parsedItem);
    const corrupted = item.parsedItem.corrupted;
    const identifier = this.getFullGemIdentifier(typeline, level, quality, corrupted);

    let value = this.getValue(item, 'SkillGem', identifier, minItemValue);
    if (!value && item.parsedItem.hybrid && item.parsedItem.hybrid.baseTypeName) {
      let altIdentifier = this.getFullGemIdentifier(
        item.parsedItem.hybrid.baseTypeName,
        level,
        quality,
        corrupted
      );
      value = this.getValue(item, 'SkillGem', altIdentifier, minItemValue);
    }

    const vendorValue = this.getVendorRecipeValue(item, minItemValue);
    return Math.max(value, vendorValue);
  }

  /**
   * Get the value of a Base item
   * @param {any} item Item to get the value of
   * @param {number} minItemValue Minimum value of an item. Anything below this will make the function return 0
   * @returns {number} Value of the item in chaos
   */
  getBaseTypeValue(item: any, minItemValue: number): number {
    const sockets = ItemData.getSockets(item.parsedItem);

    if (item.parsedItem.ilvl < 82 || ItemData.countSockets(sockets) === 6) {
      return this.getVendorRecipeValue(item, minItemValue);
    }

    let identifier = item.typeline.replace('Superior ', '');

    if (item.rarity === 'Magic' && item.identified) {
      // Strip affixes from magic item name
      identifier = ItemCategoryParser.getEquipmentBaseType(identifier);
    }
    identifier += ` L${item.parsedItem.ilvl > 86 ? 86 : item.parsedItem.ilvl}`;
    let possibleIdentifiers = [identifier];
    if (item.parsedItem.influences) {
      possibleIdentifiers = [
        Object.keys(item.parsedItem.influences).join('/'),
        Object.keys(item.parsedItem.influences).reverse().join('/'),
      ].map((influences) => {
        if (influences.length > 0) return `${identifier} ${influences}`;
      });
    }

    const values = possibleIdentifiers.map((Identifier) => {
      return this.getValue(item, 'BaseType', identifier, minItemValue);
    });
    const vendorValue = this.getVendorRecipeValue(item, minItemValue);
    return Math.max(...values, vendorValue);
  }

  /**
   * Get the Value of a Divination Card
   * TODO: Add alternate pricing in the future
   * @param {any} item Item to get the value of
   * @param {number} minItemValue Minimum value of an item. Anything below this will make the function return 0
   * @returns {number} Value of the item in chaos
   */
  getDivinationCardValue(item: any, minItemValue: number): number {
    const identifier = item.typeline;
    return this.getValue(item, 'DivinationCard', identifier, minItemValue);
  }
}

/**
 * Price an item from the rates pulled from Poe.Ninja. Main point of entry for the module
 * @param {any} item Item to get the value of
 * @param {string} league [Optional] League to get the rates from. Defaults to the active league
 * @returns {{isVendor: boolean, value: number}} { isVendor: Whether or not the item is part of a vendor recipe, value: Value of the item in chaos }
 */
async function price(
  item: any,
  league: string = SettingsManager.get('activeProfile').league
): Promise<{ isVendor: boolean; value: number }> {
  const date = item.event_id.slice(0, 8);
  if (!matchers[date]) matchers[date] = new PriceMatcher(date);
  const matcher: PriceMatcher = matchers[date];
  await matcher.fetchRates(league);

  if (matcher.hasBrokenRates()) {
    return { isVendor: false, value: 0 };
  }

  item.parsedItem = JSON.parse(item.rawdata);

  let minItemValue = 0;
  const filter = ItemFilter.filter(item.parsedItem);
  if (filter && filter.ignore) {
    if (filter.minValue) {
      if (filter.option && filter.option === 'fullStack' && item.parsedItem.maxStackSize) {
        minItemValue = filter.minValue / item.parsedItem.maxStackSize;
      } else {
        minItemValue = filter.minValue;
      }
    } else {
      // Unconditional ignore - stop here and get vendor recipe instead, if any
      return {
        isVendor: matcher.isVendorRecipe(item),
        value: matcher.getVendorRecipeValue(item, minItemValue),
      };
    }
  }

  return { isVendor: matcher.isVendorRecipe(item), value: matcher.price(item, minItemValue) };
}

async function getCurrencyByName(type: string, timestamp = dayjs().format('YYYYMMDD'),  league = SettingsManager.get('activeProfile').league) {
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

export default {
  price,
  getRatesFor,
  getCurrencyByName,
};
