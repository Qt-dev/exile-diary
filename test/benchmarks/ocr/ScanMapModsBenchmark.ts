import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import Piscina from 'piscina';
import { createScheduler, createWorker } from 'tesseract.js';
import { matchMapMods } from '../../../src/main/modules/ImageParser/matchMapMods';
import { summarizeSamples } from '../shared/stats';

type OcrStageSample = {
  capture: number;
  preprocess: number;
  ocr: number;
  match: number;
  total: number;
};

export type ScanMapModsBenchmarkReport = {
  benchmark: 'ocr-map-mods';
  fixture: string;
  sampleCount: number;
  samples: OcrStageSample[];
  summaries: {
    capture: ReturnType<typeof summarizeSamples>;
    preprocess: ReturnType<typeof summarizeSamples>;
    ocr: ReturnType<typeof summarizeSamples>;
    match: ReturnType<typeof summarizeSamples>;
    total: ReturnType<typeof summarizeSamples>;
  };
  correctness: {
    matchesExpected: boolean;
    status: string;
    matchedMods: string[];
  };
};

const fixtureRoot = path.resolve(process.cwd(), 'test', 'Fixtures', 'migration-0', 'ocr');
const workerBasePath = path.resolve(process.cwd(), 'src', 'main', 'modules', 'ImageParser');

async function createSchedulerForBenchmark() {
  const scheduler = createScheduler();
  const worker = await createWorker('eng', 1, {
    langPath: process.cwd(),
    gzip: false,
  });
  await worker.load();
  await worker.setParameters({
    tessedit_char_whitelist:
      "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ:-' ,%+",
  });
  scheduler.addWorker(worker);
  return scheduler;
}

async function runSingleSample(
  piscina: Piscina,
  scheduler: ReturnType<typeof createScheduler>,
  screenshotPath: string
) {
  const totalStartedAt = performance.now();

  const captureStartedAt = performance.now();
  const svg = fs.readFileSync(screenshotPath, 'utf8');
  const screenshotBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  const capture = Number((performance.now() - captureStartedAt).toFixed(4));

  const recognize = async (modsImage: Buffer) => {
    const startedAt = performance.now();
    const {
      data: { text },
    } = await scheduler.addJob('recognize', modsImage);
    return {
      text,
      durationMs: Number((performance.now() - startedAt).toFixed(4)),
    };
  };

  const firstPass = await piscina.run(
    {
      screenshotBuffer,
      forceFullImage: false,
    },
    { name: 'preprocessMapModsScreenshot' }
  );
  const firstOcr = await recognize(firstPass.modsImage);

  let preprocess = firstPass.timingsMs.preprocess;
  let ocr = firstOcr.durationMs;
  let text = firstOcr.text;

  if (!text.trim()) {
    const fallbackPass = await piscina.run(
      {
        screenshotBuffer,
        forceFullImage: true,
      },
      { name: 'preprocessMapModsScreenshot' }
    );
    const fallbackOcr = await recognize(fallbackPass.modsImage);
    preprocess = Number((preprocess + fallbackPass.timingsMs.preprocess).toFixed(4));
    ocr = Number((ocr + fallbackOcr.durationMs).toFixed(4));
    text = fallbackOcr.text;

    if (!text.trim()) {
      const rawOcr = await recognize(screenshotBuffer);
      ocr = Number((ocr + rawOcr.durationMs).toFixed(4));
      text = rawOcr.text;
    }
  }

  const matchStartedAt = performance.now();
  const matchResult = matchMapMods(text.split('\n'));
  const match = Number((performance.now() - matchStartedAt).toFixed(4));

  return {
    sample: {
      capture,
      preprocess,
      ocr,
      match,
      total: Number((performance.now() - totalStartedAt).toFixed(4)),
    },
    matchResult,
  };
}

export async function runScanMapModsBenchmark({
  sampleCount = 3,
}: {
  sampleCount?: number;
} = {}): Promise<ScanMapModsBenchmarkReport> {
  const screenshotPath = path.join(fixtureRoot, 'sample-mods.svg');
  const expected = JSON.parse(
    fs.readFileSync(path.join(fixtureRoot, 'sample-expected-mods.json'), 'utf8')
  ) as string[];

  const piscina = new Piscina({
    filename: path.resolve(workerBasePath, 'workerWrapper.js'),
    workerData: { fullpath: path.resolve(workerBasePath, 'OcrPipelineWorker.js') },
  });
  const scheduler = await createSchedulerForBenchmark();

  try {
    const samples: OcrStageSample[] = [];
    let lastMatchResult = null as ReturnType<typeof matchMapMods> | null;

    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
      const { sample, matchResult } = await runSingleSample(piscina, scheduler, screenshotPath);
      samples.push(sample);
      lastMatchResult = matchResult;
    }

    return {
      benchmark: 'ocr-map-mods',
      fixture: 'ocr/sample-mods.svg',
      sampleCount,
      samples,
      summaries: {
        capture: summarizeSamples(samples.map((sample) => sample.capture)),
        preprocess: summarizeSamples(samples.map((sample) => sample.preprocess)),
        ocr: summarizeSamples(samples.map((sample) => sample.ocr)),
        match: summarizeSamples(samples.map((sample) => sample.match)),
        total: summarizeSamples(samples.map((sample) => sample.total)),
      },
      correctness: {
        matchesExpected:
          JSON.stringify(lastMatchResult?.matchedMods.map((match) => match.mod) ?? []) ===
          JSON.stringify(expected),
        status: lastMatchResult?.status ?? 'error',
        matchedMods: lastMatchResult?.matchedMods.map((match) => match.mod) ?? [],
      },
    };
  } finally {
    await piscina.destroy();
    await scheduler.terminate();
  }
}

if (require.main === module) {
  runScanMapModsBenchmark()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
