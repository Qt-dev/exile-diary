import { ipcMain } from 'electron';
import Responder from '../Responder';
import { invokeChannels } from '../../shared/contracts/exileDiaryApi';

export const responderHandlerKeys = [
  'getAppGlobals',
  'loadRuns',
  'loadRun',
  'loadRunDetails',
  'reprocessRuns',
  'reprocessRun',
  'getSettings',
  'getCharacters',
  'saveSettings',
  'getOAuthInfo',
  'isAuthenticated',
  'logout',
  'getAllStats',
  'getStashTabs',
  'saveStashTabs',
  'saveStashRefreshInterval',
  'saveFilterSettings',
  'triggerSearch',
  'getDivinePrice',
  'getAllMapNames',
  'getAllPossibleMods',
  'refreshProfitPerHour',
  'debugRecheckGain',
  'debugFetchRates',
  'debugFetchStashTabs',
  'getOverlayPersistence',
  'updateItemsIgnoreStatus',
] as const;

export function registerResponderHandlers() {
  for (const event of responderHandlerKeys) {
    ipcMain.handle(invokeChannels[event], Responder[event]);
  }
}
