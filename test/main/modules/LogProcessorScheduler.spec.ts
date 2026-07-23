let uuidCounter = 0;
const mockTryProcess = jest.fn();
const mockInsertEvent = jest.fn();
const mockSaveNewTree = jest.fn();
const mockGetInventoryDiffs = jest.fn();
const mockInsertItems = jest.fn();
const mockGetEventByQuote = jest.fn();
const mockIsTown = jest.fn();
jest.mock('uuid', () => ({
  v4: jest.fn(() => `log-task-${++uuidCounter}`),
}));

jest.mock('../../../src/main/modules/RunParser', () => ({
  __esModule: true,
  default: { tryProcess: mockTryProcess },
}));
jest.mock('../../../src/main/db/run', () => ({
  __esModule: true,
  default: { insertEvent: mockInsertEvent },
}));
jest.mock('../../../src/main/SettingsManager', () => ({
  __esModule: true,
  default: {
    getAll: jest.fn(() => ({
      activeProfile: { characterName: 'AtlasRunner' },
    })),
  },
}));
jest.mock('../../../src/main/modules/SkillTreeWatcher', () => ({
  __esModule: true,
  default: { saveNewTree: mockSaveNewTree },
}));
jest.mock('../../../src/main/modules/InventoryGetter', () => ({
  __esModule: true,
  default: { getInventoryDiffs: mockGetInventoryDiffs },
}));
jest.mock('../../../src/main/modules/ItemParser', () => ({
  __esModule: true,
  default: { insertItems: mockInsertItems },
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
    mockInsertEvent.mockReset().mockResolvedValue(true);
    mockSaveNewTree.mockReset().mockResolvedValue(undefined);
    mockGetInventoryDiffs.mockReset().mockResolvedValue(null);
    mockInsertItems.mockReset().mockResolvedValue(undefined);
    mockGetEventByQuote.mockReset().mockReturnValue(undefined);
    mockIsTown.mockReset();
  });

  afterEach(async () => {
    const { default: LogProcessor } = await import('../../../src/main/modules/LogProcessor');
    LogProcessor.emitter.removeAllListeners('client-logs:entered-map');
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
  });
});
