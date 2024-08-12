import { expect } from 'chai';
import { stub, createSandbox } from 'sinon';
import rewiremock from 'rewiremock';

import Constants from '../../../src/helpers/constants';

const DB = {
  getLeagueDbPath: stub(),
  getCharacterDbPath: stub(),
  getManager: stub(),
  all: stub(),
  get: stub(),
  run: stub(),
  transaction: stub(),
  initDB: stub(),
  initLeagueDB: stub(),
};

const InputConstants = {
  all: {
    valid: [1, 2, 3],
  },
  lastevents: {
    valid: [
      {
        id: 1,
        event_text: 'I am an event',
        server: '0.0.0.0',
      },
      {
        id: 2,
        event_text: 'I am an event',
        server: '0.0.0.1',
      },
      {
        id: 3,
        event_text: 'I am an event',
        server: '0.0.0.2',
      },
    ],
  },
  lastevent: {
    valid: 'I am an event',
    empty: null,
  },
};

const externalDependencies = {
  '../db': DB,
  '../db/run': {
    getRunsFromDates: stub(),
    getItemsFromRun: stub(),
    updateItemValues: stub(),
  },
  '../GGGAPI': {
    getDataForInventory: stub(),
  },
  '../RendererLogger': {
    log: stub(),
  },
  '../SettingsManager': {
    get: stub(),
  },
  './ItemPricer': {
    price: stub(),
    getRatesFor: stub(),
  },
  './XPTracker': {
    isMaxXP: stub(),
  },
  './Utils': {
    default: {
      isTown: stub(),
      sleep: stub(),
      getRunningTime: stub(),
      isLabArea: stub(),
    },
  },
  'electron-log': {
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
    scope: () => {},
  },
};

let RunParser: any = (
  rewiremock.proxy('../../../src/main/modules/RunParser', (r) => externalDependencies) as any
).default;

