import zlib from 'node:zlib';
import logger from 'electron-log';
import { deepEqual } from 'fast-equals';
import GGGAPI from '../GGGAPI';
import DB from '../db';
import Utils from './Utils';
import settingsRepository from './settings';

let settings: any;

export const gearSlots = [
  'Helm',
  'Amulet',
  'BodyArmour',
  'Gloves',
  'Ring',
  'Ring2',
  'Belt',
  'Boots',
  //  "Weapon",
  //  "Weapon2",
  //  "Offhand",
  //  "Offhand2"
];

export const multiGearSlots = [
  'Weapons',
  'AmuletSockets',
  'BeltSockets',
  'BodyArmourSockets',
  'BootsSockets',
  'GlovesSockets',
  'HelmSockets',
  'RingSockets',
  'Ring2Sockets',
  'WeaponsSockets',
  'Flask',
  'TreeJewels',
];

export const equipmentSlots = [
  'Helm',
  'Amulet',
  'BodyArmour',
  'Gloves',
  'Ring',
  'Ring2',
  'Belt',
  'Boots',
  'Weapons',
  'Flask',
  'TreeJewels',
];

const flaskIgnoreProperties = [
  'Lasts %0 Seconds',
  'Consumes %0 of %1 Charges on use',
  'Currently has %0 Charge',
  'Currently has %0 Charges',
  'Lasts {0} Seconds',
  'Consumes {0} of {1} Charges on use',
  'Currently has {0} Charge',
  'Currently has {0} Charges',
];

export async function check(timestamp: string, eqp: Record<string, any>) {
  if (!eqp) {
    logger.error('No equipment found in inventory. Skipping Gear change Check.');
    return;
  }

  settings = settingsRepository.get();
  if (settings?.activeProfile?.noGearCheck) {
    logger.info('Gear checking disabled in settings');
    return;
  }

  const currGear: Record<string, any> = {};

  const eqpKeys = Object.keys(eqp);
  for (let i = 0; i < eqpKeys.length; i++) {
    const item = eqp[eqpKeys[i]];
    if (!item.inventoryId) continue;

    let inv = item.inventoryId;
    if (['Weapon', 'Weapon2', 'Offhand', 'Offhand2'].includes(inv)) {
      inv = 'Weapons';
    }

    if (item.socketedItems) {
      if (inv !== 'Weapons') {
        currGear[`${inv}Sockets`] = item.socketedItems;
      } else {
        currGear.WeaponsSockets = currGear.WeaponsSockets || [];
        currGear.WeaponsSockets = [...currGear.WeaponsSockets, ...item.socketedItems];
      }
    }

    delete item.league;
    delete item.incubatedItem;

    if (inv === 'Flask' || inv === 'Weapons') {
      currGear[inv] = currGear[inv] || [];
      currGear[inv].push(item);
    } else {
      currGear[inv] = item;
    }
  }

  const jewels = await getEquippedJewels();
  if (jewels) {
    currGear.TreeJewels = [];
    for (let i = 0; i < jewels.length; i++) {
      currGear.TreeJewels.push(jewels[i]);
    }
  } else {
    logger.info('Error getting equipped jewels, will not check diffs for now');
    return;
  }

  const prevGear = await getPreviousEquipment(timestamp);
  if (!prevGear) {
    logger.info('Error getting previous gear, will not check diffs for now');
    return;
  }

  if (prevGear === 'none') {
    await insertEquipment(timestamp, currGear);
    return;
  }

  await compareEquipment(timestamp, prevGear, currGear);
}

async function getEquippedJewels() {
  const skillTree = await GGGAPI.getSkillTree();
  return skillTree.jewel_data;
}

