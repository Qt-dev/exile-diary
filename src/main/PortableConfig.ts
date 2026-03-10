import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Portable Configuration Manager
 *
 * This module handles the detection and setup of portable mode.
 * In portable mode, all user data is stored in an 'exile-data' folder
 * next to the executable instead of in AppData.
 */

let isPortable = false;
let portableDataPath: string | null = null;

/**
 * Detects if the app is running in portable mode
 *
 * Portable mode is detected by:
 * 1. Checking if process.env.PORTABLE is set to 'true'
 * 2. Checking if a 'portable' marker file exists in the app directory
 *
 * The marker file is created by the build script for portable builds.
 */
export function initPortableMode(): void {
  // Wrap everything in try-catch to prevent crashes
  const debugLog: string[] = [];
  const addLog = (msg: string) => {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] ${msg}`;
    console.log(`[PortableConfig] ${msg}`);
    debugLog.push(logMsg);
  };

  try {
    addLog('='.repeat(60));
    addLog('PORTABLE MODE INITIALIZATION');
    addLog('='.repeat(60));

    addLog(`Node version: ${process.version}`);
    addLog(`Platform: ${process.platform}`);
    addLog(`process.execPath: ${process.execPath}`);
    addLog(`process.resourcesPath: ${process.resourcesPath}`);
    addLog(`process.cwd(): ${process.cwd()}`);
    addLog(`__dirname: ${__dirname}`);

    // Determine exe directory - ALWAYS use process.execPath (works before app.ready)
    const exeDir = path.dirname(process.execPath);
    addLog(`Executable directory: ${exeDir}`);

    // Check if explicitly set via environment variable (for development testing)
    if (process.env.PORTABLE === 'true') {
      isPortable = true;
      addLog('✓ Forced portable mode via PORTABLE=true env var');
    } else {
      // Check for portable marker in resources directory
      const resourcesPath = process.resourcesPath;
      const portableMarker = path.join(resourcesPath, 'portable');

      addLog(`Looking for marker at: ${portableMarker}`);

      // Check if resources directory exists
      const resourcesExists = fs.existsSync(resourcesPath);
      addLog(`Resources directory exists: ${resourcesExists}`);

      if (resourcesExists) {
        // List files in resources to verify
        try {
          const files = fs.readdirSync(resourcesPath);
          addLog(`Files in resources directory (${files.length} total):`);
          files.forEach((file) => addLog(`  - ${file}`));
        } catch (e) {
          addLog(`⚠ Could not list files in resources: ${e}`);
        }
      }

      // Check for the marker file
      const markerExists = fs.existsSync(portableMarker);
      addLog(`Portable marker exists: ${markerExists}`);

      if (markerExists) {
        try {
          const markerContent = fs.readFileSync(portableMarker, 'utf8');
          addLog(`Marker content: ${markerContent.substring(0, 50)}...`);
        } catch (e) {
          addLog(`⚠ Could not read marker: ${e}`);
        }
      }

      isPortable = markerExists;
    }

    addLog('='.repeat(60));
    if (isPortable) {
      addLog('PORTABLE MODE: ENABLED');
      addLog('='.repeat(60));

      portableDataPath = path.join(exeDir, 'exile-data');
      addLog(`Target data path: ${portableDataPath}`);

      // Try to create the directory
      try {
        if (!fs.existsSync(portableDataPath)) {
          addLog('Creating exile-data directory...');
          fs.mkdirSync(portableDataPath, { recursive: true });
          addLog('✓ Created exile-data directory');
        } else {
          addLog('✓ exile-data directory already exists');
        }

        // Test write permissions by creating a test file
        const testFile = path.join(portableDataPath, '.write-test');
        try {
          fs.writeFileSync(testFile, 'test');
          fs.unlinkSync(testFile);
          addLog('✓ Write permissions verified');
        } catch (e) {
          addLog(`✗ Write test failed: ${e}`);
        }
      } catch (e) {
        addLog(`✗ CRITICAL: Failed to create directory: ${e}`);
        addLog('Falling back to installed mode');
        isPortable = false;
        portableDataPath = null;
      }

      // Only set userData path if directory creation succeeded
      if (isPortable && portableDataPath) {
        try {
          const oldPath = app.getPath('userData');
          addLog(`Old userData: ${oldPath}`);

          app.setPath('userData', portableDataPath);

          const newPath = app.getPath('userData');
          addLog(`New userData: ${newPath}`);

          if (newPath === portableDataPath) {
            addLog('✓ userData path successfully changed');
          } else {
            addLog(`⚠ WARNING: Path mismatch! Expected ${portableDataPath}, got ${newPath}`);
          }
        } catch (e) {
          addLog(`✗ CRITICAL: Failed to set userData path: ${e}`);
          isPortable = false;
          portableDataPath = null;
        }
      }
    } else {
      addLog('PORTABLE MODE: DISABLED (Installed mode)');
      addLog('='.repeat(60));
      try {
        const userData = app.getPath('userData');
        addLog(`Will use standard userData: ${userData}`);
      } catch (e) {
        addLog(`Cannot get userData yet (app not ready): ${e}`);
      }
    }

    addLog('='.repeat(60));
    addLog(`Final status: ${isPortable ? 'PORTABLE' : 'INSTALLED'}`);
    addLog('='.repeat(60));
  } catch (error) {
    addLog('='.repeat(60));
    addLog(`CRITICAL ERROR: ${error}`);
    if (error instanceof Error) {
      addLog(`Stack: ${error.stack}`);
    }
    addLog('='.repeat(60));
    console.error('[PortableConfig] CRITICAL ERROR:', error);
  } finally {
    // ALWAYS try to write the debug log
    try {
      const logDir = path.dirname(process.execPath);
      const logPath = path.join(logDir, 'portable-init.log');
      addLog(`Writing log to: ${logPath}`);
      fs.writeFileSync(logPath, debugLog.join('\n') + '\n', 'utf8');
      console.log(`[PortableConfig] Debug log written to: ${logPath}`);
    } catch (e) {
      console.error('[PortableConfig] Failed to write debug log:', e);
      // Try alternate location
      try {
        const altLogPath = path.join(process.cwd(), 'portable-init.log');
        fs.writeFileSync(altLogPath, debugLog.join('\n') + '\n', 'utf8');
        console.log(`[PortableConfig] Debug log written to alternate location: ${altLogPath}`);
      } catch (e2) {
        console.error('[PortableConfig] Could not write log to any location:', e2);
      }
    }
  }
}

/**
 * Returns whether the app is running in portable mode
 */
export function getIsPortable(): boolean {
  return isPortable;
}

/**
 * Gets the user data path (either portable or standard)
 */
export function getUserDataPath(): string {
  return app.getPath('userData');
}
