import { beforeEach, describe, expect, it, vi } from 'vitest';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

const loadRuns = vi.fn();
const logger = {
  error: vi.fn(),
  info: vi.fn(),
  scope: vi.fn(),
};
logger.scope.mockImplementation(() => logger);

vi.mock('../../src/renderer/electron.service', () => ({
  electronService: {
    loadRuns,
    logger,
    on: vi.fn(() => vi.fn()),
  },
}));

const { default: RunStore } = await import('../../src/renderer/stores/runStore');

describe('RunStore startup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('treats a null startup response as an empty run list', async () => {
    loadRuns.mockResolvedValue(null);
    const store = new RunStore(false);

    await store.loadRuns();

    expect(store.runs).toEqual([]);
    expect(store.isLoading).toBe(false);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('clears loading state when the backend request fails', async () => {
    const error = new Error('runtime unavailable');
    loadRuns.mockRejectedValue(error);
    const store = new RunStore(false);

    await expect(store.loadRuns()).resolves.toBeUndefined();

    expect(store.runs).toEqual([]);
    expect(store.isLoading).toBe(false);
    expect(logger.error).toHaveBeenCalledWith('Failed to load runs from the server.', error);
  });
});
