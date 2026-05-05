import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 3000 },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat']
  },
  build: {
    target: 'esnext',
    outDir: 'dist'
  }
});
