// HTML-экраны поверх игрового поля: меню, пауза, победа, поражение.
export class Screens {
    constructor(root) {
        this.root = root;
        this.screens = {
            menu: root.getElementById('screen-menu'),
            paused: root.getElementById('screen-paused'),
            complete: root.getElementById('screen-complete'),
            dead: root.getElementById('screen-dead'),
        };
        this.pauseButton = root.getElementById('btn-pause');
    }

    // handlers: { start, resume, restart, pause, menu } — по значению data-action.
    bind(handlers) {
        for (const button of this.root.querySelectorAll('[data-action]')) {
            button.addEventListener('click', () => handlers[button.dataset.action]());
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
