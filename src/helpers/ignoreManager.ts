import { LogFunctions } from 'electron-log';
import * as ItemManager from './item';
// const logger = Logger.scope('ignore-manager');

type PerCategoryFilter = {
  minimumValue: number,
  ignore: boolean
};

type Settings = {
  minimumValue: number,
  filterPatterns: string[]
  perCategory: {
    [key: string]: PerCategoryFilter
  }
};

class IgnoreManager {
  settings : Settings =  {
    minimumValue: 0,
    filterPatterns: [],
    perCategory: {}
  };
  logger : LogFunctions = {
    info: () => {},
    error: () => {},
  } as LogFunctions;
  triggerIgnoredUpdate : Function = () => {};

  initialize(logger : LogFunctions, triggerIgnoredUpdate : Function = () => {}): void {
    this.logger = logger;
    this.triggerIgnoredUpdate = triggerIgnoredUpdate;
  }

  updateSettings(settings: Settings): void {
    this.settings = settings;
    this.triggerIgnoredUpdate();
  }

  isItemIgnored(item) {
    return (
      this.isItemIgnoredByValue(item) ||
      this.isItemIgnoredByPattern(item) ||
      this.isItemInFilteredCategory(item)
    );
  }

  isItemIgnoredByValue(item) {
    if(this.settings.minimumValue === 0) return false;
    const actualValue = item.stackSize ? item.value / item.stackSize : item.value;
    return actualValue <= this.settings.minimumValue
  }

  isItemIgnoredByPattern(item) {
    if(this.settings.filterPatterns.length === 0) return false;
    const itemName = item.name.toLowerCase();
    const itemType = item.baseType.toLowerCase();
    return this.settings.filterPatterns.some((pattern) => itemName.includes(pattern.toLowerCase()) || itemType.includes(pattern.toLowerCase()));
  }
  
  isItemInFilteredCategory(item) {
    const filter = this.filterPerCategory(item);
    return filter?.ignore;
  }

  filterPerCategory(item) : PerCategoryFilter {
    const { perCategory : itemFilters } = this.settings;
  
    // gem, div card, prophecy can be determined by frametype
    switch (item.frameType) {
      case 4:
        return itemFilters.gem;
      case 6:
        return itemFilters.divcard;
      case 8:
        return itemFilters.prophecy;
      // no default case - if none of the above, fall through
    }
  
    // gear - nonunique, unique
    let typeLine = ItemManager.getEquipmentBaseType(item.baseType);
    if (typeLine && ItemManager.isNonStackable(typeLine)) {
      switch (item.rawData.frameType) {
        case 3:
        case 9:
          // 3 = unique, 9 = relic
          return itemFilters.unique;
        default:
          return itemFilters.nonunique;
      }
    }
  
    // stackable items
    let cat = ItemManager.getCategory(item.rawData, true);
    switch (cat) {
      case 'Maps':
        return itemFilters.map;
      case 'Map Fragments':
      case 'Labyrinth Items': // offering to the goddess
      case 'Misc Map Items': // maven's invitation
        return itemFilters.fragment;
      case 'Currency':
      case 'Stackable Currency':
        return itemFilters.currency;
      case 'Incubator':
        return itemFilters.incubator;
    }
  
    if (Array.isArray(cat)) {
      if (cat[0] === 'Map Fragments') {
        return itemFilters.fragment;
      } else if (cat[0] === 'Stackable Currency') {
        return itemFilters.currency;
      } else {
        // only remaining case is cat[0] === "Currency"
        switch (cat[1]) {
          case 'Oil':
            return itemFilters.oil;
          case 'Catalyst':
            return itemFilters.catalyst;
          case 'Essence':
            return itemFilters.essence;
          case 'Resonator':
          case 'Fossil':
            return itemFilters.delve;
          default:
            return itemFilters.currency;
        }
      }
    }
  
    // default case: return empty filter
    return { ignore: false, minimumValue: 0 };
  }

}

const ignoreManager = new IgnoreManager();

export default ignoreManager;