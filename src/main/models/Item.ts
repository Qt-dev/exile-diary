import ItemCategoryParser from '../modules/ItemCategoryParser';
import Utils from '../modules/Utils';
import Logger from 'electron-log';

const logger = Logger.scope('Item');

// Example of Raw Data
// {
//     "baseType": "Orb of Alteration",
//     "descrText": "Right click this item then left click a magic item to apply it.",
//     "explicitMods": [
//         "Reforges a magic item with new random modifiers"
//     ],
//     "frameType": 5,
//     "h": 1,
//     "icon": "https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lSZXJvbGxNYWdpYyIsInciOjEsImgiOjEsInNjYWxlIjoxfV0/28212545fd/CurrencyRerollMagic.png",
//     "id": "653941e25cb88e9834c65e17687cad2294470e984294a64c815c5a1017e206b4",
//     "identified": true,
//     "ilvl": 0,
//     "inventoryId": "ExpandedMainInventory",
//     "league": "Affliction",
//     "maxStackSize": 20,
//     "name": "",
//     "properties": [
//         {
//             "displayMode": 0,
//             "name": "Stack Size",
//             "type": 32,
//             "values": [
//                 [
//                     "9/20",
//                     0
//                 ]
//             ]
//         }
//     ],
//     "stackSize": 9,
//     "typeLine": "Orb of Alteration",
//     "verified": false,
//     "w": 1,
//     "x": 0,
//     "y": 4
// }

// Raw Data coming from GGG API.
// Reference: https://www.pathofexile.com/developer/docs/reference#type-Item
type RawData = {
  id: string;
  name: string; // This is actually the custom name, if it exists. The basetype is actually what we are after most of the time
  baseType: string;
  frameType: number;
  icon: string;
  identified: boolean;
  ilvl: number;
  inventoryId: string;
  league: string;
  maxStackSize: number;
  stackSize: number;
  typeLine: string;
  verified: boolean;
  properties: any[];
};

// Frame Type strings for rarity
// 0 	Normal frame
// 1 	Magic frame
// 2 	Rare frame
// 3 	Unique frame
// 4 	Gem frame
// 5 	Currency frame
// 6 	Divination Card frame
// 7 	Quest frame
// 8 	Prophecy frame (legacy)
// 9 	Foil frame
// 10 	Supporter Foil frame
// Reference: https://www.pathofexile.com/developer/docs/reference#type-Item-frameType
const RarityByFrameType = [
  'Normal',
  'Magic',
  'Rare',
  'Unique',
  'Gem',
  'Currency',
  'Divination Card',
  'Quest',
  'Prophecy',
  'Foil',
  'Supporter Foil',
  'Allflame',
];

class Item {
  id: string = '';
  name: string = '';
  icon: string = '';
  baseType: string = '';
  frameType: number = 0;
  identified: boolean = false;
  ilvl: number = 0;
  inventoryId: string = '';
  league: string = '';
  maxStackSize: number = 0;
  stackSize: number = 0;
  typeLine: string = '';
  verified: boolean = false;
  properties: any[] = [];
  rawData: any;
  eventId?: string;
  value?: number;
  originalValue?: number;
  rarity: string;
  category: any;
  sockets: string | null;

  /* Getters for properties calling in the db format */
  get event_id() {
    return this.eventId;
  }

  get rawdata() {
    return this.rawData;
  }

  get typeline() {
    return this.typeLine;
  }

  get stacksize() {
    return this.stackSize;
  }

  get basetype() {
    return this.baseType;
  }

  get frametype() {
    return this.frameType;
  }

  get maxstacksize() {
    return this.maxStackSize;
  }

  constructor(rawData: Partial<RawData>) {
    Object.assign(this, rawData);

    if (Array.isArray(rawData.properties)) {
      this.properties = JSON.parse(JSON.stringify(rawData.properties));
    }

    this.icon = Item.getImageUrl(this.icon);
    this.name = this.name?.replace('<<set:MS>><<set:M>><<set:S>>', '') ?? '';
    this.rarity = RarityByFrameType[this.frameType];
    if (!this.rarity) {
      logger.warn(`Unknown frameType (${this.frameType}) for item ${this.name}. Setting rarity to Unknown`)
      this.rarity = 'Unknown'
    }
    this.category = ItemCategoryParser.getCategory(this);

    this.typeLine = this.typeLine?.replace('<<set:MS>><<set:M>><<set:S>>', '') ?? '';
    if (this.rarity === 'Gem' && this.typeLine !== this.baseType) {
      // to handle hybrid gems (general's cry, predator support)
      this.typeLine = this.baseType?.replace('<<set:MS>><<set:M>><<set:S>>', '') ?? '';
    }
    this.sockets = Utils.getSockets(this);

    this.rawData = JSON.stringify(rawData);
  }

  static getImageUrl(url) {
    // flask image urls are in a very strange form, just return as is
    if (url.includes('web.poecdn.com/gen')) {
      return url;
    } else {
      // stripping identifier from end
      return url.substring(0, url.indexOf('?'));
    }
  }

  toDbInsertFormat(timestamp: string): string[] {
    const {
      id,
      identified,
      rawData,
      icon,
      name,
      rarity,
      category,
      typeline,
      sockets,
      value = 0,
      originalValue = 0,
    } = this;

    const stacksize = this.stackSize || null;

    return [
      id,
      timestamp,
      icon,
      name,
      rarity,
      category,
      identified ? 1 : 0,
      typeline,
      sockets,
      stacksize,
      rawData,
      value,
      originalValue,
    ];
  }

  setTimestamp(timestamp: string) {
    this.eventId = timestamp;
  }

  setValue(value: number) {
    const parsedValue = value ?? 0;
    this.value = parsedValue;
    if (!this.originalValue && this.originalValue !== 0) {
      this.originalValue = parsedValue;
    }
  }
}

export default Item;
