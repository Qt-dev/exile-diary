import logger from 'electron-log';
import dayjs, { Dayjs } from 'dayjs';
let Renderer: any = null;
let OverlayRenderer: any = null;

type Message = {
  text: string;
  type?: string;
  link?: string;
  linkEvent?: string;
  price?: number;
  divinePrice?: number;
};

const maxHistory = 100;
const messagesHistory : { timestamp: Dayjs , messages: Message[] }[] = [];

function addToHistory(messages : Message[]) {
  if(messagesHistory.length > maxHistory - 1) {
    messagesHistory.shift();
  }
  messagesHistory.push({ timestamp: dayjs(), messages });
}

const RendererLogger = {
  init: (renderer, overlayRenderer) => {
    Renderer = renderer;
    OverlayRenderer = overlayRenderer;
  },
  log: ({ messages, onOverlay = true }: { messages: Message[]; onOverlay?: boolean }) => {
    addToHistory(messages);
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
  logLatestMessages: (numberOfLogs = 10) => {
    if (!Renderer) {
      logger.error('Renderer not initialized');
      return;
    }
    for(let i = Math.max(messagesHistory.length - numberOfLogs, 0); i < messagesHistory.length; i++) {
      const { messages, timestamp } = messagesHistory[i];
      Renderer.send('add-log', { messages, timestamp });
      OverlayRenderer.send('overlay:message', { messages });
    }
  }
};

export default RendererLogger;
