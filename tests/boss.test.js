import test from 'node:test';
import assert from 'node:assert/strict';
import { Boss } from '../js/entities/Boss.js';
import { Level } from '../js/Level.js';
import { STEP } from '../js/data/constants.js';

// Закрытая арена 20×8 тайлов, пол на y = 96.
const arena = new Level({
    id: 'a',
    name: 'A',
    segments: [[
        '####################',
        '#..................#',
        '#..................#',
        '#..................#',
        '#..................#',
        '#P................E#',
        '####################',
    ]],
});
const FLOOR = 96;

const hero = (props = {}) => ({ x: 40, y: FLOOR - 22, w: 10, h: 22, dead: false, ...props });

// Прогоняет босса и собирает все его действия.
function run(boss, seconds, player) {
    const actions = [];
    for (let i = 0; i < Math.round(seconds * 60); i++) {
        boss.update(STEP, arena, player);
        actions.push(...boss.takeActions());
    }
    return actions;
}

const ofType = (actions, type) => actions.filter((action) => action.type === type);

test('босс спит, пока герой далеко, и просыпается у входа на арену', () => {
    for (const type of ['treant', 'knight', 'demon']) {
        const boss = new Boss(type, 240, 80);
        const startX = boss.x;
        const far = hero({ x: -400 });
        const actions = run(boss, 8, far);
        assert.equal(boss.awake, false, type);
        assert.equal(actions.length, 0, `${type}: спящий не атакует`);
        assert.equal(boss.x, startX, `${type}: спящий не двигается`);
        run(boss, 0.1, hero({ x: 60 }));
        assert.equal(boss.awake, true, type);
    }
});

test('Рыцарь не покидает арену', () => {
    const boss = new Boss('knight', 240, 80);
    boss.awake = true;
    const lure = hero({ x: -400 });   // герой далеко слева за ареной
    let minX = boss.x;
    for (let i = 0; i < 60 * 20; i++) {
        boss.update(STEP, arena, lure);
        boss.takeActions();
        minX = Math.min(minX, boss.x);
    }
    assert.ok(minX >= boss.minX - 4, `ушёл до ${minX}, граница ${boss.minX}`);
});

test('Демон держится сбоку от героя, а не над ним', () => {
    const boss = new Boss('demon', 240, 80);
    const player = hero({ x: 150 });
    run(boss, 10, player);
    const gap = Math.abs(boss.x + boss.w / 2 - 155);
    assert.ok(gap > 60 && gap < 80, `расстояние по горизонтали ${gap}`);
});

test('босс не оглушается и не отбрасывается, тот же удар дважды не ранит', () => {
    const boss = new Boss('treant', 160, 80);
    assert.equal(boss.hit(20, 'a', 1), true);
    assert.equal(boss.hp, 240);
    assert.equal(boss.stun, 0);
    assert.ok(boss.flash > 0);
    assert.equal(boss.hit(20, 'a', 1), false);
});

test('вторая фаза начинается с половины здоровья и ускоряет атаки', () => {
    const boss = new Boss('treant', 160, 80);
    assert.equal(boss.phase2, false);
    assert.equal(boss.attackRate, 2.4);
    boss.hit(130, 'a', 1);
    assert.equal(boss.phase2, true);
    assert.equal(boss.attackRate, 1.6);
});

test('Древо: стоит на полу и бьёт корнями под героем с предупреждением', () => {
    const boss = new Boss('treant', 160, 80);
    const player = hero({ x: 60 });
    const actions = run(boss, 2, player);
    assert.equal(boss.y + boss.h, FLOOR);
    const roots = ofType(actions, 'hazard');
    assert.equal(roots.length, 1, 'первая атака через 1,5 с');
    assert.equal(roots[0].kind, 'root');
    assert.equal(roots[0].x + roots[0].w / 2, 65, 'под серединой героя');
    assert.equal(roots[0].bottom, FLOOR);
    assert.ok(roots[0].delay >= 0.5, 'есть время отойти');
    assert.equal(roots[0].damage, 11);
});

