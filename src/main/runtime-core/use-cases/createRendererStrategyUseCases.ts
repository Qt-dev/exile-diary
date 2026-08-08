import type { StrategyInput } from '../../../shared/strategies';
import type { RendererStrategyUseCaseDependencies } from '../rendererRuntimeDependencies';

export function createRendererStrategyUseCases(deps: RendererStrategyUseCaseDependencies) {
  return {
    async listStrategies() {
      return deps.strategies.list();
    },

    async createStrategy(input: StrategyInput) {
      return deps.strategies.create(input);
    },

    async updateStrategy(strategyId: number, input: StrategyInput) {
      return deps.strategies.update(Number(strategyId), input);
    },

    async deleteStrategy(strategyId: number) {
      await deps.strategies.delete(Number(strategyId));
    },

    async setRunStrategies(runId: string | number, strategyIds: number[]) {
      return deps.strategies.setForRun(Number(runId), strategyIds);
    },
  };
}
