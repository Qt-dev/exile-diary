import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Menu,
  session,
  globalShortcut,
  nativeImage,
  screen,
} from 'electron';
import chokidar from 'chokidar';
import { spawn } from 'child_process';

import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import logger from 'electron-log';
import Responder from './Responder';
import SettingsManager from './SettingsManager';
import SearchManager from './SearchManager';
import GGGAPI from './GGGAPI';
import League from './db/league';
import ItemDB from './db/items';
import RendererLogger from './RendererLogger';
import * as url from 'url';
import { OverlayController, OVERLAY_WINDOW_OPTS } from 'electron-overlay-window';
import dayjs, { Dayjs } from 'dayjs';
import duration from 'dayjs/plugin/duration';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import AuthManager from './AuthManager';
import IgnoreManager from '../helpers/ignoreManager';
import LogProcessor from './modules/LogProcessor';

// Old stuff
import RateGetterV2 from './modules/RateGetterV2';
import Utils from './modules/Utils';
import ScreenshotWatcher from './modules/ImageParser/ScreenshotWatcher';
import * as ClientTxtWatcher from './modules/ClientTxtWatcher';
import * as OCRWatcher from './modules/ImageParser/OCRWatcher';
import StashGetter from './modules/StashGetter';
import RunParser from './modules/RunParser';
import KillTracker from './modules/KillTracker';
import StatsManager from './StatsManager';
import ItemPricer from './modules/ItemPricer';

dayjs.extend(duration);
dayjs.extend(isSameOrAfter);
const devUrl = 'http://localhost:3003';
enum SYSTEMS {
  WINDOWS = 'win32',
  LINUX = 'debian',
  MACOS = 'darwin',
}
const autoUpdaterIntervalTime = 1000 * 60 * 60; // 1 hour
const isDev = require('electron-is-dev') || SettingsManager.get('forceDebugMode');
let modReadingTimer: Dayjs | null = null;

function setLogTransport(debugMode) {
  logger.transports.console.level = debugMode ? 'debug' : 'info';
  logger.transports.file.level = debugMode ? 'debug' : 'info';
}

// Initialize logger settings
logger.initialize({ preload: true });
setLogTransport(isDev || SettingsManager.get('forceDebugMode'));
logger.scope.defaultLabel = 'main';
logger.errorHandler.startCatching({
  showDialog: false,
  onError({ createIssue, error, processType, versions }) {
    if (processType === 'renderer') {
      return;
    }

    dialog
      .showMessageBox({
        title: 'An error occurred',
        message: error.message,
        detail: error.stack,
        type: 'error',
        buttons: ['Ignore', 'Report', 'Exit'],
      })
      .then((result) => {
        if (result.response === 1) {
          createIssue('https://github.com/qt-dev/exile-diary/issues/new', {
            title: `${error.message} - Error report for ${versions.app}`,
            body:
              'Error:\n```\n' +
              error.stack +
              '\n```\n' +
              `OS: ${versions.os}` +
              `\nApp: ${versions.app}`,
          });
          return;
        }

        if (result.response === 2) {
          app.quit();
        }
      });
  },
});

const getMapTierString = (map) => {
  if (map.depth) {
    return `D${map.depth}`;
  } else if (map.level) {
    return map.level <= 67 ? `L${map.level}` : `T${map.level - 67}`;
  } else {
    return '';
  }
};

class MainProcess {
  mainWindow: BrowserWindow;
  overlayWindow: BrowserWindow;
  isDownloadingUpdate: boolean;
  autoUpdaterInterval?: NodeJS.Timeout;
  saveBoundsCallback?: NodeJS.Timeout;
  awaitingMapEntering: boolean = false;
  screenshotLock: boolean = false;
  isOverlayMoveable: boolean;

  constructor() {
    this.mainWindow = new BrowserWindow({
      title: `Exile Diary v${app.getVersion()}`,
      webPreferences: {
        nodeIntegration: true,
        nodeIntegrationInWorker: true,
        contextIsolation: false,
        webSecurity: false,
      },
      show: false,
    });

    this.overlayWindow = new BrowserWindow({
      x: 0,
      y: 100,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
      focusable: false,
      ...OVERLAY_WINDOW_OPTS,
    });
    this.isDownloadingUpdate = false;
    this.isOverlayMoveable = false;
  }

