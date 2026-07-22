let uuidCounter = 0;
const mockTryProcess = jest.fn();
jest.mock('uuid', () => ({
  v4: jest.fn(() => `log-task-${++uuidCounter}`),
}));

jest.mock('../../../src/main/modules/RunParser', () => ({
  __esModule: true,
  default: { tryProcess: mockTryProcess },
}));
jest.mock('../../../src/main/db/run', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../src/main/SettingsManager', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../src/main/modules/SkillTreeWatcher', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../src/main/modules/InventoryGetter', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../src/main/modules/ItemParser', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../src/main/modules/EventParser', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../src/main/modules/Utils', () => ({
  __esModule: true,
  default: {},
}));

describe('LogProcessorScheduler', () => {
  beforeEach(() => {
    uuidCounter = 0;
    mockTryProcess.mockReset();
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
});
