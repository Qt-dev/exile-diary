import { makeAutoObservable } from 'mobx';
import { v4 as uuidv4 } from 'uuid';
import moment, { Duration, Moment } from 'moment';

// {
//   "id": "20230414223328",
//   "name": "Crimson Temple",
//   "level": 75,
//   "depth": null,
//   "iiq": 81,
//   "iir": 106,
//   "packsize": 26,
//   "firstevent": "20230414223322",
//   "lastevent": "20230414224408",
//   "xpgained": 24117130,
//   "deaths": 0,
//   "gained": 16.46,
//   "kills": null,
//   "runinfo": "{\"atlasRegion\":\"Lira Arthain\",\"areaTimes\":{\"Crimson Temple\":646},\"maven\":{\"firstLine\":\"20230414223601\",\"bossKilled\":\"20230414223711\"},\"bossBattle\":{\"time\":\"70\"}}"
// }

export class Run {
  id = null;
  runId = '';
  name = '';
  level = 0;
  depth = null;
  iiq = 0;
  iir = 0;
  packSize = 0;
  firstEvent : Moment | null = null;
  lastEvent : Moment | null = null;
  duration: Duration | null = null;
  xp = 0;
  tier : number | null = null;
  xpPerHour = 0;
  deaths = 0;
  profit = 0;
  kills = null;
  runInfo = null;


  // Details
  league : String | null = null;
  initialxp : number | null = null;
  events: any[] = [];
  items: any = {};

  store;
  saveHandler = null;

  constructor(store, id = uuidv4()) {
    makeAutoObservable(this, {
      id: false,
      store: false,
    });
    this.store = store;
    this.id = id;
  }

  updateFromJson(json) {
    this.runId = json.id;
    this.name = json.name;
    this.level = json.level;
    const tentativeTier = this.level - 67;
    this.tier = tentativeTier >= 0 ? tentativeTier : null;
    this.depth = json.depth;
    this.iiq = json.iiq;
    this.iir = json.iir;
    this.packSize = json.packsize;
    this.firstEvent = moment(json.firstevent, 'YYYYMMDDHHmmss');
    this.lastEvent = moment(json.lastevent, 'YYYYMMDDHHmmss');
    this.duration = moment.duration(this.lastEvent.diff(this.firstEvent));
    this.xp = json.xpgained;
    this.xpPerHour = this.xp / this.duration.asHours();
    this.deaths = json.deaths;
    this.profit = json.gained;
    this.kills = json.kills;
    this.runInfo = JSON.parse(json.runinfo);
  }

  updateDetails(details) {
    this.league = details.league;
    this.initialxp = details.prevxp;
    this.events = details.events;
    this.items = details.items;
    // Do something
    console.log(this);
    console.log(details);
  }

  get asJson() {
    return {
      id: this.runId,
      name: this.name,
      level: this.level,
      depth: this.depth,
      iiq: this.iiq,
      iir: this.iir,
      packsize: this.packSize,
      firstevent: this.firstEvent,
      lastevent: this.lastEvent,
      xpgained: this.xp,
      deaths: this.deaths,
      gained: this.profit,
      kills: this.kills,
      runinfo: JSON.stringify(this.runInfo),
    };
  }
}