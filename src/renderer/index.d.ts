declare global {
  interface Window {
    exileDiary: import('../shared/contracts/exileDiaryApi').ExileDiaryApi;
  }
}

export {};
