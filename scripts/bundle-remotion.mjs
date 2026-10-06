// Gera o bundle Remotion (pasta remotion-bundle/) usado pelo export.
// Fica pré-compilado para a app empacotada não precisar de webpack em runtime.
import { bundle } from '@remotion/bundler';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateTemplatesIndex } from './gen-templates.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'remotion-bundle');

generateTemplatesIndex(root);
const t = Date.now();
await bundle({
  entryPoint: path.join(root, 'shared/remotion-root.tsx'),
  outDir,
  enableCaching: true,
  onProgress: () => {},
});
console.log(`Bundle Remotion pronto em ${path.relative(root, outDir)} (${((Date.now() - t) / 1000).toFixed(1)} s)`);
