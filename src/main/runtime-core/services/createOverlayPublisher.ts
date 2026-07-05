type OverlayPublisherDependencies = {
  sendToMain: (event: string, data?: any) => void;
  sendToOverlay: (event: string, data?: any) => void;
  rendererLogger: {
    log: (payload: { messages: Array<Record<string, any>>; onOverlay?: boolean }) => void;
  };
};

export function createOverlayPublisher({
  sendToMain,
  sendToOverlay,
  rendererLogger,
}: OverlayPublisherDependencies) {
  return {
    publishToMain(event: string, data?: any) {
      sendToMain(event, data);
    },

    publishToOverlay(event: string, data?: any) {
      sendToOverlay(event, data);
    },

    publishToBoth(event: string, data?: any) {
      sendToMain(event, data);
      sendToOverlay(event, data);
    },

    log(payload: { messages: Array<Record<string, any>>; onOverlay?: boolean }) {
      rendererLogger.log(payload);
    },
  };
}
