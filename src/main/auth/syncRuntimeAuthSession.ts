import AuthManager from '../AuthManager';
import SettingsManager from '../SettingsManager';
import * as RuntimeSidecarClient from '../runtime/RuntimeSidecarClient';

type OAuthToken = Parameters<typeof AuthManager.saveToken>[0];

async function refreshMainSettingsFromRuntime() {
  await RuntimeSidecarClient.callRuntimeMethod<void>('settings.waitForSave');
  await SettingsManager.reload();
}

export async function saveTokenAndSyncRuntime(token: OAuthToken) {
  await refreshMainSettingsFromRuntime();
  await AuthManager.saveToken(token);
  await SettingsManager.waitForSave();
  await RuntimeSidecarClient.callRuntimeMethod<void>('auth.refreshSession');
}

export async function logoutAndSyncRuntime() {
  await refreshMainSettingsFromRuntime();
  await AuthManager.logout();
  await RuntimeSidecarClient.restart();
}
