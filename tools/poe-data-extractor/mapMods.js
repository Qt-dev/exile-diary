import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Reads stat_descriptions.json and generates mapMods.json.
 * The mapMods.json file contains an array named mapMods with all English description texts,
 * where the {0} pattern has been replaced by a # character, sorted alphabetically.
 */
export default async function generateMapMods() {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    // Define file paths
    const inputFilePath = path.join(__dirname, '/output/temp/stat_descriptions.json');
    const outputFilePath = path.join(__dirname, '/output/mapMods.json');

    // Read and parse stat_descriptions.json
    const data = await fs.readFile(inputFilePath, 'utf-8');
    const statDescriptions = JSON.parse(data).descriptions;

    // Extract English description texts and replace {0} with #
    const mapMods = statDescriptions
      .filter(
        (entry) =>
          entry.languages && entry.languages.English && entry.languages.English.descriptions
      )
      .filter((entry) => entry.statId && entry.statId.startsWith('map_'))
      .map((entry) => {
        if (entry.languages && entry.languages.English) {
          return entry.languages.English;
        }
      })
      .flatMap((entry) => {
        return entry.descriptions.map((desc) => {
          return {
            text: desc.text,
          };
        });
      })
      .map((entry) => entry.text.replace(/\{0{0,1}(:\+d){0,1}\}/g, '#'))
      .sort();

    mapMods.unshift(
      '#% increased Quantity of Items found in this Area',
      '#% increased Rarity of Items found in this Area',
      '#% increased Pack size'
    );

    // Write mapMods.json
    const outputData = JSON.stringify({ mapMods }, null, 2);
    await fs.writeFile(outputFilePath, outputData, 'utf-8');

    console.log('mapMods.json has been generated successfully.');
  } catch (error) {
    console.error('Error generating mapMods.json:', error);
  }
}
