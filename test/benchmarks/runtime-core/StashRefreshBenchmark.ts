import * as fs from 'node:fs';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  type FixtureItem,
  type FixtureRateSnapshot,
} from '../../../src/main/runtime-core/fixtures/priceFixtureItems';
import { valueFixtureStash } from '../../../src/main/runtime-core/fixtures/valueFixtureStash';
import { summarizeSamples } from '../shared/stats';

export type RuntimeCoreStashBenchmarkReport = {
  benchmark: 'runtime-core';
  scenario: 'stash-refresh';
  fixture: string;
  iterationsPerSample: number;
  samples: number[];
  summary: ReturnType<typeof summarizeSamples>;
  correctness: {
    matchesExpected: boolean;
    currencyTotalChaos: number;
    itemsPriced: number;
  };
};

function loadFixture() {
  const fixtureRoot = path.resolve(process.cwd(), 'test', 'Fixtures', 'migration-0');
  const items = JSON.parse(
    fs.readFileSync(path.join(fixtureRoot, 'stash', 'sample-stash-items.json'), 'utf8')
  ) as FixtureItem[];
  const rates = JSON.parse(
    fs.readFileSync(path.join(fixtureRoot, 'pricing', 'frozen-rates.json'), 'utf8')
  ) as FixtureRateSnapshot;
  const expected = JSON.parse(
    fs.readFileSync(path.join(fixtureRoot, 'stash', 'sample-expected-valuation.json'), 'utf8')
  ) as { currencyTotalChaos: number; itemsPriced: number };

  return { items, rates, expected };
}

export function runStashRefreshBenchmark({
  sampleCount = 5,
  iterationsPerSample = 1000,
}: {
  sampleCount?: number;
  iterationsPerSample?: number;
} = {}): RuntimeCoreStashBenchmarkReport {
  const { items, rates, expected } = loadFixture();
  const samples: number[] = [];
  let latestValuation = valueFixtureStash(items, rates);

  for (let warmup = 0; warmup < 20; warmup++) {
    valueFixtureStash(items, rates);
  }

  for (let sample = 0; sample < sampleCount; sample++) {
    const startedAt = performance.now();
    for (let iteration = 0; iteration < iterationsPerSample; iteration++) {
      latestValuation = valueFixtureStash(items, rates);
    }
    samples.push(Number((performance.now() - startedAt).toFixed(4)));
  }

  return {
    benchmark: 'runtime-core',
    scenario: 'stash-refresh',
    fixture: 'stash/sample-stash-items.json',
    iterationsPerSample,
    samples,
    summary: summarizeSamples(samples),
    correctness: {
      matchesExpected:
        latestValuation.currencyTotalChaos === expected.currencyTotalChaos &&
        latestValuation.itemsPriced === expected.itemsPriced,
      currencyTotalChaos: latestValuation.currencyTotalChaos,
      itemsPriced: latestValuation.itemsPriced,
    },
  };
}

if (require.main === module) {
  const report = runStashRefreshBenchmark();
  console.log(JSON.stringify(report, null, 2));
}
