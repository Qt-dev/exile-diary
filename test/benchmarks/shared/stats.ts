export type SampleSummary = {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
};

function sortNumbers(values: number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

function percentile(sortedValues: number[], percentileValue: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }

  if (sortedValues.length === 1) {
    return sortedValues[0];
  }

  const index = (sortedValues.length - 1) * percentileValue;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);

  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex];
  }

  const weight = index - lowerIndex;
  return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
}

export function summarizeSamples(values: number[]): SampleSummary {
  if (!values.length) {
    throw new Error('Cannot summarize an empty sample set');
  }

  const sortedValues = sortNumbers(values);
  const total = sortedValues.reduce((sum, value) => sum + value, 0);

  return {
    count: sortedValues.length,
    min: sortedValues[0],
    max: sortedValues[sortedValues.length - 1],
    mean: total / sortedValues.length,
    median: percentile(sortedValues, 0.5),
    p95: percentile(sortedValues, 0.95),
  };
}

export function slugifyMetricName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
