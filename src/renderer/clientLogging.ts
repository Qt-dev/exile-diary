import { RendererLogLevel, RendererLogPayload } from '../shared/contracts/exileDiaryApi';

const consoleLevels: RendererLogLevel[] = ['debug', 'error', 'info', 'log', 'warn'];
let installed = false;

function serializeArg(arg: unknown): string {
  if (arg instanceof Error) {
    return arg.stack || `${arg.name}: ${arg.message}`;
  }

  if (typeof arg === 'string') {
    return arg;
  }

  if (typeof arg === 'undefined') {
    return 'undefined';
  }

  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function getStack(args: unknown[]) {
  const error = args.find((arg): arg is Error => arg instanceof Error);
  return error?.stack;
}

function sendRendererLog(payload: RendererLogPayload) {
  try {
    window.exileDiary?.logRendererMessage({
      timestamp: new Date().toISOString(),
      ...payload,
    });
  } catch {
    // Logging must never break renderer startup or render error handling.
  }
}

export function installRendererClientLogging() {
  if (installed || typeof window === 'undefined') {
    return;
  }

  installed = true;

  for (const level of consoleLevels) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      original(...args);
      sendRendererLog({
        level,
        message: args.map(serializeArg).join(' '),
        source: 'console',
        stack: getStack(args),
      });
    };
  }

  window.addEventListener('error', (event) => {
    sendRendererLog({
      level: 'error',
      message: event.message,
      source: 'global-error',
      stack: event.error instanceof Error ? event.error.stack : undefined,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    sendRendererLog({
      level: 'error',
      message: serializeArg(event.reason),
      source: 'unhandled-rejection',
      stack: event.reason instanceof Error ? event.reason.stack : undefined,
    });
  });
}

export function writeBootstrapRendererLog(error: unknown) {
  sendRendererLog({
    level: 'error',
    message: serializeArg(error),
    source: 'bootstrap',
    stack: error instanceof Error ? error.stack : undefined,
  });
}
