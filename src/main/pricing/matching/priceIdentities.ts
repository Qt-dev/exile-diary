export function buildGemPriceIdentifier(
  name: string,
  level: number,
  quality: number,
  corrupted: boolean
): string {
  const exceptional =
    name.includes('Empower') || name.includes('Enlighten') || name.includes('Enhance');
  const minimumListedLevel = exceptional ? 2 : name.includes('Brand Recall') ? 6 : 4;
  let identifier = `${name}${level >= minimumListedLevel ? ` L${level}` : ''}`;

  if (!exceptional) {
    if (quality === 23) identifier += ' Q23';
    else if (quality >= 20) identifier += ' Q20';
  }
  if (corrupted) identifier += ' (Corrupted)';
  return identifier;
}

export function clusterItemLevelBucket(itemLevel: number): 84 | 75 | 50 | 1 {
  if (itemLevel >= 84) return 84;
  if (itemLevel >= 75) return 75;
  if (itemLevel >= 50) return 50;
  return 1;
}

export function buildForbiddenJewelIdentifier(jewelName: string, passiveName: string): string {
  return `${jewelName} (${passiveName})`;
}

export function extractForbiddenPassive(modifiers: readonly string[] = []): string | undefined {
  for (const modifier of modifiers) {
    const match = modifier.match(
      /Allocates (.+?) if you have (?:the )?matching modifier on Forbidden (?:Flame|Flesh)/i
    );
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

export function buildBlightedMapIdentifier(
  tier: number,
  generation: number,
  ravaged: boolean
): string {
  return `${ravaged ? 'Blight-ravaged' : 'Blighted'} Map (Tier ${tier}) Gen-${generation}`;
}

export function buildIncursionRoomIdentifier(room: string, level: number): string {
  return `${room} (Tier ${level})`;
}

export function buildValdoMapIdentifier(name: string, reward?: string): string {
  return reward ? `${name} (${reward})` : name;
}

export function buildShrineBeltIdentifier(name: string, shrines: readonly string[]): string {
  return `${name} (${[...shrines].sort((a, b) => a.localeCompare(b)).join(', ')})`;
}

export function extractShrineNames(modifiers: readonly string[] = []): string[] {
  return modifiers.flatMap((modifier) => {
    const match = modifier.match(/^You have (.+) Shrine Buff while affected by no Flasks$/i);
    return match?.[1] ? [match[1].trim()] : [];
  });
}
