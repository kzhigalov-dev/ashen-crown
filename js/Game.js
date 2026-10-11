import { Level, HAZARD } from './Level.js';
import { Player } from './entities/Player.js';
import { Enemy } from './entities/Enemy.js';
import { Projectile } from './entities/Projectile.js';
import { LootDrop } from './entities/LootDrop.js';
import { CLASSES } from './data/classes.js';
import { overlaps, touchesTile } from './Collision.js';
import {
    STEP, MAX_FRAME, VIEW_W, VIEW_H,
    HAZARD_DAMAGE, HAZARD_INSET, INVULN_TIME, COIN_VALUE, CAMERA_LERP,
} from './data/constants.js';

export class Game {
    // rng — источник случайных чисел от 0 до 1; в тестах подставляется свой.
    constructor({ levelDef, input, renderer = null, onStateChange = () => {}, rng = Math.random }) {
        this.levelDef = levelDef;
        this.input = input;
        this.renderer = renderer;
        this.onStateChange = onStateChange;
        this.rng = rng;
        this.classId = 'swordsman';

        this.state = 'menu';
        this.level = null;
        this.player = null;
        this.coins = [];
        this.enemies = [];
        this.projectiles = [];
        this.drops = [];
        this.effects = [];      // короткие вспышки для отрисовки (взрыв мага)
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
        this.player = new Player(CLASSES[this.classId]);
        this.player.placeAt(this.level.spawn);
        this.checkpoint = this.level.spawn;
        this.coins = this.level.coins.map((coin) => ({ ...coin, taken: false }));
        this.enemies = this.level.enemies.map((spawn) => new Enemy(spawn.type, spawn.x, spawn.y));
        this.projectiles = [];
        this.drops = [];
        this.effects = [];
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

    openClassSelect() {
        this.stop();
        this.level = null;
        this.setState('classSelect');
    }

    startWithClass(classId) {
        this.classId = classId;
        this.restart();
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

        this.applyActions(player.takeActions());
        this.updateProjectiles(dt);
        this.updateEnemies(dt);
        this.updateDrops(dt);
        for (const effect of this.effects) effect.ttl -= dt;
        this.effects = this.effects.filter((effect) => effect.ttl > 0);

        for (const coin of this.coins) {
            if (coin.taken || !overlaps(player, coin)) continue;
            coin.taken = true;
            this.gold += COIN_VALUE;
        }

        for (const checkpoint of level.checkpoints) {
            if (overlaps(player, checkpoint)) this.checkpoint = checkpoint;
        }

        const fellOut = player.y > level.height;
        if (fellOut || touchesTile(this.hazardBox(), level, HAZARD)) {
            player.takeDamage(HAZARD_DAMAGE);
            player.invuln = INVULN_TIME;
            if (!player.dead) player.placeAt(this.checkpoint);
        }

        this.camera.x += (this.cameraTarget() - this.camera.x) * Math.min(1, CAMERA_LERP * dt);

        if (player.dead) this.setState('dead');
        else if (overlaps(player, level.exit)) this.setState('complete');
    }

    // Применяет удары и выстрелы героя, накопленные за шаг.
    applyActions(actions) {
        for (const action of actions) {
            if (action.type === 'projectile') {
                this.projectiles.push(
                    new Projectile(action.kind, action.x, action.y, action.dir, action.damage)
                );
                continue;
            }
            if (action.type === 'blast') {
                this.effects.push({ kind: 'blast', x: action.x, y: action.y, radius: action.radius, ttl: 0.25, life: 0.25 });
            }
            for (const enemy of this.enemies) {
                if (!overlaps(action.box, enemy)) continue;
                // Взрыв отбрасывает от центра, удар — в сторону удара.
                const dir = action.dir || (enemy.x + enemy.w / 2 < action.x ? -1 : 1);
                enemy.hit(action.damage, action.id, dir);
            }
        }
    }

    updateProjectiles(dt) {
        for (const projectile of this.projectiles) {
            projectile.update(dt, this.level);
            if (projectile.dead) continue;
            for (const enemy of this.enemies) {
                if (enemy.dead || !overlaps(projectile, enemy)) continue;
                const hit = enemy.hit(projectile.damage, projectile.id, projectile.dir);
                if (hit && !projectile.pierce) {
                    projectile.dead = true;
                    break;
                }
            }
        }
        this.projectiles = this.projectiles.filter((projectile) => !projectile.dead);
    }

    updateEnemies(dt) {
        const { player, level } = this;
        for (const enemy of this.enemies) {
            if (enemy.dead) {
                // Из убитого врага выпадает золото.
                const [min, max] = enemy.def.gold;
                const value = min + Math.floor(this.rng() * (max - min + 1));
                const dir = this.rng() < 0.5 ? -1 : 1;
                this.drops.push(new LootDrop(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, value, dir));
                continue;
            }
            enemy.update(dt, level, player);
            // Оглушённый враг не ранит — у ближнего боя есть окно для удара.
            if (enemy.stun <= 0 && overlaps(player, enemy)) player.hurt(enemy.damage);
        }
        this.enemies = this.enemies.filter((enemy) => !enemy.dead && enemy.y <= level.height);
    }

    updateDrops(dt) {
        for (const drop of this.drops) {
            drop.update(dt, this.level);
            if (drop.ready && !drop.dead && overlaps(this.player, drop)) {
                this.gold += drop.value;
                drop.dead = true;
            }
        }
        this.drops = this.drops.filter((drop) => !drop.dead);
    }

    // Область героя, которой он задевает ловушки: чуть уже тела и без нижних
    // HAZARD_INSET пикселей — урон начинается там, где шипы нарисованы.
    hazardBox() {
        const { x, y, w, h } = this.player;
        return { x: x + 1, y, w: w - 2, h: h - HAZARD_INSET };
    }

    cameraTarget() {
        const center = this.player.x + this.player.w / 2 - VIEW_W / 2;
        return Math.max(0, Math.min(center, this.level.width - VIEW_W));
    }
}
