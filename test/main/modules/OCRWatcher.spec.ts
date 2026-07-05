import path from 'node:path';
import { EventEmitter } from 'node:events';

const forkMock = jest.fn();

jest.mock('node:child_process', () => ({
  fork: (...args: unknown[]) => forkMock(...args),
}));

jest.mock('electron-log', () => ({
  scope: () => ({
    info: jest.fn(),
    error: jest.fn(),
  }),
}));

type MockChildProcess = EventEmitter & {
  connected: boolean;
  killed: boolean;
  stdout: EventEmitter;
  stderr: EventEmitter;
  send: jest.Mock;
  kill: jest.Mock;
};

function createMockChildProcess(): MockChildProcess {
  const child = new EventEmitter() as MockChildProcess;
  child.connected = true;
  child.killed = false;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.send = jest.fn((message: any) => {
    if (message.command === 'health-check') {
      setImmediate(() => {
        child.emit('message', {
          type: 'response',
          requestId: message.requestId,
          ok: true,
          result: {
            status: 'ready',
            pid: 4242,
            startedAt: '2026-07-05T08:00:00.000Z',
          },
        });
      });
    }

    if (message.command === 'scan-screenshot-buffer') {
      setImmediate(() => {
        child.emit('message', {
          type: 'response',
          requestId: message.requestId,
          ok: true,
          result: {
            jobId: message.payload.job.jobId,
            status: 'ok',
          },
        });
      });
    }

    if (message.command === 'shutdown') {
      setImmediate(() => {
        child.connected = false;
        child.killed = true;
        child.emit('exit', 0, null);
      });
    }
  });
  child.kill = jest.fn(() => {
    child.connected = false;
    child.killed = true;
    child.emit('exit', 0, null);
  });
  return child;
}

describe('OCRWatcher', () => {
  beforeEach(() => {
    jest.resetModules();
    forkMock.mockReset();
    process.env.ELECTRON_RENDERER_URL = 'http://localhost:3003';
  });

  afterEach(() => {
    delete process.env.ELECTRON_RENDERER_URL;
  });

  it('spawns the OCR sidecar and resolves scan requests through the IPC bridge', async () => {
    const child = createMockChildProcess();
    forkMock.mockImplementation((entryPath: string) => {
      setImmediate(() => {
        child.emit('message', {
          type: 'ready',
          pid: 4242,
          startedAt: '2026-07-05T08:00:00.000Z',
        });
      });
      return child;
    });

    const watcher = require('../../../src/main/modules/ImageParser/OCRWatcher');
    const result = await watcher.scanScreenshotBuffer(
      Buffer.from('sample'),
      { jobId: 'job-1' },
      { captureMs: 12.5 }
    );

    expect(forkMock).toHaveBeenCalledTimes(1);
    expect(forkMock.mock.calls[0][0]).toContain(
      path.join('src', 'main', 'modules', 'ImageParser', 'OcrSidecar.ts')
    );
    expect(forkMock.mock.calls[0][2]).toMatchObject({
      execArgv: ['--require', 'tsx/cjs'],
      serialization: 'advanced',
    });
    expect(child.send).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'health-check',
      })
    );
    expect(child.send).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'scan-screenshot-buffer',
      })
    );
    expect(result).toEqual({
      jobId: 'job-1',
      status: 'ok',
    });

    await watcher.stop();
  });

  it('re-emits OCR lifecycle events from the sidecar process', async () => {
    const child = createMockChildProcess();
    forkMock.mockImplementation(() => {
      setImmediate(() => {
        child.emit('message', {
          type: 'ready',
          pid: 4242,
          startedAt: '2026-07-05T08:00:00.000Z',
        });
      });
      return child;
    });

    const watcher = require('../../../src/main/modules/ImageParser/OCRWatcher');
    const completedListener = jest.fn();
    const errorListener = jest.fn();
    watcher.emitter.on('ocr:completed-job', completedListener);
    watcher.emitter.on('OCRError', errorListener);

    await watcher.start();

    child.emit('message', {
      type: 'event',
      eventName: 'ocr:completed-job',
      payload: { result: { jobId: 'job-2' } },
    });
    child.emit('message', {
      type: 'event',
      eventName: 'OCRError',
    });

    expect(completedListener).toHaveBeenCalledWith({
      result: { jobId: 'job-2' },
    });
    expect(errorListener).toHaveBeenCalledTimes(1);

    await watcher.stop();
  });
});
