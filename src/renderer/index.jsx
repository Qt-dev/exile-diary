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
import RunStore from './stores/runStore';
import CharacterStore from './stores/characterStore';
import StashTabStore from './stores/stashTabStore';
import { appTheme, createAppRoutes } from './app';
import { electronService } from './electron.service';

globalThis.global = globalThis;

dayjs.extend(duration);
dayjs.extend(utc);
dayjs.extend(calendar);

const runStore = new RunStore();
const characterStore = new CharacterStore();
const stashTabStore = new StashTabStore();

characterStore.fetchCharacters();
stashTabStore.fetchStashTabs();

const router = createHashRouter(
  createAppRoutes({
    runStore,
    characterStore,
    stashTabStore,
  })
);

const documentRoot = document.getElementById('root');
if (documentRoot !== null) {
  const root = ReactDOM.createRoot(documentRoot);
  root.render(
    <React.StrictMode>
      <ThemeProvider theme={appTheme}>
        <RouterProvider router={router} />
      </ThemeProvider>
    </React.StrictMode>
  );

  if (window.location.hash !== '#/overlay') {
    queueMicrotask(() => {
      window.dispatchEvent(new Event(rendererBootEvent));
    });
  }
}
