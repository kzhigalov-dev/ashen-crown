import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES, CLASS_ORDER, PROJECTILES } from '../js/data/classes.js';

test('три класса в порядке показа', () => {
    assert.deepEqual(CLASS_ORDER, ['swordsman', 'archer', 'mage']);
    for (const id of CLASS_ORDER) assert.equal(CLASSES[id].id, id);
});

test('числа классов соответствуют спецификации', () => {
    const { swordsman, archer, mage } = CLASSES;
    assert.deepEqual([swordsman.maxHp, archer.maxHp, mage.maxHp], [120, 90, 70]);
    assert.deepEqual(
        [swordsman.attack.damage, archer.attack.damage, mage.attack.damage],
        [14, 10, 16]
    );
    assert.deepEqual(
        [swordsman.attack.cooldown, archer.attack.cooldown, mage.attack.cooldown],
        [0.4, 0.5, 0.45]
    );
    assert.deepEqual(
        [swordsman.ability.cooldown, archer.ability.cooldown, mage.ability.cooldown],
        [4, 5, 6]
    );
    assert.equal(archer.extraJumps, 1);
    assert.equal(mage.maxMana, 100);
    assert.equal(mage.manaRegen, 8);
    assert.equal(mage.attack.manaCost, 12);
    assert.equal(mage.ability.manaCost, 30);
});

test('у каждого класса есть всё, что нужно интерфейсу и отрисовке', () => {
    for (const id of CLASS_ORDER) {
        const def = CLASSES[id];
        assert.ok(def.name && def.description, `${id}: имя и описание`);
        assert.ok(def.weapon, `${id}: оружие`);
        for (const key of ['h', 'H', 'c', 'C']) assert.ok(def.palette[key], `${id}: цвет ${key}`);
        assert.ok(def.attack.name, `${id}: название атаки`);
        assert.ok(def.ability.name, `${id}: название способности`);
    }
});

test('снаряды классов описаны', () => {
    for (const id of CLASS_ORDER) {
        for (const move of [CLASSES[id].attack, CLASSES[id].ability]) {
            if (move.type === 'projectile') assert.ok(PROJECTILES[move.projectile], move.projectile);
        }
    }
    assert.equal(PROJECTILES.arrow.gravity > 0, true, 'стрела летит по дуге');
    assert.equal(PROJECTILES.bolt.gravity, 0, 'шар летит по прямой');
    assert.equal(PROJECTILES.piercingArrow.pierce, true);
});
