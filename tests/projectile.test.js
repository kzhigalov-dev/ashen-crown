import test from 'node:test';
import assert from 'node:assert/strict';
import { Projectile } from '../js/entities/Projectile.js';
import { Level } from '../js/Level.js';
import { STEP } from '../js/data/constants.js';

// Стена в колонке 9 (x от 144), земля в ряду 5.
const level = new Level({
    id: 't',
    name: 'T',
    segments: [[
        '..........',
        '..........',
        '.........#',
        'P.......E#',
        '.........#',
        '##########',
    ]],
});

function fly(projectile, count) {
    for (let i = 0; i < count && !projectile.dead; i++) projectile.update(STEP, level);
}

test('снаряд создаётся по центру точки и летит в сторону dir', () => {
    const bolt = new Projectile('bolt', 50, 40, 1, 16);
    assert.equal(bolt.x, 47);
    assert.equal(bolt.y, 37);
    fly(bolt, 18);
    assert.ok(Math.abs(bolt.x - 47 - 60) < 1, `сдвиг ${bolt.x - 47}`);
    assert.equal(bolt.y, 37, 'шар летит по прямой');
    assert.equal(bolt.damage, 16);
});

test('снаряд влево летит влево', () => {
    const bolt = new Projectile('bolt', 100, 40, -1, 16);
    fly(bolt, 10);
    assert.ok(bolt.x < 97);
});

test('стрела сначала поднимается, потом снижается', () => {
    const arrow = new Projectile('arrow', 20, 40, 1, 10);
    arrow.vx = 0;  // смотрим только высоту, чтобы стрела не долетела до стены
    const startY = arrow.y;
    fly(arrow, 6);
    assert.ok(arrow.y < startY, 'взлёт');
    fly(arrow, 30);
    assert.ok(arrow.y > startY, 'снижение');
});

test('снаряд гибнет о стену', () => {
    const bolt = new Projectile('bolt', 100, 40, 1, 16);
    fly(bolt, 60);
    assert.equal(bolt.dead, true);
    assert.ok(bolt.x + bolt.w >= 144 && bolt.x < 152, `остановился у стены: ${bolt.x}`);
});

test('снаряд гибнет по времени жизни', () => {
    const bolt = new Projectile('bolt', 20, 8, 1, 16);
    bolt.vx = 0;
    fly(bolt, 71);
    assert.equal(bolt.dead, false);
    fly(bolt, 3);
    assert.equal(bolt.dead, true);
});

test('пробивающая стрела помечена и у снарядов разные номера', () => {
    const a = new Projectile('piercingArrow', 20, 40, 1, 24);
    const b = new Projectile('arrow', 20, 40, 1, 10);
    assert.equal(a.pierce, true);
    assert.equal(b.pierce, false);
    assert.notEqual(a.id, b.id);
});
