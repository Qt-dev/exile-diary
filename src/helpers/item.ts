import Logger from 'electron-log';
import Constants from './constants';

const logger = Logger.scope('item-helper');


// Get the item category from all the itemData.
// Lots of hardcoded stuff here, but it's the best way that we found.
export const getCategory = (item, subcategory = false) => {
  // Read type for hybrid items too
  let type = item.hybrid ? item.hybrid.baseTypeName : item.typeLine;
  if (!type) return null;

  const iconFileName = item.icon.replace(/^.*[\\/]/, '');

  // Easiest cases
  if (type === 'Expedition Logbook') return type;
  if (type.includes('Blueprint')) return 'Blueprint';
  if (type.includes('Contract'))
    return Constants.items.names.heistQuestItems.includes(type) ? 'Quest Items' : 'Contract';

  // Memories
  for (const memory of Constants.items.names.memories) {
    if (type.includes(memory)) return memory;
  }

  // Invitations
  for (const invitation of Constants.items.names.invitations) {
    if (type.includes(invitation)) return invitation;
  }

  // Misc basetypes that we know of
  if (Constants.items.baseTypes.others[type]) {
    const foundBaseType = Constants.items.baseTypes.others[type];
    return !subcategory && Array.isArray(foundBaseType) ? foundBaseType[0] : foundBaseType;
  }

  // Items where we can guess the category from the frameType
  // Order matters here, because some items need to be captured by this before we test them for the next categories
  switch (item.frameType) {
    // 4 = Gems
    case 4:
      const gemName = type.replace(/(Superior|Anomalous|Divergent|Phantasmal) /g, '');
      if (gemName.endsWith('Support')) {
        return 'Support Skill Gems';
      } else {
        return 'Active Skill Gems';
      }
    case 5:
      if (type.startsWith('Captured Soul')) {
        return 'Pantheon Soul';
      } else if (type.includes('Coffin')) {
        return 'Coffin';
      } else {
        return 'Labyrinth Items';
      }
    case 6:
      return 'Divination Card';
    case 7:
      return 'Quest Items';
    case 8:
      return 'Prophecy';
    case 11:
      return 'Allflame Ember';
  }

  // Maligaro's Map quest item has frameType 7, already detected above as a quest item
  if (type.includes(' Map')) return 'Maps';
  if (type.includes('Scarab')) return subcategory ? ['Map Fragments', 'Scarab'] : 'Map Fragments';
  if (type.includes('Watchstone')) return 'Atlas Region Upgrade Item';
  if (type.endsWith('Incubator')) return 'Incubator';
  if (type.endsWith('Piece')) return 'Harbinger Item Piece';
  if (item.icon.includes('BestiaryOrbFull')) return 'Captured Beast';

  // Metamorph organs
  if (Constants.items.names.metamorphSamples.includes(iconFileName.replace(/\..*$/, '')))
    return 'Metamorph Sample';

  // equipment - search by hardcoded basetype
  // Remove quality if present
  type = type.replace('Superior ', '');

  // Non-magic equipment
  if (item.frameType !== 1 && Constants.items.baseTypes.equipments[type])
    return Constants.items.baseTypes.equipments[type];

  // Magic equipment - typeline is polluted by prefixes $%&*#^@!!!
  for (const baseTypeName in Constants.items.baseTypes.equipments) {
    if (type.includes(baseTypeName)) return Constants.items.baseTypes.equipments[baseTypeName];
  }

  logger.error(`No category found for item ${item.id || '(no id)'}! JSON follows:`);
  logger.info(item);
  return null;
};