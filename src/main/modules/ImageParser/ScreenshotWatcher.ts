import sharp, { kernel } from 'sharp';
import fs from 'fs/promises';
import SettingsManager from '../../SettingsManager';
import path from 'path';
import dayjs from 'dayjs';
import chokidar, { type FSWatcher } from 'chokidar';
import Logger from 'electron-log';
import EventEmitter from 'events';
import OCRWatcher from './OCRWatcher';
import { app, globalShortcut } from 'electron';
import Piscina from 'piscina';
import { resolve } from 'path';
import { filename } from './ImageSaverWorker';

const piscina = new Piscina({
  filename: resolve(__dirname, './workerWrapper.js'),
  workerData: { fullpath: filename },
});
const isDev = true;
const logger = Logger.scope('main-screenshot-watcher');
const ProcessingTimeout = 15000;

// const SCREENSHOT_DIRECTORY_SIZE_LIMIT = 400;
const sizeMultiplier = 3; // We read pixels from a screenshot that is in 1920x1080 * this multiplier
const customShortcutTrigger = 'CommandOrControl+F8';
let watcher: FSWatcher | null;
const emitter = new EventEmitter();

const getMargin = (rawImage: any, metadata: { height: number; width: number }) => {
  // We define a height to check at 10% of the image height
  // At that height, we are right in the middle of the Area Info box and so the moment we find a non-black pixel, this is the end of the margin.
  const marginHeight = Math.floor(metadata.height * 0.1);

  const lineIndex = metadata.height - (metadata.height - marginHeight); // This is the line we will check, starting from the bottom of the image

  // Get all the pixels from the a line at the height we decided to check
  const line = rawImage.slice(metadata.width * lineIndex, metadata.width * (lineIndex + 1));

  // Now we check the line from the end, looking for the first non-black pixel
  // In this case, we are looking for any object where the RGB values are not all below 10
  // We could have gone for 0, but there will be transitional pixels that are not black, so we allow a bit of leeway
  // const isBlack = (pixel: { r: number; g: number; b: number }, tolerance: number) => {
  //   return pixel.r < tolerance && pixel.g < tolerance && pixel.b < tolerance;
  // };

  let margin = 0;
  let threshold = 10; // Threshold for non-black pixels
  for (let x = 0; x < line.length; x++) {
    const actualIndex = line.length - (1 + x); // Start from the end of the line
    const pixel = line[actualIndex];
    // logger.debug(`Checking pixel at x=${x} - actualIndex=${actualIndex}: ${JSON.stringify(pixel)}`);
    if (pixel.r + pixel.g + pixel.b > threshold) {
      logger.info(`Found margin at x=${x} on line ${lineIndex}.`);
      margin = x + 1; // +1 because we want the first non-black pixel
      break;
    }
  }

  if (margin === 0) {
    logger.warn('All the pixels on that line seem to be black, we will work with 0 margin.');
  }

  // Debug - Save the raw image line to a file for debugging purposes
  // require('fs').writeFileSync(path.join(app.getPath('userData'), 'margin-line.json'), JSON.stringify(line));

  return margin;
};

const getModsBox = (rawImage: any, margin: number, metadata: { height: number; width: number }) => {
  const boxMargin = 10; // Margin around the text box
  const yBounds = getModsYBounds(rawImage, margin, boxMargin, metadata);
  const xBounds = getModsXBounds(rawImage, margin, boxMargin, yBounds, metadata);

  return {
    x: xBounds,
    y: yBounds,
  };
};

