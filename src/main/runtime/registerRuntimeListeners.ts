import { app, BrowserWindow, ipcMain, nativeImage } from 'electron';
import logger from 'electron-log';
import dayjs, { Dayjs } from 'dayjs';
import SettingsManager from '../SettingsManager';
import SearchManager from '../SearchManager';
import AuthManager from '../AuthManager';
import RendererLogger from '../RendererLogger';
import StatsManager from '../StatsManager';
import ItemPricer from '../modules/ItemPricer';
import RunParser from '../modules/RunParser';
import ScreenshotWatcher from '../modules/ImageParser/ScreenshotWatcher';
import * as OCRWatcher from '../modules/ImageParser/OCRWatcher';
import KillTracker from '../modules/KillTracker';
import RateGetterV2 from '../modules/RateGetterV2';
import * as ClientTxtWatcher from '../modules/ClientTxtWatcher';
import LogProcessor from '../modules/LogProcessor';
import StashGetter from '../modules/StashGetter';
import Utils from '../modules/Utils';
import { OverlayController } from 'electron-overlay-window';
import {
  rendererEventChannels,
  sendChannels,
} from '../../shared/contracts/exileDiaryApi';

type RegisterRuntimeListenersDependencies = {
  mainWindow: BrowserWindow;
  overlayWindow: BrowserWindow;
  sendToMain: (event: string, data?: any) => void;
  sendToOverlay: (event: string, data?: any) => void;
  reregisterShortcuts: () => void;
  setLogTransport: (debugMode: boolean) => void;
  setupDebugLoggerHook: (logToUi: boolean) => void;
};

type ListenerState = {
  modReadingTimer: Dayjs | null;
  screenshotLock: boolean;
};

function getMapTierString(map: { depth?: number; level?: number }) {
  if (map.depth) {
    return `D${map.depth}`;
  }

  if (map.level) {
    return map.level <= 67 ? `L${map.level}` : `T${map.level - 67}`;
  }

  return '';
}

function buildRunState(area: {
  name: string;
  level: number;
  iir: number;
  pack_size: number;
  iiq: number;
}) {
  return {
    area: area.name,
    level: area.level,
    iir: area.iir > 0 ? area.iir : null,
    pack_size: area.pack_size > 0 ? area.pack_size : null,
    iiq: area.iiq > 0 ? area.iiq : null,
  };
}

function registerSearchBridge({
  sendToMain,
}: Pick<RegisterRuntimeListenersDependencies, 'sendToMain'>) {
  SearchManager.registerMessageHandler((event, data) => {
    sendToMain(event, data);
  });
}

