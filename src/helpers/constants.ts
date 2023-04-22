import * as atlasRegions from './data/atlasRegions.json';
import * as constants from './data/constants.json';
import * as dialogue from './data/dialogue.json';
import * as mapMods from './data/mapMods.json';
import * as uniqueIcons from './data/uniqueIcons.json';

const Constants = {
  ...atlasRegions,
  ...constants,
  ...dialogue,
  ...mapMods,
  ...uniqueIcons,
};

export default Constants