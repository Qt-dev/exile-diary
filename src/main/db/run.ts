import DB from './index';
import constants from '../../helpers/constants';

type ItemProperty = {
  name: string;
  values: any[];
  displayMode: number;
  type: number;
};

type ItemRawData = {
  verified: boolean;
  icon: string;
  stackSize: number;
  maxStackSize: number;
  league: string;
  id: string;
  name: string;
  typeLine: string;
  baseType: string;
  identified: boolean;
  ilvl: number;
  properties: ItemProperty[];
  explicitMods: string[];
  descrText: string;
  frameType: number;
  elder?: boolean;
  secretName?: string;
  value?: number;
  pickupStackSize?: number;
  rarity?: string;
};

type Item = {
  id: string;
  rarity: string;
  icon: string;
  value: number;
  stacksize: number;
  rawdata: string;
};

const getItemNameFromIcon = (iconUrl: string) => {
  if (iconUrl.includes('?')) {
    iconUrl = iconUrl.substring(0, iconUrl.indexOf('?'));
  }

  // Items can have encoded URLs, need to extract item ID from base64 encoded string
  if (iconUrl.includes('https://web.poecdn.com/gen/image/')) {
    let iconPath = iconUrl.replace('https://web.poecdn.com/gen/image/', '');
    iconPath = iconPath.substring(0, iconPath.indexOf('/'));
    const decodedPath = JSON.parse(Buffer.from(iconPath, 'base64').toString('utf8'))[2].f.replace(
      '2DItems/',
      ''
    );

    if (decodedPath.includes('/Flasks/')) {
      const flaskId = decodedPath.replace('Art/', '').replace('Flasks/', '');
      return constants.uniqueFlasks[flaskId] || null;
    } else if (decodedPath.includes('/Maps/')) {
      const mapId = decodedPath.replace('Art/', '').replace('Maps/', '');
      return constants.uniqueMaps[mapId] || null;
    } else {
      return constants.uniqueIconsNew[decodedPath] || null;
    }
  } else {
    return constants.uniqueIcons[iconUrl] || null;
  }
};

const Runs = {
  getLastRuns: async (numberOfRunsToShow: number) => {
    // var numberOfShownMaps = $("#numberOfShownMaps").val() || 10;
    const lastRunsQuery = `
      select mapruns.id, name, level, depth, iiq, iir, packsize, firstevent, lastevent,
        (mapruns.xp - (select xp from mapruns m where m.id < mapruns.id and xp is not null order by m.id desc limit 1)) xpgained,
        (select count(1) from events where event_type='slain' and events.id between firstevent and lastevent) deaths,
        gained, kills, runinfo
      from areainfo, mapruns
      where areainfo.id = mapruns.id
        and json_extract(runinfo, '$.ignored') is null
      order by mapruns.id desc
      limit ?
    `;

    const runData = await DB.all(lastRunsQuery, [numberOfRunsToShow]);

    return runData;
  },

  getRunMods: async (mapId: number): Promise<any> => {
    const mapModsQuery = `
      select mod
      from mapmods
      where id = ?
    `;

    const mapMods = await DB.all(mapModsQuery, [mapId]);

    return mapMods;
  },

  getEvents: async (mapId: number) => {
    const eventsQuery = `
      select events.* from mapruns, events 
      where mapruns.id = ?
      and events.id between mapruns.firstevent and mapruns.lastevent 
      order by events.id;
    `;

    const events = await DB.all(eventsQuery, [mapId]);

    return events;
  },

  getRunInfo: async (mapId: number): Promise<any> => {
    const mapInfoQuery = `
      select name, level, depth, iiq, iir, packsize, xp, kills, runinfo, firstevent, lastevent,
      (select xp from mapruns m where m.id < mapruns.id and xp is not null order by m.id desc limit 1) prevxp,
      (select league from leagues where timestamp < lastevent order by timestamp desc limit 1) league
      from areainfo, mapruns where mapruns.id = ?
        and areainfo.id = ?
    `;

    const mapInfo = await DB.all(mapInfoQuery, [mapId, mapId]);

    return mapInfo;
  },

  getItems: async (mapId: number) => {
    const itemsQuery = `
      select events.id, items.rarity, items.icon, items.value, items.stacksize, items.rawdata from mapruns, events, items
      where mapruns.id = ?
      and events.id between mapruns.firstevent and mapruns.lastevent
      and items.event_id = events.id;
    `;

    const items = (await DB.all(itemsQuery, [mapId])) as Item[];
    if (!items) return [];
    const formattedItems: any = {};

    for (const item of items) {
      const rawData: ItemRawData = JSON.parse(item.rawdata);
      rawData.rarity = item.rarity;
      if (!formattedItems.hasOwnProperty(item.id)) {
        formattedItems[item.id] = [];
      }
      let secretName = '';
      if (item.rarity === 'Unique') {
        secretName = getItemNameFromIcon(item.icon);
      }
      if (secretName && secretName === 'Starforge' && rawData.elder) {
        secretName = 'Voidforge';
      }

      if (secretName || item.value || item.stacksize) {
        if (secretName) rawData.secretName = secretName;
        if (item.value) rawData.value = item.value;
        if (item.stacksize) rawData.pickupStackSize = item.stacksize;
        formattedItems[item.id].push(JSON.stringify(rawData));
      } else {
        formattedItems[item.id].push(item.rawdata);
      }
    }
    return formattedItems;
  },

  getRun: async (mapId: number) => {
    const mapInfo = await Runs.getRunInfo(mapId);
    const mods = await Runs.getRunMods(mapId);
    const events = await Runs.getEvents(mapId);
    const items = await Runs.getItems(mapId);

    const run = {
      ...mapInfo[0],
      events,
      items,
      mods,
    };

    return run;
  },
};

export default Runs;
