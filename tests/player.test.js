import test from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../js/entities/Player.js';
import { Level } from '../js/Level.js';
import { STEP, JUMP_SPEED } from '../js/data/constants.js';
import { CLASSES } from '../js/data/classes.js';
import { WEAPONS } from '../js/data/weapons.js';

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
    assert.equal(player.hp, 110);
    assert.equal(player.hurt(10), false);
    assert.equal(player.hp, 110);
    steps(player, flat, 55);
    assert.equal(player.hurt(10), true);
    assert.equal(player.hp, 100);
});

test('takeDamage: здоровье не уходит ниже нуля, герой погибает', () => {
    const player = settled(flat);
    player.takeDamage(500);
    assert.equal(player.hp, 0);
    assert.equal(player.dead, true);
    assert.equal(player.hurt(10), false);
});

// ---------- Классы и бой ----------

function settledAs(id, level = flat) {
    const player = new Player(CLASSES[id]);
    player.placeAt(level.spawn);
    player.update(STEP, NONE, level);
    player.takeActions();
    return player;
}

const HOLD_ATTACK = input(['attack']);
const PRESS_ABILITY = input([], ['ability']);

test('здоровье и мана берутся из класса', () => {
    assert.equal(settledAs('swordsman').maxHp, 120);
    assert.equal(settledAs('archer').hp, 90);
    const mage = settledAs('mage');
    assert.equal(mage.hp, 70);
    assert.equal(mage.mana, 100);
    assert.equal(settledAs('swordsman').maxMana, 0);
});

test('мечник: удар даёт область перед героем, один номер на весь взмах', () => {
    const player = settledAs('swordsman');
    player.update(STEP, HOLD_ATTACK, flat);
    const [first] = player.takeActions();
    assert.equal(first.type, 'melee');
    assert.equal(first.damage, 14);
    assert.equal(first.dir, 1);
    assert.ok(first.box.x >= player.x + player.w / 2, 'область справа от середины героя');
    assert.equal(first.box.w, 24);
    player.update(STEP, HOLD_ATTACK, flat);
    const [second] = player.takeActions();
    assert.equal(second.id, first.id, 'тот же взмах');
});

test('мечник: удар влево бьёт влево', () => {
    const player = settledAs('swordsman');
    player.x = 80;
    player.update(STEP, input(['left', 'attack']), flat);
    const [action] = player.takeActions();
    assert.equal(action.dir, -1);
    assert.ok(action.box.x + action.box.w <= player.x + player.w / 2 + 0.001);
});

test('перезарядка атаки 0,4 с: за 0,38 с один взмах, за 0,45 с — два', () => {
    const player = settledAs('swordsman');
    const ids = new Set();
    for (let i = 0; i < 23; i++) {
        player.update(STEP, HOLD_ATTACK, flat);
        for (const action of player.takeActions()) ids.add(action.id);
    }
    assert.equal(ids.size, 1);
    for (let i = 0; i < 4; i++) {
        player.update(STEP, HOLD_ATTACK, flat);
        for (const action of player.takeActions()) ids.add(action.id);
    }
    assert.equal(ids.size, 2);
});

test('лучник: стрела летит в сторону взгляда', () => {
    const player = settledAs('archer');
    player.update(STEP, HOLD_ATTACK, flat);
    const actions = player.takeActions();
    assert.equal(actions.length, 1);
    assert.deepEqual(
        { type: actions[0].type, kind: actions[0].kind, damage: actions[0].damage, dir: actions[0].dir },
        { type: 'projectile', kind: 'arrow', damage: 10, dir: 1 }
    );
    assert.equal(actions[0].crit, false);
    assert.ok(actions[0].x > player.x + player.w / 2, 'появляется перед героем');
    player.update(STEP, HOLD_ATTACK, flat);
    assert.equal(player.takeActions().length, 0, 'перезарядка');
});

