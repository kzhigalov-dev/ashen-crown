import { Game } from './Game.js';
import { InputHandler } from './InputHandler.js';
import { Renderer } from './Renderer.js';
import { Screens } from './ui/Screens.js';
import { LEVELS } from './data/levels.js';
import { CLASSES, CLASS_ORDER } from './data/classes.js';

const renderer = new Renderer(document.getElementById('game'));
const input = new InputHandler(window);
const screens = new Screens(document);

const game = new Game({
    levelDef: LEVELS[0],
    input,
    renderer,
    onStateChange: (state, current) => screens.onState(state, current),
});

screens.bind({
    start: () => game.openClassSelect(),
    resume: () => game.resume(),
    restart: () => game.restart(),
    pause: () => game.pause(),
    menu: () => game.toMenu(),
});

screens.renderClasses(
    CLASSES,
    CLASS_ORDER,
    (id) => renderer.portrait(id),
    (id) => game.startWithClass(id)
);

// Вкладка скрыта — ставим паузу, чтобы игра не шла без игрока.
document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.pause();
});

window.addEventListener('resize', () => renderer.resize());
renderer.resize();
screens.onState('menu', game);
