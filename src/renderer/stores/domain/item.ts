import { makeAutoObservable, computed } from 'mobx';
import { v4 as uuidv4 } from 'uuid';
import { generate, parse, transform, stringify } from 'csv/sync';
import Constants from '../../../helpers/constants';
import { ItemData } from '../../../helpers/types';
import { electronService } from '../../electron.service';
const { logger } = electronService;

type LootTableData = {
  id: string;
  name: string;
  value: number;
  totalValue: number;
  icon: string;
  quantity: number;
  stashTabId: string;
  item?: Item;
  itemData?: string;
}

const countSockets = (sockets) => {
  if (!sockets || !sockets.length) return 0;

  var result = 0;
  sockets.forEach(function (group) {
    group = group.replace('DV', 'D');
    result += group.length;
  });
  return result;
};

// Get Level Requirement from itemData
// Map lvl requirement comes from Map Tier
// Gear have a Level requirement
// Returns null if no level requirement is found
const getLevelRequirement = (data: ItemData) => {
  if (data.properties) {
    for (const property of data.properties) {
      if (property.name === 'Map Tier') {
        return parseInt(property.values[0][0]) + 67;
      }
    }
  }

  if (data.requirements) {
    for (const requirement of data.requirements) {
      if (requirement.name === 'Level') {
        return requirement.values[0][0];
      }
    }
  }
  return null;
};

// Get Quality from itemData
// Returns null if no quality is found
const getQuality = (data: ItemData) => {
  if (data.properties) {
    for (const property of data.properties) {
      if (property.name === 'Quality') {
        return property.values[0][0].slice(1, -1);
      }
    }
  }
  return null;
};

// Get Rarity from itemData
// Rarity lives in the frametype property
// Returns 0 if no quality is found
const getRarity = (data: ItemData) => {
  return data.frameType < 1 || data.frameType > 3 ? 0 : data.frameType;
};

// Get the item category from all the itemData.
// Lots of hardcoded stuff here, but it's the best way that we found.
const getCategory = (item, subcategory = false) => {
  // Read type for hybrid items too
  let type = item.hybrid ? item.hybrid.baseTypeName : item.typeLine;
  if (!type) return null;

  const iconFileName = item.icon.replace(/^.*[\\/]/, '');

  // Easiest cases
  if (type === 'Expedition Logbook') return type;
  if (type.includes('Blueprint')) return 'Blueprint';
  if (type.includes('Contract'))
    return Constants.items.names.heistQuestItems.includes(type) ? 'Quest Items' : 'Contract';

  // Memories
  for (const memory of Constants.items.names.memories) {
    if (type.includes(memory)) return memory;
  }

  // Invitations
  for (const invitation of Constants.items.names.invitations) {
    if (type.includes(invitation)) return invitation;
  }

  // Misc basetypes that we know of
  if (Constants.items.baseTypes.others[type]) {
    const foundBaseType = Constants.items.baseTypes.others[type];
    return !subcategory && Array.isArray(foundBaseType) ? foundBaseType[0] : foundBaseType;
  }

  // Items where we can guess the category from the frameType
  // Order matters here, because some items need to be captured by this before we test them for the next categories
  switch (item.frameType) {
    // 4 = Gems
    case 4:
      const gemName = type.replace(/(Superior|Anomalous|Divergent|Phantasmal) /g, '');
      if (Constants.items.baseTypes.gems[gemName]) {
        return Constants.items.baseTypes.gems[gemName];
      } else {
        logger.error(`No base type found for gem [${type}]`);
        return '';
      }
    case 5:
      if (type.startsWith('Captured Soul')) {
        return 'Pantheon Soul';
      } else {
        return 'Labyrinth Items';
      }
    case 6:
      return 'Divination Card';
    case 7:
      return 'Quest Items';
    case 8:
      return 'Prophecy';
  }

  // Maligaro's Map quest item has frameType 7, already detected above as a quest item
  if (type.includes(' Map')) return 'Maps';
  if (type.endsWith('Scarab')) return subcategory ? ['Map Fragments', 'Scarab'] : 'Map Fragments';
  if (type.includes('Watchstone')) return 'Atlas Region Upgrade Item';
  if (type.endsWith('Incubator')) return 'Incubator';
  if (type.endsWith('Piece')) return 'Harbinger Item Piece';
  if (item.icon.includes('BestiaryOrbFull')) return 'Captured Beast';

  // Metamorph organs
  if (Constants.items.names.metamorphSamples.includes(iconFileName.replace(/\..*$/, '')))
    return 'Metamorph Sample';

  // equipment - search by hardcoded basetype
  // Remove quality if present
  type = type.replace('Superior ', '');

  // Non-magic equipment
  if (item.frameType !== 1 && Constants.items.baseTypes.equipments[type])
    return Constants.items.baseTypes.equipments[type];

  // Magic equipment - typeline is polluted by prefixes $%&*#^@!!!
  for (const baseTypeName in Constants.items.baseTypes.equipments) {
    if (type.includes(baseTypeName)) return Constants.items.baseTypes.equipments[baseTypeName];
  }

  logger.error(`No category found for item ${item.id || '(no id)'}! JSON follows:`);
  logger.info(item);
  return null;
};

