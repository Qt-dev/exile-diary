import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { runScanMapModsBenchmark, type ScanMapModsBenchmarkReport } from './ScanMapModsBenchmark';

type OcrBaselineReport = {
  benchmarkSuite: 'migration-5-ocr';
  generatedAt: string;
  reports: [ScanMapModsBenchmarkReport];
};

export async function collectOcrBaselines({
  outputFile = path.join('test', 'baselines', 'migration-5', 'ocr-baseline.json'),
}: {
  outputFile?: string;
} = {}): Promise<OcrBaselineReport> {
  const report: OcrBaselineReport = {
    benchmarkSuite: 'migration-5-ocr',
    generatedAt: new Date().toISOString(),
    reports: [await runScanMapModsBenchmark()],
  };

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, JSON.stringify(report, null, 2));
  return report;
}

if (require.main === module) {
  collectOcrBaselines()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
