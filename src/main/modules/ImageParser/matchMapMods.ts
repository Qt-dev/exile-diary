import type {
  ScanMapModsMatchedMod,
  ScanMapModsResult,
} from './ScanMapModsContract';
import { OCR_PRECISION_THRESHOLDS, resolveOcrPrecision } from './ocrPrecisionPolicy';
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

export function matchMapMods(rawLines: string[]): Pick<
  ScanMapModsResult,
  'rawLines' | 'normalizedLines' | 'matchedMods' | 'status' | 'diagnostics'
> {
  const filteredRawLines = rawLines.map((line) => line.trim()).filter((line) => line.length > 0);
  const normalizedLines = normalizeLines(filteredRawLines);
  const matchedMods = buildMatchedMods(filteredRawLines, normalizedLines);
  const { status, averageConfidence, matchedLineRatio, retryPolicy } = resolveOcrPrecision({
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
      retryRecommended: retryPolicy.shouldRetry,
      retryReason: retryPolicy.reason,
      thresholds: OCR_PRECISION_THRESHOLDS,
    },
  };
}
