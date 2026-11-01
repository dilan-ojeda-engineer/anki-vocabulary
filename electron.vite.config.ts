import { defineConfig } from 'electron-vite';
import renderer from './vite.renderer.config';

export default defineConfig({
  main: {},
  preload: {
    build: {
      externalizeDeps: false,
      rollupOptions: { output: { format: 'cjs', entryFileNames: 'index.cjs' } },
    },
  },
  renderer,
});