describe('RunParser', () => {
  describe('setLatestGeneratedArea', () => {
    after(() => {
      // Reset Latest Area to default
      RunParser.setLatestGeneratedArea({
        id: 0,
        name: '',
      });
    });
    it('should call set the latestGeneratedArea', () => {
      const areaInfo = {
        id: 1,
        name: 'test',
      };
      RunParser.setLatestGeneratedArea(areaInfo);
      expect(RunParser.latestGeneratedArea).to.deep.equal(areaInfo);
    });
    it('should not set it up if there is no area argument', () => {
      const areaInfo = {
        id: 1,
        name: 'test',
      };
      RunParser.setLatestGeneratedArea();
      expect(RunParser.latestGeneratedArea).not.to.deep.equal(areaInfo);
    });
  });

  describe('setLatestGeneratedAreaLevel', () => {
    it('should set the latestGeneratedAreaLevel', () => {
      const level = 1;
      RunParser.setLatestGeneratedAreaLevel(level);
      expect(RunParser.latestGeneratedArea.level).to.equal(level);
    });
  });

  describe('getAreaInfo', () => {
    before(() => {
      DB.get.reset();
    });
    afterEach(() => {
      DB.get.reset();
    });
    it('should return the correct area info', async () => {
      const area = 'Area 1';
      DB.get.resolves(area);
      const result = await RunParser.getAreaInfo(
        { timestamp: 1, area: 'Place 1' },
        { timestamp: 2, area: 'Place 2' }
      );
      expect(result).to.equal(area);
    });
    it('should return null if the DB call fails', async () => {
      DB.get.rejects();
      const result = await RunParser.getAreaInfo(
        { timestamp: 1, area: 'Place 1' },
        { timestamp: 2, area: 'Place 2' }
      );
      expect(result).to.be.null;
    });
    it('should return null if there is no result from the db call', async () => {
      DB.get.resolves();
      const result = await RunParser.getAreaInfo(
        { timestamp: 1, area: 'Place 1' },
        { timestamp: 2, area: 'Place 2' }
      );
      expect(result).to.be.null;
    });
  });

  describe('getMapMods', () => {
    before(() => {
      DB.all.reset();
    });
    afterEach(() => {
      DB.all.reset();
    });
    it('should return the correctly formatted map mods', () => {
      const DBMods = [{ mod: 'mod1' }, { mod: 'mod2' }];
      DB.all.resolves(DBMods);
      const expectedResults = DBMods.map(({ mod }) => mod);
      return RunParser.getMapMods().then((res) => {
        expect(res).to.deep.equal(expectedResults);
      });
    });
    it('should return an empty array if the DB call fails', () => {
      DB.all.rejects();
      return RunParser.getMapMods().then((res) => {
        expect(res).to.be.an('array');
        expect(res).to.be.empty;
      });
    });
  });

  describe('getMapStats', () => {
    it('should return the correct map stats', () => {
      const stats = {
        iir: 0,
        iiq: 0,
        packsize: 0,
      };
      const result = RunParser.getMapStats([]);
      expect(result).to.deep.equal(stats);
    });
    it('should populate the stats properly', () => {
      const stats = {
        iir: 1,
        iiq: 2,
        packsize: 3,
      };
      const mods = [
        '1% increased Rarity of Items found in this Area',
        '2% increased Quantity of Items found in this Area',
        '3% increased Pack size',
      ];
      const result = RunParser.getMapStats(mods);
      expect(result).to.deep.equal(stats);
    });
    it('should ignore mods when they are not formatted properly', () => {
      const stats = {
        iir: 0,
        iiq: 0,
        packsize: 0,
      };
      const mods = [
        'P% increased Rarity of Items found in this Area',
        'X% increased Quantity of Items found in this Area',
        '%% increased Pack size',
        'Some other mod',
      ];
      const result = RunParser.getMapStats(mods);
      expect(result).to.deep.equal(stats);
    });
  });

  describe('getXP', () => {
    before(() => {
      externalDependencies['../GGGAPI'].getDataForInventory.reset();
      DB.get.reset();
    });

    afterEach(() => {
      externalDependencies['../GGGAPI'].getDataForInventory.reset();
      DB.get.reset();
    });

    it('should return the right XP', async () => {
      DB.get.resolves({ xp: 100 });
      return RunParser.getXP().then((xp) => {
        expect(xp).to.equal(100);
      });
    });

    it('should return value from API if the DB call fails', async () => {
      const expectedValue = 5;
      externalDependencies['../GGGAPI'].getDataForInventory.resolves({ experience: expectedValue });
      DB.get.rejects();
      return RunParser.getXP().then((xp) => {
        expect(xp).to.equal(expectedValue);
      });
    });

    it('should return null if getXPManual fails', async () => {
      DB.get.rejects();
      externalDependencies['../GGGAPI'].getDataForInventory.rejects();
      return RunParser.getXP().then((xp) => {
        expect(xp).to.be.null;
      });
    });
  });

  describe('getXPDiff', () => {
    before(() => {
      externalDependencies['../GGGAPI'].getDataForInventory.reset();
      DB.get.reset();
    });
    afterEach(() => {
      externalDependencies['../GGGAPI'].getDataForInventory.reset();
      DB.get.reset();
    });

    it('should return the right XP Diff', async () => {
      const before = 100;
      const after = 102;
      DB.get.resolves({ xp: before });
      return RunParser.getXPDiff(after).then((xp) => {
        expect(xp).to.equal(after - before);
      });
    });

    it('should return the new XP if DB returns nothing', async () => {
      const after = 102;
      DB.get.resolves({});
      return RunParser.getXPDiff(after).then((xp) => {
        expect(xp).to.equal(after);
      });
    });

    it('should return null if DB fails', async () => {
      const after = 102;
      DB.get.rejects();
      return RunParser.getXPDiff(after).then((xp) => {
        expect(xp).to.be.null;
      });
    });
  });

  describe('updateItemValues', () => {
    before(() => {
      DB.transaction.reset();
    });
    afterEach(() => {
      DB.transaction.reset();
    });
    it('should update the db with proper parameters', async () => {
      DB.transaction.resolves();

      const items = [
        {
          id: 1,
          name: 'item1',
          typeline: 'White Item',
          rawdata: JSON.stringify({ inventoryId: 'MainInventory' }),
        },
        {
          id: 2,
          name: 'item2',
          typeline: 'White Item',
          rawdata: JSON.stringify({ inventoryId: 'MainInventory' }),
        },
      ];

      return RunParser.updateItemValues(items).then(() => {
        expect(DB.transaction.calledOnce).to.be.true;
        expect(DB.transaction.firstCall.args[1]).to.be.an('array');
        expect(DB.transaction.firstCall.args[1]).to.deep.equal(items);
      });
    });
  });

  describe('parseItems', () => {
    let sandbox;
    beforeEach(() => {
      sandbox = createSandbox();
      externalDependencies['./ItemPricer'].price.returns({ value: 0, isVendor: false });
      sandbox.stub(RunParser, 'updateItemValues').resolves();
    });
    afterEach(() => {
      externalDependencies['./ItemPricer'].price.reset();
      sandbox.restore();
    });
    it('should return the right items data', async () => {
      const items = [
        {
          id: 1,
          name: 'item1',
          typeline: 'White Item',
          rawdata: JSON.stringify({ inventoryId: 'MainInventory' }),
        },
        {
          id: 2,
          name: 'item2',
          typeline: 'White Item',
          rawdata: JSON.stringify({ inventoryId: 'MainInventory' }),
        },
      ];
      const expectedItems = {
        count: items.length,
        value: 0,
        importantDrops: {},
      };

      const parsedItems = await RunParser.parseItems(items);
      expect(parsedItems).to.deep.equal(expectedItems);
    });
  });

  describe('generateItemStats', () => {
    let sandbox;
    const input = [
      { count: 0, value: 1, importantDrops: {} },
      { count: 1, value: 2, importantDrops: {} },
      { count: 2, value: 3, importantDrops: {} },
    ];
    const DBEvents = [
      { event_text: 'I am an event', event_id: 1, id: 1 },
      { event_text: 'I am a town', event_id: 2, id: 2 },
      { event_text: 'I am an event', event_id: 3, id: 3 },
    ];
    before(() => {
      DB.all.reset();
      externalDependencies['./Utils'].default.isTown.reset();
    });

    beforeEach(() => {
      sandbox = createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
      DB.all.reset();
      externalDependencies['./Utils'].default.isTown.reset();
    });

    it('should return the right items', async () => {
      DB.all.resolves(DBEvents);
      sandbox
        .stub(RunParser, 'parseItems')
        .onCall(0)
        .returns(input[0])
        .onCall(1)
        .returns(input[1])
        .onCall(2)
        .returns(input[2]);
      externalDependencies['./Utils'].default.isTown.callsFake((arg) => arg === 'I am a town');
      const expectedResults = { count: input[0].count, value: input[0].value, importantDrops: {} };
      return RunParser.generateItemStats().then((res) => {
        expect(res).to.deep.equal(expectedResults);
      });
    });

    it('should return false if db call fails', async () => {
      DB.all.rejects();
      return RunParser.generateItemStats().then((res) => {
        expect(res).to.be.false;
      });
    });
    it('should return false if parseItems fails', async () => {
      DB.all.resolves(DBEvents);
      externalDependencies['./Utils'].default.isTown.callsFake((arg) => arg === 'I am a town');
      sandbox.stub(RunParser, 'parseItems').throws();
      return RunParser.generateItemStats().then((res) => {
        expect(res).to.be.false;
      });
    });
  });

  describe('getLastInventoryTimestamp', () => {
    before(() => {
      DB.get.reset();
    });
    afterEach(() => {
      DB.get.reset();
    });

    it('should return the right timestamp', async () => {
      const timestamp = 100;
      DB.get.resolves({ timestamp: timestamp });
      return RunParser.getLastInventoryTimestamp().then((ts) => {
        expect(ts).to.equal(timestamp);
      });
    });

    it('should return null if DB fails', async () => {
      DB.get.rejects();
      return RunParser.getLastInventoryTimestamp().then((ts) => {
        expect(ts).to.be.null;
      });
    });
  });

  describe('getItemStats', () => {
    let sandbox;
    const workingStats = { count: 1, value: 10, importantDrops: {} };
    const workingInput = {
      area: { id: 1, name: 'Home' },
      firsteventTimestamp: 1,
      lasteventTimestamp: 2,
    };

    before(() => {
      externalDependencies['./Utils'].default.sleep.reset();
    });

    beforeEach(() => {
      sandbox = createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
      externalDependencies['./Utils'].default.sleep.reset();
    });

    it('should return the right item stats', async () => {
      sandbox.stub(RunParser, 'generateItemStats').resolves(workingStats);
      sandbox
        .stub(RunParser, 'getLastInventoryTimestamp')
        .resolves(workingInput.lasteventTimestamp + 1);
      externalDependencies['./Utils'].default.sleep.resolves();
      return RunParser.getItemStats(
        workingInput.area,
        workingInput.firsteventTimestamp,
        workingInput.lasteventTimestamp
      ).then((res) => {
        expect(res).to.deep.equal(workingStats);
      });
    });

    it('should wait until the inventory is older than the lastEvent', async () => {
      sandbox.stub(RunParser, 'generateItemStats').resolves(workingStats);
      sandbox
        .stub(RunParser, 'getLastInventoryTimestamp')
        .onCall(0)
        .resolves(workingInput.lasteventTimestamp - 1)
        .onCall(1)
        .resolves(workingInput.lasteventTimestamp);
      externalDependencies['./Utils'].default.sleep.resolves();
      return RunParser.getItemStats(
        workingInput.area,
        workingInput.firsteventTimestamp,
        workingInput.lasteventTimestamp
      ).then(() => {
        expect(externalDependencies['./Utils'].default.sleep.calledOnce).to.be.true;
      });
    });

    it('should return false after 3 tries', async () => {
      sandbox
        .stub(RunParser, 'getLastInventoryTimestamp')
        .resolves(workingInput.lasteventTimestamp - 1);
      externalDependencies['./Utils'].default.sleep.resolves();
      return RunParser.getItemStats(
        workingInput.area,
        workingInput.firsteventTimestamp,
        workingInput.lasteventTimestamp
      ).then((res) => {
        expect(res).to.be.false;
        expect(externalDependencies['./Utils'].default.sleep.calledTwice).to.be.true;
        expect(RunParser.getLastInventoryTimestamp.callCount).to.equal(3);
      });
    });

    it('should return false if generateItemStats fails', async () => {
      sandbox.stub(RunParser, 'generateItemStats').rejects();
      sandbox
        .stub(RunParser, 'getLastInventoryTimestamp')
        .resolves(workingInput.lasteventTimestamp + 1);
      externalDependencies['./Utils'].default.sleep.resolves();
      return RunParser.getItemStats(
        workingInput.area,
        workingInput.firsteventTimestamp,
        workingInput.lasteventTimestamp
      ).then((res) => {
        expect(res).to.be.false;
      });
    });
  });

  describe('getKillCount', () => {
    before(() => {
      DB.all.reset();
    });
    afterEach(() => {
      DB.all.reset();
    });
    it('should return the right kill count', async () => {
      const incubators = [
        {
          '10': { progress: 0, total: 1000 },
        },
        {
          '10': { progress: 1000, total: 1000 },
        },
      ];
      DB.all.resolves(incubators.map((data) => ({ data: JSON.stringify(data) })));
      const expectedResults = 1000; // the progress between the two incubators
      return RunParser.getKillCount().then((res) => {
        expect(res).to.equal(expectedResults);
      });
    });
    it('should return -1 if there are no incubator', async () => {
      DB.all.resolves([]);
      const expectedResults = -1;
      return RunParser.getKillCount().then((res) => {
        expect(res).to.equal(expectedResults);
      });
    });
    it('should return -1 if there is only one incubator', async () => {
      DB.all.resolves([{ data: JSON.stringify({ '10': { progress: 0, total: 1000 } }) }]);
      const expectedResults = -1;
      return RunParser.getKillCount().then((res) => {
        expect(res).to.equal(expectedResults);
      });
    });
    it('should return -1 if the DB call fails', async () => {
      DB.all.rejects();
      const expectedResults = -1;
      return RunParser.getKillCount().then((res) => {
        expect(res).to.equal(expectedResults);
      });
    });
  });

  describe('getEvents', () => {
    before(() => {
      DB.all.reset();
    });
    afterEach(() => {
      DB.all.reset();
    });

    it('should return the right array from the DB', async () => {
      DB.all.resolves(InputConstants.all.valid);
      return RunParser.getEvents().then((events) => {
        expect(events).to.be.an('array');
        expect(events).to.equal(InputConstants.all.valid);
      });
    });

    it('should return an empty array if the DB call fails', async () => {
      DB.all.rejects();
      return RunParser.getEvents().then((events) => {
        expect(events).to.be.an('array');
        expect(events).to.be.empty;
      });
    });
  });

  describe('countDeaths', () => {
    it('should return the correct number of deaths', () => {
      const events = [
        { event_type: 'slain', id: 1 },
        { event_type: 'slain', id: 1 },
        { event_type: 'slain', id: 1 },
      ];
      const result = RunParser.countDeaths(events, 0, 2);
      expect(result).to.equal(3);
    });
  });

  describe('getZanaMissionMap', () => {
    let sandbox;
    beforeEach(() => {
      sandbox = createSandbox();
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should return the correct map when the event text contains a map', () => {
      const events = [
        { event_type: 'entered', event_text: 'Place 1', id: 1 },
        { event_type: 'entered', event_text: 'Place 2', id: 1 }, // This is the one we want
        { event_type: 'entered', event_text: 'Place 3', id: 1 },
      ];
      sandbox.stub(Constants, 'areas').value({ normalMaps: ['Place 1', 'Place 2'] });
      const result = RunParser.getZanaMissionMap(events);
      expect(result).to.equal('Place 2');
    });

    it('should return null if there is not enough events to check where player entered', () => {
      const events = [{ event_type: 'entered', event_text: 'Place 1', id: 1 }];
      const result = RunParser.getZanaMissionMap(events);
      expect(result).to.be.null;
    });
  });

  describe('getRunAreaTimes', () => {
    before(() => {
      externalDependencies['./Utils'].default.getRunningTime.reset();
    });
    afterEach(() => {
      externalDependencies['./Utils'].default.getRunningTime.reset();
    });

    it('should return the right area times', () => {
      const events = [
        { event_type: 'entered', event_text: 'Place 1', id: 1 },
        { event_type: 'entered', event_text: 'Place 2', id: 1 },
        { event_type: 'entered', event_text: 'Place 3', id: 1 },
      ];
      externalDependencies['./Utils'].default.getRunningTime.returns(10);
      const expectedResults = {
        'Place 1': 10,
        'Place 2': 10,
      };
      const result = RunParser.getRunAreaTimes(events);
      expect(result).to.deep.equal(expectedResults);
    });

    it('should return an empty object if there are no events', () => {
      const events = [];
      const expectedResults = {};
      const result = RunParser.getRunAreaTimes(events);
      expect(result).to.deep.equal(expectedResults);
    });
  });

  describe('getMaster', () => {
    const Default = 'Zana, Master Cartographer';
    let sandbox;
    beforeEach(() => {
      sandbox = createSandbox();
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should return the correct master event if the first event is set', () => {
      sandbox.stub(Constants, 'masters').value(['Alva']);
      const previousEvent = { event_type: 'master', event_text: 'Alva: blabla' };
      const nextEvent = { event_type: 'event', event_text: 'Some other event' };
      const result = RunParser.getMaster(previousEvent, nextEvent);
      expect(result).to.equal('Alva');
    });

    it('should return the correct master event if the second event is set', () => {
      sandbox.stub(Constants, 'masters').value(['Alva']);
      const previousEvent = { event_type: 'event', event_text: 'Some other event' };
      const nextEvent = { event_type: 'master', event_text: 'Alva: blabla' };
      const result = RunParser.getMaster(previousEvent, nextEvent);
      expect(result).to.equal('Alva');
    });

    it('should return Default option if no master event is found', () => {
      const previousEvent = { event_type: 'event', event_text: 'Some event' };
      const nextEvent = { event_type: 'event', event_text: 'Some other event' };
      const result = RunParser.getMaster(previousEvent, nextEvent);
      expect(result).to.equal(Default);
    });
  });

  describe('getNPCLine', () => {
    it('should return the correct NPC line when event text contains a colon', () => {
      const eventText = 'NPC: Hello, Exile!';
      const result = RunParser.getNPCLine(eventText);
      expect(result).to.deep.equal({ npc: 'NPC', text: 'Hello, Exile!' });
    });

    it('should return null when there is no colon', () => {
      const eventText = 'Hello, Exile!';
      const result = RunParser.getNPCLine(eventText);
      expect(result).to.be.null;
    });

    it('should return nullwhen event text is null', () => {
      const eventText = null;
      const result = RunParser.getNPCLine(eventText);
      expect(result).to.be.null;
    });
  });

  describe('getMapExtraInfo', async () => {
    let sandbox;
    beforeEach(() => {
      sandbox = createSandbox();
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should return the correct map extra info', () => {
      sandbox.stub(RunParser, 'getRunAreaTimes').returns({ 'Place 1': 5 });
      sandbox.stub(RunParser, 'getEvents').resolves([
        { event_type: 'entered', event_text: 'Place 1', id: 1 },
        { event_type: 'entered', event_text: 'Place 2', id: 1 },
        { event_type: 'entered', event_text: 'Place 3', id: 1 },
      ]);
      const expectedRun = {
        areaTimes: {
          'Place 1': 5,
        },
      };
      return RunParser.getMapExtraInfo().then((result) => {
        expect(result).to.deep.equal(expectedRun);
      });
    });
  });

  describe('addMapInfo', () => {
    before(() => {
      DB.run.reset();
    });
    afterEach(() => {
      DB.run.reset();
    });
    it('should return the correct map info', () => {
      const mapFirstEvent = { event_type: 'entered', event_text: 'Place 1', id: 1 };
      const latestGeneratedArea = { id: 1, name: 'Place 1' };
      DB.run.resolves();
      return RunParser.addMapInfo({ mapFirstEvent, latestGeneratedArea }).then(() => {
        expect(DB.run.calledOnce).to.be.true;
      });
    });
    it('should not error in case of DB error', () => {
      const mapFirstEvent = { event_type: 'entered', event_text: 'Place 1', id: 1 };
      const latestGeneratedArea = { id: 1, name: 'Place 1' };
      DB.run.rejects();
      return RunParser.addMapInfo({ mapFirstEvent, latestGeneratedArea }).then(() => {
        expect(DB.run.calledOnce).to.be.true;
      });
    });
  });

  describe('insertMapRun', () => {
    before(() => {
      DB.run.reset();
    });
    afterEach(() => {
      DB.run.reset();
    });
    it('should call DB.run and not error', async () => {
      DB.run.resolves();
      return RunParser.insertMapRun().then(() => {
        expect(DB.run.calledOnce).to.be.true;
      });
    });
    it('should not error in case of DB error', async () => {
      DB.run.rejects();
      return RunParser.insertMapRun().then(() => {
        expect(DB.run.calledOnce).to.be.true;
      });
    });
  });

  describe('getLastMapEnterEvent', () => {
    before(() => {
      DB.get.reset();
    });
    afterEach(() => {
      DB.get.reset();
    });
    it('should return the event if it gets one', async () => {
      const event = { event_text: 'I am an event', event_type: 'type', server: '1.1.1.1', id: 1 };
      const parsedEvent = { area: event.event_text, server: event.server, timestamp: event.id };
      DB.get.resolves(event);
      const result = await RunParser.getLastMapEnterEvent();
      expect(result).to.deep.equal(parsedEvent);
    });
  });

  describe('getLatestUnusedMapEnteredEvents', () => {
    before(() => {
      DB.all.reset();
    });
    afterEach(() => {
      DB.all.reset();
    });

    it('should return an array of events', async () => {
      DB.all.resolves(InputConstants.lastevents.valid);
      const expectedResults = InputConstants.lastevents.valid.map(({ id, event_text, server }) => ({
        timestamp: id,
        area: event_text,
        server,
      }));
      return RunParser.getLatestUnusedMapEnteredEvents().then((events) => {
        expect(events).to.be.an('array');
        expect(events).to.deep.equal(expectedResults);
      });
    });

    it('should return an empty array if the DB call returns an empty array', async () => {
      DB.all.resolves([]);
      return RunParser.getLatestUnusedMapEnteredEvents().then((events) => {
        expect(events).to.be.an('array');
        expect(events).to.be.empty;
      });
    });

    it('should return an empty array if the DB call fails', async () => {
      DB.all.rejects();
      return RunParser.getLatestUnusedMapEnteredEvents().then((events) => {
        expect(events).to.be.an('array');
        expect(events).to.be.empty;
      });
    });
  });

  describe('processRun', () => {
    // We only tet happy path, caller is supposed to handle errors
    let sandbox;
    before(() => {
      externalDependencies['./Utils'].default.isTown.reset();
    });
    beforeEach(() => {
      sandbox = createSandbox();
    });
    it('should insert a map run in the db', async () => {
      sandbox.stub(RunParser, 'insertMapRun').resolves();
      externalDependencies['./XPTracker'].isMaxXP.resolves(false);
      sandbox.stub(RunParser, 'getKillCount').resolves(1);
      sandbox.stub(RunParser, 'getEvents').resolves([]);
      sandbox.stub(RunParser, 'getAreaInfo').resolves({});
      sandbox.stub(RunParser, 'getMapMods').resolves([]);
      sandbox.stub(RunParser, 'getItemStats').resolves(null);
      await RunParser.processRun({ area: 'here', timestamp: 1 }, {});
      expect(RunParser.insertMapRun.calledOnce).to.be.true;
    });
  });

  describe('tryProcess', () => {
    let sandbox;
    before(() => {
      externalDependencies['./Utils'].default.isTown.reset();
    });
    beforeEach(() => {
      sandbox = createSandbox();
    });
    afterEach(() => {
      sandbox.restore();
      externalDependencies['./Utils'].default.isTown.reset();
    });
    it('should abort if there are no events', async () => {
      sandbox.stub(RunParser, 'getLatestUnusedMapEnteredEvents').resolves([]);
      sandbox.stub(RunParser, 'processRun').resolves();

      const result = await RunParser.tryProcess({ event: 'entered', mode: 'test' });
      expect(result).to.be.undefined;
      expect(RunParser.processRun.called).to.be.false;
    });
    it('should abort if there are only town maps', async () => {
      sandbox.stub(RunParser, 'getLatestUnusedMapEnteredEvents').resolves([]);
      externalDependencies['./Utils'].default.isTown.returns(true);
      sandbox.stub(RunParser, 'processRun').resolves();

      const result = await RunParser.tryProcess({ event: 'entered', mode: 'test' });
      expect(result).to.be.undefined;
      expect(RunParser.processRun.called).to.be.false;
    });
    it('should abort if there are no town maps', async () => {
      sandbox.stub(RunParser, 'getLatestUnusedMapEnteredEvents').resolves([]);
      externalDependencies['./Utils'].default.isTown.returns(false);
      sandbox.stub(RunParser, 'processRun').resolves();

      const result = await RunParser.tryProcess({ event: 'entered', mode: 'test' });
      expect(result).to.be.undefined;
      expect(RunParser.processRun.called).to.be.false;
    });
    it('should abort if the event is in the lab', async () => {
      sandbox.stub(RunParser, 'getLatestUnusedMapEnteredEvents').resolves([]);
      externalDependencies['./Utils'].default.isTown.returns(false);
      externalDependencies['./Utils'].default.isLabArea.returns(true);
      sandbox.stub(RunParser, 'processRun').resolves();

      const result = await RunParser.tryProcess({ event: 'entered', mode: 'test' });
      expect(result).to.be.undefined;
      expect(RunParser.processRun.called).to.be.false;
    });
    it('should abort if the event is in the same area as the firs event', async () => {
      const area = 'Place 1';
      sandbox
        .stub(RunParser, 'getLatestUnusedMapEnteredEvents')
        .resolves([{ timestamp: 1, area, server: '1.1.1.1' }]);
      externalDependencies['./Utils'].default.isTown.returns(false);
      externalDependencies['./Utils'].default.isLabArea.returns(false);
      sandbox.stub(RunParser, 'processRun').resolves();

      const result = await RunParser.tryProcess({ event: { area }, mode: 'test' });
      expect(result).to.be.undefined;
      expect(RunParser.processRun.called).to.be.false;
    });
    it('should abort if the event is in a Memory', async () => {
      const area = 'Memory Void';
      sandbox.stub(RunParser, 'getLatestUnusedMapEnteredEvents').resolves([]);
      externalDependencies['./Utils'].default.isTown.returns(false);
      externalDependencies['./Utils'].default.isLabArea.returns(false);
      sandbox.stub(RunParser, 'processRun').resolves();

      const result = await RunParser.tryProcess({ event: { area }, mode: 'test' });
      expect(result).to.be.undefined;
      expect(RunParser.processRun.called).to.be.false;
    });
    it('should abort if the event is on the same server as the first event', async () => {
      const server = '1.1.1.1';
      sandbox
        .stub(RunParser, 'getLatestUnusedMapEnteredEvents')
        .resolves([{ timestamp: 1, area: 'Place 1', server }]);
      externalDependencies['./Utils'].default.isTown.returns(false);
      externalDependencies['./Utils'].default.isLabArea.returns(false);
      sandbox.stub(RunParser, 'processRun').resolves();

      const result = await RunParser.tryProcess({ event: { server }, mode: 'test' });
      expect(result).to.be.undefined;
      expect(RunParser.processRun.called).to.be.false;
    });
    it('should abort if it does not find a town event', async () => {
      sandbox
        .stub(RunParser, 'getLatestUnusedMapEnteredEvents')
        .resolves([{ timestamp: 1, area: 'Place 1', server: '1.1.1.1' }]);
      externalDependencies['./Utils'].default.isTown
        .onCall(0)
        .returns(false) // Check for the first non town event
        .onCall(1)
        .returns(false); // Check for the last town event
      externalDependencies['./Utils'].default.isLabArea.returns(false);
      sandbox.stub(RunParser, 'processRun').resolves();

      const result = await RunParser.tryProcess({ event: 'nothing', mode: 'test' });
      expect(result).to.be.undefined;
      expect(RunParser.processRun.called).to.be.false;
    });
    it('should look in DB if no event is given', async () => {
      sandbox
        .stub(RunParser, 'getLastMapEnterEvent')
        .resolves({ area: 'Other Place 1', server: '1.1.1.1' });
      sandbox.stub(RunParser, 'getLatestUnusedMapEnteredEvents').resolves([
        { timestamp: 1, area: 'Place 1', server: '1.1.1.1' },
        { timestamp: 2, area: 'Place 2', server: '1.1.1.2' },
      ]);
      externalDependencies['./Utils'].default.isTown
        .onCall(0)
        .returns(false) // Check for the first non town event
        .onCall(1)
        .returns(true); // Check for the last town event
      externalDependencies['./Utils'].default.isLabArea.returns(false);
      sandbox.stub(RunParser, 'processRun').resolves();

      const result = await RunParser.tryProcess({ event: null, mode: 'test' });
      expect(result).to.equal(1);
      expect(RunParser.processRun.calledOnce).to.be.true;
      expect(RunParser.getLastMapEnterEvent.calledOnce).to.be.true;
    });
    it('should process run in any other case', async () => {
      sandbox
        .stub(RunParser, 'getLatestUnusedMapEnteredEvents')
        .resolves([{ timestamp: 1, area: 'Place 1', server: '1.1.1.1' }]);
      externalDependencies['./Utils'].default.isTown
        .onCall(0)
        .returns(false) // Check for the first non town event
        .onCall(1)
        .returns(true); // Check for the last town event
      externalDependencies['./Utils'].default.isLabArea.returns(false);
      sandbox.stub(RunParser, 'processRun').resolves();
      const result = await RunParser.tryProcess({ event: 'nothing', mode: 'test' });
      expect(result).to.equal(1);
      expect(RunParser.processRun.calledOnce).to.be.true;
    });
    it('should not error if processRun fails', async () => {
      sandbox
        .stub(RunParser, 'getLatestUnusedMapEnteredEvents')
        .resolves([{ timestamp: 1, area: 'Place 1', server: '1.1.1.1' }]);
      externalDependencies['./Utils'].default.isTown
        .onCall(0)
        .returns(false) // Check for the first non town event
        .onCall(1)
        .returns(true); // Check for the last town event
      externalDependencies['./Utils'].default.isLabArea.returns(false);
      sandbox.stub(RunParser, 'processRun').rejects();
      const result = await RunParser.tryProcess({ event: 'nothing', mode: 'test' });
      expect(result).to.be.undefined;
      expect(RunParser.processRun.calledOnce).to.be.true;
    });
  });

  describe('recheckGained', () => {
    before(() => {
      externalDependencies['../db/run'].getRunsFromDates.reset();
      externalDependencies['../db/run'].getItemsFromRun.reset();
      externalDependencies['../db/run'].updateItemValues.reset();
      externalDependencies['./ItemPricer'].price.reset();
      externalDependencies['../SettingsManager'].get.reset();
    });
    afterEach(() => {
      externalDependencies['../db/run'].getRunsFromDates.reset();
      externalDependencies['../db/run'].getItemsFromRun.reset();
      externalDependencies['../db/run'].updateItemValues.reset();
      externalDependencies['./ItemPricer'].price.reset();
      externalDependencies['../SettingsManager'].get.reset();
    });
    it('should update the item values for each run', async () => {
      const runs = [
        { id: 0, gained: 1 },
        { id: 1, gained: 2 },
        { id: 2, gained: 3 },
      ];
      const items = [{ id: 0, name: 'item 1', value: 1 }];
      externalDependencies['../db/run'].getRunsFromDates.resolves(runs);
      externalDependencies['../db/run'].getItemsFromRun.resolves(items);
      externalDependencies['./ItemPricer'].price.resolves(1);
      externalDependencies['./ItemPricer'].getRatesFor.resolves();
      externalDependencies['../SettingsManager'].get.returns({ league: 'Super League' });
      externalDependencies['../db/run'].updateItemValues.returns(null);

      await RunParser.recheckGained();
      expect(externalDependencies['./ItemPricer'].price.callCount).to.equal(
        runs.length * items.length
      );
      expect(externalDependencies['../db/run'].updateItemValues.callCount).to.equal(runs.length);
    });
  });
});

rewiremock.enable();
