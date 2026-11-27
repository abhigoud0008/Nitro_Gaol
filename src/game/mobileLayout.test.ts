import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTROL_IDS, defaultLayout, normalizeLayout, controlRect, positionFromPixels, overlappingControls } from './mobileLayout';

test('invalid or old saved data falls back safely', () => {
  assert.deepEqual(normalizeLayout(null), defaultLayout());
  assert.deepEqual(normalizeLayout({ version: 2 }), defaultLayout());
  const clean = normalizeLayout({ version: 1, scale: 9, opacity: 0, positions: { boost: { x: 9, y: -1 }, left: { x: 'bad', y: 0 } } });
  assert.equal(clean.scale, 1.35); assert.equal(clean.opacity, 0.35);
  assert.deepEqual(clean.positions, { boost: { x: 1, y: 0 } });
});
test('all controls remain in bounds across viewport sizes', () => {
  for (const area of [{ width: 800, height: 260 }, { width: 320, height: 580 }, { width: 420, height: 140 }]) {
    for (const id of CONTROL_IDS) {
      const layout = normalizeLayout({ ...defaultLayout(), scale: 1.35, positions: { [id]: { x: 1, y: 1 } } });
      const r = controlRect(id, layout, area);
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= area.width + 0.001 && r.y + r.height <= area.height + 0.001);
    }
  }
});
test('dragged coordinates persist proportionally and are clamped', () => {
  const area = { width: 800, height: 260 };
  const rect = controlRect('boost', defaultLayout(), area);
  const point = positionFromPixels(200, 100, rect, area);
  const saved = normalizeLayout(JSON.parse(JSON.stringify({ ...defaultLayout(), positions: { boost: point } })));
  const restored = controlRect('boost', saved, area);
  assert.ok(Math.abs(restored.x - 200) < 0.001 && Math.abs(restored.y - 100) < 0.001);
  assert.deepEqual(positionFromPixels(-100, 999, rect, area), { x: 0, y: 1 });
});
test('left-handed preset mirrors the default controls', () => {
  const area = { width: 800, height: 260 };
  for (const id of CONTROL_IDS) {
    const a = controlRect(id, defaultLayout(), area), b = controlRect(id, defaultLayout(true), area);
    assert.equal(a.x + b.x + a.width, area.width); assert.equal(a.y, b.y);
  }
  assert.equal(overlappingControls(defaultLayout(), area), false);
});
