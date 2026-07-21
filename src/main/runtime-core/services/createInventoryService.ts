import InventoryGetter from '../../modules/InventoryGetter';

export function createInventoryService(inventoryGetter = InventoryGetter) {
  return {
    getInventoryDiffs: inventoryGetter.getInventoryDiffs.bind(inventoryGetter),
    compareInventories: inventoryGetter.compareInventories.bind(inventoryGetter),
    getInventory: inventoryGetter.getInventory.bind(inventoryGetter),
  };
}
