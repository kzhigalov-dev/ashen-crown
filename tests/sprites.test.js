import test from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE, SPRITES, GLYPHS } from '../js/data/sprites.js';

const SIZES = {
    heroIdle: [12, 22],
    heroRun1: [12, 22],
    heroRun2: [12, 22],
    heroJump: [12, 22],
    groundTop: [16, 16],
    ground: [16, 16],
    platform: [16, 6],
    spikes: [16, 8],
    coin: [8, 8],
    campfire: [10, 10],
    campfireOff: [10, 2],
    portal: [12, 16],
    sword: [3, 12],
    bow: [4, 12],
    staff: [3, 16],
    slash: [12, 18],
    arrow: [8, 3],
    arrowBright: [8, 3],
    bolt: [6, 6],
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
