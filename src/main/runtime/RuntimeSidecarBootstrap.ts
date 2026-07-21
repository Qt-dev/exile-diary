import { configureElectronLog } from '../configureElectronLog';

configureElectronLog('runtime-sidecar.log');

// Use CommonJS in dev so existing extensionless imports keep working under tsx,
// and load the built JS entry in packaged output.
if (process.env.ELECTRON_RENDERER_URL) {
  require('./RuntimeSidecar.ts');
} else {
  void import('./RuntimeSidecar.js');
}
