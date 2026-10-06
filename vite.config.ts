import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
// @ts-expect-error módulo .mjs sem tipos
import { generateTemplatesIndex } from './scripts/gen-templates.mjs';

/** Mantém modelos/index.ts atualizado: ao arrancar e quando se adiciona/apaga um modelo */
function templatesPlugin(): Plugin {
  const root = __dirname;
  const dir = path.join(root, 'modelos');
  return {
    name: 'vidcut-modelos',
    buildStart() { generateTemplatesIndex(root); },
    configureServer(server) {
      const onChange = (file: string) => {
        if (path.dirname(file) === dir && file.endsWith('.tsx')) generateTemplatesIndex(root);
      };
      server.watcher.on('add', onChange);
      server.watcher.on('unlink', onChange);
    },
  };
}

export default defineConfig({
  plugins: [react(), templatesPlugin()],
  base: './',
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 3000 },
});
