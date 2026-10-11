import { Game } from './Game.js';
import { InputHandler } from './InputHandler.js';
import { Renderer } from './Renderer.js';
import { Screens } from './ui/Screens.js';
import { Save } from './systems/Save.js';
import { AudioSystem } from './systems/Audio.js';
import { LEVELS } from './data/levels.js';
import { CLASSES, CLASS_ORDER } from './data/classes.js';

// Даже обращение к localStorage может бросить ошибку (приватный режим,
// запрет в настройках) — тогда игра работает без сохранения.
function openStorage() {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

// Звук синтезируется через Web Audio; контекст создаётся при первом действии игрока.
const audio = new AudioSystem(() => new (window.AudioContext ?? window.webkitAudioContext)());
for (const type of ['pointerdown', 'keydown']) {
    window.addEventListener(type, () => audio.unlock(), { once: true });
}

const renderer = new Renderer(document.getElementById('game'));
const input = new InputHandler(window);
const screens = new Screens(document);

const game = new Game({
    levels: LEVELS,
    input,
    renderer,
    save: new Save(openStorage()),
    audio,
    onStateChange: (state, current) => screens.onState(state, current),
});

screens.bind({
    continue: () => game.continueGame(),
    new: () => game.openClassSelect(),
    resume: () => game.resume(),
    restart: () => game.restart(),
    pause: () => game.pause(),
    menu: () => game.toMenu(),
    map: () => game.openMap(),
    equipment: () => game.openEquipment(),
    play: (index) => game.enterLevel(index),
    begin: () => game.beginLevel(),
    equip: (index) => game.equipItem(index),
    unequip: (slot) => game.unequipSlot(slot),
    dismantle: (index) => game.dismantleItem(index),
    volume: (value) => game.setVolume(value),
});

screens.renderClasses(
    CLASSES,
    CLASS_ORDER,
    (id) => renderer.portrait(id),
    (id) => game.newGame(id)
);

// Вкладка скрыта — ставим паузу, чтобы игра не шла без игрока.
document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.pause();
});

window.addEventListener('resize', () => renderer.resize());
renderer.resize();
game.setVolume(game.volume);
screens.onState('menu', game);
