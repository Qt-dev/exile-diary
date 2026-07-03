import fs from 'node:fs/promises';
import path from 'node:path';
import { runAppLifecycleBenchmark } from './app/AppLifecycleBenchmark';
import { runBenchmarks as runDbBenchmarks, type DbBenchmarkReport } from './db/DbQueryBenchmark';
import ParserBenchmark, {
  type StringParserBenchmarkReport,
} from './string-match/ParserBenchmark';
import { slugifyMetricName, summarizeSamples } from './shared/stats';

type AggregatedMetric = {
  metric: string;
  samples: number[];
  summary: ReturnType<typeof summarizeSamples>;
};

type BaselineCollectionReport = {
  benchmarkSuite: 'migration-0-core';
  generatedAt: string;
  repeatCount: number;
  includesAppLifecycle: boolean;
  db: {
    rawRuns: DbBenchmarkReport[];
    metrics: AggregatedMetric[];
  };
  stringMatch: {
    rawRuns: StringParserBenchmarkReport[];
    metrics: AggregatedMetric[];
  };
  appLifecycle?: {
    startup?: unknown;
    idleMemory?: unknown;
  };
};

function aggregateDbMetrics(rawRuns: DbBenchmarkReport[]): AggregatedMetric[] {
  const metricMap = new Map<string, number[]>();

  for (const run of rawRuns) {
    if (run.status !== 'ok') {
      continue;
    }
    for (const result of run.cases) {
      const metricName = `${slugifyMetricName(result.name)}.totalMs`;
      metricMap.set(metricName, [...(metricMap.get(metricName) ?? []), result.totalMs]);
    }
  }

  return [...metricMap.entries()].map(([metric, samples]) => ({
    metric,
    samples,
    summary: summarizeSamples(samples),
  }));
}

function aggregateStringMetrics(rawRuns: StringParserBenchmarkReport[]): AggregatedMetric[] {
  const metricMap = new Map<string, number[]>();

  for (const run of rawRuns) {
    for (const dataset of run.datasets) {
      for (const result of dataset.results) {
        const metricPrefix = `${slugifyMetricName(dataset.datasetName)}.${slugifyMetricName(
          result.implementation
        )}`;
        metricMap.set(`${metricPrefix}.totalTime`, [
          ...(metricMap.get(`${metricPrefix}.totalTime`) ?? []),
          result.totalTime,
        ]);
        metricMap.set(`${metricPrefix}.accuracy`, [
          ...(metricMap.get(`${metricPrefix}.accuracy`) ?? []),
          result.accuracy,
        ]);
      }
    }
  }

  return [...metricMap.entries()].map(([metric, samples]) => ({
    metric,
    samples,
    summary: summarizeSamples(samples),
  }));
}

async function writeBaselineReport(report: BaselineCollectionReport, outputFile: string) {
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, JSON.stringify(report, null, 2));
}

export async function collectBaselines({
  repeatCount = 5,
  includeAppLifecycle = false,
  outputFile = path.join('test', 'baselines', 'migration-0', 'core-baseline.json'),
}: {
  repeatCount?: number;
  includeAppLifecycle?: boolean;
  outputFile?: string;
} = {}): Promise<BaselineCollectionReport> {
  const dbRuns: DbBenchmarkReport[] = [];
  const stringRuns: StringParserBenchmarkReport[] = [];

  for (let index = 0; index < repeatCount; index++) {
    dbRuns.push(runDbBenchmarks());
    stringRuns.push(ParserBenchmark.collectBenchmarkResults());
  }

  const report: BaselineCollectionReport = {
    benchmarkSuite: 'migration-0-core',
    generatedAt: new Date().toISOString(),
    repeatCount,
    includesAppLifecycle: includeAppLifecycle,
    db: {
      rawRuns: dbRuns,
      metrics: aggregateDbMetrics(dbRuns),
    },
    stringMatch: {
      rawRuns: stringRuns,
      metrics: aggregateStringMetrics(stringRuns),
    },
  };

  if (includeAppLifecycle) {
    report.appLifecycle = {
      startup: await runAppLifecycleBenchmark('startup'),
      idleMemory: await runAppLifecycleBenchmark('idle-memory'),
    };
  }

  await writeBaselineReport(report, outputFile);
  return report;
}

if (require.main === module) {
  const includeAppLifecycle = process.argv.includes('--include-app');
  const repeatArg = process.argv.find((arg) => arg.startsWith('--repeat='))?.split('=')[1];
  const repeatCount = repeatArg ? Number.parseInt(repeatArg, 10) : 5;

  collectBaselines({ repeatCount, includeAppLifecycle })
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