// Get the list of influences from itemData
const getInfluence = (data: ItemData): string[] => {
  if (data.influences)
    return Object.keys(data.influences).map((influence) => influence.toLowerCase());
  if (data.shaper) return ['shaper'];
  if (data.elder) return ['elder'];
  return [];
};

// Check if the map is a shaper from settings of the Map Tier
const isShapedMap = (data: ItemData) => {
  if (data.properties) {
    for (const property of data.properties) {
      if (property.name === 'Map Tier')
        return property.values[0][1] === 1 && property.values[0][0] < 16;
    }
  }
  return false;
};

// Check if the map is an elder map from settings of the Map Tier
const isElderMap = (data: ItemData) => {
  if (data.properties) {
    for (const property of data.properties) {
      if (property.name === 'Map Tier')
        return property.values[0][1] === 1 && property.values[0][0] === 16;
    }
  }
  return false;
};

// Check if the item is a blighted map from a pattern in the icon Url
const isBlightedMap = (data: ItemData) => {
  if (!data.properties) return false;
  return data.icon.includes('mb=1');
};

// Get the Map Tiere from the item's properties
const getMapTier = (data: ItemData) => {
  if (data.properties) {
    for (const property of data.properties) {
      if (property.name === 'Map Tier') return property.values[0][0];
    }
  }
  return null;
};

// Get the sockets list as an array of strings (ex: [RR, GR])
const getSockets = (data: ItemData) => {
  if (!data.sockets) return [];
  const sockets: any[] = [];
  // Counter vars to go through the sockets
  let socketsString = '';
  let currentGroup = 0;

  for (const socket of data.sockets) {
    if (socket.group === currentGroup) {
      socketsString += socket.sColour;
    } else {
      sockets.push(socketsString);
      currentGroup = socket.group;
      socketsString = socket.sColour;
    }
  }
  sockets.push(socketsString);

  return sockets;
};

// Get Gem Level from the item's properties
const getGemLevel = (data: ItemData) => {
  if (data.properties && data.frameType === 4) {
    for (const property of data.properties) {
      if (property.name === 'Level') return property.values[0][0].replace(' (Max)', '');
    }
  }
  return null;
};


export class Item {
  store;
  rawData: ItemData;
  styleModifiers: any;
  itemLevel: number;
  dropLevel: number;
  quality: number;
  rarity: number;
  itemClass: string;
  baseType: string;
  name: string;
  id: string;
  itemId: string;
  identified: boolean;
  corrupted: boolean;
  mirrored: boolean;
  influence: string[];
  shapedMap: boolean;
  elderMap: boolean;
  blightedMap: boolean;
  mapTier: number;
  stackSize: number;
  replica: boolean;
  veiled: boolean;
  synthesised: boolean;
  fractured: boolean;
  explicitMods: string[];
  implicitMods: string[];
  enchantMods: string[];
  width: number;
  height: number;
  sockets: string[];
  gemLevel: number;
  outerElement: HTMLElement | null;
  domElement: HTMLElement | null;
  value: number;
  area?: string;
  map_id?: string;
  stashTabId?: string;


