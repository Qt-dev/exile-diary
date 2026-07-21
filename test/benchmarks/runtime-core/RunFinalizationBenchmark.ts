import * as fs from 'node:fs';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  parseClientLogFixture,
  type ParsedClientLogFixtureEvent,
} from '../../../src/main/runtime-core/fixtures/parseClientLogFixture';
import { summarizeSamples } from '../shared/stats';

export type RuntimeCoreRunBenchmarkReport = {
  benchmark: 'runtime-core';
  scenario: 'run-finalization';
  fixture: string;
  iterationsPerSample: number;
  samples: number[];
  summary: ReturnType<typeof summarizeSamples>;
  correctness: {
    matchesExpected: boolean;
    eventCount: number;
  };
};

function loadFixture() {
  const fixtureRoot = path.resolve(process.cwd(), 'test', 'Fixtures', 'migration-0');
  const logText = fs.readFileSync(
    path.join(fixtureRoot, 'run-reconstruction', 'sample-client-log.txt'),
    'utf8'
  );
  const expected = JSON.parse(
    fs.readFileSync(
      path.join(fixtureRoot, 'run-reconstruction', 'sample-expected-events.json'),
      'utf8'
    )
  ) as ParsedClientLogFixtureEvent[];

  return { logText, expected };
}

export function runRunFinalizationBenchmark({
  sampleCount = 5,
  iterationsPerSample = 1000,
}: {
  sampleCount?: number;
  iterationsPerSample?: number;
} = {}): RuntimeCoreRunBenchmarkReport {
  const { logText, expected } = loadFixture();
  const samples: number[] = [];
  let latestEvents: ParsedClientLogFixtureEvent[] = [];

  for (let warmup = 0; warmup < 20; warmup++) {
    parseClientLogFixture(logText);
  }

  for (let sample = 0; sample < sampleCount; sample++) {
    const startedAt = performance.now();
    for (let iteration = 0; iteration < iterationsPerSample; iteration++) {
      latestEvents = parseClientLogFixture(logText);
    }
    samples.push(Number((performance.now() - startedAt).toFixed(4)));
  }

  return {
    benchmark: 'runtime-core',
    scenario: 'run-finalization',
    fixture: 'run-reconstruction/sample-client-log.txt',
    iterationsPerSample,
    samples,
    summary: summarizeSamples(samples),
    correctness: {
      matchesExpected: JSON.stringify(latestEvents) === JSON.stringify(expected),
      eventCount: latestEvents.length,
    },
  };
}

if (require.main === module) {
  const report = runRunFinalizationBenchmark();
  console.log(JSON.stringify(report, null, 2));
}
