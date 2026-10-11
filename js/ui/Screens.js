import { SLOTS, SLOT_NAMES, STATS, STAT_ORDER, INVENTORY_SIZE } from '../data/items.js';
import { rarityOf, dismantleValue } from '../systems/Loot.js';
import { STORY } from '../data/story.js';

// HTML-экраны поверх игрового поля: меню, выбор класса, карта, снаряжение,
// пауза, победа, поражение.
export class Screens {
    constructor(root) {
        this.root = root;
        const byId = (id) => root.getElementById(id);
        this.screens = {
            menu: byId('screen-menu'),
            classSelect: byId('screen-class'),
            map: byId('screen-map'),
            story: byId('screen-story'),
            victory: byId('screen-victory'),
            equipment: byId('screen-equipment'),
            paused: byId('screen-paused'),
            complete: byId('screen-complete'),
            dead: byId('screen-dead'),
        };
        this.pauseButton = byId('btn-pause');
        this.byId = byId;
        this.handlers = {};
        // Выбранный предмет на экране снаряжения:
        // { from: 'bag', index } или { from: 'slot', slot }.
        this.selected = null;
    }

    // handlers — действия по значению data-action, а также
    // play(index), equip(index), unequip(slot), dismantle(index), volume(value).
    bind(handlers) {
        this.handlers = handlers;
        for (const button of this.root.querySelectorAll('[data-action]')) {
            button.addEventListener('click', () => handlers[button.dataset.action]());
        }
        // Ползунки громкости в меню и в паузе управляют одним значением.
        for (const slider of this.root.querySelectorAll('.volume-input')) {
            slider.addEventListener('input', () => handlers.volume(Number(slider.value) / 100));
        }
    }

    // Создаёт элемент с классом и текстом.
    el(tag, className = '', text = '') {
        const element = this.root.createElement(tag);
        if (className) element.className = className;
        if (text) element.textContent = text;
        return element;
    }

    // Строит карточки классов из данных.
    //   portrait(id) — canvas со спрайтом героя; onPick(id) — выбор класса.
    renderClasses(classes, order, portrait, onPick) {
        const list = this.byId('class-list');
        list.replaceChildren();
        for (const id of order) {
            const def = classes[id];
            const card = this.el('button', 'class-card');

            // Копия спрайта: один canvas нельзя вставить в страницу дважды.
            const source = portrait(id);
            const picture = this.el('canvas', 'portrait');
            picture.width = source.width;
            picture.height = source.height;
            picture.getContext('2d').drawImage(source, 0, 0);
            picture.setAttribute('aria-hidden', 'true');

            const mana = def.maxMana > 0 ? ` · Мана ${def.maxMana}` : '';
            card.append(
                picture,
                this.el('strong', '', def.name),
                this.el('span', '', def.description),
                this.el('small', '', `Здоровье ${def.maxHp}${mana} · J: ${def.attack.name} · K: ${def.ability.name}`)
            );
            card.addEventListener('click', () => onPick(id));
            list.append(card);
        }
    }

    onState(state, game) {
        for (const [name, element] of Object.entries(this.screens)) {
            element.hidden = name !== state;
        }
        this.pauseButton.hidden = state !== 'playing';
        for (const element of this.root.querySelectorAll('[data-gold]')) {
            element.textContent = game.gold;
        }
        for (const slider of this.root.querySelectorAll('.volume-input')) {
            slider.value = Math.round(game.volume * 100);
        }

        if (state === 'menu') {
            this.byId('btn-continue').hidden = !game.hasSave;
            this.byId('save-warning').hidden = game.save.available;
        } else if (state === 'classSelect') {
            this.byId('reset-warning').hidden = !game.hasSave;
        } else if (state === 'map') {
            this.selected = null;
            this.renderMap(game);
        } else if (state === 'equipment') {
            this.renderEquipment(game);
        } else if (state === 'story') {
            this.byId('story-title').textContent = game.levelDef.name;
            this.byId('story-text').textContent = STORY[game.levelDef.id] ?? '';
        } else if (state === 'victory') {
            this.byId('victory-text').textContent = STORY.victory;
        }

        // Фокус на выбранный предмет или первую доступную кнопку —
        // экранами можно управлять с клавиатуры.
        const active = this.screens[state];
        if (!active) return;
        const target = active.querySelector('.item.selected')
            ?? active.querySelector('button:not(:disabled):not([hidden])');
        target?.focus();
    }

    renderMap(game) {
        const { profile, levels } = game;
        this.byId('map-gold').textContent = profile.gold;
        this.byId('map-best').textContent = profile.bestRun;
        this.byId('map-cleared').hidden = profile.unlocked <= levels.length;
        const list = this.byId('map-list');
        list.replaceChildren();
        levels.forEach((level, index) => {
            const open = index < profile.unlocked;
            const button = this.el('button', '', `${index + 1}. ${level.name}${open ? '' : ' (закрыто)'}`);
            button.disabled = !open;
            button.addEventListener('click', () => this.handlers.play(index));
            list.append(button);
        });
    }

