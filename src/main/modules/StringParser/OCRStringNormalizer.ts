/**
 * Enhanced String Normalizer for OCR-corrupted text
 *
 * This module handles the preprocessing and normalization of OCR-corrupted strings
 * before they are processed by the BK-Tree or other matching algorithms.
 */

export class OCRStringNormalizer {
  // OCR artifact characters that should be removed or replaced
  private static readonly OCR_ARTIFACTS = [
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

  // Common OCR character replacements (corrupted -> correct)
  private static readonly OCR_REPLACEMENTS: Record<string, string> = {
    // Numbers commonly misread as letters
    '4': 'A',
    '8': 'B',
    '6': 'G',
    '0': 'O',
    '1': 'I',
    '5': 'S',
    '3': 'E',
    '2': 'Z',

    // Letters commonly misread as numbers
    A: '4',
    B: '8',
    G: '6',
    O: '0',
    I: '1',
    S: '5',
    E: '3',
    Z: '2',

    // Special character confusions
    '@': 'A',
    $: 'S',
    '!': 'I',
    '|': 'I',

    // Accented characters to regular characters
    Á: 'A',
    À: 'A',
    Â: 'A',
    Ä: 'A',
    Å: 'A',
    Ã: 'A',
    á: 'a',
    à: 'a',
    â: 'a',
    ä: 'a',
    å: 'a',
    ã: 'a',
    É: 'E',
    È: 'E',
    Ê: 'E',
    Ë: 'E',
    é: 'e',
    è: 'e',
    ê: 'e',
    ë: 'e',
    Í: 'I',
    Ì: 'I',
    Î: 'I',
    Ï: 'I',
    í: 'i',
    ì: 'i',
    î: 'i',
    ï: 'i',
    Ó: 'O',
    Ò: 'O',
    Ô: 'O',
    Ö: 'O',
    Õ: 'O',
    ó: 'o',
    ò: 'o',
    ô: 'o',
    ö: 'o',
    õ: 'o',
    Ú: 'U',
    Ù: 'U',
    Û: 'U',
    Ü: 'U',
    ú: 'u',
    ù: 'u',
    û: 'u',
    ü: 'u',
    Ý: 'Y',
    ý: 'y',
    ÿ: 'y',
    Ç: 'C',
    ç: 'c',
    Ñ: 'N',
    ñ: 'n',

    // Other common OCR errors
    ß: 'B',
    þ: 'b',
    Ð: 'D',
    ð: 'd',
    ƒ: 'f',
  };

  // Bidirectional OCR replacements for more flexible matching
  private static readonly BIDIRECTIONAL_REPLACEMENTS = new Map([
    ['A', ['4', '@', 'Á', 'À', 'Â']],
    ['a', ['@', 'à', 'á', 'â', 'ä']],
    ['B', ['8', '6', 'ß']],
    ['b', ['6', 'ß', 'þ']],
    ['C', ['G', 'O', 'Ç']],
    ['c', ['e', 'o', 'ç']],
    ['D', ['O', '0', 'Ð']],
    ['d', ['o', '0', 'ð']],
    ['E', ['F', '3', 'É', 'È', 'Ê']],
    ['e', ['3', 'é', 'è', 'ê', 'ë']],
    ['G', ['6', 'C', 'O']],
    ['g', ['9', 'q']],
    ['I', ['1', 'l', '!', 'Í', 'Ì', 'Î']],
    ['i', ['1', 'l', '!', 'í', 'ì', 'î', 'ï']],
    ['O', ['0', 'Q', 'C', 'Ó', 'Ò', 'Ô']],
    ['o', ['0', 'q', 'c', 'ó', 'ò', 'ô', 'ö']],
    ['S', ['5', '$', 'Z']],
    ['s', ['5', '$', 'z']],
    ['#', ['H', 'N', '%']],
    ['%', ['#', 'X']],
    [' ', ['_', '-', '.']],
  ]);

  /**
   * Level 1: Remove OCR artifacts and normalize basic characters
   */
  static normalizeLevel1(input: string): string {
    if (!input) return '';

    let normalized = input;

    // Remove OCR artifacts
    for (const artifact of this.OCR_ARTIFACTS) {
      normalized = normalized.replace(
        new RegExp(artifact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        ''
      );
    }

    // Replace accented characters and common OCR errors
    for (const [corrupted, correct] of Object.entries(this.OCR_REPLACEMENTS)) {
      normalized = normalized.replace(
        new RegExp(corrupted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        correct
      );
    }

    // Normalize spaces (multiple spaces to single space, trim)
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  /**
   * Level 2: Aggressive normalization for fuzzy matching
   */
  static normalizeLevel2(input: string): string {
    let normalized = this.normalizeLevel1(input);

    // Remove all non-alphanumeric characters except # and %
    normalized = normalized.replace(/[^a-zA-Z0-9#%\s]/g, '');

    // Normalize common OCR letter/number confusions more aggressively
    normalized = normalized
      .replace(/[4@]/g, 'A')
      .replace(/[8]/g, 'B')
      .replace(/[6]/g, 'G')
      .replace(/[0]/g, 'O')
      .replace(/[1|!]/g, 'I')
      .replace(/[5$]/g, 'S')
      .replace(/[3]/g, 'E')
      .replace(/[2]/g, 'Z');

    // Normalize spaces
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  /**
   * Level 3: Ultra-aggressive normalization for last-resort matching
   */
  static normalizeLevel3(input: string): string {
    let normalized = this.normalizeLevel2(input);

    // Convert to lowercase for case-insensitive matching
    normalized = normalized.toLowerCase();

    // Remove all spaces
    normalized = normalized.replace(/\s/g, '');

    // Keep only letters, numbers, #, %
    normalized = normalized.replace(/[^a-z0-9#%]/g, '');

    return normalized;
  }

  /**
   * Generate multiple normalized versions for fuzzy matching
   */
  static generateNormalizedVersions(input: string): {
    original: string;
    level1: string;
    level2: string;
    level3: string;
    variants: string[];
  } {
    const level1 = this.normalizeLevel1(input);
    const level2 = this.normalizeLevel2(input);
    const level3 = this.normalizeLevel3(input);

    // Generate character variants for the most promising version
    const variants = this.generateCharacterVariants(level1, 3); // Max 3 variants

    return {
      original: input,
      level1,
      level2,
      level3,
      variants,
    };
  }

  /**
   * Generate character variants by applying common OCR replacements
   */
  private static generateCharacterVariants(input: string, maxVariants: number): string[] {
    const variants: Set<string> = new Set();
    variants.add(input); // Always include the input itself

    // Try replacing characters with their OCR alternatives
    for (let i = 0; i < input.length && variants.size < maxVariants + 1; i++) {
      const char = input[i];
      const alternatives = this.BIDIRECTIONAL_REPLACEMENTS.get(char);

      if (alternatives) {
        for (const alt of alternatives.slice(0, 2)) {
          // Limit to first 2 alternatives
          if (variants.size >= maxVariants + 1) break;

          const variant = input.substring(0, i) + alt + input.substring(i + 1);
          variants.add(variant);
        }
      }
    }

    // Remove the original input from variants list
    const result = Array.from(variants);
    return result.slice(1); // Return only the variants, not the original
  }

  /**
   * Smart preprocessing that detects corruption level and applies appropriate normalization
   */
  static smartPreprocess(input: string): {
    primary: string;
    alternatives: string[];
    corruptionLevel: 'low' | 'medium' | 'high' | 'extreme';
  } {
    if (!input) return { primary: '', alternatives: [], corruptionLevel: 'low' };

    // Detect corruption level based on OCR artifacts and character patterns
    const corruptionLevel = this.detectCorruptionLevel(input);

    let primary: string;
    let alternatives: string[] = [];

    switch (corruptionLevel) {
      case 'low':
        primary = this.normalizeLevel1(input);
        alternatives = [this.normalizeLevel2(input)];
        break;
      case 'medium':
        primary = this.normalizeLevel2(input);
        alternatives = [this.normalizeLevel1(input), this.normalizeLevel3(input)];
        break;
      case 'high':
        primary = this.normalizeLevel2(input);
        const versions = this.generateNormalizedVersions(input);
        alternatives = [versions.level1, versions.level3, ...versions.variants.slice(0, 2)];
        break;
      case 'extreme':
        primary = this.normalizeLevel3(input);
        const allVersions = this.generateNormalizedVersions(input);
        alternatives = [allVersions.level1, allVersions.level2, ...allVersions.variants];
        break;
    }

    // Remove duplicates and empty strings
    alternatives = [...new Set(alternatives)].filter((alt) => alt && alt !== primary);

    return { primary, alternatives, corruptionLevel };
  }

  /**
   * Detect the level of corruption in the input string
   */
  private static detectCorruptionLevel(input: string): 'low' | 'medium' | 'high' | 'extreme' {
    let score = 0;

    // Check for OCR artifacts
    for (const artifact of this.OCR_ARTIFACTS) {
      if (input.includes(artifact)) score += 2;
    }

    // Check for accented characters
    if (/[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/i.test(input)) score += 1;

    // Check for number/letter confusion patterns
    if (/[0-9][a-zA-Z]|[a-zA-Z][0-9]/.test(input)) score += 1;

    // Check for suspicious character sequences
    if (/[^a-zA-Z0-9\s#%][a-zA-Z]|[a-zA-Z][^a-zA-Z0-9\s#%]/.test(input)) score += 1;

    // Check for multiple consecutive special characters
    if (/[^a-zA-Z0-9\s]{2,}/.test(input)) score += 2;

    // Check for very short words (possible character deletions)
    const words = input.split(/\s+/);
    const shortWords = words.filter((word) => word.length === 1 && word !== '#' && word !== '%');
    if (shortWords.length > words.length * 0.3) score += 2;

    if (score >= 6) return 'extreme';
    if (score >= 4) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }
}
