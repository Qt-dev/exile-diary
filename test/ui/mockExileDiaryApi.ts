import type {
  ExileDiaryApi,
  ExileDiaryListener,
  ExileDiaryRendererEventName,
  ExileDiaryRendererEventPayloads,
} from '../../src/shared/contracts/exileDiaryApi';
import {
  characters,
  emptyStats,
  populatedRuns,
  populatedSettings,
  populatedStats,
  representativeItem,
  runDetails,
  stashTabs,
  type UiScenarioName,
} from './fixtures';

export type UiHarnessCall = { method: string; args: unknown[] };

export type UiHarnessState = {
  authenticated: boolean;
  settings: typeof populatedSettings;
  runs: typeof populatedRuns;
  stats: typeof populatedStats;
  characters: typeof characters;
  stashTabs: typeof stashTabs;
  stashItems: Array<typeof representativeItem>;
  overlayPersistence: boolean;
  overlayPosition: { x: number; y: number };
};

export type UiHarnessController = {
  scenario: UiScenarioName;
  calls: UiHarnessCall[];
  clearCalls(): void;
  getState(): UiHarnessState;
  setState(patch: Partial<UiHarnessState>): void;
  emit<K extends ExileDiaryRendererEventName>(
    eventName: K,
    payload: ExileDiaryRendererEventPayloads[K]
  ): void;
};

declare global {
  interface Window {
    __exileDiaryTest: UiHarnessController;
  }
}

const scenarioNames = new Set<UiScenarioName>([
  'populated',
  'empty',
  'unauthenticated',
  'backend-error',
]);

const normalizeScenario = (value: string): UiScenarioName =>
  scenarioNames.has(value as UiScenarioName) ? (value as UiScenarioName) : 'populated';

