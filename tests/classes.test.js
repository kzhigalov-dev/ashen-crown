import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES, CLASS_ORDER } from '../js/data/classes.js';
import { WEAPONS, PROJECTILES } from '../js/data/weapons.js';

test('три класса в порядке показа', () => {
    assert.deepEqual(CLASS_ORDER, ['swordsman', 'archer', 'mage']);
    for (const id of CLASS_ORDER) assert.equal(CLASSES[id].id, id);
});

test('здоровье и мана классов', () => {
    const { swordsman, archer, mage } = CLASSES;
    assert.deepEqual([swordsman.maxHp, archer.maxHp, mage.maxHp], [120, 90, 70]);
    assert.equal(archer.extraJumps, 1);
    assert.equal(mage.maxMana, 100);
    assert.equal(mage.manaRegen, 14, 'подстроено при балансе, в спецификации было 8');
});

test('у каждого класса три вида оружия, начальное — одно из них', () => {
    for (const id of CLASS_ORDER) {
        const def = CLASSES[id];
        assert.ok(def.name && def.description, `${id}: имя и описание`);
        assert.equal(def.weapons.length, 3);
        assert.ok(def.weapons.includes(def.starter));
        for (const kind of def.weapons) assert.equal(WEAPONS[kind].classId, id, `${kind} принадлежит классу`);
    }
});

test('начальное оружие сохраняет числа из спецификации', () => {
    const { sword, bow, fireStaff } = WEAPONS;
    assert.deepEqual([sword.attack.damage, bow.attack.damage, fireStaff.attack.damage], [14, 10, 16]);
    assert.deepEqual([sword.attack.cooldown, bow.attack.cooldown, fireStaff.attack.cooldown], [0.4, 0.5, 0.45]);
    assert.deepEqual([sword.ability.cooldown, bow.ability.cooldown, fireStaff.ability.cooldown], [4, 5, 6]);
    assert.equal(fireStaff.attack.manaCost, 12);
    assert.equal(fireStaff.ability.manaCost, 30);
});

test('каждый вид оружия описан полностью', () => {
    for (const [id, weapon] of Object.entries(WEAPONS)) {
        assert.equal(weapon.id, id);
        assert.ok(weapon.name && weapon.text && weapon.sprite, `${id}: название, описание, облик`);
        assert.ok(['m', 'f', 'n'].includes(weapon.gender), `${id}: род`);
        assert.ok(weapon.attack.name && weapon.attack.damage > 0 && weapon.attack.cooldown > 0, `${id}: атака`);
        assert.ok(weapon.ability.name && weapon.ability.text && weapon.ability.cooldown > 0, `${id}: способность`);
        for (const move of [weapon.attack, weapon.ability]) {
            if (move.type === 'projectile') assert.ok(PROJECTILES[move.projectile], `${id}: снаряд ${move.projectile}`);
        }
    }
});

test('виды оружия одного класса отличаются и атакой, и способностью', () => {
    for (const id of CLASS_ORDER) {
        const kinds = CLASSES[id].weapons.map((kind) => WEAPONS[kind]);
        assert.equal(new Set(kinds.map((weapon) => weapon.attack.name)).size, 3, `${id}: атаки`);
        assert.equal(new Set(kinds.map((weapon) => weapon.ability.name)).size, 3, `${id}: способности`);
        assert.equal(new Set(kinds.map((weapon) => weapon.sprite)).size, 3, `${id}: облик`);
    }
});

test('свойства снарядов', () => {
    assert.ok(PROJECTILES.arrow.gravity > 0, 'стрела летит по дуге');
    assert.equal(PROJECTILES.quarrel.gravity, 0, 'болт летит по прямой');
    assert.equal(PROJECTILES.piercingArrow.pierce, true);
    assert.equal(PROJECTILES.spark.pierce, true);
    assert.ok(PROJECTILES.shard.stun > 0, 'осколок замораживает');
    assert.ok(PROJECTILES.spark.speed > PROJECTILES.flame.speed * 2, 'молния гораздо быстрее шара');
});
