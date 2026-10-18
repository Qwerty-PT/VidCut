// Separador "Stickers": stickers desenhados para o VidCut (texto e cor editáveis) e ~1500 emojis com pesquisa em português.
import React, { useEffect, useMemo, useState } from 'react';
import { useEditor } from '../editor-context';
import { addStickerClip } from '../ops';
import { playhead } from '../playhead';
import { STICKERS, STICKER_CATEGORIES, stickerPreviewSvg, type StickerDef } from '../../shared/stickers';
import type { StickerContent } from '../../shared/types';
import { Icon } from './Icon';

export const STICKER_DRAG_TYPE = 'application/x-vidcut-sticker';

// os dados de um sticker arrastado (o SVG de um emoji é grande demais para o dataTransfer)
let dragged: StickerContent | null = null;
export const getDraggedSticker = () => dragged;

interface EmojiEntry { c: string; n: string; k: string; g: number; s: string }
interface EmojiData { groups: { id: number; name: string }[]; emojis: EmojiEntry[] }
let emojiCache: EmojiData | null = null;
const loadEmojis = async (): Promise<EmojiData> => (emojiCache ??= (await import('../stickers/emoji-data.json')).default as EmojiData);

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const dataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const fromDef = (d: StickerDef): StickerContent => ({ id: d.id, name: d.name, anim: d.anim, ...(d.text !== undefined ? { text: d.text } : {}), ...(d.color ? { color: d.color } : {}) });
const fromEmoji = (e: EmojiEntry): StickerContent => ({ id: 'emoji', name: `${e.c} ${e.n}`, svg: e.s, anim: 'pop' });

export const StickerLibrary: React.FC = () => {
  const { commit } = useEditor();
  const [q, setQ] = useState('');
  const [data, setData] = useState<EmojiData | null>(emojiCache);
  const [group, setGroup] = useState(0);
  useEffect(() => { if (!data) void loadEmojis().then(setData); }, [data]);

  const add = (s: StickerContent) => commit((p) => {
    const r = addStickerClip(p, s, playhead.frame);
    return { project: r.project, select: r.clipId ? [r.clipId] : undefined };
  });
  const drag = (s: StickerContent) => (e: React.DragEvent) => { dragged = s; e.dataTransfer.setData(STICKER_DRAG_TYPE, s.id); e.dataTransfer.effectAllowed = 'copy'; };

  const nq = norm(q.trim());
  const stickers = nq ? STICKERS.filter((d) => norm(`${d.name} ${d.text ?? ''} ${d.category}`).includes(nq)) : STICKERS;
  const emojis = useMemo(() => {
    if (!data) return [];
    if (!nq) return data.emojis.filter((e) => e.g === (data.groups[group]?.id ?? 0));
    const words = nq.split(/\s+/);
    // primeiro os que se chamam assim, depois os que começam por isso, depois as palavras-chave
    const rank = (e: EmojiEntry) => { const n = norm(e.n); return n === nq ? 0 : n.startsWith(nq) ? 1 : n.split(/\s+/).includes(nq) ? 2 : n.includes(nq) ? 3 : 4; };
    return data.emojis
      .filter((e) => { const hay = norm(`${e.n} ${e.k}`); return words.every((w) => hay.includes(w)); })
      .map((e, i) => ({ e, r: rank(e) * 10000 + i }))
      .sort((a, b) => a.r - b.r)
      .map((x) => x.e)
      .slice(0, 240);
  }, [data, nq, group]);

  return (
    <div className="tpl-gallery stk-lib">
      <div className="lib-search">
        <Icon name="search" size={14} />
        <input type="search" placeholder="Procurar (ex.: coração, seta, fogo…)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Procurar stickers e emojis" />
      </div>
      <p className="hint fx-help">Duplo clique ou arrastar para a timeline. Texto, cor e animação mudam-se à direita.</p>
      {STICKER_CATEGORIES.map((cat) => {
        const list = stickers.filter((d) => d.category === cat);
        if (!list.length) return null;
        return (
          <section key={cat}>
            <h3 className="tpl-cat">{cat}</h3>
            <ul className="tpl-grid stk-grid">
              {list.map((d) => (
                <li key={d.id} className="tpl-card stk-card" draggable onDragStart={drag(fromDef(d))} onDoubleClick={() => add(fromDef(d))} title={`${d.name}\nDuplo clique ou arrastar: adicionar`}>
                  <div className="tpl-thumb stk-thumb"><img src={dataUri(stickerPreviewSvg(d))} alt="" draggable={false} /></div>
                  <span className="tpl-name">{d.name}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <section>
        <h3 className="tpl-cat">Emojis</h3>
        {!nq && data && (
          <div className="chip-row stk-groups">
            {data.groups.map((g, i) => <button key={g.id} className={`chip${i === group ? ' on' : ''}`} onClick={() => setGroup(i)}>{g.name}</button>)}
          </div>
        )}
        {!data ? <p className="hint">A carregar emojis…</p> : emojis.length ? (
          <ul className="emoji-grid">
            {emojis.map((e) => (
              <li key={e.c + e.n} draggable onDragStart={drag(fromEmoji(e))} onDoubleClick={() => add(fromEmoji(e))} title={`${e.n}\nDuplo clique ou arrastar: adicionar`}>
                <img src={dataUri(e.s)} alt={e.n} loading="lazy" draggable={false} />
              </li>
            ))}
          </ul>
        ) : <p className="hint">Nenhum emoji encontrado.</p>}
        <p className="hint stk-credit">Emojis Fluent da Microsoft (licença MIT).</p>
      </section>
    </div>
  );
};
