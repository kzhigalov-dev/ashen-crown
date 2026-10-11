import test from 'node:test';
import assert from 'node:assert/strict';
import { Inventory } from '../js/systems/Inventory.js';

const sword = (damage = 4) => ({ slot: 'weapon', rarity: 'common', tier: 1, name: 'Обычный меч', stats: { damage }, classId: 'swordsman' });
const armor = () => ({ slot: 'armor', rarity: 'rare', tier: 1, name: 'Редкий доспех', stats: { hp: 20, crit: 3 } });
const amulet = () => ({ slot: 'amulet', rarity: 'epic', tier: 2, name: 'Эпический амулет', stats: { attackSpeed: 15, damage: 2 } });

test('в сумке 12 ячеек', () => {
    const inventory = new Inventory();
    for (let i = 0; i < 12; i++) assert.equal(inventory.add(sword(i)), true);
    assert.equal(inventory.full, true);
    assert.equal(inventory.add(sword()), false);
    assert.equal(inventory.items.length, 12);
});

test('надеть: предмет уходит из сумки в слот', () => {
    const inventory = new Inventory();
    const item = sword();
    inventory.add(item);
    assert.equal(inventory.equip(0), true);
    assert.equal(inventory.equipped.weapon, item);
    assert.equal(inventory.items.length, 0);
});

test('надеть поверх: прежний предмет занимает ту же ячейку', () => {
    const inventory = new Inventory();
    const old = sword(4);
    const better = sword(9);
    const filler = armor();
    inventory.add(old);
    inventory.equip(0);
    inventory.add(filler);
    inventory.add(better);
    inventory.equip(1);
    assert.equal(inventory.equipped.weapon, better);
    assert.deepEqual(inventory.items, [filler, old]);
});

test('надеть из пустой ячейки нельзя', () => {
    assert.equal(new Inventory().equip(3), false);
});

test('снять: предмет возвращается в сумку', () => {
    const inventory = new Inventory();
    const item = armor();
    inventory.add(item);
    inventory.equip(0);
    assert.equal(inventory.unequip('armor'), true);
    assert.equal(inventory.equipped.armor, null);
    assert.deepEqual(inventory.items, [item]);
    assert.equal(inventory.unequip('armor'), false, 'слот уже пуст');
});

test('снять при полной сумке нельзя', () => {
    const inventory = new Inventory();
    inventory.add(armor());
    inventory.equip(0);
    for (let i = 0; i < 12; i++) inventory.add(sword(i));
    assert.equal(inventory.unequip('armor'), false);
    assert.ok(inventory.equipped.armor);
});

test('разбор: предмет исчезает, возвращается золото', () => {
    const inventory = new Inventory();
    inventory.add(sword());
    inventory.add(amulet());
    assert.equal(inventory.dismantle(1), 30, 'эпический, вторая локация: 15 × 2');
    assert.equal(inventory.items.length, 1);
    assert.equal(inventory.dismantle(5), 0, 'пустая ячейка');
});

test('totals: сумма свойств только надетого', () => {
    const inventory = new Inventory();
    assert.deepEqual(inventory.totals(), { damage: 0, hp: 0, attackSpeed: 0, crit: 0 });
    inventory.add(sword(4));
    inventory.add(armor());
    inventory.add(amulet());
    inventory.add(sword(50));
    inventory.equip(0);
    inventory.equip(0);
    inventory.equip(0);
    assert.deepEqual(inventory.totals(), { damage: 6, hp: 20, attackSpeed: 15, crit: 3 });
});

test('сохранение и восстановление', () => {
    const inventory = new Inventory();
    inventory.add(sword());
    inventory.add(armor());
    inventory.equip(0);
    const copy = Inventory.from(JSON.parse(JSON.stringify(inventory)));
    assert.deepEqual(copy.equipped, inventory.equipped);
    assert.deepEqual(copy.items, inventory.items);
    assert.deepEqual(copy.totals(), inventory.totals());
});
