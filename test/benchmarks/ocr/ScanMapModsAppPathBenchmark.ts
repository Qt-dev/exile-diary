import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import { summarizeSamples } from '../shared/stats';

type OcrAppPathSample = {
  capture: number;
  preprocess: number;
  ocr: number;
  match: number;
  stageTotal: number;
  wallTotal: number;
  bridgeOverhead: number;
};

type OcrPathReport = {
  startupMs: number;
  sampleCount: number;
  samples: OcrAppPathSample[];
  summaries: {
    capture: ReturnType<typeof summarizeSamples>;
    preprocess: ReturnType<typeof summarizeSamples>;
    ocr: ReturnType<typeof summarizeSamples>;
    match: ReturnType<typeof summarizeSamples>;
    stageTotal: ReturnType<typeof summarizeSamples>;
    wallTotal: ReturnType<typeof summarizeSamples>;
    bridgeOverhead: ReturnType<typeof summarizeSamples>;
  };
  correctness: {
    matchesExpected: boolean;
    status: string;
    matchedMods: string[];
  };
};

export type ScanMapModsAppPathBenchmarkReport = {
  benchmark: 'ocr-app-path';
  fixture: string;
  sampleCount: number;
  inProcess: OcrPathReport;
  sidecar: OcrPathReport;
  deltasMs: {
    startup: number;
    wallTotalMedian: number;
    wallTotalP95: number;
    bridgeOverheadMedian: number;
    bridgeOverheadP95: number;
  };
};

type OcrScanResult = {
  status: string;
  matchedMods: Array<{
    mod: string;
  }>;
  timingsMs: {
    capture: number;
    preprocess: number;
    ocr: number;
    match: number;
  };
};

const fixtureRoot = path.resolve(process.cwd(), 'test', 'Fixtures', 'migration-0', 'ocr');

function round(value: number) {
  return Number(value.toFixed(4));
}

async function loadFixtureScreenshotBuffer() {
  const screenshotPath = path.join(fixtureRoot, 'sample-mods.svg');
  const svg = fs.readFileSync(screenshotPath, 'utf8');
  const screenshotBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  const expected = JSON.parse(
    fs.readFileSync(path.join(fixtureRoot, 'sample-expected-mods.json'), 'utf8')
  ) as string[];

  return {
    fixture: 'ocr/sample-mods.svg',
    screenshotBuffer,
    expected,
  };
}

function buildPathReport({
  startupMs,
  sampleCount,
  samples,
  lastResult,
  expected,
}: {
  startupMs: number;
  sampleCount: number;
  samples: OcrAppPathSample[];
  lastResult: OcrScanResult | null;
  expected: string[];
}): OcrPathReport {
  return {
    startupMs: round(startupMs),
    sampleCount,
    samples,
    summaries: {
      capture: summarizeSamples(samples.map((sample) => sample.capture)),
      preprocess: summarizeSamples(samples.map((sample) => sample.preprocess)),
      ocr: summarizeSamples(samples.map((sample) => sample.ocr)),
      match: summarizeSamples(samples.map((sample) => sample.match)),
      stageTotal: summarizeSamples(samples.map((sample) => sample.stageTotal)),
      wallTotal: summarizeSamples(samples.map((sample) => sample.wallTotal)),
      bridgeOverhead: summarizeSamples(samples.map((sample) => sample.bridgeOverhead)),
    },
    correctness: {
      matchesExpected:
        JSON.stringify(lastResult?.matchedMods.map((match) => match.mod) ?? []) ===
        JSON.stringify(expected),
      status: lastResult?.status ?? 'error',
      matchedMods: lastResult?.matchedMods.map((match) => match.mod) ?? [],
    },
  };
}

