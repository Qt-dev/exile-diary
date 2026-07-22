const tailHandlers = new Map<string, (...args: any[]) => unknown>();
const tailWatch = jest.fn();
const tailUnwatch = jest.fn();
const mockSchedule = jest.fn((task: () => unknown) => Promise.resolve(task()));
const mockProcessEnd = jest.fn().mockResolvedValue(true);
const mockProcessGeneration = jest.fn().mockResolvedValue(undefined);
const mockProcessNewInstance = jest.fn().mockResolvedValue(undefined);
const mockProcessOther = jest.fn().mockResolvedValue(undefined);

jest.mock('tail', () => ({
  Tail: jest.fn(() => ({
    on: jest.fn((eventName: string, handler: (...args: any[]) => unknown) => {
      tailHandlers.set(eventName, handler);
    }),
    watch: tailWatch,
    unwatch: tailUnwatch,
  })),
}));

jest.mock('../../../src/main/SettingsManager', () => ({
  __esModule: true,
  default: {
    getAll: jest.fn(() => ({
      clientTxt: 'C:\\Path of Exile\\logs\\Client.txt',
      activeProfile: { characterName: 'AtlasRunner' },
    })),
  },
}));

jest.mock('../../../src/main/modules/Utils', () => ({
  __esModule: true,
  default: { poeRunning: jest.fn().mockResolvedValue(false) },
}));

jest.mock('fs/promises', () => ({
  stat: jest.fn().mockResolvedValue({ mtime: new Date() }),
}));

jest.mock('../../../src/main/modules/LogProcessor', () => ({
  __esModule: true,
  default: {
    schedule: mockSchedule,
    processEnd: mockProcessEnd,
    processGeneration: mockProcessGeneration,
    processNewInstance: mockProcessNewInstance,
    processOther: mockProcessOther,
  },
}));

describe('ClientTxtWatcher map-end ingestion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tailHandlers.clear();
  });

  it('routes a tagged self-whisper to map-end processing', async () => {
    const ClientTxtWatcher = await import('../../../src/main/modules/ClientTxtWatcher');
    ClientTxtWatcher.start();
    const lineHandler = tailHandlers.get('line');

    await lineHandler?.(
      '2026/07/22 10:00:00 123456 [INFO Client 1234] @To <Mercenaries> AtlasRunner: end'
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockProcessEnd).toHaveBeenCalledWith(
      expect.any(String),
      '@To <Mercenaries> AtlasRunner: end'
    );
    expect(mockProcessOther).not.toHaveBeenCalled();
  });
});