function getModsYBounds(
  rawImage: any,
  margin: number,
  boxMargin: number,
  metadata: { height: number; width: number }
) {
  const modsBox: { start: number; end: number } = { start: -1, end: -1 };
  const detectionHeightStartIndex = Math.floor(metadata.height * 0.1); // Start checking at 10% of the height
  const detectionWidth = 30; // Width of the area we are checking for mods
  const endOfBoxThreshold = 15; // Minimum number of black pixels to consider the end of the mods box
  let orangeLineIndex = -1; // Index of the first line with orange pixels
  let maxOrangePixels = 0; // Maximum number of orange pixels found in a line
  for (let y = detectionHeightStartIndex; y < metadata.height - 1; y++) {
    let orangePixels = 0;

    for (let x = metadata.width - margin - detectionWidth; x < metadata.width - margin; x++) {
      const fullIndex = y * metadata.width + x; // Calculate the full index in the raw image array
      const pixel = rawImage[fullIndex];
      if (isOrange(pixel)) {
        orangePixels++;
      }
    }

    if (orangePixels >= detectionWidth * 0.7) {
      logger.debug(`Found orange line at y=${y} with ${orangePixels} oranges`);
      orangeLineIndex = y;
      maxOrangePixels = orangePixels;
      break; // We found the first line with enough orange pixels, we can stop checking
    }
  }
  logger.debug(
    `Maximum orange pixels found in a line: ${maxOrangePixels} on line ${orangeLineIndex}`
  );

  if (!orangeLineIndex || orangeLineIndex === -1) {
    logger.warn('No orange line found, cannot determine mods box.');
    return modsBox; // No orange line found, we cannot determine the mods box
  }

  let linesArray: { line: number; blue: number; black: number }[] = [];
  for (let y = orangeLineIndex + 1; y < metadata.height - 1; y++) {
    let bluePixels = 0;
    let blackPixels = 0;

    for (let x = metadata.width - margin - detectionWidth; x < metadata.width - margin - 1; x++) {
      const fullIndex = y * metadata.width + x; // Calculate the full index in the raw image array
      const pixel = rawImage[fullIndex];
      if (isBlue(pixel)) {
        bluePixels++;
      } else if (isBlack(pixel, 50)) {
        blackPixels++;
      }
    }

    linesArray.push({ line: y, blue: bluePixels, black: blackPixels });

    if (modsBox.start === -1 && bluePixels >= 6) {
      logger.debug(`Found blue line at y=${y} with ${bluePixels} blues`);
      const previousLine = linesArray.length > 1 ? linesArray[linesArray.length - 2] : null; // Get the previous line data
      if (previousLine && previousLine.black >= detectionWidth * 0.9) {
        logger.debug(`It is after a black line with ${previousLine.black} blacks`);
        modsBox.start = y - boxMargin;
      }
    } else if (
      modsBox.start !== -1 && // We already found the start of the mods box
      modsBox.end === -1 && // We haven't found the end of the mods box yet
      blackPixels >= detectionWidth * 0.9 && // We found a line with enough black pixels
      bluePixels <= 2 && // We found a line with at most 2 blue pixels
      linesArray.length >= endOfBoxThreshold && // We have enough lines to check the last 12 lines
      Math.max(...linesArray.slice(-endOfBoxThreshold).map((line) => line.blue)) <= 2 && // The last 12 lines have at most 2 blue pixels
      Math.max(...linesArray.slice(-endOfBoxThreshold).map((line) => line.black)) >= 15 // The last 12 lines have at least 15 black pixels
    ) {
      logger.debug(`Found black line at y=${y} with ${blackPixels} blacks`);
      logger.debug(
        `It has not had more than 2 blues, only blacks in the last ${endOfBoxThreshold} lines`
      );
      modsBox.end = y + boxMargin;
      break; // We found the end of the mods box, we can stop checking
    }
  }

  return modsBox;
}

function getModsXBounds(
  rawImage: any,
  margin: number,
  boxMargin: number,
  yBounds: { start: number; end: number },
  metadata: { height: number; width: number }
) {
  const blueArray: number[] = [];
  const imageWidth = metadata.width - 1 - margin;
  let xBoundary = 0;

  // On each column
  for (let x = imageWidth; x > 0; x--) {
    let pixelCount = 0;

    // Check pixel on every line of our restricted area
    for (let y = yBounds.start; y < yBounds.end; y++) {
      const pixel = rawImage[y * metadata.width + x];
      if (isBlue(pixel)) {
        pixelCount++;
      }
    }

    blueArray.push(pixelCount);

    // If we have enough lines in the moving array
    if (blueArray.length === boxMargin) {
      const blueAvg = blueArray.reduce((acc, curr) => acc + curr, 0) / boxMargin;
      // If first line with no blue, boundary is here
      if (blueAvg < 1) {
        xBoundary = x;
        break;
      }
      blueArray.shift();
    }
  }

  return { start: xBoundary, end: metadata.width - margin };
}

let timers: any[] = [];
/**
 * Main Processing function. It takes a file and processes it to get the mods and stats
 * @param file String of the file location or Buffer of the image
 * @returns Promise<void> Promise that resolves once the processing is done
 */
