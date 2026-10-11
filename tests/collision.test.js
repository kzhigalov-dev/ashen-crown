import test from 'node:test';
import assert from 'node:assert/strict';
import { overlaps, moveAndCollide, touchesTile } from '../js/Collision.js';
import { Level, HAZARD } from '../js/Level.js';

// Тайл 16 px. Ряд 4 — земля (верх на y=64), платформа в (2,2), шипы в (3,3),
// стена в (5,3), потолок в (0,0).
const level = new Level({
    id: 't',
    name: 'T',
    segments: [[
        '#.....',
        'P....E',
        '..=...',
        '...^.#',
        '######',
    ]],
});

const body = (props) => ({ x: 0, y: 0, w: 10, h: 22, vx: 0, vy: 0, ...props });

test('overlaps: пересечение, отсутствие, касание краями', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    assert.equal(overlaps(a, { x: 5, y: 5, w: 10, h: 10 }), true);
    assert.equal(overlaps(a, { x: 20, y: 0, w: 10, h: 10 }), false);
    assert.equal(overlaps(a, { x: 10, y: 0, w: 10, h: 10 }), false);
});

test('moveAndCollide: приземление на землю', () => {
    const b = body({ x: 20, y: 40, vy: 120 });
    const hit = moveAndCollide(b, level, 0.1);
    assert.equal(b.y, 42);
    assert.equal(b.vy, 0);
    assert.equal(hit.onGround, true);
});

test('moveAndCollide: упор в стену справа', () => {
    const b = body({ x: 60, y: 40, vx: 120 });
    const hit = moveAndCollide(b, level, 0.1);
    assert.equal(b.x, 70);
    assert.equal(b.vx, 0);
    assert.equal(hit.hitWall, true);
});

test('moveAndCollide: левый край уровня — стена', () => {
    const b = body({ x: 2, y: 20, vx: -120 });
    const hit = moveAndCollide(b, level, 0.1);
    assert.equal(b.x, 0);
    assert.equal(hit.hitWall, true);
});

test('moveAndCollide: удар головой о потолок', () => {
    const b = body({ x: 2, y: 20, vy: -120 });
    const hit = moveAndCollide(b, level, 0.1);
    assert.equal(b.y, 16);
    assert.equal(b.vy, 0);
    assert.equal(hit.hitCeiling, true);
});

test('moveAndCollide: на платформу можно приземлиться сверху', () => {
    const b = body({ x: 34, y: 0, vy: 120 });
    const hit = moveAndCollide(b, level, 0.1);
    assert.equal(b.y, 10);
    assert.equal(hit.onGround, true);
});

test('moveAndCollide: сквозь платформу можно пройти снизу', () => {
    const b = body({ x: 34, y: 42, vy: -120 });
    const hit = moveAndCollide(b, level, 0.1);
    assert.equal(b.y, 30);
    assert.equal(hit.hitCeiling, false);
});

test('moveAndCollide: тело внутри платформы не «прилипает» к ней', () => {
    const b = body({ x: 34, y: 18, vy: 60 });
    const hit = moveAndCollide(b, level, 0.1);
    assert.equal(b.y, 24);
    assert.equal(hit.onGround, false);
});

test('touchesTile: шипы под телом', () => {
    assert.equal(touchesTile(body({ x: 50, y: 42 }), level, HAZARD), true);
    assert.equal(touchesTile(body({ x: 20, y: 42 }), level, HAZARD), false);
});