test('маг: шар тратит 12 маны, без маны атаки нет', () => {
    const player = settledAs('mage');
    player.update(STEP, HOLD_ATTACK, flat);
    assert.equal(player.takeActions()[0].kind, 'flame');
    assert.equal(player.mana, 88);

    const empty = settledAs('mage');
    empty.mana = 5;
    empty.update(STEP, HOLD_ATTACK, flat);
    assert.equal(empty.takeActions().length, 0);
    assert.equal(empty.attackCooldown, 0, 'перезарядка не началась');
});

test('маг: мана восстанавливается на 14 в секунду и не выше максимума', () => {
    const player = settledAs('mage');
    player.mana = 0;
    steps(player, flat, 60);
    assert.ok(Math.abs(player.mana - 14) < 0.2, `мана ${player.mana}`);
    player.mana = 99.99;
    steps(player, flat, 60);
    assert.equal(player.mana, 100);
});

test('двойной прыжок есть у лучника', () => {
    const player = settledAs('archer');
    player.update(STEP, PRESS_JUMP, flat);
    steps(player, flat, 15, HOLD_JUMP);
    player.update(STEP, PRESS_JUMP, flat);
    assert.ok(player.vy < -JUMP_SPEED * 0.8, `скорость ${player.vy}`);
    assert.equal(player.jumpsLeft, 0);
    steps(player, flat, 5, HOLD_JUMP);
    const before = player.vy;
    player.update(STEP, PRESS_JUMP, flat);
    assert.ok(player.vy > before, 'третьего прыжка нет');
    steps(player, flat, 90);
    assert.equal(player.jumpsLeft, 1, 'на земле прыжок возвращается');
});

test('двойного прыжка нет у мечника', () => {
    const player = settledAs('swordsman');
    player.update(STEP, PRESS_JUMP, flat);
    steps(player, flat, 15, HOLD_JUMP);
    const before = player.vy;
    player.update(STEP, PRESS_JUMP, flat);
    assert.ok(player.vy > before);
});

test('рывок мечника: быстро, без падения, с неуязвимостью и одним номером удара', () => {
    const player = settledAs('swordsman');
    player.y -= 10;          // в воздухе
    player.onGround = false;
    const startX = player.x;
    const startY = player.y;
    const ids = new Set();
    player.update(STEP, PRESS_ABILITY, flat);
    assert.ok(player.dashTime > 0);
    assert.ok(player.invuln > 0);
    for (const action of player.takeActions()) ids.add(action.id);
    for (let i = 0; i < 9; i++) {
        player.update(STEP, NONE, flat);
        for (const action of player.takeActions()) {
            assert.equal(action.damage, 20);
            ids.add(action.id);
        }
    }
    assert.equal(player.y, startY, 'во время рывка не падает');
    assert.equal(ids.size, 1);
    steps(player, flat, 5);
    const distance = player.x - startX;
    assert.ok(distance > 50 && distance < 65, `дистанция ${distance}`);
    assert.equal(player.dashTime <= 0, true);
});

test('способность на перезарядке не срабатывает', () => {
    const player = settledAs('swordsman');
    player.update(STEP, PRESS_ABILITY, flat);
    steps(player, flat, 30);
    player.takeActions();
    player.update(STEP, PRESS_ABILITY, flat);
    assert.ok(player.dashTime <= 0);
    assert.ok(player.abilityCooldown > 3 && player.abilityCooldown < 4);
});

test('лучник: пробивающий выстрел', () => {
    const player = settledAs('archer');
    player.update(STEP, PRESS_ABILITY, flat);
    const [action] = player.takeActions();
    assert.equal(action.kind, 'piercingArrow');
    assert.equal(action.damage, 24);
    assert.equal(player.abilityCooldown, 5);
});

