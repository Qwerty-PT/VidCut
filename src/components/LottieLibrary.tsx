import React, { useEffect, useRef, useState } from 'react';
import lottie, { type AnimationItem } from 'lottie-web';
import { useEditor } from '../editor-context';
import { addLottieClip } from '../ops';
import { playhead } from '../playhead';
import { api } from '../api';
import { lottieInfo } from '../../shared/lottie';
import {
  LOTTIE_SOURCES, PACK, PACK_CATEGORIES, addUserLotties, loadUserLotties, removeUserLottie, useUserLotties, type LottieEntry,
} from '../lottie-registry';
import { Icon } from './Icon';

export const LOTTIE_DRAG_TYPE = 'application/x-vidcut-lottie';

/** Miniatura viva: parada num fotograma "bonito", toca ao passar o rato */
const LottieThumb: React.FC<{ entry: LottieEntry; playing: boolean }> = ({ entry, playing }) => {
  const box = useRef<HTMLDivElement>(null);
  const anim = useRef<AnimationItem | null>(null);
  const rest = Math.round(lottieInfo(entry.data).frames * (entry.thumb ?? 0.72));
  useEffect(() => {
    if (!box.current) return;
    const a = lottie.loadAnimation({
      container: box.current, renderer: 'svg', loop: true, autoplay: false,
      animationData: structuredClone(entry.data), rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
    });
    a.addEventListener('DOMLoaded', () => a.goToAndStop(rest, true));
    anim.current = a;
    return () => { a.destroy(); anim.current = null; };
  }, [entry, rest]);
  useEffect(() => {
    const a = anim.current;
    if (!a) return;
    if (playing) a.goToAndPlay(0, true); else a.goToAndStop(rest, true);
  }, [playing, rest]);
  return <div className="lot-anim" ref={box} />;
};

const LottieCard: React.FC<{ entry: LottieEntry; onAdd: () => void; onRemove?: () => void }> = ({ entry, onAdd, onRemove }) => {
  const [hover, setHover] = useState(false);
  return (
    <li
      className="tpl-card lot-card"
      draggable
      onDragStart={(e) => { e.dataTransfer.setData(LOTTIE_DRAG_TYPE, entry.id); e.dataTransfer.effectAllowed = 'copy'; }}
      onDoubleClick={onAdd}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={`${entry.name}\nDuplo clique ou arrastar para a timeline`}
    >
      <div className="tpl-thumb lot-thumb"><LottieThumb entry={entry} playing={hover} /></div>
      <span className="tpl-name">{entry.name}</span>
      {onRemove && (
        <button className="lot-remove" title="Remover da biblioteca" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
          <Icon name="close" size={12} />
        </button>
      )}
    </li>
  );
};

export const LottieLibrary: React.FC = () => {
  const { commit, notify } = useEditor();
  const user = useUserLotties();
  const [dropping, setDropping] = useState(false);
  useEffect(() => { loadUserLotties(); }, []);

  const add = (entry: LottieEntry) =>
    commit((p) => {
      const r = addLottieClip(p, { id: entry.id, name: entry.name, data: entry.data }, playhead.frame);
      return { project: r.project, select: r.clipId ? [r.clipId] : undefined };
    });

  const doImport = async (paths?: string[]) => {
    const r = await api().lottieImport(paths);
    if (r.added.length) { addUserLotties(r.added); notify(r.added.length === 1 ? `Animação "${r.added[0].name}" adicionada` : `${r.added.length} animações adicionadas`); }
    if (r.errors.length) notify(`Não foi possível importar: ${r.errors.join(' · ')}`, 'error');
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDropping(false);
    const paths = Array.from(e.dataTransfer.files).map((f) => window.vidcut?.pathForFile(f) ?? '').filter((p) => /\.(json|lottie)$/i.test(p));
    if (paths.length) doImport(paths);
    else if (e.dataTransfer.files.length) notify('Só aceito ficheiros .json (Lottie) ou .lottie', 'error');
  };

  return (
    <div
      className={`tpl-gallery lot-lib${dropping ? ' dropping' : ''}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.stopPropagation(); setDropping(true); } }}
      onDragLeave={() => setDropping(false)}
      onDrop={onDrop}
    >
      {PACK_CATEGORIES.map((cat) => (
        <section key={cat}>
          <h3 className="tpl-cat">{cat}</h3>
          <ul className="tpl-grid">
            {PACK.filter((e) => e.category === cat).map((e) => <LottieCard key={e.id} entry={e} onAdd={() => add(e)} />)}
          </ul>
        </section>
      ))}

      <section>
        <div className="lot-head">
          <h3 className="tpl-cat">As minhas</h3>
          <button className="btn tiny" onClick={() => doImport()}><Icon name="plus" size={12} /> Adicionar</button>
        </div>
        {user.length ? (
          <ul className="tpl-grid">
            {user.map((e) => (
              <LottieCard
                key={e.id} entry={e} onAdd={() => add(e)}
                onRemove={async () => { await api().lottieRemove(e.id); removeUserLottie(e.id); notify(`"${e.name}" removida da biblioteca (os projetos que a usam não são afetados)`); }}
              />
            ))}
          </ul>
        ) : (
          <button className="lot-empty" onClick={() => doImport()}>
            <Icon name="import" size={20} />
            <span>Arrasta para aqui ficheiros <b>.json</b> ou <b>.lottie</b>, ou clica para escolher</span>
          </button>
        )}
      </section>

      <section className="lot-sources">
        <h3 className="tpl-cat">Obter mais</h3>
        <ul>
          {LOTTIE_SOURCES.map((s) => (
            <li key={s.name}><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> <span>— {s.hint}</span></li>
          ))}
        </ul>
        <p className="hint">Descarrega em <b>Lottie JSON</b> ou <b>.lottie</b> e arrasta para "As minhas". Confirma a licença de cada animação antes de a usares num vídeo público.</p>
      </section>
    </div>
  );
};