async function processScreenshot(file: string | Buffer) {
  timers.push({
    name: 'start',
    timer: performance.now(),
  });
  const filepath = path.join(app.getPath('userData'), '.dev_captures');
  // require('fs').mkdirSync(filepath, { recursive: true });
  if (isDev) await piscina.run({ filePath: filepath }, { name: 'initialize' });
  const filePrefix = dayjs().format('YYYYMMDDHHmmss');
  // Kernel to use in a convolve to make text look better to be read.
  // const kernel = [-1 / 8, -1 / 8, -1 / 8, -1 / 8, 2, -1 / 8, -1 / 8, -1 / 8, -1 / 8];

  timers.push({
    name: 'before-metadata',
    timer: performance.now(),
  });
  const metadata = await sharp(file).metadata();
  const { width: originalWidth, height: originalHeight } = metadata;
  if (!originalWidth || !originalHeight) throw new Error('Error in getting screenshot size');
  const targetHeight = 1080;
  const sizeMultiplier = parseFloat((targetHeight / originalHeight).toFixed(2));

  const target = {
    width: parseInt((originalWidth * sizeMultiplier).toFixed(0)),
    height: parseInt((originalHeight * sizeMultiplier).toFixed(0)),
  };

  timers.push({
    name: 'after-metadata',
    timer: performance.now(),
  });

  const image = await sharp(file).resize(target.width, target.height).png().toBuffer();

  timers.push({
    name: 'after-resize',
    timer: performance.now(),
  });

  const rawImage = await sharp(image).clone().raw({ depth: 'char' }).toBuffer();

  const formattedRawImage: { r: number; g: number; b: number }[] = rawImage.reduce(
    (acc: { r: number; g: number; b: number }[], curr, index) => {
      if (index % 3 === 0) {
        acc.push({ r: curr, g: rawImage[index + 1], b: rawImage[index + 2] });
      }
      return acc;
    },
    []
  );
  timers.push({
    name: 'after-raw',
    timer: performance.now(),
  });
  // require('fs').writeFileSync(path.join(app.getPath('userData'), 'rawImage.json'), JSON.stringify(formattedRawImage));
  // piscina.run({imageBuffer: await sharp(newImage).clone().toBuffer(), filename: 'full_screenshot.png', filePath: filepath}, {name: 'saveImage'});
  const margin = getMargin(formattedRawImage, { height: target.height, width: target.width });
  timers.push({
    name: 'After Margin',
    timer: performance.now(),
  });
  const modsBox = getModsBox(formattedRawImage, margin, {
    height: target.height,
    width: target.width,
  });
  timers.push({
    name: 'After Mods Box',
    timer: performance.now(),
  });
  const modsBoxDimensions = {
    width: modsBox.x.end - modsBox.x.start,
    height: modsBox.y.end - modsBox.y.start,
    top: modsBox.y.start,
    left: modsBox.x.start,
  };
  const modsImage = await sharp(image)
    .extract(modsBoxDimensions)
    .resize(Math.floor(modsBoxDimensions.width * 2))
    .grayscale() // Step 1: Grayscale
    .normalize() // Step 2: Boost contrast
    .negate() // Step 3: Invert dark text on dark background
    .threshold(50) // Step 4: Convert to black & white
    .sharpen() // Step 4: Sharpen the image
    .png() // Step 5: Output format
    .toBuffer(); // Keep in memory

  timers.push({
    name: 'after-new-processing',
    timer: performance.now(),
  });

  if (isDev)
    piscina.run(
      { imageBuffer: image, filename: 'screenshot', filePath: filepath },
      { name: 'saveImage' }
    );

  if (isDev)
    piscina.run(
      { imageBuffer: modsImage, filename: 'mods.png', filePath: filepath },
      { name: 'saveImage' }
    );

  timers.push({
    name: 'after-mods-extract',
    timer: performance.now(),
  });

  logger.debug(
    `Starting screenshot processing. There are ${OCRWatcher.scheduler.getQueueLen()} items in the queue and ${OCRWatcher.scheduler.getNumWorkers()} workers are running`
  );

  // We make sure we timeout after ProcessingTimeout ms to avoid hanging the process
  const timeout = setTimeout(async () => {
    logger.error(
      `There are ${OCRWatcher.scheduler.getQueueLen()} items in the queue, and ${OCRWatcher.scheduler.getNumWorkers()} workers are running`
    );
    emitter.emit('screenshot:timeout');
    // throw new Error('Screenshot processing timed out');
  }, ProcessingTimeout);

  timers.push({
    name: 'before-ocr',
    timer: performance.now(),
  });
  await Promise.all([
    // OCRWatcher.processImageBuffer(statsImage, filePrefix, 'area'),
    OCRWatcher.processImageBuffer(modsImage, filePrefix, 'mods'),
  ]);
  timers.push({
    name: 'after-ocr',
    timer: performance.now(),
  });

  // If we got there, things went fine, so we clear the timeout
  clearTimeout(timeout);

  logger.debug('Finished processing screenshot');
  const totalTime = performance.now() - timers[0].timer;
  const cleanTimers = timers.map((timer, index) => {
    return {
      name: timer.name,
      timer: timer.timer,
      time: index > 0 ? timer.timer - timers[index - 1].timer : 0,
      percentage: ((index > 0 ? timer.timer - timers[index - 1].timer : 0) / totalTime) * 100,
    };
  });
  cleanTimers.push({
    name: 'total',
    timer: performance.now(),
    time: totalTime,
    percentage: 100,
  });
  timers = [];
  logger.debug('Timers:', cleanTimers);
}

