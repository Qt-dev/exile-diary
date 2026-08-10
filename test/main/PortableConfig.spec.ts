import * as path from 'path';

const mockApp = {
  getPath: jest.fn((name: string) => `C:\\mock\\${name}`),
  setPath: jest.fn(),
  getName: jest.fn(() => 'exile-diary'),
  getVersion: jest.fn(() => '1.11.14'),
};

jest.mock('electron', () => ({
  app: mockApp,
}));

describe('PortableConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('detects portable mode when PORTABLE=true is set and sets userData path', () => {
    process.env.PORTABLE = 'true';
    mockApp.getPath.mockImplementation((name: string) => {
      if (name === 'userData') return path.join(process.cwd(), 'exile-data');
      return `C:\\mock\\${name}`;
    });

    const { initPortableMode, getIsPortable, getUserDataPath } = require('../../src/main/PortableConfig');

    initPortableMode();

    expect(getIsPortable()).toBe(true);
    expect(getUserDataPath()).toContain('exile-data');
    expect(mockApp.setPath).toHaveBeenCalledWith('userData', expect.stringContaining('exile-data'));
  });

  it('runs in standard installed mode when PORTABLE is not set and no marker exists', () => {
    delete process.env.PORTABLE;
    delete process.env.EXILE_DIARY_USER_DATA_PATH;

    const { initPortableMode, getIsPortable } = require('../../src/main/PortableConfig');

    initPortableMode();

    expect(getIsPortable()).toBe(false);
  });
});
