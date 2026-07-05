export type ScanMapModsJob = {
  jobId: string;
  profileId: string;
  league: string;
  trigger: 'manual' | 'map-enter' | 'retry';
  captureRegionHint?: {
    side: 'right';
    windowTitlePattern: string;
  };
  debugArtifacts?: boolean;
};

export type ScanMapModsStatus = 'ok' | 'no-window' | 'no-text' | 'low-confidence' | 'error';

export type ScanMapModsMatchedMod = {
  input: string;
  normalized: string;
  mod: string;
  confidence: number;
};

export type ScanMapModsResult = {
  jobId: string;
  status: ScanMapModsStatus;
  rawLines: string[];
  normalizedLines: string[];
  matchedMods: ScanMapModsMatchedMod[];
  timingsMs: {
    capture: number;
    preprocess: number;
    ocr: number;
    match: number;
  };
  diagnostics?: {
    averageConfidence: number;
    matchedLineRatio: number;
    debugArtifactDir?: string;
    error?: string;
  };
};
