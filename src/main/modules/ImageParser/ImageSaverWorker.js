const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

async function initialize({ filePath }) {
  await fs.mkdir(filePath, { recursive: true });
}

async function saveImage({ imageBuffer, filename, filePath }) {
  const outputPath = path.join(filePath, `${filename}.png`);
  await sharp(imageBuffer).png().toFile(outputPath);
}

module.exports = {
  initialize,
  saveImage,
};
