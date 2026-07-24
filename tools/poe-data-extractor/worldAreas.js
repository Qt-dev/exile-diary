import Areas from './data/tables/English/WorldAreas.json' with { type: "json" };
import fs from 'fs/promises';
import path from 'path';

const outputFilePath = path.join('.', 'output', 'worldAreas.json');

async function generateWorldAreas() {
  try {
    const worldAreasData = Areas;
    const worldAreasMap = {};

    worldAreasData.forEach((area) => {
      const tempObject = {};
      Object.keys(area).forEach((key) => {
        if(key[0] !== '_') {
          const formattedKey = key.replace(/^\w/g, (c) => c.toLowerCase());
          tempObject[formattedKey] = area[key];
        }
      });
      worldAreasMap[area.Id] = tempObject
      // worldAreasMap[area.Id] = {
      //   name: area.Name,
      //   act: area.Act,
      //   isTown: area.IsTown,
      //   isMap: area.IsMapArea,
      //   isHideout: area.IsHideout,
      //   isLabyrinth: area.IsLabyrinthArea,
      //   isLabyrinthAirlock: area.IsLabyrinthAirlock,
      //   isLabyrinthBoss: area.IsLabyrinthBossArea,
      //   isVaalArea: area.IsVaalArea,
      //   baseLevel: area.AreaLevel,
      // };
    });

    await fs.writeFile(outputFilePath, JSON.stringify(worldAreasMap, null, 2));
    console.log(`World areas map has been successfully generated at ${outputFilePath}`);
  } catch (error) {
    console.error('Error generating world areas map:', error);
  }
}

export default generateWorldAreas;
