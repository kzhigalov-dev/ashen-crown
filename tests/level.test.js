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

test('Уровень «Проклятый лес» собирается и содержит всё нужное', () => {
    const level = new Level(LEVELS[0]);
    assert.equal(level.id, 'forest');
    assert.equal(level.rows, 17);
    assert.equal(level.cols, 160);
    assert.equal(level.coins.length, 20);
    assert.equal(level.checkpoints.length, 2);
});
