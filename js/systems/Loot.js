import {
    RARITIES, RARITY_WEIGHTS, LOCATION_TIER, TIER_MULT, SLOTS, ITEM_NAMES,
    STATS, STAT_ORDER, SLOT_BASE_STAT, AFFIX_SCALE, AMULET_SCALE, DROP_CHANCE, BOSS_MIN_RARITY,
} from '../data/items.js';
import { CLASSES } from '../data/classes.js';
import { WEAPONS } from '../data/weapons.js';

// Везде rng — функция, возвращающая число от 0 (включительно) до 1.
// В игре это Math.random, в тестах — предсказуемая подмена.

function pick(list, rng) {
    return list[Math.floor(rng() * list.length)];
}

// Выбирает индекс редкости по весам. minIndex отсекает редкости ниже заданной.
export function rollRarity(weights, rng, minIndex = 0) {
    const allowed = weights.map((weight, index) => (index >= minIndex ? weight : 0));
    const total = allowed.reduce((sum, weight) => sum + weight, 0);
    if (total === 0) return minIndex;
    let roll = rng() * total;
    for (let index = 0; index < allowed.length; index++) {
        roll -= allowed[index];
        if (roll < 0) return index;
    }
    return allowed.length - 1;
}

// Создаёт предмет. Оружие всегда подходит классу героя; его вид (меч, секира,
// копьё…) выбирается случайно — от вида зависят атака и способность.
export function generateItem({ locationId, classId, rng, minRarity = 0 }) {
    const weights = RARITY_WEIGHTS[locationId] ?? RARITY_WEIGHTS.forest;
    const tier = LOCATION_TIER[locationId] ?? 1;
    const rarity = RARITIES[rollRarity(weights, rng, minRarity)];
    const slot = pick(SLOTS, rng);
    const weapon = slot === 'weapon' ? WEAPONS[pick(CLASSES[classId].weapons, rng)] : null;
    const scale = TIER_MULT[tier] * rarity.mult;

    const stats = {};
    const baseStat = SLOT_BASE_STAT[slot] ?? pick(STAT_ORDER, rng);
    const baseScale = slot === 'amulet' ? AMULET_SCALE : 1;
    stats[baseStat] = Math.round(STATS[baseStat].base * scale * baseScale);

    // Случайные свойства не повторяют уже имеющиеся.
    for (let i = 0; i < rarity.affixes; i++) {
        const free = STAT_ORDER.filter((stat) => !(stat in stats));
        const stat = pick(free, rng);
        stats[stat] = Math.max(1, Math.round(STATS[stat].base * scale * AFFIX_SCALE));
    }

    if (!weapon) {
        return { slot, rarity: rarity.id, tier, name: `${rarity.forms.m} ${ITEM_NAMES[slot]}`, stats };
    }
    return {
        slot, rarity: rarity.id, tier,
        name: `${rarity.forms[weapon.gender]} ${weapon.name}`,
        stats, classId, kind: weapon.id,
    };
}

// Что выпало из врага: предмет или null. С босса предмет гарантирован.
export function rollDrop({ locationId, classId, rng, boss = false }) {
    if (!boss && rng() >= DROP_CHANCE) return null;
    return generateItem({ locationId, classId, rng, minRarity: boss ? BOSS_MIN_RARITY : 0 });
}

export function rarityOf(item) {
    return RARITIES.find((rarity) => rarity.id === item.rarity);
}

// Сколько золота даёт разбор предмета.
export function dismantleValue(item) {
    return rarityOf(item).scrap * item.tier;
}
