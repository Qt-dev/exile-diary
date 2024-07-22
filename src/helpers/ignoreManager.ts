import { LogFunctions } from 'electron-log';
// const logger = Logger.scope('ignore-manager');

type Settings = {
  minimumValue: number,
  filterPatterns: string[]
};

class IgnoreManager {
  settings : Settings =  {
    minimumValue: 0,
    filterPatterns: []
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
    return this.isItemIgnoredByValue(item) || this.isItemIgnoredByPattern(item);
  }

  isItemIgnoredByValue(item) {
    const actualValue = item.stackSize ? item.value / item.stackSize : item.value;
    return actualValue <= this.settings.minimumValue
  }

  isItemIgnoredByPattern(item) {
    return false;
  }

}

const ignoreManager = new IgnoreManager();

export default ignoreManager;