  async init() {
    logger.info('Initializing components');

    // Settings
    await SettingsManager.initialize();
    if (!SettingsManager.get('username')) {
      logger.error('No account name set. Please set your account name in the settings.');
    } else {
      const character = await SettingsManager.getCharacter();
      try {
        await SettingsManager.initializeDB(character.name);
        await League.addLeague(character.league);
        logger.info(`DB initialized. Character: ${character.name}, League: ${character.league}`);
      } catch (e) {
        logger.error(`Could not set DB up. (Current Account: ${SettingsManager.get('username')}})`);
        logger.error(e);
      }
    }

    if (SettingsManager.get('activeProfile') && SettingsManager.get('activeProfile').valid) {
      logger.info('Starting components');
      RateGetterV2.initialize({
        postUpdateCallback: async () => {
          RendererLogger.log({
            messages: [{ text: "Today's prices have been updated" }],
          });
          const prices = (await ItemDB.getAllItemsValues()).reduce(
            (aggregations, { id, value }) => {
              aggregations[id] = value;
              return aggregations;
            },
            {}
          );
          this.sendToMain('prices:updated', { prices });
        },
      });
      ClientTxtWatcher.start();

      SettingsManager.unregisterListener('filters');
      SettingsManager.registerListener('filters', async (settings) => {
        this.sendToMain('settings:filters:updated', settings);
      });
      ScreenshotWatcher.start();
      OCRWatcher.start();
      // ItemFilter.load(); not working yet
    }

    IgnoreManager.initialize(logger, () => {
      logger.debug('Backend ignore settings updated');
    });
  }

  sendToOverlay(event: string, data?: any) {
    if (this.overlayWindow.isDestroyed()) {
      logger.error('Overlay window is destroyed, cannot send message');
    } else {
      this.overlayWindow.webContents.send(event, data);
    }
  }

