import { Inventory } from './Inventory.js';
import { CLASSES } from '../data/classes.js';
import { RARITIES, SLOTS, STATS } from '../data/items.js';

export const SAVE_KEY = 'ashen-crown-save';
export const SAVE_VERSION = 1;

// Прогресс игрока. Создаётся при начале новой игры.
export function defaultProfile(classId) {
    return {
        classId,
        inventory: new Inventory(),
        unlocked: 1,   // сколько локаций открыто
        gold: 0,       // всё накопленное золото
        bestRun: 0,    // рекорд золота за один пройденный уровень
        volume: 0.5,
    };
}

function isItem(item) {
    if (!item || typeof item !== 'object') return false;
    if (!SLOTS.includes(item.slot)) return false;
    if (!RARITIES.some((rarity) => rarity.id === item.rarity)) return false;
    if (typeof item.name !== 'string' || !Number.isFinite(item.tier)) return false;
    if (!item.stats || typeof item.stats !== 'object') return false;
    return Object.entries(item.stats).every(([stat, value]) => stat in STATS && Number.isFinite(value));
}

const isCount = (value) => Number.isFinite(value) && value >= 0;

// Проверяет разобранные данные. Любое сомнение — сохранение считается негодным.
function parseProfile(data) {
    if (!data || data.version !== SAVE_VERSION) return null;
    if (!(data.classId in CLASSES)) return null;
    if (!isCount(data.gold) || !isCount(data.bestRun) || !isCount(data.unlocked)) return null;
    if (!isCount(data.volume) || data.volume > 1) return null;
    if (!data.equipped || !Array.isArray(data.inventory)) return null;
    if (!data.inventory.every(isItem)) return null;
    for (const slot of SLOTS) {
        const item = data.equipped[slot];
        if (item !== null && item !== undefined && !(isItem(item) && item.slot === slot)) return null;
    }
    return {
        classId: data.classId,
        inventory: Inventory.from({ equipped: data.equipped, items: data.inventory }),
        unlocked: Math.max(1, Math.floor(data.unlocked)),
        gold: data.gold,
        bestRun: data.bestRun,
        volume: data.volume,
    };
}

// Чтение и запись прогресса. storage — объект с интерфейсом localStorage;
// может быть null или бросать ошибки (приватный режим, запрет в браузере).
export class Save {
    constructor(storage) {
        this.storage = storage;
        this.available = false;
        try {
            storage.setItem(`${SAVE_KEY}-probe`, '1');
            storage.removeItem(`${SAVE_KEY}-probe`);
            this.available = true;
        } catch {
            this.available = false;
        }
    }

    // Возвращает профиль или null, если сохранения нет или оно испорчено.
    load() {
        if (!this.available) return null;
        try {
            return parseProfile(JSON.parse(this.storage.getItem(SAVE_KEY)));
        } catch {
            return null;
        }
    }

    write(profile) {
        if (!this.available) return false;
        const { equipped, items } = profile.inventory.toJSON();
        const data = {
            version: SAVE_VERSION,
            classId: profile.classId,
            equipped,
            inventory: items,
            unlocked: profile.unlocked,
            gold: profile.gold,
            bestRun: profile.bestRun,
            volume: profile.volume,
        };
        try {
            this.storage.setItem(SAVE_KEY, JSON.stringify(data));
            return true;
        } catch {
            return false;
        }
    }

    clear() {
        if (!this.available) return;
        try {
            this.storage.removeItem(SAVE_KEY);
        } catch {
            // Хранилище недоступно — стирать нечего.
        }
    }
}
