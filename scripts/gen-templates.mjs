// Gera modelos/index.ts com todos os modelos da pasta modelos/ (ficheiros .tsx que não começam por "_").
// Corre automaticamente no `npm run dev` (plugin do Vite, também quando adicionas/apagas ficheiros) e no bundle de export.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function generateTemplatesIndex(root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')) {
  const dir = path.join(root, 'modelos');
  fs.mkdirSync(dir, { recursive: true });
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.tsx') && !f.startsWith('_')).sort();
  const lines = [
    '// GERADO AUTOMATICAMENTE por scripts/gen-templates.mjs — não editar à mão.',
    "import type { TemplateDef } from '../shared/template-api';",
    ...files.map((f, i) => `import m${i} from './${f.replace(/\.tsx$/, '')}';`),
    '',
    `export const TEMPLATES: TemplateDef[] = [${files.map((_, i) => `m${i}`).join(', ')}];`,
    '',
  ];
  const out = path.join(dir, 'index.ts');
  const next = lines.join('\n');
  if (!fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== next) fs.writeFileSync(out, next);
  return files.length;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log(`Modelos: ${generateTemplatesIndex()} encontrados`);
}
