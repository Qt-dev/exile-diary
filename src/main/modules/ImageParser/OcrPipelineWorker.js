const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

function comparePixelColors(pixel1, pixel2, tolerance) {
  const distance = {
    r: Math.abs(pixel1.r - pixel2.r),
    g: Math.abs(pixel1.g - pixel2.g),
    b: Math.abs(pixel1.b - pixel2.b),
  };

  return distance.r * distance.r + distance.g * distance.g + distance.b * distance.b < tolerance;
}

function isBlue(pixel) {
  return comparePixelColors(
    pixel,
    {
      r: 88,
      g: 88,
      b: 255,
    },
    20000
  );
}

function isOrange(pixel) {
  return comparePixelColors(
    pixel,
    {
      r: 150,
      g: 120,
      b: 100,
    },
    2000
  );
}

function isBlack(rgba, tolerance) {
  const linear = { ...rgba };
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

function getMargin(rawImage, metadata) {
  const marginHeight = Math.floor(metadata.height * 0.1);
  const lineIndex = metadata.height - (metadata.height - marginHeight);
  const line = rawImage.slice(metadata.width * lineIndex, metadata.width * (lineIndex + 1));

  let margin = 0;
  for (let x = 0; x < line.length; x++) {
    const actualIndex = line.length - (1 + x);
    const pixel = line[actualIndex];
    if (pixel.r + pixel.g + pixel.b > 10) {
      margin = x + 1;
      break;
    }
  }

  return margin;
}

function getModsYBounds(rawImage, margin, boxMargin, metadata) {
  const modsBox = { start: -1, end: -1 };
  const detectionHeightStartIndex = Math.floor(metadata.height * 0.1);
  const detectionWidth = 30;
  const endOfBoxThreshold = 15;
  let orangeLineIndex = -1;

  for (let y = detectionHeightStartIndex; y < metadata.height - 1; y++) {
    let orangePixels = 0;
    for (let x = metadata.width - margin - detectionWidth; x < metadata.width - margin; x++) {
      const pixel = rawImage[y * metadata.width + x];
      if (isOrange(pixel)) {
        orangePixels++;
      }
    }

    if (orangePixels >= detectionWidth * 0.7) {
      orangeLineIndex = y;
      break;
    }
  }

  if (orangeLineIndex === -1) {
    return modsBox;
  }

  const lines = [];
  for (let y = orangeLineIndex + 5; y < metadata.height - 1; y++) {
    let bluePixels = 0;
    let blackPixels = 0;

    for (let x = metadata.width - margin - detectionWidth; x < metadata.width - margin - 1; x++) {
      const pixel = rawImage[y * metadata.width + x];
      if (isBlue(pixel)) {
        bluePixels++;
      } else if (isBlack(pixel, 50)) {
        blackPixels++;
      }
    }

    lines.push({ blue: bluePixels, black: blackPixels });

    if (modsBox.start === -1 && bluePixels >= 6) {
      const previousLine = lines.length > 1 ? lines[lines.length - 2] : null;
      if (previousLine && previousLine.black >= detectionWidth * 0.9) {
        modsBox.start = y - boxMargin;
      }
    } else if (
      modsBox.start !== -1 &&
      modsBox.end === -1 &&
      blackPixels >= detectionWidth * 0.9 &&
      bluePixels <= 2 &&
      lines.length >= endOfBoxThreshold &&
      Math.max(...lines.slice(-endOfBoxThreshold).map((line) => line.blue)) <= 2 &&
      Math.max(...lines.slice(-endOfBoxThreshold).map((line) => line.black)) >= 15
    ) {
      modsBox.end = y + boxMargin;
      break;
    }
  }

  return modsBox;
}

function getModsXBounds(rawImage, margin, boxMargin, yBounds, metadata) {
  const blueArray = [];
  const imageWidth = metadata.width - 1 - margin;
  let xBoundary = 0;

  for (let x = imageWidth; x > 0; x--) {
    let pixelCount = 0;

    for (let y = yBounds.start; y < yBounds.end; y++) {
      const pixel = rawImage[y * metadata.width + x];
      if (isBlue(pixel)) {
        pixelCount++;
      }
    }

    blueArray.push(pixelCount);

    if (blueArray.length === boxMargin) {
      const blueAvg = blueArray.reduce((sum, value) => sum + value, 0) / boxMargin;
      if (blueAvg < 1) {
        xBoundary = x;
        break;
      }
      blueArray.shift();
    }
  }

  return { start: xBoundary, end: metadata.width - margin };
}

function getModsBox(rawImage, margin, metadata) {
  const boxMargin = 10;
  const y = getModsYBounds(rawImage, margin, boxMargin, metadata);

  if (y.start === -1 || y.end === -1 || y.end <= y.start) {
    return null;
  }

  const x = getModsXBounds(rawImage, margin, boxMargin, y, metadata);

  if (x.end <= x.start) {
    return null;
  }

  return { x, y };
}

async function saveDebugArtifacts({ debugArtifactDir, screenshot, preprocessed }) {
  if (!debugArtifactDir) {
    return;
  }

  await fs.mkdir(debugArtifactDir, { recursive: true });
  await sharp(screenshot).png().toFile(path.join(debugArtifactDir, 'screenshot.png'));
  await sharp(preprocessed).png().toFile(path.join(debugArtifactDir, 'mods-preprocessed.png'));
}

async function preprocessMapModsScreenshot({
  screenshotBuffer,
  debugArtifactDir,
  forceFullImage = false,
}) {
  const timingsMs = {
    preprocess: 0,
  };
  const preprocessStartedAt = performance.now();

  const metadata = await sharp(screenshotBuffer).metadata();
  const { width: originalWidth, height: originalHeight } = metadata;
  if (!originalWidth || !originalHeight) {
    throw new Error('Unable to read screenshot dimensions');
  }

  const targetHeight = 1080;
  const scale = Number((targetHeight / originalHeight).toFixed(2));
  const targetWidth = Math.max(1, Math.round(originalWidth * scale));
  const resizedImage = await sharp(screenshotBuffer)
    .resize(targetWidth, targetHeight)
    .png()
    .toBuffer();

  const rawImage = await sharp(resizedImage).clone().raw({ depth: 'char' }).toBuffer();
  const formattedRawImage = rawImage.reduce((acc, value, index) => {
    if (index % 3 === 0) {
      acc.push({ r: value, g: rawImage[index + 1], b: rawImage[index + 2] });
    }
    return acc;
  }, []);

  const margin = forceFullImage
    ? 0
    : getMargin(formattedRawImage, {
        height: targetHeight,
        width: targetWidth,
      });
  const modsBox = forceFullImage
    ? null
    : getModsBox(formattedRawImage, margin, {
        height: targetHeight,
        width: targetWidth,
      });

  const region = modsBox
    ? {
        width: modsBox.x.end - modsBox.x.start,
        height: modsBox.y.end - modsBox.y.start,
        top: modsBox.y.start,
        left: modsBox.x.start,
      }
    : {
        width: targetWidth,
        height: targetHeight,
        top: 0,
        left: 0,
      };

  const modsImage = await sharp(resizedImage)
    .extract(region)
    .resize(Math.max(1, Math.floor(region.width * 2)))
    .grayscale()
    .normalize()
    .negate()
    .threshold(50)
    .sharpen()
    .png()
    .toBuffer();

  await saveDebugArtifacts({
    debugArtifactDir,
    screenshot: resizedImage,
    preprocessed: modsImage,
  });

  timingsMs.preprocess = Number((performance.now() - preprocessStartedAt).toFixed(4));

  return {
    modsImage,
    detectedRegion: region,
    timingsMs,
    debugArtifactDir,
    usedFallbackRegion: forceFullImage || !modsBox,
  };
}

module.exports = {
  preprocessMapModsScreenshot,
};
