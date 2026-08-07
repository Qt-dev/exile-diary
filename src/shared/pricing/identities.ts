export function buildGemPriceIdentifier(name: string, level: number, quality: number, corrupted: boolean): string {
  const exceptional = name.includes('Empower') || name.includes('Enlighten') || name.includes('Enhance');
  const minimumListedLevel = exceptional ? 2 : name.includes('Brand Recall') ? 6 : 4;
  let identifier = `${name}${level >= minimumListedLevel ? ` L${level}` : ''}`;
  if (!exceptional) {
    if (quality === 23) identifier += ' Q23';
    else if (quality >= 20) identifier += ' Q20';
  }
  return corrupted ? `${identifier} (Corrupted)` : identifier;
}

export function buildForbiddenJewelIdentifier(jewelName: string, passiveName: string): string {
  return `${jewelName} (${passiveName})`;
}

export function buildIncursionRoomIdentifier(room: string, level: number): string {
  return `${room} (Tier ${level})`;
}
