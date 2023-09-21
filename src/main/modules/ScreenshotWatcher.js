import sharp from 'sharp';
// const Jimp = require('jimp');
// const convert = require('color-convert');
// const fs = require('fs');
const path = require('path');
const moment = require('moment');
const chokidar = require('chokidar');
const logger = require('electron-log').scope('main-screenshot-watcher');
const EventEmitter = require('events');
const OCRWatcher = require('./OCRWatcher');

// const SCREENSHOT_DIRECTORY_SIZE_LIMIT = 400;

var settings;
var watcher;
var currentWatchDirectory;

var app = require('electron').app || require('@electron/remote').app;
var emitter = new EventEmitter();

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
const getYboundsFromImage = (rawImage, metadata) => {
  const batchSize = Math.floor(metadata.height / 5); // Size of the batch of rows to check together
  const firstLineMargin = 5; // Margin to make the top line a bit more readable
  const endDetectionHeight = 15; // Height of the bottom limit we detect (Answer to "After how many pixels do we consider this box to be done?")
  const detectionWidth = 50; // Number of pixels to check for detection. We do not need the full line but we need enough pixels to start capturing blue pixels
  const startDetectionHeight = 2; // Height of the top limit we detect (Answer to "After how many black pixels do we consider this box to start?")
  const minBluePixels = 5;

  const errorMargin = 1;

  let isDone = false;
  let columnsOffset = 0;
  let firstLine = 0;
  let lastLine = -1;

  while (!isDone && columnsOffset < metadata.height) {
    const lines = [];

    // On each Line in a batch
    for (let y = columnsOffset; y < batchSize + columnsOffset; y++) {
      let bluePixels = 0;
      let blackPixels = 0;
      const colors = [];

      // Check each pixel on each line for blueness or blackness
      for (let x = metadata.width - detectionWidth; x < metadata.width; x++) {
        const pixelColor = getPixelColor(rawImage, x, y, metadata.width);
        colors.push(pixelColor);
        if (isBlue(pixelColor)) {
          // logger.info(`Found blue pixel at x=${x} y=${y} (${pixelColor}))`);
          bluePixels++;
        } else if (isBlack(pixelColor, 15)) {
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
      const lastLinesForStart = lastLines.slice(
        lastLines.length - startDetectionHeight - 2,
        lastLines.length - 2
      );

      const lastBlues = Math.max(...lastLinesForStart.map((line) => line.blue));
      const lastBlacks = Math.min(...lastLinesForStart.map((line) => line.black));
      const isFirstLine =
        firstLine <= 0 &&
        bluePixels > minBluePixels &&
        // bluePixels + blackPixels >= detectionWidth - errorMargin &&
        // lastLinesForStart.length >= startDetectionHeight &&
        lastBlues === 0 &&
        lastBlacks >= detectionWidth - errorMargin;

      // If we do not have a first line, and we are getting a first line with blues, this is the one
      if (isFirstLine) {
        logger.info(`Found first line of the mod box with ${bluePixels} blues at y=${y}`);
        firstLine = y - firstLineMargin;
      }

      const isEndOfBlackBackground =
        y - endDetectionHeight > firstLine && // We are at least endDetectionHeight away from first line
        lastLines.length >= endDetectionHeight - 2 && // We have the right amount of lines to check (at least endDetectionHeight - 2)
        blackPixels < detectionWidth && // We do not have only black pixels
        bluePixels < 1 && // We have no blue pixels
        Math.min(...lastLines.map((line) => line.black)) === 0; // The minimum amount of black pixels in the batch is the same we're getting now
      const isTooFarAfterBlueText =
        bluePixels < 1 && // No blue pixels on this line
        y - endDetectionHeight > firstLine && // We are at least endDetectionHeight away from first line
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
const getXBoundsFromImage = (rawImage, metadata, yBounds) => {
  const widthMargin = 40;
  const blueArray = [];
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

const getPixelColor = (rawData, x, y, width) => {
  const offset = (y * width + x) * 3;
  return {
    r: rawData[offset],
    g: rawData[offset + 1],
    b: rawData[offset + 2],
    // a: rawData[offset + 3],
  };
};

const getBounds = async (image) => {
  const { data, info } = await image.raw({ depth: 'char' }).toBuffer({ resolveWithObject: true });
  const yBounds = getYboundsFromImage(data, info);
  const xBounds = [Math.floor(info.width * 3/4), info.width]
  logger.info(`Bounds - x: ${xBounds} - y: ${yBounds}`);

  return {
    x: xBounds,
    y: yBounds,
  };
};

function tryClose() {
  if (watcher) {
    try {
      watcher.close();
      watcher.unwatch(currentWatchDirectory);
      watcher = null;
      currentWatchDirectory = null;
    } catch (err) {
      logger.info('Error closing screenshot watcher: ' + err.message);
    }
  }
}

function start() {
  tryClose();

  settings = require('./settings').get();

  if (
    settings.screenshotDir &&
    settings.screenshotDir !== 'disabled' &&
    settings.screenshotDir.length > 0
  ) {
    logger.info('Watching ' + settings.screenshotDir);
    watcher = chokidar.watch(`${settings.screenshotDir}`, {
      usePolling: true,
      awaitWriteFinish: true,
      ignoreInitial: true,
      disableGlobbing: true,
    });
    watcher.on('add', (path) => {
      logger.info('Cropping new screenshot: ' + path);
      process(path);
    });
    currentWatchDirectory = settings.screenshotDir;
  } else {
    logger.info('Screenshot directory is disabled');
  }
}

async function process(file) {
  const filepath = path.join(app.getPath('userData'), '.temp_capture');
  const filePrefix = moment().format('YMMDDHHmmss');
  if (file.length > 0) {
    const kernel = [-1 / 8, -1 / 8, -1 / 8, -1 / 8, 2, -1 / 8, -1 / 8, -1 / 8, -1 / 8];
    const image = await sharp(file).jpeg().sharpen();

    // We might need to deal with scaleFactor later
    // await image.metadata().then(({ width }) => {
    //   // 1920 x 1080 image scaled up 3x;
    //   // scale differently sized images proportionately
    //   const scaleFactor = 3 * (1920 / width);
    //   return image.resize(Math.round(width * scaleFactor))
    // });
    const metadata = await image.metadata();
    const bounds = await getBounds(image);

    // take only rightmost 14% of screen for area info (no area name is longer than this)
    const areaInfoWidth = Math.floor(metadata.width * 0.14);

    // Stats
    const statsDimensions = {
      width: areaInfoWidth,
      height: bounds.y[0] - 24,
      top: 24,
      left: metadata.width - areaInfoWidth,
    };
    const statsPath = path.join(filepath, `${filePrefix}_area.png`);
    logger.info(`Saving stats to ${statsPath} with dimenstions: `, statsDimensions);
async function processBuffer(buffer) {
  const filePrefix = moment().format('YMMDDHHmmss');
  const kernel = [-1 / 8, -1 / 8, -1 / 8, -1 / 8, 2, -1 / 8, -1 / 8, -1 / 8, -1 / 8];
  const image = await sharp(buffer).jpeg().sharpen();

  // We might need to deal with scaleFactor later
  // await image.metadata().then(({ width }) => {
  //   // 1920 x 1080 image scaled up 3x;
  //   // scale differently sized images proportionately
  //   const scaleFactor = 3 * (1920 / width);
  //   return image.resize(Math.round(width * scaleFactor))
  // });
  const metadata = await image.metadata();
  try {
    const bounds = await getBounds(image);
      
    // take only rightmost 14% of screen for area info (no area name is longer than this)
    const areaInfoWidth = Math.floor(metadata.width * 0.14);

    // Stats
    const statsDimensions = {
      width: areaInfoWidth,
      height: bounds.y[0] - 24,
      top: 24,
      left: metadata.width - areaInfoWidth,
    };

    // await image
    //   .clone()
    //   .extract(statsDimensions)
    //   .normalise({ lower: 0, upper: 100 })
    //   .negate()
    //   .greyscale()
    //   .convolve({ width: 3, height: 3, kernel })
    //   .png()
    //   .toFile(statsPath);

    const statsImage = await image
      .clone()
      .extract(statsDimensions)
      .normalise({ lower: 0, upper: 100 })
      .negate()
      .greyscale()
      .convolve({ width: 3, height: 3, kernel })
      .png()
      .toBuffer();


    // MODS:
    const modsDimensions = {
      width: bounds.x[1] - bounds.x[0],
      height: bounds.y[1] - bounds.y[0],
      top: bounds.y[0],
      left: bounds.x[0],
    };
    // await image
    //   .clone()
    //   .extract(modsDimensions)
    //   .normalise({ lower: 0, upper: 100 })
    //   .negate()
    //   .greyscale()
    //   .convolve({ width: 3, height: 3, kernel })
    //   .png()
    //   .toFile(modsPath);
    
    const modsImage = await image
      .clone()
      .extract(modsDimensions)
      .normalise({ lower: 0, upper: 100 })
      .negate()
      .greyscale()
      .convolve({ width: 3, height: 3, kernel })
      .png()
      .toBuffer();
    

    await Promise.all([
      OCRWatcher.processImageBuffer(statsImage, filePrefix, 'area'),
      OCRWatcher.processImageBuffer(modsImage, filePrefix, 'mods')
    ]);
  } catch (e) {
    logger.error("Error in mods detection", e);
    const fs = require('fs');
    fs.writeFileSync('buffer.png', buffer);
    image.png().toFile('image.png');
    return;
  }

    
}

// function enhanceImage(image, scaleFactor) {
//   image.scale(scaleFactor, Jimp.RESIZE_BEZIER);
//   image.invert();
//   image.greyscale();
//   /*
//   image.convolute([
//     [0, 0, 0, 0, 0],
//     [0, 0, -1, 0, 0],
//     [0, -1, 5, -1, 0],
//     [0, 0, -1, 0, 0],
//     [0, 0, 0, 0, 0]
//   ]);
//   */
//   image.convolute([
//     [-1 / 8, -1 / 8, -1 / 8],
//     [-1 / 8, 2, -1 / 8],
//     [-1 / 8, -1 / 8, -1 / 8],
//   ]);
//   image.brightness(-0.43);
//   image.contrast(0.75);
// }

function isBlue(rgba) {
  // Old code:
  // var hsv = convert.rgb.hsl([rgba.r, rgba.g, rgba.b]);
  // map mod blue:
  // hue 240
  // saturation + value > 40
  // red and green components equal and both > 70
  // rgb: 8888ff
  // const isBlue = hsv[0] = 240 && hsv[1] + hsv[2] > 80 && rgba.r === rgba.g && rgba.r > 70;

  const blue = {
    r: 88,
    g: 88,
    b: 255,
  };

  const { r, g, b } = {
    r: Math.abs(rgba.r - blue.r),
    g: Math.abs(rgba.g - blue.g),
    b: Math.abs(rgba.b - blue.b),
  };
  const isBlue = r * r + g * g + b * b < 20000;
  return isBlue;
}

function isBlack(rgba, tolerance) {
  const linear = ({} = rgba);
  for (const key in linear) {
    linear[key] =
      linear[key] <= 0.04045 ? linear[key] / 12.92 : Math.pow((linear[key] + 0.055) / 1.055, 2.4);
  }
  const { r, g, b } = linear;
  const luminance = 0.2126 * linear.r + 0.7152 * linear.g + 0.0722 * linear.b;
  const lstar =
    (luminance < 216 / 24389 ? luminance * (24389 / 27) : Math.pow(luminance, 1 / 3) * 116 - 16) /
    100;

  // if(lstar > 90) logger.info(`Luminance: ${luminance} lstar: ${lstar}`)
  // logger.info(Math.sqrt(
  //   0.299 * (r * r) +
  //   0.587 * (g * g) +
  //   0.114 * (b * b)
  // ))
  // return Math.sqrt(
  //   0.299 * (r * r) +
  //   0.587 * (g * g) +
  //   0.114 * (b * b)
  //   ) > 127.5;
  return lstar <= tolerance;

  // // sRGB luminance(Y) values
  // const rY = 0.212655;
  // const gY = 0.715158;
  // const bY = 0.072187;
}

function logFailedCapture(e) {
  logger.info(`Error processing screenshot: ${e}`);
  emitter.emit('OCRError');
}

function test(file) {
  process(file);
}

export default {
  start,
  emitter,
  test,
  processBuffer,
};
