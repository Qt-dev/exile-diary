let uuidCounter = 0;
const mockTryProcess = jest.fn();
const mockInsertEvent = jest.fn();
const mockSaveNewTree = jest.fn();
const mockCaptureAndPersistInventory = jest.fn();
const mockInsertItemsAndInventoryBaseline = jest.fn();
const mockGetEventByQuote = jest.fn();
const mockIsTown = jest.fn();
const mockGetAreaFromId = jest.fn();
const mockHasOngoingMapRun = jest.fn();
const mockCreateNewMapRun = jest.fn();
const mockRetryDeferredRun = jest.fn();
const mockIsFirstRun = jest.fn();
const mockGetLatestUncompletedRun = jest.fn();
const mockMarkRunDeferred = jest.fn();
const mockRunParser = {
  accountingDeferred: false,
  tryProcess: mockTryProcess,
  getAreaFromId: mockGetAreaFromId,
  insertEvent: mockInsertEvent,
  hasOngoingMapRun: mockHasOngoingMapRun,
  createNewMapRun: mockCreateNewMapRun,
  retryDeferredRun: mockRetryDeferredRun,
};
jest.mock('uuid', () => ({
  v4: jest.fn(() => `log-task-${++uuidCounter}`),
}));

jest.mock('../../../src/main/modules/RunParser', () => ({
  __esModule: true,
  default: mockRunParser,
}));
jest.mock('../../../src/main/db/run', () => ({
  __esModule: true,
  default: {
    insertEvent: mockInsertEvent,
    isFirstRun: mockIsFirstRun,
    getLatestUncompletedRun: mockGetLatestUncompletedRun,
    markRunDeferred: mockMarkRunDeferred,
  },
}));
jest.mock('../../../src/main/SettingsManager', () => ({
  __esModule: true,
  default: {
    getAll: jest.fn(() => ({
      activeProfile: { characterName: 'AtlasRunner' },
    })),
    get: jest.fn(() => null),
  },
}));
jest.mock('../../../src/main/modules/SkillTreeWatcher', () => ({
  __esModule: true,
  default: { saveNewTree: mockSaveNewTree },
}));
jest.mock('../../../src/main/modules/InventoryGetter', () => ({
  __esModule: true,
  default: { captureAndPersistInventory: mockCaptureAndPersistInventory },
}));
jest.mock('../../../src/main/modules/ItemParser', () => ({
  __esModule: true,
  default: { insertItemsAndInventoryBaseline: mockInsertItemsAndInventoryBaseline },
}));
jest.mock('../../../src/main/modules/EventParser', () => ({
  __esModule: true,
  default: { getEventByQuote: mockGetEventByQuote },
}));
jest.mock('../../../src/main/modules/Utils', () => ({
  __esModule: true,
  default: { isTown: mockIsTown },
}));

