import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/Game.js';
import { InputHandler } from '../js/InputHandler.js';
import { STEP } from '../js/data/constants.js';
import { Save } from '../js/systems/Save.js';
import { fakeTarget, seq, memoryStorage } from './helpers.js';

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
    const game = new Game({ levels: [levelDef], input, onStateChange: (state) => states.push(state) });
    input.attach();
    game.startLevel();
    return { target, input, game, states };
}

test('начальное состояние — меню', () => {
    const game = new Game({ levels: [levelDef], input: new InputHandler(fakeTarget()) });
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
    game.player.y = 36;
    game.update(STEP);
    assert.equal(game.player.hp, 100);
    assert.equal(game.player.x, 67);
    assert.equal(game.player.y, 26);
    assert.ok(game.player.invuln > 0);
});

test('шипы не ранят, пока ноги выше нарисованных зубьев', () => {
    const { game } = setup();
    // Тайл шипов занимает y 48..64, зубья нарисованы в нижней половине (56..64).
    game.player.x = 83;
    game.player.y = 30;
    game.update(STEP);
    assert.equal(game.player.hp, 120);
});

test('падение в яму без костра возвращает на старт', () => {
    const { game } = setup();
    game.player.y = game.level.height + 5;
    game.update(STEP);
    assert.equal(game.player.hp, 100);
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
    assert.equal(game.state, 'victory', 'единственная локация — она же последняя');
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
    assert.equal(game.state, 'victory');
});

