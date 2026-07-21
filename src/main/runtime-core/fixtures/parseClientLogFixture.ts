const generationRegex = /Generating level\s(?<level>\d+)\sarea\s"(?<areaId>\S+)"/;
const enteredRegex = /You have entered (?<area>.*)\.$/;
const slainRegex = /has been slain|has committed suicide/;
const npcLineRegex = /^(?<npc>.*?): (?<text>.*)$/;

export type ParsedClientLogFixtureEvent =
  | { type: 'entered'; text: string }
  | { type: 'generatedArea'; areaId: string; level: number }
  | { type: 'masters' }
  | { type: 'slain' };

function parseFixtureLine(line: string): ParsedClientLogFixtureEvent | null {
  const content = line.split('] ').slice(1).join('] ').trim();
  const normalizedContent = content.startsWith(': ') ? content.slice(2) : content;

  const enteredMatch = enteredRegex.exec(normalizedContent);
  if (enteredMatch?.groups?.area) {
    return {
      type: 'entered',
      text: enteredMatch.groups.area.trim(),
    };
  }

  const generationMatch = generationRegex.exec(normalizedContent);
  if (generationMatch?.groups?.areaId && generationMatch.groups.level) {
    return {
      type: 'generatedArea',
      areaId: generationMatch.groups.areaId,
      level: Number.parseInt(generationMatch.groups.level, 10),
    };
  }

  if (slainRegex.test(normalizedContent)) {
    return { type: 'slain' };
  }

  const npcMatch = npcLineRegex.exec(normalizedContent);
  if (npcMatch?.groups?.npc?.includes('Master')) {
    return { type: 'masters' };
  }

  return null;
}

export function parseClientLogFixture(logText: string): ParsedClientLogFixtureEvent[] {
  return logText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseFixtureLine)
    .filter((event): event is ParsedClientLogFixtureEvent => event !== null);
}
