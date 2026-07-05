import {
  createDefaultRendererRuntimeDependencies,
  pickRendererRunUseCaseDependencies,
  pickRendererSettingsUseCaseDependencies,
  pickRendererStashUseCaseDependencies,
  pickRendererStatsUseCaseDependencies,
  RendererRuntimeDependencies,
} from './rendererRuntimeDependencies';
import { createRendererRunUseCases } from './use-cases/createRendererRunUseCases';
import { createRendererSettingsUseCases } from './use-cases/createRendererSettingsUseCases';
import { createRendererStashUseCases } from './use-cases/createRendererStashUseCases';
import { createRendererStatsUseCases } from './use-cases/createRendererStatsUseCases';

export function createRendererRuntimeService(
  deps: RendererRuntimeDependencies = createDefaultRendererRuntimeDependencies()
) {
  return {
    ...createRendererRunUseCases(pickRendererRunUseCaseDependencies(deps)),
    ...createRendererSettingsUseCases(pickRendererSettingsUseCaseDependencies(deps)),
    ...createRendererStashUseCases(pickRendererStashUseCaseDependencies(deps)),
    ...createRendererStatsUseCases(pickRendererStatsUseCaseDependencies(deps)),
  };
}

export type RendererRuntimeService = ReturnType<typeof createRendererRuntimeService>;
