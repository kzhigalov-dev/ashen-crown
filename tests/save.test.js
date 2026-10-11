import test from 'node:test';
import assert from 'node:assert/strict';
import { Save, defaultProfile, SAVE_KEY } from '../js/systems/Save.js';
import { memoryStorage } from './helpers.js';

const sword = { slot: 'weapon', rarity: 'rare', tier: 1, name: 'Редкий меч', stats: { damage: 5, crit: 3 }, classId: 'swordsman' };
const armor = { slot: 'armor', rarity: 'common', tier: 1, name: 'Обычный доспех', stats: { hp: 15 } };

function filledProfile() {
    const profile = defaultProfile('swordsman');
    profile.inventory.add({ ...sword });
    profile.inventory.add({ ...armor });
    profile.inventory.equip(0);
    profile.gold = 140;
    profile.bestRun = 95;
    profile.unlocked = 2;
    profile.volume = 0.3;
    return profile;
}

// Сохраняет хороший профиль, портит записанные данные и читает снова.
function loadCorrupted(mutate) {
    const storage = memoryStorage();
    const save = new Save(storage);
    save.write(filledProfile());
    const data = JSON.parse(storage.getItem(SAVE_KEY));
    mutate(data);
    storage.setItem(SAVE_KEY, JSON.stringify(data));
    return save.load();
}

test('новый профиль', () => {
    const profile = defaultProfile('mage');
    assert.equal(profile.classId, 'mage');
    assert.equal(profile.unlocked, 1);
    assert.equal(profile.gold, 0);
    assert.equal(profile.inventory.items.length, 0);
});

test('без сохранения load возвращает null', () => {
    const save = new Save(memoryStorage());
    assert.equal(save.available, true);
    assert.equal(save.load(), null);
});

test('запись и чтение возвращают тот же прогресс', () => {
    const save = new Save(memoryStorage());
    assert.equal(save.write(filledProfile()), true);
    const loaded = save.load();
    assert.equal(loaded.classId, 'swordsman');
    assert.equal(loaded.gold, 140);
    assert.equal(loaded.bestRun, 95);
    assert.equal(loaded.unlocked, 2);
    assert.equal(loaded.volume, 0.3);
    assert.deepEqual(loaded.inventory.equipped.weapon, sword);
    assert.deepEqual(loaded.inventory.items, [armor]);
    assert.deepEqual(loaded.inventory.totals(), { damage: 5, hp: 0, attackSpeed: 0, crit: 3 });
});

test('проба хранилища не оставляет мусора', () => {
    const storage = memoryStorage();
    new Save(storage);
    assert.equal(storage.data.size, 0);
});

test('битый JSON — сохранения нет', () => {
    const storage = memoryStorage();
    storage.setItem(SAVE_KEY, '{"version":1,"classId":');
    assert.equal(new Save(storage).load(), null);
});

test('другая версия — сохранения нет', () => {
    assert.equal(loadCorrupted((data) => { data.version = 99; }), null);
});

test('неизвестный класс — сохранения нет', () => {
    assert.equal(loadCorrupted((data) => { data.classId = 'necromancer'; }), null);
});

test('испорченные числа — сохранения нет', () => {
    assert.equal(loadCorrupted((data) => { data.gold = -5; }), null);
    assert.equal(loadCorrupted((data) => { data.gold = 'много'; }), null);
    assert.equal(loadCorrupted((data) => { data.volume = 7; }), null);
});

test('испорченный предмет — сохранения нет', () => {
    assert.equal(loadCorrupted((data) => { data.inventory[0].rarity = 'mythic'; }), null);
    assert.equal(loadCorrupted((data) => { data.inventory[0].stats = { luck: 5 }; }), null);
    assert.equal(loadCorrupted((data) => { data.equipped.weapon.slot = 'armor'; }), null);
    assert.equal(loadCorrupted((data) => { data.inventory = 'пусто'; }), null);
});

test('clear стирает сохранение', () => {
    const save = new Save(memoryStorage());
    save.write(filledProfile());
    save.clear();
    assert.equal(save.load(), null);
});

test('хранилище бросает ошибки: игра работает без сохранения', () => {
    const broken = {
        getItem() { throw new Error('denied'); },
        setItem() { throw new Error('denied'); },
        removeItem() { throw new Error('denied'); },
    };
    const save = new Save(broken);
    assert.equal(save.available, false);
    assert.equal(save.load(), null);
    assert.equal(save.write(filledProfile()), false);
    assert.doesNotThrow(() => save.clear());
});

test('хранилища нет вовсе', () => {
    const save = new Save(null);
    assert.equal(save.available, false);
    assert.equal(save.load(), null);
    assert.equal(save.write(filledProfile()), false);
});

test('хранилище переполнено при записи: write возвращает false', () => {
    const storage = memoryStorage();
    const save = new Save(storage);
    storage.setItem = () => { throw new Error('QuotaExceededError'); };
    assert.equal(save.write(filledProfile()), false);
});
