import dayjs from 'dayjs';
import Runs from '../db/repositories/run';
import SettingsManager from '../SettingsManager';
import GGGAPI from '../GGGAPI';
import AuthManager from '../AuthManager';
import StatsManager from '../StatsManager';
import StashTabsManager from '../StashTabsManager';
import stashGetter from '../modules/StashGetter';
import RendererLogger from '../RendererLogger';
import * as ClientTxtWatcher from '../modules/ClientTxtWatcher';
import ItemPricer from '../modules/ItemPricer';
import RunParser from '../modules/RunParser';
import SearchManager from '../SearchManager';
import RateGetterV2 from '../modules/RateGetterV2';
import ItemsDB from '../db/repositories/items';

type Awaitable<T> = T | Promise<T>;

export type RendererRuntimeDependencies = {
  runs: {
    getLastRuns: (size: number) => Promise<any[]>;
    getRun: (runId: number) => Promise<any>;
  };
  settingsManager: {
    get: (key: string) => any;
    getAll: () => any;
    set: (key: string, value: any) => Promise<void>;
  };
  gggApi: {
    getAllCharacters: () => Promise<any[]>;
    getAllStashTabs: () => Promise<any[]>;
  };
  authManager: {
    getAuthInfo: () => Awaitable<{ code_challenge: string; state: string }>;
    isAuthenticated: () => Promise<boolean>;
    logout: () => Promise<void>;
  };
  statsManager: {
    getAllStats: (params: { league?: string; characterName?: string }) => Promise<any>;
    getAllMapNames: () => Promise<string[]>;
    getAllPossibleMods: () => Promise<string[]>;
    registerProfitPerHourAnnouncer?: (callback: (...args: any[]) => void) => void;
    triggerProfitPerHourAnnouncer: () => void;
  };
  stashTabsManager: {
    getStashData: () => Promise<any>;
    refresh: () => Promise<void>;
  };
  stashGetter: {
    refreshInterval: () => void;
  };
  rendererLogger: {
    log: (payload: { messages: Array<Record<string, any>>; onOverlay?: boolean }) => void;
  };
  clientTxtWatcher: {
    checkValidLogfile: (path: string) => void;
  };
  itemPricer: {
    getCurrencyByName: (name: string, date?: string, league?: string) => Promise<number>;
  };
  runParser: {
    reprocessRuns: () => Promise<void>;
    reprocessRun: (runId: number) => Promise<any>;
    recheckGained: (from?: string, to?: string) => Promise<void>;
  };
  searchManager: {
    search: (params: Record<string, any>) => void;
  };
  rateGetter: {
    update: (force?: boolean) => Promise<void>;
  };
  itemsDb: {
    updateIgnoredItems: (data: Array<{ id: string; status: boolean }>) => Promise<void>;
  };
  now: () => string;
};

export type RendererRunUseCaseDependencies = Pick<
  RendererRuntimeDependencies,
  'runs' | 'runParser' | 'rendererLogger' | 'itemsDb'
>;

export type RendererSettingsUseCaseDependencies = Pick<
  RendererRuntimeDependencies,
  'settingsManager' | 'gggApi' | 'authManager' | 'rendererLogger' | 'clientTxtWatcher'
>;

export type RendererStashUseCaseDependencies = Pick<
  RendererRuntimeDependencies,
  'settingsManager' | 'gggApi' | 'stashTabsManager' | 'stashGetter'
>;

export type RendererStatsUseCaseDependencies = Pick<
  RendererRuntimeDependencies,
  'settingsManager' | 'statsManager' | 'itemPricer' | 'searchManager' | 'rateGetter' | 'now'
>;

export function createDefaultRendererRuntimeDependencies(): RendererRuntimeDependencies {
  return {
    runs: Runs,
    settingsManager: SettingsManager,
    gggApi: GGGAPI,
    authManager: AuthManager,
    statsManager: StatsManager,
    stashTabsManager: StashTabsManager,
    stashGetter,
    rendererLogger: RendererLogger,
    clientTxtWatcher: ClientTxtWatcher,
    itemPricer: ItemPricer,
    runParser: RunParser,
    searchManager: SearchManager,
    rateGetter: RateGetterV2,
    itemsDb: ItemsDB,
    now: () => dayjs().format('YYYYMMDD'),
  };
}

export function pickRendererRunUseCaseDependencies(
  deps: RendererRuntimeDependencies
): RendererRunUseCaseDependencies {
  return {
    runs: deps.runs,
    runParser: deps.runParser,
    rendererLogger: deps.rendererLogger,
    itemsDb: deps.itemsDb,
  };
}

export function pickRendererSettingsUseCaseDependencies(
  deps: RendererRuntimeDependencies
): RendererSettingsUseCaseDependencies {
  return {
    settingsManager: deps.settingsManager,
    gggApi: deps.gggApi,
    authManager: deps.authManager,
    rendererLogger: deps.rendererLogger,
    clientTxtWatcher: deps.clientTxtWatcher,
  };
}

export function pickRendererStashUseCaseDependencies(
  deps: RendererRuntimeDependencies
): RendererStashUseCaseDependencies {
  return {
    settingsManager: deps.settingsManager,
    gggApi: deps.gggApi,
    stashTabsManager: deps.stashTabsManager,
    stashGetter: deps.stashGetter,
  };
}

export function pickRendererStatsUseCaseDependencies(
  deps: RendererRuntimeDependencies
): RendererStatsUseCaseDependencies {
  return {
    settingsManager: deps.settingsManager,
    statsManager: deps.statsManager,
    itemPricer: deps.itemPricer,
    searchManager: deps.searchManager,
    rateGetter: deps.rateGetter,
    now: deps.now,
  };
}
