import { Level, HAZARD } from './Level.js';
import { Player } from './entities/Player.js';
import { overlaps, touchesTile } from './Collision.js';
import {
    STEP, MAX_FRAME, VIEW_W, VIEW_H,
    HAZARD_DAMAGE, INVULN_TIME, COIN_VALUE, CAMERA_LERP,
} from './data/constants.js';

export class Game {
    constructor({ levelDef, input, renderer = null, onStateChange = () => {} }) {
        this.levelDef = levelDef;
        this.input = input;
        this.renderer = renderer;
        this.onStateChange = onStateChange;

        this.state = 'menu';
        this.level = null;
        this.player = null;
        this.coins = [];
        this.checkpoint = null;
        this.gold = 0;
        this.time = 0;
        this.camera = { x: 0, y: 0 };

        this.rafId = null;
        this.last = null;       // время прошлого кадра, мс
        this.accumulator = 0;   // накопленное, но ещё не отыгранное время, с

        this.frame = (now) => {
            this.tick(now);
            this.rafId = requestAnimationFrame(this.frame);
        };
    }

    setState(state) {
        this.state = state;
        this.input.capture = state === 'playing';
        this.onStateChange(state, this);
    }

    startLevel() {
        this.level = new Level(this.levelDef);
        this.player = new Player();
        this.player.placeAt(this.level.spawn);
        this.checkpoint = this.level.spawn;
        this.coins = this.level.coins.map((coin) => ({ ...coin, taken: false }));
        this.gold = 0;
        this.time = 0;
        this.accumulator = 0;
        this.last = null;
        this.camera = { x: this.cameraTarget(), y: Math.max(0, this.level.height - VIEW_H) };
        this.setState('playing');
    }

    // Запуск цикла и подключение клавиатуры.
    start() {
        this.input.attach();
        this.last = null;
        this.rafId = requestAnimationFrame(this.frame);
    }

    // Остановка цикла и снятие обработчиков.
    stop() {
        if (this.rafId !== null) cancelAnimationFrame(this.rafId);
        this.rafId = null;
        this.input.detach();
    }

    restart() {
        this.stop();
        this.startLevel();
        this.start();
    }

    toMenu() {
        this.stop();
        this.level = null;
        this.setState('menu');
    }

    pause() {
        if (this.state === 'playing') this.setState('paused');
    }

    resume() {
        if (this.state !== 'paused') return;
        this.last = null;
        this.setState('playing');
    }

    togglePause() {
        if (this.state === 'playing') this.pause();
        else this.resume();
    }

    // Один кадр. Реальное время копится и расходуется шагами по STEP,
    // поэтому физика одинакова на любом мониторе.
    tick(now) {
        // Пауза обрабатывается до подсчёта времени: resume() сбрасывает last,
        // и время, проведённое на паузе, не попадает в логику.
        if (this.input.consume('pause')) this.togglePause();

        const delta = this.last === null ? 0 : Math.min((now - this.last) / 1000, MAX_FRAME);
        this.last = now;

        if (this.state === 'playing') {
            this.accumulator += delta;
            while (this.accumulator >= STEP && this.state === 'playing') {
                this.update(STEP);
                this.input.endStep();
                this.accumulator -= STEP;
            }
        } else {
            this.accumulator = 0;
            this.input.endStep();
        }

        if (this.renderer && this.level) this.renderer.draw(this);
    }

    update(dt) {
        const { player, level } = this;
        player.update(dt, this.input, level);
        this.time += dt;

        for (const coin of this.coins) {
            if (coin.taken || !overlaps(player, coin)) continue;
            coin.taken = true;
            this.gold += COIN_VALUE;
        }

        for (const checkpoint of level.checkpoints) {
            if (overlaps(player, checkpoint)) this.checkpoint = checkpoint;
        }

        const fellOut = player.y > level.height;
        if (fellOut || touchesTile(player, level, HAZARD)) {
            player.takeDamage(HAZARD_DAMAGE);
            player.invuln = INVULN_TIME;
            if (!player.dead) player.placeAt(this.checkpoint);
        }

        this.camera.x += (this.cameraTarget() - this.camera.x) * Math.min(1, CAMERA_LERP * dt);

        if (player.dead) this.setState('dead');
        else if (overlaps(player, level.exit)) this.setState('complete');
    }

    cameraTarget() {
        const center = this.player.x + this.player.w / 2 - VIEW_W / 2;
        return Math.max(0, Math.min(center, this.level.width - VIEW_W));
    }
}
