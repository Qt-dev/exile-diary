export type RunProcessReason = 'automatic' | 'explicit-end';
export type ExplicitMapEndSource = 'chat' | 'shortcut';

export type RunProcessRequest = {
  event: {
    timestamp: string;
    area?: string;
    server?: string;
  };
  reason?: RunProcessReason;
  source?: ExplicitMapEndSource;
};

export function createExplicitMapEndRequest(
  timestamp: string,
  source: ExplicitMapEndSource,
  server?: string
): RunProcessRequest {
  return {
    event: {
      timestamp,
      ...(server ? { server } : {}),
    },
    reason: 'explicit-end',
    source,
  };
}

export function isMapEndSignal(content: string, activeCharacterName: string) {
  const normalizedCharacterName = activeCharacterName.trim().toLocaleLowerCase();
  if (!normalizedCharacterName) return false;

  const taggedWhisper = /^@(?:to|from)(?:\s+<[^>]*>)?\s+(.+?):\s*end\s*$/i.exec(content);
  const legacyMessage = /^(.+?):\s*end\s*$/i.exec(content);
  const signaledCharacter = taggedWhisper?.[1] ?? legacyMessage?.[1];

  return signaledCharacter?.trim().toLocaleLowerCase() === normalizedCharacterName;
}
