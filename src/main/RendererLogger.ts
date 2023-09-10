import logger from 'electron-log';
let Renderer: any = null;
let OverlayRenderer: any = null;

type Message = {
  text: string;
  type?: string;
  link?: string;
  linkEvent?: string;
};

export default {
  init: (renderer, overlayRenderer) => {
    Renderer = renderer;
    OverlayRenderer = overlayRenderer;
  },
  log: ({ messages, onOverlay = true }: { messages: Message[]; onOverlay?: boolean }) => {
    if (!Renderer) {
      logger.error('Renderer not initialized');
      return;
    }
    Renderer.send('add-log', { messages });
    if (onOverlay && !OverlayRenderer) {
      logger.error('OverlayRenderer does not seem to be initialized');
      logger.error(OverlayRenderer);
    } else if (onOverlay) {
      try {
        OverlayRenderer.send('overlay:message', { messages });
      } catch (e) {
        Renderer.send('add-log', {
          messages: [
            {
              text: 'OverlayRenderer errored while sending a message. Is it disconnected?',
              type: 'error',
            },
          ],
        });

        logger.error('OverlayRenderer errored while sending a message. Is it disconnected?');
        logger.error(OverlayRenderer);
        logger.error(e);
      }
    }
  },
};
