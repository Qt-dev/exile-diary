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
  log: ({ messages, onOverlay = true}: { messages: Message[], onOverlay?: boolean }) => {
    if (!Renderer) {
      logger.error('Renderer not initialized');
      return;
    }
    Renderer.send('add-log', { messages });
    if (onOverlay) {
      OverlayRenderer.send('overlay:message', { messages })
    }
  },
};
