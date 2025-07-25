/**
 * Enhanced BK-Tree implementation with multi-stage search and OCR preprocessing
 *
 * This enhanced version includes:
 * 1. Multi-stage distance-based search (progressive tolerance)
 * 2. OCR-aware preprocessing integration
 * 3. Confidence scoring for results
 * 4. Multiple candidate evaluation
 */

import { OCRStringNormalizer } from './OCRStringNormalizer';

const fastestLevenshtein = require('fastest-levenshtein');

interface BKTreeNode {
  word: string;
  children: Map<number, BKTreeNode>;
}

interface SearchResult {
  word: string;
  distance: number;
  confidence: number;
  matchType: 'exact' | 'close' | 'fuzzy' | 'aggressive';
}

export class EnhancedBKTree {
  private root: BKTreeNode | null = null;
  private size = 0;
  private normalizedToOriginal: Map<string, string> = new Map();

  constructor() {}

  /**
   * Add a word to the BK-Tree with normalization mapping
   * Uses case-insensitive keys for tree structure while preserving original case mapping
   */
  add(word: string): void {
    if (!word) return;

    this.size++;

    // Store original word mapping for various normalized versions
    const normalized = OCRStringNormalizer.normalizeLevel1(word);
    this.normalizedToOriginal.set(normalized, word);
    this.normalizedToOriginal.set(normalized.toLowerCase(), word);
    this.normalizedToOriginal.set(word.toLowerCase(), word);

    // Use lowercase for consistent tree structure and distance calculations
    const treeKey = word.toLowerCase();

    if (!this.root) {
      this.root = {
        word: treeKey,
        children: new Map(),
      };
      return;
    }

    this.addRecursive(this.root, treeKey);
  }

  private addRecursive(node: BKTreeNode, word: string): void {
    const distance = fastestLevenshtein.distance(node.word, word);

    if (distance === 0) {
      // Word already exists, don't add duplicate
      this.size--;
      return;
    }

    if (node.children.has(distance)) {
      this.addRecursive(node.children.get(distance)!, word);
    } else {
      node.children.set(distance, {
        word: word,
        children: new Map(),
      });
    }
  }

  /**
   * Enhanced search with multi-stage progressive tolerance
   * Handles case-insensitive matching efficiently
   */
  findBestMatchEnhanced(query: string): SearchResult | null {
    if (!this.root || !query) return null;

    // Stage 1: Try exact case-insensitive match first (most common case)
    const lowercaseQuery = query.toLowerCase();
    const exactResults = this.searchWithDistance(lowercaseQuery, 0);

    if (exactResults.length > 0) {
      const originalMatch = this.normalizedToOriginal.get(exactResults[0]) || exactResults[0];
      return {
        word: originalMatch,
        distance: 0,
        confidence: 0.98,
        matchType: 'exact',
      };
    }

    // Stage 2: Case-insensitive fuzzy matching with progressive tolerance
    const stages = [
      { maxDistance: 1, type: 'exact' as const, minConfidence: 0.9 },
      { maxDistance: 2, type: 'close' as const, minConfidence: 0.7 },
      { maxDistance: 3, type: 'close' as const, minConfidence: 0.6 },
      { maxDistance: 4, type: 'fuzzy' as const, minConfidence: 0.5 },
    ];

    for (const stage of stages) {
      const results = this.searchWithDistance(lowercaseQuery, stage.maxDistance);

      if (results.length > 0) {
        const scoredResults = results.map((result) => {
          const originalMatch = this.normalizedToOriginal.get(result) || result;
          const distance = fastestLevenshtein.distance(lowercaseQuery, result);
          const baseConfidence = stage.type === 'exact' ? 0.95 : stage.type === 'close' ? 0.8 : 0.6;
          const confidence = Math.max(0.1, baseConfidence - distance * 0.05);

          return {
            word: originalMatch,
            distance,
            confidence,
            matchType: stage.type,
          };
        });

        scoredResults.sort((a, b) => b.confidence - a.confidence);
        const bestResult = scoredResults[0];

        if (bestResult.confidence >= stage.minConfidence) {
          return bestResult;
        }
      }
    }

    // Stage 3: OCR preprocessing fallback for potentially corrupted text
    const preprocessing = OCRStringNormalizer.smartPreprocess(query);
    const searchTargets = [preprocessing.primary, ...preprocessing.alternatives];

    const ocrStages = [
      { maxDistance: 5, type: 'fuzzy' as const, maxResults: 5 },
      { maxDistance: 8, type: 'aggressive' as const, maxResults: 10 },
      { maxDistance: 12, type: 'aggressive' as const, maxResults: 15 },
    ];

    for (const target of searchTargets) {
      const targetLowercase = target.toLowerCase();

      for (const stage of ocrStages) {
        const results = this.searchWithDistance(targetLowercase, stage.maxDistance);

        if (results.length > 0) {
          const scoredResults = results.map((result) => {
            const originalMatch = this.normalizedToOriginal.get(result) || result;

            return {
              word: originalMatch,
              distance: fastestLevenshtein.distance(targetLowercase, result),
              confidence: this.calculateConfidence(
                query,
                target,
                originalMatch,
                stage.type,
                preprocessing.corruptionLevel
              ),
              matchType: stage.type,
            };
          });

          scoredResults.sort((a, b) => b.confidence - a.confidence);
          const bestResult = scoredResults[0];

          if (bestResult.confidence > this.getMinConfidenceThreshold(stage.type)) {
            return bestResult;
          }
        }
      }
    }

    return null;
  }

