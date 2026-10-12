import { SLOTS, SLOT_NAMES, STATS, STAT_ORDER, INVENTORY_SIZE } from '../data/items.js';
import { ENEMIES } from '../data/enemies.js';
import { WEAPONS } from '../data/weapons.js';
import { rarityOf, dismantleValue } from '../systems/Loot.js';
import { PROLOGUE, STORY, EPILOGUE } from '../data/story.js';

const CLICK_GUARD = 350;                // мс: окно находки не реагирует на нажатия сразу после появления
const TYPE_SPEED = 48;                 // букв в секунду при «печати» сюжетного текста
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const TIPS = [
    'Костёр полностью лечит — но только один раз за вылазку.',
    'Метка на полу и мигание врага предупреждают об ударе: уходи заранее.',
    'Снаряжение с врагов надевается на карте. Лишнее разбирай в золото.',
    'Прыжок тем выше, чем дольше держишь клавишу.',
];

// Состояния игры и экраны, которые им соответствуют.
const STATE_SCREENS = {
    menu: 'menu', classSelect: 'class', map: 'map', equipment: 'equipment', story: 'story',
    paused: 'paused', loot: 'loot', complete: 'complete', victory: 'victory', dead: 'dead',
};
// Страницы меню, у которых нет своего состояния игры.
const PAGES = ['controls', 'settings', 'about', 'prologue'];

const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

// HTML-экраны поверх игрового поля.
export class Screens {
    // art — источник картинок: portrait(classId), crown(cleared), thumbnail(levelDef);
    // worlds — миры игры (для карты).
    constructor(root, art, worlds) {
        this.root = root;
        this.art = art;
        this.worlds = worlds;
        this.byId = (id) => root.getElementById(id);
        this.screens = {};
        for (const name of [...Object.values(STATE_SCREENS), ...PAGES]) {
            this.screens[name] = this.byId(`screen-${name}`);
        }
        this.pauseButton = this.byId('btn-pause');
        this.handlers = {};
        this.game = null;
        this.state = 'menu';
        this.page = null;         // открытая страница меню (управление, настройки…)
        this.prologueIndex = 0;
        this.typing = null;       // «печатающийся» текст: { element, text, start, done }
        this.selected = null;     // выбранный предмет: { from: 'bag', index } или { from: 'slot', slot }
        this.shownAt = 0;         // когда показан текущий экран
        this.reducedMotion = root.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    }

    // handlers — действия по значению data-action, а также
    // play(index), equip(index), unequip(slot), dismantle(index),
    // setting(key, value), sound(name), classes().
    bind(handlers) {
        this.handlers = handlers;
        const actions = {
            ...handlers,
            new: () => this.openPrologue(),
            begin: () => this.advance(() => handlers.begin()),
            // Окно находки появляется посреди боя: случайное нажатие в первый миг не считается.
            lootEquip: () => this.guarded(() => handlers.lootEquip()),
            lootKeep: () => this.guarded(() => handlers.lootKeep()),
            prologueNext: () => this.advance(() => this.nextPrologue()),
            prologueSkip: () => this.closePrologue(),
        };
        for (const button of this.root.querySelectorAll('[data-action]')) {
            button.addEventListener('click', () => actions[button.dataset.action]());
        }
        for (const button of this.root.querySelectorAll('[data-page]')) {
            button.addEventListener('click', () => this.open(button.dataset.page));
        }
        for (const button of this.root.querySelectorAll('[data-back]')) {
            button.addEventListener('click', () => this.back());
        }

        this.byId('set-volume').addEventListener('input', (event) => handlers.setting('volume', event.target.value / 100));
        this.byId('set-music').addEventListener('input', (event) => handlers.setting('music', event.target.value / 100));
        this.byId('set-shake').addEventListener('change', (event) => handlers.setting('shake', event.target.checked));

        // Звук нажатия для всех кнопок экранов.
        this.root.addEventListener('click', (event) => {
            if (event.target.closest?.('.screen button')) handlers.sound('confirm');
        });
        // Стрелки двигают выбор, Esc возвращает назад. Слушаем на этапе погружения,
        // чтобы обработать Esc раньше игры: иначе она сняла бы паузу.
        this.root.addEventListener('keydown', (event) => this.onKey(event), true);
    }

    onKey(event) {
        const active = this.current();
        if (!active) return;
        if (event.code === 'Escape' && this.page) {
            event.stopPropagation();
            event.preventDefault();
            if (this.page === 'prologue') this.closePrologue();
            else this.back();
            return;
        }
        const step = { ArrowDown: 1, ArrowUp: -1 }[event.code];
        if (!step) return;
        const items = [...active.querySelectorAll('button:not(:disabled):not([hidden]), input')];
        if (items.length === 0) return;
        event.preventDefault();
        const index = items.indexOf(this.root.activeElement);
        items[(index + step + items.length) % items.length].focus();
        this.handlers.sound('ui');
    }

    guarded(action) {
        if (performance.now() - this.shownAt >= CLICK_GUARD) action();
    }

    // Экран, который сейчас показан.
    current() {
        return this.screens[this.page ?? STATE_SCREENS[this.state]] ?? null;
    }

