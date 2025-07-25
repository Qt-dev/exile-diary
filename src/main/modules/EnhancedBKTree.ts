/**
 * Enhanced BK-Tree implementation with multi-stage search and OCR preprocessing
 * 
 * This enhanced version includes:
 * 1. Multi-stage distance-based search (progressive tolerance)
 * 2. OCR-aware preprocessing integration
 * 3. Confidence scoring for results
 * 4. Multiple candidate evaluation
 */

import { OCRStringNormalizer } from './StringParser/OCRStringNormalizer';

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
   */
  add(word: string): void {
    if (!word) return;

    this.size++;
    
    // Store original word mapping for normalized versions
    const normalized = OCRStringNormalizer.normalizeLevel1(word);
    this.normalizedToOriginal.set(normalized, word);
    
    // For case-insensitive BK-Tree, use lowercase as the tree key
    const lowercaseWord = word.toLowerCase();
    this.normalizedToOriginal.set(lowercaseWord, word);
    
    if (!this.root) {
      this.root = {
        word: lowercaseWord,
        children: new Map()
      };
      return;
    }

    this.addRecursive(this.root, lowercaseWord);
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
        children: new Map()
      });
    }
  }

  /**
   * Enhanced search with multi-stage progressive tolerance
   */
  findBestMatchEnhanced(query: string): SearchResult | null {
    if (!this.root || !query) return null;

    // Stage 1: Preprocess the query
    const preprocessing = OCRStringNormalizer.smartPreprocess(query);
    const searchTargets = [preprocessing.primary, ...preprocessing.alternatives];
    
    // Stage 2: Multi-stage search with progressive tolerance
    const stages = [
      { maxDistance: 2, type: 'exact' as const, maxResults: 1 },
      { maxDistance: 4, type: 'close' as const, maxResults: 3 },
      { maxDistance: 7, type: 'fuzzy' as const, maxResults: 5 },
      { maxDistance: 12, type: 'aggressive' as const, maxResults: 10 }
    ];

    // Try each search target with each stage
    for (const target of searchTargets) {
      // Convert target to lowercase for case-insensitive tree search
      const lowercaseTarget = target.toLowerCase();
      
      for (const stage of stages) {
        const results = this.searchWithDistance(lowercaseTarget, stage.maxDistance);
        
        if (results.length > 0) {
          // Map results back to original case and score them
          const scoredResults = results.map(result => {
            const originalCaseResult = this.normalizedToOriginal.get(result) || result;
            return {
              word: originalCaseResult,
              distance: fastestLevenshtein.distance(lowercaseTarget, result),
              confidence: this.calculateConfidence(query, target, originalCaseResult, stage.type, preprocessing.corruptionLevel),
              matchType: stage.type
            };
          });

          // Sort by confidence (highest first)
          scoredResults.sort((a, b) => b.confidence - a.confidence);
          
          // Return the best result if confidence is acceptable
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
   * Search for words within a given distance
   */
  private searchWithDistance(query: string, maxDistance: number): string[] {
    if (!this.root) return [];

    const results: string[] = [];
    this.searchRecursive(this.root, query, maxDistance, results);
    return results;
  }

  private searchRecursive(node: BKTreeNode, query: string, maxDistance: number, results: string[]): void {
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
   * Calculate confidence score for a match
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
      aggressive: 0.4
    }[matchType];

    // Calculate distance-based penalty (case-insensitive)
    const originalDistance = fastestLevenshtein.distance(originalQuery.toLowerCase(), match.toLowerCase());
    const processedDistance = fastestLevenshtein.distance(processedQuery.toLowerCase(), match.toLowerCase());
    
    // Use the better of the two distances
    const bestDistance = Math.min(originalDistance, processedDistance);
    const maxLength = Math.max(originalQuery.length, match.length);
    
    if (maxLength === 0) return 0;
    
    // Distance penalty (0 to 1, where 1 is no penalty)
    const distancePenalty = Math.max(0, 1 - (bestDistance / maxLength));
    
    // Length similarity bonus (strings of similar length are more likely to be correct)
    const lengthRatio = Math.min(originalQuery.length, match.length) / Math.max(originalQuery.length, match.length);
    const lengthBonus = lengthRatio * 0.2;
    
    // Corruption level adjustment
    const corruptionAdjustment = {
      low: 0.1,
      medium: 0.05,
      high: 0,
      extreme: -0.1
    }[corruptionLevel];
    
    // Special bonus for exact character matches in key positions
    let positionBonus = 0;
    if (originalQuery.length > 0 && match.length > 0) {
      // First character match bonus
      if (originalQuery[0].toLowerCase() === match[0].toLowerCase()) {
        positionBonus += 0.1;
      }
      
      // Last character match bonus
      if (originalQuery[originalQuery.length - 1].toLowerCase() === match[match.length - 1].toLowerCase()) {
        positionBonus += 0.05;
      }
    }
    
    // Calculate final confidence
    const confidence = baseConfidence * distancePenalty + lengthBonus + corruptionAdjustment + positionBonus;
    
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
      aggressive: 0.25
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
      normalizedMappings: this.normalizedToOriginal.size
    };
  }

  private calculateDepth(node: BKTreeNode, currentDepth: number, totalChildren: { count: number }, nodeCount: { count: number }): number {
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
      distance: result.distance
    };
  }

  /**
   * Batch process multiple queries efficiently
   */
  findBestMatchesBatch(queries: string[]): (SearchResult | null)[] {
    return queries.map(query => this.findBestMatchEnhanced(query));
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
      { maxDistance: 12, type: 'aggressive' as const, name: 'Aggressive (distance ≤ 12)' }
    ];

    for (const target of [preprocessing.primary, ...preprocessing.alternatives]) {
      for (const stage of stages) {
        const candidates = this.searchWithDistance(target, stage.maxDistance);
        
        let bestMatch: SearchResult | null = null;
        if (candidates.length > 0) {
          const scoredResults = candidates.map(candidate => ({
            word: candidate,
            distance: fastestLevenshtein.distance(target, candidate),
            confidence: this.calculateConfidence(query, target, candidate, stage.type, preprocessing.corruptionLevel),
            matchType: stage.type
          }));

          scoredResults.sort((a, b) => b.confidence - a.confidence);
          bestMatch = scoredResults[0];
        }

        stageResults.push({
          stage: `${stage.name} (target: "${target}")`,
          candidates: candidates.slice(0, 5), // Show first 5 candidates
          bestMatch
        });
      }
    }

    return { preprocessing, stageResults };
  }
}
