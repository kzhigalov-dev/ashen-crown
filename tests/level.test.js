import test from 'node:test';
import assert from 'node:assert/strict';
import { Level, joinSegments, EMPTY, SOLID, ONEWAY, HAZARD } from '../js/Level.js';
import { LEVELS, WORLDS, LEVELS_PER_WORLD } from '../js/data/levels.js';

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

// ---------- Пятнадцать уровней ----------

const BOSSES = ['treant', 'knight', 'demon'];
const FOES = {
    forest: ['slime', 'wolf'],
    castle: ['skeleton', 'skeletonArcher'],
    dungeon: ['skeleton', 'imp'],
};

// Верхняя твёрдая строка в колонке — высота земли.
function groundRow(level, col) {
    for (let row = 0; row < level.rows; row++) {
        if (level.tileAt(col, row) === SOLID) return row;
    }
    return null;
}

test('три мира по пять уровней, номера и сила врагов растут', () => {
    assert.equal(WORLDS.length, 3);
    assert.equal(LEVELS.length, 15);
    assert.equal(new Set(LEVELS.map((level) => level.id)).size, 15, 'id не повторяются');
    for (const world of WORLDS) {
        const levels = LEVELS.filter((level) => level.world === world.id);
        assert.equal(levels.length, LEVELS_PER_WORLD);
        assert.deepEqual(levels.map((level) => level.number), [1, 2, 3, 4, 5]);
        assert.equal(new Set(levels.map((level) => level.name)).size, 5, `${world.id}: названия уровней разные`);
        for (let i = 1; i < levels.length; i++) assert.ok(levels[i].power > levels[i - 1].power);
        assert.equal(levels[0].power, 1);
        assert.equal(levels[0].worldName, world.name);
    }
});

test('уровни одного мира отличаются составом участков', () => {
    for (const world of WORLDS) {
        const layouts = world.levels.map((level) => level.parts.join('>'));
        assert.equal(new Set(layouts).size, LEVELS_PER_WORLD, world.id);
        for (const level of world.levels) {
            for (const part of level.parts) assert.ok(world.parts[part], `${world.id}: участок ${part} описан`);
            assert.equal(level.parts[0], 'start');
            assert.ok(['exit', 'arena'].includes(level.parts.at(-1)));
        }
    }
});

test('каждый уровень собирается: герой, портал, костёр, золото', () => {
    for (const def of LEVELS) {
        const level = new Level(def);
        assert.equal(level.rows, 17, def.id);
        assert.equal(level.cols, def.segments.length * 20, def.id);
        assert.ok(level.checkpoints.length >= 1 && level.checkpoints.length <= 2, `${def.id}: костров ${level.checkpoints.length}`);
        assert.ok(level.coins.length >= 8, `${def.id}: монет ${level.coins.length}`);
        assert.ok(level.exit.x > level.width - 20 * 16, `${def.id}: портал в последнем участке`);
        assert.ok(level.spawn.x < 20 * 16, `${def.id}: герой появляется в первом участке`);
    }
});

test('страж — только на пятом уровне мира, в последнем участке, перед порталом', () => {
    for (const def of LEVELS) {
        const level = new Level(def);
        const bosses = level.enemies.filter((enemy) => BOSSES.includes(enemy.type));
        if (def.number < LEVELS_PER_WORLD) {
            assert.equal(def.boss, null, def.id);
            assert.equal(bosses.length, 0, `${def.id}: стражей нет`);
            continue;
        }
        const world = WORLDS.find((item) => item.id === def.world);
        assert.equal(def.boss, world.boss);
        assert.deepEqual(bosses.map((enemy) => enemy.type), [world.boss]);
        assert.ok(bosses[0].x >= level.width - 20 * 16, `${def.id}: страж в арене`);
        assert.ok(level.exit.x > bosses[0].x, `${def.id}: портал за стражем`);
    }
});

test('в каждом мире живут свои враги', () => {
    for (const def of LEVELS) {
        const level = new Level(def);
        const foes = level.enemies.filter((enemy) => !BOSSES.includes(enemy.type));
        assert.ok(foes.length >= 3, `${def.id}: врагов ${foes.length}`);
        for (const enemy of foes) assert.ok(FOES[def.world].includes(enemy.type), `${def.id}: ${enemy.type}`);
    }
});

test('участки стыкуются по высоте: земля не обрывается ступенью на границе', () => {
    for (const def of LEVELS) {
        const level = new Level(def);
        for (let edge = 20; edge < level.cols; edge += 20) {
            const left = groundRow(level, edge - 1);
            const right = groundRow(level, edge);
            assert.equal(left, right, `${def.id}: стык на колонке ${edge} (${left} и ${right})`);
        }
    }
});

test('у каждого мира есть оформление, у каждого уровня — сюжетный текст', async () => {
    const { STORY, LORE, PROLOGUE, EPILOGUE } = await import('../js/data/story.js');
    for (const world of WORLDS) {
        assert.ok(world.theme.skyTop && world.theme.skyBottom && world.theme.far && world.theme.near, `${world.id}: цвета`);
        assert.ok(['trees', 'columns'].includes(world.theme.backdrop), `${world.id}: фон`);
        assert.ok(LORE[world.id].length >= 8, `${world.id}: записок хватает на все костры`);
        assert.equal(new Set(LORE[world.id]).size, LORE[world.id].length, `${world.id}: записки не повторяются`);
    }
    for (const def of LEVELS) assert.ok(STORY[def.id]?.length > 30, `${def.id}: текст перед уровнем`);
    assert.ok(PROLOGUE.length >= 2 && EPILOGUE.length >= 2);
});
