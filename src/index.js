import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Root from './routes/root';
import './index.css';
import reportWebVitals from './reportWebVitals';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    children: [
      {
        index: true,
        element: <div>Index</div>,
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
        element: <div>Settings</div>,
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
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <script>var global = global || window;</script>
    <RouterProvider router={router} />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
