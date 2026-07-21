import Constants from '../../../src/helpers/constants';
import StringParser from '../../../src/main/modules/StringParser/StringParser';
import { NEW_TEST_DATASETS } from './NewTestDatasets';

export interface TestData {
  original: string;
  corrupted: string;
  expected: string;
}

export interface BenchmarkResult {
  testName: string;
  implementation: 'StringParser.GetMod' | 'StringParser.GetMods';
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

export interface DatasetReport {
  datasetName: string;
  corruptionRate: number;
  results: BenchmarkResult[];
}

export interface StringParserBenchmarkReport {
  benchmark: 'string-match';
  mapModCount: number;
  datasets: DatasetReport[];
}

const HARDCODED_TEST_DATASETS = NEW_TEST_DATASETS;

const DATASET_MAP: Record<string, TestData[]> = {
  'Small Dataset 1': HARDCODED_TEST_DATASETS.small1,
  'Small Dataset 2': HARDCODED_TEST_DATASETS.small2,
  'Small Dataset 3': HARDCODED_TEST_DATASETS.small3,
  'Small Dataset 4': HARDCODED_TEST_DATASETS.small4,
  'Medium Dataset 1': HARDCODED_TEST_DATASETS.medium1,
  'Medium Dataset 2': HARDCODED_TEST_DATASETS.medium2,
  'Large Dataset': HARDCODED_TEST_DATASETS.large1,
};

function calculateCorruptionRate(testData: TestData[]): number {
  const corruptedCount = testData.filter((data) => data.corrupted !== data.expected).length;
  return (corruptedCount / testData.length) * 100;
}

function runIndividualBenchmark(testName: string, testData: TestData[]): BenchmarkResult {
  const errors: string[] = [];
  const individualTimes: number[] = [];
  let correctMatches = 0;
  const testStrings = testData.map((data) => data.corrupted);

  const startTime = performance.now();
  for (let i = 0; i < testStrings.length; i++) {
    const individualStart = performance.now();
    const result = StringParser.GetMod(testStrings[i]);
    const individualEnd = performance.now();

    individualTimes.push(individualEnd - individualStart);

    const expected = testData[i].expected;
    if (result === expected) {
      correctMatches++;
    } else {
      errors.push(`Expected: "${expected}", Got: "${result}", Input: "${testStrings[i]}"`);
    }
  }
  const totalTime = performance.now() - startTime;

  return {
    testName,
    implementation: 'StringParser.GetMod',
    arraySize: testData.length,
    totalTime,
    averageTime: totalTime / testData.length,
    fastestTime: Math.min(...individualTimes),
    slowestTime: Math.max(...individualTimes),
    correctMatches,
    totalStrings: testData.length,
    accuracy: (correctMatches / testData.length) * 100,
    errors,
  };
}

function runBatchBenchmark(testName: string, testData: TestData[]): BenchmarkResult {
  const inputStrings = testData.map((data) => data.corrupted);
  const startTime = performance.now();
  const results = StringParser.GetMods(inputStrings);
  const totalTime = performance.now() - startTime;
  const errors: string[] = [];
  let correctMatches = 0;

  for (let i = 0; i < testData.length; i++) {
    const expected = testData[i].expected;
    const actual = results[i];
    if (actual === expected) {
      correctMatches++;
    } else {
      errors.push(`Expected: "${expected}", Got: "${actual}", Input: "${testData[i].corrupted}"`);
    }
  }

  const estimatedTime = totalTime / testData.length;

  return {
    testName,
    implementation: 'StringParser.GetMods',
    arraySize: testData.length,
    totalTime,
    averageTime: estimatedTime,
    fastestTime: estimatedTime,
    slowestTime: estimatedTime,
    correctMatches,
    totalStrings: testData.length,
    accuracy: (correctMatches / testData.length) * 100,
    errors,
  };
}

class ParserBenchmark {
  static collectBenchmarkResults(): StringParserBenchmarkReport {
    const datasets = Object.entries(DATASET_MAP).map(([datasetName, testData]) => ({
      datasetName,
      corruptionRate: calculateCorruptionRate(testData),
      results: [
        runIndividualBenchmark(datasetName, testData),
        runBatchBenchmark(datasetName, testData),
      ],
    }));

    return {
      benchmark: 'string-match',
      mapModCount: Constants.mapMods.length,
      datasets,
    };
  }

  static runAllBenchmarks(): void {
    const report = this.collectBenchmarkResults();
    console.log('='.repeat(80));
    console.log('StringParser Performance and Accuracy Benchmark');
    console.log('='.repeat(80));
    console.log(`Total available map mods: ${report.mapModCount}`);
    console.log('Using hardcoded OCR-style datasets for consistent results');
    console.log('');

    for (const dataset of report.datasets) {
      console.log(
        `${dataset.datasetName} (${
          DATASET_MAP[dataset.datasetName].length
        } strings, ${dataset.corruptionRate.toFixed(1)}% corruption)`
      );

      for (const result of dataset.results) {
        console.log(
          `  ${result.implementation}: ${result.totalTime.toFixed(
            2
          )}ms total, ${result.accuracy.toFixed(1)}% accuracy`
        );
      }
      console.log('');
    }
  }

  static runAllBenchmarksSync(): void {
    this.runAllBenchmarks();
  }
}

export default ParserBenchmark;

if (require.main === module) {
  const report = ParserBenchmark.collectBenchmarkResults();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    ParserBenchmark.runAllBenchmarks();
  }
}