test('маг: взрыв тратит 30 маны и бьёт вокруг героя', () => {
    const player = settledAs('mage');
    player.update(STEP, PRESS_ABILITY, flat);
    const [action] = player.takeActions();
    assert.equal(action.type, 'blast');
    assert.equal(action.damage, 30);
    assert.equal(player.mana, 70);
    assert.equal(player.abilityCooldown, 6);
    const cx = player.x + player.w / 2;
    assert.equal(action.box.x, cx - 44);
    assert.equal(action.box.w, 88);

    const empty = settledAs('mage');
    empty.mana = 20;
    empty.update(STEP, PRESS_ABILITY, flat);
    assert.equal(empty.takeActions().length, 0);
});

// ---------- Снаряжение ----------

function geared(id, bonus, rng = () => 0.99) {
    const player = new Player(CLASSES[id], { bonus, rng });
    player.placeAt(flat.spawn);
    player.update(STEP, NONE, flat);
    player.takeActions();
    return player;
}

test('снаряжение: здоровье прибавляется к здоровью класса', () => {
    const player = geared('mage', { hp: 30 });
    assert.equal(player.maxHp, 100);
    assert.equal(player.hp, 100);
});

test('снаряжение: урон прибавляется к атаке и к способности', () => {
    const player = geared('swordsman', { damage: 6 });
    player.update(STEP, HOLD_ATTACK, flat);
    assert.equal(player.takeActions()[0].damage, 20);
    steps(player, flat, 30);
    player.takeActions();
    player.update(STEP, PRESS_ABILITY, flat);
    assert.equal(player.takeActions()[0].damage, 26);
});

test('снаряжение: скорость атаки сокращает перезарядку', () => {
    const player = geared('swordsman', { attackSpeed: 100 });
    player.update(STEP, HOLD_ATTACK, flat);
    assert.ok(Math.abs(player.attackCooldown - 0.2) < 1e-9);
});

test('крит удваивает урон и помечает удар', () => {
    const lucky = geared('archer', { crit: 50 }, () => 0.2);
    lucky.update(STEP, HOLD_ATTACK, flat);
    const [hit] = lucky.takeActions();
    assert.equal(hit.damage, 20);
    assert.equal(hit.crit, true);

    const unlucky = geared('archer', { crit: 50 }, () => 0.9);
    unlucky.update(STEP, HOLD_ATTACK, flat);
    assert.equal(unlucky.takeActions()[0].damage, 10);
});

test('крит бросается один раз на взмах', () => {
    const rolls = [0.2, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9];
    let index = 0;
    const player = geared('swordsman', { crit: 50 }, () => rolls[index++ % rolls.length]);
    const damages = new Set();
    for (let i = 0; i < 6; i++) {
        player.update(STEP, HOLD_ATTACK, flat);
        for (const action of player.takeActions()) damages.add(action.damage);
    }
    assert.deepEqual([...damages], [28]);
    assert.equal(index, 1, 'случай спрошен один раз');
});

test('без шанса крита случай не расходуется', () => {
    let calls = 0;
    const player = geared('archer', {}, () => { calls++; return 0; });
    player.update(STEP, HOLD_ATTACK, flat);
    assert.equal(calls, 0);
    assert.equal(player.takeActions()[0].crit, false);
});

// ---------- Виды оружия ----------

function armed(kind, bonus = {}) {
    const weapon = WEAPONS[kind];
    const player = new Player(CLASSES[weapon.classId], { weapon, bonus, rng: () => 0.99 });
    player.placeAt(flat.spawn);
    player.update(STEP, NONE, flat);
    player.takeActions();
    return player;
}

test('без указанного оружия герой берёт оружие класса по умолчанию', () => {
    assert.equal(new Player(CLASSES.archer).weapon.id, 'bow');
    assert.equal(armed('axe').weapon.id, 'axe');
});

