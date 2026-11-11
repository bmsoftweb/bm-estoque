import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const raiz = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.resolve(raiz, 'package.json'), 'utf8'));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': raiz } },
  // Versão do package.json, mostrada no rodapé das telas
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { outDir: 'dist' },
});
