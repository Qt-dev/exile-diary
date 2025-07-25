// A simple worker function that adds two numbers
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

export const filename = path.resolve(__filename);

export async function initialize({ filePath }: { filePath: string }): Promise<void> {
  await fs.mkdir(filePath, { recursive: true });
}

export async function saveImage({
  imageBuffer,
  filename,
  filePath,
}: {
  imageBuffer: Buffer;
  filename: string;
  filePath: string;
}): Promise<void> {
  const outputPath = path.join(filePath, `${filename}.png`);

  await sharp(imageBuffer).png().toFile(outputPath);
}
