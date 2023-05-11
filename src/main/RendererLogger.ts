import logger from 'electron-log';
let Renderer : any = null;

type Message = {
  text: string,
  type?: string,
  link?: string,
  linkEvent?: string,
}

export default {
  init: (renderer) => {
    Renderer = renderer;
  },
  log: ({ messages }: { messages: Message[] }) => {
    if(!Renderer) {
      logger.error('Renderer not initialized');
      return;
    }
    Renderer.send('add-log', { messages });
  },
}