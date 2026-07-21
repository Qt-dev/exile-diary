import path from 'path';

function loadModule({
  osPlatform = 'win32',
  osArch = 'x64',
  isPackaged = false,
  extensionExists = true,
  envIsPackaged,
}: {
  osPlatform?: string;
  osArch?: string;
  isPackaged?: boolean;
  extensionExists?: boolean;
  envIsPackaged?: string;
}) {
  jest.resetModules();
  if (envIsPackaged === undefined) {
    delete process.env.EXILE_DIARY_IS_PACKAGED;
  } else {
    process.env.EXILE_DIARY_IS_PACKAGED = envIsPackaged;
  }

  const statSyncMock = jest.fn(() => (extensionExists ? ({ mode: 0o100644 } as any) : undefined));

  jest.doMock('electron', () => ({
    app: {
      isPackaged,
    },
  }));

  jest.doMock('node:process', () => ({
    arch: osArch,
    platform: osPlatform,
  }));
  jest.doMock('process', () => ({
    arch: osArch,
    platform: osPlatform,
  }));

  jest.doMock('node:fs', () => ({
    statSync: statSyncMock,
  }));

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../../../src/main/db/sqlite-regex--cjs-fix');
  return { mod, statSyncMock };
}

describe('db/sqlite-regex--cjs-fix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a windows extension path for win32-x64', () => {
    const { mod, statSyncMock } = loadModule({ osPlatform: 'win32', osArch: 'x64' });

    const result = mod.getLoadablePath();

    expect(result).toContain(path.join('db', 'extensions', 'regexp.dll'));
    expect(statSyncMock).toHaveBeenCalledWith(result, { throwIfNoEntry: false });
  });

  it('returns a mac extension path for darwin-arm64', () => {
    const { mod } = loadModule({ osPlatform: 'darwin', osArch: 'arm64' });

    const result = mod.getLoadablePath();

    expect(result).toContain(path.join('db', 'extensions', 'regexp.dylib'));
  });

  it('returns a linux extension path for linux-x64', () => {
    const { mod } = loadModule({ osPlatform: 'linux', osArch: 'x64' });

    const result = mod.getLoadablePath();

    expect(result).toContain(path.join('db', 'extensions', 'regexp.so'));
  });

  it('uses the packaged resource path when packaging is provided through the environment', () => {
    const { mod } = loadModule({
      osPlatform: 'win32',
      osArch: 'x64',
      isPackaged: false,
      envIsPackaged: 'true',
    });

    const result = mod.getLoadablePath();
    expect(result).toContain(path.join('db', 'extensions', 'regexp.dll'));
  });

  it('still builds a path for unsupported platform-arch combinations', () => {
    const { mod } = loadModule({ osPlatform: 'linux', osArch: 'arm64' });

    const result = mod.getLoadablePath();
    expect(result).toContain(path.join('db', 'extensions', 'regexp.so'));
  });

  it('throws when the extension binary is missing', () => {
    const { mod } = loadModule({
      osPlatform: 'win32',
      osArch: 'x64',
      extensionExists: false,
    });

    expect(() => mod.getLoadablePath()).toThrow('Loadble extension for regex not found');
  });
});
