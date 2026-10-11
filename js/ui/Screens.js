// HTML-экраны поверх игрового поля: меню, выбор класса, пауза, победа, поражение.
export class Screens {
    constructor(root) {
        this.root = root;
        this.screens = {
            menu: root.getElementById('screen-menu'),
            classSelect: root.getElementById('screen-class'),
            paused: root.getElementById('screen-paused'),
            complete: root.getElementById('screen-complete'),
            dead: root.getElementById('screen-dead'),
        };
        this.pauseButton = root.getElementById('btn-pause');
        this.classList = root.getElementById('class-list');
    }

    // handlers: { start, resume, restart, pause, menu } — по значению data-action.
    bind(handlers) {
        for (const button of this.root.querySelectorAll('[data-action]')) {
            button.addEventListener('click', () => handlers[button.dataset.action]());
        }
    }

    // Строит карточки классов из данных.
    //   portrait(id) — canvas со спрайтом героя; onPick(id) — выбор класса.
    renderClasses(classes, order, portrait, onPick) {
        this.classList.replaceChildren();
        for (const id of order) {
            const def = classes[id];
            const card = this.root.createElement('button');
            card.className = 'class-card';

            // Копия спрайта: один canvas нельзя вставить в страницу дважды.
            const source = portrait(id);
            const picture = this.root.createElement('canvas');
            picture.width = source.width;
            picture.height = source.height;
            picture.getContext('2d').drawImage(source, 0, 0);
            picture.className = 'portrait';
            picture.setAttribute('aria-hidden', 'true');

            const name = this.root.createElement('strong');
            name.textContent = def.name;
            const text = this.root.createElement('span');
            text.textContent = def.description;
            const stats = this.root.createElement('small');
            const mana = def.maxMana > 0 ? ` · Мана ${def.maxMana}` : '';
            stats.textContent = `Здоровье ${def.maxHp}${mana} · J: ${def.attack.name} · K: ${def.ability.name}`;

            card.append(picture, name, text, stats);
            card.addEventListener('click', () => onPick(id));
            this.classList.append(card);
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
        // Фокус на первую кнопку экрана — им можно управлять с клавиатуры.
        const active = this.screens[state];
        if (active) active.querySelector('button').focus();
    }
}