async function benchmarkInProcessPath(
  screenshotBuffer: Buffer,
  expected: string[],
  sampleCount: number
): Promise<OcrPathReport> {
  const { createOcrScanService } = require('../../../src/main/modules/ImageParser/OcrScanService');
  const service = createOcrScanService({
    currentMainDir: path.resolve(process.cwd(), 'src', 'main', 'modules', 'ImageParser'),
    cwd: process.cwd(),
    isDev: true,
    persistMatchedMods: async () => null,
    settingsProvider: () => ({
      activeProfile: {
        characterName: 'benchmark-profile',
        league: 'benchmark-league',
      },
      forceDebugMode: false,
    }),
    getMapStatsFn: () => ({ iir: 0, iiq: 0, pack_size: 0 }),
    tesseractLangPath: process.cwd(),
  });

  const startupStartedAt = performance.now();
  await service.start();
  const startupMs = performance.now() - startupStartedAt;

  try {
    const samples: OcrAppPathSample[] = [];
    let lastResult: OcrScanResult | null = null;

    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
      const wallStartedAt = performance.now();
      const result = (await service.scanScreenshotBuffer(
        screenshotBuffer,
        {
          jobId: `benchmark-in-process-${sampleIndex + 1}`,
          profileId: 'benchmark-profile',
          league: 'benchmark-league',
          trigger: 'manual',
          debugArtifacts: false,
        },
        { captureMs: 0 }
      )) as OcrScanResult;
      const wallTotal = round(performance.now() - wallStartedAt);
      const stageTotal = round(
        result.timingsMs.capture +
          result.timingsMs.preprocess +
          result.timingsMs.ocr +
          result.timingsMs.match
      );

      samples.push({
        capture: result.timingsMs.capture,
        preprocess: result.timingsMs.preprocess,
        ocr: result.timingsMs.ocr,
        match: result.timingsMs.match,
        stageTotal,
        wallTotal,
        bridgeOverhead: round(Math.max(0, wallTotal - stageTotal)),
      });
      lastResult = result;
    }

    return buildPathReport({
      startupMs,
      sampleCount,
      samples,
      lastResult,
      expected,
    });
  } finally {
    await service.dispose();
  }
}

