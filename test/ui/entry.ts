import { installMockExileDiaryApi } from './mockExileDiaryApi';

globalThis.global = globalThis;
installMockExileDiaryApi(
  new URLSearchParams(window.location.search).get('scenario') ?? 'populated'
);

await import('../../src/renderer/index.jsx');
