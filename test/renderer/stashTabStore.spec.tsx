import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getStashTabs, logger, on } = vi.hoisted(() => {
  const logger = {
    error: vi.fn(),
    info: vi.fn(),
    scope: vi.fn(),
  };
  logger.scope.mockReturnValue(logger);
  return {
    getStashTabs: vi.fn(),
    logger,
    on: vi.fn(),
  };
});

vi.mock('../../src/renderer/electron.service', () => ({
  electronService: {
    getStashTabs,
    logger,
    on,
    saveStashTabs: vi.fn(),
  },
}));

const { default: StashTabStore } = await import('../../src/renderer/stores/stashTabStore');

describe('StashTabStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    on.mockReturnValue(vi.fn());
  });

  it('coalesces lazy loads and can retry after a failed request', async () => {
    let rejectFirstRequest;
    getStashTabs.mockImplementationOnce(
      () =>
        new Promise((resolve, reject) => {
          rejectFirstRequest = reject;
        })
    );
    const store = new StashTabStore();

    const first = store.ensureLoaded();
    const duplicate = store.ensureLoaded();
    rejectFirstRequest(new Error('temporary API failure'));

    await expect(first).rejects.toThrow('temporary API failure');
    await expect(duplicate).rejects.toThrow('temporary API failure');
    expect(getStashTabs).toHaveBeenCalledTimes(1);
    expect(store.isLoading).toBe(false);
    expect(store.hasLoaded).toBe(false);

    getStashTabs.mockResolvedValueOnce({
      stashTabs: [{ id: 'currency', name: 'Currency', tracked: true }],
      data: { items: [], value: 42 },
    });

    await store.ensureLoaded();

    expect(getStashTabs).toHaveBeenCalledTimes(2);
    expect(store.hasLoaded).toBe(true);
    expect(store.stashTabs).toHaveLength(1);
    expect(store.value).toBe(42);
  });

  it('retries when the backend returns no stash tabs', async () => {
    getStashTabs
      .mockResolvedValueOnce({
        stashTabs: [],
        data: {},
      })
      .mockResolvedValueOnce({
        stashTabs: [{ id: 'currency', name: 'Currency', tracked: true }],
        data: { items: [], value: 42 },
      });
    const store = new StashTabStore();

    await store.ensureLoaded();

    expect(store.hasLoaded).toBe(false);
    expect(getStashTabs).toHaveBeenCalledTimes(1);

    await store.ensureLoaded();

    expect(getStashTabs).toHaveBeenCalledTimes(2);
    expect(store.hasLoaded).toBe(true);
    expect(store.stashTabs).toHaveLength(1);
  });
});
