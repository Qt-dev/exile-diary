describe('rendererClientLogger', () => {
  const appendFileSync = jest.fn();
  const mkdirSync = jest.fn();
  const getUserDataPath = jest.fn(() => 'D:/Dev/exile-diary/.tmp/dev-user-data');

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.EXILE_DIARY_DISABLE_FILE_LOGGING;

    jest.doMock('fs', () => ({
      __esModule: true,
      default: {
        appendFileSync,
        mkdirSync,
      },
      appendFileSync,
      mkdirSync,
    }));

    jest.doMock('../../src/main/runtime/getUserDataPath', () => ({
      getUserDataPath: (...args: unknown[]) => getUserDataPath(...args),
    }));
  });

  it('writes renderer diagnostics to a dedicated renderer log file', async () => {
    const { writeRendererClientLog } = await import('../../src/main/rendererClientLogger');

    writeRendererClientLog({
      level: 'error',
      message: 'ReferenceError: require is not defined',
      source: 'global-error',
      stack: 'ReferenceError stack',
      timestamp: '2026-07-10T02:21:01.455Z',
    });

    expect(mkdirSync).toHaveBeenCalledWith('/D:/Dev/exile-diary/.tmp/dev-user-data/logs', {
      recursive: true,
    });
    expect(appendFileSync).toHaveBeenCalledWith(
      '/D:/Dev/exile-diary/.tmp/dev-user-data/logs/renderer.log',
      expect.stringContaining('"message":"ReferenceError: require is not defined"'),
      'utf8'
    );
  });

  it('registers the renderer log IPC channel', async () => {
    const electron = await import('electron');
    const { sendChannels } = await import('../../src/shared/contracts/exileDiaryApi');
    const { registerRendererClientLogHandler } = await import('../../src/main/rendererClientLogger');

    registerRendererClientLogHandler();

    const handler = (electron.ipcMain.on as jest.Mock).mock.calls.find(
      ([channel]) => channel === sendChannels.rendererLog
    )?.[1];

    handler(null, { level: 'warn', message: 'client warning' });

    expect(appendFileSync).toHaveBeenCalledWith(
      '/D:/Dev/exile-diary/.tmp/dev-user-data/logs/renderer.log',
      expect.stringContaining('"message":"client warning"'),
      'utf8'
    );
  });
});
