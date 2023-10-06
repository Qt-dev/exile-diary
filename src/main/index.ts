import { app, BrowserWindow, ipcMain, dialog, Menu, session, globalShortcut, nativeImage } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import logger from 'electron-log';
import Responder from './Responder';
import SettingsManager from './SettingsManager';
import GGGAPI from './GGGAPI';
import League from './db/league';
import RendererLogger from './RendererLogger';
import * as url from 'url';
import { OverlayController } from 'electron-overlay-window';

// Old stuff
import RateGetterV2 from './modules/RateGetterV2';
import Utils from './modules/Utils';
import ScreenshotWatcher from './modules/ScreenshotWatcher';
import * as ClientTxtWatcher from './modules/ClientTxtWatcher';
import * as OCRWatcher from './modules/OCRWatcher';
import StashGetter from './modules/StashGetter';
import RunParser from './modules/RunParser';
import KillTracker from './modules/KillTracker';
import moment from 'moment';
import AuthManager from './AuthManager';

const devUrl = 'http://localhost:3000';
enum SYSTEMS {
  WINDOWS = 'win32',
  LINUX = 'debian',
  MACOS = 'darwin',
}
const autoUpdaterIntervalTime = 1000 * 60 * 60; // 1 hour
const isDev = require('electron-is-dev');
let modReadingTimer : moment.Moment | null = null;