    // Кнопка-ячейка предмета. Пустая ячейка неактивна.
    // short — показывать только вид предмета («меч»): в тесной ячейке сумки
    // редкость видна по цвету, а полное название читает экранный диктор.
    itemButton(item, emptyText, selected, onClick, short = false) {
        const label = item && short ? item.name.split(' ').slice(1).join(' ') : item?.name;
        const button = this.el('button', 'item', item ? label : emptyText);
        if (!item) {
            button.disabled = true;
            return button;
        }
        button.title = item.name;
        button.setAttribute('aria-label', item.name);
        button.style.setProperty('--rarity', rarityOf(item).color);
        if (selected) button.classList.add('selected');
        button.addEventListener('click', onClick);
        return button;
    }

    renderEquipment(game) {
        const { inventory } = game.profile;
        const select = (selection) => {
            this.selected = selection;
            this.onState('equipment', game);
        };
        const picked = this.selected;

        const slots = this.byId('equip-slots');
        slots.replaceChildren();
        for (const slot of SLOTS) {
            const isPicked = picked?.from === 'slot' && picked.slot === slot;
            slots.append(this.itemButton(
                inventory.equipped[slot], `${SLOT_NAMES[slot]}: пусто`, isPicked,
                () => select({ from: 'slot', slot })
            ));
        }

        const totals = inventory.totals();
        const parts = STAT_ORDER
            .filter((stat) => totals[stat] > 0)
            .map((stat) => `${STATS[stat].name} +${totals[stat]}${STATS[stat].unit}`);
        this.byId('equip-totals').textContent = parts.length > 0 ? parts.join(' · ') : 'Бонусов пока нет.';

        const bag = this.byId('bag');
        bag.replaceChildren();
        for (let index = 0; index < INVENTORY_SIZE; index++) {
            const isPicked = picked?.from === 'bag' && picked.index === index;
            bag.append(this.itemButton(
                inventory.items[index], '·', isPicked,
                () => select({ from: 'bag', index }),
                true
            ));
        }
        this.byId('bag-count').textContent = `${inventory.items.length}/${INVENTORY_SIZE}`;

        this.renderDetail(inventory);
    }

    // Описание выбранного предмета и действия с ним.
    renderDetail(inventory) {
        const detail = this.byId('item-detail');
        detail.replaceChildren();
        const picked = this.selected;
        const fromBag = picked?.from === 'bag';
        const item = fromBag ? inventory.items[picked.index] : inventory.equipped[picked?.slot];
        if (!item) {
            this.selected = null;
            detail.append(this.el('p', '', 'Выбери предмет, чтобы увидеть свойства.'));
            return;
        }

        detail.style.setProperty('--rarity', rarityOf(item).color);
        detail.append(this.el('strong', '', item.name), this.el('p', '', SLOT_NAMES[item.slot]));

        // Для предмета из сумки показываем разницу с надетым в том же слоте.
        const worn = fromBag ? inventory.equipped[item.slot] : null;
        const list = this.el('ul');
        for (const stat of STAT_ORDER) {
            const value = item.stats[stat] ?? 0;
            const current = worn?.stats[stat] ?? 0;
            if (value === 0 && current === 0) continue;
            const { name, unit } = STATS[stat];
            const line = this.el('li', '', value > 0 ? `${name}: +${value}${unit}` : `${name}: —`);
            const diff = value - current;
            if (worn && diff !== 0) {
                line.append(' ', this.el('span', diff > 0 ? 'up' : 'down', `(${diff > 0 ? '+' : ''}${diff})`));
            }
            list.append(line);
        }
        detail.append(list);

        if (fromBag) {
            const equip = this.el('button', '', 'Надеть');
            equip.addEventListener('click', () => {
                this.selected = { from: 'slot', slot: item.slot };
                this.handlers.equip(picked.index);
            });
            const scrap = this.el('button', '', `Разобрать (+${dismantleValue(item)} золота)`);
            scrap.addEventListener('click', () => {
                this.selected = null;
                this.handlers.dismantle(picked.index);
            });
            detail.append(equip, scrap);
        } else {
            const remove = this.el('button', '', inventory.full ? 'Снять (сумка полна)' : 'Снять');
            remove.disabled = inventory.full;
            remove.addEventListener('click', () => {
                this.selected = { from: 'bag', index: inventory.items.length };
                this.handlers.unequip(picked.slot);
            });
            detail.append(remove);
        }
    }
}
