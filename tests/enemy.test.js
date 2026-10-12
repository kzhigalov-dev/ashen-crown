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
    assert.equal(slime.hp, 24);
    assert.equal(slime.damage, 6);
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

test('волк, заметив героя, сначала замирает, потом бросается', () => {
    const wolf = new Enemy('wolf', 80, 32);
    const startX = wolf.x;
    run(wolf, 0.3, hero());
    assert.equal(wolf.chasing, true);
    assert.equal(wolf.phase, 'windup', 'замер и мигает — предупреждение');
    assert.equal(wolf.x, startX);
    run(wolf, 0.7, hero());
    assert.equal(wolf.facing, -1);
    assert.equal(wolf.phase, 'walk');
    assert.ok(startX - wolf.x > 40, `пробежал ${startX - wolf.x}`);
});

test('волк бежит медленнее героя — от него можно уйти', async () => {
    const { RUN_SPEED } = await import('../js/data/constants.js');
    const { ENEMIES } = await import('../js/data/enemies.js');
    assert.ok(ENEMIES.wolf.chaseSpeed < RUN_SPEED);
});

test('волк не видит героя за стеной', () => {
    // Между волком и героем блок высотой в один тайл.
    const walled = new Level({
        id: 'w', name: 'W',
        segments: [['............', '............', 'P...#......E', '############']],
    });
    const wolf = new Enemy('wolf', 112, 32);
    for (let i = 0; i < 60; i++) wolf.update(STEP, walled, hero());
    assert.equal(wolf.chasing, false);
    // Тот же волк по ту же сторону стены, что и герой, — видит.
    const near = new Enemy('wolf', 48, 32);
    for (let i = 0; i < 10; i++) near.update(STEP, walled, hero());
    assert.equal(near.chasing, true);
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
    assert.equal(slime.hp, 14);
    assert.ok(slime.stun > 0 && slime.flash > 0);
    assert.equal(slime.hit(10, 'a', 1), false);
    assert.equal(slime.hp, 14);
    assert.equal(slime.hit(10, 'b', 1), true);
    assert.equal(slime.hp, 4);
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

// ---------- Скелеты и бес ----------

// Ровная площадка шириной 12 тайлов.
const yard = new Level({
    id: 'y',
    name: 'Y',
    segments: [[
        '............',
        '............',
        'P..........E',
        '############',
    ]],
});

function runIn(level, enemy, seconds, player, each = () => {}) {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
        enemy.update(STEP, level, player);
        each(enemy.takeActions());
    }
}

test('скелет-мечник: замах 0,5 с, затем один удар в сторону героя', () => {
    const skeleton = new Enemy('skeleton', 80, 32);
    const player = hero({ x: 66 });   // вплотную слева
    const strikes = [];
    runIn(yard, skeleton, 0.3, player, (actions) => strikes.push(...actions));
    assert.equal(skeleton.phase, 'windup');
    assert.equal(strikes.length, 0, 'во время замаха урона нет');
    runIn(yard, skeleton, 0.3, player, (actions) => strikes.push(...actions));
    assert.equal(strikes.length, 1);
    assert.equal(strikes[0].type, 'strike');
    assert.equal(strikes[0].damage, 12);
    const center = skeleton.x + skeleton.w / 2;
    assert.ok(strikes[0].box.x + strikes[0].box.w <= center + 0.001, 'бьёт влево, где герой');
});

test('скелет-мечник: попадание сбивает замах', () => {
    const skeleton = new Enemy('skeleton', 80, 32);
    const player = hero({ x: 66 });
    const strikes = [];
    runIn(yard, skeleton, 0.2, player, (actions) => strikes.push(...actions));
    assert.equal(skeleton.phase, 'windup');
    skeleton.hit(5, 'a', 1);
    runIn(yard, skeleton, 0.25, FAR, (actions) => strikes.push(...actions));
    assert.equal(strikes.length, 0);
    assert.equal(skeleton.phase, 'walk');
});

test('скелет-мечник: без героя рядом патрулирует', () => {
    const skeleton = new Enemy('skeleton', 80, 32);
    const startX = skeleton.x;
    runIn(yard, skeleton, 1, FAR);
    assert.ok(Math.abs(skeleton.x - startX) > 20);
});

test('скелет-лучник: стоит и стреляет в сторону героя раз в 2,2 с', () => {
    const archer = new Enemy('skeletonArcher', 144, 32);
    const player = hero({ x: 20 });
    const shots = [];
    runIn(yard, archer, 4.5, player, (actions) => shots.push(...actions));
    assert.equal(archer.x, 147, 'не двигается');
    assert.equal(shots.length, 2);
    assert.deepEqual(
        { type: shots[0].type, kind: shots[0].kind, dir: shots[0].dir, damage: shots[0].damage },
        { type: 'shot', kind: 'enemyArrow', dir: -1, damage: 7 }
    );
});

test('скелет-лучник: не стреляет, пока не видит героя', () => {
    const archer = new Enemy('skeletonArcher', 144, 32);
    const shots = [];
    runIn(yard, archer, 5, FAR, (actions) => shots.push(...actions));
    assert.equal(shots.length, 0);
});

test('бес: летает возле точки появления и не падает', () => {
    const imp = new Enemy('imp', 80, 0);
    let minX = imp.x, maxX = imp.x, minY = imp.y, maxY = imp.y;
    runIn(yard, imp, 6, FAR, () => {
        minX = Math.min(minX, imp.x); maxX = Math.max(maxX, imp.x);
        minY = Math.min(minY, imp.y); maxY = Math.max(maxY, imp.y);
    });
    assert.ok(maxX - minX > 60 && maxX - minX <= 80.001, `размах по X ${maxX - minX}`);
    assert.ok(maxY - minY > 12 && maxY - minY <= 16.001, `размах по Y ${maxY - minY}`);
});

test('бес: стреляет огнём точно в героя', () => {
    const imp = new Enemy('imp', 80, 0);
    const player = hero({ x: 60, y: 26 });
    const shots = [];
    runIn(yard, imp, 3, player, (actions) => shots.push(...actions));
    assert.equal(shots.length, 1);
    assert.equal(shots[0].kind, 'fireball');
    assert.deepEqual(shots[0].target, { x: 65, y: 37 });
});

test('удар отбрасывает врага заметно: больше половины тайла', () => {
    const slime = new Enemy('slime', 48, 32);
    run(slime, 0.1);
    const before = slime.x;
    slime.hit(5, 'a', 1);
    run(slime, 0.4);
    assert.ok(slime.x - before > 20, `отлетел на ${slime.x - before}`);
});

test('отскок: враг, ранивший героя, уходит в сторону и на время безвреден', () => {
    const slime = new Enemy('slime', 64, 32);
    run(slime, 0.1);
    const before = slime.x;
    slime.recoil(1, 0.45);
    assert.ok(slime.stun > 0);
    run(slime, 0.3);
    assert.ok(slime.x > before + 15);
});
