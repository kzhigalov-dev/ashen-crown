import { SLOTS, STAT_ORDER, INVENTORY_SIZE } from '../data/items.js';
import { dismantleValue } from './Loot.js';

// Сумка героя и надетое снаряжение. Работает по номеру ячейки сумки.
export class Inventory {
    constructor() {
        this.equipped = { weapon: null, armor: null, amulet: null };
        this.items = [];
    }

    get full() {
        return this.items.length >= INVENTORY_SIZE;
    }

    // Кладёт предмет в сумку. false — места нет.
    add(item) {
        if (this.full) return false;
        this.items.push(item);
        return true;
    }

    // Надевает предмет из ячейки. Прежний предмет слота занимает её место.
    equip(index) {
        const item = this.items[index];
        if (!item) return false;
        const previous = this.equipped[item.slot];
        this.equipped[item.slot] = item;
        if (previous) this.items[index] = previous;
        else this.items.splice(index, 1);
        return true;
    }

    // Снимает предмет в сумку. false — слот пуст или в сумке нет места.
    unequip(slot) {
        const item = this.equipped[slot];
        if (!item || this.full) return false;
        this.equipped[slot] = null;
        this.items.push(item);
        return true;
    }

    // Разбирает предмет из ячейки, возвращает полученное золото.
    dismantle(index) {
        const item = this.items[index];
        if (!item) return 0;
        this.items.splice(index, 1);
        return dismantleValue(item);
    }

    // Сумма свойств надетого снаряжения.
    totals() {
        const totals = Object.fromEntries(STAT_ORDER.map((stat) => [stat, 0]));
        for (const slot of SLOTS) {
            const item = this.equipped[slot];
            if (!item) continue;
            for (const [stat, value] of Object.entries(item.stats)) totals[stat] += value;
        }
        return totals;
    }

    toJSON() {
        return { equipped: this.equipped, items: this.items };
    }

    static from(data) {
        const inventory = new Inventory();
        for (const slot of SLOTS) inventory.equipped[slot] = data.equipped[slot] ?? null;
        inventory.items = data.items.slice(0, INVENTORY_SIZE);
        return inventory;
    }
}
