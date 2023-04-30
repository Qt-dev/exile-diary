import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ipcRenderer } from 'electron';
import './index.css';
import reportWebVitals from './reportWebVitals';
import RunStore from './stores/runStore';
import Root from './routes/root';
import Settings from './routes/Settings';
import RunList from './routes/RunList';
import Run from './routes/Run';
import { electronService } from './electron.service';
const runStore = new RunStore();

const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    children: [
      {
        index: true,
        element: <RunList store={runStore} />,
      },
      {
        path: 'run/:runId',
        element: <Run store={runStore} />,
        loader: async ({ params }) => {
          const { runId } = params;
          await runStore.loadRun(runId);
          const run = runStore.runs.find((run) => run.runId === runId);
          return { run };
        },
        errorElement: <div>Error in Run parsing</div>,
      },
      {
        path: 'stash',
        element: <div>Stash</div>,
      },
      {
        path: 'search',
        element: <div>Search</div>,
      },
      {
        path: 'stats',
        element: <div>Stats</div>,
      },
      {
        path: 'settings',
        element: <Settings />,
        loader: async () => {
          const settings = await ipcRenderer.invoke('get-settings');
          const characters = await ipcRenderer.invoke('get-characters');
          return { settings, characters };
        },
      },
      {
        path: 'gear',
        element: <div>Gear</div>,
      },
      {
        path: 'about',
        element: <div>About</div>,
      },
    ],
  },
]);
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#8787fe',
    },
    secondary: {
      main: '#af5f1c',
    },
  },
  typography: {
    fontFamily: ['Fontin'].join(','),
    fontSize: 16,
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
  },
  components: {
    MuiDivider: {
      styleOverrides: {
        root: {
          'border-width': '1px',
          margin: '3px 0',
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          fontSize: '24px',
          color: '#6666ff',
          fontFamily: 'FontinSmallCaps',
          '&:hover': {
            color: '#9999ff',
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          fontFamily: 'FontinSmallCaps',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '24px',
          fontFamily: 'FontinSmallCaps',
          padding: '0 5px',
          color: '#6666ff',
        },
      },
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeProvider theme={darkTheme}>
      <script>var global = global || window;</script>
      <RouterProvider router={router} />
    </ThemeProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