test('restart: мир сброшен, обработчики не дублируются', () => {
    const { game, target } = setup();
    game.gold = 50;
    game.player.hp = 10;
    game.restart();
    assert.equal(game.gold, 0);
    assert.equal(game.player.hp, 120);
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

// ---------- Бой ----------

// Ровная земля, слизни в колонках 4 и 7.
const arenaDef = {
    id: 'arena',
    name: 'Arena',
    segments: [[
        '..............',
        '..............',
        'P...s..s....E.',
        '##############',
    ]],
};

// rng = 0.5: золота выпадает 5, предметы не выпадают (0.5 > шанса 0.15).
function arena(classId = 'swordsman', rng = () => 0.5, extra = {}) {
    const target = fakeTarget();
    const input = new InputHandler(target);
    const game = new Game({ levels: [arenaDef], input, rng, ...extra });
    input.attach();
    game.classId = classId;
    game.startLevel();
    for (const enemy of game.enemies) enemy.def = { ...enemy.def, speed: 0 };  // стоят на месте
    return { target, input, game };
}

function run(game, input, count, until = () => false) {
    for (let i = 0; i < count && !until(); i++) {
        game.update(STEP);
        input.endStep();
    }
}

test('враги создаются из карты уровня', () => {
    const { game } = arena();
    assert.equal(game.enemies.length, 2);
    assert.equal(game.enemies[0].type, 'slime');
    assert.equal(game.enemies[0].x, 65);
});

test('один взмах меча ранит врага один раз', () => {
    const { game, input, target } = arena();
    game.player.x = 45;
    target.dispatch('keydown', { code: 'KeyJ' });
    run(game, input, 2);
    target.dispatch('keyup', { code: 'KeyJ' });
    run(game, input, 15);
    assert.equal(game.enemies[0].hp, 16);
    assert.equal(game.enemies[1].hp, 30, 'дальний враг не задет');
});

test('мечник убивает врага, выпадает золото, подбор увеличивает счёт', () => {
    const { game, input, target } = arena();
    // Удар отбрасывает врага, поэтому герой каждый шаг встаёт вплотную к нему.
    target.dispatch('keydown', { code: 'KeyJ' });
    for (let i = 0; i < 240 && game.enemies.length === 2; i++) {
        game.player.x = game.enemies[0].x - 15;
        game.update(STEP);
        input.endStep();
    }
    target.dispatch('keyup', { code: 'KeyJ' });
    assert.equal(game.enemies.length, 1);
    assert.equal(game.drops.length, 1);
    assert.equal(game.drops[0].value, 5, 'при rng = 0.5 из 3–6 выпадает 5');
    assert.equal(game.gold, 0, 'монету нельзя подобрать, пока она вылетает');
    for (let i = 0; i < 120 && game.drops.length > 0; i++) {
        game.player.x = game.drops[0].x;
        game.update(STEP);
        input.endStep();
    }
    assert.equal(game.gold, 5);
    assert.equal(game.drops.length, 0);
});

test('касание врага ранит героя, оглушённый враг не ранит', () => {
    const { game, input } = arena();
    game.player.x = 66;
    run(game, input, 1);
    assert.equal(game.player.hp, 110);

    const second = arena();
    second.game.player.x = 66;
    second.game.enemies[0].stun = 0.2;
    run(second.game, second.input, 1);
    assert.equal(second.game.player.hp, 120);
});

test('стрела лучника ранит врага и исчезает', () => {
    const { game, input, target } = arena('archer');
    target.dispatch('keydown', { code: 'KeyJ' });
    run(game, input, 1);
    target.dispatch('keyup', { code: 'KeyJ' });
    assert.equal(game.projectiles.length, 1);
    run(game, input, 40, () => game.projectiles.length === 0);
    assert.equal(game.projectiles.length, 0);
    assert.equal(game.enemies[0].hp, 20);
    assert.equal(game.enemies[1].hp, 30);
});

test('пробивающая стрела ранит всех на пути', () => {
    const { game, input, target } = arena('archer');
    target.dispatch('keydown', { code: 'KeyK' });
    run(game, input, 40);
    assert.equal(game.enemies[0].hp, 6);
    assert.equal(game.enemies[1].hp, 6);
});

test('шар мага попадает в низкого врага', () => {
    const { game, input, target } = arena('mage');
    target.dispatch('keydown', { code: 'KeyJ' });
    run(game, input, 1);
    target.dispatch('keyup', { code: 'KeyJ' });
    run(game, input, 40);
    assert.equal(game.enemies[0].hp, 14);
});

test('взрыв мага бьёт врагов вокруг и оставляет вспышку', () => {
    const { game, input, target } = arena('mage');
    game.player.x = 85;   // между слизнями
    game.player.invuln = 5;
    target.dispatch('keydown', { code: 'KeyK' });
    run(game, input, 1);
    assert.equal(game.enemies.length, 0, 'оба слизня (30 здоровья) убиты взрывом на 30');
    assert.equal(game.effects.length, 1);
    assert.equal(game.effects[0].kind, 'blast');
    run(game, input, 20);
    assert.equal(game.effects.length, 0);
    assert.equal(game.drops.length, 2);
});

test('враг, упавший за пределы уровня, исчезает без золота', () => {
    const { game, input } = arena();
    game.enemies[0].y = game.level.height + 1;
    run(game, input, 1);
    assert.equal(game.enemies.length, 1);
    assert.equal(game.drops.length, 0);
});

test('выбор класса — отдельное состояние без уровня', () => {
    const { game } = arena();
    game.openClassSelect();
    assert.equal(game.state, 'classSelect');
    assert.equal(game.level, null);
});

// ---------- Профиль, лут, сохранение ----------

const armorItem = () => ({ slot: 'armor', rarity: 'rare', tier: 1, name: 'Редкий доспех', stats: { hp: 20 } });

function saved(classId = 'swordsman', rng = () => 0.5, levels = [arenaDef]) {
    const target = fakeTarget();
    const input = new InputHandler(target);
    const storage = memoryStorage();
    const save = new Save(storage);
    const states = [];
    const game = new Game({ levels, input, rng, save, onStateChange: (state) => states.push(state) });
    game.newGame(classId);
    return { target, input, game, save, storage, states };
}

// Ведёт героя по всем выпавшим предметам, пока их не подберёт.
function collectAll(game, input) {
    for (let i = 0; i < 400 && game.drops.length > 0; i++) {
        game.player.x = game.drops[0].x;
        game.update(STEP);
        input.endStep();
    }
}

test('новая игра создаёт профиль, сохраняет его и открывает карту', () => {
    const { game, save, states } = saved('archer');
    assert.equal(game.state, 'map');
    assert.deepEqual(states, ['map']);
    assert.equal(game.profile.classId, 'archer');
    assert.equal(game.hasSave, true);
    assert.equal(save.load().classId, 'archer');
});

test('продолжить: прогресс читается из сохранения', () => {
    const first = saved('mage');
    first.game.profile.gold = 77;
    first.game.persist();

    const input = new InputHandler(fakeTarget());
    const game = new Game({ levels: [arenaDef], input, save: new Save(first.storage) });
    assert.equal(game.continueGame(), true);
    assert.equal(game.state, 'map');
    assert.equal(game.profile.classId, 'mage');
    assert.equal(game.profile.gold, 77);
});

test('без сохранения продолжить нельзя', () => {
    const game = new Game({ levels: [arenaDef], input: new InputHandler(fakeTarget()), save: new Save(memoryStorage()) });
    assert.equal(game.hasSave, false);
    assert.equal(game.continueGame(), false);
    assert.equal(game.state, 'menu');
});

test('карта ⇄ снаряжение ⇄ уровень', () => {
    const { game } = saved();
    game.openEquipment();
    assert.equal(game.state, 'equipment');
    game.openMap();
    assert.equal(game.state, 'map');
    game.playLevel(0);
    assert.equal(game.state, 'playing');
    game.openEquipment();
    assert.equal(game.state, 'playing', 'в бою снаряжение не открыть');
    game.openMap();
    assert.equal(game.level, null);
});

test('с врага падает предмет, подбор кладёт его в сумку', () => {
    // По порядку: золото (3), сторона (вправо), шанс предмета (0.1 < 0.15),
    // редкость (обычный), слот (оружие).
    const { game, input, target } = saved('mage', seq(0, 0.9, 0.1, 0, 0));
    game.playLevel(0);
    for (const enemy of game.enemies) enemy.def = { ...enemy.def, speed: 0 };
    game.player.x = 85;
    game.player.invuln = 5;
    target.dispatch('keydown', { code: 'KeyK' });
    game.update(STEP);
    input.endStep();
    game.update(STEP);
    assert.equal(game.drops.filter((drop) => drop.kind === 'gold').length, 2);
    assert.equal(game.drops.filter((drop) => drop.kind === 'item').length, 2);
    collectAll(game, input);
    assert.equal(game.gold, 6);
    assert.deepEqual(game.profile.inventory.items.map((item) => item.name), ['Обычный посох', 'Обычный посох']);
    assert.equal(game.notice.text, 'Обычный посох');
});

test('сумка полна: найденный предмет разбирается в золото', () => {
    const { game, input, target } = saved('mage', seq(0, 0.9, 0.1, 0, 0));
    for (let i = 0; i < 12; i++) game.profile.inventory.add(armorItem());
    game.playLevel(0);
    for (const enemy of game.enemies) enemy.def = { ...enemy.def, speed: 0 };
    game.player.x = 85;
    game.player.invuln = 5;
    target.dispatch('keydown', { code: 'KeyK' });
    game.update(STEP);
    input.endStep();
    game.update(STEP);
    collectAll(game, input);
    assert.equal(game.profile.inventory.items.length, 12);
    assert.equal(game.gold, 6 + 2 + 2, 'золото врагов и по 2 за каждый обычный предмет');
    assert.match(game.notice.text, /Сумка полна/);
});

test('прохождение: золото забега идёт в общее, рекорд и сохранение', () => {
    const { game, save } = saved();
    game.playLevel(0);
    game.gold = 40;
    game.player.x = game.level.exit.x + 3;
    game.update(STEP);
    assert.equal(game.state, 'victory');
    assert.equal(game.profile.gold, 40);
    assert.equal(game.profile.bestRun, 40);
    assert.equal(save.load().gold, 40);

    game.playLevel(0);
    game.gold = 15;
    game.player.x = game.level.exit.x + 3;
    game.update(STEP);
    assert.equal(game.profile.gold, 55);
    assert.equal(game.profile.bestRun, 40, 'рекорд не понижается');
    assert.equal(game.state, 'complete', 'повторное прохождение — обычный итог');
    assert.equal(game.profile.unlocked, 2, 'больше числа локаций — пройдено всё');
});

test('прохождение локации открывает следующую', () => {
    const { game } = saved('swordsman', () => 0.5, [arenaDef, arenaDef]);
    game.playLevel(1);
    assert.equal(game.state, 'map', 'закрытую локацию запустить нельзя');
    game.playLevel(0);
    game.player.x = game.level.exit.x + 3;
    game.update(STEP);
    assert.equal(game.state, 'complete', 'первая локация из двух — ещё не победа');
    assert.equal(game.profile.unlocked, 2);
    game.playLevel(1);
    assert.equal(game.state, 'playing');
    assert.equal(game.levelIndex, 1);
});

test('смерть: золото забега теряется, найденные предметы остаются', () => {
    const { game, save } = saved();
    game.playLevel(0);
    game.gold = 40;
    game.collectItem(armorItem());
    game.player.hp = 20;
    game.player.y = game.level.height + 5;
    game.update(STEP);
    assert.equal(game.state, 'dead');
    assert.equal(game.profile.gold, 0);
    assert.equal(save.load().inventory.items.length, 1);
});

test('надетое снаряжение усиливает героя и сохраняется', () => {
    const { game, save } = saved();
    game.profile.inventory.add(armorItem());
    game.openEquipment();
    game.equipItem(0);
    assert.equal(save.load().inventory.equipped.armor.name, 'Редкий доспех');
    game.openMap();
    game.playLevel(0);
    assert.equal(game.player.maxHp, 140);
    assert.equal(game.player.hp, 140);
});

test('снять и разобрать на экране снаряжения', () => {
    const { game, save, states } = saved();
    game.profile.inventory.add(armorItem());
    game.openEquipment();
    game.equipItem(0);
    game.unequipSlot('armor');
    assert.equal(game.profile.inventory.equipped.armor, null);
    const before = states.length;
    game.dismantleItem(0);
    assert.equal(game.profile.gold, 6, 'редкий предмет первой локации');
    assert.equal(game.profile.inventory.items.length, 0);
    assert.equal(states.length, before + 1, 'экран получил сигнал перерисоваться');
    assert.equal(save.load().gold, 6);
    game.dismantleItem(0);
    assert.equal(game.profile.gold, 6, 'пустая ячейка ничего не даёт');
});

test('без хранилища игра работает, просто не сохраняет', () => {
    const input = new InputHandler(fakeTarget());
    const game = new Game({ levels: [arenaDef], input });
    game.newGame('swordsman');
    assert.equal(game.state, 'map');
    assert.equal(game.hasSave, false);
    game.playLevel(0);
    game.player.x = game.level.exit.x + 3;
    assert.doesNotThrow(() => game.update(STEP));
    assert.equal(game.state, 'victory');
});

// ---------- Враги с действиями, боссы, сюжет ----------

// Закрытая арена. Пол на y = 96.
function bossArena(row = '#P................E#') {
    return {
        id: 'forest',
        name: 'Arena',
        segments: [[
            '####################',
            '#..................#',
            '#..................#',
            '#..................#',
            '#..................#',
            row,
            '####################',
        ]],
    };
}

function fight(row, classId = 'swordsman', rng = () => 0.5) {
    const target = fakeTarget();
    const input = new InputHandler(target);
    const game = new Game({ levels: [bossArena(row)], input, rng });
    input.attach();
    game.classId = classId;
    game.startLevel();
    return { target, input, game };
}

test('удар скелета ранит героя после замаха', () => {
    const { game, input } = fight('#P.z..............E#');
    game.player.x = 40;
    run(game, input, 20);
    assert.equal(game.player.hp, 120, 'во время замаха урона нет');
    run(game, input, 15);
    assert.equal(game.player.hp, 102);
});

test('стрела скелета-лучника ранит героя и исчезает', () => {
    const { game, input } = fight('#P.......a........E#');
    run(game, input, 60 * 4, () => game.player.hp < 120);
    assert.equal(game.player.hp, 110);
    assert.equal(game.enemyShots.length, 0);
});

test('вражеский снаряд гибнет о стену', () => {
    const { game, input } = fight('#P.......a........E#');
    game.player.y = 20;          // герой высоко: лучник его не видит
    game.player.invuln = 99;
    game.enemies[0].timer = 0;
    game.enemies[0].sees = () => true;
    game.enemies[0].facing = -1;
    game.enemies[0].face = () => {};
    run(game, input, 5);
    assert.equal(game.enemyShots.length, 1);
    run(game, input, 90);   // до следующего выстрела ещё не дошло
    assert.equal(game.enemyShots.length, 0);
});

test('ловушка: сначала предупреждение, потом урон', () => {
    const { game, input } = fight('#P................E#');
    game.addHazard({ kind: 'root', x: game.player.x - 1, w: 12, h: 22, bottom: 96, delay: 0.5, life: 0.4, damage: 15 });
    run(game, input, 25);
    assert.equal(game.player.hp, 120, 'метка не ранит');
    run(game, input, 10);
    assert.equal(game.player.hp, 105);
    run(game, input, 30);
    assert.equal(game.hazards.length, 0, 'ловушка исчезла');
});

test('от ловушки можно уйти', () => {
    const { game, input, target } = fight('#P................E#');
    game.addHazard({ kind: 'root', x: game.player.x - 1, w: 12, h: 22, bottom: 96, delay: 0.5, life: 0.4, damage: 15 });
    target.dispatch('keydown', { code: 'KeyD' });
    run(game, input, 60);
    assert.equal(game.player.hp, 120);
});

test('огненные столбы уровня срабатывают по таймеру', () => {
    const { game, input } = fight('#P...f............E#');
    assert.equal(game.pillars.length, 1);
    run(game, input, 50);
    assert.equal(game.hazards.length, 0);
    run(game, input, 20);
    assert.equal(game.hazards.length, 1);
    assert.equal(game.hazards[0].kind, 'pillar');
    assert.equal(game.hazards[0].x, 5 * 16 + 8 - 6);
    assert.equal(game.hazards[0].y + game.hazards[0].h, 96);
});

test('портал закрыт, пока жив босс', () => {
    const { game, input } = fight('#P.......T........E#');
    assert.equal(game.bossAlive, true);
    game.player.invuln = 99;
    game.player.x = game.level.exit.x + 3;
    run(game, input, 3);
    assert.equal(game.state, 'playing');
    game.enemies[0].hit(999, 'test', 1);
    run(game, input, 3, () => game.state !== 'playing');
    assert.equal(game.bossAlive, false);
    assert.equal(game.state, 'victory');
});

test('с босса гарантированно падает предмет не ниже редкого', () => {
    // rng = 0.99: шанс обычного дропа не прошёл бы, но босс его не бросает.
    const { game, input } = fight('#P.......T........E#', 'mage', () => 0.5);
    game.player.invuln = 99;
    game.enemies[0].hit(999, 'test', 1);
    run(game, input, 2);
    const items = game.drops.filter((drop) => drop.kind === 'item');
    assert.equal(items.length, 1);
    assert.notEqual(items[0].item.rarity, 'common');
    const gold = game.drops.find((drop) => drop.kind === 'gold');
    assert.equal(gold.value, 50, 'из 40–60 при rng = 0.5');
});

test('Древо призывает не больше двух слизней', () => {
    const { game, input } = fight('#P.......T........E#');
    game.player.invuln = 9999;
    run(game, input, 60 * 30);
    const slimes = game.enemies.filter((enemy) => enemy.type === 'slime');
    assert.equal(slimes.length, 2);
    assert.ok(slimes.every((enemy) => enemy.summoned));
});

test('сюжет: перед непройденной локацией текст, перед пройденной — сразу игра', () => {
    const { game } = saved('swordsman', () => 0.5, [arenaDef, arenaDef]);
    game.enterLevel(0);
    assert.equal(game.state, 'story');
    assert.equal(game.level, null);
    game.beginLevel();
    assert.equal(game.state, 'playing');
    game.player.x = game.level.exit.x + 3;
    game.update(STEP);
    game.openMap();
    game.enterLevel(0);
    assert.equal(game.state, 'playing', 'пройденная локация — без текста');
    game.openMap();
    game.enterLevel(1);
    assert.equal(game.state, 'story');
    assert.equal(game.levelIndex, 1);
});

test('закрытую локацию не открыть', () => {
    const { game } = saved('swordsman', () => 0.5, [arenaDef, arenaDef]);
    game.enterLevel(1);
    assert.equal(game.state, 'map');
    game.enterLevel(5);
    assert.equal(game.state, 'map');
});

test('победа — только за первое прохождение последней локации', () => {
    const { game } = saved('swordsman', () => 0.5, [arenaDef, arenaDef]);
    const clear = (index) => {
        game.playLevel(index);
        game.player.x = game.level.exit.x + 3;
        game.update(STEP);
        return game.state;
    };
    assert.equal(clear(0), 'complete');
    assert.equal(clear(1), 'victory');
    assert.equal(game.profile.unlocked, 3);
    assert.equal(clear(1), 'complete');
    assert.equal(clear(0), 'complete');
    assert.equal(game.isOpen(1), true, 'после победы всё открыто');
    assert.equal(game.isOpen(2), false, 'третьей локации нет');
});
