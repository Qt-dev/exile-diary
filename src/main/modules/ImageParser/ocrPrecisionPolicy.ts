import type { ScanMapModsMatchedMod, ScanMapModsStatus } from './ScanMapModsContract';

export const OCR_PRECISION_THRESHOLDS = {
  minimumAverageConfidence: 0.6,
  minimumMatchedLineRatio: 0.5,
  retryAverageConfidenceThreshold: 0.75,
  retryMatchedLineRatioThreshold: 0.75,
} as const;

export type OcrRetryPolicy = {
  shouldRetry: boolean;
  reason: 'no-text' | 'no-matches' | 'low-average-confidence' | 'low-line-ratio' | 'none';
};

export function resolveOcrPrecision({
  rawLines,
  matchedMods,
}: {
  rawLines: string[];
  matchedMods: ScanMapModsMatchedMod[];
}): {
  status: ScanMapModsStatus;
  averageConfidence: number;
  matchedLineRatio: number;
  retryPolicy: OcrRetryPolicy;
} {
  if (rawLines.length === 0) {
    return {
      status: 'no-text',
      averageConfidence: 0,
      matchedLineRatio: 0,
      retryPolicy: {
        shouldRetry: true,
        reason: 'no-text',
      },
    };
  }

  const averageConfidence =
    matchedMods.length === 0
      ? 0
      : matchedMods.reduce((sum, match) => sum + match.confidence, 0) / matchedMods.length;
  const matchedLineRatio = matchedMods.length / rawLines.length;

  if (matchedMods.length === 0) {
    return {
      status: 'low-confidence',
      averageConfidence,
      matchedLineRatio,
      retryPolicy: {
        shouldRetry: true,
        reason: 'no-matches',
      },
    };
  }

  if (
    averageConfidence < OCR_PRECISION_THRESHOLDS.minimumAverageConfidence ||
    matchedLineRatio < OCR_PRECISION_THRESHOLDS.minimumMatchedLineRatio
  ) {
    const reason =
      averageConfidence < OCR_PRECISION_THRESHOLDS.minimumAverageConfidence
        ? 'low-average-confidence'
        : 'low-line-ratio';

    return {
      status: 'low-confidence',
      averageConfidence,
      matchedLineRatio,
      retryPolicy: {
        shouldRetry: true,
        reason,
      },
    };
  }

  const shouldRetry =
    averageConfidence < OCR_PRECISION_THRESHOLDS.retryAverageConfidenceThreshold ||
    matchedLineRatio < OCR_PRECISION_THRESHOLDS.retryMatchedLineRatioThreshold;

  return {
    status: 'ok',
    averageConfidence,
    matchedLineRatio,
    retryPolicy: {
      shouldRetry,
      reason: shouldRetry
        ? averageConfidence < OCR_PRECISION_THRESHOLDS.retryAverageConfidenceThreshold
          ? 'low-average-confidence'
          : 'low-line-ratio'
        : 'none',
    },
  };
}
