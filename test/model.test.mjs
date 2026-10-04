import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampPan, validAnnotation } from '../dist/model.js';
import { ZoomableImage, defineZoomableImage } from '../dist/index.js';
test('server-side import and registration are safe without DOM', () => {
  assert.equal(typeof ZoomableImage, 'function');
  assert.doesNotThrow(() => defineZoomableImage());
});
test('percentage annotations reject invalid coordinates and unsafe tooltip types', () => {
  const region = { id: 'a', x: 90, y: 0, width: 10, height: 100, text: 'Region' };
  assert.equal(validAnnotation(region), true);
  for (const patch of [{ x: NaN }, { width: 11 }, { height: 0 }, { y: -1 }, { tooltip: {} }])
    assert.equal(validAnnotation({ ...region, ...patch }), false);
});
test('panning cannot move the image beyond the viewport edges', () => {
  assert.deepEqual(clampPan(1000, -1000, 800, 600, 2, 1000, 800), { x: 300, y: -200 });
  assert.deepEqual(clampPan(10, 10, 800, 600, 0.5, 1000, 800), { x: 0, y: 0 });
});
test('registration is idempotent and rejects unrelated elements', () => {
  const definitions = new Map();
  const registry = {
    get: (name) => definitions.get(name),
    define: (name, value) => definitions.set(name, value)
  };
  defineZoomableImage('zoomable-image', registry);
  assert.doesNotThrow(() => defineZoomableImage('zoomable-image', registry));
  definitions.set('other-image', class {});
  assert.throws(() => defineZoomableImage('other-image', registry), /already defined/);
});
