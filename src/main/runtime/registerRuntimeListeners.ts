import { app, BrowserWindow, ipcMain, nativeImage } from 'electron';
import logger from 'electron-log';
import dayjs, { Dayjs } from 'dayjs';
import AuthManager from '../AuthManager';
import RendererLogger from '../RendererLogger';
import Utils from '../modules/Utils';
import { OverlayController } from 'electron-overlay-window';
import { rendererEventChannels, sendChannels } from '../../shared/contracts/exileDiaryApi';
import { createRuntimeCore, RuntimeCore } from '../runtime-core/RuntimeCore';
import { createOverlayPublisher } from '../runtime-core/services/createOverlayPublisher';
import { createRuntimeSidecarBridge, RuntimeSidecarBridge } from './createRuntimeSidecarBridge';
import { haveActiveProfilesChanged } from './haveActiveProfilesChanged';

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
  ocrHealthStatus: string | null;
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

function registerSearchBridge(
  { sendToMain }: Pick<RegisterRuntimeListenersDependencies, 'sendToMain'>,
  runtime: RuntimeCore | RuntimeSidecarBridge
) {
  runtime.search.registerMessageHandler((event, data) => {
    sendToMain(event, data);
  });
}

function registerOcrListeners(
  deps: RegisterRuntimeListenersDependencies,
  state: ListenerState,
  settings:
    | ReturnType<RuntimeCore['settings']['getAll']>
    | ReturnType<RuntimeSidecarBridge['settings']['getAll']>,
  runtime: RuntimeCore | RuntimeSidecarBridge,
  overlayPublisher: ReturnType<typeof createOverlayPublisher>
) {
  runtime.ocr.emitter.removeAllListeners();
  runtime.ocr.emitter.on('ocr:health-updated', (health) => {
    if (!health || state.ocrHealthStatus === health.status) {
      return;
    }

    state.ocrHealthStatus = health.status;
    logger.info('OCR sidecar health updated', health);

    if (health.status === 'degraded' || health.status === 'restarting') {
      overlayPublisher.log({
        messages: [
          {
            text:
              health.status === 'restarting'
                ? 'OCR worker is restarting after a health failure.'
                : 'OCR worker health check failed. Monitoring recovery.',
            type: 'error',
          },
        ],
      });
    }

    if (health.status === 'ready' && health.restartCount > 0) {
      overlayPublisher.log({
        messages: [{ text: 'OCR worker recovered and is ready again.' }],
      });
    }
  });
  runtime.ocr.emitter.on('OCRError', () => {
    logger.info('Error getting area info from screenshot. Please try again');
  });
  runtime.ocr.emitter.on('ocr:completed-job', async (info) => {
    logger.info('Got area info from OCR', info);
    const ocrResult = info.result;
    if (!ocrResult || ocrResult.status === 'error' || ocrResult.status === 'no-text') {
      overlayPublisher.log({
        messages: [
          {
            text:
              ocrResult?.status === 'no-text'
                ? 'No map mods were detected from the screenshot.'
                : 'OCR failed while reading map mods.',
            type: 'error',
          },
        ],
      });
      return;
    }

    if (ocrResult.status === 'low-confidence') {
      overlayPublisher.log({
        messages: [
          {
            text: `OCR matched map mods with low confidence (${Math.round(
              (ocrResult.diagnostics?.averageConfidence ?? 0) * 100
            )}%). ${
              ocrResult.diagnostics?.retryRecommended ? 'Retrying the read is recommended.' : ''
            }`,
            type: 'error',
          },
        ],
      });
    }

    const { level, name, depth } = runtime.runTracking.latestGeneratedArea;
    const tier = getMapTierString({ level });
    let stats = `IIR: ${info.mapStats.iir} / IIQ: ${info.mapStats.iiq}`;
    if (info.mapStats.pack_size && info.mapStats.pack_size > 0) {
      stats += ` / Pack Size: ${info.mapStats.pack_size}`;
    }

    const modReadingDuration = dayjs().diff(state.modReadingTimer);
    await runtime.runTracking.setCurrentMapStats({
      name,
      level,
      depth,
      ...info.mapStats,
    });
    logger.info(`Got area info for ${name} (${tier} - ${stats}) in ${modReadingDuration}ms`);
    overlayPublisher.log({
      messages: [
        { text: 'Got area info for ' },
        { text: name, type: 'important' },
        { text: ` (${tier} - ${stats})` },
      ],
    });
    runtime.runTracking.refreshTracking();
  });

  runtime.screenshots.emitter.removeAllListeners();
  runtime.screenshots.emitter.on('OCRStart', (screenshotStats) => {
    logger.info('Reading mods from screenshot');
    state.modReadingTimer = dayjs(screenshotStats.birthtime);
    logger.info(dayjs().diff(state.modReadingTimer));
  });
  runtime.screenshots.emitter.on('OCRError', () => {
    logger.info('Error getting area info from screenshot. Please try again');
  });
  runtime.screenshots.emitter.on('tooMuchScreenshotClutter', (totalSize) => {
    const dir = settings.screenshotDir.replace(/\\/g, '\\\\');
    logger.info(
      `Screenshot folder contains <span class='eventText'>${totalSize}</span> screenshots. Click <span class='eventText' style='cursor:pointer;' onclick='openShell("${dir}")'>here</span> to open it for cleanup`
    );
  });
  runtime.screenshots.emitter.on(
    'screenshot:capture',
    async (payload?: { trigger?: 'manual' | 'map-enter' | 'retry' }) => {
      if (state.screenshotLock) {
        logger.info('Not accepting new screenshot orders while this screenshot is being parsed');
        return;
      }

      state.modReadingTimer = dayjs();
      state.screenshotLock = true;
      logger.info('Map Info : Reading from screenshot');
      overlayPublisher.log({
        messages: [{ text: 'Map Info : Reading from screenshot' }],
      });

      deps.overlayWindow.hide();
      const captureStartedAt = performance.now();
      const screenshot = OverlayController.screenshot();
      deps.overlayWindow.show();
      const { width, height } = OverlayController.targetBounds;
      const nativeScreenshot = nativeImage
        .createFromBitmap(screenshot, { width, height })
        .toJPEG(100);
      const captureMs = performance.now() - captureStartedAt;

      try {
        await runtime.screenshots.process(nativeScreenshot, {
          trigger: payload?.trigger ?? 'manual',
          captureMs,
        });
      } catch (error) {
        logger.error('Error in screenshot processing', error);
        overlayPublisher.log({
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
    }
  );
  runtime.screenshots.emitter.on('screenshot:timeout', async () => {
    logger.info('Map Info : Reading from screenshot timed out');
    overlayPublisher.log({
      messages: [{ text: 'Map Info : Reading from screenshot timed out', type: 'error' }],
    });
    state.screenshotLock = false;
  });
}

function registerRunAndStatsListeners(
  deps: RegisterRuntimeListenersDependencies,
  runtime: RuntimeCore | RuntimeSidecarBridge,
  overlayPublisher: ReturnType<typeof createOverlayPublisher>
) {
  runtime.stats.registerProfitPerHourAnnouncer((profitPerHour, divinePrice) => {
    overlayPublisher.publishToMain(rendererEventChannels.updateProfitPerHour, {
      profitPerHour,
      divinePrice,
    });
  });

  runtime.runTracking.emitter.removeAllListeners();
  runtime.runTracking.refreshTracking();
  runtime.runTracking.emitter.on('run-parser:latest-area-updated', (area) => {
    logger.info('Latest area updated:', area);
    const runState = buildRunState(area);
    overlayPublisher.publishToBoth(rendererEventChannels.currentRunStarted, runState);
    overlayPublisher.publishToMain(rendererEventChannels.refreshRuns);
  });
  runtime.runTracking.emitter.on('run-parser:run-processed', async (run) => {
    const formatter = new Intl.NumberFormat();
    const divinePrice = await runtime.pricing.getCurrencyByName('Divine Orb');
    logger.info(
      `Completed run in ${run.name} ` +
        `(${(Utils.getRunningTime(run.firstEvent, run.lastEvent), 'mm:ss')}` +
        (run.gained ? `, ${run.gained} chaos orbs` : '') +
        (run.kills ? `, ${formatter.format(run.kills)} kills` : '') +
        (run.xp ? `, ${formatter.format(run.xp)} XP` : '') +
        `)`
    );
    overlayPublisher.log({
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
    runtime.runTracking.refreshTracking();
    runtime.stats.triggerProfitPerHourAnnouncer();
  });
}

function registerShortcutSensitiveSettingListeners(
  reregisterShortcuts: () => void,
  runtime: RuntimeCore | RuntimeSidecarBridge
) {
  runtime.settings.registerListener('runParseScreenshotEnabled', () => reregisterShortcuts());
  runtime.settings.registerListener('screenshots', () => reregisterShortcuts());
  runtime.settings.registerListener('runParseShortcut', () => reregisterShortcuts());
  runtime.settings.registerListener('screenshotShortcut', () => reregisterShortcuts());
  runtime.settings.registerListener('overlayToggleShortcut', () => reregisterShortcuts());
  runtime.settings.registerListener('overlayMovementShortcut', () => reregisterShortcuts());
}

function registerKillTrackerListeners(
  deps: RegisterRuntimeListenersDependencies,
  runtime: RuntimeCore | RuntimeSidecarBridge,
  overlayPublisher: ReturnType<typeof createOverlayPublisher>
) {
  const { emitter } = runtime.killTracker;
  emitter.removeAllListeners();
  emitter.on('incubatorsUpdated', (incubators) => {
    overlayPublisher.publishToBoth('incubatorsUpdated', incubators);
  });
  emitter.on('incubatorsMissing', (equipments) => {
    if (!equipments.length) {
      return;
    }

    overlayPublisher.log({
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

function registerRatesAndLogWatchers(
  runtime: RuntimeCore | RuntimeSidecarBridge,
  overlayPublisher: ReturnType<typeof createOverlayPublisher>
) {
  runtime.rates.removeAllListeners();
  runtime.rates.on('gettingPrices', () => {
    logger.info("<span class='eventText'>Getting item prices from poe.ninja...</span>");
  });
  runtime.rates.on('doneGettingPrices', () => {
    runtime.pricing.updateRates();
    logger.info("<span class='eventText'>Finished getting item prices from poe.ninja</span>");
  });
  runtime.rates.on('gettingPricesFailed', () => {
    logger.info(
      "<span class='eventText removeRow' onclick='rateGetterRetry(this);'>Error getting item prices from poe.ninja, <span class='retry'>click on this message to try again</span></span>"
    );
  });
  runtime.rates.on('pricesUpdated', (payload) => {
    overlayPublisher.publishToMain(rendererEventChannels.pricesUpdated, payload);
  });

  runtime.clientLogs.emitter.removeAllListeners();
  runtime.clientLogs.emitter.on('clientTxtFileError', (clientPath) => {
    logger.info(`Error reading ${clientPath}. Please check if the file exists.`);
    overlayPublisher.log({
      messages: [{ text: `Error reading ${clientPath}. Please check if the file exists.` }],
    });
  });
  runtime.clientLogs.emitter.on('clientTxtNotUpdated', (clientPath) => {
    logger.info(
      `<span class='eventText'>${clientPath} has not been updated recently even though the game is running. Please check if PoE is using a different Client.txt file.</span>`
    );
  });

  runtime.logIngest.emitter.removeAllListeners();
  runtime.logIngest.emitter.on('client-logs:error:local-chat-disabled', () => {
    logger.info('Unable to track area changes. Please check if local chat is enabled.');
  });
  runtime.logIngest.emitter.on(
    'client-logs:generated-run',
    async ({ areaId, areaName, level, seed }) => {
      logger.info(
        `Generated run ${areaName} (${areaId}) (lvl${level}) (${seed}) - Latest: ${runtime.runTracking.latestGeneratedArea.seed}`
      );
      runtime.runTracking.refreshTracking();
    }
  );
  runtime.logIngest.emitter.on('client-logs:entered-map', async ({ area }) => {
    logger.info('Entered map ' + area);
    const hasStarted = await runtime.runTracking.tryUpdateCurrentArea();
    if (hasStarted) {
      runtime.runTracking.refreshTracking();
    }

    const settings = runtime.settings.getAll();
    if (settings.autoScreenshotOnMapEntry?.enabled && hasStarted) {
      const delay = (settings.autoScreenshotOnMapEntry.delay || 2) * 1000;
      logger.info(`Auto-screenshot scheduled for ${area} in ${delay}ms`);

      setTimeout(() => {
        logger.info(`Triggering auto-screenshot for ${area}`);
        runtime.screenshots.emitter.emit('screenshot:capture', { trigger: 'map-enter' });
      }, delay);
    }
  });
}

function registerStashListeners(
  deps: RegisterRuntimeListenersDependencies,
  runtime: RuntimeCore | RuntimeSidecarBridge,
  overlayPublisher: ReturnType<typeof createOverlayPublisher>
) {
  runtime.stash.removeAllListeners();
  runtime.stash.initialize();
  runtime.stash.on('stashTabs:updated:full', (data) => {
    logger.info(`Updated stash tabs (League: ${data.league} - Change: ${data.change})`);
    overlayPublisher.publishToMain(rendererEventChannels.stashTabsUpdated, data);
  });
  runtime.stash.on('netWorthUpdated', async (data) => {
    const divinePrice = await runtime.pricing.getCurrencyByName('Divine Orb');
    overlayPublisher.publishToMain(rendererEventChannels.updateNetWorth, {
      divinePrice,
      ...data,
    });
  });
  ipcMain.on(sendChannels.requestNetWorthRefresh, () => {
    runtime.stash.getNetWorth();
  });
}

function registerSettingsListeners(
  deps: RegisterRuntimeListenersDependencies,
  runtime: RuntimeCore | RuntimeSidecarBridge,
  overlayPublisher: ReturnType<typeof createOverlayPublisher>
) {
  runtime.settings.registerListener('filters', (settings) => {
    deps.sendToMain(rendererEventChannels.settingsFiltersUpdated, settings);
  });
  runtime.settings.registerListener('overlayPersistenceEnabled', (isOverlayEnabled) => {
    logger.debug(`Setting Overlay Persistence to Enabled:${isOverlayEnabled}`);
    deps.sendToOverlay(rendererEventChannels.overlaySetPersistence, isOverlayEnabled);
    deps.sendToMain(rendererEventChannels.settingsOverlayPersistenceChanged, isOverlayEnabled);
  });
  runtime.settings.registerListener('enableAutoscroll', (enableAutoscroll: boolean) => {
    deps.sendToMain(rendererEventChannels.settingsAutoscrollUpdated, enableAutoscroll);
  });
  runtime.settings.registerListener('activeProfile', (newProfile, oldProfile) => {
    if (haveActiveProfilesChanged(newProfile, oldProfile)) {
      logger.debug('Active profile changed, relaunching the app');
      setTimeout(() => {
        overlayPublisher.log({
          messages: [
            {
              text: 'Active profile changed, relaunching the app to load data for the new profile when the settings finish saving in a few seconds...',
            },
          ],
        });
      }, 1000);
      runtime.settings
        .waitForSave()
        .then(() => {
          app.relaunch();
          app.quit();
        })
        .catch((error) => {
          logger.error('Error waiting for settings save', error);
        });
    }
  });
  runtime.settings.registerListener('forceDebugMode', (newMode: boolean, oldMode: boolean) => {
    if (newMode !== oldMode) {
      logger.debug(`Setting Debug Mode to Enabled:${newMode}`);
      deps.setLogTransport(newMode);
    }
  });
  runtime.settings.registerListener('logToUI', (newMode: boolean, oldMode: boolean) => {
    if (newMode !== oldMode) {
      logger.debug(`Setting Log to UI to Enabled:${newMode}`);
      deps.setupDebugLoggerHook(newMode);
    }
  });
}

export function registerRuntimeListeners(
  deps: RegisterRuntimeListenersDependencies,
  runtime: RuntimeCore | RuntimeSidecarBridge = createRuntimeSidecarBridge()
) {
  const settings = runtime.settings.getAll();
  const state: ListenerState = {
    modReadingTimer: null,
    screenshotLock: false,
    ocrHealthStatus: null,
  };
  const overlayPublisher = createOverlayPublisher({
    sendToMain: deps.sendToMain,
    sendToOverlay: deps.sendToOverlay,
    rendererLogger: RendererLogger,
  });

  registerSearchBridge(deps, runtime);
  registerOcrListeners(deps, state, settings, runtime, overlayPublisher);
  registerRunAndStatsListeners(deps, runtime, overlayPublisher);
  registerShortcutSensitiveSettingListeners(deps.reregisterShortcuts, runtime);
  registerKillTrackerListeners(deps, runtime, overlayPublisher);
  registerRatesAndLogWatchers(runtime, overlayPublisher);
  registerStashListeners(deps, runtime, overlayPublisher);
  registerSettingsListeners(deps, runtime, overlayPublisher);

  AuthManager.setMessenger(deps.mainWindow.webContents);
  RendererLogger.init(deps.mainWindow.webContents, deps.overlayWindow.webContents);
  deps.setupDebugLoggerHook(runtime.settings.get('logToUI'));
}
