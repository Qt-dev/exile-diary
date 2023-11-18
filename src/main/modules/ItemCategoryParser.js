const logger = require('electron-log');
const data = require('../../helpers/constants').default.items;

const equipmentBaseTypes = data.baseTypes.equipments;
const gemBaseTypes = data.baseTypes.gems;
const otherBaseTypes = data.baseTypes.others;
const nonStackableBaseTypes = [].concat(Object.keys(equipmentBaseTypes), Object.keys(gemBaseTypes));

const metamorphSamples = [
  'BrainInventory',
  'LungInventory',
  'HeartInventory',
  'LiverInventory',
  'EyeballInventory',
];

const nonStackableBulkItems = [
  'Map Fragments',
  'Prophecy',
  'Labyrinth Items',
  'Maps',
  'Incubator',
  'Atlas Region Upgrade Item',
  "Kirac's Memory",
  "Einhar's Memory",
  "Niko's Memory",
  "Alva's Memory",
  'Writhing Invitation',
  'Screaming Invitation',
  'Polaric Invitation',
  'Incandescent Invitation',
  "Maven's Invitation",
];

function getCategory(item, subcategory = false) {
  // handle hybrid gems
  var t = item.hybrid ? item.hybrid.baseTypeName : item.typeLine;
  if (!t) return null;

  if (t === 'Expedition Logbook') {
    return t;
  }

  //Memories
  if (t.includes("Kirac's Memory")) {
    return "Kirac's Memory";
  }
  if (t.includes("Einhar's Memory")) {
    return "Einhar's Memory";
  }
  if (t.includes("Niko's Memory")) {
    return "Niko's Memory";
  }
  if (t.includes("Alva's Memory")) {
    return "Alva's Memory";
  }

  //Invitations
  if (t.includes('Writhing Invitation')) {
    return 'Writhing Invitation';
  }
  if (t.includes('Screaming Invitation')) {
    return 'Screaming Invitation';
  }
  if (t.includes('Polaric Invitation')) {
    return 'Polaric Invitation';
  }
  if (t.includes('Incandescent Invitation')) {
    return 'Incandescent Invitation';
  }
  if (t.includes("Maven's Invitation")) {
    return "Maven's Invitation";
  }

  if (t.includes('Contract')) {
    return data.names.heistQuestItems.includes(t) ? 'Quest Items' : 'Contract';
  }

  if (t.includes('Blueprint')) {
    return 'Blueprint';
  }

  if (otherBaseTypes[t]) {
    if (!subcategory && Array.isArray(otherBaseTypes[t])) {
      return otherBaseTypes[t][0];
    } else {
      return otherBaseTypes[t];
    }
  }

  switch (item.frameType) {
    case 4:
      var n = t.replace(/(Superior|Anomalous|Divergent|Phantasmal) /g, '');
      if (t.endsWith('Support')) {
        return 'Support Skill Gems';
      } else {
        return 'Active Skill Gems';
      }
    case 5: // currency items
      if (t.startsWith('Captured Soul')) {
        return 'Pantheon Soul';
      } else if (
        t.toLowerCase().endsWith('seed') ||
        t.toLowerCase().endsWith('grain') ||
        t.toLowerCase().endsWith('bulb') ||
        t.toLowerCase().endsWith('fruit') ||
        t.toLowerCase().endsWith('lifeForce')
      ) {
        return 'Harvest Seed';
      }
      return 'Currency';
    case 6:
      return 'Divination Card';
    case 7:
      return 'Quest Items';
    case 8:
      return 'Prophecy';
  }

  if (t.toLowerCase().endsWith('scarab')) {
    return subcategory ? ['Map Fragments', 'Scarab'] : 'Map Fragments';
  }

  if (t.includes('Watchstone')) {
    return 'Atlas Region Upgrade Item';
  }

  // Maligaro's Map quest item has frameType 7, already detected above as a quest item
  if (t.includes(' Map')) {
    return 'Maps';
  }

  if (t.toLowerCase().endsWith('incubator')) {
    return 'Incubator';
  }

  if (t.toLowerCase().endsWith('piece')) {
    return 'Harbinger Item Piece';
  }

  if (item.icon.includes('BestiaryOrbFull')) {
    return 'Captured Beast';
  }

  // 3.9 metamorph inventory organs
  for (var i = 0; i < metamorphSamples.length; i++) {
    if (item.icon.includes(metamorphSamples[i])) return 'Metamorph Sample';
  }

  // equipment - search by hardcoded basetype
  t = t.replace('Superior ', '');

  // non-magic equipment
  if (item.frameType !== 1) {
    if (equipmentBaseTypes[t]) {
      return equipmentBaseTypes[t];
    }
  }

  // magic equipment - typeline is polluted by prefixes $%&*#^@!!!
  var keys = Object.keys(equipmentBaseTypes);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (t.includes(key)) {
      return equipmentBaseTypes[key];
    }
  }

  logger.info(`No category found for item ${item.id || '(no id)'}! JSON follows:`);
  logger.info(JSON.stringify(item));
  return null;
}

function getEquipmentBaseType(str) {
  var types = Object.keys(equipmentBaseTypes);
  for (var i = 0; i < types.length; i++) {
    if (str.includes(types[i])) {
      return types[i];
    }
  }
  return null;
}

function isNonStackable(str) {
  return nonStackableBaseTypes.includes(str);
}

module.exports.getCategory = getCategory;
module.exports.getEquipmentBaseType = getEquipmentBaseType;
module.exports.isNonStackable = isNonStackable;
module.exports.nonStackableBulkItems = nonStackableBulkItems;
