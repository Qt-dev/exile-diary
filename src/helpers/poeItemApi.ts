export type PoeItemModFlags = {
  crafted?: boolean;
  fractured?: boolean;
  mutated?: boolean;
  vestigial?: boolean;
  desecrated?: boolean;
};

export type PoeItemMod = {
  description: string;
  flags?: PoeItemModFlags;
};

export type PoeItemModInput = string | PoeItemMod;

const frameTypesById: Record<string, number> = {
  normal: 0,
  magic: 1,
  rare: 2,
  unique: 3,
  gem: 4,
  currency: 5,
  divinationcard: 6,
  quest: 7,
  prophecy: 8,
  foil: 9,
  supporterfoil: 10,
  necropolis: 11,
  gold: 12,
  breachskill: 13,
  breachgraftpseudogem: 13,
};

function normalizeFrameTypeId(frameTypeId: string) {
  return frameTypeId.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

export function getLegacyFrameType(item: { frameTypeId?: unknown; frameType?: unknown }): number | undefined {
  if (typeof item.frameTypeId === 'string') {
    const frameType = frameTypesById[normalizeFrameTypeId(item.frameTypeId)];
    if (frameType !== undefined) return frameType;
  }

  return typeof item.frameType === 'number' ? item.frameType : undefined;
}

export function getItemModDescription(mod: PoeItemModInput): string {
  return typeof mod === 'string' ? mod : mod.description;
}

export function getItemModDescriptions(mods?: PoeItemModInput[] | null): string[] {
  return (mods ?? []).map(getItemModDescription).filter((description) => typeof description === 'string');
}

export function getItemMods(mods?: PoeItemModInput[] | null): PoeItemMod[] {
  return (mods ?? []).flatMap((mod) => {
    if (typeof mod === 'string') return [{ description: mod }];
    return typeof mod?.description === 'string' ? [mod] : [];
  });
}
