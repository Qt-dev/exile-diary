import sharp, { kernel } from 'sharp';
import fs from 'fs/promises';
import SettingsManager from '../SettingsManager';
import path from 'path';
import dayjs from 'dayjs';
import chokidar, { type FSWatcher } from 'chokidar';
import Logger from 'electron-log';
import EventEmitter from 'events';
import OCRWatcher from './OCRWatcher';
import { app, globalShortcut } from 'electron';
const logger = Logger.scope('main-screenshot-watcher');
const ProcessingTimeout = 15000;

// const SCREENSHOT_DIRECTORY_SIZE_LIMIT = 400;
const sizeMultiplier = 3; // We read pixels from a screenshot that is in 1920x1080 * this multiplier
const customShortcutTrigger = 'CommandOrControl+F8';
let watcher: FSWatcher | null;
const emitter = new EventEmitter();

/*
 * Detects the bottom edge of the list of map mods.
 *
 * The map mod list is a solid block of pixels that are either black or blue,
 * in the upper-right corner of the screen
 *
 * So we check each row of {detectionWidth} pixels from the top, in batches of {batchSize}.
 * When we find a fully black row right before a row that contains black + blue, we mark it as the first line.
 * We then check until we find either:
 *  - A non black background line right after {endDetectionHeight} lines of black -> End of the black box
 *  - A line with no blues after {endDetectionHeight} lines with no blues -> End of the mods, even on a black background
 *
 * If we did not find the end of the box, we just return the total height as the bottom boundary.
 */
const getYboundsFromImage = (rawImage: any, metadata: { height: number; width: number }) => {
  type lineData = { blue: number; black: number; total: number };
  const batchSize = Math.floor(metadata.height / 5); // Size of the batch of rows to check together
  const firstLineMargin = 2; // Margin to make the top line a bit more readable
  const endDetectionHeight = 40; // Height of the bottom limit we detect (Answer to "After how many pixels do we consider this box to be done?")
  const detectionWidth = 40; // Number of pixels to check for detection. We do not need the full line but we need enough pixels to start capturing blue pixels
  const marginAfterOrange = 55; // Margin after the first orange line to start checking for the end of the box. Distance between bottom of stats and beginning of first mod (-5 px to give room)
  const minOrangePixels = 10;
  const initialFirstLine = 200;

  let isDone = false;
  let columnsOffset = initialFirstLine;
  let firstLine = initialFirstLine;
  let lastLine = -1;

  while (!isDone && columnsOffset < metadata.height) {
    const lines: lineData[] = [];

    // On each Line in a batch
    for (let y = columnsOffset; y < batchSize + columnsOffset; y++) {
      let bluePixels = 0;
      let blackPixels = 0;
      let orangePixels = 0;
      const colors: { r: number; g: number; b: number }[] = [];

      // Check each pixel on each line for blueness or blackness
      for (let x = metadata.width - detectionWidth; x < metadata.width; x++) {
        const pixelColor = getPixelColor(rawImage, x, y, metadata.width);
        colors.push(pixelColor);
        if (isBlue(pixelColor)) {
          // logger.info(`Found blue pixel at x=${x} y=${y} (${JSON.stringify(pixelColor)}))`);
          bluePixels++;
        } else if (isOrange(pixelColor)) {
          // logger.info(`Found orange pixel at x=${x} y=${y} (${JSON.stringify(pixelColor)}))`);
          orangePixels++;
        } else if (isBlack(pixelColor, 50)) {
          // logger.info(`Found black pixel at x=${x} y=${y} (${JSON.stringify(pixelColor)}))`);
          blackPixels++;
        }
      }

      lines.push({
        blue: bluePixels,
        black: blackPixels,
        total: bluePixels + blackPixels,
      });

      const lastLines = lines.slice(lines.length - endDetectionHeight - 2, lines.length - 2);

      const isFirstLine = firstLine <= initialFirstLine && orangePixels > minOrangePixels;

      // If we do not have a first line, and we are getting a first line with blues, this is the one
      if (isFirstLine) {
        logger.info(`Found first line of the mod box with ${orangePixels} oranges at y=${y}`);
        firstLine = y + marginAfterOrange - firstLineMargin;
      }

      const isEndOfBlackBackground =
        firstLine > initialFirstLine &&
        y - (endDetectionHeight + marginAfterOrange) > firstLine && // We are at least endDetectionHeight away from first line
        lastLines.length >= endDetectionHeight - 2 && // We have the right amount of lines to check (at least endDetectionHeight - 2)
        blackPixels < detectionWidth && // We do not have only black pixels
        bluePixels < 1 && // We have no blue pixels
        Math.min(...lastLines.map((line) => line.black)) === 0; // The minimum amount of black pixels in the batch is the same we're getting now
      const isTooFarAfterBlueText =
        firstLine > initialFirstLine && // We detected a first line
        bluePixels < 1 && // No blue pixels on this line
        y - endDetectionHeight > firstLine + marginAfterOrange && // We are at least endDetectionHeight away from first line
        lastLines.length >= endDetectionHeight - 2 && // We have the right amount of lines to check (at least endDetectionHeight - 2)
        Math.max(...lastLines.map((line) => line.blue)) === 0; // The maximum amount of blue pixels in the batch is the same we're getting now

      if (firstLine > 0 && lastLine < 0 && (isEndOfBlackBackground || isTooFarAfterBlueText)) {
        logger.info(
          `Found last line of the mod box on y=${y}. isEndOfBlackBackground=${isEndOfBlackBackground} & isTooFarAfterBlueText=${isTooFarAfterBlueText}`
        );
        lastLine = y;
        isDone = true;
        break;
      }
    }

    if (!isDone) {
      columnsOffset += batchSize;
    }
  }
  if (!firstLine) logger.error('Error: Could not find a proper boundary for the mods box');
  if (lastLine === -1) lastLine = metadata.height;
  return [firstLine, lastLine];
};