function isBlue(rgba: { r: any; g: any; b: any }) {
  // rgb: 8888ff

  const blue = {
    r: 88,
    g: 88,
    b: 255,
  };
  return comparePixelColors(rgba, blue, 20000);
}

function isOrange(rgba: { r: any; g: any; b: any }) {
  // rgb(111, 87, 73)
  const orange = {
    r: 150,
    g: 120,
    b: 100,
  };
  return comparePixelColors(rgba, orange, 2000);
}

function comparePixelColors(
  pixel1: { r: number; g: number; b: number },
  pixel2: { r: any; g: any; b: any },
  tolerance: number
) {
  const { r, g, b } = {
    r: Math.abs(pixel1.r - pixel2.r),
    g: Math.abs(pixel1.g - pixel2.g),
    b: Math.abs(pixel1.b - pixel2.b),
  };
  return r * r + g * g + b * b < tolerance;
}

function isBlack(rgba: { r?: any; g?: any; b?: any }, tolerance: number) {
  const linear = ({} = rgba);
  for (const key in linear) {
    linear[key] =
      linear[key] <= 0.04045 ? linear[key] / 12.92 : Math.pow((linear[key] + 0.055) / 1.055, 2.4);
  }
  const { r, g, b } = linear;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const lstar =
    (luminance < 216 / 24389 ? luminance * (24389 / 27) : Math.pow(luminance, 1 / 3) * 116 - 16) /
    100;

  return lstar <= tolerance;
}

function registerWatcher(screenshotDir) {
  logger.info('Watching ' + screenshotDir);
  watcher = chokidar.watch(screenshotDir, {
    usePolling: true,
    awaitWriteFinish: true,
    ignoreInitial: true,
  });
  watcher.on('add', async (path) => {
    logger.info('Cropping new screenshot: ' + path);
    const stats = await fs.stat(path);
    emitter.emit('OCRStart', stats);
    processScreenshot(path);
  });
}

function unregisterWatcher() {
  if (watcher) {
    try {
      watcher.close();
      watcher = null;
    } catch (err: any) {
      const message = 'Error closing screenshot watcher' + (err.message ? `: ${err.message}` : '');
      logger.error(message);
    }
  }
}

function registerCustomShortcut() {
  logger.info('Registering custom screenshot shortcut');

  globalShortcut.register(customShortcutTrigger, async () => {
    emitter.emit('screenshot:capture');
  });
}

function unregisterCustomShortcut() {
  logger.info('Unregistering custom screenshot shortcut');
  globalShortcut.unregister(customShortcutTrigger);
}

function registerListener() {
  SettingsManager.registerListener('screenshots', (value) => {
    const { allowCustomShortcut, allowFolderWatch, screenshotDir } = value;

    if (allowFolderWatch && screenshotDir) {
      registerWatcher(screenshotDir);
    } else {
      unregisterWatcher();
    }

    if (allowCustomShortcut) {
      registerCustomShortcut();
    } else {
      unregisterCustomShortcut();
    }
  });
}

function start() {
  unregisterWatcher();
  unregisterCustomShortcut();
  registerListener();

  const settings = SettingsManager.getAll();

  if (!settings.screenshots) {
    const oldDir = settings.screenshotDir;
    SettingsManager.set('screenshots', {
      allowCustomShortcut: true,
      allowFolderWatch: false,
      screenshotDir: oldDir ?? 'disabled',
    });
  }

  const screenshotsSettings = SettingsManager.get('screenshots');
  if (
    screenshotsSettings.allowFolderWatch &&
    screenshotsSettings.screenshotDir &&
    screenshotsSettings.screenshotDir !== 'disabled' &&
    screenshotsSettings.screenshotDir.length > 0
  ) {
    registerWatcher(screenshotsSettings.screenshotDir);
  } else {
    logger.info('Screenshot directory is disabled');
  }

  if (screenshotsSettings.allowCustomShortcut) {
    registerCustomShortcut();
    logger.info('Custom shortcut is enabled');
  }
}

export default {
  start,
  emitter,
  process: processScreenshot,
};
