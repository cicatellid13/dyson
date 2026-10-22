/// <reference types="vite/client" />

interface DspWikiBridge {
  openExternal: (url: string) => Promise<void>;
}

interface Window {
  dspWiki?: DspWikiBridge;
}
