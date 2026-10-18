// Gravar narração: o vídeo toca a partir da agulha enquanto se fala ao microfone;
// no fim, a gravação entra numa pista de áudio exatamente onde começou.
import React, { useEffect, useRef, useState } from 'react';
import { useEditor } from '../editor-context';
import { api } from '../api';
import { playhead } from '../playhead';
import { probeMedia } from '../media';
import { addAudioAt, addMedia } from '../ops';
import { Icon } from './Icon';

type Phase = 'idle' | 'ready' | 'count' | 'rec' | 'saving';

const fmt = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export const NarrationButton: React.FC<{ onOpen: () => void; active: boolean }> = ({ onOpen, active }) => (
  <button className={`icon-btn${active ? ' on' : ''}`} title="Gravar narração na agulha" onClick={onOpen}><Icon name="mic" /></button>
);

export const NarrationPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { commit, notify, mediaBase, state } = useEditor();
  const [phase, setPhase] = useState<Phase>('ready');
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [muteProject, setMuteProject] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startFrame = useRef(0);
  const t0 = useRef(0);
  const raf = useRef(0);
  const discard = useRef(false);
  const actx = useRef<AudioContext | null>(null);

  const cleanup = () => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    actx.current?.close().catch(() => {});
    actx.current = null;
    playhead.player?.unmute();
  };
  useEffect(() => () => { discard.current = true; try { rec.current?.stop(); } catch { /* já parado */ } cleanup(); }, []);

  // abrir o microfone logo ao abrir o painel (mostra o nível antes de gravar)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!(await api().micAccess())) { setErr('O VidCut não tem acesso ao microfone. Em Definições do Sistema → Privacidade e segurança → Microfone, ativa o VidCut e volta a tentar.'); return; }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        if (!alive) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        const ctx = new AudioContext();
        actx.current = ctx;
        const an = ctx.createAnalyser();
        an.fftSize = 1024;
        ctx.createMediaStreamSource(s).connect(an);
        const buf = new Float32Array(an.fftSize);
        const tick = () => {
          an.getFloatTimeDomainData(buf);
          let peak = 0;
          for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
          setLevel((l) => Math.max(peak, l * 0.85));
          if (rec.current?.state === 'recording') setElapsed(Date.now() - t0.current);
          raf.current = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) {
        setErr(`Não foi possível abrir o microfone: ${(e as Error).message}`);
      }
    })();
    return () => { alive = false; };
  }, []);

  const begin = () => {
    if (!stream.current) return;
    setPhase('count');
    let n = 3;
    setCount(n);
    const iv = setInterval(() => {
      n -= 1;
      if (n > 0) { setCount(n); return; }
      clearInterval(iv);
      startRecording();
    }, 800);
  };

  const startRecording = () => {
    const s = stream.current;
    if (!s) return;
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
    const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
    chunks.current = [];
    discard.current = false;
    r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    r.onstop = () => { void finish(r.mimeType || mime); };
    rec.current = r;
    startFrame.current = playhead.frame;
    if (muteProject) playhead.player?.mute();
    r.start(250);
    t0.current = Date.now();
    setElapsed(0);
    setPhase('rec');
    playhead.player?.play();
  };

  const stop = (keep: boolean) => {
    discard.current = !keep;
    playhead.pause();
    if (rec.current && rec.current.state !== 'inactive') { setPhase(keep ? 'saving' : 'ready'); rec.current.stop(); }
    playhead.player?.unmute();
  };

  const finish = async (mime: string) => {
    if (discard.current) { setPhase('ready'); return; }
    try {
      const blob = new Blob(chunks.current, { type: mime });
      if (blob.size < 1000) { setPhase('ready'); notify('A gravação ficou vazia.', 'error'); return; }
      const { path } = await api().saveRecording(await blob.arrayBuffer(), mime);
      const item = await probeMedia(path, mediaBase);
      const at = startFrame.current;
      commit((p) => {
        const p1 = addMedia(p, [item]);
        const mid = p1.media.find((m) => m.path === path)!.id;
        const r = addAudioAt(p1, mid, at);
        return { project: r.project, select: r.clipId ? [r.clipId] : undefined };
      });
      notify('Narração adicionada na timeline.');
      cleanup();
      onClose();
    } catch (e) {
      setPhase('ready');
      setErr(`Não foi possível guardar a gravação: ${(e as Error).message}`);
    }
  };

  // Espaço para / Esc cancela enquanto grava; Esc fecha quando parado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'rec' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); e.stopPropagation(); stop(true); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (phase === 'rec') stop(false); else if (phase !== 'saving') { cleanup(); onClose(); } }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const lv = Math.min(1, level * 1.6);
  const fps = state.project.fps;
  return (
    <div className="narr-bar" role="dialog" aria-label="Gravar narração">
      <div className="narr-meter" title="Nível do microfone"><div style={{ width: `${lv * 100}%`, background: lv > 0.92 ? 'var(--danger)' : undefined }} /></div>
      {err ? <p className="narr-err">{err}</p> : (
        <>
          {phase === 'ready' && (
            <>
              <span className="narr-info">Começa na agulha ({(playhead.frame / fps).toFixed(1).replace('.', ',')} s)</span>
              <label className="check small"><input type="checkbox" checked={muteProject} onChange={(e) => setMuteProject(e.target.checked)} /> Silenciar o projeto</label>
              <button className="btn primary narr-go" disabled={!stream.current} onClick={begin}><Icon name="record" size={12} /> Gravar</button>
            </>
          )}
          {phase === 'count' && <span className="narr-count">{count}</span>}
          {phase === 'rec' && (
            <>
              <span className="narr-rec"><i /> A gravar {fmt(elapsed)}</span>
              <button className="btn" onClick={() => stop(false)} title="Esc">Cancelar</button>
              <button className="btn primary" onClick={() => stop(true)} title="Espaço"><Icon name="stop" size={12} /> Parar</button>
            </>
          )}
          {phase === 'saving' && <span className="narr-info">A guardar…</span>}
        </>
      )}
      {phase !== 'rec' && phase !== 'saving' && <button className="icon-btn" onClick={() => { cleanup(); onClose(); }} aria-label="Fechar"><Icon name="close" size={14} /></button>}
    </div>
  );
};
