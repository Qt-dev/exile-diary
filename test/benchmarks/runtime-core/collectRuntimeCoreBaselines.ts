import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  runPricingBatchBenchmark,
  type RuntimeCorePricingBenchmarkReport,
} from './PricingBatchBenchmark';
import {
  runRunFinalizationBenchmark,
  type RuntimeCoreRunBenchmarkReport,
} from './RunFinalizationBenchmark';
import {
  runStashRefreshBenchmark,
  type RuntimeCoreStashBenchmarkReport,
} from './StashRefreshBenchmark';

type RuntimeCoreBaselineReport = {
  benchmarkSuite: 'migration-4-runtime-core';
  generatedAt: string;
  reports: [
    RuntimeCoreRunBenchmarkReport,
    RuntimeCorePricingBenchmarkReport,
    RuntimeCoreStashBenchmarkReport,
  ];
};

export async function collectRuntimeCoreBaselines({
  sampleCount = 5,
  iterationsPerSample = 1000,
  outputFile = path.join('test', 'baselines', 'migration-4', 'runtime-core-baseline.json'),
}: {
  sampleCount?: number;
  iterationsPerSample?: number;
  outputFile?: string;
} = {}): Promise<RuntimeCoreBaselineReport> {
  const report: RuntimeCoreBaselineReport = {
    benchmarkSuite: 'migration-4-runtime-core',
    generatedAt: new Date().toISOString(),
    reports: [
      runRunFinalizationBenchmark({ sampleCount, iterationsPerSample }),
      runPricingBatchBenchmark({ sampleCount, iterationsPerSample }),
      runStashRefreshBenchmark({ sampleCount, iterationsPerSample }),
    ],
  };

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, JSON.stringify(report, null, 2));
  return report;
}

if (require.main === module) {
  collectRuntimeCoreBaselines()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
