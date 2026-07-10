import React from 'react';
import ReactDOM from 'react-dom/client';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import utc from 'dayjs/plugin/utc';
import calendar from 'dayjs/plugin/calendar';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { rendererBootEvent } from '../shared/contracts/exileDiaryApi';
import './index.css';

globalThis.global = globalThis;

dayjs.extend(duration);
dayjs.extend(utc);
dayjs.extend(calendar);

const documentRoot = document.getElementById('root');
let hasRenderedApp = false;
let hasRenderedBootError = false;

function getBootErrorMessage(error) {
  if (error instanceof Error) {
    return error.stack || error.message;
  }

  return String(error);
}

function renderBootError(error) {
  if (hasRenderedBootError) {
    return;
  }

  hasRenderedBootError = true;
  const message = getBootErrorMessage(error);
  console.error('[renderer/bootstrap] Failed to boot renderer', error);

  if (documentRoot === null) {
    return;
  }

  const root = ReactDOM.createRoot(documentRoot);
  root.render(
    <div
      style={{
        background: '#111',
        color: '#f6d58f',
        fontFamily: 'Arial, sans-serif',
        minHeight: '100vh',
        padding: '24px',
        boxSizing: 'border-box',
      }}
    >
      <h1 style={{ color: '#fff', fontSize: '22px', margin: '0 0 12px' }}>
        Exile Diary failed to start
      </h1>
      <p style={{ margin: '0 0 16px' }}>
        The renderer could not connect to the Electron preload API.
      </p>
      <pre style={{ whiteSpace: 'pre-wrap', color: '#fff', fontSize: '13px' }}>{message}</pre>
    </div>
  );
}

async function bootRenderer() {
  try {
    if (!window.exileDiary) {
      throw new Error('window.exileDiary is not available. The preload script may have failed.');
    }

    const [{ default: RunStore }, { default: CharacterStore }, { default: StashTabStore }, app] =
      await Promise.all([
        import('./stores/runStore'),
        import('./stores/characterStore'),
        import('./stores/stashTabStore'),
        import('./app'),
      ]);

    const runStore = new RunStore();
    const characterStore = new CharacterStore();
    const stashTabStore = new StashTabStore();
    const router = createHashRouter(
      app.createAppRoutes({
        runStore,
        characterStore,
        stashTabStore,
      })
    );

    if (documentRoot !== null) {
      const root = ReactDOM.createRoot(documentRoot);
      root.render(
        <React.StrictMode>
          <ThemeProvider theme={app.appTheme}>
            <RouterProvider router={router} />
          </ThemeProvider>
        </React.StrictMode>
      );
      hasRenderedApp = true;

      if (window.location.hash !== '#/overlay') {
        queueMicrotask(() => {
          window.dispatchEvent(new Event(rendererBootEvent));
        });
      }
    }
  } catch (error) {
    renderBootError(error);
  }
}

void bootRenderer();

window.addEventListener('unhandledrejection', (event) => {
  if (!hasRenderedApp) {
    renderBootError(event.reason);
  }
});

window.addEventListener('error', (event) => {
  if (!hasRenderedApp) {
    renderBootError(event.error || event.message);
  }
});