    // Создаёт элемент с классом и текстом.
    el(tag, className = '', text = '') {
        const element = this.root.createElement(tag);
        if (className) element.className = className;
        if (text !== '') element.textContent = text;
        return element;
    }

    // Копия картинки: один canvas нельзя вставить в страницу дважды.
    copy(source, target = this.root.createElement('canvas')) {
        target.width = source.width;
        target.height = source.height;
        target.getContext('2d').drawImage(source, 0, 0);
        target.setAttribute('aria-hidden', 'true');
        return target;
    }

    // ---------- Показ экранов ----------

    onState(state, game) {
        this.state = state;
        this.game = game;
        this.page = null;
        this.typing = null;

        if (state === 'menu') {
            this.byId('btn-continue').hidden = !game.hasSave;
            this.byId('save-warning').hidden = game.save.available;
            this.copy(this.art.crown(game.crowns), this.byId('title-crown'));
        } else if (state === 'classSelect') {
            this.byId('reset-warning').hidden = !game.hasSave;
        } else if (state === 'map') {
            this.selected = null;
            this.renderMap(game);
        } else if (state === 'equipment') {
            this.renderEquipment(game);
        } else if (state === 'story') {
            this.byId('story-index').textContent = `${game.levelDef.worldName} · уровень ${ROMAN[game.levelDef.number - 1]}`;
            this.byId('story-title').textContent = game.levelDef.name;
            this.type(this.byId('story-text'), STORY[game.levelDef.id] ?? '');
        } else if (state === 'complete') {
            this.byId('complete-title').textContent = game.levelDef.name;
            this.renderStats(this.byId('complete-stats'), game);
        } else if (state === 'victory') {
            this.copy(this.art.crown(this.worlds.length), this.byId('victory-crown'));
            this.type(this.byId('victory-text'), EPILOGUE.join('\n\n'));
            this.renderStats(this.byId('victory-stats'), game);
        } else if (state === 'loot') {
            this.renderLoot(game);
        } else if (state === 'dead') {
            this.byId('dead-tip').textContent = TIPS[(game.stats.hits + game.levelIndex) % TIPS.length];
        }
        this.show();
    }

    // Показывает текущий экран, прячет остальные и ставит фокус —
    // экранами можно управлять с клавиатуры.
    show() {
        const active = this.current();
        this.shownAt = performance.now();
        for (const element of Object.values(this.screens)) element.hidden = element !== active;
        this.pauseButton.hidden = this.state !== 'playing';
        if (!active) return;
        const target = active.querySelector('.item.selected')
            ?? active.querySelector('.step:not(.done):not(:disabled)')
            ?? active.querySelector('button:not(:disabled):not([hidden])');
        target?.focus();
    }

    // Открывает страницу меню поверх текущего состояния.
    open(page) {
        this.page = page;
        this.show();
    }

    back() {
        this.page = null;
        this.show();
    }

    syncSettings(values) {
        this.byId('set-volume').value = Math.round(values.volume * 100);
        this.byId('set-music').value = Math.round(values.music * 100);
        this.byId('set-shake').checked = values.shake;
    }

    // ---------- Сюжетный текст ----------

    // Текст появляется буква за буквой. Полный текст сразу отдан экранному диктору.
    type(element, text) {
        element.setAttribute('aria-label', text);
        if (this.reducedMotion) {
            element.textContent = text;
            this.typing = null;
            return;
        }
        element.textContent = '';
        this.typing = { element, text, start: null, done: false };
    }

    // Вызывается каждый кадр: продвигает «печать».
    update(time) {
        const typing = this.typing;
        if (!typing || typing.done) return;
        typing.start ??= time;
        const count = Math.floor((time - typing.start) * TYPE_SPEED);
        typing.element.textContent = typing.text.slice(0, count);
        typing.done = count >= typing.text.length;
    }

    // Кнопка «Дальше»: первое нажатие допечатывает текст, второе — идёт дальше.
    advance(next) {
        if (this.typing && !this.typing.done) {
            this.typing.element.textContent = this.typing.text;
            this.typing.done = true;
            return;
        }
        next();
    }

    openPrologue() {
        this.prologueIndex = 0;
        this.open('prologue');
        this.showPrologue();
    }

    showPrologue() {
        this.byId('prologue-count').textContent = `Пролог · ${this.prologueIndex + 1} из ${PROLOGUE.length}`;
        this.type(this.byId('prologue-text'), PROLOGUE[this.prologueIndex]);
    }

    nextPrologue() {
        this.prologueIndex++;
        if (this.prologueIndex >= PROLOGUE.length) this.closePrologue();
        else this.showPrologue();
    }

    closePrologue() {
        this.typing = null;
        this.handlers.classes();
    }

    // ---------- Выбор класса ----------

