import { app, BrowserWindow, ipcMain, dialog, Menu, session } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import logger from 'electron-log';
import Responder from './Responder';
import SettingsManager from './SettingsManager';
import GGGAPI from './GGGAPI';
import League from './db/league';
import RendererLogger from './RendererLogger';
import * as url from 'url';

// Old stuff
import RateGetterV2 from './modules/RateGetterV2';
import Utils from './modules/Utils';
import ScreenshotWatcher from './modules/ScreenshotWatcher';
import * as ClientTxtWatcher from './modules/ClientTxtWatcher';
import * as OCRWatcher from './modules/OCRWatcher';
import * as RunParser from './modules/RunParser';
import moment from 'moment';
import AuthManager from './AuthManager';

const devUrl = 'http://localhost:3000';
enum SYSTEMS {
  WINDOWS = 'win32',
  LINUX = 'debian',
  MACOS = 'darwin',
}

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
            title: `Error report for ${versions.app}`,
            body: 'Error:\n```' + error.stack + '\n```\n' + `OS: ${versions.os}`,
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

const init = async () => {
  logger.info('Initializing components');

  // Settings
  await SettingsManager.initialize();
  if (!SettingsManager.settings.accountName) {
    logger.error('No account name set. Please set your account name in the settings.');
  } else {
    try {
      logger.info('Getting character and league info');
      const character = await GGGAPI.getCurrentCharacter();
      League.addLeague(character.league);
      SettingsManager.set('activeProfile', {
        characterName: character.name,
        league: character.league,
        valid: true,
      });
      logger.info(`Settings updated. Character: ${character.name}, League: ${character.league}`);
    } catch (e) {
      logger.error(
        `Could not set active character and league. Please check your settings. (Current Account: ${SettingsManager.settings.accountName}})`
      );
      logger.error(e);
    }
  }

  if (SettingsManager.settings.activeProfile && SettingsManager.settings.activeProfile.valid) {
    logger.info('Starting components');
    RateGetterV2.Getter.init();
    setTimeout(() => {
      RateGetterV2.Getter.update();
    }, 1000);
    ClientTxtWatcher.start();
    ScreenshotWatcher.start();
    OCRWatcher.start();
    // ItemFilter.load(); not working yet
  }
};

