import { useRef } from 'react';
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Flame, MoveUp } from 'lucide-react';
import type { InputState } from '../game/types';

interface MobileControlsProps {
  onInputChange: (partial: Partial<InputState>) => void;
}

type ButtonAction = 'left' | 'right' | 'accel' | 'brake' | 'jump' | 'boost';

export function MobileControls({ onInputChange }: MobileControlsProps) {
  // Track active pointerId -> action for seamless simultaneous multi-touch
  const activePointers = useRef<Map<number, ButtonAction>>(new Map());

  const syncAggregate = (justJumped = false) => {
    const active = new Set(activePointers.current.values());
    const left = active.has('left');
    const right = active.has('right');
    const accel = active.has('accel');
    const brake = active.has('brake');
    const jump = active.has('jump');
    const boost = active.has('boost');

    onInputChange({
      steer: (left ? 1 : 0) + (right ? -1 : 0),
      throttle: (accel ? 1 : 0) + (brake ? -1 : 0),
      boost,
      jumpHeld: jump,
      jumpJustPressed: justJumped,
    });
  };

  const handlePointerDown =
    (action: ButtonAction) => (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore if unsupported
      }
      activePointers.current.set(e.pointerId, action);
      syncAggregate(action === 'jump');
    };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    activePointers.current.delete(e.pointerId);
    syncAggregate(false);
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex items-end justify-between p-4 sm:p-6"
      data-testid="mobile-controls"
      aria-label="Touch Driving Controls"
    >
      {/* Bottom-Left: Separate LEFT and RIGHT Directional Buttons (No Joystick) */}
      <div className="pointer-events-auto flex items-center gap-3 touch-none">
        <button
          type="button"
          aria-label="Steer Left"
          onPointerDown={handlePointerDown('left')}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
          className="flex h-16 w-16 select-none items-center justify-center rounded-xl border border-white/20 bg-[#090d16]/85 text-slate-100 active:bg-sky-500 active:text-slate-950 touch-none"
        >
          <ChevronLeft className="h-8 w-8" />
        </button>

        <button
          type="button"
          aria-label="Steer Right"
          onPointerDown={handlePointerDown('right')}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
          className="flex h-16 w-16 select-none items-center justify-center rounded-xl border border-white/20 bg-[#090d16]/85 text-slate-100 active:bg-sky-500 active:text-slate-950 touch-none"
        >
          <ChevronRight className="h-8 w-8" />
        </button>
      </div>

      {/* Bottom-Right: Acceleration, Brake, Jump, and Nitro Boost */}
      <div className="pointer-events-auto grid grid-cols-2 gap-2.5 touch-none">
        <button
          type="button"
          aria-label="Jump"
          onPointerDown={handlePointerDown('jump')}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
          className="flex h-14 w-16 flex-col items-center justify-center rounded-xl border border-white/20 bg-[#090d16]/85 text-slate-100 active:bg-slate-200 active:text-slate-950 touch-none"
        >
          <MoveUp className="h-5 w-5" />
          <span className="text-[10px] font-bold uppercase">Jump</span>
        </button>

        <button
          type="button"
          aria-label="Nitro Boost"
          onPointerDown={handlePointerDown('boost')}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
          className="flex h-14 w-16 flex-col items-center justify-center rounded-xl border border-amber-400/45 bg-amber-500/25 text-amber-200 active:bg-amber-400 active:text-slate-950 touch-none"
        >
          <Flame className="h-5 w-5" />
          <span className="text-[10px] font-bold uppercase">Boost</span>
        </button>

        <button
          type="button"
          aria-label="Brake or Reverse"
          onPointerDown={handlePointerDown('brake')}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
          className="flex h-16 w-16 flex-col items-center justify-center rounded-xl border border-rose-400/35 bg-[#090d16]/85 text-rose-200 active:bg-rose-500 active:text-white touch-none"
        >
          <ArrowDown className="h-5 w-5" />
          <span className="text-[10px] font-bold uppercase">Brake</span>
        </button>

        <button
          type="button"
          aria-label="Accelerate"
          onPointerDown={handlePointerDown('accel')}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
          className="flex h-16 w-16 flex-col items-center justify-center rounded-xl border border-sky-400/45 bg-sky-500/25 text-sky-200 active:bg-sky-400 active:text-slate-950 touch-none"
        >
          <ArrowUp className="h-5 w-5" />
          <span className="text-[10px] font-bold uppercase">Gas</span>
        </button>
      </div>
    </div>
  );
}
