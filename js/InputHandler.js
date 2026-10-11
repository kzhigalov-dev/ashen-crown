// Клавиши задаются через event.code: это физическая клавиша,
// поэтому управление не зависит от раскладки (русская или английская).
export const KEY_MAP = {
    KeyA: 'left',
    ArrowLeft: 'left',
    KeyD: 'right',
    ArrowRight: 'right',
    Space: 'jump',
    KeyW: 'jump',
    ArrowUp: 'jump',
    KeyJ: 'attack',
    KeyK: 'ability',
    KeyP: 'pause',
    Escape: 'pause',
};

export class InputHandler {
    constructor(target) {
        this.target = target;
        this.codes = new Set();    // удерживаемые клавиши
        this.pressed = new Set();  // действия, нажатые с прошлого шага
        this.capture = false;      // true — гасим прокрутку страницы и т. п.

        this.onKeyDown = (event) => {
            const action = KEY_MAP[event.code];
            if (!action) return;
            if (this.capture) event.preventDefault();
            if (event.repeat) return;
            this.codes.add(event.code);
            this.pressed.add(action);
        };
        this.onKeyUp = (event) => {
            if (!KEY_MAP[event.code]) return;
            if (this.capture) event.preventDefault();
            this.codes.delete(event.code);
        };
        this.onBlur = () => this.reset();
    }

    attach() {
        this.target.addEventListener('keydown', this.onKeyDown);
        this.target.addEventListener('keyup', this.onKeyUp);
        this.target.addEventListener('blur', this.onBlur);
    }

    detach() {
        this.target.removeEventListener('keydown', this.onKeyDown);
        this.target.removeEventListener('keyup', this.onKeyUp);
        this.target.removeEventListener('blur', this.onBlur);
        this.reset();
    }

    reset() {
        this.codes.clear();
        this.pressed.clear();
    }

    isDown(action) {
        for (const code of this.codes) {
            if (KEY_MAP[code] === action) return true;
        }
        return false;
    }

    wasPressed(action) {
        return this.pressed.has(action);
    }

    consume(action) {
        return this.pressed.delete(action);
    }

    endStep() {
        this.pressed.clear();
    }
}