  constructor(store, itemdata: ItemData) {
    makeAutoObservable(this, {
      id: false,
      store: false,
    });
    this.id = uuidv4();
    this.store = store;
    this.area = itemdata.area;
    this.map_id = itemdata.map_id;

    this.rawData = itemdata;
    this.styleModifiers = itemdata.styleModifiers || {};

    this.name = itemdata.name.replace('<<set:MS>><<set:M>><<set:S>>', '').replace(/<>/g, '');
    this.itemId = itemdata.id;

    this.itemLevel = Math.max(1, itemdata.ilvl);
    this.dropLevel = Math.max(1, getLevelRequirement(itemdata));

    this.quality = getQuality(itemdata);
    this.rarity = getRarity(itemdata);

    this.itemClass = getCategory(itemdata);

    // Handle hybrid gems
    this.baseType = itemdata.typeLine
      .replace('<<set:MS>><<set:M>><<set:S>>', '')
      .replace(/<>/g, '');
    if (itemdata.hybrid && !this.baseType.startsWith('Vaal')) {
      this.baseType = itemdata.hybrid.baseTypeName;
    }

    this.identified = itemdata.identified || false;
    this.corrupted = itemdata.corrupted || false;
    this.mirrored = itemdata.duplicated || false;
    this.influence = getInfluence(itemdata);
    this.shapedMap = isShapedMap(itemdata);
    this.elderMap = isElderMap(itemdata);
    this.blightedMap = isBlightedMap(itemdata);
    this.mapTier = getMapTier(itemdata);
    this.stackSize = itemdata.stackSize;
    this.replica = itemdata.replica;
    this.veiled = itemdata.veiled;
    this.synthesised = itemdata.synthesised || false;
    this.fractured = itemdata.fractured || false;

    this.explicitMods = itemdata.explicitMods;
    this.implicitMods = itemdata.implicitMods;
    this.enchantMods = itemdata.enchantMods;

    if (this.itemClass === 'Prophecy') {
      this.name = this.baseType;
      this.baseType = this.itemClass;
      this.itemClass = 'Currency';
    }

    this.width = itemdata.w;
    this.height = itemdata.h;

    this.sockets = getSockets(itemdata);
    this.gemLevel = getGemLevel(itemdata);

    this.outerElement = null;
    this.domElement = null;

    this.value = itemdata.value;
    this.stashTabId = itemdata.stashTabId;
  }

  // Get the full name to display for an item
  @computed getDisplayName(showQuantityInTitle = true): string[] {
    // Any normal Basetype with Quality
    if (!this.identified && this.quality > 0) {
      return [this.baseType];
    }
    // No identified property, no name -> This is a Gem
    if (!this.identified || !this.name) {
      let name =
        (showQuantityInTitle && this.stackSize > 1 ? this.stackSize + ' x ' : '') + this.baseType;
      if (this.gemLevel) {
        // Prepend Quality for Normal Gems
        // Alternate Qualities already have the right prefix in their name
        if (
          this.quality > 0 &&
          !name.includes('Anomalous') &&
          !name.includes('Divergent') &&
          !name.includes('Phantasmal')
        ) {
          name = 'Superior ' + name;
        }
        // Append Gem Level
        if (this.gemLevel > 1) name += ` (Level ${this.gemLevel})`;
      }
      return [name];
    } else {
      const name = [this.name];
      if (this.baseType !== 'Prophecy') name.push(this.baseType);
      return name;
    }
  }

  // Get the number of sockets in an item
  getNumSockets() {
    return countSockets(this.sockets);
  }

  // broken - mod list currently contains only the actual stats
  // can't get actual name of mod, which is what's being searched for
  hasExplicitMod(mod) {
    if (mod === 'Veil' && this.veiled) {
      return true;
    } else {
      if (!this.explicitMods) {
        return false;
      } else {
        for (var i = 0; i < this.explicitMods.length; i++) {
          if (this.explicitMods[i].includes(mod)) return true;
        }
        return false;
      }
    }
  }

  hasEnchantment(mod) {
    if (!this.enchantMods) return false;
    const cleanEnchantmentString = mod.replace('Enchantment ', '');
    return this.enchantMods.some((mod) => {
      return mod.includes(cleanEnchantmentString);
    });
  }

  toLootTable(jsonMode: boolean = false) : LootTableData {
    const { itemId, value = 0, stashTabId = '', rawData } = this;
    const { icon } = rawData;
    const name = rawData.name || rawData.secretName;
    const type = rawData.hybrid ? rawData.hybrid.baseTypeName : rawData.typeLine;
    const quantity = rawData.maxStackSize ? rawData.pickupStackSize ?? rawData.stackSize : 1;
    const fullName = type + (name ? ` (${name})` : '');
    const lootTableData : LootTableData = {
      id: itemId,
      name: fullName,
      value: value / quantity,
      totalValue: value,
      icon,
      quantity,
      stashTabId,
    };
    if (jsonMode) {
      lootTableData.itemData = JSON.stringify(this.rawData);
    } else {
      lootTableData.item = this;
    }
    return lootTableData
  }

  static getCsvHeaders() {
    const fakeFormattedItem : LootTableData = {
      id: '',
      name: '',
      value: 0,
      totalValue: 0,
      icon: '',
      quantity: 0,
      stashTabId: '',
      itemData: '',
    };
    return Object.keys(fakeFormattedItem);
  }
}
