import { createRendererRunUseCases } from '../../../src/main/runtime-core/use-cases/createRendererRunUseCases';

describe('createRendererRunUseCases', () => {
  it('normalizes an unavailable run repository to an empty list', async () => {
    const deps = {
      runs: {
        getLastRuns: jest.fn().mockResolvedValue(null),
      },
    } as any;

    const useCases = createRendererRunUseCases(deps);

    await expect(useCases.loadRuns(25)).resolves.toEqual([]);
  });
});
