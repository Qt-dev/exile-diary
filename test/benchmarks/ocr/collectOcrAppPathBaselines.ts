import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  runScanMapModsAppPathBenchmark,
  type ScanMapModsAppPathBenchmarkReport,
} from './ScanMapModsAppPathBenchmark';

type OcrAppPathBaselineReport = {
  benchmarkSuite: 'migration-6-ocr-app-path';
  generatedAt: string;
  reports: [ScanMapModsAppPathBenchmarkReport];
};

export async function collectOcrAppPathBaselines({
  outputFile = path.join('test', 'baselines', 'migration-6', 'ocr-app-path-baseline.json'),
}: {
  outputFile?: string;
} = {}): Promise<OcrAppPathBaselineReport> {
  const report: OcrAppPathBaselineReport = {
    benchmarkSuite: 'migration-6-ocr-app-path',
    generatedAt: new Date().toISOString(),
    reports: [await runScanMapModsAppPathBenchmark()],
  };

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, JSON.stringify(report, null, 2));
  return report;
}

if (require.main === module) {
  collectOcrAppPathBaselines()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
