import * as atlasRegions from './data/atlasRegions.json';
import * as constants from './data/constants.json';
import * as dialogue from './data/dialogue.json';
import * as mapMods from './data/mapMods.json';
import * as uniqueIcons from './data/uniqueIcons.json';
import * as items from './data/items.json';
import areas from './data/areas.json';

const Constants = {
  ...atlasRegions,
  ...constants,
  ...dialogue,
  ...mapMods,
  ...uniqueIcons,
  areas,
  items,
};

export default Constants;
