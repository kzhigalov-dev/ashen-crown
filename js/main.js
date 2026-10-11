import { Game } from './Game.js';
import { InputHandler } from './InputHandler.js';
import { Renderer } from './Renderer.js';
import { Screens } from './ui/Screens.js';
import { HudOverlay } from './ui/Hud.js';
import { Save } from './systems/Save.js';
import { Settings } from './systems/Settings.js';
import { AudioSystem } from './systems/Audio.js';
import { LEVELS, WORLDS } from './data/levels.js';
import { CLASSES, CLASS_ORDER } from './data/classes.js';
import { WEAPONS } from './data/weapons.js';

// Даже обращение к localStorage может бросить ошибку (приватный режим,
// запрет в настройках) — тогда игра работает без сохранения.
function openStorage() {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

const storage = openStorage();
const settings = new Settings(storage);
const options = settings.load();

// Звук синтезируется через Web Audio; контекст создаётся при первом действии игрока.
const audio = new AudioSystem(() => new (window.AudioContext ?? window.webkitAudioContext)());
audio.setMusicVolume(options.music);
for (const type of ['pointerdown', 'keydown']) {
    window.addEventListener(type, () => audio.unlock(), { once: true });
}

const renderer = new Renderer(document.getElementById('game'), new HudOverlay(document));
const input = new InputHandler(window);
const screens = new Screens(document, renderer, WORLDS);

const game = new Game({
    levels: LEVELS,
    input,
    renderer,
    audio,
    options,   // тот же объект, что у настроек: тряска переключается сразу
    save: new Save(storage),
    onStateChange: (state, current) => {
        screens.onState(state, current);
        // Во время уровня звучит фон локации, в остальное время — фон меню.
        const inLevel = ['playing', 'paused'].includes(state);
        audio.startAmbience(inLevel ? current.levelDef.world : 'menu');
    },
});

screens.bind({
    continue: () => game.continueGame(),
    classes: () => game.openClassSelect(),
    resume: () => game.resume(),
    restart: () => game.restart(),
    pause: () => game.pause(),
    menu: () => game.toMenu(),
    map: () => game.openMap(),
    equipment: () => game.openEquipment(),
    begin: () => game.beginLevel(),
    play: (index) => game.enterLevel(index),
    equip: (index) => game.equipItem(index),
    unequip: (slot) => game.unequipSlot(slot),
    dismantle: (index) => game.dismantleItem(index),
    sound: (name) => audio.play(name),
    setting: (key, value) => {
        settings.set(key, value);
        if (key === 'volume') game.setVolume(value);
        if (key === 'music') audio.setMusicVolume(value);
    },
});

screens.renderClasses(CLASSES, CLASS_ORDER, (id) => game.newGame(id));
screens.syncSettings(options);

// Вкладка скрыта — ставим паузу, чтобы игра не шла без игрока.
document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.pause();
});

// Постоянный цикл экранов: рисует живую сцену за меню и «печатает» сюжетный текст.
// Пока идёт уровень, поле рисует сама игра.
function menuFrame(now) {
    const time = now / 1000;
    if (!game.level) {
        // За меню — самая дальняя открытая локация; перед входом в локацию — она сама.
        const index = game.state === 'story' ? game.levelIndex : Math.min(game.cleared, LEVELS.length - 1);
        const classId = game.profile?.classId ?? 'swordsman';
        const kind = game.profile?.inventory.equipped.weapon?.kind ?? CLASSES[classId].starter;
        renderer.drawTitle(time, LEVELS[index], classId, WEAPONS[kind].sprite);
    }
    screens.update(time);
    requestAnimationFrame(menuFrame);
}

window.addEventListener('resize', () => renderer.resize());
renderer.resize();
game.setVolume(options.volume);
screens.onState('menu', game);
audio.startAmbience('menu');
requestAnimationFrame(menuFrame);