/**
 * Detects the left border of the mods box
 *
 * We create an array of {marginWidth} width. On every column, we check the number of blue pixels.
 * Then, we check the average of blue pixels on each column in our array.
 * If above 1, we shift and test the next column, once we get below 1, that means we got {marginWidth} columns with a low blue pixels count.
 * @param {*} rawImage The image to iterate over
 * @param {*} metadata The metadata of the image
 * @param {Array} yBounds The y bounds of our mods box
 * @returns an X Boundary
 */
const getXBoundsFromImage = (rawImage: any, metadata: { width: number }, yBounds: number[]) => {
  const widthMargin = 30;
  const blueArray: number[] = [];
  const imageWidth = metadata.width - 1;
  let xBoundary = 0;

  // On each column
  for (let x = imageWidth; x > 0; x--) {
    let pixelCount = 0;

    // Check pixel on every line of our restricted area
    for (let y = yBounds[0]; y < yBounds[1]; y++) {
      const pixelColor = getPixelColor(rawImage, x, y, metadata.width);
      if (isBlue(pixelColor)) {
        pixelCount++;
      }
    }

    blueArray.push(pixelCount);

    // If we have enough lines in the moving array
    if (blueArray.length === widthMargin) {
      const blueAvg = blueArray.reduce((acc, curr) => acc + curr) / widthMargin;
      // If first line with no blue, boundary is here
      if (blueAvg < 1) {
        xBoundary = x;
        break;
      }
      blueArray.shift();
    }
  }

  return [xBoundary, metadata.width];
};

const getPixelColor = (rawData: any[], x: number, y: number, width: number) => {
  const offset = (y * width + x) * 3;
  return {
    r: rawData[offset],
    g: rawData[offset + 1],
    b: rawData[offset + 2],
    // a: rawData[offset + 3],
  };
};

const getBounds = async (image: sharp.Sharp) => {
  const { data, info } = await image
    .clone()
    .raw({ depth: 'char' })
    .toBuffer({ resolveWithObject: true });
  const yBounds = getYboundsFromImage(data, info);
  const xBounds = getXBoundsFromImage(data, info, yBounds);
  logger.info(`Bounds - x: ${xBounds} - y: ${yBounds}`);

  return {
    x: xBounds,
    y: yBounds,
  };
};

/**
 * Main Processing function. It takes a file and processes it to get the mods and stats
 * @param file String of the file location or Buffer of the image
 * @returns Promise<void> Promise that resolves once the processing is done
 */
