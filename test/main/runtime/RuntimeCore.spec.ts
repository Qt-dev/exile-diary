import { EventEmitter } from 'events';

const ocrEmitter = new EventEmitter();
const screenshotEmitter = new EventEmitter();
const runEmitter = new EventEmitter();
const killEmitter = new EventEmitter();
const clientLogEmitter = new EventEmitter();
const logIngestEmitter = new EventEmitter();
const inventoryGetterMock = {
  getInventoryDiffs: jest.fn(),
  compareInventories: jest.fn(),
  getInventory: jest.fn(),
};

const settingsManagerMock = {
  get: jest.fn(),
  getAll: jest.fn(),
  registerListener: jest.fn(),
  waitForSave: jest.fn(),
};

const searchManagerMock = {
  registerMessageHandler: jest.fn(),
};

const statsManagerMock = {
  registerProfitPerHourAnnouncer: jest.fn(),
  triggerProfitPerHourAnnouncer: jest.fn(),
};

const itemPricerMock = {
  getCurrencyByName: jest.fn(),
  updateRates: jest.fn(),
};

const runParserMock = {
  emitter: runEmitter,
  latestGeneratedArea: { name: 'Test Map', level: 83, seed: 'abc' },
  refreshTracking: jest.fn(),
  setCurrentMapStats: jest.fn(),
  tryProcess: jest.fn(),
  tryUpdateCurrentArea: jest.fn(),
};

const screenshotWatcherMock = {
  emitter: screenshotEmitter,
  process: jest.fn(),
};

const killTrackerMock = {
  emitter: killEmitter,
};

const ratesMock = {
  on: jest.fn(),
  removeAllListeners: jest.fn(),
};

const stashGetterMock = {
  initialize: jest.fn(),
  getNetWorth: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
};
const stashTabsManagerMock = {
  refresh: jest.fn(),
};

jest.mock('../../../src/main/SettingsManager', () => ({
  __esModule: true,
  default: settingsManagerMock,
}));
jest.mock('../../../src/main/SearchManager', () => ({
  __esModule: true,
  default: searchManagerMock,
}));
jest.mock('../../../src/main/StatsManager', () => ({
  __esModule: true,
  default: statsManagerMock,
}));
jest.mock('../../../src/main/modules/ItemPricer', () => ({
  __esModule: true,
  default: itemPricerMock,
}));
jest.mock('../../../src/main/modules/RunParser', () => ({
  __esModule: true,
  default: runParserMock,
}));
jest.mock('../../../src/main/modules/ImageParser/ScreenshotWatcher', () => ({
  __esModule: true,
  default: screenshotWatcherMock,
}));
jest.mock('../../../src/main/modules/ImageParser/OCRWatcher', () => ({
  emitter: ocrEmitter,
}));
jest.mock('../../../src/main/modules/KillTracker', () => ({
  __esModule: true,
  default: killTrackerMock,
}));
jest.mock('../../../src/main/modules/RateGetterV2', () => ({
  __esModule: true,
  default: ratesMock,
}));
jest.mock('../../../src/main/modules/ClientTxtWatcher', () => ({
  emitter: clientLogEmitter,
}));
jest.mock('../../../src/main/modules/LogProcessor', () => ({
  __esModule: true,
  default: {
    emitter: logIngestEmitter,
    schedule: jest.fn(),
    processGeneration: jest.fn(),
    processEnd: jest.fn(),
    processNewInstance: jest.fn(),
    processOther: jest.fn(),
    reprocessEvents: jest.fn(),
    reprocessEvent: jest.fn(),
    readLine: jest.fn(),
  },
}));
jest.mock('../../../src/main/modules/StashGetter', () => ({
  __esModule: true,
  default: stashGetterMock,
}));
jest.mock('../../../src/main/StashTabsManager', () => ({
  __esModule: true,
  default: stashTabsManagerMock,
}));
jest.mock('../../../src/main/modules/InventoryGetter', () => ({
  __esModule: true,
  default: inventoryGetterMock,
}));

describe('RuntimeCore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes runtime workflows through a single bridge object', async () => {
    const { createRuntimeCore } = await import('../../../src/main/runtime-core/RuntimeCore');
    const runtime = createRuntimeCore();

    runtime.search.registerMessageHandler(() => undefined);
    runtime.stats.registerProfitPerHourAnnouncer(() => undefined);
    runtime.pricing.getCurrencyByName('Divine Orb');
    runtime.pricing.updateRates();
    runtime.inventory.getInventoryDiffs('2026-01-01T00:00:00.000Z');
    runtime.runTracking.refreshTracking();
    runtime.runTracking.setCurrentMapStats({ name: 'Mesa', level: 83 });
    runtime.runTracking.tryUpdateCurrentArea();
    runtime.screenshots.process(Buffer.from('test'));
    runtime.stash.initialize();
    runtime.stash.getNetWorth();

    expect(runtime.ocr.emitter).toBe(ocrEmitter);
    expect(runtime.screenshots.emitter).toBe(screenshotEmitter);
    expect(runtime.runTracking.emitter).toBe(runEmitter);
    expect(runtime.killTracker.emitter).toBe(killEmitter);
    expect(runtime.clientLogs.emitter).toBe(clientLogEmitter);
    expect(runtime.logIngest.emitter).toBe(logIngestEmitter);
    expect(runtime.inventory.getInventoryDiffs).toBeDefined();
    expect(runtime.runTracking.latestGeneratedArea).toBe(runParserMock.latestGeneratedArea);

    expect(searchManagerMock.registerMessageHandler).toHaveBeenCalledTimes(1);
    expect(statsManagerMock.registerProfitPerHourAnnouncer).toHaveBeenCalledTimes(1);
    expect(itemPricerMock.getCurrencyByName).toHaveBeenCalledWith('Divine Orb');
    expect(itemPricerMock.updateRates).toHaveBeenCalledTimes(1);
    expect(inventoryGetterMock.getInventoryDiffs).toHaveBeenCalledWith('2026-01-01T00:00:00.000Z');
    expect(runParserMock.refreshTracking).toHaveBeenCalledTimes(1);
    expect(runParserMock.setCurrentMapStats).toHaveBeenCalledWith({ name: 'Mesa', level: 83 });
    expect(runParserMock.tryUpdateCurrentArea).toHaveBeenCalledTimes(1);
    expect(screenshotWatcherMock.process).toHaveBeenCalledTimes(1);
    expect(stashGetterMock.initialize).toHaveBeenCalledTimes(1);
    expect(stashGetterMock.getNetWorth).toHaveBeenCalledTimes(1);
  });
});
