import test from 'node:test';
import assert from 'node:assert/strict';
import { Level, joinSegments, EMPTY, SOLID, ONEWAY, HAZARD } from '../js/Level.js';
import { LEVELS } from '../js/data/levels.js';

const def = {
    id: 't',
    name: 'Test',
    segments: [[
        'P..o',
        '.=.E',
        '#^C#',
    ]],
};

test('Level: размеры в тайлах и пикселях', () => {
    const level = new Level(def);
    assert.equal(level.cols, 4);
    assert.equal(level.rows, 3);
    assert.equal(level.width, 64);
    assert.equal(level.height, 48);
});

test('Level: символы превращаются в типы тайлов', () => {
    const level = new Level(def);
    assert.equal(level.tileAt(0, 2), SOLID);
    assert.equal(level.tileAt(1, 1), ONEWAY);
    assert.equal(level.tileAt(1, 2), HAZARD);
    assert.equal(level.tileAt(0, 0), EMPTY, 'точка появления — пустой тайл');
    assert.equal(level.charAt(1, 2), '^');
});

test('Level: за боковыми краями стена, сверху и снизу пусто', () => {
    const level = new Level(def);
    assert.equal(level.tileAt(-1, 0), SOLID);
    assert.equal(level.tileAt(4, 0), SOLID);
    assert.equal(level.tileAt(0, -1), EMPTY);
    assert.equal(level.tileAt(0, 3), EMPTY);
});

test('Level: точки объектов в пикселях', () => {
    const level = new Level(def);
    assert.deepEqual(level.spawn, { x: 0, y: 0, w: 16, h: 16 });
    assert.deepEqual(level.exit, { x: 48, y: 16, w: 16, h: 16 });
    assert.deepEqual(level.coins, [{ x: 48, y: 0, w: 16, h: 16 }]);
    assert.deepEqual(level.checkpoints, [{ x: 32, y: 32, w: 16, h: 16 }]);
});

test('Level: враги на карте', () => {
    const level = new Level({ id: 'e', name: 'E', segments: [['P.s.wE', '######']] });
    assert.deepEqual(level.enemies, [
        { type: 'slime', x: 32, y: 0, w: 16, h: 16 },
        { type: 'wolf', x: 64, y: 0, w: 16, h: 16 },
    ]);
    assert.equal(level.tileAt(2, 0), EMPTY);
});

test('Level: новые враги, боссы и огненные столбы', () => {
    const level = new Level({ id: 'e', name: 'E', segments: [['PzaiTKDfE', '#########']] });
    assert.deepEqual(
        level.enemies.map((enemy) => enemy.type),
        ['skeleton', 'skeletonArcher', 'imp', 'treant', 'knight', 'demon']
    );
    assert.deepEqual(level.pillars, [{ x: 112, y: 0, w: 16, h: 16 }]);
});

test('joinSegments: склеивает сегменты по горизонтали', () => {
    assert.deepEqual(joinSegments([['ab', 'cd'], ['e', 'f']]), ['abe', 'cdf']);
});

test('joinSegments: ошибка при разной высоте сегментов', () => {
    assert.throws(() => joinSegments([['ab', 'cd'], ['e']]), /Segment 1/);
});

test('joinSegments: ошибка при разной длине строк сегмента', () => {
    assert.throws(() => joinSegments([['ab', 'c']]), /row 1/);
});

test('Level: ошибка на неизвестном символе', () => {
    assert.throws(() => new Level({ id: 'x', name: 'X', segments: [['P?E']] }), /"\?"/);
});

test('Level: ошибка без точки появления или выхода', () => {
    assert.throws(() => new Level({ id: 'x', name: 'X', segments: [['..E']] }), /spawn/);
    assert.throws(() => new Level({ id: 'x', name: 'X', segments: [['P..']] }), /exit/);
});

test('все три локации собираются и содержат всё нужное', () => {
    const summary = LEVELS.map((def) => {
        const level = new Level(def);
        const count = (type) => level.enemies.filter((enemy) => enemy.type === type).length;
        return {
            id: level.id,
            rows: level.rows,
            cols: level.cols,
            coins: level.coins.length,
            checkpoints: level.checkpoints.length,
            boss: level.enemies.filter((enemy) => ['treant', 'knight', 'demon'].includes(enemy.type)).map((enemy) => enemy.type),
            foes: level.enemies.length - 1,
            pillars: level.pillars.length,
            imps: count('imp'),
        };
    });
    assert.deepEqual(summary, [
        { id: 'forest', rows: 17, cols: 180, coins: 20, checkpoints: 2, boss: ['treant'], foes: 8, pillars: 0, imps: 0 },
        { id: 'castle', rows: 17, cols: 140, coins: 13, checkpoints: 2, boss: ['knight'], foes: 7, pillars: 0, imps: 0 },
        { id: 'dungeon', rows: 17, cols: 160, coins: 12, checkpoints: 2, boss: ['demon'], foes: 6, pillars: 4, imps: 3 },
    ]);
});

test('у каждой локации есть оформление, сюжетный текст и записки для всех костров', async () => {
    const { STORY, LORE, PROLOGUE, EPILOGUE } = await import('../js/data/story.js');
    for (const def of LEVELS) {
        const level = new Level(def);
        assert.ok(def.theme.sky && def.theme.far && def.theme.near, `${def.id}: цвета`);
        assert.ok(['trees', 'columns'].includes(def.theme.backdrop), `${def.id}: фон`);
        assert.ok(STORY[def.id].length > 50, `${def.id}: текст`);
        assert.equal(LORE[def.id].length, level.checkpoints.length, `${def.id}: записка на каждый костёр`);
    }
    assert.ok(PROLOGUE.length >= 2 && EPILOGUE.length >= 2);
});

test('босс стоит в последнем сегменте, портал — за ним', () => {
    for (const def of LEVELS) {
        const level = new Level(def);
        const boss = level.enemies.at(-1);
        assert.ok(boss.x >= level.width - 20 * 16, `${def.id}: босс в арене`);
        assert.equal(boss.type, def.boss, `${def.id}: поле boss совпадает с картой`);
        assert.ok(level.exit.x > boss.x, `${def.id}: портал за боссом`);
    }
});
