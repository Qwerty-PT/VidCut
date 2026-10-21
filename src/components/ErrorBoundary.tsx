// Se a interface rebentar, mostra o erro e um botão para recarregar (o projeto está na gravação automática),
// em vez de deixar o ecrã preto.
import React from 'react';

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('VidCut: erro na interface', error, info.componentStack); }
  render() {
    const e = this.state.error;
    if (!e) return this.props.children;
    return (
      <div className="crash">
        <h1>Algo correu mal</h1>
        <p>A interface encontrou um erro. O teu projeto está guardado na gravação automática: ao recarregar volta tal como estava (no máximo perdes o último segundo).</p>
        <pre>{String(e.message || e).slice(0, 600)}</pre>
        <div className="crash-actions">
          <button className="btn primary" onClick={() => location.reload()}>Recarregar</button>
          <button className="btn" onClick={() => { void navigator.clipboard?.writeText(`${e.message}\n${e.stack ?? ''}`); }}>Copiar o erro</button>
        </div>
      </div>
    );
  }
}