test('Древо: во второй фазе корней больше', () => {
    const count = (damage) => {
        const boss = new Boss('treant', 160, 80);
        if (damage) boss.hit(damage, 'a', 1);
        return ofType(run(boss, 10, hero()), 'hazard').length;
    };
    assert.ok(count(200) > count(0));
});

test('Древо: призывает слизней рядом с собой, со стороны героя', () => {
    const boss = new Boss('treant', 160, 80);
    const summons = ofType(run(boss, 8.5, hero()), 'summon');
    assert.equal(summons.length, 1);
    assert.equal(summons[0].enemy, 'slime');
    assert.ok(summons[0].x < boss.x, 'герой слева — слизень появляется слева');
    assert.equal(summons[0].y, FLOOR - 16);
});

test('Рыцарь: идёт к герою', () => {
    const boss = new Boss('knight', 240, 80);
    const startX = boss.x;
    run(boss, 1, hero());
    assert.ok(boss.x < startX - 20);
    assert.equal(boss.facing, -1);
});

test('Рыцарь: после замаха делает рывок ограниченной длины', () => {
    const boss = new Boss('knight', 240, 80);
    const player = hero();
    run(boss, 1.6, player);
    assert.equal(boss.state, 'windup', 'первая атака — рывок, сначала замах');
    const before = boss.x;
    run(boss, 0.3, player);
    assert.equal(boss.x, before, 'во время замаха стоит');
    run(boss, 1.2, player);
    const flown = before - boss.x;
    assert.ok(flown > 90 && flown < 125, `пролетел ${flown}: от рывка можно отбежать`);
});

test('Рыцарь: вторая атака — прыжок, при приземлении ударная волна в обе стороны', () => {
    const boss = new Boss('knight', 240, 80);
    const player = hero({ x: 150 });
    const actions = run(boss, 7, player);
    const waves = ofType(actions, 'hazard').filter((action) => action.kind === 'shock');
    assert.ok(waves.length >= 2);
    const [left, right] = waves;
    assert.equal(left.delay, 0, 'волна бьёт сразу');
    assert.ok(left.x + left.w <= right.x, 'две волны по разные стороны');
    assert.equal(left.bottom, FLOOR);
});

test('Демон: парит над полом и следует за героем', () => {
    const boss = new Boss('demon', 240, 80);
    const player = hero({ x: 40 });
    const startX = boss.x;
    let minBottom = Infinity, maxBottom = -Infinity;
    for (let i = 0; i < 600; i++) {
        boss.update(STEP, arena, player);
        boss.takeActions();
        minBottom = Math.min(minBottom, boss.y + boss.h);
        maxBottom = Math.max(maxBottom, boss.y + boss.h);
    }
    assert.ok(boss.x < startX - 50, 'сместился к герою');
    assert.ok(maxBottom <= FLOOR - 17, `нижняя точка ${FLOOR - maxBottom} над полом`);
    assert.ok(minBottom >= FLOOR - 51);
    assert.ok(FLOOR - maxBottom < 30, 'опускается под удар меча');
});

test('Демон: залп из 3 шаров, во второй фазе из 5; чередуется со столбами', () => {
    const boss = new Boss('demon', 240, 80);
    const player = hero({ x: 100 });
    const first = run(boss, 2, player);
    assert.equal(ofType(first, 'shot').length, 3);
    assert.equal(ofType(first, 'shot')[1].target.x, 105, 'средний шар — точно в героя');
    const second = run(boss, 2.6, player);
    const pillars = ofType(second, 'hazard');
    assert.equal(pillars.length, 3);
    assert.equal(pillars[0].kind, 'pillar');
    assert.ok(pillars[0].delay >= 0.5);

    // Пауза перед этой атакой была назначена ещё в первой фазе (2,6 с).
    boss.hit(300, 'a', 1);
    const third = run(boss, 2.6, player);
    assert.equal(ofType(third, 'shot').length, 5);
});

test('боссы не атакуют погибшего героя', () => {
    for (const type of ['treant', 'knight', 'demon']) {
        const boss = new Boss(type, 240, 80);
        const actions = run(boss, 6, hero({ dead: true }));
        assert.equal(actions.filter((action) => action.type !== 'summon').length, 0, type);
    }
});
