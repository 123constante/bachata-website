/**
 * Going P3 screenshot harness (NOT part of the app build): renders every
 * organiser going part in every state, one scene per ?scene=, inside the
 * organiser's own tokens. Run: node tests/harness/going-p3/shoot.mjs
 */
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

const repo = path.resolve(__dirname, '../../..');

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: { alias: { '@': path.join(repo, 'src') } },
  css: { postcss: path.join(repo, 'postcss.config.js') },
  define: { 'import.meta.env.VITE_VERCEL_ENV': '"preview"', 'import.meta.env.VITE_ENABLE_GOING_PREVIEW': '"true"' },
  server: { port: 5199, strictPort: true, fs: { allow: [repo] } },
});
