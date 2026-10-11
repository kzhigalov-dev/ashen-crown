import test from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE, SPRITES } from '../js/data/sprites.js';

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
