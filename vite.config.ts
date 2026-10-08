import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The workspace ships as one bundle (inline-styled views); ~550 kB before gzip is expected.
  // The brand mark is inlined so the standalone file stays one self-contained page.
  build: { chunkSizeWarningLimit: 800, assetsInlineLimit: 16384 },
});
