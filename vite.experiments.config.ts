import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: 'src/experiments/anki-feasibility.ts',
    outDir: 'out/experiments',
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: 'anki-feasibility.mjs' } },
  },
});
