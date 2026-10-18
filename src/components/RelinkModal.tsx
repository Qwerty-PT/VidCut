// Ficheiros em falta ao abrir um projeto (outro computador, pasta mudada): reencontrar numa pasta ou um a um.
import React, { useState } from 'react';
import { useEditor } from '../editor-context';
import { api, type MissingMedia } from '../api';
import { closeModal } from '../modals';
import { refreshThumbs } from '../media';
import { Icon } from './Icon';

export const RelinkModal: React.FC<{ missing: MissingMedia[] }> = ({ missing }) => {
  const { state, commit, notify, mediaBase } = useEditor();
  const [found, setFound] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const left = missing.filter((m) => !found[m.id]);
  const apply = (map: Record<string, string>) => {
    const ids = Object.keys(map);
    if (!ids.length) return;
    commit((p) => ({ ...p, media: p.media.map((m) => (map[m.id] ? { ...m, path: map[m.id] } : m)) }));
    void api().registerMedia(Object.values(map));
    refreshThumbs(state.project.media.filter((m) => map[m.id]).map((m) => ({ ...m, path: map[m.id] })), mediaBase);
  };
  const folder = async () => {
    setBusy(true);
    try {
      const r = await api().relinkFolder(left);
      if (!r) return;
      const n = Object.keys(r).length;
      setFound((f) => ({ ...f, ...r }));
      apply(r);
      notify(n ? `${n} ${n === 1 ? 'ficheiro reencontrado' : 'ficheiros reencontrados'}.` : 'Não encontrei nenhum desses ficheiros nessa pasta.', n ? 'info' : 'error');
    } finally { setBusy(false); }
  };
  const one = async (m: MissingMedia) => {
    const r = await api().relinkFile(m.file);
    if (!r) return;
    setFound((f) => ({ ...f, [m.id]: r }));
    apply({ [m.id]: r });
  };
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className="modal relink-modal" role="dialog" aria-modal="true" aria-labelledby="rl-title">
        <h3 id="rl-title">{left.length ? (left.length === 1 ? 'Falta 1 ficheiro' : `Faltam ${left.length} ficheiros`) : 'Todos os ficheiros encontrados'}</h3>
        <p className="hint">O projeto foi mudado de sítio ou aberto noutro computador. Escolhe a pasta onde estão os ficheiros: procuro lá (e nas subpastas) pelo nome e tamanho — um encontrado ajuda a encontrar os outros.</p>
        <ul className="relink-list">
          {missing.map((m) => (
            <li key={m.id} className={found[m.id] ? 'ok' : ''}>
              <Icon name={found[m.id] ? 'link' : 'unlink'} size={14} />
              <span className="rl-name" title={found[m.id] ?? m.path}>{m.file}</span>
              {found[m.id] ? <span className="rl-ok">encontrado</span> : <button className="btn tiny" onClick={() => { void one(m); }}>Procurar…</button>}
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button className="btn" onClick={closeModal}>{left.length ? 'Mais tarde' : 'Fechar'}</button>
          {left.length > 0 && <button className="btn primary" disabled={busy} onClick={() => { void folder(); }}>{busy ? 'A procurar…' : 'Procurar numa pasta…'}</button>}
        </div>
      </div>
    </div>
  );
};
