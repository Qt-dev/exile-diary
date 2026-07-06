import { app, BrowserWindow, ipcMain, dialog, Menu, session, nativeImage, screen } from 'electron';
import { initPortableMode } from './PortableConfig';

// Initialize portable mode BEFORE app is ready, but AFTER electron modules are imported
// This sets the userData path before any other code can access it
// CRITICAL: This must run synchronously before importing SettingsManager, DB, etc.
try {
  initPortableMode();
} catch (error) {
  console.error('CRITICAL: Failed to initialize portable mode:', error);
  // Continue anyway - will use default AppData
}

import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import logger from 'electron-log';
import SettingsManager from './SettingsManager';
import GGGAPI from './GGGAPI';
import RendererLogger from './RendererLogger';
import { OverlayController, OVERLAY_WINDOW_OPTS } from 'electron-overlay-window';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import AuthManager from './AuthManager';

// Old stuff
import ScreenshotWatcher from './modules/ImageParser/ScreenshotWatcher';
import * as OCRWatcher from './modules/ImageParser/OCRWatcher';
import {
  invokeChannels,
  rendererEventChannels,
  sendChannels,
} from '../shared/contracts/exileDiaryApi';
import { createAppWindows } from './windows/createAppWindows';
import { createWindowMessenger, WindowMessenger } from './windows/windowMessaging';
import { GlobalShortcutController } from './shortcuts/GlobalShortcutController';
import { registerResponderHandlers } from './ipc/registerResponderHandlers';
import { registerShellHandlers } from './ipc/registerShellHandlers';
import { registerRuntimeListeners } from './runtime/registerRuntimeListeners';
import { registerAutoUpdater } from './updater/registerAutoUpdater';
import { getRendererIndexPath } from './runtime/electronViteRuntimePaths';
import { createRuntimeSidecarBridge } from './runtime/createRuntimeSidecarBridge';
import * as RuntimeSidecarClient from './runtime/RuntimeSidecarClient';

dayjs.extend(duration);
dayjs.extend(isSameOrAfter);
const autoUpdaterIntervalTime = 1000 * 60 * 60; // 1 hour
const isDev = require('electron-is-dev') || SettingsManager.get('forceDebugMode');
let originalDebugLogger: ((...params: any[]) => void) | null = null;
let originalInfoLogger: ((...params: any[]) => void) | null = null;
let isLoggingToRenderer = false;
const benchmarkMode = process.env.EXILE_DIARY_BENCHMARK_MODE as
  | 'startup'
  | 'idle-memory'
  | undefined;
const benchmarkStartedAt = Number(process.env.EXILE_DIARY_BENCHMARK_STARTED_AT ?? Date.now());

if (benchmarkMode) {
  app.commandLine.appendSwitch('use-angle', 'swiftshader');
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
}

function emitBenchmarkResult(name: string, data: Record<string, unknown>) {
  if (!benchmarkMode) {
    return;
  }

  const payload = {
    benchmark: name,
    timestamp: new Date().toISOString(),
    ...data,
  };
  process.stdout.write(`__EXILE_DIARY_BENCHMARK__${JSON.stringify(payload)}\n`);
}

function setLogTransport(debugMode) {
  logger.transports.console.level = debugMode ? 'verbose' : 'info';
  logger.transports.file.level = debugMode ? 'verbose' : 'info';
}

