import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: fileURLToPath(new URL('./src/web', import.meta.url)),
  plugins: [
    react(),
    {
      name: 'local-web-development-content-policy',
      apply: 'serve',
      transformIndexHtml(html) {
        return html
          .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
          .replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
          .replace("connect-src 'self'", "connect-src 'self' ws://127.0.0.1:*");
      },
    },
  ],
  build: {
    outDir: fileURLToPath(new URL('./out/local-web/client', import.meta.url)),
    emptyOutDir: true,
  },
});
