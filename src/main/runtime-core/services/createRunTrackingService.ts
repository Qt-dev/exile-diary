import RunParser from '../../modules/RunParser';

export function createRunTrackingService(runParser = RunParser) {
  return {
    emitter: runParser.emitter,
    get latestGeneratedArea() {
      return runParser.latestGeneratedArea;
    },
    refreshTracking: runParser.refreshTracking.bind(runParser),
    setCurrentMapStats: runParser.setCurrentMapStats.bind(runParser),
    tryProcess: runParser.tryProcess.bind(runParser),
    tryUpdateCurrentArea: runParser.tryUpdateCurrentArea.bind(runParser),
    captureInventory:
      runParser.captureInventory?.bind(runParser) ?? (async () => ({ itemCount: 0, eventCreated: false })),
  };
}
