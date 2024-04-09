const data = require('../../helpers/constants').default.items;
const { getCategory } = require('../../helpers/item');

const equipmentBaseTypes = data.baseTypes.equipments;
const gemBaseTypes = data.baseTypes.gems;
const nonStackableBaseTypes = [].concat(Object.keys(equipmentBaseTypes), Object.keys(gemBaseTypes));

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
