import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Shared by electron-vite and the Vite-only Playwright web server.
export default defineConfig({
  root: fileURLToPath(new URL('./src/renderer', import.meta.url)),
  plugins: [
    react(),
    {
      name: 'development-content-policy',
      apply: 'serve',
      transformIndexHtml(html) {
        return html
          .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
          .replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
          .replace("connect-src 'self'", "connect-src 'self' ws://127.0.0.1:*");
      },
    },
  ],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