  /**
   * Search for words within a given distance using case-insensitive matching
   */
  private searchWithDistance(query: string, maxDistance: number): string[] {
    // console.debug(`Searching for "${query}" with max distance ${maxDistance}`);
    if (!this.root) return [];

    // Ensure query is lowercase for consistent distance calculations
    const normalizedQuery = query.toLowerCase();
    const results: string[] = [];
    this.searchRecursive(this.root, normalizedQuery, maxDistance, results);
    return results;
  }

  private searchRecursive(
    node: BKTreeNode,
    query: string,
    maxDistance: number,
    results: string[]
  ): void {
    const distance = fastestLevenshtein.distance(node.word, query);

    if (distance <= maxDistance) {
      results.push(node.word);
    }

    // Search children within the distance range
    const minChildDistance = Math.max(0, distance - maxDistance);
    const maxChildDistance = distance + maxDistance;

    for (const [childDistance, childNode] of node.children) {
      if (childDistance >= minChildDistance && childDistance <= maxChildDistance) {
        this.searchRecursive(childNode, query, maxDistance, results);
      }
    }
  }

  /**
   * Calculate confidence score for a match using case-insensitive comparisons
   */
  private calculateConfidence(
    originalQuery: string,
    processedQuery: string,
    match: string,
    matchType: 'exact' | 'close' | 'fuzzy' | 'aggressive',
    corruptionLevel: 'low' | 'medium' | 'high' | 'extreme'
  ): number {
    // Base confidence based on match type
    const baseConfidence = {
      exact: 0.95,
      close: 0.8,
      fuzzy: 0.6,
      aggressive: 0.4,
    }[matchType];

    // Use case-insensitive distance calculations
    const originalDistance = fastestLevenshtein.distance(
      originalQuery.toLowerCase(),
      match.toLowerCase()
    );
    const processedDistance = fastestLevenshtein.distance(
      processedQuery.toLowerCase(),
      match.toLowerCase()
    );

    // Use the better of the two distances
    const bestDistance = Math.min(originalDistance, processedDistance);
    const maxLength = Math.max(originalQuery.length, match.length);

    if (maxLength === 0) return 0;

    // Distance penalty (0 to 1, where 1 is no penalty)
    const distancePenalty = Math.max(0, 1 - bestDistance / maxLength);

    // Length similarity bonus (strings of similar length are more likely to be correct)
    const lengthRatio =
      Math.min(originalQuery.length, match.length) / Math.max(originalQuery.length, match.length);
    const lengthBonus = lengthRatio * 0.2;

    // Corruption level adjustment
    const corruptionAdjustment = {
      low: 0.1,
      medium: 0.05,
      high: 0,
      extreme: -0.1,
    }[corruptionLevel];

    // Special bonus for exact character matches in key positions (case-insensitive)
    let positionBonus = 0;
    if (originalQuery.length > 0 && match.length > 0) {
      // First character match bonus
      if (originalQuery[0].toLowerCase() === match[0].toLowerCase()) {
        positionBonus += 0.1;
      }

      // Last character match bonus
      if (
        originalQuery[originalQuery.length - 1].toLowerCase() ===
        match[match.length - 1].toLowerCase()
      ) {
        positionBonus += 0.05;
      }
    }

    // Calculate final confidence
    const confidence =
      baseConfidence * distancePenalty + lengthBonus + corruptionAdjustment + positionBonus;

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Get minimum confidence threshold for each match type
   */
  private getMinConfidenceThreshold(matchType: 'exact' | 'close' | 'fuzzy' | 'aggressive'): number {
    return {
      exact: 0.8,
      close: 0.6,
      fuzzy: 0.4,
      aggressive: 0.25,
    }[matchType];
  }

  /**
   * Build the tree from an array of strings
   */
  buildFromArray(words: string[]): void {
    this.root = null;
    this.size = 0;
    this.normalizedToOriginal.clear();

    for (const word of words) {
      this.add(word);
    }
  }

  /**
   * Get enhanced tree statistics
   */
  getStats(): {
    size: number;
    depth: number;
    avgChildren: number;
    normalizedMappings: number;
  } {
    if (!this.root) {
      return { size: 0, depth: 0, avgChildren: 0, normalizedMappings: 0 };
    }

    const totalChildren = { count: 0 };
    const nodeCount = { count: 0 };
    const maxDepth = this.calculateDepth(this.root, 0, totalChildren, nodeCount);

    return {
      size: this.size,
      depth: maxDepth,
      avgChildren: nodeCount.count > 0 ? totalChildren.count / nodeCount.count : 0,
      normalizedMappings: this.normalizedToOriginal.size,
    };
  }

  private calculateDepth(
    node: BKTreeNode,
    currentDepth: number,
    totalChildren: { count: number },
    nodeCount: { count: number }
  ): number {
    nodeCount.count++;
    totalChildren.count += node.children.size;

    if (node.children.size === 0) {
      return currentDepth;
    }

    let maxChildDepth = currentDepth;
    for (const childNode of node.children.values()) {
      const childDepth = this.calculateDepth(childNode, currentDepth + 1, totalChildren, nodeCount);
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    }

    return maxChildDepth;
  }

  /**
   * Get the size of the tree
   */
  getSize(): number {
    return this.size;
  }

  /**
   * Check if the tree is empty
   */
  isEmpty(): boolean {
    return this.root === null;
  }

  /**
   * Legacy findBestMatch method for backward compatibility
   */
  findBestMatch(query: string): { word: string; distance: number } | null {
    const result = this.findBestMatchEnhanced(query);
    if (!result) return null;

    return {
      word: result.word,
      distance: result.distance,
    };
  }

  /**
   * Batch process multiple queries efficiently
   */
  findBestMatchesBatch(queries: string[]): (SearchResult | null)[] {
    return queries.map((query) => this.findBestMatchEnhanced(query));
  }

  /**
   * Debug method to analyze a specific query
   */
  debugQuery(query: string): {
    preprocessing: ReturnType<typeof OCRStringNormalizer.smartPreprocess>;
    stageResults: Array<{
      stage: string;
      candidates: string[];
      bestMatch: SearchResult | null;
    }>;
  } {
    const preprocessing = OCRStringNormalizer.smartPreprocess(query);
    const stageResults: Array<{
      stage: string;
      candidates: string[];
      bestMatch: SearchResult | null;
    }> = [];

    const stages = [
      { maxDistance: 2, type: 'exact' as const, name: 'Exact (distance ≤ 2)' },
      { maxDistance: 4, type: 'close' as const, name: 'Close (distance ≤ 4)' },
      { maxDistance: 7, type: 'fuzzy' as const, name: 'Fuzzy (distance ≤ 7)' },
      { maxDistance: 12, type: 'aggressive' as const, name: 'Aggressive (distance ≤ 12)' },
    ];

    for (const target of [preprocessing.primary, ...preprocessing.alternatives]) {
      const targetLowercase = target.toLowerCase();

      for (const stage of stages) {
        const candidates = this.searchWithDistance(targetLowercase, stage.maxDistance);

        let bestMatch: SearchResult | null = null;
        if (candidates.length > 0) {
          const scoredResults = candidates.map((candidate) => {
            const originalMatch = this.normalizedToOriginal.get(candidate) || candidate;

            return {
              word: originalMatch,
              distance: fastestLevenshtein.distance(targetLowercase, candidate),
              confidence: this.calculateConfidence(
                query,
                target,
                originalMatch,
                stage.type,
                preprocessing.corruptionLevel
              ),
              matchType: stage.type,
            };
          });

          scoredResults.sort((a, b) => b.confidence - a.confidence);
          bestMatch = scoredResults[0];
        }

        // Convert candidates back to original case for display
        const originalCandidates = candidates.map((c) => this.normalizedToOriginal.get(c) || c);

        stageResults.push({
          stage: `${stage.name} (target: "${target}")`,
          candidates: originalCandidates.slice(0, 5), // Show first 5 candidates
          bestMatch,
        });
      }
    }

    return { preprocessing, stageResults };
  }
}
