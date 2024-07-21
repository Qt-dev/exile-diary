import SettingsManager from './SettingsManager';
import DB from './db/items';
import Logger from 'electron-log';
const logger = Logger.scope('ignore-manager');


const IgnoreManager = {
  isItemIgnored: (item) => {
    return IgnoreManager.isItemIgnoredByValue(item) || IgnoreManager.isItemIgnoredByPattern(item);
  },
  isItemIgnoredByValue: (item) => {
    return item.value < SettingsManager.get('filters').minimumValue
  },
  isItemIgnoredByPattern: (item) => {
    return false;
  },
  setupSettingsListener: ({ refreshUICallback }) => {
    SettingsManager.registerListener('filters', async ({ minimumValue, filterPatterns }) => {
      logger.info('Filter settings changed, updating ignored items');
      await DB.updateIgnoredItems({ minimumValue, filterPatterns });
      refreshUICallback();
    });
  }
};

export default IgnoreManager;