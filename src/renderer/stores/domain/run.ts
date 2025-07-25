import { makeAutoObservable, computed } from 'mobx';
import { v4 as uuidv4 } from 'uuid';
import dayjs, { Dayjs } from 'dayjs';
import ItemStore from '../itemStore';
import Logger from 'electron-log/renderer';

type JSONRun = {
  id: number;
  name: string;
  level: number;
  depth: number | null;
  iiq: number;
  iir: number;
  pack_size: number;
  first_event: string | null;
  last_event: string | null;
  xpgained: number;
  deaths: number;
  gained: number;
  kills: number | null;
  run_info: string;
  mods: { mod: string }[];
};

export class Run {
  id = null;
  lastUpdate: Dayjs;
  runId = 0;
  name = 'Unknown';
  level = 0;
  depth = null;
  iiq = 0;
  iir = 0;
  packSize = 0;
  firstEvent: Dayjs | null = null;
  lastEvent: Dayjs | null = null;
  duration: plugin.Duration | null = null;
  xp = 0;
  tier: number | null = null;
  xpPerHour = 0;
  deaths = 0;
  profit = 0;
  kills = null;
  runInfo = null;

  completed = false; // Whether the run is completed or not

  // Details
  league: String | null = null;
  initialxp: number | null = null;
  events: any[] = [];
  items: any = {};
  profitPerHour: any = 0;

  store;
  saveHandler = null;
  itemStore: ItemStore | null = null;
  mods: { mod: string }[] = [];

  constructor(store, options = {}) {
    const id = uuidv4();
    makeAutoObservable(this, {
      id: false,
      store: false,
    });
    this.store = store;
    this.id = id;
    this.updateFromJson(options);
    this.lastUpdate = dayjs();
  }

  updateFromJson(json) {
    this.runId = json.id;
    this.name = json.name;
    this.level = json.level ?? this.level;
    const tentativeTier = this.level - 67;
    this.tier = tentativeTier >= 0 ? tentativeTier : null;
    this.depth = json.depth;
    this.iiq = json.iiq ?? this.iiq;
    this.iir = json.iir ?? this.iir;
    this.packSize = json.pack_size ?? this.packSize;
    this.firstEvent = dayjs(json.first_event);
    this.lastEvent = dayjs(json.last_event);
    this.duration = dayjs.duration(this.lastEvent.diff(this.firstEvent));
    this.xp = json.xpgained;
    this.xpPerHour = this.xp / this.duration.asHours();
    this.deaths = json.deaths || this.deaths;
    this.profit = json.gained;
    this.profitPerHour = this.profit / this.duration.asHours();
    this.kills = json.kills;
    this.runInfo = json.run_info ? JSON.parse(json.run_info) : {};
    this.lastUpdate = dayjs();
    this.completed = !!json.completed || false;
  }

  updateDetails(details) {
    // Logger.debug('Updating Run Details', details);
    this.league = details.league;
    this.initialxp = details.prevxp;
    this.events = details.events;
    this.items = details.items;
    this.mods = details.mods || [];
    this.completed = !!details.completed || false;

    // Logger.debug('Building Store', details.items);
    const items: any = [];
    for (const eventId in details.items) {
      // Add loot events to the events array
      // Logger.debug('Adding loot event', details.items[eventId]);
      const timestamp =
        details.events.find((e) => e.id === parseInt(eventId))?.timestamp || dayjs().toISOString();
      this.events.push({
        id: eventId,
        event_type: 'loot',
        event_text: JSON.stringify(details.items[eventId]),
        timestamp,
      });

      // Prepare items for the store
      details.items[eventId].forEach((item) => {
        if (!item) return;
        let newItem;
        try {
          newItem = JSON.parse(item);
        } catch (e) {
          newItem = { ...item };
        }
        newItem.lootTime = timestamp;
        items.push(newItem);
      });
    }
    this.itemStore = new ItemStore(items);

    this.events = this.events.sort((a, b) => {
      // If events happen at the same time (= loot + back to hideout), put loot first
      const isDifference = a.id - b.id;
      const isBLoot = b.event_type === 'loot' ? 1 : -1;
      return isDifference === 0 ? isBLoot : isDifference;
    });
    // Do something
    this.lastUpdate = dayjs();
  }

  get asJson(): JSONRun {
    return {
      id: this.runId,
      name: this.name,
      level: this.level,
      depth: this.depth,
      iiq: this.iiq,
      iir: this.iir,
      pack_size: this.packSize,
      first_event: this.firstEvent?.toISOString() ?? null,
      last_event: this.lastEvent?.toISOString() ?? null,
      xpgained: this.xp,
      deaths: this.deaths,
      gained: this.gained,
      kills: this.kills,
      run_info: JSON.stringify(this.runInfo),
      mods: this.mods,
    };
  }

  static getCsvHeaders() {
    const fakeJSONRun: JSONRun = {
      id: 0,
      name: '',
      level: 0,
      depth: 0,
      iiq: 0,
      iir: 0,
      pack_size: 0,
      first_event: '',
      last_event: '',
      xpgained: 0,
      deaths: 0,
      gained: 0,
      kills: 0,
      run_info: '',
      mods: [],
    };
    return Object.keys(fakeJSONRun);
  }

  @computed get gained() {
    return this.itemStore ? this.itemStore.value : this.profit;
  }

  @computed get gainedPerHour() {
    return this.duration ? this.gained / this.duration.asHours() : 0;
  }
}