function getPreviousEquipment(timestamp: string) {
  return new Promise<any | 'none' | null>((resolve) => {
    DB.get('select data from gear where timestamp < ? order by timestamp desc limit 1', [timestamp])
      .then((row) => {
        if (!row) {
          logger.info('No previous equipment found!');
          resolve('none');
          return;
        }

        zlib.inflate(row.data, (err, buffer) => {
          if (err) {
            resolve(JSON.parse(row.data));
            return;
          }

          resolve(JSON.parse(buffer.toString()));
        });
      })
      .catch((err) => {
        logger.info(`Unable to retrieve previous equipment: ${err}`);
        resolve(null);
      });
  });
}

async function compareEquipment(
  timestamp: string,
  prev: Record<string, any>,
  curr: Record<string, any>
) {
  const diffs: Record<string, { prev: any; curr: any }> = {};

  for (const slot of gearSlots) {
    if (!prev[slot] && curr[slot]) {
      addDiff(slot, null, curr[slot]);
    } else if (prev[slot] && !curr[slot]) {
      addDiff(slot, prev[slot], null);
    } else if (!itemsEqual(prev[slot], curr[slot])) {
      addDiff(slot, prev[slot], curr[slot]);
    }
  }

  for (const slot of multiGearSlots) {
    prev[slot] = prev[slot] || [];
    curr[slot] = curr[slot] || [];

    const prevTemp = JSON.parse(JSON.stringify(prev[slot]));
    const currTemp = JSON.parse(JSON.stringify(curr[slot]));

    for (let i = prevTemp.length - 1; i >= 0; i--) {
      const previousItem = prevTemp[i];
      for (let j = currTemp.length - 1; j >= 0; j--) {
        const currentItem = currTemp[j];
        if (itemsEqual(previousItem, currentItem)) {
          prevTemp.splice(i, 1);
          currTemp.splice(j, 1);
          break;
        }
      }
    }

    if (prevTemp.length > 0 || currTemp.length > 0) {
      addDiff(slot, prevTemp, currTemp);
    }
  }

  if (Object.keys(diffs).length > 0) {
    logger.info('Inserting equipment diff');
    await insertEquipment(timestamp, curr, diffs);
  } else {
    logger.info('No diffs found in equipment, returning');
  }

  function addDiff(slot: string, previousValue: any, currentValue: any) {
    logger.info(`Diffs found in ${slot}`);
    diffs[slot] = { prev: previousValue, curr: currentValue };
  }
}

export function itemsEqual(a: any, b: any) {
  if (!a || !b) {
    return a == b;
  }

  return deepEqual(getTempItem(a), getTempItem(b));
}

function getTempItem(item: any) {
  let tempItem;
  try {
    tempItem = JSON.parse(JSON.stringify(item));
  } catch (error) {
    logger.info('Error parsing, item follows');
    logger.info(JSON.stringify(item));
  }

  if (tempItem.inventoryId === 'Flask' && tempItem.properties) {
    delete tempItem.enchantMods;
    for (let i = tempItem.properties.length - 1; i >= 0; i--) {
      if (flaskIgnoreProperties.includes(tempItem.properties[i].name)) {
        tempItem.properties.splice(i, 1);
      }
    }
  }

  delete tempItem.icon;
  delete tempItem.inventoryId;
  delete tempItem.requirements;
  delete tempItem.additionalProperties;
  delete tempItem.socketedItems;
  delete tempItem.x;
  delete tempItem.y;

  return tempItem;
}

async function insertEquipment(
  timestamp: string,
  currData: Record<string, any>,
  diffData: any = ''
) {
  const data = await Utils.compress(currData);
  const diff = JSON.stringify(diffData);

  DB.run('insert into gear(timestamp, data, diff) values(?, ?, ?)', [timestamp, data, diff])
    .then(() => {
      logger.info(
        `Updated last equipment at ${timestamp} (data length: ${data.length}, diff length: ${diff.length})`
      );
    })
    .catch((err) => {
      logger.info(`Unable to insert equipment: ${err}`);
    });
}

export default {
  check,
  itemsEqual,
  gearSlots,
  multiGearSlots,
  equipmentSlots,
};
