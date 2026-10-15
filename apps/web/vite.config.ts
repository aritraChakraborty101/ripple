import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so the built site works from any static host or subfolder.
  base: './',
  server: {
    fs: {
      // Allow importing scenario files from packages/content.
      allow: ['../..'],
    },
  },
});
