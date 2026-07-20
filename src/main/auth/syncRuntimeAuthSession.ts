import AuthManager from '../AuthManager';
import SettingsManager from '../SettingsManager';
import * as RuntimeSidecarClient from '../runtime/RuntimeSidecarClient';

type OAuthToken = Parameters<typeof AuthManager.saveToken>[0];

export async function saveTokenAndSyncRuntime(token: OAuthToken) {
  await AuthManager.saveToken(token);
  await SettingsManager.waitForSave();
  await RuntimeSidecarClient.restart();
}

export async function logoutAndSyncRuntime() {
  await AuthManager.logout();
  await RuntimeSidecarClient.restart();
}
