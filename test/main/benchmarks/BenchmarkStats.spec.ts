import { summarizeSamples } from '../../benchmarks/shared/stats';

describe('benchmark sample summaries', () => {
  it('calculates stable median and p95 values', () => {
    const summary = summarizeSamples([10, 20, 30, 40, 50]);

    expect(summary.count).toBe(5);
    expect(summary.min).toBe(10);
    expect(summary.max).toBe(50);
    expect(summary.mean).toBe(30);
    expect(summary.median).toBe(30);
    expect(summary.p95).toBe(48);
  });
});
