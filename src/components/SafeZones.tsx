// Zonas seguras: mostra por cima da pré-visualização onde ficam os botões e textos das redes
// (ou as margens clássicas de título). Só ajuda a enquadrar — nunca vai para o export.
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Icon } from './Icon';

export type SafeZoneId = 'off' | 'margens' | 'tiktok' | 'reels' | 'shorts';

interface Social {
  label: string;
  /** margens tapadas pela interface, em % do quadro (referência 9:16) */
  top: number; bottom: number; left: number; right: number;
  /** largura dos botões da direita, em % da largura (9:16) */
  icon: number;
  hint: string;
}

// Valores das recomendações publicadas por cada rede para 1080×1920 (arredondados)
const SOCIAL: Record<'tiktok' | 'reels' | 'shorts', Social> = {
  tiktok: { label: 'TikTok', top: 8, bottom: 22, left: 5, right: 13, icon: 8, hint: 'Separadores em cima, descrição e música em baixo, botões à direita' },
  reels: { label: 'Reels', top: 14, bottom: 35, left: 6, right: 6, icon: 7, hint: 'Margens recomendadas pela Meta: 14% em cima, 35% em baixo' },
  shorts: { label: 'Shorts', top: 10, bottom: 23, left: 4, right: 14, icon: 8.5, hint: 'Título e canal em baixo, botões à direita' },
};

export const SAFE_OPTIONS: { id: SafeZoneId; label: string; hint: string }[] = [
  { id: 'off', label: 'Sem guias', hint: '' },
  { id: 'margens', label: 'Margens de título', hint: 'Ação 90% · título 80% (qualquer formato)' },
  { id: 'tiktok', label: 'TikTok', hint: SOCIAL.tiktok.hint },
  { id: 'reels', label: 'Instagram Reels', hint: SOCIAL.reels.hint },
  { id: 'shorts', label: 'YouTube Shorts', hint: SOCIAL.shorts.hint },
];

// ---------- estado (lembrado entre sessões) ----------
const KEY = 'vidcut.safezone';
let current: SafeZoneId = (() => { try { return (localStorage.getItem(KEY) as SafeZoneId) || 'off'; } catch { return 'off'; } })();
const subs = new Set<() => void>();
export function setSafeZone(z: SafeZoneId) {
  current = z;
  try { localStorage.setItem(KEY, z); } catch { /* sem armazenamento */ }
  subs.forEach((f) => f());
}
export const useSafeZone = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => current);

/** Botão na barra por baixo do ecrã */
export const SafeZoneMenu: React.FC = () => {
  const z = useSafeZone();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', esc, true);
    return () => { window.removeEventListener('pointerdown', close, true); window.removeEventListener('keydown', esc, true); };
  }, [open]);
  const cur = SAFE_OPTIONS.find((o) => o.id === z)!;
  return (
    <div className="aspect-menu" ref={box}>
      <button className={`aspect-btn${z !== 'off' ? ' on' : ''}`} onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}
        title="Zonas seguras: onde a interface das redes tapa o vídeo (só na pré-visualização)">
        <Icon name="safe" size={14} /> {z === 'off' ? 'Guias' : cur.label.replace('Instagram ', '').replace('YouTube ', '')} <span className="caret">▾</span>
      </button>
      {open && (
        <div className="aspect-pop safe-pop" role="menu">
          {SAFE_OPTIONS.map((o) => (
            <button key={o.id} role="menuitemradio" aria-checked={z === o.id} className={z === o.id ? 'on' : ''} onClick={() => { setSafeZone(o.id); setOpen(false); }}>
              <b>{o.label}</b>{o.hint && <small>{o.hint}</small>}
            </button>
          ))}
          <div className="aspect-sep" />
          <p className="safe-note">Só aparecem aqui, não no vídeo exportado.</p>
        </div>
      )}
    </div>
  );
};

/** Sobreposição dentro da moldura da pré-visualização */
export const SafeZoneOverlay: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const z = useSafeZone();
  if (z === 'off') return null;
  if (z === 'margens') {
    return (
      <div className="safe-overlay" aria-hidden>
        <div className="safe-rect action" style={{ inset: '5%' }}><span>Ação 90%</span></div>
        <div className="safe-rect title" style={{ inset: '10%' }}><span>Título 80%</span></div>
        <div className="safe-cross" />
      </div>
    );
  }
  const s = SOCIAL[z];
  const vertical = height > width;
  // margens laterais e botões medidos pela altura (como num ecrã 9:16), para não ficarem gigantes em 16:9
  const hx = (pct: number) => `min(${pct}cqw, ${(pct * 9) / 16}cqh)`;
  // botões da direita (desenho genérico, só para dar a ideia do que fica por cima)
  const icons = z === 'reels' ? 4 : 5;
  return (
    <div className="safe-overlay" aria-hidden>
      <div className="safe-block" style={{ left: 0, right: 0, top: 0, height: `${s.top}%` }} />
      <div className="safe-block" style={{ left: 0, right: 0, bottom: 0, height: `${s.bottom}%` }}>
        <div className="safe-fake-text" style={{ left: hx(s.left + 1), right: hx(s.right + 4) }}>
          <i style={{ width: '38%' }} /><i style={{ width: '70%' }} /><i style={{ width: '52%' }} />
        </div>
      </div>
      <div className="safe-block" style={{ left: 0, top: `${s.top}%`, bottom: `${s.bottom}%`, width: hx(s.left) }} />
      <div className="safe-block" style={{ right: 0, top: `${s.top}%`, bottom: `${s.bottom}%`, width: hx(s.right) }} />
      <div className="safe-icons" style={{ right: hx(2.2), bottom: `${Math.max(4, s.bottom - 14)}%`, width: hx(s.icon) }}>
        {Array.from({ length: icons }, (_, i) => <b key={i} />)}
      </div>
      <div className="safe-rect social" style={{ top: `${s.top}%`, bottom: `${s.bottom}%`, left: hx(s.left), right: hx(s.right) }}>
        <span>{s.label}{vertical ? '' : ' · pensado para 9:16'}</span>
      </div>
    </div>
  );
};
