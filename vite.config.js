import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5288, host: true },
  build: { chunkSizeWarningLimit: 2000 },
});
