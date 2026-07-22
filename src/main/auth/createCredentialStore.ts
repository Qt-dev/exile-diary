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
  const ConfConstructor = require('conf') as typeof Conf;

  return new ConfConstructor<CredentialSchema>({
    configName: 'creds',
    cwd,
    encryptionKey: 'exilediary',
    fileExtension: 'token',
    projectVersion,
  });
}
