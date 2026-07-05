import type {
  ScanMapModsMatchedMod,
  ScanMapModsResult,
  ScanMapModsStatus,
} from './ScanMapModsContract';
import StringParser from '../StringParser/StringParser';

function normalizeLines(rawLines: string[]) {
  return rawLines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.toLowerCase());
}

function buildMatchedMods(rawLines: string[], normalizedLines: string[]): ScanMapModsMatchedMod[] {
  const detailedMatches = StringParser.GetModsDetailed(rawLines);

  return detailedMatches
    .filter((match) => match.mod.length > 0)
    .map((match) => ({
      input: match.input,
      normalized: match.normalized,
      mod: match.mod,
      confidence: match.confidence,
    }));
}

function resolveStatus({
  rawLines,
  matchedMods,
}: {
  rawLines: string[];
  matchedMods: ScanMapModsMatchedMod[];
}): {
  status: ScanMapModsStatus;
  averageConfidence: number;
  matchedLineRatio: number;
} {
  if (rawLines.length === 0) {
    return {
      status: 'no-text',
      averageConfidence: 0,
      matchedLineRatio: 0,
    };
  }

  const averageConfidence =
    matchedMods.length === 0
      ? 0
      : matchedMods.reduce((sum, match) => sum + match.confidence, 0) / matchedMods.length;
  const matchedLineRatio = rawLines.length === 0 ? 0 : matchedMods.length / rawLines.length;

  if (matchedMods.length === 0) {
    return {
      status: 'low-confidence',
      averageConfidence,
      matchedLineRatio,
    };
  }

  if (averageConfidence < 0.6 || matchedLineRatio < 0.5) {
    return {
      status: 'low-confidence',
      averageConfidence,
      matchedLineRatio,
    };
  }

  return {
    status: 'ok',
    averageConfidence,
    matchedLineRatio,
  };
}

export function matchMapMods(rawLines: string[]): Pick<
  ScanMapModsResult,
  'rawLines' | 'normalizedLines' | 'matchedMods' | 'status' | 'diagnostics'
> {
  const filteredRawLines = rawLines.map((line) => line.trim()).filter((line) => line.length > 0);
  const normalizedLines = normalizeLines(filteredRawLines);
  const matchedMods = buildMatchedMods(filteredRawLines, normalizedLines);
  const { status, averageConfidence, matchedLineRatio } = resolveStatus({
    rawLines: filteredRawLines,
    matchedMods,
  });

  return {
    rawLines: filteredRawLines,
    normalizedLines,
    matchedMods,
    status,
    diagnostics: {
      averageConfidence: Number(averageConfidence.toFixed(4)),
      matchedLineRatio: Number(matchedLineRatio.toFixed(4)),
    },
  };
}
