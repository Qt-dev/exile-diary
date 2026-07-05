const logger = require('electron-log');
const path = require('path');
const fs = require('fs');
const { getUserDataPath } = require('../runtime/getUserDataPath');

function readSettingsFile(settingsPath) {
  if (!fs.existsSync(settingsPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
}

function get() {
  var settings = null;
  try {
    settings = readSettingsFile(path.join(getUserDataPath(), 'settings.json'));
  } catch (err) {
    logger.info(err);
    logger.info('Unable to load settings.json');
    // do nothing if file doesn't exist
  }
  return settings;
}

function set(key, value) {
  var settingsPath = path.join(getUserDataPath(), 'settings.json');
  if (fs.existsSync(settingsPath)) {
    var settings = readSettingsFile(settingsPath);
    if (!settings) {
      return;
    }
    settings[key] = value;
    var tempFilePath = path.join(getUserDataPath(), 'settings.json.bak');
    fs.writeFile(tempFilePath, JSON.stringify(settings), (err) => {
      if (err) {
        logger.info('Error writing temp settings file: ' + err.message);
      } else {
        logger.info(`Renaming ${settingsPath}`);
        fs.rename(tempFilePath, settingsPath, (err2) => {
          if (err2) {
            logger.info('Error copying temp settings file: ' + err2.message);
          } else {
            if (key !== 'mainWindowBounds') {
              logger.info(`Set "${key}" to ${JSON.stringify(value)}`);
            }
          }
        });
      }
    });
  }
}

module.exports.get = get;
module.exports.set = set;
