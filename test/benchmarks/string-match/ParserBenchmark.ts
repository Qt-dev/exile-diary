/**
 * Performance and accuracy benchmark comparing StringParser vs StringMatcher
 *
 * This benchmark tests string matching algorithms using hardcoded datasets for consistent results:
 * - StringParser: Uses Enhanced BK-Tree with OCR preprocessing and multi-stage search
 * - StringMatcher: Traditional implementation (if available)
 *
 * Tests performed:
 * 1. Individual string matching: getMod from StringParser vs getMod from StringMatcher
 * 2. Batch processing comparison: getMods from StringParser vs getMods from StringMatcher
 * 3. Loop performance: getMods vs individual getMod calls in loop for StringMatcher
 *
 * Metrics measured:
 * - Accuracy: How many strings were matched correctly
 * - Speed: Total time, average time per string, fastest/slowest individual matches
 *
 * Usage:
 * - npm run benchmark       # Run TypeScript version with tsx
 * - tsx test/ParserBenchmark.ts  # Run TypeScript version directly
 *
 * Note: Results are consistent across runs due to hardcoded test data
 */

import Constants from '../../../src/helpers/constants';
import StringParser from '../../../src/main/modules/StringParser/StringParser';
import { NEW_TEST_DATASETS } from './NewTestDatasets';

// Import StringMatcher
const StringMatcher = require('../src/main/modules/StringMatcher');

interface BenchmarkResult {
  testName: string;
  implementation: string;
  arraySize: number;
  totalTime: number;
  averageTime: number;
  fastestTime: number;
  slowestTime: number;
  correctMatches: number;
  totalStrings: number;
  accuracy: number;
  errors: string[];
}

interface TestData {
  original: string;
  corrupted: string;
  expected: string;
}

/**
 * Test datasets with OCR-style corruptions
 * All expected outputs are valid entries from src/helpers/data/mapMods.json
 */
const HARDCODED_TEST_DATASETS = NEW_TEST_DATASETS;

class ParserBenchmark {
  /**
   * Get hardcoded test data by name
   */
  private static getTestData(testName: string): TestData[] {
    const datasetMap: { [key: string]: TestData[] } = {
      'Small Dataset 1': HARDCODED_TEST_DATASETS.small1,
      'Small Dataset 2': HARDCODED_TEST_DATASETS.small2,
      'Small Dataset 3': HARDCODED_TEST_DATASETS.small3,
      'Small Dataset 4': HARDCODED_TEST_DATASETS.small4,
      'Medium Dataset 1': HARDCODED_TEST_DATASETS.medium1,
      'Medium Dataset 2': HARDCODED_TEST_DATASETS.medium2,
      'Large Dataset': HARDCODED_TEST_DATASETS.large1,
    };

    return datasetMap[testName] || [];
  }

  /**
   * Calculate corruption rate from test data
   */
  private static calculateCorruptionRate(testData: TestData[]): number {
    const corruptedCount = testData.filter((data) => data.corrupted !== data.expected).length;
    return (corruptedCount / testData.length) * 100;
  }

