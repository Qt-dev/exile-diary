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
  (child as any).pid = 4242;
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
    process.env.EXILE_DIARY_APP_VERSION = '1.10.2-test';
    process.env.EXILE_DIARY_IS_PACKAGED = 'false';
    process.env.EXILE_DIARY_USER_DATA_PATH = 'D:\\mock-user-data';
  });

  afterEach(() => {
    delete process.env.ELECTRON_RENDERER_URL;
    delete process.env.EXILE_DIARY_APP_VERSION;
    delete process.env.EXILE_DIARY_IS_PACKAGED;
    delete process.env.EXILE_DIARY_USER_DATA_PATH;
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
      env: expect.objectContaining({
        EXILE_DIARY_APP_VERSION: '1.10.2-test',
        EXILE_DIARY_IS_PACKAGED: 'false',
        EXILE_DIARY_USER_DATA_PATH: 'D:\\mock-user-data',
      }),
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

  it('tracks OCR sidecar health and restart state across process exits', async () => {
    const firstChild = createMockChildProcess();
    const secondChild = createMockChildProcess();
    let spawnCount = 0;

    forkMock.mockImplementation(() => {
      const child = spawnCount === 0 ? firstChild : secondChild;
      spawnCount += 1;
      setImmediate(() => {
        child.emit('message', {
          type: 'ready',
          pid: 4242 + spawnCount,
          startedAt: `2026-07-05T08:00:0${spawnCount}.000Z`,
        });
      });
      return child;
    });

    const watcher = require('../../../src/main/modules/ImageParser/OCRWatcher');
    const healthListener = jest.fn();
    watcher.emitter.on('ocr:health-updated', healthListener);

    await watcher.start();
    expect(watcher.getHealth()).toMatchObject({
      status: 'ready',
      restartCount: 0,
    });

    firstChild.connected = false;
    firstChild.killed = true;
    firstChild.emit('exit', 1, null);

    await new Promise((resolve) => setTimeout(resolve, 650));

    expect(forkMock).toHaveBeenCalledTimes(2);
    expect(watcher.getHealth()).toMatchObject({
      status: 'ready',
      restartCount: 1,
    });
    expect(healthListener).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'restarting',
        restartCount: 1,
      })
    );

    await watcher.stop();
  });
});