function setupDebugLoggerHook(logToUI: boolean) {
  function createHookedLoggerFn(originalFn: ((...params: any[]) => void) | null, level: string) {
    return function (...args: any[]) {
      if (originalFn) {
        originalFn(...args);
      }
      if (!isLoggingToRenderer) {
        isLoggingToRenderer = true;
        try {
          const message = args
            .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
            .join(' ');
          RendererLogger.log({ messages: [{ text: `[${level}] ${message}` }], onOverlay: false });
        } catch (e) {
          // Silently fail if RendererLogger isn't ready yet
        }
        isLoggingToRenderer = false;
      }
    };
  }

  // Hook logger to send debug and info logs to renderer when log to UI is enabled
  if (logToUI) {
    // Hook debug logger
    if (!originalDebugLogger) {
      originalDebugLogger = logger.debug.bind(logger);
    }
    logger.debug = createHookedLoggerFn(originalDebugLogger, 'DEBUG');

    // Hook info logger
    if (!originalInfoLogger) {
      originalInfoLogger = logger.info.bind(logger);
    }
    logger.info = createHookedLoggerFn(originalInfoLogger, 'INFO');
  } else {
    // Restore original functions when debug mode is disabled
    if (originalDebugLogger) {
      logger.debug = originalDebugLogger;
    }
    if (originalInfoLogger) {
      logger.info = originalInfoLogger;
    }
  }
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
  isOverlayMoveable: boolean;
  messenger: WindowMessenger;
  shortcutController: GlobalShortcutController;
  runtimeBridge = createRuntimeSidecarBridge();

  constructor() {
    const windows = createAppWindows();
    this.mainWindow = windows.mainWindow;
    this.overlayWindow = windows.overlayWindow;
    this.isDownloadingUpdate = false;
    this.isOverlayMoveable = false;
    this.messenger = createWindowMessenger(windows);
    this.shortcutController = new GlobalShortcutController({
      getShortcut: (key) => this.runtimeBridge.settings.get(key),
      isRunParseScreenshotEnabled: () =>
        !!this.runtimeBridge.settings.get('runParseScreenshotEnabled'),
      areCustomScreenshotsEnabled: () =>
        !!this.runtimeBridge.settings.get('screenshots')?.allowCustomShortcut,
      toggleOverlayPersistence: () => {
        logger.info('Toggling overlay visibility');
        const overlayPersistenceEnabled = this.runtimeBridge.settings.get(
          'overlayPersistenceEnabled'
        );
        void RuntimeSidecarClient.callRendererMethod('saveSettings', [
          { overlayPersistenceEnabled: !overlayPersistenceEnabled },
        ]);
      },
      toggleOverlayMovement: () => {
        logger.info(`Toggling overlay movement - ${this.isOverlayMoveable}`);
        this.isOverlayMoveable = !this.isOverlayMoveable;
        this.sendToOverlay(rendererEventChannels.overlayToggleMovement, {
          isOverlayMoveable: this.isOverlayMoveable,
        });
        return this.isOverlayMoveable;
      },
      triggerRunParse: () => {
        logger.info('Run parse shortcut pressed');
        const event = { timestamp: dayjs().toISOString() };
        void this.runtimeBridge.runTracking.tryProcess({ event });
      },
      triggerScreenshot: () => {
        logger.info('Screenshot shortcut pressed');
        ScreenshotWatcher.emitter.emit('screenshot:capture');
      },
    });
  }

  registerGlobalShortcuts() {
    logger.info('Registering global shortcuts');
    this.shortcutController.registerAll();
  }

  unregisterGlobalShortcuts() {
    logger.info('Unregistering all global shortcuts');
    this.shortcutController.unregisterAll();
  }

  reRegisterGlobalShortcuts() {
    this.shortcutController.reregisterAll();
  }

  async init() {
    logger.info('Initializing components');

    // Settings
    await SettingsManager.initialize();
    await RuntimeSidecarClient.start();
    ScreenshotWatcher.start();
    await OCRWatcher.start();
  }

  sendToOverlay(event: string, data?: any) {
    this.messenger.sendToOverlay(event, data);
  }

  sendToMain(event: string, data?: any) {
    this.messenger.sendToMain(event, data);
  }

  /**
   * Handles the auto updater process (checking for updates, downloading and installing them)
   */
  handleAutoUpdater() {
    registerAutoUpdater({
      overlayWindow: this.overlayWindow,
      getIsDownloadingUpdate: () => this.isDownloadingUpdate,
      setIsDownloadingUpdate: (value) => {
        this.isDownloadingUpdate = value;
      },
      setAutoUpdaterInterval: (interval) => {
        this.autoUpdaterInterval = interval;
      },
    });
  }

  /**
   * Sets up the listeners for the all the old modules
   */
  setupListeners() {
    registerShellHandlers({
      windows: {
        mainWindow: this.mainWindow,
        overlayWindow: this.overlayWindow,
      },
      sendToMain: (event, data) => this.sendToMain(event, data),
      refreshWindows: () => this.refreshWindows(),
      registerHotkeys: () => this.registerGlobalShortcuts(),
      unregisterHotkeys: () => this.unregisterGlobalShortcuts(),
    });
    registerRuntimeListeners(
      {
        mainWindow: this.mainWindow,
        overlayWindow: this.overlayWindow,
        sendToMain: (event, data) => this.sendToMain(event, data),
        sendToOverlay: (event, data) => this.sendToOverlay(event, data),
        reregisterShortcuts: () => this.reRegisterGlobalShortcuts(),
        setLogTransport,
        setupDebugLoggerHook,
      },
      this.runtimeBridge
    );
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
    let benchmarkReported = false;

    const completeBenchmark = async (source: string) => {
      if (!benchmarkMode || benchmarkReported) {
        return;
      }

      benchmarkReported = true;
      logger.info(`Benchmark window reported ready via ${source}`);

      if (benchmarkMode === 'startup') {
        emitBenchmarkResult('app-startup', {
          mode: benchmarkMode,
          startupMs: Date.now() - benchmarkStartedAt,
          source,
        });
        app.quit();
        return;
      }

      if (benchmarkMode === 'idle-memory') {
        setTimeout(async () => {
          const memoryInfo =
            typeof process.getProcessMemoryInfo === 'function'
              ? await process.getProcessMemoryInfo()
              : null;
          emitBenchmarkResult('app-idle-memory', {
            mode: benchmarkMode,
            startupMs: Date.now() - benchmarkStartedAt,
            source,
            processMemory: memoryInfo,
            appMetrics: app.getAppMetrics(),
          });
          app.quit();
        }, 1500);
      }
    };

    if (benchmarkMode) {
      ipcMain.once(sendChannels.appBooted, () => {
        void completeBenchmark('renderer-app-booted');
      });
    }

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
      void this.runtimeBridge.runTracking.refreshTracking();
      this.overlayWindow.setBounds(OverlayController.targetBounds);
      this.sendToOverlay(rendererEventChannels.overlayTriggerReposition);
    });

    OverlayController.events.on('moveresize', (event) => {
      // OverlayController resizes the overlay window when the target changes. So we tell our app to reset the size to what it should be.
      this.overlayWindow.setBounds(OverlayController.targetBounds);
      this.sendToOverlay(rendererEventChannels.overlayTriggerReposition);
    });

    OverlayController.events.on('blur', () => {
      this.overlayWindow.hide();
      this.overlayWindow.setIgnoreMouseEvents(true);
    });

    OverlayController.events.on('focus', () => {
      logger.info(
        `Overlay controller focused, enabled:${this.runtimeBridge.settings.get(
          'overlayEnabled'
        )}, persistenceEnabled:${this.runtimeBridge.settings.get('overlayPersistenceEnabled')}`
      );
      if (this.runtimeBridge.settings.get('overlayEnabled') === true) {
        this.overlayWindow.show();
      }
      this.overlayWindow.setIgnoreMouseEvents(!this.isOverlayMoveable);
    });

    OverlayController.events.on('moveresize', (event) => {
      // OverlayController resizes the overlay window when the target changes. So we tell our app to reset the size to what it should be.
      // https://github.com/SnosMe/electron-overlay-window/blob/28261ce92633292c9accd8e185174489311f0b1f/src/index.ts#L109
      this.sendToOverlay(rendererEventChannels.overlayTriggerReposition);
    });

    // OverlayWindow listeners
    this.overlayWindow.on('blur', () => {
      if (!OverlayController.targetHasFocus) {
        this.overlayWindow.hide();
      }
    });

    this.overlayWindow.on('show', () => {
      this.sendToOverlay(rendererEventChannels.overlayTriggerReposition);
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
            linkEvent: sendChannels.reloadApp,
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

    app.on('will-quit', () => {
      logger.info('Exile Diary Reborn is closing');
      clearTimeout(this.saveBoundsCallback);
      clearTimeout(this.autoUpdaterInterval);
      this.unregisterGlobalShortcuts();
      OCRWatcher.stop();
      RuntimeSidecarClient.stop();
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

    registerResponderHandlers();

    if (!benchmarkMode) {
      this.handleAutoUpdater();
    }
    this.setupListeners();
    this.setupResizer();

    if (!benchmarkMode) {
      this.registerGlobalShortcuts();
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
              const activeProfile = this.runtimeBridge.settings.get('activeProfile');
              if (
                !activeProfile ||
                !activeProfile.valid ||
                !activeProfile.characterName ||
                !activeProfile.league
              ) {
                await RuntimeSidecarClient.callRendererMethod('saveSettings', [
                  {
                    activeProfile: {
                      characterName: character.name,
                      league: character.league,
                      valid: true,
                    },
                  },
                ]);
              }
            }
          });
      } else {
        logger.info('No access token from Lambda', code, state, AuthManager.getState());
        logger.info(callCommand);
        logger.info(commandLine);
      }
    });

    const rendererUrl = process.env.ELECTRON_RENDERER_URL;
    if (rendererUrl) {
      this.mainWindow.loadURL(rendererUrl);
      this.overlayWindow.loadURL(`${rendererUrl}#/overlay`);
    } else {
      Menu.setApplicationMenu(null);
      const rendererIndexHtml = getRendererIndexPath(__dirname);
      this.mainWindow.loadFile(rendererIndexHtml);
      this.overlayWindow.loadFile(rendererIndexHtml, {
        hash: '/overlay',
      });
    }
  }
}

app.on('ready', () => {
  // Use userData path as the lock key so each portable instance can run independently
  // This allows multiple portable installations in different folders to run simultaneously
  // while preventing duplicate instances of the same installation
  const gotTheLock = app.requestSingleInstanceLock({
    key: app.getPath('userData'),
  });

  if (!gotTheLock) {
    logger.error('Exile Diary is already started, closing the new instance.');
    app.quit();
  } else {
    const mainProcess = new MainProcess();
    mainProcess.startWindows();
  }
});
