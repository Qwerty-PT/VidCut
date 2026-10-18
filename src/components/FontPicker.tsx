// Escolher uma fonte: as do computador (com pesquisa e pré-visualização) ou importar um ficheiro.
// A fonte escolhida fica embutida no projeto (funciona no export e noutro computador).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { FONT_MAX_BYTES, formatFromName, type FontAsset, type FontFormat } from '../../shared/userfonts';
import { extractFace, sniffFormat } from '../../shared/ttc';

interface LocalFace { family: string; style: string; fullName: string; postscriptName: string; blob(): Promise<Blob> }
declare global { interface Window { queryLocalFonts?: () => Promise<LocalFace[]> } }

export type PickedFont = Omit<FontAsset, 'id'>;

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const STYLE_ORDER = ['regular', 'book', 'roman', 'normal', 'medium', 'semibold', 'demibold', 'bold', 'heavy', 'black'];
const styleRank = (s: string) => {
  const n = norm(s).replace(/\s+/g, '');
  const i = STYLE_ORDER.findIndex((x) => n === x);
  return (i < 0 ? 50 : i) + (n.includes('italic') || n.includes('oblique') ? 100 : 0);
};

function toBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

/** Prepara os bytes de uma fonte: separa a variante de uma coleção, deteta o formato e verifica o tamanho */
function prepare(bytes: Uint8Array, name: string, face?: string, fallback?: FontFormat): PickedFont {
  let b = bytes;
  let fmt = sniffFormat(b);
  if (fmt === 'collection') { b = extractFace(b, face); fmt = sniffFormat(b); }
  if (b.length > FONT_MAX_BYTES) throw new Error(`"${name}" tem ${mb(b.length)}; o máximo é ${mb(FONT_MAX_BYTES)} (fontes assim deixam o projeto muito pesado).`);
  return { name, format: (fmt === 'collection' ? fallback : fmt) ?? 'truetype', data: toBase64(b) };
}

export const FontPicker: React.FC<{ onPick: (f: PickedFont[]) => void; onClose: () => void }> = ({ onPick, onClose }) => {
  const [faces, setFaces] = useState<LocalFace[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [sample, setSample] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    if (!window.queryLocalFonts) { setFaces([]); setErr('Este sistema não deixa ler as fontes instaladas. Importa um ficheiro de fonte.'); return; }
    window.queryLocalFonts().then(setFaces).catch(() => { setFaces([]); setErr('Não foi possível ler as fontes do computador. Importa um ficheiro de fonte.'); });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const families = useMemo(() => {
    const m = new Map<string, LocalFace[]>();
    for (const f of faces ?? []) { if (!m.has(f.family)) m.set(f.family, []); m.get(f.family)!.push(f); }
    for (const list of m.values()) list.sort((a, b) => styleRank(a.style) - styleRank(b.style) || a.style.localeCompare(b.style));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt'));
  }, [faces]);

  const shown = useMemo(() => {
    const n = norm(q.trim());
    const list = n ? families.filter(([fam]) => norm(fam).includes(n)) : families;
    return list.slice(0, 150);
  }, [families, q]);
  const total = q.trim() ? families.filter(([fam]) => norm(fam).includes(norm(q.trim()))).length : families.length;

  const pickLocal = async (f: LocalFace) => {
    setBusy(f.fullName); setErr(null);
    try {
      const bytes = new Uint8Array(await (await f.blob()).arrayBuffer());
      const name = /^(regular|normal|book|roman)$/i.test(f.style) ? f.family : `${f.family} ${f.style}`;
      onPick([prepare(bytes, name, f.postscriptName)]);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };

  const importFile = async () => {
    setErr(null);
    const files = await api().fontsImport();
    if (!files.length) return;
    const ok: PickedFont[] = [];
    const errors: string[] = [];
    for (const f of files) {
      try { ok.push(prepare(fromBase64(f.data), f.name, undefined, formatFromName(f.file))); } catch (e) { errors.push((e as Error).message); }
    }
    if (errors.length) setErr(errors.join(' '));
    if (ok.length) onPick(ok);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal font-picker" role="dialog" aria-modal="true" aria-labelledby="fp-title">
        <h3 id="fp-title">Escolher fonte</h3>
        <div className="fp-bar">
          <input ref={input} type="search" placeholder="Procurar pelo nome…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Procurar fonte" />
          <input type="text" placeholder="Texto de exemplo" value={sample} onChange={(e) => setSample(e.target.value)} aria-label="Texto de exemplo" />
        </div>
        <p className="fp-hint">
          {faces === null ? 'A ler as fontes do computador…' : `${total} ${total === 1 ? 'família' : 'famílias'} no computador${total > shown.length ? ` · a mostrar ${shown.length}, escreve para filtrar` : ''}`}
          {' · '}a fonte fica guardada dentro do projeto
        </p>
        {err && <p className="fp-err">{err}</p>}
        <div className="fp-list">
          {shown.map(([fam, list]) => (
            <div key={fam} className="fp-row">
              <div className="fp-name">{fam}</div>
              <div className="fp-sample" style={{ fontFamily: `"${fam}"` }}>{sample || fam}</div>
              <div className="fp-styles">
                {list.map((f) => (
                  <button key={f.postscriptName || f.fullName} className="chip" disabled={!!busy} onClick={() => pickLocal(f)}
                    style={{ fontFamily: `"${fam}"` }} title={f.fullName}>
                    {busy === f.fullName ? 'A carregar…' : f.style}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {faces !== null && !shown.length && !err && <p className="fp-hint">Nenhuma fonte com "{q}".</p>}
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={importFile}>Importar ficheiro… <small>(.ttf .otf .woff .woff2)</small></button>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
};
