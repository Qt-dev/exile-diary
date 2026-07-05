import logger from 'electron-log';
import { createOcrScanService } from './OcrScanService';

type OcrSidecarRequest =
  | {
      type: 'request';
      requestId: string;
      command: 'health-check';
    }
  | {
      type: 'request';
      requestId: string;
      command: 'scan-screenshot-buffer';
      payload: {
        screenshotBuffer: Buffer;
        job: Record<string, unknown>;
        options?: {
          captureMs?: number;
        };
      };
    }
  | {
      type: 'request';
      requestId: string;
      command: 'process-image-buffer';
      payload: {
        buffer: Buffer;
        timestamp?: string;
        type?: string;
      };
    }
  | {
      type: 'request';
      requestId: string;
      command: 'shutdown';
    };

type OcrSidecarResponse = {
  type: 'response';
  requestId: string;
  ok: boolean;
  result?: unknown;
  error?: {
    message: string;
    stack?: string;
  };
};

type OcrSidecarEvent = {
  type: 'event';
  eventName: 'ocr:completed-job' | 'OCRError';
  payload?: unknown;
};

const startedAt = new Date().toISOString();
const sidecarLogger = logger.scope('ocr-sidecar');
const service = createOcrScanService({
  currentMainDir: __dirname,
  isDev: Boolean(process.env.ELECTRON_RENDERER_URL),
  emitCompletedJob: (payload) => {
    sendMessage({
      type: 'event',
      eventName: 'ocr:completed-job',
      payload,
    });
  },
  emitError: () => {
    sendMessage({
      type: 'event',
      eventName: 'OCRError',
    });
  },
});

function sendMessage(message: { type: 'ready'; pid: number; startedAt: string } | OcrSidecarResponse | OcrSidecarEvent) {
  if (typeof process.send === 'function') {
    process.send(message);
  }
}

function createErrorPayload(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}

async function handleRequest(message: OcrSidecarRequest) {
  switch (message.command) {
    case 'health-check':
      return {
        status: 'ready',
        pid: process.pid,
        startedAt,
        uptimeSeconds: Number(process.uptime().toFixed(3)),
      };
    case 'scan-screenshot-buffer':
      return service.scanScreenshotBuffer(
        message.payload.screenshotBuffer,
        message.payload.job,
        message.payload.options
      );
    case 'process-image-buffer':
      return service.processImageBuffer(
        message.payload.buffer,
        message.payload.timestamp,
        message.payload.type
      );
    case 'shutdown':
      await service.dispose();
      return {
        status: 'stopped',
      };
  }
}

async function shutdown(exitCode = 0) {
  try {
    await service.dispose();
  } catch (error) {
    sidecarLogger.error('Failed to dispose OCR sidecar service cleanly', error);
  } finally {
    process.exit(exitCode);
  }
}

process.on('message', async (message: OcrSidecarRequest) => {
  if (!message || message.type !== 'request') {
    return;
  }

  try {
    const result = await handleRequest(message);
    sendMessage({
      type: 'response',
      requestId: message.requestId,
      ok: true,
      result,
    });

    if (message.command === 'shutdown') {
      await shutdown(0);
    }
  } catch (error) {
    sidecarLogger.error('OCR sidecar request failed', error);
    sendMessage({
      type: 'response',
      requestId: message.requestId,
      ok: false,
      error: createErrorPayload(error),
    });
  }
});

process.once('disconnect', async () => {
  await shutdown(0);
});

process.once('SIGTERM', async () => {
  await shutdown(0);
});

process.once('SIGINT', async () => {
  await shutdown(0);
});

service
  .start()
  .then(() => {
    sendMessage({
      type: 'ready',
      pid: process.pid,
      startedAt,
    });
  })
  .catch(async (error) => {
    sidecarLogger.error('Failed to start OCR sidecar', error);
    await shutdown(1);
  });
