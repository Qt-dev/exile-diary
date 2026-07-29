import type { LegacyPriceSnapshot, PriceIndex } from '../types';
import type { PoeNinjaCategory, PoeNinjaCategoryDefinition } from './categoryCatalog';
import { buildGemPriceIdentifier } from '../matching/priceIdentities';

export type AdapterName = 'exchange' | 'baseType' | 'wombgift' | 'item' | 'map' | 'uniqueMap';

type PoeNinjaResponse = { lines?: any[]; items?: any[] };

function setPrice(index: PriceIndex, identifier: string | undefined, value: unknown) {
  if (!identifier || typeof value !== 'number' || !Number.isFinite(value)) return;
  const existing = index[identifier];
  index[identifier] = existing === undefined ? value : Math.max(existing, value);
}

function exchange(response: PoeNinjaResponse): PriceIndex {
  const result: PriceIndex = {};
  const names = new Map((response.items ?? []).map((item) => [item.id, item.name]));
  for (const line of response.lines ?? []) {
    setPrice(result, names.get(line.id) ?? line.name, line.primaryValue);
  }
  return result;
}

function baseType(response: PoeNinjaResponse): PriceIndex {
  const result: PriceIndex = {};
  for (const line of response.lines ?? []) {
    const variant = line.variant ? ` ${line.variant}` : '';
    setPrice(result, `${line.name} L${line.levelRequired}${variant}`, line.chaosValue);
  }
  return result;
}

function wombgift(response: PoeNinjaResponse): PriceIndex {
  const result: PriceIndex = {};
  for (const line of response.lines ?? []) {
    setPrice(result, `${line.name} L${line.levelRequired}`, line.chaosValue);
  }
  return result;
}

function item(response: PoeNinjaResponse): PriceIndex {
  const result: PriceIndex = {};
  for (const line of response.lines ?? []) {
    let identifier = line.name;
    if (line.links === 6) {
      identifier += ' 6L';
    } else if (line.gemLevel) {
      identifier = buildGemPriceIdentifier(
        line.name,
        line.gemLevel,
        line.gemQuality ?? 0,
        Boolean(line.corrupted)
      );
    } else if (line.baseType?.includes('Cluster Jewel') && line.variant) {
      identifier += ` L${line.levelRequired} ${line.variant.split(' ')[0]}P`;
    } else if (line.variant) {
      identifier += ` (${line.variant})`;
    }
    setPrice(result, identifier, line.chaosValue);
  }
  return result;
}

function map(response: PoeNinjaResponse): PriceIndex {
  const result: PriceIndex = {};
  for (const line of response.lines ?? []) {
    const variant = line.variant ? ` ${String(line.variant).replace(', ', '')}` : '';
    setPrice(result, `${line.name}${variant}`, line.chaosValue);
  }
  return result;
}

function uniqueMap(response: PoeNinjaResponse): PriceIndex {
  const result: PriceIndex = {};
  for (const line of response.lines ?? []) setPrice(result, line.name, line.chaosValue);
  return result;
}

const adapters: Record<AdapterName, (response: PoeNinjaResponse) => PriceIndex> = {
  exchange,
  baseType,
  wombgift,
  item,
  map,
  uniqueMap,
};

export function adaptPoeNinjaResponse(
  definition: PoeNinjaCategoryDefinition,
  response: PoeNinjaResponse
): PriceIndex {
  return adapters[definition.adapter](response);
}

export function assembleLegacySnapshot(
  categories: Partial<Record<PoeNinjaCategory, PriceIndex>>,
  definitions: Readonly<Record<PoeNinjaCategory, PoeNinjaCategoryDefinition>>
): LegacyPriceSnapshot {
  const snapshot: LegacyPriceSnapshot = {};
  for (const [category, index] of Object.entries(categories)) {
    if (!index) continue;
    const destination = definitions[category as PoeNinjaCategory].destination;
    snapshot[destination] = Object.assign(snapshot[destination] ?? {}, index);
  }
  return snapshot;
}
