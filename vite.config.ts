import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative paths, so the built site works from a folder — GitHub Pages
  // serves it at /FOH-Weekly-Cleaning-Tracker-CFA-West-Adams/, not at the root.
  base: './',
  build: { outDir: 'dist' },
});
