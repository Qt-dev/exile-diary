type RuntimeStartupStep = () => Promise<unknown>;

export async function initializeAndStartBackgroundRuntime(
  ensureRuntimeStateInitialized: RuntimeStartupStep,
  startBackgroundRuntime: RuntimeStartupStep
) {
  await ensureRuntimeStateInitialized();
  await startBackgroundRuntime();
}
