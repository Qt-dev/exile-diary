import type Conf from 'conf';
import { getAppVersion, getUserDataPath } from '../runtime/getUserDataPath';

type CredentialSchema = {
  token?: string;
};

type CredentialStoreOptions = {
  cwd?: string;
  projectVersion?: string;
};

export function createCredentialStore({
  cwd = getUserDataPath(),
  projectVersion = getAppVersion(),
}: CredentialStoreOptions = {}) {
  const confModule = require('conf') as typeof Conf | { default: typeof Conf };
  const ConfConstructor = typeof confModule === 'function' ? confModule : confModule.default;

  return new ConfConstructor<CredentialSchema>({
    configName: 'creds',
    cwd,
    encryptionKey: 'exilediary',
    fileExtension: 'token',
    projectVersion,
  });
}
