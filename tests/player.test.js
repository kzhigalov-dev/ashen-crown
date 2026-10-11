import test from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../js/entities/Player.js';
import { Level } from '../js/Level.js';
import { STEP } from '../js/data/constants.js';

const flat = new Level({
    id: 'flat',
    name: 'Flat',
    segments: [[
        '..........',
        '..........',
        '..........',
        '..........',
        'P........E',
        '##########',
    ]],
});

// Земля только под первыми пятью тайлами (до x=80), дальше обрыв.
const ledge = new Level({
    id: 'ledge',
    name: 'Ledge',
    segments: [[
        '..........',
        '..........',
        '..........',
        'P........E',
        '#####.....',
    ]],
});

function input(down = [], pressed = []) {
    const d = new Set(down);
    const p = new Set(pressed);
    return { isDown: (a) => d.has(a), wasPressed: (a) => p.has(a) };
}

const NONE = input();
const HOLD_JUMP = input(['jump']);
const PRESS_JUMP = input(['jump'], ['jump']);

function settled(level) {
    const player = new Player();
    player.placeAt(level.spawn);
    player.update(STEP, NONE, level);
    return player;
}

function steps(player, level, count, inp = NONE) {
    for (let i = 0; i < count; i++) player.update(STEP, inp, level);
}

test('placeAt: герой стоит на низу тайла по центру', () => {
    const player = new Player();
    player.placeAt(flat.spawn);
    assert.equal(player.x, 3);
    assert.equal(player.y, 58);
});

test('стоит на земле', () => {
    const player = settled(flat);
    assert.equal(player.onGround, true);
    assert.equal(player.y, 58);
    assert.equal(player.state, 'idle');
});

test('бежит вправо со скоростью 110 px/с', () => {
    const player = settled(flat);
    const startX = player.x;
    steps(player, flat, 60, input(['right']));
    assert.ok(Math.abs(player.x - startX - 110) < 1, `сдвиг ${player.x - startX}`);
    assert.equal(player.facing, 1);
    assert.equal(player.state, 'run');
});

test('смотрит влево при движении влево', () => {
    const player = settled(flat);
    player.x = 80;
    steps(player, flat, 5, input(['left']));
    assert.equal(player.facing, -1);
    assert.ok(player.x < 80);
});

test('полный прыжок поднимает примерно на 3 тайла', () => {
    const player = settled(flat);
    let minY = player.y;
    player.update(STEP, PRESS_JUMP, flat);
    assert.ok(player.vy < 0, 'прыжок начался');
    assert.equal(player.state, 'jump');
    for (let i = 0; i < 60; i++) {
        player.update(STEP, HOLD_JUMP, flat);
        minY = Math.min(minY, player.y);
    }
    const peak = 58 - minY;
    assert.ok(peak > 44 && peak < 52, `высота ${peak}`);
    assert.equal(player.onGround, true, 'вернулся на землю');
});

test('короткое нажатие даёт низкий прыжок', () => {
    const player = settled(flat);
    let minY = player.y;
    player.update(STEP, PRESS_JUMP, flat);
    for (let i = 0; i < 60; i++) {
        player.update(STEP, NONE, flat);
        minY = Math.min(minY, player.y);
    }
    const peak = 58 - minY;
    assert.ok(peak > 5 && peak < 25, `высота ${peak}`);
});

test('время койота: прыжок сразу после схода с края', () => {
    const player = settled(ledge);
    player.x = 81;
    steps(player, ledge, 3);
    assert.equal(player.onGround, false);
    player.update(STEP, PRESS_JUMP, ledge);
    assert.ok(player.vy < 0);
});

test('время койота истекает', () => {
    const player = settled(ledge);
    player.x = 81;
    steps(player, ledge, 10);
    player.update(STEP, PRESS_JUMP, ledge);
    assert.ok(player.vy > 0);
});

test('буфер прыжка: нажатие чуть до приземления засчитывается', () => {
    const player = settled(flat);
    player.y -= 2;
    player.onGround = false;
    player.coyote = 0;
    player.update(STEP, PRESS_JUMP, flat);
    assert.ok(player.vy > 0, 'в воздухе прыжка нет');
    let jumped = false;
    for (let i = 0; i < 8; i++) {
        player.update(STEP, HOLD_JUMP, flat);
        jumped = jumped || player.vy < 0;
    }
    assert.equal(jumped, true);
});

test('hurt: урон и неуязвимость на 0,8 с', () => {
    const player = settled(flat);
    assert.equal(player.hurt(10), true);
    assert.equal(player.hp, 90);
    assert.equal(player.hurt(10), false);
    assert.equal(player.hp, 90);
    steps(player, flat, 55);
    assert.equal(player.hurt(10), true);
    assert.equal(player.hp, 80);
});

test('takeDamage: здоровье не уходит ниже нуля, герой погибает', () => {
    const player = settled(flat);
    player.takeDamage(500);
    assert.equal(player.hp, 0);
    assert.equal(player.dead, true);
    assert.equal(player.hurt(10), false);
});
