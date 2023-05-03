import logger from 'electron-log';
let Renderer : any = null;

export default {
  init: (renderer) => {
    Renderer = renderer;
  },
  log: (messages) => {
    if(!Renderer) {
      logger.error('Renderer not initialized');
      return;
    }
    Renderer.send('add-log', messages);
  },
}