function registerOcrListeners(
  deps: RegisterRuntimeListenersDependencies,
  state: ListenerState,
  settings: ReturnType<typeof SettingsManager.getAll>
) {
  OCRWatcher.emitter.removeAllListeners();
  OCRWatcher.emitter.on('OCRError', () => {
    logger.info('Error getting area info from screenshot. Please try again');
  });
  OCRWatcher.emitter.on('ocr:completed-job', async (info) => {
    logger.info('Got area info from OCR', info);
    const { level, name, depth } = RunParser.latestGeneratedArea;
    const tier = getMapTierString({ level });
    let stats = `IIR: ${info.mapStats.iir} / IIQ: ${info.mapStats.iiq}`;
    if (info.mapStats.pack_size && info.mapStats.pack_size > 0) {
      stats += ` / Pack Size: ${info.mapStats.pack_size}`;
    }

    const modReadingDuration = dayjs().diff(state.modReadingTimer);
    await RunParser.setCurrentMapStats({
      name,
      level,
      depth,
      ...info.mapStats,
    });
    logger.info(`Got area info for ${name} (${tier} - ${stats}) in ${modReadingDuration}ms`);
    RendererLogger.log({
      messages: [
        { text: 'Got area info for ' },
        { text: name, type: 'important' },
        { text: ` (${tier} - ${stats})` },
      ],
    });
    RunParser.refreshTracking();
  });

  ScreenshotWatcher.emitter.removeAllListeners();
  ScreenshotWatcher.emitter.on('OCRStart', (screenshotStats) => {
    logger.info('Reading mods from screenshot');
    state.modReadingTimer = dayjs(screenshotStats.birthtime);
    logger.info(dayjs().diff(state.modReadingTimer));
  });
  ScreenshotWatcher.emitter.on('OCRError', () => {
    logger.info('Error getting area info from screenshot. Please try again');
  });
  ScreenshotWatcher.emitter.on('tooMuchScreenshotClutter', (totalSize) => {
    const dir = settings.screenshotDir.replace(/\\/g, '\\\\');
    logger.info(
      `Screenshot folder contains <span class='eventText'>${totalSize}</span> screenshots. Click <span class='eventText' style='cursor:pointer;' onclick='openShell("${dir}")'>here</span> to open it for cleanup`
    );
  });
  ScreenshotWatcher.emitter.on('screenshot:capture', async () => {
    if (state.screenshotLock) {
      logger.info('Not accepting new screenshot orders while this screenshot is being parsed');
      return;
    }

    state.modReadingTimer = dayjs();
    state.screenshotLock = true;
    logger.info('Map Info : Reading from screenshot');
    RendererLogger.log({
      messages: [{ text: 'Map Info : Reading from screenshot' }],
    });

    deps.overlayWindow.hide();
    const screenshot = OverlayController.screenshot();
    deps.overlayWindow.show();
    const { width, height } = OverlayController.targetBounds;
    const nativeScreenshot = nativeImage
      .createFromBitmap(screenshot, { width, height })
      .toJPEG(100);

    try {
      await ScreenshotWatcher.process(nativeScreenshot);
    } catch (error) {
      logger.error('Error in screenshot processing', error);
      RendererLogger.log({
        messages: [
          {
            text: 'Error in screenshot processing. Check logs for more info.',
            type: 'error',
          },
        ],
      });
    }

    logger.info('Map info : Reading done');
    state.screenshotLock = false;
  });
  ScreenshotWatcher.emitter.on('screenshot:timeout', async () => {
    logger.info('Map Info : Reading from screenshot timed out');
    RendererLogger.log({
      messages: [{ text: 'Map Info : Reading from screenshot timed out', type: 'error' }],
    });
    state.screenshotLock = false;
  });
}

function registerRunAndStatsListeners(deps: RegisterRuntimeListenersDependencies) {
  StatsManager.registerProfitPerHourAnnouncer((profitPerHour, divinePrice) => {
    deps.sendToMain(rendererEventChannels.updateProfitPerHour, { profitPerHour, divinePrice });
  });

  RunParser.emitter.removeAllListeners();
  RunParser.refreshTracking();
  RunParser.emitter.on('run-parser:latest-area-updated', (area) => {
    logger.info('Latest area updated:', area);
    const runState = buildRunState(area);
    deps.sendToMain(rendererEventChannels.currentRunStarted, runState);
    deps.sendToOverlay(rendererEventChannels.currentRunStarted, runState);
    deps.sendToMain(rendererEventChannels.refreshRuns);
  });
  RunParser.emitter.on('run-parser:run-processed', async (run) => {
    const formatter = new Intl.NumberFormat();
    const divinePrice = await ItemPricer.getCurrencyByName('Divine Orb');
    logger.info(
      `Completed run in ${run.name} ` +
        `(${(Utils.getRunningTime(run.firstEvent, run.lastEvent), 'mm:ss')}` +
        (run.gained ? `, ${run.gained} chaos orbs` : '') +
        (run.kills ? `, ${formatter.format(run.kills)} kills` : '') +
        (run.xp ? `, ${formatter.format(run.xp)} XP` : '') +
        `)`
    );
    RendererLogger.log({
      messages: [
        { text: 'Completed run in ' },
        {
          text: run.name,
          type: 'important',
          link: `run/${run.id}`,
        },
        { text: ` (${Utils.getRunningTime(run.firstEvent, run.lastEvent)}, ` },
        {
          text: '',
          price: run.gained,
          divinePrice,
          type: 'currency',
        },
        { text: run.kills ? `, ${formatter.format(run.kills)} kills` : '' },
        { text: run.xp ? `, ${formatter.format(run.xp)} XP` : '' },
        { text: ')' },
      ],
    });
    RunParser.refreshTracking();
    StatsManager.triggerProfitPerHourAnnouncer();
  });
}