async function benchmarkSidecarPath(
  screenshotBuffer: Buffer,
  expected: string[],
  sampleCount: number
): Promise<OcrPathReport> {
  const previousRendererUrl = process.env.ELECTRON_RENDERER_URL;
  const previousBenchmarkMode = process.env.EXILE_DIARY_OCR_BENCHMARK_MODE;
  const previousPersist = process.env.EXILE_DIARY_OCR_DISABLE_PERSIST;
  const previousMapStats = process.env.EXILE_DIARY_OCR_DISABLE_MAP_STATS;
  const previousTessData = process.env.EXILE_DIARY_TESSDATA_PATH;
  const previousUserDataPath = process.env.EXILE_DIARY_USER_DATA_PATH;
  const benchmarkUserDataPath = path.resolve(
    process.cwd(),
    '.tmp',
    'benchmarks',
    'ocr-app-path-user-data'
  );

  process.env.ELECTRON_RENDERER_URL = previousRendererUrl ?? 'http://benchmark.local';
  process.env.EXILE_DIARY_OCR_BENCHMARK_MODE = '1';
  process.env.EXILE_DIARY_OCR_DISABLE_PERSIST = '1';
  process.env.EXILE_DIARY_OCR_DISABLE_MAP_STATS = '1';
  process.env.EXILE_DIARY_TESSDATA_PATH = process.cwd();
  process.env.EXILE_DIARY_USER_DATA_PATH = benchmarkUserDataPath;
  fs.mkdirSync(benchmarkUserDataPath, { recursive: true });

  const watcher = require('../../../src/main/modules/ImageParser/OCRWatcher');
  const startupStartedAt = performance.now();
  await watcher.start();
  const startupMs = performance.now() - startupStartedAt;

  try {
    const samples: OcrAppPathSample[] = [];
    let lastResult: OcrScanResult | null = null;

    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
      const wallStartedAt = performance.now();
      const result = (await watcher.scanScreenshotBuffer(
        screenshotBuffer,
        {
          jobId: `benchmark-sidecar-${sampleIndex + 1}`,
          profileId: 'benchmark-profile',
          league: 'benchmark-league',
          trigger: 'manual',
          debugArtifacts: false,
        },
        { captureMs: 0 }
      )) as OcrScanResult;
      const wallTotal = round(performance.now() - wallStartedAt);
      const stageTotal = round(
        result.timingsMs.capture +
          result.timingsMs.preprocess +
          result.timingsMs.ocr +
          result.timingsMs.match
      );

      samples.push({
        capture: result.timingsMs.capture,
        preprocess: result.timingsMs.preprocess,
        ocr: result.timingsMs.ocr,
        match: result.timingsMs.match,
        stageTotal,
        wallTotal,
        bridgeOverhead: round(Math.max(0, wallTotal - stageTotal)),
      });
      lastResult = result;
    }

    return buildPathReport({
      startupMs,
      sampleCount,
      samples,
      lastResult,
      expected,
    });
  } finally {
    await watcher.stop();

    if (previousRendererUrl === undefined) {
      delete process.env.ELECTRON_RENDERER_URL;
    } else {
      process.env.ELECTRON_RENDERER_URL = previousRendererUrl;
    }

    if (previousBenchmarkMode === undefined) {
      delete process.env.EXILE_DIARY_OCR_BENCHMARK_MODE;
    } else {
      process.env.EXILE_DIARY_OCR_BENCHMARK_MODE = previousBenchmarkMode;
    }

    if (previousPersist === undefined) {
      delete process.env.EXILE_DIARY_OCR_DISABLE_PERSIST;
    } else {
      process.env.EXILE_DIARY_OCR_DISABLE_PERSIST = previousPersist;
    }

    if (previousMapStats === undefined) {
      delete process.env.EXILE_DIARY_OCR_DISABLE_MAP_STATS;
    } else {
      process.env.EXILE_DIARY_OCR_DISABLE_MAP_STATS = previousMapStats;
    }

    if (previousTessData === undefined) {
      delete process.env.EXILE_DIARY_TESSDATA_PATH;
    } else {
      process.env.EXILE_DIARY_TESSDATA_PATH = previousTessData;
    }

    if (previousUserDataPath === undefined) {
      delete process.env.EXILE_DIARY_USER_DATA_PATH;
    } else {
      process.env.EXILE_DIARY_USER_DATA_PATH = previousUserDataPath;
    }
  }
}

export async function runScanMapModsAppPathBenchmark({
  sampleCount = 3,
}: {
  sampleCount?: number;
} = {}): Promise<ScanMapModsAppPathBenchmarkReport> {
  const { fixture, screenshotBuffer, expected } = await loadFixtureScreenshotBuffer();
  const inProcess = await benchmarkInProcessPath(screenshotBuffer, expected, sampleCount);
  const sidecar = await benchmarkSidecarPath(screenshotBuffer, expected, sampleCount);

  return {
    benchmark: 'ocr-app-path',
    fixture,
    sampleCount,
    inProcess,
    sidecar,
    deltasMs: {
      startup: round(sidecar.startupMs - inProcess.startupMs),
      wallTotalMedian: round(
        sidecar.summaries.wallTotal.median - inProcess.summaries.wallTotal.median
      ),
      wallTotalP95: round(sidecar.summaries.wallTotal.p95 - inProcess.summaries.wallTotal.p95),
      bridgeOverheadMedian: round(
        sidecar.summaries.bridgeOverhead.median - inProcess.summaries.bridgeOverhead.median
      ),
      bridgeOverheadP95: round(
        sidecar.summaries.bridgeOverhead.p95 - inProcess.summaries.bridgeOverhead.p95
      ),
    },
  };
}

if (require.main === module) {
  runScanMapModsAppPathBenchmark()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
