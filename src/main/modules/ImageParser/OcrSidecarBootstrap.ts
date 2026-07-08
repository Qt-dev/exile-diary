import { configureElectronLog } from '../../configureElectronLog';

configureElectronLog('ocr-sidecar.log');

// Use CommonJS in dev so existing extensionless imports keep working under tsx,
// and load the built JS entry in packaged output.
if (process.env.ELECTRON_RENDERER_URL) {
  require('./OcrSidecar.ts');
} else {
  void import('./OcrSidecar.js');
}
