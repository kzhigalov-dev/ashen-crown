import test from 'node:test';
import assert from 'node:assert/strict';
import { Settings, defaultSettings, SETTINGS_KEY } from '../js/systems/Settings.js';
import { memoryStorage } from './helpers.js';

test('без сохранённых настроек — значения по умолчанию', () => {
    assert.deepEqual(new Settings(memoryStorage()).load(), defaultSettings());
});

test('настройка сохраняется и читается после перезагрузки', () => {
    const storage = memoryStorage();
    const settings = new Settings(storage);
    settings.load();
    settings.set('volume', 0.8);
    settings.set('shake', false);
    settings.set('notes', false);
    assert.deepEqual(new Settings(storage).load(), { volume: 0.8, music: 0.5, shake: false, notes: false, lootPopup: true });
});

test('негодные значения заменяются по одному, годные остаются', () => {
    const storage = memoryStorage();
    storage.setItem(SETTINGS_KEY, JSON.stringify({ volume: 9, music: 0.1, shake: 'да', lootPopup: false, notes: 0 }));
    assert.deepEqual(new Settings(storage).load(), { volume: 0.5, music: 0.1, shake: true, notes: true, lootPopup: false });
});

test('битые данные и отсутствие хранилища не ломают игру', () => {
    const storage = memoryStorage();
    storage.setItem(SETTINGS_KEY, '{oops');
    assert.deepEqual(new Settings(storage).load(), defaultSettings());

    const none = new Settings(null);
    assert.deepEqual(none.load(), defaultSettings());
    assert.doesNotThrow(() => none.set('volume', 0.1));
    assert.equal(none.values.volume, 0.1, 'до перезагрузки настройка действует');
});
