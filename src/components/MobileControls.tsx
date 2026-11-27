import { useEffect, useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Flame, MoveUp, Camera } from 'lucide-react';
import type { InputState } from '../game/types';
import { CONTROL_IDS, controlRect, positionFromPixels } from '../game/mobileLayout';
import type { AreaSize, ControlId, DrivingAction, MobileLayout } from '../game/mobileLayout';
import { controlAreaStyle, useControlArea } from './ControlLayoutArea';

const BUTTONS = {
  left: { Icon: ChevronLeft, label: 'Left', aria: 'Steer Left', color: 'border-white/20 bg-[#090d16]/85 text-slate-100 active:bg-sky-500' },
  right: { Icon: ChevronRight, label: 'Right', aria: 'Steer Right', color: 'border-white/20 bg-[#090d16]/85 text-slate-100 active:bg-sky-500' },
  jump: { Icon: MoveUp, label: 'Jump', aria: 'Jump', color: 'border-white/20 bg-[#090d16]/85 text-slate-100 active:bg-slate-200' },
  boost: { Icon: Flame, label: 'Boost', aria: 'Nitro Boost', color: 'border-amber-400/45 bg-amber-500/25 text-amber-200 active:bg-amber-400' },
  brake: { Icon: ArrowDown, label: 'Brake', aria: 'Brake or Reverse', color: 'border-rose-400/35 bg-[#090d16]/85 text-rose-200 active:bg-rose-500' },
  accel: { Icon: ArrowUp, label: 'Gas', aria: 'Accelerate', color: 'border-sky-400/45 bg-sky-500/25 text-sky-200 active:bg-sky-400' },
  ballCam: { Icon: Camera, label: 'Ball Cam', aria: 'Toggle Ball Camera', color: 'border-sky-400/50 bg-[#090d16]/90 text-sky-300' },
} as const;
const NEUTRAL: Partial<InputState> = { steer: 0, throttle: 0, boost: false, jumpHeld: false, jumpJustPressed: false };

interface MobileControlsProps {
  layout: MobileLayout;
  onInputChange: (partial: Partial<InputState>) => void;
  ballCam: boolean;
  onToggleBallCam: () => void;
  editMode?: boolean;
  onEdit?: (next: MobileLayout) => void;
  onAreaChange?: (area: AreaSize) => void;
}

export function MobileControls({ layout, onInputChange, ballCam, onToggleBallCam, editMode = false, onEdit, onAreaChange }: MobileControlsProps) {
  const { ref, area } = useControlArea();
  const activePointers = useRef(new Map<number, DrivingAction>());
  const drag = useRef<{ id: ControlId; pointerId: number; dx: number; dy: number } | null>(null);

  useEffect(() => {
    if (editMode) return;
    const clear = () => { activePointers.current.clear(); onInputChange(NEUTRAL); };
    const visibility = () => { if (document.hidden) clear(); };
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', visibility);
      clear();
    };
  }, [editMode, onInputChange]);

  useEffect(() => { onAreaChange?.(area); }, [area, onAreaChange]);

  const sync = (justJumped = false) => {
    const active = new Set(activePointers.current.values());
    onInputChange({
      steer: Number(active.has('left')) - Number(active.has('right')),
      throttle: Number(active.has('accel')) - Number(active.has('brake')),
      boost: active.has('boost'), jumpHeld: active.has('jump'), jumpJustPressed: justJumped,
    });
  };
  const down = (id: ControlId, e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!editMode && (id === 'ballCam' || id === 'gauge')) return;
    e.preventDefault();
    if (editMode) {
      if (drag.current) return;
      const r = e.currentTarget.getBoundingClientRect();
      drag.current = { id, pointerId: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
    } else {
      if (id === 'ballCam' || id === 'gauge') return;
      activePointers.current.set(e.pointerId, id);
      sync(id === 'jump');
    }
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer capture unavailable */ }
  };
  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current, root = ref.current;
    if (!editMode || !d || !root || d.pointerId !== e.pointerId) return;
    const r = root.getBoundingClientRect();
    const rect = controlRect(d.id, layout, area);
    const point = positionFromPixels(e.clientX - r.left - d.dx, e.clientY - r.top - d.dy, rect, area);
    onEdit?.({ ...layout, positions: { ...layout.positions, [d.id]: point } });
  };
  const up = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (editMode) {
      if (drag.current?.pointerId === e.pointerId) drag.current = null;
    } else if (activePointers.current.delete(e.pointerId)) sync();
  };

  return (
    <div ref={ref} style={controlAreaStyle} className="pointer-events-none z-30" data-testid="mobile-controls" aria-label={editMode ? 'Draggable control layout' : 'Touch Driving Controls'}>
      {area.width > 0 && area.height > 0 && CONTROL_IDS.filter(id => editMode || id !== 'gauge').map(id => {
        const r = controlRect(id, layout, area);
        const style: CSSProperties = { position: 'absolute', left: r.x, top: r.y, width: r.width, height: r.height, opacity: layout.opacity };
        const button = id === 'gauge' ? null : BUTTONS[id];
        const Icon = button?.Icon;
        return (
          <button key={id} type="button" tabIndex={editMode || id === 'ballCam' ? 0 : -1}
            aria-label={editMode ? 'Move ' + (button?.label ?? 'Speed and Nitro gauge') : button?.aria}
            style={style}
            onPointerDown={e => down(id, e)} onPointerMove={move} onPointerUp={up}
            onPointerCancel={up} onLostPointerCapture={up}
            onContextMenu={e => e.preventDefault()}
            onClick={id === 'ballCam' && !editMode ? onToggleBallCam : undefined}
            className={'pointer-events-auto flex select-none touch-none items-center justify-center gap-0.5 rounded-xl border ' +
              (id === 'ballCam' ? 'flex-row ' : 'flex-col ') +
              (button?.color ?? 'border-white/20 bg-[#090d16]/90 text-white') +
              (editMode ? ' cursor-move outline outline-1 outline-sky-300' : '') +
              (id === 'ballCam' && !ballCam ? ' !text-slate-300' : '')}>
            {id === 'gauge' ? <><span className="text-xs font-bold text-white">0 km/h</span><span className="text-[10px] font-bold text-amber-300">45 NITRO</span></> : <>
              {Icon && <Icon aria-hidden="true" style={{ width: Math.min(28, r.width * 0.38), height: Math.min(28, r.height * 0.42) }} />}
              {id !== 'left' && id !== 'right' && <span className="text-[10px] font-bold uppercase">{id === 'ballCam' && !ballCam ? 'Car Cam' : button?.label}</span>}
            </>}
          </button>
        );
      })}
    </div>
  );
}