// Initialize logger settings
logger.initialize({ preload: true });
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
  latestGeneratedAreaLevel?: string;
  latestGeneratedAreaSeed?: string;
  awaitingMapEntering: boolean = false;
  screenshotLock: boolean = false;

  constructor() {
    this.mainWindow = new BrowserWindow({
      title: `Exile Diary v${app.getVersion()}`,
      webPreferences: {
        nodeIntegration: true,
        nodeIntegrationInWorker: true,
        contextIsolation: false,
        // webSecurity: false,
      },
      show: false,
    });

    this.overlayWindow = new BrowserWindow({
      x: 0,
      y: 100,
      frame: false,
      closable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      resizable: false,
      show: false,
      skipTaskbar: true,
      transparent: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });
    this.isDownloadingUpdate = false;
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
        League.addLeague(character.league);
        SettingsManager.initializeDB(character.name);
        logger.info(`DB updated. Character: ${character.name}, League: ${character.league}`);
      } catch (e) {
        logger.error(
          `Could not set DB up. (Current Account: ${SettingsManager.get('username')}})`
        );
        logger.error(e);
      }
    }

    if (SettingsManager.get('activeProfile') && SettingsManager.get('activeProfile').valid) {
      logger.info('Starting components');
      RateGetterV2.initialize();
      ClientTxtWatcher.start();
      await ScreenshotWatcher.start();
      OCRWatcher.start();
      // ItemFilter.load(); not working yet
    }
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

    autoUpdater.channel = 'alpha'; // TODO: change this when pushing to prod
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

    OCRWatcher.emitter.removeAllListeners();
    OCRWatcher.emitter.on('OCRError', () => {
      logger.info('Error getting area info from screenshot. Please try again');
    });
    OCRWatcher.emitter.on('areaInfoComplete', (info) => {
      const tier = getMapTierString({ level: parseInt(info.areaInfo.level) });
      let stats = `IIR: ${info.mapStats.iir} / IIQ: ${info.mapStats.iiq}`;
      if (info.mapStats.packsize && info.mapStats.packsize > 0)
        stats += ` / Pack Size: ${info.mapStats.packsize}`;
      const modReadingDuration = moment().diff(modReadingTimer);
      logger.info(`Got area info for ${info.areaInfo.name} (${tier} - ${stats}) in ${modReadingDuration}ms`);
      RendererLogger.log({
        messages: [
          {
            text: 'Got area info for ',
          },
          {
            text: info.areaInfo.name,
            type: 'important',
          },
          {
            text: ` (${tier} - ${stats})`,
          },
        ],
      });
      this.sendToOverlay('current-run:info', {
        name: info.areaInfo.name,
        level: info.areaInfo.level,
        ...info.mapStats,
      });
    });

    ScreenshotWatcher.emitter.removeAllListeners();
    ScreenshotWatcher.emitter.on('OCRStart', (stats) => {
      logger.info('Reading mods from screenshot');
      modReadingTimer = moment(stats.birthtime, moment.ISO_8601);
      logger.info(moment().diff(modReadingTimer));
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
      if(this.screenshotLock) {
        logger.info('Not accepting new screenshot orders while this screenshot is being parsed');
        return;
      } else {
        modReadingTimer = moment();
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
        const { width, height }  = OverlayController.targetBounds;
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

    RunParser.emitter.removeAllListeners();
    RunParser.emitter.on('runProcessed', (run) => {
      var f = new Intl.NumberFormat();
      logger.info(
        `<span style='cursor:pointer;' onclick='window.location.href="map.html?id=${run.id}";'>` +
          `Completed run in <span class='eventText'>${run.name}</span> ` +
          `(${Utils.getRunningTime(run.firstevent, run.lastevent)}` +
          (run.gained ? `, ${run.gained} <img src='res/img/c.png' class='currencyText'>` : '') +
          (run.kills ? `, ${f.format(run.kills)} kills` : '') +
          (run.xp ? `, ${f.format(run.xp)} XP` : '') +
          `)</span>`
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
            text: ` (${Utils.getRunningTime(run.firstevent, run.lastevent)}`,
          },
          {
            text: run.gained ? `, ${run.gained}c ` : '',
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
      this.sendToMain('refresh-runs');
      this.sendToMain('current-run:started', { area: 'Unknown' });
      this.sendToOverlay('current-run:started', { area: 'Unknown' });
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
      logger.info("<span class='eventText'>Finished getting item prices from poe.ninja</span>");
    });
    RateGetterV2.on('gettingPricesFailed', () => {
      logger.info(
        "<span class='eventText removeRow' onclick='rateGetterRetry(this);'>Error getting item prices from poe.ninja, <span class='retry'>click on this message to try again</span></span>"
      );
    });

    ClientTxtWatcher.emitter.removeAllListeners();
    ClientTxtWatcher.emitter.on('localChatDisabled', () => {
      logger.info(
        "<span class='eventText'>Unable to track area changes. Please check if local chat is enabled.</span>",
        true
      );
    });
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
    ClientTxtWatcher.emitter.on('generatedMap', ({ level, seed }) => {
      logger.info('Generated map ' + level + ' ' + seed, '-', this.latestGeneratedAreaSeed);
      this.awaitingMapEntering = (seed !== this.latestGeneratedAreaSeed) && seed !== '1';
      if(seed !== '1') {
        this.latestGeneratedAreaLevel = level;
        this.latestGeneratedAreaSeed = seed;
        RunParser.setLatestGeneratedArea({ level });
      }
    });
    ClientTxtWatcher.emitter.on('enteredMap', (area) => {
      logger.info('Entered map ' + area);
      if(this.awaitingMapEntering) {
        this.awaitingMapEntering = false;
        this.sendToMain('current-run:started', { area, level: this.latestGeneratedAreaLevel });
        this.sendToOverlay('current-run:started', { area, level: this.latestGeneratedAreaLevel });
      }
    });

    StashGetter.removeAllListeners();
    StashGetter.initialize();
    StashGetter.on('stashTabs:updated:full', (data) => {
      logger.info(`Updated stash tabs (League: ${data.league} - Change: ${data.change})`);
      this.sendToMain('update-stash-content', data);
    });
    StashGetter.on('netWorthUpdated', (data) => {
      this.sendToMain('update-net-worth', data);
    });
    ipcMain.on('get-net-worth', () => {
      StashGetter.getNetWorth();
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
    });

    OverlayController.events.on('blur', () => {
      if (!this.overlayWindow.isFocused()) {
        this.overlayWindow.hide();
      }
    });

    OverlayController.events.on('focus', () => {
      logger.info(`Overlay focused, ${SettingsManager.get('overlayEnabled')}`);
      if (SettingsManager.get('overlayEnabled') === true) {
        this.overlayWindow.show();
        this.overlayWindow.setIgnoreMouseEvents(false);
      } else {
        this.overlayWindow.hide();
        this.overlayWindow.setIgnoreMouseEvents(true);
      }
    });

    OverlayController.events.on('moveresize', (event) => {
      // OverlayController resizes the overlay window when the target changes. So we tell our app to reset the size to what it should be.
      // https://github.com/SnosMe/electron-overlay-window/blob/28261ce92633292c9accd8e185174489311f0b1f/src/index.ts#L109
      this.sendToOverlay('overlay:trigger-resize');
    });

    // OverlayWindow listeners
    this.overlayWindow.on('blur', () => {
      if (!OverlayController.targetHasFocus) {
        this.overlayWindow.hide();
      }
    });

    this.overlayWindow.on('show', () => {
      this.sendToOverlay('overlay:trigger-resize');
    });

    this.overlayWindow.on('close', (event) => {
      logger.info('Closing the overlay');
    });

    this.overlayWindow.on('closed', (event) => {
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

    ipcMain.on('overlay:resize', (event, { width, height }) => {
      this.overlayWindow.setMinimumSize(width, height);
      this.overlayWindow.setSize(width, height);
    });

    app.on('will-quit', () => {
      logger.info('Exile Diary Reborn is closing');
      clearTimeout(this.saveBoundsCallback);
      clearTimeout(this.autoUpdaterInterval);
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
      'debug:recheck-gain',
    ];
    for (const event of events) {
      ipcMain.handle(event, Responder[event]);
    }

    this.handleAutoUpdater();
    this.setupListeners();
    this.setupResizer();

    // Restarter for development
    if (isDev) {
      require('electron-reload')(__dirname, {
        electron: path.join(
          __dirname,
          '..',
          '..',
          'node_modules',
          '.bin',
          'electron' + (process.platform === SYSTEMS.WINDOWS ? '.cmd' : '')
        ),
        forceHardReset: true,
        hardResetMethod: 'exit',
      });
    }

    this.setWindowListeners();

    const poeAuthSession = session.fromPartition('persist:poeAuth');

    await poeAuthSession.cookies.set({
      url: 'https://exilediary.com',
      name: 'code_challenge',
      value: 'test',
      expirationDate: moment().add(1, 'week').unix(),
    });

    const gotTheLock = app.requestSingleInstanceLock();

    if (!gotTheLock) {
      app.quit();
    } else {
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
    }

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
  const mainProcess = new MainProcess();
  mainProcess.startWindows();
});
