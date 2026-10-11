import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/Game.js';
import { InputHandler } from '../js/InputHandler.js';
import { STEP } from '../js/data/constants.js';
import { fakeTarget } from './helpers.js';

// В Node нет requestAnimationFrame — подменяем для start/stop.
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};

// Земля в ряду 3 (верх на y=48). Монета в (2,2), костёр в (4,2),
// шипы в (5,3), дыра в (7,3), выход в (10,2).
const levelDef = {
    id: 't',
    name: 'T',
    segments: [[
        '............',
        '............',
        'P.o.C.....E.',
        '#####^#.####',
        '............',
    ]],
};

function setup() {
    const target = fakeTarget();
    const input = new InputHandler(target);
    const states = [];
    const game = new Game({ levelDef, input, onStateChange: (state) => states.push(state) });
    input.attach();
    game.startLevel();
    return { target, input, game, states };
}

test('начальное состояние — меню', () => {
    const game = new Game({ levelDef, input: new InputHandler(fakeTarget()) });
    assert.equal(game.state, 'menu');
    assert.equal(game.level, null);
});

test('startLevel: герой на точке появления, игра идёт', () => {
    const { game, input, states } = setup();
    assert.equal(game.state, 'playing');
    assert.deepEqual(states, ['playing']);
    assert.equal(game.player.x, 3);
    assert.equal(game.player.y, 26);
    assert.equal(game.gold, 0);
    assert.equal(input.capture, true);
});

test('монета даёт золото один раз', () => {
    const { game } = setup();
    game.player.x = 34;
    game.update(STEP);
    assert.equal(game.gold, 5);
    assert.equal(game.coins[0].taken, true);
    game.update(STEP);
    assert.equal(game.gold, 5);
});

test('шипы: −20 здоровья и возврат к костру', () => {
    const { game } = setup();
    game.player.x = 67;
    game.update(STEP);
    assert.equal(game.checkpoint, game.level.checkpoints[0]);
    game.player.x = 83;
    game.player.y = 30;
    game.update(STEP);
    assert.equal(game.player.hp, 80);
    assert.equal(game.player.x, 67);
    assert.equal(game.player.y, 26);
    assert.ok(game.player.invuln > 0);
});

test('падение в яму без костра возвращает на старт', () => {
    const { game } = setup();
    game.player.y = game.level.height + 5;
    game.update(STEP);
    assert.equal(game.player.hp, 80);
    assert.equal(game.player.x, 3);
    assert.equal(game.state, 'playing');
});

test('здоровье 0 — поражение', () => {
    const { game, input } = setup();
    game.player.hp = 20;
    game.player.y = game.level.height + 5;
    game.update(STEP);
    assert.equal(game.state, 'dead');
    assert.equal(input.capture, false);
});

test('портал завершает уровень', () => {
    const { game } = setup();
    game.player.x = 163;
    game.update(STEP);
    assert.equal(game.state, 'complete');
});

test('tick: логика идёт шагами по 1/60 с независимо от частоты кадров', () => {
    const { game } = setup();
    let updates = 0;
    const update = game.update.bind(game);
    game.update = (dt) => { updates++; update(dt); };
    game.tick(0);
    assert.equal(updates, 0, 'первый кадр только запоминает время');
    game.tick(55);
    assert.equal(updates, 3);
});

test('tick: длинный кадр обрезается до 0,1 с', () => {
    const { game } = setup();
    let updates = 0;
    const update = game.update.bind(game);
    game.update = (dt) => { updates++; update(dt); };
    game.tick(0);
    game.tick(55);
    game.tick(5055);
    assert.equal(updates, 9);
});

test('клавиша паузы переключает паузу, на паузе логика стоит', () => {
    const { game, target } = setup();
    let updates = 0;
    const update = game.update.bind(game);
    game.update = (dt) => { updates++; update(dt); };
    game.tick(0);
    target.dispatch('keydown', { code: 'Escape' });
    game.tick(50);
    assert.equal(game.state, 'paused');
    assert.equal(updates, 0);
    game.tick(100);
    assert.equal(updates, 0);
    target.dispatch('keyup', { code: 'Escape' });
    target.dispatch('keydown', { code: 'Escape' });
    game.tick(150);
    assert.equal(game.state, 'playing');
});

test('после паузы нет скачка времени', () => {
    const { game } = setup();
    let updates = 0;
    const update = game.update.bind(game);
    game.update = (dt) => { updates++; update(dt); };
    game.tick(0);
    game.pause();
    game.resume();
    game.tick(60000);
    assert.equal(updates, 0);
});

test('pause действует только во время игры', () => {
    const { game } = setup();
    game.player.x = 163;
    game.update(STEP);
    game.pause();
    assert.equal(game.state, 'complete');
});

test('restart: мир сброшен, обработчики не дублируются', () => {
    const { game, target } = setup();
    game.gold = 50;
    game.player.hp = 10;
    game.restart();
    assert.equal(game.gold, 0);
    assert.equal(game.player.hp, 100);
    assert.equal(game.state, 'playing');
    assert.equal(target.count(), 3);
    game.restart();
    assert.equal(target.count(), 3);
});

test('stop снимает обработчики, toMenu возвращает в меню', () => {
    const { game, target } = setup();
    game.start();
    game.toMenu();
    assert.equal(target.count(), 0);
    assert.equal(game.state, 'menu');
    assert.equal(game.level, null);
});
