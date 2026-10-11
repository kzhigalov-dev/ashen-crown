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
};

test('есть все спрайты этапа 1', () => {
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
