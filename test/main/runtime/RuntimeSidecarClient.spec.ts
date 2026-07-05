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
  (child as any).pid = 5150;
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
            pid: 5150,
            startedAt: '2026-07-05T09:00:00.000Z',
            runtimeStarted: true,
          },
        });
      });
    }

    if (message.command === 'renderer-method' && message.payload.method === 'getSettings') {
      setImmediate(() => {
        child.emit('message', {
          type: 'response',
          requestId: message.requestId,
          ok: true,
          result: {
            overlayEnabled: true,
            overlayPersistenceEnabled: false,
            runParseShortcut: 'F8',
          },
        });
      });
    }

    if (message.command === 'renderer-method' && message.payload.method === 'loadRuns') {
      setImmediate(() => {
        child.emit('message', {
          type: 'response',
          requestId: message.requestId,
          ok: true,
          result: [{ id: 1 }],
        });
      });
    }

    if (message.command === 'runtime-method') {
      setImmediate(() => {
        child.emit('message', {
          type: 'response',
          requestId: message.requestId,
          ok: true,
          result: message.payload.method === 'runTracking.getLatestGeneratedArea'
            ? { name: 'Mesa', level: 83, seed: 'abc' }
            : true,
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

describe('RuntimeSidecarClient', () => {
  beforeEach(() => {
    jest.resetModules();
    forkMock.mockReset();
    process.env.ELECTRON_RENDERER_URL = 'http://localhost:3003';
  });

  afterEach(() => {
    delete process.env.ELECTRON_RENDERER_URL;
  });

  it('spawns the runtime sidecar and proxies renderer/runtime requests through IPC', async () => {
    const child = createMockChildProcess();
    forkMock.mockImplementation((entryPath: string) => {
      setImmediate(() => {
        child.emit('message', {
          type: 'ready',
          pid: 5150,
          startedAt: '2026-07-05T09:00:00.000Z',
        });
      });
      return child;
    });

    const client = require('../../../src/main/runtime/RuntimeSidecarClient');

    await client.start();
    const runs = await client.callRendererMethod('loadRuns', [25]);
    const latestArea = await client.callRuntimeMethod('runTracking.getLatestGeneratedArea');

    expect(forkMock).toHaveBeenCalledTimes(1);
    expect(forkMock.mock.calls[0][0]).toContain(
      path.join('src', 'main', 'runtime', 'RuntimeSidecar.ts')
    );
    expect(forkMock.mock.calls[0][2]).toMatchObject({
      execArgv: ['--require', 'tsx/cjs'],
      serialization: 'advanced',
    });
    expect(client.getSettingsSnapshot()).toMatchObject({
      overlayEnabled: true,
      overlayPersistenceEnabled: false,
      runParseShortcut: 'F8',
    });
    expect(runs).toEqual([{ id: 1 }]);
    expect(latestArea).toEqual({ name: 'Mesa', level: 83, seed: 'abc' });

    await client.stop();
  });

  it('updates local settings and runtime state from sidecar events', async () => {
    const child = createMockChildProcess();
    forkMock.mockImplementation(() => {
      setImmediate(() => {
        child.emit('message', {
          type: 'ready',
          pid: 5150,
          startedAt: '2026-07-05T09:00:00.000Z',
        });
      });
      return child;
    });

    const client = require('../../../src/main/runtime/RuntimeSidecarClient');
    const settingsListener = jest.fn();
    const runListener = jest.fn();

    client.settingsEmitter.on('overlayEnabled', settingsListener);
    client.runTrackingEmitter.on('run-parser:latest-area-updated', runListener);

    await client.start();

    child.emit('message', {
      type: 'event',
      eventName: 'settings-changed',
      payload: {
        key: 'overlayEnabled',
        value: false,
        oldValue: true,
      },
    });
    child.emit('message', {
      type: 'event',
      eventName: 'run-latest-area-updated',
      payload: { name: 'Dunes', level: 84, seed: 'xyz' },
    });

    expect(settingsListener).toHaveBeenCalledWith(false, true);
    expect(runListener).toHaveBeenCalledWith({
      name: 'Dunes',
      level: 84,
      seed: 'xyz',
    });
    expect(client.getSettingsSnapshot()).toMatchObject({
      overlayEnabled: false,
    });
    expect(client.getLatestGeneratedArea()).toMatchObject({
      name: 'Dunes',
      level: 84,
      seed: 'xyz',
    });

    await client.stop();
  });
});
