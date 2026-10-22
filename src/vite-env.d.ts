/// <reference types="vite/client" />

interface DspWikiBridge {
  openExternal: (url: string) => Promise<void>;
  onNavigateWiki?: (handler: (title: string) => void) => () => void;
}

interface Window {
  dspWiki?: DspWikiBridge;
}