export function installMockExileDiaryApi(requestedScenario: string) {
  const scenario = normalizeScenario(requestedScenario);
  const calls: UiHarnessCall[] = [];
  const listeners = new Map<ExileDiaryRendererEventName, Set<(payload: unknown) => void>>();
  const populated = scenario === 'populated' || scenario === 'backend-error';
  const state: UiHarnessState = {
    authenticated: scenario !== 'unauthenticated',
    settings: structuredClone(populatedSettings),
    runs: populated ? structuredClone(populatedRuns) : [],
    stats: structuredClone(populated ? populatedStats : emptyStats),
    characters: populated ? structuredClone(characters) : [],
    stashTabs: populated ? structuredClone(stashTabs) : [],
    stashItems: populated ? [structuredClone(representativeItem)] : [],
    overlayPersistence: true,
    overlayPosition: { x: 24, y: 80 },
  };

  const record = (method: string, ...args: unknown[]) => {
    calls.push({ method, args });
  };

  const emit = <K extends ExileDiaryRendererEventName>(
    eventName: K,
    payload: ExileDiaryRendererEventPayloads[K]
  ) => {
    listeners.get(eventName)?.forEach((listener) => listener(payload));
  };

  const on = <K extends ExileDiaryRendererEventName>(
    eventName: K,
    listener: ExileDiaryListener<K>
  ) => {
    const eventListeners = listeners.get(eventName) ?? new Set<(payload: unknown) => void>();
    eventListeners.add(listener as (payload: unknown) => void);
    listeners.set(eventName, eventListeners);
    return () => eventListeners.delete(listener as (payload: unknown) => void);
  };

  const api: ExileDiaryApi = {
    getAppGlobals: async () => ({
      appLocale: 'en-US',
      appPath: 'ui-harness',
      appVersion: '1.10.2-test',
    }),
    loadRuns: async () => structuredClone(state.runs),
    loadRun: async (runId) => {
      const run = state.runs.find(({ id }) => id === Number(runId));
      return structuredClone(run ?? state.runs[0]);
    },
    loadRunDetails: async () => structuredClone(runDetails),
    reprocessRuns: async () => record('reprocessRuns'),
    reprocessRun: async (runId) => {
      record('reprocessRun', runId);
      return structuredClone(runDetails);
    },
    getSettings: async () => structuredClone(state.settings),
    getCharacters: async () => structuredClone(state.characters),
    saveSettings: async (nextSettings) => {
      record('saveSettings', nextSettings);
      state.settings = { ...state.settings, ...structuredClone(nextSettings) };
    },
    getOAuthInfo: async () => ({ code_challenge: 'fixture-challenge', state: 'fixture-state' }),
    isAuthenticated: async () => state.authenticated,
    logout: async () => {
      record('logout');
      emit('oauthLoggedOut', undefined);
    },
    getAllStats: async () => {
      if (scenario === 'backend-error') throw new Error('Fixture stats backend unavailable');
      return structuredClone(state.stats);
    },
    getStashTabs: async () => ({
      stashTabs: structuredClone(state.stashTabs),
      data: {
        items: structuredClone(state.stashItems),
        value: state.stashItems.reduce((total, item) => total + item.value, 0),
      },
    }),
    saveStashTabs: async (tabs) => record('saveStashTabs', tabs),
    saveStashRefreshInterval: async (interval) => record('saveStashRefreshInterval', interval),
    saveFilterSettings: async (filters) => record('saveFilterSettings', filters),
    triggerSearch: async (params) => {
      record('triggerSearch', params);
      queueMicrotask(() =>
        emit('searchResults', {
          items: state.stashItems.length
            ? [
                {
                  ...structuredClone(state.stashItems[0]),
                  raw_data: JSON.stringify(state.stashItems[0]),
                },
              ]
            : [],
          runs: structuredClone(state.runs.slice(0, 1)),
        })
      );
    },
    getDivinePrice: async () => 180,
    getAllMapNames: async () => [
      { name: 'Dunes Map' },
      { name: 'Crimson Temple Map' },
      { name: 'Jungle Valley Map' },
    ],
    getAllPossibleMods: async () => [
      { mod: 'Monsters have increased life' },
      { mod: 'Players have less recovery' },
    ],
    refreshProfitPerHour: async () => {
      record('refreshProfitPerHour');
      queueMicrotask(() =>
        emit('updateProfitPerHour', {
          profitPerHour: { daily: 420, hourly: 215 },
          divinePrice: 180,
        })
      );
    },
    debugRecheckGain: async (from, to) => record('debugRecheckGain', from, to),
    debugFetchRates: async () => record('debugFetchRates'),
    debugFetchStashTabs: async () => record('debugFetchStashTabs'),
    getOverlayPersistence: async () => state.overlayPersistence,
    getOverlayPosition: async () => structuredClone(state.overlayPosition),
    updateItemsIgnoreStatus: async (data) => record('updateItemsIgnoreStatus', data),
    listStrategies: async () => [],
    createStrategy: async (input) => {
      record('createStrategy', input);
      return {} as any;
    },
    updateStrategy: async (strategyId, input) => {
      record('updateStrategy', { strategyId, input });
      return {} as any;
    },
    deleteStrategy: async (strategyId) => record('deleteStrategy', strategyId),
    setRunStrategies: async (runId, strategyIds) => {
      record('setRunStrategies', { runId, strategyIds });
      return [];
    },
    getStrategyStats: async (strategyId) => {
      record('getStrategyStats', strategyId);
      return {} as any;
    },
    getPricesCatalog: async (options) => {
      record('getPricesCatalog', options);
      return [];
    },
    getItemPriceDetails: async (itemIdentifier, league) => {
      record('getItemPriceDetails', { itemIdentifier, league });
      return {
        identifier: itemIdentifier,
        category: 'Currency',
        unitChaosPrice: 150,
        unitDivinePrice: 1,
        divineChaosRate: 150,
        sparkline: [],
        activeOverride: undefined,
        drops: [],
        droppedQuantity: 0,
        totalChaosValue: 0,
      };
    },
    addPriceOverride: async (params) => {
      record('addPriceOverride', params);
      return {};
    },
    deletePriceOverride: async (itemIdentifier, league) => {
      record('deletePriceOverride', { itemIdentifier, league });
      return true;
    },
    recalculatePrices: async (options) => {
      record('recalculatePrices', options);
      return { updatedRuns: 0, updatedItems: 0 };
    },
    openFileDialog: async (options) => {
      record('openFileDialog', options);
      return { canceled: false, filePaths: ['C:\\Fixture'] };
    },
    showCharacterDbFile: async () => record('showCharacterDbFile'),
    refreshUi: () => record('refreshUi'),
    notifyFiltersUiUpdated: () => record('notifyFiltersUiUpdated'),
    requestNetWorthRefresh: () => {
      record('requestNetWorthRefresh');
      queueMicrotask(() => emit('updateNetWorth', { value: 4321, change: 125, divinePrice: 180 }));
    },
    setOverlayClickable: (clickable) => record('setOverlayClickable', clickable),
    setOverlayPosition: (position) => record('setOverlayPosition', position),
    disableHotkeys: () => record('disableHotkeys'),
    enableHotkeys: () => record('enableHotkeys'),
    triggerLogAction: (action) => record('triggerLogAction', action),
    logRendererMessage: (payload) => record('logRendererMessage', payload),
    openExternal: async (url) => record('openExternal', url),
    on,
  };

  window.exileDiary = api;
  window.__exileDiaryTest = {
    scenario,
    calls,
    clearCalls: () => calls.splice(0, calls.length),
    getState: () => structuredClone(state),
    setState: (patch) => Object.assign(state, structuredClone(patch)),
    emit,
  };
}
