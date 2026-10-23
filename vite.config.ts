import { defineConfig } from "vite";
import { version } from "./package.json";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";

export default defineConfig({
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: {
    port: 5199,
    strictPort: true,
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: "electron/main.ts",
      },
      preload: {
        input: "electron/preload.ts",
      },
    }),
  ],
});
