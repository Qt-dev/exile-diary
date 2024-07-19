import SettingsManager from './SettingsManager';

const IgnoreManager = {
  isItemIgnored: (item) => {
    return IgnoreManager.isItemIgnoredByValue(item) || IgnoreManager.isItemIgnoredByPattern(item);
  },
  isItemIgnoredByValue: (item) => {
    return item.value < SettingsManager.get('pricing').minimumValue
  },
  isItemIgnoredByPattern: (item) => {
    return false;
  },
};

export default IgnoreManager;