function registerShortcutSensitiveSettingListeners(
  reregisterShortcuts: () => void
) {
  SettingsManager.registerListener('runParseScreenshotEnabled', () => reregisterShortcuts());
  SettingsManager.registerListener('screenshots', () => reregisterShortcuts());
  SettingsManager.registerListener('runParseShortcut', () => reregisterShortcuts());
  SettingsManager.registerListener('screenshotShortcut', () => reregisterShortcuts());
  SettingsManager.registerListener('overlayToggleShortcut', () => reregisterShortcuts());
  SettingsManager.registerListener('overlayMovementShortcut', () => reregisterShortcuts());
}

function registerKillTrackerListeners(deps: RegisterRuntimeListenersDependencies) {
  KillTracker.emitter.removeAllListeners();
  KillTracker.emitter.on('incubatorsUpdated', (incubators) => {
    deps.sendToMain('incubatorsUpdated', incubators);
    deps.sendToOverlay('incubatorsUpdated', incubators);
  });
  KillTracker.emitter.on('incubatorsMissing', (equipments) => {
    if (!equipments.length) {
      return;
    }

    RendererLogger.log({
      messages: [
        {
          text: 'Following equipment has incubator missing: ',
        },
        ...equipments.map(([name, icon]) => ({
          text: name,
          type: 'important',
          icon,
        })),
      ],
    });
  });
}

function registerRatesAndLogWatchers(deps: RegisterRuntimeListenersDependencies) {
  RateGetterV2.removeAllListeners();
  RateGetterV2.on('gettingPrices', () => {
    logger.info("<span class='eventText'>Getting item prices from poe.ninja...</span>");
  });
  RateGetterV2.on('doneGettingPrices', () => {
    ItemPricer.updateRates();
    logger.info("<span class='eventText'>Finished getting item prices from poe.ninja</span>");
  });
  RateGetterV2.on('gettingPricesFailed', () => {
    logger.info(
      "<span class='eventText removeRow' onclick='rateGetterRetry(this);'>Error getting item prices from poe.ninja, <span class='retry'>click on this message to try again</span></span>"
    );
  });

  ClientTxtWatcher.emitter.removeAllListeners();
  ClientTxtWatcher.emitter.on('clientTxtFileError', (clientPath) => {
    logger.info(`Error reading ${clientPath}. Please check if the file exists.`);
    RendererLogger.log({
      messages: [{ text: `Error reading ${clientPath}. Please check if the file exists.` }],
    });
  });
  ClientTxtWatcher.emitter.on('clientTxtNotUpdated', (clientPath) => {
    logger.info(
      `<span class='eventText'>${clientPath} has not been updated recently even though the game is running. Please check if PoE is using a different Client.txt file.</span>`
    );
  });

  LogProcessor.emitter.removeAllListeners();
  LogProcessor.emitter.on('client-logs:error:local-chat-disabled', () => {
    logger.info('Unable to track area changes. Please check if local chat is enabled.');
  });
  LogProcessor.emitter.on('client-logs:generated-run', async ({ areaId, areaName, level, seed }) => {
    logger.info(
      `Generated run ${areaName} (${areaId}) (lvl${level}) (${seed}) - Latest: ${RunParser.latestGeneratedArea.seed}`
    );
    RunParser.refreshTracking();
  });
  LogProcessor.emitter.on('client-logs:entered-map', async ({ area }) => {
    logger.info('Entered map ' + area);
    const hasStarted = await RunParser.tryUpdateCurrentArea();
    if (hasStarted) {
      RunParser.refreshTracking();
    }

    const settings = SettingsManager.getAll();
    if (settings.autoScreenshotOnMapEntry?.enabled && hasStarted) {
      const delay = (settings.autoScreenshotOnMapEntry.delay || 2) * 1000;
      logger.info(`Auto-screenshot scheduled for ${area} in ${delay}ms`);

      setTimeout(() => {
        logger.info(`Triggering auto-screenshot for ${area}`);
        ScreenshotWatcher.emitter.emit('screenshot:capture');
      }, delay);
    }
  });
}

