import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  // Relative base so the build runs correctly when hosted from a non-root
  // path (e.g. itch.io's embed at https://html-classic.itch.zone/html/<id>/).
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
