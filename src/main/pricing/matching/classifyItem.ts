export function isHelmetCategory(category: unknown): boolean {
  return category === 'Helmet' || category === 'Helmets';
}

export function isAllflameEmber(item: { typeline?: string } | null | undefined): boolean {
  return Boolean(item?.typeline?.startsWith('Allflame Ember'));
}