test('секира: удар сильнее и реже, способность — круговой удар вокруг героя', () => {
    const player = armed('axe');
    player.update(STEP, HOLD_ATTACK, flat);
    assert.equal(player.takeActions()[0].damage, 24);
    assert.ok(Math.abs(player.attackCooldown - 0.7) < 1e-9);
    steps(player, flat, 50);
    player.takeActions();
    player.update(STEP, PRESS_ABILITY, flat);
    const [whirl] = player.takeActions();
    assert.equal(whirl.type, 'blast');
    assert.equal(whirl.effect, 'whirl');
    assert.equal(whirl.radius, 30);
    assert.equal(player.dashTime, 0, 'рывка нет — это способность меча');
});

test('копьё: достаёт дальше меча, способность — бросок, пробивающий насквозь', () => {
    const player = armed('spear');
    player.update(STEP, HOLD_ATTACK, flat);
    const [thrust] = player.takeActions();
    assert.equal(thrust.box.w, 38);
    assert.equal(thrust.damage, 11);
    steps(player, flat, 30);
    player.takeActions();
    player.update(STEP, PRESS_ABILITY, flat);
    const [thrown] = player.takeActions();
    assert.deepEqual({ type: thrown.type, kind: thrown.kind, damage: thrown.damage }, { type: 'projectile', kind: 'spear', damage: 28 });
});

test('арбалет: залп — три болта на разной высоте', () => {
    const player = armed('crossbow');
    player.update(STEP, PRESS_ABILITY, flat);
    const shots = player.takeActions();
    assert.equal(shots.length, 3);
    assert.ok(shots.every((shot) => shot.kind === 'quarrel' && shot.damage === 14));
    assert.equal(new Set(shots.map((shot) => shot.y)).size, 3);
    assert.deepEqual(player.events.filter((name) => name === 'shot').length, 1, 'звук выстрела один');
});

test('короткий лук: стреляет вдвое чаще; дождь стрел — пять стрел с разной дугой', () => {
    const player = armed('shortbow');
    player.update(STEP, HOLD_ATTACK, flat);
    assert.ok(Math.abs(player.attackCooldown - 0.25) < 1e-9);
    player.takeActions();
    player.update(STEP, PRESS_ABILITY, flat);
    const rain = player.takeActions();
    assert.equal(rain.length, 5);
    assert.ok(rain.every((shot) => shot.kind === 'lob'));
    assert.deepEqual(rain.map((shot) => shot.lift), [120, 170, 220, 270, 320]);
    assert.equal(new Set(rain.map((shot) => shot.y)).size, 1, 'вылетают из одной точки');
});

test('посох льда: осколок дешевле, волна замораживает', () => {
    const player = armed('iceStaff');
    player.update(STEP, HOLD_ATTACK, flat);
    assert.equal(player.takeActions()[0].kind, 'shard');
    assert.equal(player.mana, 91);
    player.update(STEP, PRESS_ABILITY, flat);
    const [nova] = player.takeActions();
    assert.equal(nova.effect, 'frost');
    assert.equal(nova.stun, 1.6);
    assert.equal(nova.radius, 54);
});

test('посох бури: способность — цепная молния', () => {
    const player = armed('stormStaff');
    player.update(STEP, PRESS_ABILITY, flat);
    const [chain] = player.takeActions();
    assert.equal(chain.type, 'chain');
    assert.equal(chain.damage, 22);
    assert.equal(chain.targets, 4);
    assert.equal(chain.range, 120);
    assert.equal(player.mana, 60);
    assert.ok(player.events.includes('chain'));
});

test('крит залпа бросается один раз на все снаряды', () => {
    let calls = 0;
    const player = new Player(CLASSES.archer, { weapon: WEAPONS.crossbow, bonus: { crit: 50 }, rng: () => { calls++; return 0.2; } });
    player.placeAt(flat.spawn);
    player.update(STEP, PRESS_ABILITY, flat);
    const shots = player.takeActions();
    assert.equal(calls, 1);
    assert.ok(shots.every((shot) => shot.crit && shot.damage === 28));
});
