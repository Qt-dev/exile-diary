const ConfConstructor = jest.fn();
const getUserDataPath = jest.fn(() => 'D:\\Users\\example\\AppData\\Roaming\\exile-diary');
const getAppVersion = jest.fn(() => '1.11.1-test');

jest.mock('conf', () => ({ default: ConfConstructor }));

jest.mock('../../../src/main/runtime/getUserDataPath', () => ({
  getAppVersion: (...args: unknown[]) => getAppVersion(...args),
  getUserDataPath: (...args: unknown[]) => getUserDataPath(...args),
}));

describe('createCredentialStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ConfConstructor.mockImplementation((options) => ({ options }));
  });

  it('loads the ESM-only Conf default export without Electron', async () => {
    const { createCredentialStore } = await import('../../../src/main/auth/createCredentialStore');

    const store = createCredentialStore();

    expect(getUserDataPath).toHaveBeenCalledTimes(1);
    expect(getAppVersion).toHaveBeenCalledTimes(1);
    expect(ConfConstructor).toHaveBeenCalledWith({
      configName: 'creds',
      cwd: 'D:\\Users\\example\\AppData\\Roaming\\exile-diary',
      encryptionKey: 'exilediary',
      fileExtension: 'token',
      projectVersion: '1.11.1-test',
    });
    expect(store).toEqual({
      options: expect.objectContaining({ configName: 'creds' }),
    });
  });
});
