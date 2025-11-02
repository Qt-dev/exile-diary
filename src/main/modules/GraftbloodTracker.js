const logger = require('electron-log');
const DB = require('../db').default;
const dayjs = require('dayjs');

/**
 * Extracts current graftblood value from equipment
 * @param {Array} equipment - The equipment array from the GGG API
 * @returns {number} The sum of current graftblood values from both graft slots
 */
function getGraftbloodFromEquipment(equipment) {
  if (!equipment || !Array.isArray(equipment)) {
    logger.debug('No equipment found or equipment is not an array');
    return 0;
  }

  let totalGraftblood = 0;

  // Filter items that are grafts (inventoryId contains BrequelGrafts)
  const grafts = equipment.filter(
    (item) => item.inventoryId && item.inventoryId.includes('BrequelGrafts')
  );

  logger.debug(`Found ${grafts.length} grafts in equipment`);

  grafts.forEach((graft) => {
    if (!graft.properties || !Array.isArray(graft.properties)) {
      return;
    }

    // Find the Graftblood property
    const graftbloodProp = graft.properties.find(
      (prop) => prop.name === 'Graftblood: {0}/{1}'
    );

    if (graftbloodProp && graftbloodProp.values && graftbloodProp.values.length >= 2) {
      // The first value [0] is the current graftblood amount
      const currentValue = parseInt(graftbloodProp.values[0][0], 10);
      if (!isNaN(currentValue)) {
        logger.debug(
          `Found graftblood current value: ${currentValue} for graft: ${graft.name || graft.typeLine}`
        );
        totalGraftblood += currentValue;
      }
    }
  });

  logger.info(`Total current graftblood: ${totalGraftblood}`);
  return totalGraftblood;
}

/**
 * Logs the graftblood data for the current timestamp to the database
 * @param {string} timestamp - The timestamp to log the data for
 * @param {Array} equipment - The equipment array from the GGG API
 * @returns {number} The total graftblood value
 */
async function logGraftblood(timestamp, equipment) {
  const graftblood = getGraftbloodFromEquipment(equipment);
  logger.debug(`Graftblood at ${timestamp}: ${graftblood}`);

  // Store in database
  try {
    await DB.run(
      'INSERT INTO graftblood(timestamp, value) VALUES(?, ?)',
      [dayjs(timestamp).toISOString(), graftblood]
    );
    logger.debug(`Stored graftblood value ${graftblood} at ${timestamp}`);
  } catch (err) {
    logger.error(`Failed to store graftblood: ${err}`);
  }

  return graftblood;
}

/**
 * Gets the graftblood difference between two timestamps
 * @param {string} firstEvent - The first event timestamp
 * @param {string} lastEvent - The last event timestamp
 * @returns {Promise<number>} The graftblood gained in the run
 */
async function getGraftbloodGained(firstEvent, lastEvent) {
  try {
    const rows = await DB.all(
      'SELECT value FROM graftblood WHERE DATETIME(timestamp) BETWEEN DATETIME(?) AND DATETIME(?) ORDER BY timestamp',
      [firstEvent, lastEvent]
    );

    if (rows.length < 2) {
      logger.debug('Not enough graftblood data to calculate gain');
      return null;
    }

    const startValue = rows[0].value;
    const endValue = rows[rows.length - 1].value;
    const gained = endValue - startValue;

    logger.info(`Graftblood gained: ${gained} (from ${startValue} to ${endValue})`);
    return gained;
  } catch (err) {
    logger.error(`Failed to get graftblood gained: ${err}`);
    return null;
  }
}

module.exports = {
  getGraftbloodFromEquipment,
  logGraftblood,
  getGraftbloodGained,
};
