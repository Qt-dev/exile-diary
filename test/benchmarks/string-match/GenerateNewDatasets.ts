import * as fs from 'fs';
import * as path from 'path';

/**
 * Generate new test datasets with OCR-style corruptions
 *
 * Requirements:
 * - 6 datasets: 3 small (10 mods each), 2 medium (20 & 30 mods), 1 large (40 mods)
 * - All mods from src/helpers/data/mapMods.json
 * - OCR-style corruptions: character replacements, additions, deletions
 * - At least 10% corruption on first character
 * - At least 30% of strings corrupted, max 20% of string length
 */

interface TestData {
  original: string;
  corrupted: string;
  expected: string;
}

interface TestDatasets {
  small1: TestData[];
  small2: TestData[];
  small3: TestData[];
  medium1: TestData[];
  medium2: TestData[];
  large1: TestData[];
}

class DatasetGenerator {
  private mapMods: string[] = [];
  private usedMods: Set<string> = new Set();

  // Common OCR character replacements
  private readonly OCR_REPLACEMENTS: Record<string, string[]> = {
    A: ['4', '@', 'Á', 'À', 'Â'],
    a: ['@', 'à', 'á', 'â', 'ä'],
    B: ['8', '6', 'ß'],
    b: ['6', 'ß', 'þ'],
    C: ['G', 'O', 'Ç'],
    c: ['e', 'o', 'ç'],
    D: ['O', '0', 'Ð'],
    d: ['o', '0', 'ð'],
    E: ['F', '3', 'É', 'È', 'Ê'],
    e: ['3', 'é', 'è', 'ê', 'ë'],
    F: ['E', 'P'],
    f: ['t', 'ƒ'],
    G: ['6', 'C', 'O'],
    g: ['9', 'q'],
    H: ['N', '#'],
    h: ['n', 'þ'],
    I: ['1', 'l', '!', 'Í', 'Ì', 'Î'],
    i: ['1', 'l', '!', 'í', 'ì', 'î', 'ï'],
    J: ['I', '1'],
    j: ['i', '1'],
    K: ['X', 'H'],
    k: ['x', 'h'],
    L: ['1', 'I', '|'],
    l: ['1', 'I', '|', 'i'],
    M: ['N', 'W'],
    m: ['n', 'w', 'rn'],
    N: ['M', 'H'],
    n: ['m', 'h', 'ri'],
    O: ['0', 'Q', 'C', 'Ó', 'Ò', 'Ô'],
    o: ['0', 'q', 'c', 'ó', 'ò', 'ô', 'ö'],
    P: ['F', 'R'],
    p: ['q', 'r'],
    Q: ['O', '0', 'G'],
    q: ['o', '0', 'g'],
    R: ['P', 'B'],
    r: ['n', 'i'],
    S: ['5', '$', 'Z'],
    s: ['5', '$', 'z'],
    T: ['1', 'I', 'F'],
    t: ['1', 'i', 'f'],
    U: ['V', 'Ú', 'Ù', 'Û'],
    u: ['v', 'ú', 'ù', 'û', 'ü'],
    V: ['U', 'Y'],
    v: ['u', 'y'],
    W: ['M', 'VV'],
    w: ['m', 'vv'],
    X: ['K', 'x'],
    x: ['k', 'X'],
    Y: ['V', 'Ý'],
    y: ['v', 'ý', 'ÿ'],
    Z: ['2', 'S'],
    z: ['2', 's'],
    '0': ['O', 'o', 'Q'],
    '1': ['I', 'l', 'i', '|'],
    '2': ['Z', 'z'],
    '3': ['E', 'e'],
    '4': ['A', 'a'],
    '5': ['S', 's'],
    '6': ['G', 'g', 'b'],
    '7': ['T', 't'],
    '8': ['B', 'b'],
    '9': ['g', 'q'],
    '#': ['H', 'N', '%'],
    '%': ['#', 'X'],
    ' ': ['_', '-', '.'],
  };

  // Additional characters for OCR artifacts
  private readonly ARTIFACT_CHARS = [
    '`',
    '~',
    '°',
    '·',
    '¿',
    '¡',
    '«',
    '»',
    '‹',
    '›',
    '¦',
    '¨',
    '¯',
    '´',
    '¸',
  ];

  constructor() {
    this.loadMapMods();
  }

  private loadMapMods(): void {
    const mapModsPath = path.join(__dirname, '..', 'src', 'helpers', 'data', 'mapMods.json');
    const data = JSON.parse(fs.readFileSync(mapModsPath, 'utf8'));
    this.mapMods = data.mapMods;
    console.log(`Loaded ${this.mapMods.length} map mods`);
  }

  private getRandomMod(): string {
    let attempts = 0;
    while (attempts < 100) {
      const randomIndex = Math.floor(Math.random() * this.mapMods.length);
      const mod = this.mapMods[randomIndex];
      if (!this.usedMods.has(mod)) {
        this.usedMods.add(mod);
        return mod;
      }
      attempts++;
    }

    // If we've used too many mods, reset and try again
    if (this.usedMods.size > this.mapMods.length * 0.8) {
      this.usedMods.clear();
      return this.getRandomMod();
    }

    // Fallback: just use a random mod even if used
    const randomIndex = Math.floor(Math.random() * this.mapMods.length);
    return this.mapMods[randomIndex];
  }

