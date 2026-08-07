export type PriceMatch = {
  name: string;
  test: (item: any) => boolean;
  calculateValue: (item: any, minItemValue?: number) => number;
};

export function firstMatchingRule<T extends { test: (item: any) => boolean }>(
  rules: readonly T[],
  item: any,
  fallback: T
): T {
  return rules.find((rule) => rule.test(item)) ?? fallback;
}
