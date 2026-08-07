const getStashData = jest.fn();

jest.mock('../../src/main/db/repositories/stashtabs', () => ({
  __esModule: true,
  default: { getStashData: (...args: unknown[]) => getStashData(...args) },
}));

jest.mock('../../src/main/SettingsManager', () => ({
  __esModule: true,
  default: { get: jest.fn(() => ({ league: 'Settlers' })) },
}));

jest.mock('../../src/main/modules/StashGetter', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock('../../src/main/RendererLogger', () => ({
  __esModule: true,
  default: { log: jest.fn() },
}));

jest.mock('electron-log', () => ({
  error: jest.fn(),
}));

import StashTabsManager from '../../src/main/StashTabsManager';

describe('StashTabsManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getStashData.mockResolvedValue({ value: 123, items: JSON.stringify([{ id: 'item-1' }]) });
  });

  it('uses the persisted compact timestamp format for the default snapshot cutoff', async () => {
    const result = await StashTabsManager.getStashData();

    expect(getStashData).toHaveBeenCalledWith(expect.stringMatching(/^\d{14}$/), 'Settlers');
    expect(result).toEqual({ value: 123, items: [{ id: 'item-1' }] });
  });

  it('preserves an explicitly supplied historical cutoff', async () => {
    await StashTabsManager.getStashData('20240102030405');

    expect(getStashData).toHaveBeenCalledWith('20240102030405', 'Settlers');
  });
});
