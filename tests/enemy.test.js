import test from 'node:test';
import assert from 'node:assert/strict';
import { Enemy } from '../js/entities/Enemy.js';
import { Level } from '../js/Level.js';
import { STEP } from '../js/data/constants.js';

// Земля под колонками 0–6 (до x=112), дальше дыра в две колонки и снова земля.
const level = new Level({
    id: 't',
    name: 'T',
    segments: [[
        '............',
        '............',
        'P..........E',
        '#######..###',
        '............',
    ]],
});

// Герой-заглушка: врагу нужны только положение и признак смерти.
const hero = (props = {}) => ({ x: 3, y: 26, w: 10, h: 22, dead: false, ...props });
const FAR = hero({ y: -500 });

function run(enemy, seconds, player = FAR, each = () => {}) {
    for (let i = 0; i < seconds * 60; i++) {
        enemy.update(STEP, level, player);
        each(enemy);
    }
}

test('враг появляется ногами на низу тайла, по центру', () => {
    const slime = new Enemy('slime', 64, 32);
    assert.equal(slime.x, 65);
    assert.equal(slime.y, 38);
    assert.equal(slime.hp, 30);
    assert.equal(slime.damage, 10);
});

test('слизень разворачивается у стены', () => {
    const slime = new Enemy('slime', 64, 32);
    assert.equal(slime.facing, -1);
    run(slime, 4);
    assert.equal(slime.facing, 1);
    assert.ok(slime.x > 0);
});

test('слизень разворачивается у края и не падает', () => {
    const slime = new Enemy('slime', 64, 32);
    slime.facing = 1;
    let maxRight = 0;
    run(slime, 3, FAR, (e) => { maxRight = Math.max(maxRight, e.x + e.w); });
    assert.ok(maxRight <= 113, `правый край ${maxRight}`);
    assert.ok(maxRight > 105, 'дошёл до края');
    assert.equal(slime.facing, -1);
    assert.equal(slime.y, 38);
});

test('волк бросается на героя в поле зрения', () => {
    const wolf = new Enemy('wolf', 80, 32);
    const startX = wolf.x;
    run(wolf, 0.5, hero());
    assert.equal(wolf.chasing, true);
    assert.equal(wolf.facing, -1);
    assert.ok(startX - wolf.x > 40, `пробежал ${startX - wolf.x}`);
});

test('волк не видит героя на другой высоте и просто патрулирует', () => {
    const wolf = new Enemy('wolf', 80, 32);
    const startX = wolf.x;
    run(wolf, 0.5, FAR);
    assert.equal(wolf.chasing, false);
    assert.ok(Math.abs(startX - wolf.x) < 25);
});

test('волк не видит мёртвого героя', () => {
    const wolf = new Enemy('wolf', 80, 32);
    run(wolf, 0.2, hero({ dead: true }));
    assert.equal(wolf.chasing, false);
});

test('волк в погоне останавливается у края', () => {
    const wolf = new Enemy('wolf', 80, 32);
    let maxRight = 0;
    run(wolf, 2, hero({ x: 163 }), (e) => { maxRight = Math.max(maxRight, e.x + e.w); });
    assert.equal(wolf.chasing, true);
    assert.ok(maxRight <= 113, `правый край ${maxRight}`);
    assert.equal(wolf.y, 36);
});

test('попадание: урон, оглушение, мигание; тот же удар дважды не ранит', () => {
    const slime = new Enemy('slime', 64, 32);
    assert.equal(slime.hit(10, 'a', 1), true);
    assert.equal(slime.hp, 20);
    assert.ok(slime.stun > 0 && slime.flash > 0);
    assert.equal(slime.hit(10, 'a', 1), false);
    assert.equal(slime.hp, 20);
    assert.equal(slime.hit(10, 'b', 1), true);
    assert.equal(slime.hp, 10);
});

test('враг погибает и больше не получает урон', () => {
    const slime = new Enemy('slime', 64, 32);
    slime.hit(50, 'a', 1);
    assert.equal(slime.dead, true);
    assert.equal(slime.hp, 0);
    assert.equal(slime.hit(10, 'b', 1), false);
});

test('попадание отбрасывает врага', () => {
    const slime = new Enemy('slime', 48, 32);
    run(slime, 0.1);
    const before = slime.x;
    slime.hit(5, 'a', 1);
    run(slime, 0.1);
    assert.ok(slime.x > before + 3, `сдвиг ${slime.x - before}`);
});

test('отбрасывание не сталкивает врага с платформы', () => {
    const slime = new Enemy('slime', 64, 32);
    run(slime, 0.1);
    slime.x = 97;
    slime.hit(5, 'a', 1);
    run(slime, 0.3);
    assert.ok(slime.x + slime.w <= 113, `правый край ${slime.x + slime.w}`);
    assert.equal(slime.y, 38);
});
