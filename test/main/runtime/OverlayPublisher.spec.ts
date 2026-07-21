import { createOverlayPublisher } from '../../../src/main/runtime-core/services/createOverlayPublisher';

describe('OverlayPublisher', () => {
  it('routes messages to main, overlay, and renderer log sinks', () => {
    const sendToMain = jest.fn();
    const sendToOverlay = jest.fn();
    const rendererLogger = {
      log: jest.fn(),
    };

    const publisher = createOverlayPublisher({
      sendToMain,
      sendToOverlay,
      rendererLogger,
    });

    publisher.publishToMain('main:event', { ok: true });
    publisher.publishToOverlay('overlay:event', { overlay: true });
    publisher.publishToBoth('both:event', { shared: true });
    publisher.log({ messages: [{ text: 'hello' }], onOverlay: false });

    expect(sendToMain.mock.calls).toEqual([
      ['main:event', { ok: true }],
      ['both:event', { shared: true }],
    ]);
    expect(sendToOverlay.mock.calls).toEqual([
      ['overlay:event', { overlay: true }],
      ['both:event', { shared: true }],
    ]);
    expect(rendererLogger.log).toHaveBeenCalledWith({
      messages: [{ text: 'hello' }],
      onOverlay: false,
    });
  });
});
