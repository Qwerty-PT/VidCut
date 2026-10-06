import React, { useEffect, useState } from 'react';
import { api, type ExportProgress } from '../api';
import { Icon } from './Icon';

export type ExportState =
  | { phase: 'running'; progress: ExportProgress | null }
  | { phase: 'done'; path: string }
  | { phase: 'error'; error: string };

export const ExportModal: React.FC<{ state: ExportState; onClose: () => void }> = ({ state, onClose }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (state.phase !== 'running') return;
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [state.phase]);

  const pct = state.phase === 'running' ? Math.round((state.progress?.progress ?? 0) * 100) : 100;

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <h3 id="export-title">
          {state.phase === 'running' ? 'A exportar vídeo' : state.phase === 'done' ? 'Vídeo exportado' : 'Erro no export'}
        </h3>

        {state.phase === 'running' && (
          <>
            <div className="progress"><div className="progress-bar" style={{ width: `${pct}%` }} /></div>
            <div className="progress-info">
              <span>{state.progress?.message ?? 'A iniciar…'}</span>
              <span>{pct}% · {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => api().cancelExport()}>Cancelar</button>
            </div>
          </>
        )}

        {state.phase === 'done' && (
          <>
            <p className="path">{state.path}</p>
            <div className="modal-actions">
              <button className="btn" onClick={() => api().showItem(state.path)}><Icon name="folder" size={16} /> Mostrar na pasta</button>
              <button className="btn primary" onClick={onClose}>Fechar</button>
            </div>
          </>
        )}

        {state.phase === 'error' && (
          <>
            <pre className="error-box">{state.error}</pre>
            <div className="modal-actions">
              <button className="btn primary" onClick={onClose}>Fechar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
