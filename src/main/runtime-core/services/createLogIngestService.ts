import LogProcessor from '../../modules/LogProcessor';

export function createLogIngestService(logProcessor = LogProcessor) {
  return {
    emitter: logProcessor.emitter,
    schedule: logProcessor.schedule.bind(logProcessor),
    processGeneration: logProcessor.processGeneration.bind(logProcessor),
    processEnd: logProcessor.processEnd.bind(logProcessor),
    processNewInstance: logProcessor.processNewInstance.bind(logProcessor),
    processOther: logProcessor.processOther.bind(logProcessor),
    reprocessEvents: logProcessor.reprocessEvents.bind(logProcessor),
    reprocessEvent: logProcessor.reprocessEvent.bind(logProcessor),
    readLine: logProcessor.readLine.bind(logProcessor),
  };
}
