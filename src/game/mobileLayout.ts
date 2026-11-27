// Positions are normalized to the available travel area (0..1), not device pixels.
export const CONTROL_IDS = ['left', 'right', 'jump', 'boost', 'brake', 'accel', 'ballCam', 'gauge'] as const;
export type ControlId = typeof CONTROL_IDS[number];
export type DrivingAction = Exclude<ControlId, 'ballCam' | 'gauge'>;
export type ControlPoint = { x: number; y: number };
export type MobileLayout = {
  version: 1;
  positions: Partial<Record<ControlId, ControlPoint>>;
  scale: number;
  opacity: number;
  leftHanded: boolean;
};
export type ControlRect = { x: number; y: number; width: number; height: number };
export type AreaSize = { width: number; height: number };
export const STORAGE_KEY = 'nitro-mobile-controls-layout-v1';
export const defaultLayout = (leftHanded = false): MobileLayout => ({
  version: 1, positions: {}, scale: 1, opacity: 1, leftHanded,
});
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function normalizeLayout(value: unknown): MobileLayout {
  if (!record(value) || value.version !== 1) return defaultLayout();
  const positions: MobileLayout['positions'] = {};
  if (record(value.positions)) {
    for (const id of CONTROL_IDS) {
      const point = value.positions[id];
      if (record(point) && finite(point.x) && finite(point.y)) {
        positions[id] = { x: clamp(point.x, 0, 1), y: clamp(point.y, 0, 1) };
      }
    }
  }
  return {
    version: 1, positions,
    scale: finite(value.scale) ? clamp(value.scale, 0.75, 1.35) : 1,
    opacity: finite(value.opacity) ? clamp(value.opacity, 0.35, 1) : 1,
    leftHanded: value.leftHanded === true,
  };
}

export function loadMobileLayout(): MobileLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeLayout(JSON.parse(raw)) : defaultLayout();
  } catch { return defaultLayout(); }
}

export function saveMobileLayout(layout: MobileLayout): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeLayout(layout)));
    return true;
  } catch { return false; }
}

export function controlRect(id: ControlId, layout: MobileLayout, area: AreaSize): ControlRect {
  const w = Math.max(0, area.width), h = Math.max(0, area.height);
  const gap = 10;
  const base = Math.max(44, Math.min(64, (h - gap) / 3, (w - 3 * gap) / 4));
  const b = Math.round(base * layout.scale);
  const width = Math.min(w, id === 'gauge' ? Math.round(b * 2.1) : id === 'ballCam' ? Math.round(b * 1.85) : b);
  const height = Math.min(h, id === 'gauge' ? Math.round(b * 1.2) : id === 'ballCam' ? Math.round(b * 0.7) : b);
  const maxX = Math.max(0, w - width), maxY = Math.max(0, h - height);
  let x = 0, y = maxY;
  switch (id) {
    case 'left': break;
    case 'right': x = b + gap; break;
    case 'jump': x = w - 2 * b - gap; y = h - 2 * b - gap; break;
    case 'boost': x = w - b; y = h - 2 * b - gap; break;
    case 'brake': x = w - 2 * b - gap; break;
    case 'accel': x = w - b; break;
    case 'ballCam': y = 0; break;
    case 'gauge':
      if (w >= 4 * b + 3 * gap + width) x = w - 2 * b - 2 * gap - width;
      else { x = (w - width) / 2; y = h - 2 * b - 2 * gap - height; }
      break;
  }
  if (layout.leftHanded) x = maxX - x;
  const point = layout.positions[id];
  return {
    x: point ? point.x * maxX : clamp(x, 0, maxX),
    y: point ? point.y * maxY : clamp(y, 0, maxY),
    width, height,
  };
}

export function positionFromPixels(x: number, y: number, rect: ControlRect, area: AreaSize): ControlPoint {
  return {
    x: clamp(x / Math.max(1, area.width - rect.width), 0, 1),
    y: clamp(y / Math.max(1, area.height - rect.height), 0, 1),
  };
}

export function overlappingControls(layout: MobileLayout, area: AreaSize): boolean {
  if (!area.width || !area.height) return false;
  const boxes = CONTROL_IDS.map(id => controlRect(id, layout, area));
  return boxes.some((a, i) => boxes.slice(i + 1).some(b =>
    a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y
  ));
}
