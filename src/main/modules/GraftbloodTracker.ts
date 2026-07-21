import logger from 'electron-log';
import dayjs from 'dayjs';
import DB from '../db';

export function getGraftbloodFromEquipment(equipment: any[]) {
  if (!equipment || !Array.isArray(equipment)) {
    logger.debug('No equipment found or equipment is not an array');
    return 0;
  }

  let totalGraftblood = 0;
  const grafts = equipment.filter(
    (item) => item.inventoryId && item.inventoryId.includes('BrequelGrafts')
  );

  logger.debug(`Found ${grafts.length} grafts in equipment`);

  grafts.forEach((graft) => {
    if (!graft.properties || !Array.isArray(graft.properties)) {
      return;
    }

    const graftbloodProp = graft.properties.find((prop) => prop.name === 'Graftblood: {0}/{1}');
    if (graftbloodProp && graftbloodProp.values && graftbloodProp.values.length >= 2) {
      const currentValue = parseInt(graftbloodProp.values[0][0], 10);
      if (!isNaN(currentValue)) {
        logger.debug(
          `Found graftblood current value: ${currentValue} for graft: ${
            graft.name || graft.typeLine
          }`
        );
        totalGraftblood += currentValue;
      }
    }
  });

  logger.info(`Total current graftblood: ${totalGraftblood}`);
  return totalGraftblood;
}

export async function logGraftblood(timestamp: string, equipment: any[]) {
  const graftblood = getGraftbloodFromEquipment(equipment);
  logger.debug(`Graftblood at ${timestamp}: ${graftblood}`);

  try {
    await DB.run('INSERT INTO graftblood(timestamp, value) VALUES(?, ?)', [
      dayjs(timestamp).toISOString(),
      graftblood,
    ]);
    logger.debug(`Stored graftblood value ${graftblood} at ${timestamp}`);
  } catch (err) {
    logger.error(`Failed to store graftblood: ${err}`);
  }

  return graftblood;
}

export async function getGraftbloodGained(firstEvent: string, lastEvent: string) {
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

export default {
  getGraftbloodFromEquipment,
  logGraftblood,
  getGraftbloodGained,
};
