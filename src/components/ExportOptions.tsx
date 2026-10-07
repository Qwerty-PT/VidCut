import React, { useEffect, useMemo, useState } from 'react';
import type { Project } from '../../shared/types';
import { projectDuration } from '../../shared/types';
import {
  DEFAULT_EXPORT, FORMATS, estimateBytes, exportFps, formatBytes, gifFps, outputSize, rangeFrames, resolutionChoices,
  type ExportFormat, type ExportOptions,
} from '../../shared/export';
import { Segmented } from './Fields';
import { timecode } from '../util';

const STORE_KEY = 'vidcut.export.v1';

export function loadExportOptions(): ExportOptions {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return { ...DEFAULT_EXPORT, ...JSON.parse(raw), range: 'all' };
  } catch { /* sem armazenamento */ }
  return DEFAULT_EXPORT;
}
function saveExportOptions(o: ExportOptions) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(o)); } catch { /* ignora */ }
}

const FORMAT_ORDER: ExportFormat[] = ['mp4', 'hevc', 'webm', 'prores', 'gif', 'mp3', 'wav'];
const FPS_CHOICES = [24, 25, 30, 50, 60];

const fmtDur = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const ExportOptionsModal: React.FC<{
  project: Project;
  selectionRange: [number, number] | null;
  initial: ExportOptions;
  onCancel: () => void;
  onExport: (o: ExportOptions) => void;
}> = ({ project, selectionRange, initial, onCancel, onExport }) => {
  const totalSec = projectDuration(project) / project.fps;
  const [o, setO] = useState<ExportOptions>(() => ({
    ...initial,
    range: selectionRange ? 'selection' : 'all',
    fromSec: 0,
    toSec: Math.round(totalSec * 100) / 100,
  }));
  const set = (patch: Partial<ExportOptions>) => setO((v) => ({ ...v, ...patch }));
  const f = FORMATS[o.format];

  // GIF: por omissão, resolução pequena
  const pickFormat = (format: ExportFormat) => {
    const patch: Partial<ExportOptions> = { format };
    if (format === 'gif' && (o.resolution === 0 || o.resolution > 720)) patch.resolution = 480;
    if (o.format === 'gif' && format !== 'gif' && o.resolution === 480) patch.resolution = 0;
    set(patch);
  };

  const range = rangeFrames(project, o, selectionRange);
  const frames = range ? range[1] - range[0] + 1 : projectDuration(project);
  const fps = exportFps(project, o);
  const durSec = frames / project.fps;
  const size = outputSize(project, o.resolution, o.format === 'mp4' || o.format === 'hevc');
  const bytes = useMemo(() => estimateBytes(project, o, Math.round(durSec * fps)), [project, o, durSec, fps]);
  const invalid = o.range === 'custom' && !range;

  const go = () => {
    if (invalid) return;
    saveExportOptions(o);
    onExport(o);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
      if (e.key === 'Enter' && (e.target as HTMLElement)?.tagName !== 'BUTTON') { e.preventDefault(); go(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const qualityLabels = o.format === 'gif'
    ? { alta: `Fluido · ${Math.round(gifFps(project, 'alta'))} fps`, media: `Médio · ${Math.round(gifFps(project, 'media'))} fps`, leve: `Leve · ${Math.round(gifFps(project, 'leve'))} fps` }
    : f.audioOnly
      ? { alta: '320 kbps', media: '192 kbps', leve: '128 kbps' }
      : { alta: 'Alta', media: 'Média', leve: 'Leve' };

  const rangeOptions = [
    { value: 'all' as const, label: `Tudo · ${fmtDur(totalSec)}` },
    ...(selectionRange ? [{ value: 'selection' as const, label: 'Seleção' }] : []),
    { value: 'custom' as const, label: 'Intervalo' },
  ];

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal export-modal" role="dialog" aria-modal="true" aria-labelledby="exp-title">
        <h3 id="exp-title">Exportar</h3>

        <div className="field">
          <span className="field-label">Formato</span>
          <div className="fmt-grid" role="radiogroup" aria-label="Formato">
            {FORMAT_ORDER.map((k) => (
              <button
                key={k} role="radio" aria-checked={o.format === k}
                className={`fmt${o.format === k ? ' on' : ''}${FORMATS[k].audioOnly ? ' audio' : ''}`}
                onClick={() => pickFormat(k)}
              >
                <b>{FORMATS[k].label}</b>
                <small>.{FORMATS[k].ext}</small>
              </button>
            ))}
          </div>
          <span className="fmt-hint">{f.hint}</span>
        </div>

        {f.video && (
          <div className="exp-row">
            <label className="field">
              <span className="field-label">Resolução</span>
              <select value={o.resolution} onChange={(e) => set({ resolution: Number(e.target.value) })}>
                {resolutionChoices(project).map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>
            {o.format !== 'gif' && (
              <label className="field">
                <span className="field-label">Fotogramas</span>
                <select value={o.fps} onChange={(e) => set({ fps: Number(e.target.value) })}>
                  <option value={0}>Projeto ({project.fps} fps)</option>
                  {FPS_CHOICES.filter((x) => x !== project.fps).map((x) => <option key={x} value={x}>{x} fps</option>)}
                </select>
              </label>
            )}
          </div>
        )}

        {f.hasQuality && (
          <div className="field">
            <span className="field-label">Qualidade</span>
            <Segmented
              label="Qualidade" value={o.quality} onChange={(quality) => set({ quality })}
              options={(['alta', 'media', 'leve'] as const).map((q) => ({ value: q, label: qualityLabels[q] }))}
            />
          </div>
        )}

        <div className="field">
          <span className="field-label">O que exportar</span>
          <Segmented label="Intervalo" value={o.range} onChange={(range) => set({ range })} options={rangeOptions} />
          {o.range === 'selection' && selectionRange && (
            <span className="fmt-hint">
              {timecode(selectionRange[0], project.fps)} → {timecode(selectionRange[1], project.fps)} (clips selecionados)
            </span>
          )}
          {o.range === 'custom' && (
            <div className="exp-row exp-range">
              <label className="field">
                <span className="field-label">De (s)</span>
                <input type="number" min={0} max={totalSec} step={0.1} value={o.fromSec}
                  onChange={(e) => set({ fromSec: Math.max(0, Number(e.target.value)) })} />
              </label>
              <label className="field">
                <span className="field-label">Até (s)</span>
                <input type="number" min={0} max={totalSec} step={0.1} value={o.toSec}
                  onChange={(e) => set({ toSec: Math.min(totalSec, Number(e.target.value)) })} />
              </label>
            </div>
          )}
        </div>

        {f.video && o.format !== 'gif' && (
          <label className="check">
            <input type="checkbox" checked={o.audio} onChange={(e) => set({ audio: e.target.checked })} />
            Incluir áudio
          </label>
        )}

        <div className="exp-summary">
          {f.video && <span>{size.width}×{size.height}</span>}
          {f.video && <span>{o.format === 'gif' ? Math.round(gifFps(project, o.quality)) : fps} fps</span>}
          <span>{invalid ? '—' : fmtDur(durSec)}</span>
          <span>{bytes != null && !invalid ? `~${formatBytes(bytes)}` : o.format === 'gif' ? 'tamanho variável' : ''}</span>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>Cancelar</button>
          <button className="btn primary" onClick={go} disabled={invalid}>Exportar…</button>
        </div>
      </div>
    </div>
  );
};
