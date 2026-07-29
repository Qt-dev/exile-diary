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
