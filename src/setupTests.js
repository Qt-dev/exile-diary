// Mock Electron modules for testing
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((name) => {
      switch (name) {
        case 'userData':
          return '/mock/userdata';
        case 'appData':
          return '/mock/appdata';
        default:
          return '/mock/path';
      }
    }),
    getName: jest.fn(() => 'exile-diary'),
    getVersion: jest.fn(() => '1.0.0'),
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
  },
  dialog: {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn(),
    showMessageBox: jest.fn(),
  },
  BrowserWindow: jest.fn(() => ({
    loadFile: jest.fn(),
    loadURL: jest.fn(),
    webContents: {
      send: jest.fn(),
      openDevTools: jest.fn(),
    },
    on: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    close: jest.fn(),
  })),
}));

// Mock electron-store
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    has: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    store: {},
  }));
});

// Mock better-sqlite3
jest.mock('better-sqlite3', () => {
  return jest.fn(() => ({
    prepare: jest.fn(() => ({
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(),
    })),
    exec: jest.fn(),
    close: jest.fn(),
    pragma: jest.fn(),
  }));
});

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-v4'),
}));

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  createReadStream: jest.fn(),
  createWriteStream: jest.fn(),
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    access: jest.fn(),
    unlink: jest.fn(),
  },
}));

// Mock path module
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => '/' + args.join('/')),
  dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/')),
  basename: jest.fn((path) => path.split('/').pop()),
  extname: jest.fn((path) => {
    const parts = path.split('.');
    return parts.length > 1 ? '.' + parts.pop() : '';
  }),
}));