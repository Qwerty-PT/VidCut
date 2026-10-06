import React from 'react';
import { useEditor } from '../editor-context';
import type { Project } from '../../shared/types';

/** Slider que agrupa o arrastar num único passo do histórico */
export const Range: React.FC<{ value: number; min: number; max: number; step: number; apply: (v: number) => (p: Project) => Project }> = ({ value, min, max, step, apply }) => {
  const { dispatch, commit } = useEditor();
  const dragging = React.useRef(false);
  return (
    <input
      type="range" min={min} max={max} step={step} value={value}
      onPointerDown={() => { dragging.current = true; dispatch({ type: 'beginGesture' }); }}
      onPointerUp={() => { dragging.current = false; dispatch({ type: 'endGesture' }); }}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (dragging.current) dispatch({ type: 'gesture', fn: apply(v) });
        else commit(apply(v));
      }}
    />
  );
};

export const Row: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <label className="field">
    <span className="field-label">{label}{hint && <em>{hint}</em>}</span>
    {children}
  </label>
);


/** Grupo de botões de escolha única */
export function Segmented<T extends string | number>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: React.ReactNode; title?: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} title={o.title} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
