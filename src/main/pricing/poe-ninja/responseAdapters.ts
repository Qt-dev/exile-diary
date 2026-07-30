import type { LegacyPriceSnapshot, PriceIndex } from '../types';
import type { PoeNinjaCategory, PoeNinjaCategoryDefinition } from './categoryCatalog';
import {
  buildForbiddenJewelIdentifier,
  buildGemPriceIdentifier,
  buildIncursionRoomIdentifier,
} from '../matching/priceIdentities';

export type AdapterName =
  | 'exchange'
  | 'baseType'
  | 'wombgift'
  | 'item'
  | 'map'
  | 'uniqueMap'
  | 'forbiddenJewel'
  | 'beast'
  | 'valdoMap'
  | 'incursionTemple';

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
    if (line.count && line.count < 10) continue;
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
      setPrice(result, line.name, line.chaosValue);
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

function forbiddenJewel(response: PoeNinjaResponse): PriceIndex {
  const result: PriceIndex = {};
  for (const line of response.lines ?? []) {
    const passiveName = line.metadata?.passiveName ?? line.name;
    if (typeof line.variant !== 'string' || typeof passiveName !== 'string') continue;
    setPrice(
      result,
      buildForbiddenJewelIdentifier(line.variant, passiveName),
      line.chaosValue
    );
  }
  return result;
}

function beast(response: PoeNinjaResponse): PriceIndex {
  const result: PriceIndex = {};
  for (const line of response.lines ?? []) setPrice(result, line.name, line.chaosValue);
  return result;
}

function valdoMap(response: PoeNinjaResponse): PriceIndex {
  const result: PriceIndex = {};
  const ambiguousTitles = new Set<string>();
  for (const line of response.lines ?? []) {
    if (ambiguousTitles.has(line.name)) continue;
    if (result[line.name] !== undefined) {
      delete result[line.name];
      ambiguousTitles.add(line.name);
      continue;
    }
    setPrice(result, line.name, line.chaosValue);
  }
  return result;
}

function incursionTemple(response: PoeNinjaResponse): PriceIndex {
  const result: PriceIndex = {};
  for (const line of response.lines ?? []) {
    const match = String(line.name ?? '').match(/^(.*) \(Tier (\d+)\)$/);
    const identifier = match
      ? buildIncursionRoomIdentifier(match[1], Number(match[2]))
      : line.name;
    setPrice(result, identifier, line.chaosValue);
  }
  return result;
}

const adapters: Record<AdapterName, (response: PoeNinjaResponse) => PriceIndex> = {
  exchange,
  baseType,
  wombgift,
  item,
  map,
  uniqueMap,
  forbiddenJewel,
  beast,
  valdoMap,
  incursionTemple,
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
