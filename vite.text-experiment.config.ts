import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: 'src/experiments/text-feasibility.ts',
    outDir: 'out/text-experiment',
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: 'text-feasibility.mjs' } },
  },
});
