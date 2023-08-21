import EventEmitter from 'events';
import { ItemData } from '../../helpers/types';
import DB from '../db/incubators';
import SettingsManager from '../SettingsManager';

const emitter = new EventEmitter();

const incubatorGearSlots = [
  'Helm',
  'BodyArmour',
  'Gloves',
  'Boots',
  'Ring',
  'Ring2',
  'Amulet',
  'Boots',
  'Weapon',
  'Offhand',
  'Trinket',
  'Belt',
  // weapon2 and offhand2 not included - alternate weapon set does not accumulate monster kills
  // seems inconsistent with gem leveling??
];

async function logKillCount(timestamp: number, eqp: { [key: string]: ItemData }) {
  const incubators = {};
  Object.keys(eqp).forEach((key) => {
    const item: ItemData = eqp[key];
    if (item.incubatedItem) {
      incubators[key] = {
        gearSlot: item.inventoryId,
        itemType: item.incubatedItem.name,
        level: item.incubatedItem.level,
        progress: item.incubatedItem.progress,
        total: item.incubatedItem.total,
      };
    }
  });

  const settings = SettingsManager.getAll();
  if (settings.enableIncubatorAlert) {
    // emit any missing incubators
    const emptySlotIcons = Object.values(eqp)
      .filter((item) => incubatorGearSlots.indexOf(item.inventoryId) >= 0 && !item.incubatedItem)
      .map((item: any) => [item.inventoryId, item.icon]);
    emitter.emit('incubatorsMissing', emptySlotIcons);
  }

  const currIncubators = JSON.stringify(incubators);
  const prevIncubators = await DB.getPreviousIncubators();
  if (prevIncubators === currIncubators) {
    return;
  } else {
    await DB.insertNewIncubators(timestamp, currIncubators);
  }
}

export default {
  logKillCount,
  emitter,
};
