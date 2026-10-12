import test from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE, SPRITES, GLYPHS, HEROES } from '../js/data/sprites.js';

const SIZES = {
    groundTop: [16, 16],
    ground: [16, 16],
    platform: [16, 6],
    spikes: [16, 8],
    coin: [8, 8],
    campfire: [10, 10],
    campfireOff: [10, 2],
    portal: [12, 16],
    sword: [3, 13],
    axe: [7, 14],
    spear: [3, 22],
    bow: [5, 14],
    shortbow: [4, 10],
    crossbow: [10, 7],
    staffFire: [5, 21],
    staffIce: [5, 21],
    staffStorm: [5, 21],
    thrust: [20, 3],
    quarrel: [7, 3],
    spearShot: [12, 3],
    shard: [7, 4],
    spark: [10, 3],
    slash: [12, 18],
    arrow: [8, 3],
    arrowBright: [8, 3],
    slime1: [14, 10],
    slime2: [14, 10],
    wolf1: [20, 12],
    wolf2: [20, 12],
    lootBag: [8, 8],
    fireball: [6, 6],
    imp1: [12, 12],
    imp2: [12, 12],
    treant: [16, 22],
    demon: [20, 20],
    heart: [7, 6],
    crown: [21, 12],
    iconArmor: [10, 10],
    iconAmulet: [8, 10],
};

test('есть все спрайты', () => {
    assert.deepEqual(Object.keys(SPRITES).sort(), Object.keys(SIZES).sort());
});

for (const [name, [width, height]] of Object.entries(SIZES)) {
    test(`спрайт ${name}: размер ${width}×${height}, символы из палитры`, () => {
        const rows = SPRITES[name];
        assert.equal(rows.length, height, 'число строк');
        rows.forEach((line, row) => {
            assert.equal(line.length, width, `ширина строки ${row}`);
            for (const char of line) {
                assert.ok(char in PALETTE, `символ "${char}" в строке ${row} отсутствует в палитре`);
            }
        });
    });
}

test('знаки мелкого шрифта: 3×5, есть все цифры', () => {
    for (let digit = 0; digit <= 9; digit++) assert.ok(GLYPHS[digit], `цифра ${digit}`);
    for (const [char, rows] of Object.entries(GLYPHS)) {
        assert.equal(rows.length, 5, `«${char}»: высота`);
        for (const line of rows) {
            assert.equal(line.length, 3, `«${char}»: ширина`);
            assert.match(line, /^[#.]+$/, `«${char}»: только # и точка`);
        }
    }
});

test('фигуры героев: у каждого класса семь кадров 16×24', () => {
    assert.deepEqual(Object.keys(HEROES).sort(), ['archer', 'mage', 'swordsman']);
    for (const [id, hero] of Object.entries(HEROES)) {
        assert.deepEqual(Object.keys(hero.frames).sort(), ['attack', 'fall', 'idle', 'jump', 'run1', 'run2', 'run3']);
        for (const [name, rows] of Object.entries(hero.frames)) {
            assert.equal(rows.length, 24, `${id}.${name}: высота`);
            rows.forEach((line, row) => {
                assert.equal(line.length, 16, `${id}.${name}: ширина строки ${row} «${line}»`);
                for (const char of line) assert.ok(char in PALETTE, `${id}.${name}: символ «${char}» в строке ${row}`);
            });
        }
    }
});

test('у каждого вида оружия и снаряда есть спрайт', async () => {
    const { WEAPONS, PROJECTILES } = await import('../js/data/weapons.js');
    for (const weapon of Object.values(WEAPONS)) assert.ok(SPRITES[weapon.sprite], `оружие ${weapon.id}`);
    for (const [id, shot] of Object.entries(PROJECTILES)) assert.ok(SPRITES[shot.sprite], `снаряд ${id}`);
});
