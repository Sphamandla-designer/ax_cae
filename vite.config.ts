import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The workspace ships as one bundle (inline-styled views); ~550 kB before gzip is expected.
  build: { chunkSizeWarningLimit: 800 },
});
