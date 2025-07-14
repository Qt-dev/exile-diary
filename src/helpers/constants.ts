import * as atlasRegions from './data/atlasRegions.json';
import * as constants from './data/constants.json';
import * as dialogue from './data/dialogue.json';
import * as mapMods from './data/mapMods.json';
import * as uniqueIcons from './data/uniqueIcons.json';
import * as items from './data/items.json';
import * as worldAreas from './data/worldAreas.json';
import areas from './data/areas.json';

type ConstantContainer = {
  mapMods: string[];
  areas: {
    [key: string]: string[];
  };
  items: {
    [key: string]: any;
  };
  [key: string]: any;
}

const Constants: ConstantContainer = {
  ...atlasRegions,
  ...constants,
  ...dialogue,
  ...mapMods,
  ...uniqueIcons,
  areas,
  worldAreas,
  items,
};


export default Constants;
