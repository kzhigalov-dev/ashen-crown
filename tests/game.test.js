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

// Доигрывает до смены состояния (гибель героя показывается с паузой).
function untilOver(game, max = 200) {
    for (let i = 0; i < max && game.state === 'playing'; i++) game.update(STEP);
}

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

test('шипы: −15 здоровья и возврат к костру', () => {
    const { game } = setup();
    game.player.x = 67;
    game.update(STEP);
    assert.equal(game.checkpoint, game.level.checkpoints[0]);
    game.player.x = 83;
    game.player.y = 36;
    game.update(STEP);
    assert.equal(game.player.hp, 105);
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

test('костёр один раз за забег полностью лечит', () => {
    const { game } = setup();
    game.player.hp = 30;
    game.player.x = 67;
    game.update(STEP);
    assert.equal(game.player.hp, 120);
    assert.match(game.notice.text, /Костёр/);
    game.player.hp = 30;
    game.player.x = 20;
    game.update(STEP);
    game.player.x = 67;
    game.update(STEP);
    assert.equal(game.player.hp, 30, 'второй раз тот же костёр не лечит');
});

test('падение в яму без костра возвращает на старт', () => {
    const { game } = setup();
    game.player.y = game.level.height + 5;
    game.update(STEP);
    assert.equal(game.player.hp, 105);
    assert.equal(game.player.x, 3);
    assert.equal(game.state, 'playing');
});

test('здоровье 0 — поражение', () => {
    const { game, input } = setup();
    game.player.hp = 10;
    game.player.y = game.level.height + 5;
    game.update(STEP);
    assert.equal(game.state, 'playing', 'сначала пауза с разлетающимися частицами');
    assert.ok(game.dying > 0);
    untilOver(game);
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
    assert.equal(game.enemies[0].hp, 10);
    assert.equal(game.enemies[1].hp, 24, 'дальний враг не задет');
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
    assert.equal(game.player.hp, 114);

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
    assert.equal(game.enemies[0].hp, 14);
    assert.equal(game.enemies[1].hp, 24);
});

test('пробивающая стрела ранит всех на пути', () => {
    const { game, input, target } = arena('archer');
    target.dispatch('keydown', { code: 'KeyK' });
    run(game, input, 40);
    assert.equal(game.enemies.length, 0, 'оба слизня (24 здоровья) пробиты одной стрелой на 24');
});

test('шар мага попадает в низкого врага', () => {
    const { game, input, target } = arena('mage');
    target.dispatch('keydown', { code: 'KeyJ' });
    run(game, input, 1);
    target.dispatch('keyup', { code: 'KeyJ' });
    run(game, input, 40);
    assert.equal(game.enemies[0].hp, 8);
});

test('взрыв мага бьёт врагов вокруг и оставляет вспышку', () => {
    const { game, input, target } = arena('mage');
    game.player.x = 85;   // между слизнями
    game.player.invuln = 5;
    target.dispatch('keydown', { code: 'KeyK' });
    run(game, input, 1);
    assert.equal(game.enemies.length, 0, 'оба слизня убиты взрывом на 30');
    const blasts = () => game.effects.filter((effect) => effect.kind === 'blast');
    assert.equal(blasts().length, 1);
    run(game, input, 20);
    assert.equal(blasts().length, 0);
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

// Подбирает всё выпавшее; на каждую находку отвечает decide(found) → надеть или нет.
function lootAll(game, input, decide = () => false) {
    for (let i = 0; i < 600 && (game.drops.length > 0 || game.state === 'loot'); i++) {
        if (game.state === 'loot') {
            game.takeFound(decide(game.found));
            continue;
        }
        game.player.x = game.drops[0].x;
        game.update(STEP);
        input.endStep();
    }
}

// Числа по порядку для каждого убитого врага: золото (3), сторона (вправо),
// шанс предмета (0.1 < 0.15), редкость (обычный), слот (оружие), вид (посох огня),
// шанс сердца (0.9 — не выпало).
const ITEM_DROP = [0, 0.9, 0.1, 0, 0, 0, 0.9];

function blastTwoSlimes(extraSetup = () => {}) {
    const context = saved('mage', seq(...ITEM_DROP));
    extraSetup(context.game);
    const { game, input, target } = context;
    game.playLevel(0);
    for (const enemy of game.enemies) enemy.def = { ...enemy.def, speed: 0 };
    game.player.x = 85;
    game.player.invuln = 5;
    target.dispatch('keydown', { code: 'KeyK' });
    game.update(STEP);
    input.endStep();
    game.update(STEP);
    return context;
}

test('с врага падает предмет; находка останавливает игру и ждёт решения', () => {
    const { game, input } = blastTwoSlimes();
    assert.equal(game.drops.filter((drop) => drop.kind === 'gold').length, 2);
    assert.equal(game.drops.filter((drop) => drop.kind === 'item').length, 2);
    for (let i = 0; i < 300 && game.state === 'playing'; i++) {
        game.player.x = game.drops.find((drop) => drop.kind === 'item').x;
        game.update(STEP);
        input.endStep();
    }
    assert.equal(game.state, 'loot');
    assert.equal(game.found.item.name, 'Обычный посох огня');
    assert.equal(game.found.index, 0, 'предмет уже лежит в сумке');
    assert.ok(game.events.includes('item'));
    assert.equal(input.capture, false, 'клавиши отданы окну находки');
});

test('пока открыто окно находки, мир стоит', () => {
    const { game } = blastTwoSlimes();
    game.collectItem(armorItem());
    let updates = 0;
    const update = game.update.bind(game);
    game.update = (dt) => { updates++; update(dt); };
    game.tick(0);
    game.tick(500);
    game.tick(1000);
    assert.equal(updates, 0);
    assert.equal(game.alpha, 1);
});

test('находку можно убрать в сумку: она остаётся там, игра продолжается', () => {
    const { game, input } = blastTwoSlimes();
    lootAll(game, input, () => false);
    assert.equal(game.state, 'playing');
    assert.equal(game.gold, 6);
    assert.deepEqual(game.profile.inventory.items.map((item) => item.name), ['Обычный посох огня', 'Обычный посох огня']);
    assert.equal(game.profile.inventory.equipped.weapon, null);
    assert.match(game.notice.text, /В сумку/);
    assert.equal(game.found, null);
});

test('находку можно надеть сразу: бонусы и оружие действуют немедленно', () => {
    const { game, save } = saved('swordsman');
    game.playLevel(0);
    game.player.hp = 60;
    game.collectItem(armorItem());
    assert.equal(game.state, 'loot');
    game.takeFound(true);
    assert.equal(game.state, 'playing');
    assert.equal(game.player.maxHp, 140);
    assert.equal(game.player.hp, 80, 'прибавка брони добавлена к текущему здоровью');
    assert.equal(game.profile.inventory.items.length, 0);
    assert.equal(save.load().inventory.equipped.armor.name, 'Редкий доспех');
    assert.match(game.notice.text, /Надето/);

    game.collectItem(weaponItem('axe', 'swordsman'));
    game.takeFound(true);
    assert.equal(game.player.weapon.id, 'axe', 'оружие сменилось посреди уровня');
    assert.equal(game.player.bonus.damage, 4);
});

test('надетая находка меняется местами с прежним предметом', () => {
    const { game } = saved('swordsman');
    game.playLevel(0);
    game.collectItem(weaponItem('sword', 'swordsman'));
    game.takeFound(true);
    game.collectItem(weaponItem('spear', 'swordsman'));
    game.takeFound(true);
    assert.equal(game.profile.inventory.equipped.weapon.kind, 'spear');
    assert.deepEqual(game.profile.inventory.items.map((item) => item.kind), ['sword']);
});

test('сумка полна: находку можно надеть (прежний предмет разбирается) или разобрать', () => {
    const fill = (game) => { for (let i = 0; i < 12; i++) game.profile.inventory.add(armorItem()); };
    const first = saved('swordsman');
    fill(first.game);
    first.game.playLevel(0);
    first.game.collectItem(weaponItem('axe', 'swordsman'));
    assert.equal(first.game.found.index, null, 'в сумку не поместился');
    first.game.takeFound(false);
    assert.equal(first.game.gold, 2, 'обычный предмет разобран');
    assert.equal(first.game.profile.inventory.items.length, 12);
    assert.match(first.game.notice.text, /Сумка полна/);

    const second = saved('swordsman');
    fill(second.game);
    second.game.profile.inventory.equip(0);            // надет редкий доспех, в сумке 11
    second.game.profile.inventory.add(armorItem());    // снова 12
    second.game.playLevel(0);
    const better = { ...armorItem(), name: 'Эпический доспех', rarity: 'epic', stats: { hp: 40 } };
    second.game.collectItem(better);
    second.game.takeFound(true);
    assert.equal(second.game.profile.inventory.equipped.armor.name, 'Эпический доспех');
    assert.equal(second.game.gold, 6, 'прежний редкий доспех разобран');
    assert.equal(second.game.player.maxHp, 160);
});

test('второй предмет не подбирается, пока не решена судьба первого', () => {
    const { game, input } = blastTwoSlimes();
    game.collectItem(armorItem());
    const items = () => game.drops.filter((drop) => drop.kind === 'item').length;
    const before = items();
    for (let i = 0; i < 60; i++) {
        game.player.x = game.drops.find((drop) => drop.kind === 'item').x;
        game.update(STEP);
        input.endStep();
    }
    assert.equal(items(), before);
    assert.equal(game.found.item.name, 'Редкий доспех');
});

test('из врага может выпасть сердце: лечит раненого, здорового ждёт', () => {
    // золото, сторона, шанс предмета (не выпал), шанс сердца (выпало)
    const { game, input } = arena('swordsman', seq(0, 0.9, 0.5, 0.05));
    game.enemies[0].hit(999, 'test', 1);
    run(game, input, 1);
    const heart = game.drops.find((drop) => drop.kind === 'heart');
    assert.ok(heart);
    run(game, input, 40);
    game.player.x = heart.x;
    run(game, input, 5);
    assert.ok(game.drops.includes(heart), 'здоровый герой сердце не тратит');
    game.player.hp = 50;
    run(game, input, 5);
    assert.equal(game.player.hp, 70);
    assert.ok(!game.drops.includes(heart));
    assert.ok(game.events.includes('heal'));
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
    game.takeFound(false);
    game.player.hp = 10;
    game.player.y = game.level.height + 5;
    untilOver(game);
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
    run(game, input, 25);
    assert.equal(game.player.hp, 120, 'во время замаха урона нет');
    run(game, input, 15);
    assert.equal(game.player.hp, 108);
});

test('стрела скелета-лучника ранит героя и исчезает', () => {
    const { game, input } = fight('#P.......a........E#');
    run(game, input, 60 * 4, () => game.player.hp < 120);
    assert.equal(game.player.hp, 113);
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

// ---------- События, эффекты, громкость ----------

function fakeAudio() {
    return { played: [], volume: null, play(name) { this.played.push(name); }, setVolume(v) { this.volume = v; } };
}

test('события шага: прыжок, удар, попадание', () => {
    const { game, input, target } = arena();
    run(game, input, 1);   // герой встаёт на землю
    target.dispatch('keydown', { code: 'Space' });
    run(game, input, 1);
    assert.deepEqual(game.events, ['jump']);
    game.events = [];

    game.player.x = 45;
    target.dispatch('keydown', { code: 'KeyJ' });
    run(game, input, 2);
    assert.deepEqual(game.events, ['attack', 'hit']);
});

test('попадание оставляет всплывающее число урона, крит помечен', () => {
    const { game, input, target } = arena('swordsman', () => 0.5);
    game.player.bonus.crit = 100;
    game.player.x = 45;
    target.dispatch('keydown', { code: 'KeyJ' });
    run(game, input, 2);
    const number = game.effects.find((effect) => effect.kind === 'number');
    assert.equal(number.text, '28');
    assert.equal(number.crit, true);
});

test('гибель врага: звук и частицы; эффекты не тратят случайность', () => {
    let calls = 0;
    const { game, input } = arena('swordsman', () => { calls++; return 0.5; });
    game.enemies[0].hit(999, 'test', 1);
    run(game, input, 1);
    assert.ok(game.events.includes('kill'));
    assert.equal(game.effects.filter((effect) => effect.kind === 'particle').length, 8);
    assert.equal(calls, 4, 'только золото, сторона, шанс предмета и шанс сердца');
    run(game, input, 40);
    assert.equal(game.effects.length, 0, 'частицы исчезают');
});

test('урон герою, поражение и прохождение дают события', () => {
    const { game, input } = arena();
    game.player.x = 66;
    run(game, input, 1);
    assert.ok(game.events.includes('hurt'));

    game.events = [];
    game.player.hp = 10;
    game.player.y = game.level.height + 5;
    untilOver(game);
    assert.deepEqual(game.events, ['hurt', 'death', 'defeat']);

    const second = arena();
    second.game.player.invuln = 99;
    second.game.player.x = second.game.level.exit.x + 3;
    second.game.update(STEP);
    assert.ok(second.game.events.includes('complete'));
});

test('tick передаёт события звуку и очищает список', () => {
    const audio = fakeAudio();
    const { game, target } = arena('swordsman', () => 0.5, { audio });
    game.tick(0);
    game.tick(20);         // герой встаёт на землю
    target.dispatch('keydown', { code: 'Space' });
    game.tick(40);
    assert.deepEqual(audio.played, ['jump']);
    assert.deepEqual(game.events, []);
});

test('громкость: ограничена, уходит в звук и сохраняется в профиле', () => {
    const audio = fakeAudio();
    const storage = memoryStorage();
    const save = new Save(storage);
    const game = new Game({ levels: [arenaDef], input: new InputHandler(fakeTarget()), save, audio });
    game.setVolume(0.2);
    assert.equal(audio.volume, 0.2);
    game.newGame('mage');
    assert.equal(save.load().volume, 0.2, 'новая игра берёт текущую громкость');
    game.setVolume(5);
    assert.equal(game.volume, 1);
    assert.equal(save.load().volume, 1);

    const audio2 = fakeAudio();
    const again = new Game({ levels: [arenaDef], input: new InputHandler(fakeTarget()), save: new Save(storage), audio: audio2 });
    again.continueGame();
    assert.equal(again.volume, 1);
    assert.equal(audio2.volume, 1, 'при загрузке громкость применяется');
});

// ---------- Ощущение игры и сюжет в уровне ----------

test('попадание по врагу на миг замораживает кадр, нажатия не теряются', () => {
    const { game, target } = arena();
    game.tick(0);
    game.tick(20);
    game.player.x = 45;
    target.dispatch('keydown', { code: 'KeyJ' });
    game.tick(40);
    assert.ok(game.freeze > 0, 'после попадания кадр замер');
    let updates = 0;
    const update = game.update.bind(game);
    game.update = (dt) => { updates++; update(dt); };
    target.dispatch('keydown', { code: 'Space' });
    game.tick(57);
    assert.equal(updates, 0, 'пока кадр заморожен, логика стоит');
    assert.equal(game.input.wasPressed('jump'), true, 'нажатие дождётся следующего шага');
    game.tick(140);
    assert.ok(updates > 0);
});

test('урон герою: вспышка, тряска, счётчик попаданий', () => {
    const { game, input } = arena();
    game.player.x = 66;
    run(game, input, 1);
    assert.ok(game.hurtFlash > 0);
    assert.equal(game.shake, 3);
    assert.equal(game.stats.hits, 1);
    run(game, input, 30);
    assert.equal(game.shake, 0, 'тряска затухает');
    assert.equal(game.hurtFlash, 0);
});

test('тряску можно отключить в настройках', () => {
    const { game, input } = arena('swordsman', () => 0.5, { options: { shake: false } });
    game.player.x = 66;
    run(game, input, 1);
    assert.equal(game.shake, 0);
    assert.ok(game.hurtFlash > 0, 'вспышка остаётся');
});

test('прыжок и приземление поднимают пыль, рывок оставляет след', () => {
    const { game, input, target } = arena();
    run(game, input, 1);
    const dust = () => game.effects.filter((effect) => effect.kind === 'particle').length;
    target.dispatch('keydown', { code: 'Space' });
    run(game, input, 1);
    assert.equal(dust(), 4);
    target.dispatch('keyup', { code: 'Space' });
    run(game, input, 60);
    assert.ok(game.events.includes('land'));

    target.dispatch('keydown', { code: 'KeyK' });
    run(game, input, 4);
    assert.ok(game.trail.length >= 3);
    run(game, input, 40);
    assert.equal(game.trail.length, 0, 'след исчезает');
});

test('заставка локации идёт в начале уровня и заканчивается', () => {
    const { game, input } = arena();
    assert.ok(game.intro > 2);
    run(game, input, 60 * 3);
    assert.equal(game.intro, 0);
});

test('босс просыпается с объявлением и репликой, гибнет — с другим', () => {
    const { game, input } = fight('#P.......T........E#');
    game.player.invuln = 99;
    run(game, input, 2);
    assert.equal(game.banner.title, 'Древо-страж');
    assert.match(game.banner.text, /Клятва/);
    assert.ok(game.events.includes('bossWake'));
    run(game, input, 60 * 4);
    assert.equal(game.banner, null, 'объявление исчезает');
    assert.equal(game.events.filter((name) => name === 'bossWake').length, 1, 'объявляется один раз');

    game.enemies[0].hit(999, 'test', 1);
    run(game, input, 2);
    assert.match(game.banner.text, /повержен/);
    assert.equal(game.stats.kills, 1);
    assert.equal(game.shake > 0, true);
});

test('у костра лежит записка — своя для каждого костра локации', async () => {
    const { LORE } = await import('../js/data/story.js');
    const target = fakeTarget();
    const input = new InputHandler(target);
    const game = new Game({ levels: [{ ...levelDef, id: 'forest' }], input });
    input.attach();
    game.startLevel();
    game.player.x = 67;
    game.update(STEP);
    assert.equal(game.lore.text, LORE.forest[0]);
    run(game, input, 60 * 7);
    assert.equal(game.lore, null, 'записка исчезает сама');
});

test('гибель героя: мир замирает, враги не добивают', () => {
    const { game, input } = arena();
    game.player.hp = 5;
    game.player.x = 66;
    run(game, input, 1);
    assert.equal(game.player.dead, true);
    const enemyX = game.enemies[0].x;
    const hits = game.stats.hits;
    run(game, input, 20);
    assert.equal(game.state, 'playing');
    assert.equal(game.enemies[0].x, enemyX, 'враги стоят');
    assert.equal(game.stats.hits, hits);
    assert.equal(game.effects.filter((effect) => effect.kind === 'particle').length > 0, true);
    untilOver(game);
    assert.equal(game.state, 'dead');
});

test('cleared: число пройденных локаций, до загрузки берётся из сохранения', () => {
    const { game, storage } = saved('swordsman', () => 0.5, [arenaDef, arenaDef]);
    assert.equal(game.cleared, 0);
    game.playLevel(0);
    game.player.x = game.level.exit.x + 3;
    game.update(STEP);
    assert.equal(game.cleared, 1);
    game.playLevel(1);
    game.player.x = game.level.exit.x + 3;
    game.update(STEP);
    assert.equal(game.cleared, 2, 'не больше числа локаций');

    const fresh = new Game({ levels: [arenaDef, arenaDef], input: new InputHandler(fakeTarget()), save: new Save(storage) });
    assert.equal(fresh.profile, null);
    assert.equal(fresh.cleared, 2);
    const empty = new Game({ levels: [arenaDef], input: new InputHandler(fakeTarget()) });
    assert.equal(empty.cleared, 0);
});

// ---------- Виды оружия в игре ----------

const weaponItem = (kind, classId) => ({ slot: 'weapon', rarity: 'common', tier: 1, name: kind, stats: { damage: 4 }, classId, kind });

// Арена с надетым оружием заданного вида.
function armedArena(kind, classId, def = arenaDef) {
    const target = fakeTarget();
    const input = new InputHandler(target);
    const game = new Game({ levels: [def], input, rng: () => 0.5 });
    input.attach();
    game.newGame(classId);
    game.profile.inventory.add(weaponItem(kind, classId));
    game.equipItem(0);
    game.playLevel(0);
    for (const enemy of game.enemies) enemy.def = { ...enemy.def, speed: 0 };
    return { target, input, game };
}

test('надетое оружие определяет атаку героя', () => {
    const { game } = armedArena('axe', 'swordsman');
    assert.equal(game.player.weapon.id, 'axe');
    assert.equal(game.player.bonus.damage, 4);
    const plain = arena('swordsman');
    assert.equal(plain.game.player.weapon.id, 'sword', 'без снаряжения — оружие класса');
});

test('ледяной осколок замораживает врага: он стоит и не отлетает', () => {
    const { game, input, target } = armedArena('iceStaff', 'mage');
    target.dispatch('keydown', { code: 'KeyJ' });
    run(game, input, 1);
    target.dispatch('keyup', { code: 'KeyJ' });
    run(game, input, 40, () => game.enemies[0].frozen > 0);
    const enemy = game.enemies[0];
    assert.ok(enemy.frozen > 0.4);
    assert.ok(enemy.stun > 0.4, 'заморозка дольше обычного оглушения');
    const x = enemy.x;
    run(game, input, 10);
    assert.equal(enemy.x, x, 'замороженный не двигается');
});

test('ледяная волна замораживает всех вокруг; босса заморозить нельзя', () => {
    const { game, input, target } = armedArena('iceStaff', 'mage');
    game.player.x = 85;
    game.player.invuln = 5;
    target.dispatch('keydown', { code: 'KeyK' });
    run(game, input, 1);
    assert.ok(game.enemies.every((enemy) => enemy.frozen > 1));
    assert.equal(game.effects.find((effect) => effect.kind === 'blast').style, 'frost');

    const boss = armedArena('iceStaff', 'mage', bossArena('#P.......T........E#'));
    boss.game.player.x = 130;
    boss.game.player.invuln = 5;
    boss.target.dispatch('keydown', { code: 'KeyK' });
    run(boss.game, boss.input, 1);
    assert.equal(boss.game.enemies[0].hp, 260 - 18, 'урон прошёл (14 + 4 от оружия)');
    assert.equal(boss.game.enemies[0].stun, 0);
});

test('цепная молния бьёт ближайших врагов в радиусе, но не дальних', () => {
    const far = {
        id: 'far', name: 'Far',
        segments: [['......................', '......................', 'P..s.s.s.s.s.......sE.', '######################']],
    };
    const { game, input, target } = armedArena('stormStaff', 'mage', far);
    game.player.x = 100;
    game.player.invuln = 5;
    target.dispatch('keydown', { code: 'KeyK' });
    run(game, input, 1);
    // Молния на 26 урона убивает слизня (24 здоровья) — считаем уцелевших.
    assert.equal(game.enemies.length, 2, 'из шести поражены четверо — не больше');
    assert.equal(game.enemies.at(-1).hp, 24, 'дальний слизень вне радиуса');
    assert.equal(game.effects.filter((effect) => effect.kind === 'lightning').length, 4);
});

test('копьё достаёт врага, до которого не дотягивается меч', () => {
    const reach = (kind) => {
        const { game, input, target } = armedArena(kind, 'swordsman');
        game.player.x = 30;   // слизень в 35 пикселях от середины героя
        target.dispatch('keydown', { code: 'KeyJ' });
        run(game, input, 3);
        return game.enemies[0].hp < 24;
    };
    assert.equal(reach('sword'), false);
    assert.equal(reach('spear'), true);
});

test('дождь стрел накрывает землю впереди героя', () => {
    const { game, input, target } = armedArena('shortbow', 'archer');
    target.dispatch('keydown', { code: 'KeyK' });
    run(game, input, 1);
    assert.equal(game.projectiles.length, 5);
    const startX = game.player.x;
    let maxY = 0;
    run(game, input, 20);
    for (const arrow of game.projectiles) maxY = Math.max(maxY, game.player.y - arrow.y);
    assert.ok(maxY > 20, 'стрелы уходят вверх');
    run(game, input, 90);
    assert.equal(game.projectiles.length, 0, 'все стрелы упали');
    assert.ok(game.enemies.length < 2 || game.enemies.some((enemy) => enemy.hp < 24), 'хотя бы один враг впереди задет');
    assert.equal(game.player.x, startX);
});

// ---------- Миры ----------

test('сила уровня делает обычных врагов крепче, стражей не меняет', () => {
    const strong = { ...bossArena('#P..s....T........E#'), power: 1.5 };
    const input = new InputHandler(fakeTarget());
    const game = new Game({ levels: [strong], input });
    game.startLevel();
    const slime = game.enemies.find((enemy) => enemy.type === 'slime');
    const boss = game.enemies.find((enemy) => enemy.def.boss);
    assert.equal(slime.maxHp, 36);
    assert.equal(slime.hp, 36);
    assert.equal(slime.damage, 9);
    assert.equal(boss.maxHp, 260);
});

test('зубцы короны: по одному за каждого поверженного стража', () => {
    const plain = { ...arenaDef, boss: null };
    const lair = { ...arenaDef, boss: 'treant' };
    const { game } = saved('swordsman', () => 0.5, [plain, lair, plain, lair]);
    const clear = (index) => {
        game.playLevel(index);
        game.player.x = game.level.exit.x + 3;
        game.update(STEP);
    };
    assert.equal(game.crowns, 0);
    clear(0);
    assert.equal(game.crowns, 0, 'обычный уровень зубца не даёт');
    clear(1);
    assert.equal(game.crowns, 1);
    clear(2);
    clear(3);
    assert.equal(game.crowns, 2);
});

test('добыча и записки зависят от мира уровня, а не от его id', async () => {
    const { LORE } = await import('../js/data/story.js');
    const def = { ...levelDef, id: 'castle-3', world: 'castle', number: 3 };
    const target = fakeTarget();
    const input = new InputHandler(target);
    const game = new Game({ levels: [def], input });
    input.attach();
    game.startLevel();
    assert.equal(game.world, 'castle');
    game.player.x = 67;
    game.update(STEP);
    assert.equal(game.lore.text, LORE.castle[4], 'третий уровень, первый костёр');
});

test('выстрел вплотную попадает во врага, даже если за ним стена', () => {
    // Слизень стоит у стены, герой — вплотную к нему, лицом к стене.
    const wall = {
        id: 'wall', name: 'Wall',
        segments: [['..........', '..........', '.P....s#E.', '##########']],
    };
    const target = fakeTarget();
    const input = new InputHandler(target);
    const game = new Game({ levels: [wall], input, rng: () => 0.5 });
    input.attach();
    game.classId = 'archer';
    game.startLevel();
    const slime = game.enemies[0];
    slime.def = { ...slime.def, speed: 0 };
    game.player.invuln = 99;
    run(game, input, 1);
    slime.x = 7 * 16 - slime.w;          // вплотную к стене
    game.player.x = slime.x + 2;         // герой внутри слизня
    target.dispatch('keydown', { code: 'KeyJ' });
    run(game, input, 3);
    assert.equal(slime.hp, 14, 'стрела попала, а не разбилась о стену');
});

// ---------- Отпор и плавность ----------

test('враг, ранивший героя, отскакивает и даёт время ответить', () => {
    const { game, input } = arena();
    for (const enemy of game.enemies) enemy.def = { ...enemy.def, speed: 22 };
    game.player.x = 66;
    run(game, input, 1);
    const slime = game.enemies[0];
    assert.equal(game.player.hp, 114);
    assert.ok(slime.stun > 0.3, 'после укуса слизень оглушён');
    const gap = () => Math.abs((slime.x + slime.w / 2) - (game.player.x + game.player.w / 2));
    const before = gap();
    run(game, input, 20);
    assert.ok(gap() > before + 10, `отскочил: было ${before}, стало ${gap()}`);
    assert.equal(game.player.hp, 114, 'пока отскакивает — не ранит');
});

test('страж после удара не отскакивает', () => {
    const { game, input } = fight('#P.......T........E#');
    const boss = game.enemies[0];
    game.player.x = boss.x + 4;
    run(game, input, 1);
    assert.equal(game.player.hp, 112);
    assert.equal(boss.stun, 0);
});

test('стрелы не замораживают кадр, удар мечом — замораживает', () => {
    const shot = arena('archer');
    shot.target.dispatch('keydown', { code: 'KeyJ' });
    run(shot.game, shot.input, 40, () => shot.game.enemies[0].hp < 24);
    assert.equal(shot.game.freeze, 0);

    const blow = arena('swordsman');
    blow.game.player.x = 45;
    blow.target.dispatch('keydown', { code: 'KeyJ' });
    run(blow.game, blow.input, 2);
    assert.ok(blow.game.freeze > 0);
});

test('плавность: игра помнит прошлые положения и долю шага между кадрами', () => {
    const { game, target } = arena();
    game.tick(0);
    target.dispatch('keydown', { code: 'KeyD' });
    game.tick(100);
    const { player } = game;
    assert.ok(player.prevX < player.x, 'прошлое положение героя запомнено');
    assert.ok(game.alpha >= 0 && game.alpha < 1, `доля шага ${game.alpha}`);
    assert.equal(game.enemies[0].prevX !== undefined, true);
    game.pause();
    game.tick(120);
    assert.equal(game.alpha, 1, 'на паузе сглаживания нет');
});

// ---------- Смена героя и настройки надписей ----------

test('смена героя: уровни, золото и сумка остаются, оружие прежнего героя уходит в сумку', () => {
    const { game, save } = saved('swordsman', () => 0.5, [arenaDef, arenaDef]);
    game.playLevel(0);
    game.player.x = game.level.exit.x + 3;
    game.update(STEP);
    game.openMap();
    game.profile.gold = 90;
    game.profile.inventory.add(weaponItem('axe', 'swordsman'));
    game.profile.inventory.add(armorItem());
    game.equipItem(0);
    game.equipItem(0);

    game.openClassSelect(true);
    assert.equal(game.state, 'classSelect');
    assert.equal(game.switching, true);
    game.changeClass('mage');

    assert.equal(game.state, 'map');
    assert.equal(game.switching, false);
    assert.equal(game.profile.classId, 'mage');
    assert.equal(game.profile.unlocked, 2, 'прогресс на месте');
    assert.equal(game.profile.gold, 90);
    assert.equal(game.profile.inventory.equipped.weapon, null);
    assert.equal(game.profile.inventory.equipped.armor.name, 'Редкий доспех', 'броня общая — осталась надетой');
    assert.deepEqual(game.profile.inventory.items.map((item) => item.kind), ['axe']);
    assert.equal(save.load().classId, 'mage');

    game.playLevel(1);
    assert.equal(game.player.classDef.id, 'mage');
    assert.equal(game.player.weapon.id, 'fireStaff', 'у нового героя оружие его класса');
    assert.equal(game.player.maxHp, 90, 'здоровье мага плюс общая броня');
});

test('оружие другого героя лежит в сумке, но надеть его нельзя', () => {
    const { game } = saved('swordsman');
    game.profile.inventory.add(weaponItem('axe', 'swordsman'));
    game.changeClass('archer');
    assert.equal(game.canEquip(game.profile.inventory.items[0]), false);
    game.equipItem(0);
    assert.equal(game.profile.inventory.equipped.weapon, null);
    game.profile.inventory.add(weaponItem('crossbow', 'archer'));
    game.equipItem(1);
    assert.equal(game.profile.inventory.equipped.weapon.kind, 'crossbow');
    game.changeClass('swordsman');
    game.equipItem(0);
    assert.equal(game.profile.inventory.equipped.weapon.kind, 'axe', 'вернулись к мечнику — секира снова годится');
});

test('смена героя при полной сумке: оружие разбирается в золото', () => {
    const { game } = saved('swordsman');
    game.profile.inventory.add(weaponItem('axe', 'swordsman'));
    game.equipItem(0);
    for (let i = 0; i < 12; i++) game.profile.inventory.add(armorItem());
    game.changeClass('mage');
    assert.equal(game.profile.inventory.equipped.weapon, null);
    assert.equal(game.profile.inventory.items.length, 12);
    assert.equal(game.profile.gold, 2);
});

test('выбор того же героя ничего не меняет; без профиля сменить героя нельзя', () => {
    const { game } = saved('swordsman');
    game.profile.inventory.add(weaponItem('axe', 'swordsman'));
    game.equipItem(0);
    game.openClassSelect(true);
    game.changeClass('swordsman');
    assert.equal(game.profile.inventory.equipped.weapon.kind, 'axe');
    assert.equal(game.state, 'map');

    const fresh = new Game({ levels: [arenaDef], input: new InputHandler(fakeTarget()) });
    fresh.openClassSelect(true);
    assert.equal(fresh.switching, false, 'профиля нет — это выбор для новой игры');
    fresh.newGame('archer');
    assert.equal(fresh.profile.classId, 'archer');
});

test('записки у костров можно выключить', () => {
    const target = fakeTarget();
    const input = new InputHandler(target);
    const game = new Game({ levels: [{ ...levelDef, id: 'forest' }], input, options: { shake: true, notes: false } });
    input.attach();
    game.startLevel();
    game.player.hp = 50;
    game.player.x = 67;
    game.update(STEP);
    assert.equal(game.lore, null);
    assert.equal(game.player.hp, 120, 'костёр по-прежнему лечит');
});

test('окно находки можно выключить: предмет молча идёт в сумку', () => {
    const input = new InputHandler(fakeTarget());
    const game = new Game({ levels: [arenaDef], input, options: { lootPopup: false } });
    game.newGame('swordsman');
    game.playLevel(0);
    game.collectItem(armorItem());
    assert.equal(game.state, 'playing');
    assert.equal(game.found, null);
    assert.equal(game.profile.inventory.items.length, 1);
    assert.match(game.notice.text, /В сумку/);
    for (let i = 0; i < 11; i++) game.profile.inventory.add(armorItem());
    game.collectItem(armorItem());
    assert.equal(game.gold, 6);
    assert.match(game.notice.text, /Сумка полна/);
});

// ---------- Накал для музыки ----------

test('накал: один — 0, враг рядом или бой — 1 и держится три секунды', () => {
    const { game, input } = arena();
    for (const enemy of game.enemies) enemy.def = { ...enemy.def, speed: 0 };
    game.player.x = 3;
    game.enemies.forEach((enemy) => { enemy.x = 600; });   // враги далеко
    run(game, input, 5);
    assert.equal(game.tension, 0);

    game.enemies[0].x = 60;
    run(game, input, 2);
    assert.equal(game.tension, 1, 'враг подошёл');
    game.enemies[0].x = 600;
    run(game, input, 60);
    assert.equal(game.tension, 1, 'через секунду музыка ещё боевая');
    run(game, input, 150);
    assert.equal(game.tension, 0, 'через три секунды успокоилась');
});

test('накал: удар по врагу и ранение героя тоже включают бой', () => {
    const { game, input } = arena();
    game.enemies.forEach((enemy) => { enemy.x = 600; });
    run(game, input, 2);
    game.hitEnemy(game.enemies[0], 1, 'far', 1);
    assert.equal(game.tension, 1);

    const hurt = arena();
    hurt.game.enemies.forEach((enemy) => { enemy.x = 600; });
    run(hurt.game, hurt.input, 2);
    hurt.game.player.y = hurt.game.level.height + 5;   // падение в яму
    run(hurt.game, hurt.input, 1);
    assert.equal(hurt.game.tension, 1);
});

test('накал: проснувшийся страж — 2, спящий и поверженный — нет; вне уровня — 0', () => {
    const { game, input } = fight('#P..............T.E#');
    game.player.invuln = 99;
    const boss = game.enemies[0];
    boss.awake = false;
    boss.update = () => {};    // пусть спит
    run(game, input, 2);
    assert.notEqual(game.tension, 2);
    boss.awake = true;
    assert.equal(game.tension, 2);
    boss.dead = true;
    assert.notEqual(game.tension, 2);

    const idle = new Game({ levels: [arenaDef], input: new InputHandler(fakeTarget()) });
    assert.equal(idle.tension, 0);
});

test('пробуждение стража — короткая сцена: мир замирает, потом бой продолжается', () => {
    const { game, input } = fight('#P.......T........E#');
    game.player.invuln = 99;
    game.tick(0);
    game.tick(40);
    assert.ok(game.cinema > 0.5, 'сцена началась');
    assert.ok(game.freeze > 0.5);
    let updates = 0;
    const update = game.update.bind(game);
    game.update = (dt) => { updates++; update(dt); };
    game.tick(140);
    assert.equal(updates, 0, 'во время сцены мир стоит');
    for (let now = 240; now <= 1400; now += 100) game.tick(now);
    assert.equal(game.cinema, 0, 'сцена закончилась');
    assert.ok(updates > 0, 'бой пошёл');
    assert.equal(input.capture, true);
});

test('следующий уровень: первый непройденный; когда пройдено всё — его нет', () => {
    const { game } = saved('swordsman', () => 0.5, [arenaDef, arenaDef]);
    assert.equal(game.nextIndex, 0);
    game.enterLevel(game.nextIndex);
    assert.equal(game.state, 'story', 'непройденный уровень начинается с сюжетного текста');
    game.beginLevel();
    game.player.x = game.level.exit.x + 3;
    game.update(STEP);
    assert.equal(game.nextIndex, 1);
    game.enterLevel(game.nextIndex);
    game.beginLevel();
    assert.equal(game.levelIndex, 1);
    game.player.x = game.level.exit.x + 3;
    game.update(STEP);
    assert.equal(game.nextIndex, null);
    game.openMap();
    game.enterLevel(game.nextIndex);
    assert.equal(game.state, 'map', 'без следующего уровня кнопка ничего не делает');
});