async function process(file: string | Buffer) {
  const filepath = path.join(app.getPath('userData'), '.dev_captures');
  require('fs').mkdirSync(filepath, { recursive: true });
  const filePrefix = dayjs().format('YYYYMMDDHHmmss');
  // Kernel to use in a convolve to make text look better to be read.
  // const kernel = [-1 / 8, -1 / 8, -1 / 8, -1 / 8, 2, -1 / 8, -1 / 8, -1 / 8, -1 / 8];

  const metadata = await sharp(file).metadata();
  const { width: originalWidth, height: originalHeight } = metadata;
  if (!originalWidth || !originalHeight) throw new Error('Error in getting screenshot size');

  // We need to split this into 2 pipelines because of an issue on Sharp where extract prevents trim from happening
  // https://github.com/lovell/sharp/issues/2103
  const image = await sharp(
    await sharp(file)
      .extract({ top: 0, left: 0, width: originalWidth, height: originalHeight - 10 }) // We need to remove the bottom because screenshots have rounded corners and so the bottom corners break the trim
      .toBuffer()
  )
    .trim({ background: '#000000', threshold: 100 })
    .toBuffer();

  sharp(image).png().toFile(path.join(filepath, 'screenshot.png')); // TODO: Remove for prod

  const { width, height } = await sharp(image).metadata();
  if (!width || !height) throw new Error('Error in getting screenshot size');

  const halfWidth = Math.floor(width / 2);
  const halfDimensions = {
    left: halfWidth,
    top: 0,
    width: halfWidth,
    height: height,
  };

  const scaleFactor = sizeMultiplier * (1920 / width);
  logger.info(`Scaling image by x${scaleFactor}`);
  logger.info(halfDimensions);
  const resizedImage = await sharp(image)
    .png()
    .extract(halfDimensions)
    .resize({ width: Math.floor(halfWidth * scaleFactor) })
    .toBuffer();
  sharp(resizedImage).clone().png().toFile(path.join(filepath, 'cropped-screenshot.png')); // TODO: Remove for prod
  logger.info('Saved cropped screenshot');
  const bounds = await getBounds(sharp(resizedImage));

  // We take only rightmost 14% of screen for area info (no area name is longer than this)
  // 14% of 1920 is 269
  const areaInfoWidth = 269 * sizeMultiplier;

  // Stats
  const statsDimensions = {
    width: areaInfoWidth - 3 * sizeMultiplier, // We strip the right, it will always be a border
    height: bounds.y[0] - 28 * sizeMultiplier - 50, // We strip the top margin above the area text as well as the bottom margin between boxes
    top: 28 * sizeMultiplier,
    left: Math.floor(halfWidth * scaleFactor - areaInfoWidth - 1),
  };
  logger.info('before stats', statsDimensions);

  const statsImageBuffer = await sharp(resizedImage)
    .extract(statsDimensions)
    .negate()
    .modulate({
      hue: 200,
    })
    .normalise({ lower: 1, upper: 85 })
    .greyscale()
    .resize(Math.floor(statsDimensions.width / 2))
    .toBuffer();

  const statsImage = await sharp(statsImageBuffer)
    // .normalise({ lower: 2, upper: 35 })
    .toBuffer();
  sharp(statsImage).toFile(path.join(filepath, 'stats.jpg'));

  // MODS:
  const modsDimensions = {
    width: bounds.x[1] - bounds.x[0],
    height: bounds.y[1] - bounds.y[0],
    top: bounds.y[0],
    left: bounds.x[0],
  };
  logger.info('before mods', modsDimensions);

  const modsImage = await sharp(resizedImage)
    .extract(modsDimensions)
    .resize(Math.floor(modsDimensions.width / 2))
    .png()
    .toBuffer();
  sharp(modsImage).toFile(path.join(filepath, 'mods.jpg'));

  logger.debug(
    `Starting screenshot processing. There are ${OCRWatcher.scheduler.getQueueLen()} items in the queue and ${OCRWatcher.scheduler.getNumWorkers()} workers are running`
  );

  // We make sure we timeout after ProcessingTimeout ms to avoid hanging the process
  const timeout = setTimeout(async () => {
    console.error(
      `There are ${OCRWatcher.scheduler.getQueueLen()} items in the queue, and ${OCRWatcher.scheduler.getNumWorkers()} workers are running`
    );
    emitter.emit('screenshot:timeout');
    // throw new Error('Screenshot processing timed out');
  }, ProcessingTimeout);

  await Promise.all([
    OCRWatcher.processImageBuffer(statsImage, filePrefix, 'area'),
    OCRWatcher.processImageBuffer(modsImage, filePrefix, 'mods'),
  ]);

  // If we got there, things went fine, so we clear the timeout
  clearTimeout(timeout);

  logger.debug('Finished processing screenshot');
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
    process(path);
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
  process,
};