  private corruptString(original: string, shouldCorruptFirstChar: boolean = false): string {
    if (original.length === 0) return original;

    let corrupted = original;
    const maxCorruptions = Math.max(1, Math.floor(original.length * 0.2)); // Max 20% of string length
    const numCorruptions = Math.floor(Math.random() * maxCorruptions) + 1;

    // Track positions we've corrupted to avoid double-corruption
    const corruptedPositions = new Set<number>();

    // Force first character corruption if required
    if (shouldCorruptFirstChar) {
      corrupted = this.corruptCharacterAt(corrupted, 0);
      corruptedPositions.add(0);
    }

    // Apply remaining corruptions
    const remainingCorruptions = shouldCorruptFirstChar ? numCorruptions - 1 : numCorruptions;

    for (let i = 0; i < remainingCorruptions; i++) {
      let position;
      let attempts = 0;

      // Find an unused position
      do {
        position = Math.floor(Math.random() * corrupted.length);
        attempts++;
      } while (corruptedPositions.has(position) && attempts < 20);

      if (attempts < 20) {
        corrupted = this.corruptCharacterAt(corrupted, position);
        corruptedPositions.add(position);
      }
    }

    return corrupted;
  }

  private corruptCharacterAt(text: string, position: number): string {
    if (position >= text.length) return text;

    const chars = text.split('');
    const currentChar = chars[position];
    const corruptionType = Math.floor(Math.random() * 3);

    switch (corruptionType) {
      case 0: // Character replacement
        if (this.OCR_REPLACEMENTS[currentChar]) {
          const replacements = this.OCR_REPLACEMENTS[currentChar];
          chars[position] = replacements[Math.floor(Math.random() * replacements.length)];
        } else {
          // Random similar character
          const similarChars = ['o', '0', 'i', '1', 'l', 'I', 'e', '3', 'a', '@'];
          chars[position] = similarChars[Math.floor(Math.random() * similarChars.length)];
        }
        break;

      case 1: // Character addition (artifact)
        const artifact =
          this.ARTIFACT_CHARS[Math.floor(Math.random() * this.ARTIFACT_CHARS.length)];
        chars.splice(position, 0, artifact);
        break;

      case 2: // Character deletion
        chars.splice(position, 1);
        break;
    }

    return chars.join('');
  }

  private generateDataset(size: number, name: string): TestData[] {
    console.log(`Generating ${name} dataset with ${size} entries...`);
    const dataset: TestData[] = [];

    // At least 30% should be corrupted
    const minCorrupted = Math.ceil(size * 0.3);
    // At least 10% should have first character corrupted
    const minFirstCharCorrupted = Math.ceil(size * 0.1);

    let firstCharCorruptedCount = 0;
    let totalCorruptedCount = 0;

    for (let i = 0; i < size; i++) {
      const original = this.getRandomMod();
      const expected = original; // Expected is always the original clean mod

      // Determine if this entry should be corrupted
      const shouldCorrupt = totalCorruptedCount < minCorrupted || Math.random() < 0.5;

      // Determine if first character should be corrupted
      const shouldCorruptFirst = firstCharCorruptedCount < minFirstCharCorrupted && shouldCorrupt;

      let corrupted: string;
      if (shouldCorrupt) {
        corrupted = this.corruptString(original, shouldCorruptFirst);
        totalCorruptedCount++;
        if (shouldCorruptFirst) {
          firstCharCorruptedCount++;
        }
      } else {
        corrupted = original; // Some entries remain clean
      }

      dataset.push({
        original,
        corrupted,
        expected,
      });
    }

    console.log(
      `${name}: ${totalCorruptedCount}/${size} corrupted (${(
        (totalCorruptedCount / size) *
        100
      ).toFixed(1)}%), ${firstCharCorruptedCount} first-char corrupted`
    );
    return dataset;
  }

  public generateAllDatasets(): TestDatasets {
    console.log('Generating new test datasets...');

    // Reset used mods for each generation
    this.usedMods.clear();

    const datasets: TestDatasets = {
      small1: this.generateDataset(10, 'Small Dataset 1'),
      small2: this.generateDataset(10, 'Small Dataset 2'),
      small3: this.generateDataset(10, 'Small Dataset 3'),
      medium1: this.generateDataset(20, 'Medium Dataset 1'),
      medium2: this.generateDataset(30, 'Medium Dataset 2'),
      large1: this.generateDataset(40, 'Large Dataset'),
    };

    console.log('\nDataset generation complete!');
    console.log(`Total unique mods used: ${this.usedMods.size}`);

    return datasets;
  }

  public saveDatasets(datasets: TestDatasets, outputPath: string): void {
    const content = `/**
 * Generated test datasets with OCR-style corruptions
 * 
 * All expected outputs are valid entries from src/helpers/data/mapMods.json
 * 
 * Dataset specifications:
 * - Small datasets: 10 mods each (3 datasets)
 * - Medium datasets: 20 and 30 mods respectively
 * - Large dataset: 40 mods
 * 
 * Corruption characteristics:
 * - At least 30% of strings are corrupted
 * - At least 10% have first character corrupted
 * - Maximum 20% of string length affected
 * - Realistic OCR errors: character replacements, additions, deletions
 */

interface TestData {
  original: string;
  corrupted: string;
  expected: string;
}

export const NEW_TEST_DATASETS = ${JSON.stringify(datasets, null, 2)};
`;

    fs.writeFileSync(outputPath, content);
    console.log(`\nDatasets saved to: ${outputPath}`);
  }
}

// Generate and save the datasets
const generator = new DatasetGenerator();
const datasets = generator.generateAllDatasets();
const outputPath = path.join(__dirname, 'NewTestDatasets.ts');
generator.saveDatasets(datasets, outputPath);

console.log('\nGeneration complete! The new datasets are ready to use.');