describe('LogProcessorScheduler', () => {
  beforeEach(() => {
    uuidCounter = 0;
    mockTryProcess.mockReset();
    mockInsertEvent.mockReset().mockResolvedValue(42);
    mockSaveNewTree.mockReset().mockResolvedValue(undefined);
    mockCaptureAndPersistInventory.mockReset().mockImplementation(
      async (_timestamp, persistCapture) => {
        const capture = { diff: {}, currentInventory: {} };
        await persistCapture(capture);
        return capture.diff;
      }
    );
    mockInsertItemsAndInventoryBaseline.mockReset().mockResolvedValue(undefined);
    mockGetEventByQuote.mockReset().mockReturnValue(undefined);
    mockIsTown.mockReset();
    mockGetAreaFromId.mockReset();
    mockHasOngoingMapRun.mockReset().mockResolvedValue(false);
    mockCreateNewMapRun.mockReset().mockResolvedValue(99);
    mockRetryDeferredRun.mockReset().mockResolvedValue(true);
    mockIsFirstRun.mockReset().mockResolvedValue(false);
    mockGetLatestUncompletedRun.mockReset().mockResolvedValue(null);
    mockMarkRunDeferred.mockReset().mockResolvedValue(undefined);
    mockRunParser.accountingDeferred = false;
  });

  afterEach(async () => {
    const { default: LogProcessor } = await import('../../../src/main/modules/LogProcessor');
    LogProcessor.emitter.removeAllListeners('client-logs:entered-map');
    LogProcessor.emitter.removeAllListeners('client-logs:generated-run');
  });

  it('keeps asynchronous client-log work in submission order', async () => {
    const { LogProcessorScheduler } = await import('../../../src/main/modules/LogProcessor');
    const scheduler = new LogProcessorScheduler();
    const seen: string[] = [];
    let releaseFirst: (() => void) | undefined;

    const first = scheduler.runTask(async () => {
      seen.push('first:start');
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      seen.push('first:end');
    });
    const second = scheduler.runTask(async () => {
      seen.push('second');
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(seen).toEqual(['first:start']);

    releaseFirst?.();
    await Promise.all([first, second]);
    expect(seen).toEqual(['first:start', 'first:end', 'second']);
  });

  it('releases the queue after a failed client-log task', async () => {
    const { LogProcessorScheduler } = await import('../../../src/main/modules/LogProcessor');
    const scheduler = new LogProcessorScheduler();

    const failed = scheduler.runTask(async () => {
      throw new Error('parse failed');
    });
    const next = scheduler.runTask(async () => 42);

    await expect(failed).rejects.toThrow('parse failed');
    await expect(next).resolves.toBe(42);
  });

  it('marks chat completion as an explicit map end', async () => {
    mockTryProcess.mockResolvedValue(true);
    const { default: LogProcessor } = await import('../../../src/main/modules/LogProcessor');

    await expect(
      LogProcessor.processEnd('2026-07-22T10:00:00.000Z', '@To AtlasRunner: end')
    ).resolves.toBe(true);

    expect(mockTryProcess).toHaveBeenCalledWith({
      event: {
        timestamp: '2026-07-22T10:00:00.000Z',
      },
      reason: 'explicit-end',
      source: 'chat',
    });
  });

  it('retries automatic completion with the original generation boundary', async () => {
    mockIsTown.mockReturnValue(false);
    mockGetAreaFromId.mockReturnValue({
      name: 'Dunes Map',
      baseLevel: 74,
      isTown: false,
      isHideout: false,
      isLabyrinthAirlock: false,
      isLabyrinthBossArea: false,
    });
    mockTryProcess.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { default: LogProcessor } = await import('../../../src/main/modules/LogProcessor');

    await LogProcessor.processGeneration(
      '2026-07-23T11:04:10.000Z',
      'Generating level 83 area "MapWorldsDunes" with seed 123'
    );

    expect(mockTryProcess).toHaveBeenCalledTimes(2);
    expect(mockTryProcess).toHaveBeenNthCalledWith(1, {
      event: { timestamp: '2026-07-23T11:04:10.000Z', server: '' },
    });
    expect(mockTryProcess).toHaveBeenNthCalledWith(2, {
      event: { timestamp: '2026-07-23T11:04:10.000Z', server: '' },
    });
    expect(mockCreateNewMapRun).toHaveBeenCalledTimes(1);
  });

  it('creates the generated run after accounting retries are deferred', async () => {
    mockIsTown.mockReturnValue(false);
    mockGetAreaFromId.mockReturnValue({
      name: 'Dunes Map',
      baseLevel: 74,
      isTown: false,
      isHideout: false,
      isLabyrinthAirlock: false,
      isLabyrinthBossArea: false,
    });
    mockTryProcess.mockResolvedValue(false);
    mockHasOngoingMapRun.mockResolvedValue(true);
    const { default: LogProcessor } = await import('../../../src/main/modules/LogProcessor');
    const { default: RunParser } = await import('../../../src/main/modules/RunParser');
    RunParser.accountingDeferred = true;

    await LogProcessor.processGeneration(
      '2026-07-23T11:04:10.000Z',
      'Generating level 83 area "MapWorldsDunes" with seed 123'
    );

    expect(mockTryProcess).toHaveBeenCalledTimes(3);
    expect(mockCreateNewMapRun).toHaveBeenCalledWith(
      expect.objectContaining({
        areaId: 'MapWorldsDunes',
        timestamp: '2026-07-23T11:04:10.000Z',
      })
    );
  });

  it('keeps the old run as the explicit-end target when restart completion lacks events', async () => {
    mockIsTown.mockReturnValue(false);
    mockGetAreaFromId.mockReturnValue({
      name: 'Strand Map',
      baseLevel: 74,
      isTown: false,
      isHideout: false,
      isLabyrinthAirlock: false,
      isLabyrinthBossArea: false,
    });
    mockTryProcess.mockResolvedValue(false);
    mockHasOngoingMapRun.mockResolvedValue(true);
    const { default: LogProcessor } = await import('../../../src/main/modules/LogProcessor');
    const generatedRun = jest.fn();
    LogProcessor.emitter.on('client-logs:generated-run', generatedRun);

    await LogProcessor.processGeneration(
      '2026-07-24T11:04:10.000Z',
      'Generating level 83 area "MapWorldsStrand" with seed 456'
    );

    expect(mockTryProcess).toHaveBeenCalledTimes(3);
    const completionRequest = {
      event: { timestamp: '2026-07-24T11:04:10.000Z', server: '' },
    };
    expect(mockTryProcess.mock.calls).toEqual([
      [completionRequest],
      [completionRequest],
      [completionRequest],
    ]);
    expect(mockMarkRunDeferred).not.toHaveBeenCalled();
    expect(mockCreateNewMapRun).not.toHaveBeenCalled();
    expect(generatedRun).not.toHaveBeenCalled();
  });

  it('tracks Kingsmarch as a map-like run', async () => {
    mockGetAreaFromId.mockReturnValue({
      name: 'Kingsmarch',
      baseLevel: 1,
      isTown: false,
      isMapArea: false,
      isHideout: false,
      isLabyrinthAirlock: false,
      isLabyrinthBossArea: false,
    });
    const { default: LogProcessor } = await import('../../../src/main/modules/LogProcessor');
    const generatedRun = jest.fn();
    LogProcessor.emitter.on('client-logs:generated-run', generatedRun);

    await LogProcessor.processGeneration(
      '2026-07-24T10:00:00.000Z',
      'Generating level 1 area "KalguuranSettlersLeague" with seed 123'
    );

    expect(mockTryProcess).toHaveBeenCalledTimes(3);
    expect(mockCreateNewMapRun).toHaveBeenCalledWith({
      areaId: 'KalguuranSettlersLeague',
      areaName: 'Kingsmarch',
      level: '1',
      seed: '123',
      timestamp: '2026-07-24T10:00:00.000Z',
    });
    expect(generatedRun).toHaveBeenCalledWith(
      expect.objectContaining({ areaName: 'Kingsmarch', runId: 99 })
    );
  });

  it('continues generation when a deferred retry throws', async () => {
    mockGetAreaFromId.mockReturnValue({
      name: 'Dunes Map',
      baseLevel: 74,
      isTown: false,
      isHideout: false,
      isLabyrinthAirlock: false,
      isLabyrinthBossArea: false,
    });
    mockRetryDeferredRun.mockRejectedValueOnce(new Error('deferred DB failure'));
    mockTryProcess.mockResolvedValue(true);
    mockGetLatestUncompletedRun.mockResolvedValue({
      id: 8,
      first_event: '2026-07-23T10:00:00.000Z',
      last_event: '2026-07-23T10:00:00.000Z',
    });
    const { default: LogProcessor } = await import('../../../src/main/modules/LogProcessor');

    await expect(
      LogProcessor.processGeneration(
        '2026-07-23T11:04:10.000Z',
        'Generating level 83 area "MapWorldsDunes" with seed 123'
      )
    ).resolves.toBeUndefined();

    expect(mockTryProcess).not.toHaveBeenCalled();
    expect(mockMarkRunDeferred).toHaveBeenCalledWith(
      8,
      '2026-07-23T11:04:10.000Z'
    );
    expect(mockCreateNewMapRun).toHaveBeenCalledTimes(1);
  });

  it('does not emit a map entry for a town', async () => {
    mockIsTown.mockReturnValue(true);
    const { default: LogProcessor } = await import('../../../src/main/modules/LogProcessor');
    const enteredMap = jest.fn();
    LogProcessor.emitter.on('client-logs:entered-map', enteredMap);

    await LogProcessor.processOther('2026-07-23T11:04:10.000Z', ': You have entered Karui Shores.');

    expect(mockIsTown).toHaveBeenCalledWith('Karui Shores');
    expect(enteredMap).not.toHaveBeenCalled();
  });

  it('emits a map entry for a non-town area', async () => {
    mockIsTown.mockReturnValue(false);
    const { default: LogProcessor } = await import('../../../src/main/modules/LogProcessor');
    const enteredMap = jest.fn();
    LogProcessor.emitter.on('client-logs:entered-map', enteredMap);

    await LogProcessor.processOther('2026-07-23T11:04:10.000Z', ': You have entered Dunes.');

    expect(enteredMap).toHaveBeenCalledWith({
      area: 'Dunes',
      event: {
        timestamp: '2026-07-23T11:04:10.000Z',
        area: 'Dunes',
        server: '',
      },
      mode: 'automatic',
    });
    expect(mockInsertItemsAndInventoryBaseline).toHaveBeenCalledWith(
      {},
      '2026-07-23T11:04:10.000Z',
      42,
      expect.any(String),
      {}
    );
  });
});
