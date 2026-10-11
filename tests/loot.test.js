import test from 'node:test';
import assert from 'node:assert/strict';
import { rollRarity, generateItem, rollDrop, dismantleValue, rarityOf } from '../js/systems/Loot.js';
import { RARITY_WEIGHTS, RARITIES } from '../js/data/items.js';
import { seq, lcg } from './helpers.js';

const FOREST = RARITY_WEIGHTS.forest;   // [70, 25, 5, 0]

test('rollRarity: границы весов леса', () => {
    assert.equal(rollRarity(FOREST, seq(0)), 0);
    assert.equal(rollRarity(FOREST, seq(0.699)), 0);
    assert.equal(rollRarity(FOREST, seq(0.7)), 1);
    assert.equal(rollRarity(FOREST, seq(0.949)), 1);
    assert.equal(rollRarity(FOREST, seq(0.95)), 2);
    assert.equal(rollRarity(FOREST, seq(0.999)), 2, 'легендарного в лесу нет');
});

test('rollRarity: minIndex отсекает низкие редкости', () => {
    assert.equal(rollRarity(FOREST, seq(0), 1), 1);
    assert.equal(rollRarity(FOREST, seq(0.9), 1), 2);
    assert.equal(rollRarity(FOREST, seq(0.5), 3), 3, 'если весов не осталось — минимальная допустимая');
});

test('rollRarity: на 20 000 бросков доли совпадают с весами подземелья', () => {
    const weights = RARITY_WEIGHTS.dungeon;   // [30, 40, 22, 8]
    const rng = lcg(7);
    const counts = [0, 0, 0, 0];
    const rolls = 20000;
    for (let i = 0; i < rolls; i++) counts[rollRarity(weights, rng)]++;
    counts.forEach((count, index) => {
        const share = count / rolls;
        assert.ok(Math.abs(share - weights[index] / 100) < 0.02, `редкость ${index}: доля ${share}`);
    });
});

test('обычное оружие леса: только базовый урон и класс героя', () => {
    const item = generateItem({ locationId: 'forest', classId: 'swordsman', rng: seq(0, 0) });
    assert.deepEqual(item, {
        slot: 'weapon', rarity: 'common', tier: 1, name: 'Обычный меч',
        stats: { damage: 4 }, classId: 'swordsman', kind: 'sword',
    });
});

test('оружие называется по классу героя', () => {
    const name = (classId) => generateItem({ locationId: 'forest', classId, rng: seq(0, 0) }).name;
    assert.equal(name('archer'), 'Обычный лук');
    assert.equal(name('mage'), 'Обычный посох огня');
});

test('вид оружия выбирается случайно, название согласовано по роду', () => {
    // Числа по порядку: редкость, слот (оружие), вид.
    const make = (rarity, kind) => generateItem({ locationId: 'forest', classId: 'swordsman', rng: seq(rarity, 0, kind) });
    assert.equal(make(0, 0.4).kind, 'axe');
    assert.equal(make(0, 0.4).name, 'Обычная секира');
    assert.equal(make(0.75, 0.4).name, 'Редкая секира');
    assert.equal(make(0, 0.9).kind, 'spear');
    assert.equal(make(0, 0.9).name, 'Обычное копьё');
    assert.equal(make(0.96, 0.9).name, 'Эпическое копьё');
    assert.equal(generateItem({ locationId: 'forest', classId: 'archer', rng: seq(0, 0, 0.9) }).name, 'Обычный короткий лук');
});

test('за много бросков выпадают все три вида оружия класса', () => {
    const rng = lcg(21);
    const kinds = new Set();
    for (let i = 0; i < 300; i++) {
        const item = generateItem({ locationId: 'forest', classId: 'mage', rng });
        if (item.slot === 'weapon') kinds.add(item.kind);
    }
    assert.deepEqual([...kinds].sort(), ['fireStaff', 'iceStaff', 'stormStaff']);
});

test('эпический доспех: здоровье ×1,7 и два разных случайных свойства', () => {
    const item = generateItem({ locationId: 'forest', classId: 'mage', rng: seq(0.96, 0.4, 0, 0) });
    assert.equal(item.name, 'Эпический доспех');
    assert.equal(item.classId, undefined, 'броня не привязана к классу');
    assert.deepEqual(item.stats, { hp: 26, damage: 4, attackSpeed: 6 });
});

test('амулет: случайное базовое свойство с повышенным значением', () => {
    const item = generateItem({ locationId: 'forest', classId: 'mage', rng: seq(0, 0.7, 0.99) });
    assert.equal(item.slot, 'amulet');
    assert.deepEqual(item.stats, { crit: 8 });
});

test('число свойств растёт с редкостью: 1, 2, 3, 4', () => {
    // Первое число выбирает редкость в подземелье, остальные нули.
    const count = (first) =>
        Object.keys(generateItem({ locationId: 'dungeon', classId: 'mage', rng: seq(first, 0, 0, 0, 0) }).stats).length;
    assert.deepEqual([count(0.1), count(0.5), count(0.8), count(0.95)], [1, 2, 3, 4]);
});

test('предметы дальних локаций сильнее', () => {
    const damage = (locationId) =>
        generateItem({ locationId, classId: 'swordsman', rng: seq(0, 0) }).stats.damage;
    assert.deepEqual([damage('forest'), damage('castle'), damage('dungeon')], [4, 6, 9]);
});

test('неизвестная локация считается лесом', () => {
    const item = generateItem({ locationId: 'test', classId: 'swordsman', rng: seq(0, 0) });
    assert.equal(item.tier, 1);
    assert.equal(item.stats.damage, 4);
});

test('rollDrop: предмет выпадает с шансом 15 %', () => {
    assert.ok(rollDrop({ locationId: 'forest', classId: 'mage', rng: seq(0.149, 0, 0) }));
    assert.equal(rollDrop({ locationId: 'forest', classId: 'mage', rng: seq(0.15, 0, 0) }), null);
    const rng = lcg(3);
    let drops = 0;
    for (let i = 0; i < 10000; i++) if (rollDrop({ locationId: 'forest', classId: 'mage', rng })) drops++;
    assert.ok(Math.abs(drops / 10000 - 0.15) < 0.015, `доля ${drops / 10000}`);
});

test('rollDrop: с босса предмет гарантирован и не ниже редкого', () => {
    const rng = lcg(11);
    for (let i = 0; i < 300; i++) {
        const item = rollDrop({ locationId: 'forest', classId: 'archer', rng, boss: true });
        assert.ok(item);
        assert.notEqual(item.rarity, 'common');
    }
});

test('оружие всегда для класса героя', () => {
    const rng = lcg(5);
    for (let i = 0; i < 500; i++) {
        const item = generateItem({ locationId: 'dungeon', classId: 'archer', rng });
        if (item.slot === 'weapon') {
            assert.equal(item.classId, 'archer');
            assert.ok(['bow', 'crossbow', 'shortbow'].includes(item.kind));
        } else {
            assert.equal(item.classId, undefined);
            assert.equal(item.kind, undefined);
        }
    }
});

test('разбор: золото зависит от редкости и локации', () => {
    assert.equal(dismantleValue({ rarity: 'common', tier: 1 }), 2);
    assert.equal(dismantleValue({ rarity: 'rare', tier: 2 }), 12);
    assert.equal(dismantleValue({ rarity: 'legendary', tier: 3 }), 120);
    assert.equal(rarityOf({ rarity: 'epic' }), RARITIES[2]);
});
