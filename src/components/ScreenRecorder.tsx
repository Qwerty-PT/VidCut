// Gravar ecrã e câmara: escolher o ecrã ou uma janela, câmara e microfone; grava ficheiros separados
// (ecrã com o som, câmara sem som) e põe-nos na timeline: o ecrã por baixo, a câmara num canto por cima.
import React, { useEffect, useRef, useState } from 'react';
import { useEditor } from '../editor-context';
import { api } from '../api';
import { playhead } from '../playhead';
import { probeMedia } from '../media';
import { addMedia, placeRecording } from '../ops';
import { Icon } from './Icon';

type Source = { id: string; name: string; type: 'screen' | 'window'; thumb: string };
type Phase = 'setup' | 'count' | 'rec' | 'saving';

const fmt = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const pickMime = (video: boolean, audio: boolean) => {
  const list = video
    ? audio ? ['video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      : ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    : ['audio/webm;codecs=opus'];
  return list.find((m) => MediaRecorder.isTypeSupported(m)) || '';
};

export const ScreenRecorder: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { commit, notify, mediaBase } = useEditor();
  const [sources, setSources] = useState<Source[] | null>(null);
  const [chosen, setChosen] = useState<string>('');
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [sysAudio, setSysAudio] = useState(false);
  const [hide, setHide] = useState(true);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState('');
  const [micId, setMicId] = useState('');
  const [status, setStatus] = useState<Awaited<ReturnType<ReturnType<typeof api>['recStatus']>> | null>(null);
  const [phase, setPhase] = useState<Phase>('setup');
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const camVideo = useRef<HTMLVideoElement>(null);
  const camStream = useRef<MediaStream | null>(null);
  const micStream = useRef<MediaStream | null>(null);
  const screenStream = useRef<MediaStream | null>(null);
  const recs = useRef<{ rec: MediaRecorder; kind: 'ecra' | 'camara'; chunks: Blob[]; mime: string }[]>([]);
  const actx = useRef<AudioContext | null>(null);
  const meterRaf = useRef(0);
  const tickIv = useRef<ReturnType<typeof setInterval> | null>(null);
  const t0 = useRef(0);
  const startAt = useRef(0);

  const refreshSources = async () => {
    try {
      const s = await api().recSources();
      setSources(s);
      setChosen((c) => c || s.find((x) => x.type === 'screen')?.id || s[0]?.id || 'none');
    } catch (e) { setSources([]); setErr(`Não foi possível listar os ecrãs: ${(e as Error).message}`); }
  };

  const refreshDevices = async () => {
    const all = await navigator.mediaDevices.enumerateDevices();
    setCams(all.filter((d) => d.kind === 'videoinput'));
    setMics(all.filter((d) => d.kind === 'audioinput'));
  };

  useEffect(() => {
    api().recStatus().then(setStatus);
    void refreshSources();
    void refreshDevices();
    return () => { stopAll(); };
  }, []);

  // câmara: pré-visualização ao vivo
  useEffect(() => {
    let alive = true;
    camStream.current?.getTracks().forEach((t) => t.stop());
    camStream.current = null;
    if (!camOn) return;
    (async () => {
      if (!(await api().recAskCamera())) { setErr('O VidCut não tem acesso à câmara. Em Definições do Sistema → Privacidade e segurança → Câmara, ativa o VidCut.'); setCamOn(false); return; }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: camId ? { exact: camId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } });
        if (!alive) { s.getTracks().forEach((t) => t.stop()); return; }
        camStream.current = s;
        if (camVideo.current) { camVideo.current.srcObject = s; void camVideo.current.play().catch(() => {}); }
        void refreshDevices();
      } catch (e) { setErr(`Não foi possível abrir a câmara: ${(e as Error).message}`); setCamOn(false); }
    })();
    return () => { alive = false; };
  }, [camOn, camId]);

  // microfone: medidor de nível
  useEffect(() => {
    let alive = true;
    micStream.current?.getTracks().forEach((t) => t.stop());
    micStream.current = null;
    cancelAnimationFrame(meterRaf.current);
    setLevel(0);
    if (!micOn) return;
    (async () => {
      if (!(await api().micAccess())) { setErr('O VidCut não tem acesso ao microfone (Definições do Sistema → Privacidade e segurança → Microfone).'); setMicOn(false); return; }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: micId ? { exact: micId } : undefined, echoCancellation: true, noiseSuppression: true } });
        if (!alive) { s.getTracks().forEach((t) => t.stop()); return; }
        micStream.current = s;
        const ctx = actx.current ?? new AudioContext();
        actx.current = ctx;
        const an = ctx.createAnalyser();
        an.fftSize = 1024;
        ctx.createMediaStreamSource(s).connect(an);
        const buf = new Float32Array(an.fftSize);
        const tick = () => {
          an.getFloatTimeDomainData(buf);
          let pk = 0;
          for (let i = 0; i < buf.length; i++) pk = Math.max(pk, Math.abs(buf[i]));
          setLevel((l) => Math.max(pk, l * 0.85));
          meterRaf.current = requestAnimationFrame(tick);
        };
        tick();
        void refreshDevices();
      } catch (e) { setErr(`Não foi possível abrir o microfone: ${(e as Error).message}`); setMicOn(false); }
    })();
    return () => { alive = false; };
  }, [micOn, micId]);

  function stopAll() {
    cancelAnimationFrame(meterRaf.current);
    if (tickIv.current) clearInterval(tickIv.current);
    for (const s of [camStream, micStream, screenStream]) { s.current?.getTracks().forEach((t) => t.stop()); s.current = null; }
    actx.current?.close().catch(() => {});
    actx.current = null;
  }

  const begin = () => {
    if (chosen === 'none' && !camOn) { setErr('Escolhe um ecrã/janela ou liga a câmara.'); return; }
    setErr(null);
    setPhase('count');
    let n = 3;
    setCount(n);
    const iv = setInterval(() => { n -= 1; if (n > 0) setCount(n); else { clearInterval(iv); void startRecording(); } }, 800);
  };

  const startRecording = async () => {
    try {
      const withScreen = chosen !== 'none';
      let audioTrack: MediaStreamTrack | null = null;
      if (withScreen) {
        await api().recChoose(chosen, sysAudio);
        const scr = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30 } }, audio: sysAudio && !!status?.systemAudio });
        screenStream.current = scr;
        // som do ecrã + microfone misturados numa só faixa (o gravador só grava uma)
        const parts = [...(micOn && micStream.current ? micStream.current.getAudioTracks() : []), ...scr.getAudioTracks()];
        if (parts.length === 1) audioTrack = parts[0];
        else if (parts.length > 1) {
          const ctx = actx.current ?? new AudioContext();
          actx.current = ctx;
          const dest = ctx.createMediaStreamDestination();
          for (const tr of parts) ctx.createMediaStreamSource(new MediaStream([tr])).connect(dest);
          audioTrack = dest.stream.getAudioTracks()[0];
        }
      } else if (micOn && micStream.current) audioTrack = micStream.current.getAudioTracks()[0];

      recs.current = [];
      const mk = (stream: MediaStream, kind: 'ecra' | 'camara', bps: number) => {
        const mime = pickMime(true, stream.getAudioTracks().length > 0);
        const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: bps, audioBitsPerSecond: 160_000 });
        const entry = { rec, kind, chunks: [] as Blob[], mime: rec.mimeType || mime };
        rec.ondataavailable = (e) => { if (e.data.size) entry.chunks.push(e.data); };
        recs.current.push(entry);
      };
      if (withScreen && screenStream.current) {
        const v = screenStream.current.getVideoTracks()[0];
        // se o utilizador fechar a partilha (ou a janela gravada), termina a gravação
        v.addEventListener('ended', () => void stop(true), { once: true });
        mk(new MediaStream([v, ...(audioTrack ? [audioTrack] : [])]), 'ecra', 10_000_000);
      }
      if (camOn && camStream.current) {
        const cv = camStream.current.getVideoTracks()[0];
        mk(new MediaStream([cv, ...(!withScreen && audioTrack ? [audioTrack] : [])]), 'camara', 5_000_000);
      }
      startAt.current = playhead.frame;
      for (const r of recs.current) r.rec.start(500);
      t0.current = Date.now();
      setPhase('rec');
      await api().recStarted(hide);
      const sc = status?.shortcut ?? '';
      tickIv.current = setInterval(() => {
        const ms = Date.now() - t0.current;
        setElapsed(ms);
        api().recTick(`${fmt(ms)}|${sc} para parar`);
      }, 250);
    } catch (e) {
      setPhase('setup');
      setErr(`Não foi possível começar a gravar: ${(e as Error).message}`);
      await api().recEnded();
    }
  };

  const stop = async (keep: boolean) => {
    if (tickIv.current) { clearInterval(tickIv.current); tickIv.current = null; }
    const list = recs.current;
    if (!list.length) return;
    recs.current = [];
    setPhase(keep ? 'saving' : 'setup');
    await Promise.all(list.map((r) => new Promise<void>((res) => { if (r.rec.state === 'inactive') res(); else { r.rec.onstop = () => res(); r.rec.stop(); } })));
    screenStream.current?.getTracks().forEach((t) => t.stop());
    screenStream.current = null;
    await api().recEnded();
    if (!keep) return;
    try {
      const saved: Record<'ecra' | 'camara', string | null> = { ecra: null, camara: null };
      for (const r of list) {
        const blob = new Blob(r.chunks, { type: r.mime });
        if (blob.size < 2000) continue;
        const { path } = await api().recSave(await blob.arrayBuffer(), r.mime, r.kind);
        saved[r.kind] = path;
      }
      if (!saved.ecra && !saved.camara) { setPhase('setup'); setErr('A gravação ficou vazia.'); return; }
      const items = await Promise.all([saved.ecra, saved.camara].filter(Boolean).map((p) => probeMedia(p as string, mediaBase)));
      const at = startAt.current;
      commit((p) => {
        const p1 = addMedia(p, items);
        const idOf = (path: string | null) => (path ? p1.media.find((m) => m.path === path)?.id ?? null : null);
        const r = placeRecording(p1, at, idOf(saved.ecra), idOf(saved.camara));
        return { project: r.project, select: r.select };
      });
      notify(saved.ecra && saved.camara ? 'Gravação adicionada: ecrã e câmara (num canto).' : 'Gravação adicionada à timeline.');
      stopAll();
      onClose();
    } catch (e) {
      setPhase('setup');
      setErr(`Não foi possível guardar a gravação: ${(e as Error).message}`);
    }
  };

  // Parar pela mini-janela ou pelo atalho
  useEffect(() => api().onRecStop(() => { void stop(true); }), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (phase === 'setup') { stopAll(); onClose(); }
      else if (phase === 'rec') void stop(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const screens = (sources ?? []).filter((s) => s.type === 'screen');
  const windows = (sources ?? []).filter((s) => s.type === 'window');
  const lv = Math.min(1, level * 1.6);
  const macScreenBlocked = status?.platform === 'darwin' && status.screen !== 'granted' && status.screen !== 'not-determined';

  if (phase !== 'setup') {
    return (
      <div className="modal-backdrop">
        <div className="modal rec-modal rec-live" role="dialog" aria-modal="true">
          {phase === 'count' && <div className="rec-count">{count}</div>}
          {phase === 'rec' && (
            <>
              <div className="rec-live-row"><span className="narr-rec"><i /> A gravar {fmt(elapsed)}</span></div>
              <p className="hint">Para parar: botão <b>Parar</b> na barra por cima do ecrã, o atalho <kbd>{status?.shortcut}</kbd>, ou aqui.</p>
              <div className="modal-actions">
                <button className="btn" onClick={() => void stop(false)}>Cancelar</button>
                <button className="btn primary" onClick={() => void stop(true)}><Icon name="stop" size={12} /> Parar e guardar</button>
              </div>
            </>
          )}
          {phase === 'saving' && <p className="rec-saving">A guardar a gravação…</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) { stopAll(); onClose(); } }}>
      <div className="modal rec-modal" role="dialog" aria-modal="true" aria-labelledby="rec-title">
        <h3 id="rec-title">Gravar ecrã e câmara</h3>
        {macScreenBlocked && (
          <p className="fp-err">O Mac não deu autorização para gravar o ecrã. Em Definições do Sistema → Privacidade e segurança → Gravação de ecrã e áudio do sistema, ativa o VidCut e volta a abrir a app.</p>
        )}
        <div className="rec-grid">
          <div className="rec-sources">
            <div className="rec-sec-head"><span className="field-label">O que gravar</span><button className="btn tiny" onClick={() => void refreshSources()}>Atualizar</button></div>
            {sources === null ? <p className="hint">A procurar ecrãs e janelas…</p> : (
              <div className="rec-src-list">
                {[...screens, ...windows].map((s) => (
                  <button key={s.id} className={`rec-src${chosen === s.id ? ' on' : ''}`} onClick={() => setChosen(s.id)} title={s.name}>
                    <span className="rec-src-thumb">{s.thumb ? <img src={s.thumb} alt="" /> : <Icon name="safe" size={18} />}</span>
                    <span className="rec-src-name">{s.type === 'screen' ? '🖥 ' : ''}{s.name}</span>
                  </button>
                ))}
                <button className={`rec-src${chosen === 'none' ? ' on' : ''}`} onClick={() => setChosen('none')}>
                  <span className="rec-src-thumb none">Só câmara</span>
                  <span className="rec-src-name">Sem ecrã</span>
                </button>
              </div>
            )}
          </div>
          <div className="rec-side">
            <label className="check"><input type="checkbox" checked={camOn} onChange={(e) => setCamOn(e.target.checked)} /> Câmara</label>
            {camOn && (
              <>
                <video ref={camVideo} className="rec-cam" muted playsInline />
                {cams.length > 1 && <select value={camId} onChange={(e) => setCamId(e.target.value)} aria-label="Câmara">{cams.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Câmara'}</option>)}</select>}
              </>
            )}
            <label className="check"><input type="checkbox" checked={micOn} onChange={(e) => setMicOn(e.target.checked)} /> Microfone</label>
            {micOn && (
              <>
                <div className="narr-meter rec-meter"><div style={{ width: `${lv * 100}%`, background: lv > 0.92 ? 'var(--danger)' : undefined }} /></div>
                {mics.length > 1 && <select value={micId} onChange={(e) => setMicId(e.target.value)} aria-label="Microfone">{mics.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microfone'}</option>)}</select>}
              </>
            )}
            {status?.systemAudio && <label className="check"><input type="checkbox" checked={sysAudio} onChange={(e) => setSysAudio(e.target.checked)} /> Som do computador</label>}
            <label className="check"><input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} /> Esconder o VidCut a gravar</label>
            <p className="hint">Fica uma barrinha com <b>Parar</b> por cima de tudo (não aparece no vídeo). Atalho: <kbd>{status?.shortcut}</kbd>. O ecrã vai para a agulha{camOn ? ' e a câmara fica num canto por cima' : ''}.</p>
          </div>
        </div>
        {err && <p className="fp-err">{err}</p>}
        <div className="modal-actions">
          <button className="btn" onClick={() => { stopAll(); onClose(); }}>Fechar</button>
          <button className="btn primary narr-go" onClick={begin} disabled={chosen === 'none' && !camOn}><Icon name="record" size={12} /> Gravar</button>
        </div>
      </div>
    </div>
  );
};
