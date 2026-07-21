import AuthManager from '../AuthManager';
import SettingsManager from '../SettingsManager';
import { authSessionReadiness } from './AuthSessionReadiness';

function hasValidActiveProfile(activeProfile: any) {
  return !!(
    activeProfile &&
    activeProfile.characterName &&
    activeProfile.league &&
    activeProfile.valid
  );
}

export async function syncAuthSessionReadiness() {
  authSessionReadiness.setProfileReady(hasValidActiveProfile(SettingsManager.get('activeProfile')));
  authSessionReadiness.setAccountReady(await AuthManager.isAuthenticated(true));
}
