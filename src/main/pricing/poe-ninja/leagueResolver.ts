export function normalizePoeNinjaLeagueName(league: string): string {
  const normalized = league.trim();
  const lowercaseLeague = normalized.toLowerCase();

  if (lowercaseLeague === 'allflame' || lowercaseLeague === 'curse of the allflame') {
    return 'Allflame';
  }
  if (
    lowercaseLeague === 'hardcore allflame' ||
    lowercaseLeague === 'hardcore curse of the allflame'
  ) {
    return 'Hardcore Allflame';
  }
  return normalized;
}