    renderClasses(classes, order, onPick) {
        const list = this.byId('class-list');
        list.replaceChildren();
        for (const id of order) {
            const def = classes[id];
            const card = this.el('button', 'class-card');
            const picture = this.copy(this.art.portrait(id));
            picture.className = 'portrait';
            const mana = def.maxMana > 0 ? ` · Мана ${def.maxMana}` : '';
            const weapon = WEAPONS[def.starter];
            card.append(
                picture,
                this.el('strong', '', def.name),
                this.el('span', '', def.description),
                this.el('small', '', `Здоровье ${def.maxHp}${mana}`),
                this.el('small', '', `Начинает с оружием «${weapon.name}»: J — ${weapon.attack.name}, K — ${weapon.ability.name}`)
            );
            card.addEventListener('click', () => onPick(id));
            list.append(card);
        }
    }

    // ---------- Карта ----------

    // Карта: три мира, в каждом пять уровней. Пятый — логово стража.
    renderMap(game) {
        const { profile, levels, cleared, crowns } = game;
        this.byId('map-gold').textContent = profile.gold;
        this.byId('map-best').textContent = profile.bestRun;
        this.copy(this.art.crown(crowns), this.byId('map-crown'));
        this.byId('map-crown-text').textContent = crowns >= this.worlds.length
            ? 'Корона собрана. Земли открыты для охоты за снаряжением.'
            : `Зубцов короны возвращено: ${crowns} из ${this.worlds.length}`;

        const list = this.byId('map-list');
        list.replaceChildren();
        for (const world of this.worlds) {
            const column = this.el('section', 'world');
            const indices = levels.map((level, index) => index).filter((index) => levels[index].world === world.id);
            const bossDown = indices.every((index) => index < cleared);
            const reached = game.isOpen(indices[0]);
            if (!reached) column.classList.add('locked');

            const thumb = this.copy(this.art.thumbnail(levels[indices[0]]));
            let status = 'Путь закрыт';
            if (bossDown) status = `${ENEMIES[world.boss].name} повержен`;
            else if (reached) status = `Страж: ${ENEMIES[world.boss].name}`;
            column.append(thumb, this.el('strong', '', world.name), this.el('small', bossDown ? 'done' : '', status));

            const steps = this.el('div', 'steps');
            for (const index of indices) {
                const level = levels[index];
                const done = index < cleared;
                const mark = done ? '✓' : ROMAN[level.number - 1];
                const button = this.el('button', done ? 'step done' : 'step');
                button.disabled = !game.isOpen(index);
                button.append(this.el('span', 'step-mark', mark), this.el('span', '', level.name));
                if (level.boss) button.append(this.el('span', 'step-boss', 'страж'));
                button.addEventListener('click', () => this.handlers.play(index));
                steps.append(button);
            }
            column.append(steps);
            list.append(column);
        }
    }

    // Итоги вылазки: время, враги, ранения, золото.
    renderStats(list, game) {
        list.replaceChildren();
        const rows = [
            ['Время', formatTime(game.time)],
            ['Врагов повержено', game.stats.kills],
            ['Ранений получено', game.stats.hits],
            ['Золота вынесено', game.gold],
        ];
        for (const [name, value] of rows) list.append(this.el('dt', '', name), this.el('dd', '', String(value)));
    }

    // ---------- Снаряжение ----------

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
            this.renderEquipment(game);
            this.show();
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

    // Окно находки: что найдено, чем отличается от надетого и что с ним сделать.
    renderLoot(game) {
        const { item, index } = game.found;
        const { inventory } = game.profile;
        const detail = this.byId('loot-detail');
        detail.replaceChildren();
        const worn = inventory.equipped[item.slot];
        this.describe(detail, item, worn);
        detail.append(this.el('p', '', worn ? `Сейчас надето: ${worn.name}` : 'В этом слоте пока пусто.'));

        // Сумка полна: надеть можно (прежний предмет разберётся), оставить — нельзя.
        const full = index === null;
        this.byId('loot-equip').textContent = full && worn
            ? `Надеть (прежний разберётся: +${dismantleValue(worn)} золота)`
            : 'Надеть';
        this.byId('loot-keep').textContent = full
            ? `Сумка полна — разобрать (+${dismantleValue(item)} золота)`
            : 'В сумку';
    }

    // Пишет в контейнер описание предмета: название, слот, что даёт вид оружия
    // и свойства. worn — надетый в том же слоте предмет: показывается разница с ним.
    describe(container, item, worn = null) {
        container.style.setProperty('--rarity', rarityOf(item).color);
        container.append(this.el('strong', '', item.name), this.el('p', '', SLOT_NAMES[item.slot]));

        const weapon = WEAPONS[item.kind];
        if (weapon) {
            container.append(
                this.el('p', 'moves', weapon.text),
                this.el('p', 'moves', `J — ${weapon.attack.name}`),
                this.el('p', 'moves', `K — ${weapon.ability.name}: ${weapon.ability.text}`)
            );
        }

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
        container.append(list);
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
            const empty = inventory.items.length === 0
                ? 'Сумка пуста. Снаряжение падает с врагов — чаще всего с боссов.'
                : 'Выбери предмет, чтобы увидеть свойства.';
            detail.append(this.el('p', '', empty));
            return;
        }

        // Для предмета из сумки показываем разницу с надетым в том же слоте.
        this.describe(detail, item, fromBag ? inventory.equipped[item.slot] : null);

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
