import logger from 'electron-log';
import { RendererRuntimeDependencies } from '../rendererRuntimeDependencies';

export function createRendererRunUseCases(deps: RendererRuntimeDependencies) {
  return {
    async loadRuns(size: number) {
      logger.info(
        `Loading ${size === Number.MAX_SAFE_INTEGER ? 'all' : size} runs from runtime-core`
      );
      return deps.runs.getLastRuns(size);
    },

    async loadRun(runId: string | number) {
      logger.info(`Loading a single run with id: ${runId}`);
      return deps.runs.getRun(Number(runId));
    },

    async loadRunDetails(runId: string | number) {
      logger.info(`Loading details for run with id: ${runId}`);
      return deps.runs.getRun(Number(runId));
    },

    async reprocessRuns() {
      logger.info('Reprocessing all runs');
      await deps.runParser.reprocessRuns();
      deps.rendererLogger.log({ messages: [{ text: 'All runs have been reprocessed.' }] });
    },

    async reprocessRun(runId: string | number) {
      logger.info(`Reprocessing run with id: ${runId}`);
      const numericRunId = Number(runId);
      await deps.runParser.reprocessRun(numericRunId);
      return deps.runs.getRun(numericRunId);
    },

    async debugRecheckGain(from?: string, to?: string) {
      logger.info('Debugging recheck gain from the renderer process');
      await deps.runParser.recheckGained(from, to);
    },

    async updateItemsIgnoreStatus(data: Array<{ id: string; status: boolean }>) {
      logger.info('Updating items ignore status from the renderer process');
      await deps.itemsDb.updateIgnoredItems(data);
    },
  };
}
