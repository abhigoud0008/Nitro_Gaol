import { useLayoutEffect, useRef, useState } from 'react';
import type { AreaSize } from '../game/mobileLayout';

// Reserve the score/utility row and respect display cutouts in both editor and match.
export const controlAreaStyle = {
  position: 'fixed' as const,
  top: 'max(76px, calc(env(safe-area-inset-top, 0px) + 64px))',
  left: 'max(12px, env(safe-area-inset-left, 0px))',
  right: 'max(12px, env(safe-area-inset-right, 0px))',
  bottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
};
export function useControlArea(active = true) {
  const ref = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState<AreaSize>({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const node = ref.current;
    if (!active || !node) return;
    const measure = () => {
      const r = node.getBoundingClientRect();
      setArea(old => old.width === r.width && old.height === r.height ? old : { width: r.width, height: r.height });
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(node);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [active]);
  return { ref, area };
}