  /**
   * Run benchmark on individual strings using StringParser.GetMod
   */
  private static runBenchmarkStringParserIndividual(
    testName: string,
    testData: TestData[]
  ): BenchmarkResult {
    const errors: string[] = [];
    const individualTimes: number[] = [];
    let correctMatches = 0;

    // Extract just the corrupted strings for testing
    const testStrings = testData.map((data) => data.corrupted);

    // Get StringParser stats (tree is pre-initialized)
    const stats = StringParser.getStats();
    if (stats) {
      console.log(
        `StringParser Enhanced BK-Tree: ${stats.size} nodes, depth: ${
          stats.depth
        }, avg children: ${stats.avgChildren.toFixed(2)}`
      );
    }

    // Measure total time
    const startTime = performance.now();

    // Process each string individually to measure individual times
    const results: string[] = [];
    for (let i = 0; i < testStrings.length; i++) {
      const individualStart = performance.now();
      const result = StringParser.GetMod(testStrings[i]);
      const individualEnd = performance.now();

      individualTimes.push(individualEnd - individualStart);
      results.push(result);

      // Check if the result is correct
      const expected = testData[i].expected;
      if (result === expected) {
        correctMatches++;
      } else {
        errors.push(`Expected: "${expected}", Got: "${result}", Input: "${testStrings[i]}"`);
      }
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    return {
      testName,
      arraySize: testData.length,
      totalTime,
      averageTime: totalTime / testData.length,
      fastestTime: Math.min(...individualTimes),
      slowestTime: Math.max(...individualTimes),
      correctMatches,
      totalStrings: testData.length,
      accuracy: (correctMatches / testData.length) * 100,
      errors,
      implementation: 'StringParser.GetMod',
    };
  }

  /**
   * Run benchmark using StringParser.GetMods batch processing
   */
  private static runBenchmarkStringParserBatch(
    testName: string,
    testData: TestData[]
  ): BenchmarkResult {
    const inputStrings = testData.map((t) => t.corrupted);

    const startTime = performance.now();
    const results = StringParser.GetMods(inputStrings);
    const endTime = performance.now();

    const totalTime = endTime - startTime;
    const averageTime = totalTime / testData.length;

    // Calculate accuracy
    let correctMatches = 0;
    let fastestTime = Infinity;
    let slowestTime = 0;
    const errors: string[] = [];

    for (let i = 0; i < testData.length; i++) {
      const expected = testData[i].expected;
      const actual = results[i];

      if (actual === expected) {
        correctMatches++;
      } else {
        errors.push(`Expected: "${expected}", Got: "${actual}", Input: "${testData[i].corrupted}"`);
      }

      // For batch processing, we estimate individual times
      const estimatedTime = totalTime / testData.length;
      fastestTime = Math.min(fastestTime, estimatedTime);
      slowestTime = Math.max(slowestTime, estimatedTime);
    }

    const accuracy = (correctMatches / testData.length) * 100;

    return {
      testName,
      implementation: 'StringParser.GetMods',
      arraySize: testData.length,
      totalTime,
      averageTime,
      fastestTime,
      slowestTime,
      accuracy,
      correctMatches,
      totalStrings: testData.length,
      errors,
    };
  }

  /**
   * Run benchmark using StringMatcher.getMod (individual matching)
   */
  private static runBenchmarkStringMatcherIndividual(
    testName: string,
    testData: TestData[]
  ): BenchmarkResult {
    const errors: string[] = [];
    const individualTimes: number[] = [];
    let correctMatches = 0;

    const testStrings = testData.map((data) => data.corrupted);

    const startTime = performance.now();

    const results: string[] = [];
    for (let i = 0; i < testStrings.length; i++) {
      const individualStart = performance.now();

      let result = '';
      try {
        result = StringMatcher.getMod(testStrings[i]);
      } catch (error) {
        // Handle errors from StringMatcher (e.g., number replacement issues)
        result = '';
      }

      const individualEnd = performance.now();

      individualTimes.push(individualEnd - individualStart);
      results.push(result);

      const expected = testData[i].expected;
      if (result === expected) {
        correctMatches++;
      } else {
        errors.push(`Expected: "${expected}", Got: "${result}", Input: "${testStrings[i]}"`);
      }
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    return {
      testName,
      arraySize: testData.length,
      totalTime,
      averageTime: totalTime / testData.length,
      fastestTime: Math.min(...individualTimes),
      slowestTime: Math.max(...individualTimes),
      correctMatches,
      totalStrings: testData.length,
      accuracy: (correctMatches / testData.length) * 100,
      errors,
      implementation: 'StringMatcher.getMod',
    };
  }

  /**
   * Run benchmark using StringMatcher.getMod vs StringParser.GetMod
   * and StringMatcher loop vs StringParser.GetMods
   */

  /**
   * Run benchmark using loop of StringMatcher.getMod calls (simulating batch processing)
   */
  private static runBenchmarkStringMatcherLoop(
    testName: string,
    testData: TestData[]
  ): BenchmarkResult {
    const errors: string[] = [];
    const individualTimes: number[] = [];
    let correctMatches = 0;

    const testStrings = testData.map((data) => data.corrupted);

    const startTime = performance.now();

    const results: string[] = [];
    for (let i = 0; i < testStrings.length; i++) {
      const individualStart = performance.now();

      let result = '';
      try {
        result = StringMatcher.getMod(testStrings[i]);
      } catch (error) {
        // Handle errors from StringMatcher (e.g., number replacement issues)
        result = '';
      }

      const individualEnd = performance.now();

      individualTimes.push(individualEnd - individualStart);
      results.push(result);

      const expected = testData[i].expected;
      if (result === expected) {
        correctMatches++;
      } else {
        errors.push(`Expected: "${expected}", Got: "${result}", Input: "${testStrings[i]}"`);
      }
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    return {
      testName,
      arraySize: testData.length,
      totalTime,
      averageTime: totalTime / testData.length,
      fastestTime: Math.min(...individualTimes),
      slowestTime: Math.max(...individualTimes),
      correctMatches,
      totalStrings: testData.length,
      accuracy: (correctMatches / testData.length) * 100,
      errors,
      implementation: 'StringMatcher.getMod (Loop)',
    };
  }

  /**
   * Run comprehensive benchmarks comparing StringParser vs StringMatcher
   */
  public static runAllBenchmarks(): void {
    console.log('='.repeat(80));
    console.log('StringParser vs StringMatcher Performance and Accuracy Benchmark');
    console.log('Comparing Enhanced BK-Tree vs Traditional String Matching');
    console.log('='.repeat(80));
    console.log(`Total available map mods: ${Constants.mapMods.length}`);
    console.log('Using hardcoded test datasets for consistent results');
    console.log('');

    // Check StringMatcher availability
    console.log(`StringParser: Available (Enhanced BK-Tree with OCR preprocessing)`);
    console.log(`StringMatcher: Available (Traditional Levenshtein distance matching)`);
    console.log('');

    // Test configurations
    const testConfigs = [
      { name: 'Small Dataset 1' },
      { name: 'Small Dataset 2' },
      { name: 'Small Dataset 3' },
      { name: 'Small Dataset 4' },
      { name: 'Medium Dataset 1' },
      { name: 'Medium Dataset 2' },
      { name: 'Large Dataset' },
    ];

    const stringParserResults: BenchmarkResult[] = [];
    const stringMatcherResults: BenchmarkResult[] = [];

    // Run StringParser vs StringMatcher Individual Comparison
    console.log(
      '🔍 Running Individual Method Comparison: StringParser.GetMod vs StringMatcher.getMod'
    );
    console.log('-'.repeat(70));

    for (const config of testConfigs) {
      const testData = this.getTestData(config.name);
      const corruptionRate = this.calculateCorruptionRate(testData);

      console.log(
        `Running ${config.name} (${testData.length} strings, ${corruptionRate.toFixed(
          1
        )}% corruption)`
      );

      // StringParser Individual
      const stringParserIndividual = this.runBenchmarkStringParserIndividual(config.name, testData);
      stringParserResults.push(stringParserIndividual);
      console.log(
        `  StringParser.GetMod: ${stringParserIndividual.totalTime.toFixed(
          2
        )}ms total, ${stringParserIndividual.accuracy.toFixed(1)}% accuracy`
      );

      // StringMatcher Individual
      const stringMatcherIndividual = this.runBenchmarkStringMatcherIndividual(
        config.name,
        testData
      );
      stringMatcherResults.push(stringMatcherIndividual);
      console.log(
        `  StringMatcher.getMod: ${stringMatcherIndividual.totalTime.toFixed(
          2
        )}ms total, ${stringMatcherIndividual.accuracy.toFixed(1)}% accuracy`
      );

      console.log('');
    }

    // Run Batch Processing Comparison: StringParser.GetMods vs StringMatcher Loop
    console.log(
      '� Running Batch Processing Comparison: StringParser.GetMods vs StringMatcher Loop'
    );
    console.log('-'.repeat(70));

    const stringParserBatchResults: BenchmarkResult[] = [];
    const stringMatcherLoopResults: BenchmarkResult[] = [];

    for (const config of testConfigs) {
      const testData = this.getTestData(config.name);
      const corruptionRate = this.calculateCorruptionRate(testData);

      console.log(
        `Running ${config.name} (${testData.length} strings, ${corruptionRate.toFixed(
          1
        )}% corruption)`
      );

      // StringParser Batch
      const stringParserBatch = this.runBenchmarkStringParserBatch(config.name, testData);
      stringParserBatchResults.push(stringParserBatch);
      console.log(
        `  StringParser.GetMods: ${stringParserBatch.totalTime.toFixed(
          2
        )}ms total, ${stringParserBatch.accuracy.toFixed(1)}% accuracy`
      );

      // StringMatcher Loop (equivalent to batch)
      const stringMatcherLoop = this.runBenchmarkStringMatcherLoop(config.name, testData);
      stringMatcherLoopResults.push(stringMatcherLoop);
      console.log(
        `  StringMatcher Loop: ${stringMatcherLoop.totalTime.toFixed(
          2
        )}ms total, ${stringMatcherLoop.accuracy.toFixed(1)}% accuracy`
      );

      console.log('');
    }

    // Performance comparison
    console.log('='.repeat(80));
    console.log('PERFORMANCE COMPARISON');
    console.log('='.repeat(80));

    this.printComparisonResults(
      stringParserResults,
      stringMatcherResults,
      stringParserBatchResults,
      stringMatcherLoopResults
    );

    console.log('\nBenchmark completed successfully!');
  }

  /**
   * Print detailed comparison between different implementations
   */
  private static printComparisonResults(
    stringParserIndividualResults: BenchmarkResult[],
    stringMatcherIndividualResults: BenchmarkResult[],
    stringParserBatchResults: BenchmarkResult[],
    stringMatcherLoopResults: BenchmarkResult[]
  ): void {
    console.log('Individual Method Comparison (getMod):');
    console.log('');

    for (let i = 0; i < stringParserIndividualResults.length; i++) {
      const parserResult = stringParserIndividualResults[i];
      const matcherResult = stringMatcherIndividualResults[i];

      console.log(`${parserResult.testName}:`);
      console.log(
        `  StringParser.GetMod: ${parserResult.averageTime.toFixed(
          4
        )}ms/string, ${parserResult.accuracy.toFixed(1)}% accuracy`
      );
      console.log(
        `  StringMatcher.getMod: ${matcherResult.averageTime.toFixed(
          4
        )}ms/string, ${matcherResult.accuracy.toFixed(1)}% accuracy`
      );

      // Compare speed
      const speedRatio = matcherResult.totalTime / parserResult.totalTime;
      if (speedRatio > 1.1) {
        console.log(`  🚀 StringParser is ${speedRatio.toFixed(2)}x faster than StringMatcher`);
      } else if (speedRatio < 0.9) {
        console.log(
          `  🚀 StringMatcher is ${(1 / speedRatio).toFixed(2)}x faster than StringParser`
        );
      } else {
        console.log(`  ⚖️  Similar performance (${speedRatio.toFixed(2)}x)`);
      }

      // Compare accuracy
      const accuracyDiff = parserResult.accuracy - matcherResult.accuracy;
      if (Math.abs(accuracyDiff) > 1.0) {
        if (accuracyDiff > 0) {
          console.log(`  🎯 StringParser is more accurate (+${accuracyDiff.toFixed(1)}%)`);
        } else {
          console.log(
            `  🎯 StringMatcher is more accurate (+${Math.abs(accuracyDiff).toFixed(1)}%)`
          );
        }
      } else {
        console.log(`  ✅ Similar accuracy`);
      }

      console.log('');
    }

    console.log('Batch Processing Comparison (getMods vs Loop):');
    console.log('');

    for (let i = 0; i < stringParserBatchResults.length; i++) {
      const parserBatchResult = stringParserBatchResults[i];
      const matcherLoopResult = stringMatcherLoopResults[i];

      console.log(`${parserBatchResult.testName}:`);
      console.log(
        `  StringParser.GetMods: ${parserBatchResult.averageTime.toFixed(
          4
        )}ms/string, ${parserBatchResult.accuracy.toFixed(1)}% accuracy`
      );
      console.log(
        `  StringMatcher Loop: ${matcherLoopResult.averageTime.toFixed(
          4
        )}ms/string, ${matcherLoopResult.accuracy.toFixed(1)}% accuracy`
      );

      // Compare batch vs loop performance
      const batchSpeedRatio = matcherLoopResult.totalTime / parserBatchResult.totalTime;
      if (batchSpeedRatio > 1.1) {
        console.log(
          `  🚀 StringParser batch is ${batchSpeedRatio.toFixed(2)}x faster than StringMatcher loop`
        );
      } else if (batchSpeedRatio < 0.9) {
        console.log(
          `  🚀 StringMatcher loop is ${(1 / batchSpeedRatio).toFixed(
            2
          )}x faster than StringParser batch`
        );
      } else {
        console.log(`  ⚖️  Similar batch performance (${batchSpeedRatio.toFixed(2)}x)`);
      }

      // Compare batch accuracy
      const batchAccuracyDiff = parserBatchResult.accuracy - matcherLoopResult.accuracy;
      if (Math.abs(batchAccuracyDiff) > 1.0) {
        if (batchAccuracyDiff > 0) {
          console.log(
            `  🎯 StringParser batch is more accurate (+${batchAccuracyDiff.toFixed(1)}%)`
          );
        } else {
          console.log(
            `  🎯 StringMatcher loop is more accurate (+${Math.abs(batchAccuracyDiff).toFixed(1)}%)`
          );
        }
      } else {
        console.log(`  ✅ Similar batch accuracy`);
      }

      console.log('');
    }

    // Overall statistics
    const allStringParserResults = [...stringParserIndividualResults, ...stringParserBatchResults];
    const allStringMatcherResults = [
      ...stringMatcherIndividualResults,
      ...stringMatcherLoopResults,
    ];

    const stringParserTotalTime = allStringParserResults.reduce((sum, r) => sum + r.totalTime, 0);
    const stringMatcherTotalTime = allStringMatcherResults.reduce((sum, r) => sum + r.totalTime, 0);

    const stringParserTotalStrings = allStringParserResults.reduce(
      (sum, r) => sum + r.totalStrings,
      0
    );
    const stringMatcherTotalStrings = allStringMatcherResults.reduce(
      (sum, r) => sum + r.totalStrings,
      0
    );

    const stringParserCorrectMatches = allStringParserResults.reduce(
      (sum, r) => sum + r.correctMatches,
      0
    );
    const stringMatcherCorrectMatches = allStringMatcherResults.reduce(
      (sum, r) => sum + r.correctMatches,
      0
    );

    const stringParserAccuracy = (stringParserCorrectMatches / stringParserTotalStrings) * 100;
    const stringMatcherAccuracy = (stringMatcherCorrectMatches / stringMatcherTotalStrings) * 100;

    console.log('Overall Performance Summary:');
    console.log('');
    console.log(
      `StringParser (Enhanced BK-Tree): ${stringParserTotalTime.toFixed(
        2
      )}ms total, ${stringParserAccuracy.toFixed(1)}% accuracy`
    );
    console.log(
      `StringMatcher (Levenshtein): ${stringMatcherTotalTime.toFixed(
        2
      )}ms total, ${stringMatcherAccuracy.toFixed(1)}% accuracy`
    );

    console.log('');
    console.log('🏆 Overall Winner Analysis:');

    const overallSpeedRatio = stringMatcherTotalTime / stringParserTotalTime;
    if (overallSpeedRatio > 1.1) {
      console.log(
        `   🚀 StringParser is the speed winner (${overallSpeedRatio.toFixed(2)}x faster overall)`
      );
    } else if (overallSpeedRatio < 0.9) {
      console.log(
        `   🚀 StringMatcher is the speed winner (${(1 / overallSpeedRatio).toFixed(
          2
        )}x faster overall)`
      );
    } else {
      console.log(`   ⚖️  Both implementations have similar speed performance`);
    }

    if (Math.abs(stringParserAccuracy - stringMatcherAccuracy) < 1.0) {
      console.log(`   ✅ Both implementations have similar accuracy`);
    } else if (stringParserAccuracy > stringMatcherAccuracy) {
      console.log(
        `   🎯 StringParser is the accuracy winner (${stringParserAccuracy.toFixed(
          1
        )}% vs ${stringMatcherAccuracy.toFixed(1)}%)`
      );
    } else {
      console.log(
        `   🎯 StringMatcher is the accuracy winner (${stringMatcherAccuracy.toFixed(
          1
        )}% vs ${stringParserAccuracy.toFixed(1)}%)`
      );
    }

    console.log(`   📈 Enhanced BK-Tree vs Traditional Levenshtein comparison complete`);
  }

  /**
   * Legacy sync function for backward compatibility
   */
  public static runAllBenchmarksSync(): void {
    return this.runAllBenchmarks();
  }
}

// Export for use in tests
export default ParserBenchmark;

// Run benchmark if this file is executed directly
if (require.main === module) {
  ParserBenchmark.runAllBenchmarks();
}