const createWindow = async () => {
  logger.info(`Starting Exile Diary Reborn v${app.getVersion()}`);
  // Initialize messages for the main window

  await init();

  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('exile-diary', process.execPath, [path.resolve(process.argv[1])])
    }
  } else {
    app.setAsDefaultProtocolClient('exile-diary');
  }

  const { settings } = SettingsManager;

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
  ];
  for (const event of events) {
    ipcMain.handle(event, Responder[event]);
  }


  let isDownloadingUpdate = false;

  ipcMain.on('download-update', function (event) {
    if (!isDownloadingUpdate) {
      isDownloadingUpdate = true;
      RendererLogger.log({
        messages: [
          { text: 'Downloading update...' },
        ]
      });
      logger.info('Now downloading update');
      autoUpdater.downloadUpdate();
    }
  });
  ipcMain.on('apply-update', function (event) {
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
        { text: `An update to version ${info.version} is available, click here to download`, linkEvent: 'download-update' },
      ]
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    RendererLogger.log(
      { 
        messages: [
        {
          text: `Update to version ${info.version} has been downloaded, click here to install it now (requires restart)`, linkEvent: 'apply-update'
        }
        ]
      })
  });
  autoUpdater.checkForUpdates().then((result) => {logger.info('Update check result:', result)});

  OCRWatcher.emitter.removeAllListeners();
  OCRWatcher.emitter.on('OCRError', () => {
    logger.info('Error getting area info from screenshot. Please try again');
  });
  OCRWatcher.emitter.on('areaInfoComplete', (info) => {
    const tier = getMapTierString({ level: parseInt(info.areaInfo.level) });
    let stats = `IIR: ${info.mapStats.iir} / IIQ: ${info.mapStats.iiq}`;
    if (info.mapStats.packsize && info.mapStats.packsize > 0)
      stats += ` / Pack Size: ${info.mapStats.packsize}`;
    logger.info(
      `Got area info for <span class='eventText'>${info.areaInfo.name}</span> (${tier} - ${stats})`
    );
    RendererLogger.log(
      {
        messages: [
          {
            text: "Got area info for ",
          },
          {
            text: info.areaInfo.name,
            type: 'important',
          },
          {
            text: ` (${tier} - ${stats})`,
          }
        ]
      }
    )
  });

  ScreenshotWatcher.emitter.removeAllListeners();
  ScreenshotWatcher.emitter.on('OCRError', () => {
    logger.info('Error getting area info from screenshot. Please try again');
  });
  ScreenshotWatcher.emitter.on('tooMuchScreenshotClutter', (totalSize) => {
    const dir = settings.screenshotDir.replace(/\\/g, '\\\\');
    logger.info(
      `Screenshot folder contains <span class='eventText'>${totalSize}</span> screenshots. Click <span class='eventText' style='cursor:pointer;' onclick='openShell("${dir}")'>here</span> to open it for cleanup`
    );
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
    RendererLogger.log(
      {
        messages: [
          {
            text: "Completed run in ",
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
          }
        ]
      }
    );
    win.webContents.send('refresh-runs');
  });

  RateGetterV2.emitter.removeAllListeners();
  RateGetterV2.emitter.on('gettingPrices', () => {
    logger.info("<span class='eventText'>Getting item prices from poe.ninja...</span>");
  });
  RateGetterV2.emitter.on('doneGettingPrices', () => {
    logger.info("<span class='eventText'>Finished getting item prices from poe.ninja</span>");
  });
  RateGetterV2.emitter.on('gettingPricesFailed', () => {
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
    // win.webContents.send('refresh-settings');
  });
  ClientTxtWatcher.emitter.on('clientTxtFileError', (path) => {
    logger.info(
      `<span class='eventText'>Error reading ${path}. Please check if the file exists.</span>`
    );
  });
  ClientTxtWatcher.emitter.on('clientTxtNotUpdated', (path) => {
    logger.info(
      `<span class='eventText'>${path} has not been updated recently even though the game is running. Please check if PoE is using a different Client.txt file.</span>`
    );
  });

  let saveBoundsCallback: any = null;
  const saveWindowBounds = () => {
    const bounds = win.getBounds();
    const { width } = bounds;

    // We do not want to save the settings on every single ping, so we work with a timeout
    if (saveBoundsCallback) clearTimeout(saveBoundsCallback);
    saveBoundsCallback = setTimeout(() => {
      SettingsManager.set('mainWindowBounds', bounds);
      logger.info('saving bounds', bounds);
      // Set min width to 1100
      win.webContents.send('rescale', Math.min(width, 1100) / 1100);
    }, 1000);
  };

  let win = new BrowserWindow({
    title: `Exile Diary v${app.getVersion()}`,
    webPreferences: {
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
      contextIsolation: false,
      // webSecurity: false,
    },
    show: false,
  });

  AuthManager.setMessenger(win.webContents);
  RendererLogger.init(win.webContents);

  win.on('resize', saveWindowBounds);
  win.on('move', saveWindowBounds);

  if (settings && settings.mainWindowBounds) {
    logger.info('loading with bounds', settings.mainWindowBounds);
    win.setBounds(settings.mainWindowBounds);
  } else {
    win.maximize();
  }

  const isDev = require('electron-is-dev')
  if(isDev) {
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

  // Save Window bounds

  // setInterval(() => {
  //   win.webContents.send('refresh-runs'); // Change this to depend on when stuff changes in db
  // }, 3000);

  win.on('close', (e: Event) => {
    return;
    // if (!isQuitting) {
    //   e.preventDefault();
    //   win.hide();
    //   e.returnValue = false;
    // }
  });

  win.once('ready-to-show', () => {
    win.show();
    logger.info('ready to show');
    
    RendererLogger.log({
      messages: [
        {
          text: 'Exile Diary Reborn '
        },
        {
          text: `v${app.getVersion()}`,
          type: 'important'
      },
        {
          text: ' started.'
        }]
    });
    AuthManager.setLogoutTimer();
  });

  const poeAuthSession = session.fromPartition('persist:poeAuth');

  await poeAuthSession.cookies.set({
    url: "https://exilediary.com",
    name: 'code_challenge',
    value: 'test',
    expirationDate: moment().add(1, 'week').unix(),
  });


  
  const gotTheLock = app.requestSingleInstanceLock()

  if (!gotTheLock) {
    app.quit()
  } else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
      // Someone tried to run a second instance, we should focus our window.
      if (win) {
        if (win.isMinimized()) win.restore()
        win.focus()
      }

      const callCommand = commandLine.pop();
      const params = new URLSearchParams(callCommand?.split('?')[1]);
      const code = params.get('code');
      const state = params.get('state');

      if(code && state && AuthManager.verifyState(state)) {
        logger.info('We got an access token from Lambda');
        AuthManager.getOauthToken(code).then(AuthManager.saveToken).then(async () => {
          const isAuthenticated = await AuthManager.isAuthenticated();
          if(isAuthenticated) {
            win.webContents.send('oauth:auth-success');
            const character = await GGGAPI.getCurrentCharacter();
            const activeProfile = SettingsManager.get('activeProfile');
            if(!activeProfile || !activeProfile.valid || !activeProfile.characterName || !activeProfile.league) {
              SettingsManager.set('activeProfile', {
                characterName: character.name,
                league: character.league,
                valid: true
              });
            }
          }
        });
      } else {
        logger.info('No access token from Lambda', code, state, AuthManager.getState());
        logger.info(callCommand);
        logger.info(commandLine);
      }
    })
  }


  if(isDev) {
    win.loadURL(devUrl);
  } else {
    Menu.setApplicationMenu(null);
    const URL = url.pathToFileURL(path.join(__dirname, '..', 'index.html')).toString();
    win.loadURL(URL);
  }
    
};

app.on('ready', createWindow);