  sendToMain(event: string, data?: any) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send(event, data);
    }
  }

  /**
   * Handles the auto updater process (checking for updates, downloading and installing them)
   */
  handleAutoUpdater() {
    ipcMain.on('before-quit-for-update', (event) => {
      logger.info('Closing the overlay for the update restart');
      this.overlayWindow.destroy();
    });
    ipcMain.on('download-update', (event) => {
      if (!this.isDownloadingUpdate) {
        this.isDownloadingUpdate = true;
        RendererLogger.log({
          messages: [{ text: 'Downloading update...' }],
        });
        logger.info('Now downloading update');
        autoUpdater.downloadUpdate();
      }
    });
    ipcMain.on('apply-update', (event) => {
      logger.info('Restarting to apply update');
      autoUpdater.quitAndInstall();
    });

    autoUpdater.channel = 'latest';
    autoUpdater.logger = logger;
    autoUpdater.autoDownload = false;
    autoUpdater.on('update-available', (info) => {
      global.updateInfo = info;
      logger.info('Fetched Update Info:', JSON.stringify(info));
      RendererLogger.log({
        messages: [
          {
            text: `An update to version ${info.version} is available, click here to download`,
            linkEvent: 'download-update',
          },
        ],
      });
    });
    autoUpdater.on('update-downloaded', (info) => {
      RendererLogger.log({
        messages: [
          {
            text: `Update to version ${info.version} has been downloaded, click here to install it now (requires restart)`,
            linkEvent: 'apply-update',
          },
        ],
      });
    });

    autoUpdater
      .checkForUpdates()
      .then((result) => {
        const msg = `Update check done. ${
          !!result ? `Update ${result.updateInfo.releaseName} is available` : 'No Update available'
        }:`;
        logger.info(msg);
        this.autoUpdaterInterval = setInterval(() => {
          autoUpdater
            .checkForUpdates()
            .then((result) => {
              logger.info(msg);
            })
            .catch((err) => {
              logger.error('Error checking for updates', err);
            });
        }, autoUpdaterIntervalTime);
      })
      .catch((err) => {
        logger.error('Error checking for updates', err);
      });
  }

  /**
   * Sets up the listeners for the all the old modules
   */
  setupListeners() {
    const settings = SettingsManager.getAll();

    ipcMain.on('reload-app', () => {
      app.relaunch();
      app.exit();
    });

    ipcMain.on('settings:filters:ui-updated', () => {
      this.sendToMain('items:filters:update');
    });
    ipcMain.on('ui:refresh', () => {
      this.refreshWindows();
    });

    SearchManager.registerMessageHandler((event, data) => {
      this.sendToMain(event, data);
    });

    OCRWatcher.emitter.removeAllListeners();
    OCRWatcher.emitter.on('OCRError', () => {
      logger.info('Error getting area info from screenshot. Please try again');
    });
    OCRWatcher.emitter.on('ocr:completed-job', async (info) => {
      logger.info('Got area info from OCR', info);
      const { level, name, depth } = RunParser.latestGeneratedArea;
      const tier = getMapTierString({ level });
      let stats = `IIR: ${info.mapStats.iir} / IIQ: ${info.mapStats.iiq}`;
      if (info.mapStats.pack_size && info.mapStats.pack_size > 0)
        stats += ` / Pack Size: ${info.mapStats.pack_size}`;
      const modReadingDuration = dayjs().diff(modReadingTimer);
      await RunParser.setCurrentMapStats({
        name,
        level,
        depth,
        ...info.mapStats,
      });
      logger.info(`Got area info for ${name} (${tier} - ${stats}) in ${modReadingDuration}ms`);
      RendererLogger.log({
        messages: [
          {
            text: 'Got area info for ',
          },
          {
            text: name,
            type: 'important',
          },
          {
            text: ` (${tier} - ${stats})`,
          },
        ],
      });
      RunParser.refreshTracking();
      // this.sendToOverlay('current-run:info', {
      //   name,
      //   level,
      //   ...info.mapStats,
      // });
    });

    ScreenshotWatcher.emitter.removeAllListeners();
    ScreenshotWatcher.emitter.on('OCRStart', (stats) => {
      logger.info('Reading mods from screenshot');
      modReadingTimer = dayjs(stats.birthtime);
      logger.info(dayjs().diff(modReadingTimer));
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
    ScreenshotWatcher.emitter.on('screenshot:capture', async (info) => {
      if (this.screenshotLock) {
        logger.info('Not accepting new screenshot orders while this screenshot is being parsed');
        return;
      } else {
        modReadingTimer = dayjs();
        this.screenshotLock = true;
        logger.info('Map Info : Reading from screenshot');
        RendererLogger.log({
          messages: [
            {
              text: 'Map Info : Reading from screenshot',
            },
          ],
        });
        this.overlayWindow.hide();
        const screenshot = OverlayController.screenshot();
        this.overlayWindow.show();
        const { width, height } = OverlayController.targetBounds;
        const nativeScreenshot = nativeImage
          .createFromBitmap(screenshot, { width: width, height: height })
          .toJPEG(100);
        try {
          await ScreenshotWatcher.process(nativeScreenshot);
        } catch (e) {
          logger.error('Error in screenshot processing', e);
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
        this.screenshotLock = false;
      }
    });
    ScreenshotWatcher.emitter.on('screenshot:timeout', async () => {
      logger.info('Map Info : Reading from screenshot timed out');
      RendererLogger.log({
        messages: [
          {
            text: 'Map Info : Reading from screenshot timed out',
            type: 'error',
          },
        ],
      });
      this.screenshotLock = false;
    });

    StatsManager.registerProfitPerHourAnnouncer((profitPerHour, divinePrice) => {
      this.sendToMain('update-profit-per-hour', { profitPerHour, divinePrice });
    });

    RunParser.emitter.removeAllListeners();
    RunParser.refreshTracking();
    RunParser.emitter.on('run-parser:latest-area-updated', (area) => {
      logger.info('Latest area updated:', area);
      this.sendToMain('current-run:started', {
        area: area.name,
        level: area.level,
        iir: area.iir > 0 ? area.iir : null,
        pack_size: area.pack_size > 0 ? area.pack_size : null,
        iiq: area.iiq > 0 ? area.iiq : null,
      });
      this.sendToOverlay('current-run:started', {
        area: area.name,
        level: area.level,
        iir: area.iir > 0 ? area.iir : null,
        pack_size: area.pack_size > 0 ? area.pack_size : null,
        iiq: area.iiq > 0 ? area.iiq : null,
      });
      this.sendToMain('refresh-runs');
    });
    RunParser.emitter.on('run-parser:run-processed', async (run) => {
      const f = new Intl.NumberFormat();
      const divinePrice = await ItemPricer.getCurrencyByName('Divine Orb');
      logger.info(
        `Completed run in ${run.name} ` +
          `(${(Utils.getRunningTime(run.firstEvent, run.lastEvent), 'mm:ss')}` +
          (run.gained ? `, ${run.gained} chaos orbs` : '') +
          (run.kills ? `, ${f.format(run.kills)} kills` : '') +
          (run.xp ? `, ${f.format(run.xp)} XP` : '') +
          `)`
      );
      RendererLogger.log({
        messages: [
          {
            text: 'Completed run in ',
          },
          {
            text: run.name,
            type: 'important',
            link: `run/${run.id}`,
          },
          {
            text: ` (${Utils.getRunningTime(run.firstEvent, run.lastEvent)}, `,
          },
          {
            text: '',
            price: run.gained,
            divinePrice,
            type: 'currency',
          },
          {
            text: run.kills ? `, ${f.format(run.kills)} kills` : '',
          },
          {
            text: run.xp ? `, ${f.format(run.xp)} XP` : '',
          },
          {
            text: ')',
          },
        ],
      });
      RunParser.refreshTracking();
      StatsManager.triggerProfitPerHourAnnouncer();
    });
    RunParser.toggleRunParseShortcut(SettingsManager.get('runParseScreenshotEnabled'));
    SettingsManager.registerListener('runParseScreenshotEnabled', (enabled) => {
      RunParser.toggleRunParseShortcut(enabled);
    });

    KillTracker.emitter.removeAllListeners();
    KillTracker.emitter.on('incubatorsUpdated', (incubators) => {
      this.sendToMain('incubatorsUpdated', incubators);
      this.sendToOverlay('incubatorsUpdated', incubators);
    });
    KillTracker.emitter.on('incubatorsMissing', (equipments) => {
      if (equipments.length) {
        RendererLogger.log({
          messages: [
            {
              text: `Following equipment has incubator missing: `,
            },
            ...equipments.map(([name, icon]) => ({
              text: name,
              type: 'important',
              icon: icon,
            })),
          ],
        });
      }
    });

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
    ClientTxtWatcher.emitter.on('switchedCharacter', async (c) => {
      // this.sendToMain('refresh-settings');
    });
    ClientTxtWatcher.emitter.on('clientTxtFileError', (path) => {
      logger.info(`Error reading ${path}. Please check if the file exists.`);
      RendererLogger.log({
        messages: [
          {
            text: `Error reading ${path}. Please check if the file exists.`,
          },
        ],
      });
    });
    ClientTxtWatcher.emitter.on('clientTxtNotUpdated', (path) => {
      logger.info(
        `<span class='eventText'>${path} has not been updated recently even though the game is running. Please check if PoE is using a different Client.txt file.</span>`
      );
    });

    LogProcessor.emitter.removeAllListeners();
    LogProcessor.emitter.on('client-logs:error:local-chat-disabled', () => {
      logger.info('Unable to track area changes. Please check if local chat is enabled.');
    });
    LogProcessor.emitter.on(
      'client-logs:generated-run',
      async ({ areaId, areaName, level, seed, runId }) => {
        logger.info(
          `Generated run ${areaName} (${areaId}) (lvl${level}) (${seed}) - Latest: ${RunParser.latestGeneratedArea.seed}`
        );
        RunParser.refreshTracking();
      }
    );
    LogProcessor.emitter.on('client-logs:entered-map', async ({ area }) => {
      logger.info('Entered map ' + area);
      const hasStarted = await RunParser.tryUpdateCurrentArea();
      if (hasStarted) {
        RunParser.refreshTracking();
      }
    });

    StashGetter.removeAllListeners();
    StashGetter.initialize();
    StashGetter.on('stashTabs:updated:full', (data) => {
      logger.info(`Updated stash tabs (League: ${data.league} - Change: ${data.change})`);
      this.sendToMain('stashTabs:frontend:update', data);
    });
    StashGetter.on('netWorthUpdated', async (data) => {
      const divinePrice = await ItemPricer.getCurrencyByName('Divine Orb');
      this.sendToMain('update-net-worth', { divinePrice, ...data });
    });
    ipcMain.on('get-net-worth', () => {
      StashGetter.getNetWorth();
    });
    SettingsManager.registerListener('overlayPersistenceEnabled', (isOverlayEnabled) => {
      logger.debug(`Setting Overlay Persistence to Enabled:${isOverlayEnabled}`);
      this.sendToOverlay('overlay:set-persistence', isOverlayEnabled);
    });
    SettingsManager.registerListener('activeProfile', (newProfile, oldProfile) => {
      if (
        newProfile.characterName !== oldProfile.characterName ||
        newProfile.league !== oldProfile.league
      ) {
        logger.debug('Active profile changed, relaunching the app');
        // We are delaying the message to make sure it shows above the Settings saved message
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
          .catch((e) => {
            logger.error('Error waiting for settings save', e);
          });
      }
    });

    SettingsManager.registerListener('forceDebugMode', (newMode: boolean, oldMode: boolean) => {
      if (newMode !== oldMode) {
        logger.debug(`Setting Debug Mode to Enabled:${newMode}`);
        setLogTransport(newMode);
      }
    });

    AuthManager.setMessenger(this.mainWindow.webContents);
    RendererLogger.init(this.mainWindow.webContents, this.overlayWindow.webContents);
  }

  /**
   * Sets up the resizer for the main window
   */
  setupResizer() {
    const settings = SettingsManager.getAll();

    const saveWindowBounds = () => {
      const bounds = this.mainWindow.getBounds();
      const { width } = bounds;

      // We do not want to save the settings on every single ping, so we work with a timeout
      if (this.saveBoundsCallback) clearTimeout(this.saveBoundsCallback);
      this.saveBoundsCallback = setTimeout(() => {
        SettingsManager.set('mainWindowBounds', bounds);
        logger.info('saving bounds', bounds);
        // Set min width to 1100
        this.sendToMain('rescale', Math.min(width, 1100) / 1100);
      }, 1000);
    };

    this.mainWindow.on('resize', saveWindowBounds);
    this.mainWindow.on('move', saveWindowBounds);

    if (settings && settings.mainWindowBounds) {
      logger.info('loading with bounds', settings.mainWindowBounds);
      this.mainWindow.setBounds(settings.mainWindowBounds);

      // Electron has a long standing bug where it does not properly restore the window size on
      // multi monitor setups with different scaling factors
      // https://github.com/electron/electron/issues/10862
      // We work around this by checking if the scaling factors are different and if so, we set the bounds again
      const displays = screen.getAllDisplays();
      if (displays.length > 1 && displays[0].scaleFactor != displays[1].scaleFactor) {
        this.mainWindow.setBounds(settings.mainWindowBounds);
      }
    } else {
      this.mainWindow.maximize();
    }
  }

  setWindowListeners() {
    let isOverlayInitialized = false;

    // Main Window listeners
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      logger.info('App is ready to show');
      RendererLogger.log({
        messages: [
          {
            text: 'Exile Diary Reborn ',
          },
          {
            text: `v${app.getVersion()}`,
            type: 'important',
          },
          {
            text: ' started.',
          },
        ],
      });
      logger.info('This app is NOT affiliated with or endorsed by Grinding Gear Games in any way.');
      RendererLogger.log({
        messages: [
          {
            text: 'This app is ',
          },
          {
            text: 'NOT',
            type: 'error',
          },
          {
            text: ' affiliated with or endorsed by ',
          },
          {
            text: 'Grinding Gear Games',
            type: 'currency',
          },
          {
            text: ' in any way.',
          },
        ],
      });
      AuthManager.setLogoutTimer();
    });

    this.mainWindow.on('close', () => {
      logger.info('Main window is closing, closing all the windows');
      clearInterval(this.autoUpdaterInterval);
      clearTimeout(this.saveBoundsCallback);
      this.overlayWindow.destroy();
    });

    // OverlayController listeners
    OverlayController.events.on('attach', (event) => {
      logger.info('Overlay attached to Path of Exile process');
      RunParser.refreshTracking();
      this.overlayWindow.setBounds(OverlayController.targetBounds);
      this.sendToOverlay('overlay:trigger-reposition');
    });

    OverlayController.events.on('moveresize', (event) => {
      // OverlayController resizes the overlay window when the target changes. So we tell our app to reset the size to what it should be.
      this.overlayWindow.setBounds(OverlayController.targetBounds);
      this.sendToOverlay('overlay:trigger-reposition');
    });

    OverlayController.events.on('blur', () => {
      this.overlayWindow.hide();
      this.overlayWindow.setIgnoreMouseEvents(true);
    });

    OverlayController.events.on('focus', () => {
      logger.info(
        `Overlay controller focused, enabled:${SettingsManager.get(
          'overlayEnabled'
        )}, persistenceEnabled:${SettingsManager.get('overlayPersistenceEnabled')}`
      );
      if (SettingsManager.get('overlayEnabled') === true) {
        this.overlayWindow.show();
      }
      this.overlayWindow.setIgnoreMouseEvents(!this.isOverlayMoveable);
    });

    OverlayController.events.on('moveresize', (event) => {
      // OverlayController resizes the overlay window when the target changes. So we tell our app to reset the size to what it should be.
      // https://github.com/SnosMe/electron-overlay-window/blob/28261ce92633292c9accd8e185174489311f0b1f/src/index.ts#L109
      this.sendToOverlay('overlay:trigger-reposition');
    });

    // OverlayWindow listeners
    this.overlayWindow.on('blur', () => {
      if (!OverlayController.targetHasFocus) {
        this.overlayWindow.hide();
      }
    });

    this.overlayWindow.on('show', () => {
      this.sendToOverlay('overlay:trigger-reposition');
    });

    this.overlayWindow.on('close', (event) => {
      logger.info('Closing the overlay');
    });

    this.overlayWindow.once('closed', () => {
      logger.error('Overlay closed, it could be an issue');
      RendererLogger.log({
        messages: [
          {
            text: 'Overlay was destroyed, reloading the app properly.',
            type: 'error',
          },
          {
            text: 'Click here to restart.',
            type: 'error',
            linkEvent: 'reload-app',
          },
        ],
      });
    });

    this.overlayWindow.on('ready-to-show', () => {
      if (!isOverlayInitialized) {
        logger.info('Overlay is ready to show, attaching it to PoE');
        OverlayController.attachByTitle(this.overlayWindow, 'Path of Exile');
        isOverlayInitialized = true;
      } else {
        logger.info('Overlay is ready to show, but it is already initialized');
      }
    });

    ipcMain.on('overlay:make-clickable', (event, { clickable }) => {
      this.overlayWindow.setIgnoreMouseEvents(!clickable);
    });

    ipcMain.handle('overlay:get-position', (event) => {
      return SettingsManager.get('overlayPosition');
    });

    ipcMain.on('overlay:set-position', (event, { x, y }) => {
      SettingsManager.set('overlayPosition', { x, y });
    });

    app.on('will-quit', () => {
      logger.info('Exile Diary Reborn is closing');
      clearTimeout(this.saveBoundsCallback);
      clearTimeout(this.autoUpdaterInterval);
    });

    globalShortcut.register('CommandOrControl+F7', () => {
      logger.info('Toggling overlay visibility');
      const overlayPersistenceEnabled = SettingsManager.get('overlayPersistenceEnabled');
      SettingsManager.set('overlayPersistenceEnabled', !overlayPersistenceEnabled);
    });

    globalShortcut.register('CommandOrControl+F9', () => {
      logger.info(`Toggling overlay movement - ${this.isOverlayMoveable}`);
      this.isOverlayMoveable = !this.isOverlayMoveable;
      this.sendToOverlay('overlay:toggle-movement', { isOverlayMoveable: this.isOverlayMoveable });
    });
  }

  refreshWindows() {
    // Log before and after refresh
    RendererLogger.log({
      messages: [
        {
          text: 'Refreshing the UI...',
        },
      ],
    });
    this.mainWindow.reload();
    this.overlayWindow.reload();
    this.mainWindow.webContents.once('dom-ready', () => {
      RendererLogger.logLatestMessages();
      RendererLogger.log({
        messages: [
          {
            text: 'UI has been refreshed.',
          },
        ],
      });
    });
  }

  async startWindows() {
    logger.info(`Starting Exile Diary Reborn v${app.getVersion()}`);
    // Initialize messages for the main window

    await this.init();

    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('exile-diary', process.execPath, [
          path.resolve(process.argv[1]),
        ]);
      }
    } else {
      app.setAsDefaultProtocolClient('exile-diary');
    }

    const events = [
      'app-globals',
      'load-runs',
      'load-run',
      'load-run-details',
      'get-settings',
      'get-characters',
      'save-settings',
      'oauth:get-info',
      'oauth:is-authenticated',
      'oauth:logout',
      'get-all-stats',
      'get-stash-tabs',
      'save-settings:stashtabs',
      'save-settings:stash-refresh-interval',
      'save-settings:filters',
      'search:trigger',
      'get-divine-price',
      'get-all-map-names',
      'get-all-possible-mods',
      'refresh-profit-per-hour',
      'debug:recheck-gain',
      'debug:fetch-rates',
      'debug:fetch-stash-tabs',
      'overlay:get-persistence',
      'items:filters:db-update',
    ];
    for (const event of events) {
      ipcMain.handle(event, Responder[event]);
    }

    this.handleAutoUpdater();
    this.setupListeners();
    this.setupResizer();

    const test = 2;

    // Restarter for development
    if (isDev) {
      const spawnApp = () => {
        const child = spawn(
          path.join(
            __dirname,
            '..',
            '..',
            'node_modules',
            '.bin',
            'electron' + (process.platform === SYSTEMS.WINDOWS ? '.cmd' : '')
          ),
          [app.getAppPath()],
          {
            detached: true,
            stdio: 'inherit',
            shell: true,
          }
        );
        child.unref();
        app.exit();
      };

      chokidar.watch(__dirname, {}).once('change', (filePath) => {
        logger.info(`File changed: ${filePath}, restarting the app...`);
        spawnApp();
      });
    }

    this.setWindowListeners();

    const poeAuthSession = session.fromPartition('persist:poeAuth');

    await poeAuthSession.cookies.set({
      url: 'https://exilediary.com',
      name: 'code_challenge',
      value: 'test',
      expirationDate: dayjs().add(1, 'week').unix(),
    });

    app.on('second-instance', (event, commandLine, workingDirectory) => {
      // Someone tried to run a second instance, we should focus our window.
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) this.mainWindow.restore();
        this.mainWindow.focus();
      }

      const callCommand = commandLine.pop();
      const params = new URLSearchParams(callCommand?.split('?')[1]);
      const code = params.get('code');
      const state = params.get('state');

      if (code && state && AuthManager.verifyState(state)) {
        logger.info('We got an access token from Lambda');
        AuthManager.getOauthToken(code)
          .then(AuthManager.saveToken)
          .then(async () => {
            const isAuthenticated = await AuthManager.isAuthenticated(true);
            if (isAuthenticated) {
              this.sendToMain('oauth:auth-success');
              const character = await GGGAPI.getCurrentCharacter();
              const activeProfile = SettingsManager.get('activeProfile');
              if (
                !activeProfile ||
                !activeProfile.valid ||
                !activeProfile.characterName ||
                !activeProfile.league
              ) {
                SettingsManager.set('activeProfile', {
                  characterName: character.name,
                  league: character.league,
                  valid: true,
                });
              }
            }
          });
      } else {
        logger.info('No access token from Lambda', code, state, AuthManager.getState());
        logger.info(callCommand);
        logger.info(commandLine);
      }
    });

    if (isDev) {
      this.mainWindow.loadURL(devUrl);
      this.overlayWindow.loadURL(`${devUrl}#/overlay`);
    } else {
      Menu.setApplicationMenu(null);
      const URL = url.pathToFileURL(path.join(__dirname, '..', 'index.html')).toString();
      this.mainWindow.loadURL(URL);
      this.overlayWindow.loadURL(`${URL}#/overlay`);
    }
  }
}

app.on('ready', () => {
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    logger.error('Exile Diary is already started, closing the new instance.');
    app.quit();
  } else {
    const mainProcess = new MainProcess();
    mainProcess.startWindows();
  }
});
