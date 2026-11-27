import { useState } from 'react';
import { MobileControls } from './MobileControls';
import { defaultLayout, overlappingControls } from '../game/mobileLayout';
import type { AreaSize, MobileLayout } from '../game/mobileLayout';

const noop = () => {};
interface Props {
  initialLayout: MobileLayout;
  onSave: (layout: MobileLayout) => boolean;
  onCancel: () => void;
}
export function ControlLayoutEditor({ initialLayout, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState(initialLayout);
  const [area, setArea] = useState<AreaSize>({ width: 0, height: 0 });
  const [error, setError] = useState('');
  const overlaps = overlappingControls(draft, area);
  const reset = (leftHanded = false) => {
    setDraft(defaultLayout(leftHanded)); setError('');
  };
  return (
    <div className="fixed inset-0 z-[60] bg-black/45" role="dialog" aria-modal="true" aria-label="Customize mobile controls">
      <MobileControls layout={draft} editMode onEdit={setDraft} onInputChange={noop}
        ballCam onToggleBallCam={noop} onAreaChange={setArea} />
      <div className="absolute inset-x-0 top-0 z-40 bg-[#090d16]/95 px-2 py-1.5 text-slate-100 shadow-xl" style={{ paddingTop: 'max(6px, env(safe-area-inset-top, 0px))', paddingLeft: 'max(8px, env(safe-area-inset-left, 0px))', paddingRight: 'max(8px, env(safe-area-inset-right, 0px))' }}>
        <div className="flex h-8 items-center gap-2 overflow-x-auto whitespace-nowrap">
          <strong className="text-xs text-sky-300">Customize Controls</strong>
          <span className="text-[10px] text-slate-300">Drag to move</span>
          <button type="button" className="rounded border border-white/20 px-2 py-1 text-xs" onClick={() => reset(true)}>Left-handed</button>
          <button type="button" className="rounded border border-white/20 px-2 py-1 text-xs" onClick={() => reset()}>Reset</button>
          <span className="flex-1" />
          <button type="button" className="rounded border border-white/20 px-2 py-1 text-xs" onClick={onCancel}>Cancel</button>
          <button type="button" className="rounded bg-sky-500 px-3 py-1 text-xs font-bold text-slate-950 disabled:opacity-40" disabled={!area.width || !area.height} onClick={() => {
            if (!onSave(draft)) setError('Browser storage is unavailable. Layout not saved.');
          }}>Save Layout</button>
        </div>
        <div className="flex h-7 items-center gap-3 overflow-x-auto whitespace-nowrap text-[10px]">
          <label className="flex items-center gap-1">Size {Math.round(draft.scale * 100)}%
            <input aria-label="Button size" type="range" min="0.75" max="1.35" step="0.05" value={draft.scale}
              onChange={e => setDraft(old => ({ ...old, scale: Number(e.target.value) }))} className="w-20 accent-sky-500" />
          </label>
          <label className="flex items-center gap-1">Opacity {Math.round(draft.opacity * 100)}%
            <input aria-label="Button opacity" type="range" min="0.35" max="1" step="0.05" value={draft.opacity}
              onChange={e => setDraft(old => ({ ...old, opacity: Number(e.target.value) }))} className="w-20 accent-sky-500" />
          </label>
          {overlaps && <span role="status" className="text-amber-300">Some controls overlap — move or shrink them.</span>}
          {error && <span role="alert" className="text-rose-300">{error}</span>}
        </div>
      </div>
    </div>
  );
}
