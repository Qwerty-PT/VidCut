// Gera src/stickers/emoji-data.json: emojis Fluent (Microsoft, MIT) com nomes e palavras-chave em português (emojibase, MIT).
//   node scripts/gerar-emojis.mjs
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const icons = require('@iconify-json/fluent-emoji-flat/icons.json');
const en = require('emojibase-data/en/data.json');
const pt = require('emojibase-data/pt/data.json');
const ptBy = new Map(pt.map((e) => [e.hexcode, e]));
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'“”.!:,()]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const GROUPS = ['Caras', 'Pessoas', null, 'Animais e natureza', 'Comida', 'Viagens', 'Atividades', 'Objetos', 'Símbolos', 'Bandeiras'];
const W = icons.width || 32, H = icons.height || 32;
const out = [];
for (const e of en) {
  if (GROUPS[e.group] == null) continue;
  const name = slug(e.label);
  const ic = icons.icons[name] || icons.icons[icons.aliases?.[name]?.parent];
  if (!ic) continue;
  const p = ptBy.get(e.hexcode);
  const label = (p?.label || e.label).replace(/^bandeira: /, '');
  const keys = [...new Set([...(p?.tags || []), ...(e.tags || []), e.label])].join(' ');
  out.push({ c: e.emoji, n: label, k: keys, g: e.group, o: e.order ?? 99999, s: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ic.width || W} ${ic.height || H}">${ic.body}</svg>` });
}
out.sort((a, b) => a.o - b.o);
const groups = GROUPS.map((g, i) => (g ? { id: i, name: g } : null)).filter(Boolean);
fs.writeFileSync(new URL('../src/stickers/emoji-data.json', import.meta.url), JSON.stringify({ groups, emojis: out.map(({ o, ...r }) => r) }));
console.log(out.length, 'emojis', groups.map((g) => `${g.name}:${out.filter((e) => e.g === g.id).length}`).join(' '));
