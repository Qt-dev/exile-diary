import type { AdapterName } from './responseAdapters';

export type PoeNinjaEndpointFamily = 'exchange' | 'stash';

export const EXCHANGE_CATEGORIES = [
  'Currency',
  'Fragment',
  'Runegraft',
  'AllflameEmber',
  'Tattoo',
  'Omen',
  'DjinnCoin',
  'Ducat',
  'EnshroudingCrystal',
  'DivinationCard',
  'Artifact',
  'Oil',
  'DeliriumOrb',
  'Scarab',
  'Astrolabe',
  'Fossil',
  'Resonator',
  'Essence',
] as const;

export const STASH_CATEGORIES = [
  'Wombgift',
  'Incubator',
  'UniqueWeapon',
  'UniqueArmour',
  'UniqueAccessory',
  'UniqueFlask',
  'UniqueJewel',
  'ForbiddenJewel',
  'ShrineBelt',
  'UniqueTincture',
  'UniqueRelic',
  'SkillGem',
  'ImbuedGem',
  'ClusterJewel',
  'Map',
  'BlightedMap',
  'BlightRavagedMap',
  'UniqueMap',
  'ValdoMap',
  'Invitation',
  'Memory',
  'IncursionTemple',
  'BaseType',
  'Beast',
  'Vial',
] as const;

export type PoeNinjaExchangeCategory = (typeof EXCHANGE_CATEGORIES)[number];
export type PoeNinjaStashCategory = (typeof STASH_CATEGORIES)[number];
export type PoeNinjaCategory = PoeNinjaExchangeCategory | PoeNinjaStashCategory;

export type PoeNinjaCategoryDefinition = {
  endpoint: PoeNinjaEndpointFamily;
  adapter: AdapterName;
  destination: string;
};

const currencyDestinations = new Set<PoeNinjaCategory>([
  'Currency',
  'Runegraft',
  'DjinnCoin',
  'Ducat',
  'EnshroudingCrystal',
  'Artifact',
  'Oil',
  'DeliriumOrb',
  'Astrolabe',
  'Fossil',
  'Resonator',
  'Essence',
  'Incubator',
  'Beast',
  'Vial',
]);

const uniqueDestinations = new Set<PoeNinjaCategory>([
  'UniqueWeapon',
  'UniqueArmour',
  'UniqueAccessory',
  'UniqueFlask',
  'UniqueJewel',
  'ForbiddenJewel',
  'ShrineBelt',
  'UniqueTincture',
  'UniqueRelic',
]);

function adapterFor(category: PoeNinjaCategory): AdapterName {
  if ((EXCHANGE_CATEGORIES as readonly string[]).includes(category)) return 'exchange';
  if (category === 'BaseType') return 'baseType';
  if (category === 'Wombgift') return 'wombgift';
  if (category === 'Map' || category === 'BlightedMap' || category === 'BlightRavagedMap') {
    return 'map';
  }
  if (category === 'UniqueMap') return 'uniqueMap';
  return 'item';
}

function destinationFor(category: PoeNinjaCategory): string {
  if (category === 'Tattoo' || category === 'Omen' || category === 'AllflameEmber') {
    return category;
  }
  if (currencyDestinations.has(category)) return 'Currency';
  if (category === 'Fragment' || category === 'Scarab') return 'Fragment';
  if (uniqueDestinations.has(category)) return 'UniqueItem';
  if (category === 'SkillGem' || category === 'ImbuedGem') return 'SkillGem';
  if (category === 'Map' || category === 'BlightedMap' || category === 'BlightRavagedMap') {
    return 'Map';
  }
  return category;
}

export const POE_NINJA_CATEGORIES: Readonly<
  Record<PoeNinjaCategory, PoeNinjaCategoryDefinition>
> = Object.fromEntries([
  ...EXCHANGE_CATEGORIES.map((category) => [
    category,
    { endpoint: 'exchange' as const, adapter: adapterFor(category), destination: destinationFor(category) },
  ]),
  ...STASH_CATEGORIES.map((category) => [
    category,
    { endpoint: 'stash' as const, adapter: adapterFor(category), destination: destinationFor(category) },
  ]),
]) as Record<PoeNinjaCategory, PoeNinjaCategoryDefinition>;

export function buildPoeNinjaPath(category: PoeNinjaCategory, league: string): string {
  const definition = POE_NINJA_CATEGORIES[category];
  return `/poe1/api/economy/${definition.endpoint === 'exchange' ? 'exchange/current/overview' : 'stash/current/item/overview'}?league=${encodeURIComponent(league)}&type=${encodeURIComponent(category)}`;
}
