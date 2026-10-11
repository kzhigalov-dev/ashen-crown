import { Level, HAZARD } from './Level.js';
import { Player } from './entities/Player.js';
import { Enemy } from './entities/Enemy.js';
import { Projectile } from './entities/Projectile.js';
import { LootDrop } from './entities/LootDrop.js';
import { overlaps, touchesTile } from './Collision.js';
import { CLASSES } from './data/classes.js';
import { rollDrop, dismantleValue, rarityOf } from './systems/Loot.js';
import { Save, defaultProfile } from './systems/Save.js';
import {
    STEP, MAX_FRAME, VIEW_W, VIEW_H,
    HAZARD_DAMAGE, HAZARD_INSET, INVULN_TIME, COIN_VALUE, CAMERA_LERP, NOTICE_TIME,
} from './data/constants.js';

// Состояния игры:
//   menu → classSelect → map ⇄ equipment
//   map → playing ⇄ paused
//   playing → complete | dead → map
export class Game {
    // levels — описания локаций по порядку;
    // rng — источник случайных чисел от 0 до 1 (в тестах подставляется свой);
    // save — хранилище прогресса (по умолчанию ничего не сохраняет).
    constructor({ levels, input, renderer = null, onStateChange = () => {}, rng = Math.random, save = null }) {
        this.levels = levels;
        this.levelIndex = 0;
        this.input = input;
        this.renderer = renderer;
        this.onStateChange = onStateChange;
        this.rng = rng;
        this.save = save ?? new Save(null);

        this.state = 'menu';
        this.profile = null;        // прогресс: класс, снаряжение, золото
        this.classId = 'swordsman'; // класс для профиля, если его ещё нет

        this.level = null;
        this.player = null;
        this.coins = [];
        this.enemies = [];
        this.projectiles = [];
        this.drops = [];
        this.effects = [];          // короткие вспышки для отрисовки (взрыв мага)
        this.notice = null;         // всплывающая надпись: { text, color, ttl }
        this.checkpoint = null;
        this.gold = 0;              // золото текущего забега
        this.time = 0;
        this.camera = { x: 0, y: 0 };

        this.rafId = null;
        this.last = null;           // время прошлого кадра, мс
        this.accumulator = 0;       // накопленное, но ещё не отыгранное время, с

        this.frame = (now) => {
            this.tick(now);
            this.rafId = requestAnimationFrame(this.frame);
        };
    }

    get levelDef() {
        return this.levels[this.levelIndex];
    }

    get hasSave() {
        return this.save.load() !== null;
    }

    setState(state) {
        this.state = state;
        this.input.capture = state === 'playing';
        this.onStateChange(state, this);
    }

    // ---------- Профиль и экраны между уровнями ----------

    newGame(classId) {
        this.classId = classId;
        this.profile = defaultProfile(classId);
        this.persist();
        this.openMap();
    }

    // Загружает сохранение. false — сохранения нет или оно испорчено.
    continueGame() {
        const profile = this.save.load();
        if (!profile) return false;
        this.profile = profile;
        this.classId = profile.classId;
        this.openMap();
        return true;
    }

    persist() {
        if (this.profile) this.save.write(this.profile);
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

    openMap() {
        this.stop();
        this.level = null;
        this.setState('map');
    }

    openEquipment() {
        if (this.state === 'map') this.setState('equipment');
    }

    // Запускает локацию, если она открыта.
    playLevel(index) {
        if (!this.profile || index < 0 || index >= this.profile.unlocked) return;
        this.levelIndex = index;
        this.restart();
    }

    equipItem(index) {
        if (this.profile.inventory.equip(index)) this.profileChanged();
    }

    unequipSlot(slot) {
        if (this.profile.inventory.unequip(slot)) this.profileChanged();
    }

    dismantleItem(index) {
        const gold = this.profile.inventory.dismantle(index);
        if (gold === 0) return;
        this.profile.gold += gold;
        this.profileChanged();
    }

    // Снаряжение изменилось: сохраняем и просим экран перерисоваться.
    profileChanged() {
        this.persist();
        this.onStateChange(this.state, this);
    }

    // ---------- Уровень ----------

    startLevel() {
        this.profile ??= defaultProfile(this.classId);
        const classDef = CLASSES[this.profile.classId];

        this.level = new Level(this.levelDef);
        this.player = new Player(classDef, { bonus: this.profile.inventory.totals(), rng: this.rng });
        this.player.placeAt(this.level.spawn);
        this.checkpoint = this.level.spawn;
        this.coins = this.level.coins.map((coin) => ({ ...coin, taken: false }));
        this.enemies = this.level.enemies.map((spawn) => new Enemy(spawn.type, spawn.x, spawn.y));
        this.projectiles = [];
        this.drops = [];
        this.effects = [];
        this.notice = null;
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
        if (this.notice && (this.notice.ttl -= dt) <= 0) this.notice = null;

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

        if (player.dead) this.loseLevel();
        else if (overlaps(player, level.exit)) this.finishLevel();
    }

    // Уровень пройден: золото забега уходит в общее, открывается следующая локация.
    finishLevel() {
        const { profile } = this;
        profile.gold += this.gold;
        profile.bestRun = Math.max(profile.bestRun, this.gold);
        profile.unlocked = Math.min(this.levels.length, Math.max(profile.unlocked, this.levelIndex + 2));
        this.persist();
        this.setState('complete');
    }

    // Герой погиб: золото забега теряется, найденные предметы остаются.
    loseLevel() {
        this.persist();
        this.setState('dead');
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
                this.dropLoot(enemy);
                continue;
            }
            enemy.update(dt, level, player);
            // Оглушённый враг не ранит — у ближнего боя есть окно для удара.
            if (enemy.stun <= 0 && overlaps(player, enemy)) player.hurt(enemy.damage);
        }
        this.enemies = this.enemies.filter((enemy) => !enemy.dead && enemy.y <= level.height);
    }

    // Из убитого врага всегда выпадает золото и иногда — предмет.
    dropLoot(enemy) {
        const x = enemy.x + enemy.w / 2;
        const y = enemy.y + enemy.h / 2;
        const [min, max] = enemy.def.gold;
        const value = min + Math.floor(this.rng() * (max - min + 1));
        const dir = this.rng() < 0.5 ? -1 : 1;
        this.drops.push(new LootDrop(x, y, dir, { value }));

        const item = rollDrop({
            locationId: this.levelDef.id,
            classId: this.profile.classId,
            rng: this.rng,
            boss: enemy.def.boss === true,
        });
        if (item) this.drops.push(new LootDrop(x, y, -dir, { item }));
    }

    updateDrops(dt) {
        for (const drop of this.drops) {
            drop.update(dt, this.level);
            if (!drop.ready || drop.dead || !overlaps(this.player, drop)) continue;
            drop.dead = true;
            if (drop.kind === 'gold') this.gold += drop.value;
            else this.collectItem(drop.item);
        }
        this.drops = this.drops.filter((drop) => !drop.dead);
    }

    // Предмет идёт в сумку; если места нет — сразу разбирается в золото.
    collectItem(item) {
        if (this.profile.inventory.add(item)) {
            this.notice = { text: item.name, color: rarityOf(item).color, ttl: NOTICE_TIME };
            return;
        }
        const gold = dismantleValue(item);
        this.gold += gold;
        this.notice = { text: `Сумка полна: +${gold} золота`, color: '#b9ad98', ttl: NOTICE_TIME };
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
