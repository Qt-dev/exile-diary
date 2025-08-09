import logger from 'electron-log';
import Constants from '../../../helpers/constants';
import { EnhancedBKTree } from './EnhancedBKTree';

/**
 * StringParser - High-performance string matching for Path of Exile mod strings
 *
 * This class provides optimized string matching algorithms for matching mod strings
 * against the Constants.mapMods array using Enhanced BK-Tree with OCR preprocessing
 * and multi-stage search for maximum accuracy.
 */
class StringParser {
  // Enhanced BK-Tree with OCR preprocessing and multi-stage search
  private static enhancedBkTree: EnhancedBKTree | null = null;
  private static enhancedBkTreeInitialized = false;

  // Static initialization block - automatically build Enhanced BK-Tree on module load
  static {
    try {
      this.initializeEnhancedBKTree();
      logger.info('StringParser module loaded with Enhanced BK-Tree pre-initialized');
    } catch (error) {
      logger.error('Failed to initialize Enhanced BK-Tree on module load:', error);
    }
  }

  /**
   * Find the closest matching mod string from Constants.mapMods
   *
   * This function uses Enhanced BK-Tree with OCR preprocessing and multi-stage search
   * for improved accuracy on corrupted text from OCR systems.
   *
   * @param str - The input string to match
   * @returns The closest matching mod string, or empty string if no good match found
   */
  static GetMod(str: string): string {
    // Filter out very short strings
    if (!str || str.length < 5) {
      return '';
    }

    if (!this.enhancedBkTree) {
      logger.error('Enhanced BK-Tree not initialized');
      return '';
    }

    // Use enhanced search with OCR preprocessing and confidence scoring
    const result = this.enhancedBkTree.findBestMatchEnhanced(str);

    if (!result) {
      return '';
    }

    // Use smarter confidence thresholds based on match type and distance
    const minConfidence = this.getMinConfidenceThreshold(result.matchType, result.distance);
    if (result.confidence < minConfidence) {
      return '';
    }

    // Replace # placeholder with original numbers from input
    return this.replaceNumberPlaceholders(result.word, str);
  }

  /**
   * Batch process multiple mod strings efficiently using Enhanced BK-Tree
   *
   * @param modStrings - Array of mod strings to match
   * @returns Array of matched mod strings, same length as input
   */
  static GetMods(modStrings: string[]): string[] {
    logger.debug(`GetMods called with ${modStrings.length} strings`);
    logger.debug(modStrings);
    if (!Array.isArray(modStrings) || modStrings.length === 0) {
      return [];
    }

    if (!this.enhancedBkTree) {
      logger.error('Enhanced BK-Tree not initialized');
      return new Array(modStrings.length).fill('');
    }

    const results: string[] = [];

    // Process each string using Enhanced BK-Tree for efficient search
    for (const modString of modStrings) {
      if (!modString || modString.length < 5) {
        results.push('');
        logger.debug(`Skipping short mod string: ${modString}`);
        continue;
      }

      const bestMatch = this.enhancedBkTree.findBestMatchEnhanced(modString);

      if (!bestMatch) {
        logger.debug(`No best match found for mod string: ${modString}`);
        results.push('');
        continue;
      }

      // Enhanced BK-Tree uses confidence scoring - use smarter thresholds based on match type
      const minConfidence = this.getMinConfidenceThreshold(bestMatch.matchType, bestMatch.distance);
      if (bestMatch.confidence < minConfidence) {
        results.push('');
      } else {
        // Replace # placeholder with original numbers from input
        results.push(this.replaceNumberPlaceholders(bestMatch.word, modString));
      }
    }

    return results;
  }

  /**
   * Replace # placeholders in the matched string with numbers from the original input
   * @param matchedString - The matched mod string containing # placeholders
   * @param originalInput - The original input string containing actual numbers
   * @returns The matched string with # replaced by original numbers
   */
  private static replaceNumberPlaceholders(matchedString: string, originalInput: string): string {
    if (!matchedString.includes('#')) {
      return matchedString;
    }

    // Extract all numbers (including decimals) from the original input
    const numbers = originalInput.match(/\d+(?:\.\d+)?/g) || [];

    if (numbers.length === 0) {
      return matchedString;
    }

    let result = matchedString;
    let numberIndex = 0;

    // Replace each # with the corresponding number from input
    result = result.replace(/#/g, () => {
      if (numberIndex < numbers.length) {
        return numbers[numberIndex++];
      }
      return '#'; // Keep # if we run out of numbers
    });

    return result;
  }

  /**
   * Get minimum confidence threshold based on match type and distance
   * More lenient for case-insensitive matches (exact/close) vs OCR corruption (fuzzy/aggressive)
   */
  private static getMinConfidenceThreshold(matchType: string, distance: number): number {
    // For exact distance matches (case-insensitive), use lower thresholds
    if (distance === 0) {
      return 0.95; // Exact case-insensitive matches should have high confidence
    }

    // For low distance matches (1-3), be more lenient - likely case-insensitive fuzzy
    if (distance <= 3) {
      return (
        {
          exact: 0.7, // Distance 1-2 with exact match type
          close: 0.5, // Distance 1-3 with close match type
          fuzzy: 0.3, // Distance 2-4 with fuzzy match type
          aggressive: 0.2,
        }[matchType as keyof typeof this] || 0.3
      );
    }

    // For higher distances (4+), use original conservative thresholds for OCR corruption
    return (
      {
        exact: 0.8,
        close: 0.6,
        fuzzy: 0.4,
        aggressive: 0.25,
      }[matchType as keyof typeof this] || 0.3
    );
  }

  /**
   * Initialize the Enhanced BK-Tree with OCR preprocessing and multi-stage search
   * This provides better accuracy for OCR-corrupted text
   */
  static initializeEnhancedBKTree(): void {
    if (this.enhancedBkTreeInitialized) return;

    this.enhancedBkTree = new EnhancedBKTree();
    this.enhancedBkTree.buildFromArray(Constants.mapMods);
    this.enhancedBkTreeInitialized = true;

    const stats = this.enhancedBkTree.getStats();
    logger.info(
      `Enhanced BK-Tree initialized with ${stats.size} mod strings, ${stats.normalizedMappings} normalized mappings`
    );
  }

  /**
   * Debug method for analyzing Enhanced BK-Tree search process
   */
  static debugSearch(str: string): any {
    if (!this.enhancedBkTreeInitialized) {
      this.initializeEnhancedBKTree();
    }

    if (!this.enhancedBkTree) {
      return null;
    }

    return this.enhancedBkTree.debugQuery(str);
  }

  /**
   * Get statistics about the Enhanced BK-Tree
   */
  static getStats(): {
    size: number;
    depth: number;
    avgChildren: number;
    normalizedMappings: number;
  } | null {
    if (!this.enhancedBkTreeInitialized || !this.enhancedBkTree) {
      return null;
    }

    return this.enhancedBkTree.getStats();
  }

  /**
   * Reset the Enhanced BK-Tree
   */
  static reset(): void {
    this.enhancedBkTree = null;
    this.enhancedBkTreeInitialized = false;
  }
}

export default StringParser;
