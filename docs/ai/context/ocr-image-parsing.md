# OCR and Image Parsing Context

## What Lives Here
- OCR sidecar
- screenshot and worker flow
- map mod matching
- OCR precision policy and app-path benchmarking

## Primary Entrypoints
- `src/main/modules/ImageParser/OCRWatcher.js`
- `src/main/modules/ImageParser/OcrSidecar.ts`
- `src/main/modules/ImageParser/OcrScanService.js`
- `src/main/modules/ImageParser/ScreenshotWatcher.ts`
- `src/main/modules/ImageParser/matchMapMods.ts`

## Common Risks
- source vs built worker paths
- OCR sidecar entry path issues
- benchmark fixtures drifting from runtime behavior
- app-path behavior differing from pure OCR logic

## Cheapest Checks
- `npm test -- test/main/modules/OCRWatcher.spec.ts test/main/modules/MapModsMatching.spec.ts`
- `npm run benchmark:ocr:scan-map-mods`
- `npm run benchmark:ocr:app-path`

## Use Full Launch When
- OCR behavior depends on live startup, user-data path, overlay behavior, or end-to-end screenshot flow
