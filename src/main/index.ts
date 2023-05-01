import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import * as path from 'path';
import logger from 'electron-log';
import Responder from './Responder';
import SettingsManager from './SettingsManager';
import GGGAPI from './GGGAPI';
import League from './db/leagues';
import * as url from 'url';

// Old stuff
import RateGetterV2 from './modules/RateGetterV2';
import Utils from './modules/Utils';
import ScreenshotWatcher from './modules/ScreenshotWatcher';
import * as ClientTxtWatcher from './modules/ClientTxtWatcher';
import * as OCRWatcher from './modules/OCRWatcher';
import * as RunParser from './modules/RunParser';

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

  const { settings } = SettingsManager;

  const events = [
    'app-globals',
    'load-runs',
    'load-run',
    'load-run-details',
    'get-settings',
    'get-characters',
    'save-settings',
  ];
  for (const event of events) {
    ipcMain.handle(event, Responder[event]);
  }

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
      webSecurity: false,
    },
    show: false,
  });

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
  });

  if(isDev) {
    win.loadURL(devUrl);
  } else {
    Menu.setApplicationMenu(null);
    const URL = url.pathToFileURL(path.join(__dirname, '..', 'index.html')).toString();
    win.loadURL(URL);
  }
    
};

app.on('ready', createWindow);