function registerStashListeners(deps: RegisterRuntimeListenersDependencies) {
  StashGetter.removeAllListeners();
  StashGetter.initialize();
  StashGetter.on('stashTabs:updated:full', (data) => {
    logger.info(`Updated stash tabs (League: ${data.league} - Change: ${data.change})`);
    deps.sendToMain(rendererEventChannels.stashTabsUpdated, data);
  });
  StashGetter.on('netWorthUpdated', async (data) => {
    const divinePrice = await ItemPricer.getCurrencyByName('Divine Orb');
    deps.sendToMain(rendererEventChannels.updateNetWorth, { divinePrice, ...data });
  });
  ipcMain.on(sendChannels.requestNetWorthRefresh, () => {
    StashGetter.getNetWorth();
  });
}

function registerSettingsListeners(
  deps: RegisterRuntimeListenersDependencies
) {
  SettingsManager.registerListener('overlayPersistenceEnabled', (isOverlayEnabled) => {
    logger.debug(`Setting Overlay Persistence to Enabled:${isOverlayEnabled}`);
    deps.sendToOverlay(rendererEventChannels.overlaySetPersistence, isOverlayEnabled);
    deps.sendToMain(rendererEventChannels.settingsOverlayPersistenceChanged, isOverlayEnabled);
  });
  SettingsManager.registerListener('activeProfile', (newProfile, oldProfile) => {
    if (
      newProfile.characterName !== oldProfile.characterName ||
      newProfile.league !== oldProfile.league
    ) {
      logger.debug('Active profile changed, relaunching the app');
      setTimeout(() => {
        RendererLogger.log({
          messages: [
            {
              text: 'Active profile changed, relaunching the app to load data for the new profile when the settings finish saving in a few seconds...',
            },
          ],
        });
      }, 1000);
      SettingsManager.waitForSave()
        .then(() => {
          app.relaunch();
          app.quit();
        })
        .catch((error) => {
          logger.error('Error waiting for settings save', error);
        });
    }
  });
  SettingsManager.registerListener('forceDebugMode', (newMode: boolean, oldMode: boolean) => {
    if (newMode !== oldMode) {
      logger.debug(`Setting Debug Mode to Enabled:${newMode}`);
      deps.setLogTransport(newMode);
    }
  });
  SettingsManager.registerListener('logToUI', (newMode: boolean, oldMode: boolean) => {
    if (newMode !== oldMode) {
      logger.debug(`Setting Log to UI to Enabled:${newMode}`);
      deps.setupDebugLoggerHook(newMode);
    }
  });
}

export function registerRuntimeListeners(deps: RegisterRuntimeListenersDependencies) {
  const settings = SettingsManager.getAll();
  const state: ListenerState = {
    modReadingTimer: null,
    screenshotLock: false,
  };

  registerSearchBridge(deps);
  registerOcrListeners(deps, state, settings);
  registerRunAndStatsListeners(deps);
  registerShortcutSensitiveSettingListeners(deps.reregisterShortcuts);
  registerKillTrackerListeners(deps);
  registerRatesAndLogWatchers(deps);
  registerStashListeners(deps);
  registerSettingsListeners(deps);

  AuthManager.setMessenger(deps.mainWindow.webContents);
  RendererLogger.init(deps.mainWindow.webContents, deps.overlayWindow.webContents);
  deps.setupDebugLoggerHook(SettingsManager.get('logToUI'));
}
