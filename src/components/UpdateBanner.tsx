// Aviso de atualização: aparece no canto quando há versão nova (ou ao procurar à mão).
import React, { useEffect, useState } from 'react';
import { api, type UpdateStatus } from '../api';

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;

/** Primeiras linhas das notas da versão, sem marcação */
function shortNotes(md: string): string[] {
  return md.split('\n').map((l) => l.replace(/^[#>*\-\s]+/, '').replace(/\*\*/g, '').trim()).filter(Boolean).slice(0, 4);
}

export const UpdateBanner: React.FC<{ beforeInstall: () => Promise<void> }> = ({ beforeInstall }) => {
  const [u, setU] = useState<UpdateStatus | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => api().onUpdate((s) => {
    // verificação automática sem novidades ou com erro: não incomoda
    if (!s.manual && (s.status === 'none' || s.status === 'error' || s.status === 'checking')) return;
    setU((prev) => { if (!prev || prev.status !== s.status) setHidden(false); return s; });
    if (s.status === 'none') setTimeout(() => setU((x) => (x === s ? null : x)), 5000);
  }), []);

  if (!u || hidden) return null;
  const close = () => setHidden(true);

  let body: React.ReactNode = null;
  switch (u.status) {
    case 'checking':
      body = <p className="upd-line">A procurar atualizações…</p>;
      break;
    case 'none':
      body = <p className="upd-line">Tens a versão mais recente ({u.current}).</p>;
      break;
    case 'error':
      body = (<>
        <p className="upd-line">Não foi possível atualizar: {u.message}</p>
        <div className="upd-actions"><button className="btn" onClick={close}>Fechar</button></div>
      </>);
      break;
    case 'available': {
      const notes = shortNotes(u.notes || '');
      body = (<>
        <p className="upd-title">VidCut {u.version} disponível</p>
        <p className="upd-sub">Tens a {u.current}{u.size ? ` · ${mb(u.size)}` : ''}</p>
        {notes.length > 0 && <ul className="upd-notes">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
        {!u.canInstall && (
          <p className="upd-sub">{u.kind === 'dev'
            ? 'Versão de desenvolvimento: atualiza com git pull.'
            : 'Nesta instalação a atualização é manual: abre a página e descarrega o instalador.'}</p>
        )}
        <div className="upd-actions">
          <button className="btn ghost" onClick={() => { api().updateSkip(u.version!); close(); }}>Saltar esta versão</button>
          <button className="btn ghost" onClick={() => api().updateOpenPage()}>Novidades</button>
          {u.canInstall
            ? <button className="btn primary" onClick={() => api().updateDownload()}>Atualizar</button>
            : <button className="btn primary" onClick={() => { api().updateOpenPage(); close(); }}>Abrir página</button>}
        </div>
      </>);
      break;
    }
    case 'downloading':
      body = (<>
        <p className="upd-title">A descarregar VidCut {u.version}</p>
        <div className="upd-bar"><div style={{ width: `${Math.round((u.progress || 0) * 100)}%` }} /></div>
        <p className="upd-sub">{Math.round((u.progress || 0) * 100)}%{u.total ? ` · ${mb(u.got || 0)} de ${mb(u.total)}` : ''}</p>
        <div className="upd-actions"><button className="btn ghost" onClick={() => api().updateCancel()}>Cancelar</button></div>
      </>);
      break;
    case 'ready':
      body = (<>
        <p className="upd-title">VidCut {u.version} pronto a instalar</p>
        <p className="upd-sub">A app fecha, atualiza e volta a abrir. O projeto aberto fica na gravação automática.</p>
        <div className="upd-actions">
          <button className="btn ghost" onClick={close}>Mais tarde</button>
          <button className="btn primary" onClick={async () => {
            await beforeInstall();
            const r = await api().updateInstall();
            if (r && typeof r === 'object' && 'error' in r) setU({ ...u, status: 'error', message: r.error });
          }}>Reiniciar e instalar</button>
        </div>
      </>);
      break;
  }
  return (
    <div className="upd" role="status" aria-live="polite">
      <button className="upd-x" onClick={close} aria-label="Fechar">×</button>
      {body}
    </div>
  );
};
