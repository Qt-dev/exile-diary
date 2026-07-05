import * as fs from 'node:fs';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  priceFixtureItems,
  type FixtureItem,
  type FixtureRateSnapshot,
} from '../../../src/main/runtime-core/fixtures/priceFixtureItems';
import { summarizeSamples } from '../shared/stats';

export type RuntimeCorePricingBenchmarkReport = {
  benchmark: 'runtime-core';
  scenario: 'pricing-batch';
  fixture: string;
  iterationsPerSample: number;
  samples: number[];
  summary: ReturnType<typeof summarizeSamples>;
  correctness: {
    matchesExpected: boolean;
    totalChaosValue: number;
    itemsPriced: number;
  };
};

function loadFixture() {
  const fixtureRoot = path.resolve(process.cwd(), 'test', 'Fixtures', 'migration-0');
  const items = JSON.parse(
    fs.readFileSync(path.join(fixtureRoot, 'pricing', 'sample-items.json'), 'utf8')
  ) as FixtureItem[];
  const rates = JSON.parse(
    fs.readFileSync(path.join(fixtureRoot, 'pricing', 'frozen-rates.json'), 'utf8')
  ) as FixtureRateSnapshot;
  const expected = JSON.parse(
    fs.readFileSync(path.join(fixtureRoot, 'pricing', 'sample-expected-pricing.json'), 'utf8')
  ) as { totalChaosValue: number; itemsPriced: number };

  return { items, rates, expected };
}

export function runPricingBatchBenchmark({
  sampleCount = 5,
  iterationsPerSample = 1000,
}: {
  sampleCount?: number;
  iterationsPerSample?: number;
} = {}): RuntimeCorePricingBenchmarkReport {
  const { items, rates, expected } = loadFixture();
  const samples: number[] = [];
  let latestPricing = priceFixtureItems(items, rates);

  for (let warmup = 0; warmup < 20; warmup++) {
    priceFixtureItems(items, rates);
  }

  for (let sample = 0; sample < sampleCount; sample++) {
    const startedAt = performance.now();
    for (let iteration = 0; iteration < iterationsPerSample; iteration++) {
      latestPricing = priceFixtureItems(items, rates);
    }
    samples.push(Number((performance.now() - startedAt).toFixed(4)));
  }

  return {
    benchmark: 'runtime-core',
    scenario: 'pricing-batch',
    fixture: 'pricing/sample-items.json',
    iterationsPerSample,
    samples,
    summary: summarizeSamples(samples),
    correctness: {
      matchesExpected:
        latestPricing.totalChaosValue === expected.totalChaosValue &&
        latestPricing.itemsPriced === expected.itemsPriced,
      totalChaosValue: latestPricing.totalChaosValue,
      itemsPriced: latestPricing.itemsPriced,
    },
  };
}

if (require.main === module) {
  const report = runPricingBatchBenchmark();
  console.log(JSON.stringify(report, null, 2));
}
