import { Level, HAZARD } from './Level.js';
import { Player } from './entities/Player.js';
import { Enemy } from './entities/Enemy.js';
import { Boss } from './entities/Boss.js';
import { Projectile } from './entities/Projectile.js';
import { LootDrop } from './entities/LootDrop.js';
import { overlaps, touchesTile } from './Collision.js';
import { CLASSES } from './data/classes.js';
import { ENEMIES } from './data/enemies.js';
import { rollDrop, dismantleValue, rarityOf } from './systems/Loot.js';
import { Save, defaultProfile } from './systems/Save.js';
import {
    STEP, MAX_FRAME, VIEW_W, VIEW_H,
    HAZARD_DAMAGE, HAZARD_INSET, INVULN_TIME, COIN_VALUE, CAMERA_LERP, NOTICE_TIME,
    TILE, MAX_SUMMONED, PILLAR_PERIOD, PILLAR_DAMAGE,
} from './data/constants.js';

// Состояния игры:
//   menu → classSelect → map ⇄ equipment
//   map → story → playing ⇄ paused      (story — только пока локация не пройдена)
//   playing → complete | dead → map
//   playing → victory → map             (первая победа над последним боссом)
export class Game {
    // levels — описания локаций по порядку;
    // rng — источник случайных чисел от 0 до 1 (в тестах подставляется свой);
    // save — хранилище прогресса (по умолчанию ничего не сохраняет);
    // audio — звуковая система с методами play(name) и setVolume(v), может отсутствовать.
    constructor({
        levels, input, renderer = null, onStateChange = () => {},
        rng = Math.random, save = null, audio = null,
    }) {
        this.levels = levels;
        this.levelIndex = 0;
        this.input = input;
        this.renderer = renderer;
        this.onStateChange = onStateChange;
        this.rng = rng;
        this.save = save ?? new Save(null);
        this.audio = audio;
        this.volume = 0.5;
        this.events = [];           // что произошло за шаг: по ним играются звуки

        this.state = 'menu';
        this.profile = null;        // прогресс: класс, снаряжение, золото
        this.classId = 'swordsman'; // класс для профиля, если его ещё нет

        this.level = null;
        this.player = null;
        this.coins = [];
        this.enemies = [];
        this.projectiles = [];
        this.drops = [];
        this.enemyShots = [];       // снаряды врагов
        this.hazards = [];          // ловушки с предупреждением: корни, волны, столбы
        this.pillars = [];          // огненные столбы уровня, срабатывают по таймеру
        this.effects = [];          // короткие вспышки для отрисовки (взрыв мага)
        this.notice = null;         // всплывающая надпись: { text, color, ttl }
        this.checkpoint = null;
        this.rested = new Set();
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
        this.profile.volume = this.volume;
        this.persist();
        this.openMap();
    }

    // Загружает сохранение. false — сохранения нет или оно испорчено.
    continueGame() {
        const profile = this.save.load();
        if (!profile) return false;
        this.profile = profile;
        this.classId = profile.classId;
        this.setVolume(profile.volume);
        this.openMap();
        return true;
    }

    // Громкость от 0 до 1; хранится в профиле.
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        this.audio?.setVolume(this.volume);
        if (this.profile && this.profile.volume !== this.volume) {
            this.profile.volume = this.volume;
            this.persist();
        }
    }

    emit(name) {
        this.events.push(name);
    }

    // Отдаёт события слушателю (звуку) и очищает список.
    flushEvents() {
        for (const name of this.events) this.audio?.play(name);
        this.events = [];
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

    isOpen(index) {
        return Boolean(this.profile) && index >= 0 && index < this.levels.length && index < this.profile.unlocked;
    }

    // Локация ещё не пройдена ни разу.
    isNew(index) {
        return index === this.profile.unlocked - 1;
    }

    // Вход в локацию с карты: перед непройденной показывается сюжетный текст.
    enterLevel(index) {
        if (!this.isOpen(index)) return;
        this.levelIndex = index;
        if (this.isNew(index)) this.setState('story');
        else this.restart();
    }

    // Запускает локацию сразу, без сюжетного текста.
    playLevel(index) {
        if (!this.isOpen(index)) return;
        this.levelIndex = index;
        this.restart();
    }

    // Кнопка «В путь» на сюжетном экране.
    beginLevel() {
        if (this.state === 'story') this.restart();
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
        this.rested = new Set();    // костры, у которых герой уже лечился
        this.coins = this.level.coins.map((coin) => ({ ...coin, taken: false }));
        this.enemies = this.level.enemies.map((spawn) => this.createEnemy(spawn.type, spawn.x, spawn.y));
        this.projectiles = [];
        this.drops = [];
        this.enemyShots = [];
        this.hazards = [];
        // Столбы срабатывают не одновременно: у соседних разная начальная задержка.
        this.pillars = this.level.pillars.map((point, index) => ({
            x: point.x + TILE / 2,
            bottom: point.y + TILE,
            timer: 1 + (index % 3) * 0.7,
        }));
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

        this.flushEvents();
        if (this.renderer && this.level) this.renderer.draw(this);
    }

    update(dt) {
        const { player, level } = this;
        player.update(dt, this.input, level);
        this.events.push(...player.takeEvents());
        this.time += dt;

        this.applyActions(player.takeActions());
        this.updateProjectiles(dt);
        this.updateEnemies(dt);
        this.updatePillars(dt);
        this.updateHazards(dt);
        this.updateEnemyShots(dt);
        this.updateDrops(dt);
        this.updateEffects(dt);
        if (this.notice && (this.notice.ttl -= dt) <= 0) this.notice = null;

        for (const coin of this.coins) {
            if (coin.taken || !overlaps(player, coin)) continue;
            coin.taken = true;
            this.gold += COIN_VALUE;
            this.emit('coin');
            this.burst(coin.x + 8, coin.y + 8, '#ffe27a', 4);
        }

        for (const checkpoint of level.checkpoints) {
            if (!overlaps(player, checkpoint)) continue;
            this.checkpoint = checkpoint;
            // Каждый костёр один раз за забег полностью лечит.
            if (this.rested.has(checkpoint)) continue;
            this.rested.add(checkpoint);
            if (player.hp < player.maxHp) {
                player.hp = player.maxHp;
                this.emit('heal');
                this.notice = { text: 'Костёр: здоровье восстановлено', color: '#ffd75e', ttl: NOTICE_TIME };
            }
        }

        const fellOut = player.y > level.height;
        if (fellOut || touchesTile(this.hazardBox(), level, HAZARD)) {
            player.takeDamage(HAZARD_DAMAGE);
            player.invuln = INVULN_TIME;
            this.emit('hurt');
            if (!player.dead) player.placeAt(this.checkpoint);
        }

        this.camera.x += (this.cameraTarget() - this.camera.x) * Math.min(1, CAMERA_LERP * dt);

        if (player.dead) this.loseLevel();
        else if (!this.bossAlive && overlaps(player, level.exit)) this.finishLevel();
    }

    // Пока жив босс, портал закрыт.
    get bossAlive() {
        return this.enemies.some((enemy) => enemy.def.boss && !enemy.dead);
    }

    createEnemy(type, x, y) {
        return ENEMIES[type].boss ? new Boss(type, x, y) : new Enemy(type, x, y);
    }

    // Уровень пройден: золото забега уходит в общее, открывается следующая локация.
    // unlocked больше числа локаций означает, что пройдена и последняя.
    finishLevel() {
        const { profile } = this;
        const firstClear = this.isNew(this.levelIndex);
        const last = this.levelIndex === this.levels.length - 1;
        profile.gold += this.gold;
        profile.bestRun = Math.max(profile.bestRun, this.gold);
        profile.unlocked = Math.max(profile.unlocked, this.levelIndex + 2);
        this.persist();
        this.emit('complete');
        this.setState(firstClear && last ? 'victory' : 'complete');
    }

    // Герой погиб: золото забега теряется, найденные предметы остаются.
    loseLevel() {
        this.persist();
        this.emit('defeat');
        this.setState('dead');
    }

    // Применяет удары и выстрелы героя, накопленные за шаг.
    applyActions(actions) {
        for (const action of actions) {
            if (action.type === 'projectile') {
                const projectile = new Projectile(action.kind, action.x, action.y, action.dir, action.damage);
                projectile.crit = action.crit;
                this.projectiles.push(projectile);
                continue;
            }
            if (action.type === 'blast') {
                this.effects.push({ kind: 'blast', x: action.x, y: action.y, radius: action.radius, ttl: 0.25, life: 0.25 });
            }
            for (const enemy of this.enemies) {
                if (!overlaps(action.box, enemy)) continue;
                // Взрыв отбрасывает от центра, удар — в сторону удара.
                const dir = action.dir || (enemy.x + enemy.w / 2 < action.x ? -1 : 1);
                this.hitEnemy(enemy, action.damage, action.id, dir, action.crit);
            }
        }
    }

    updateProjectiles(dt) {
        for (const projectile of this.projectiles) {
            projectile.update(dt, this.level);
            if (projectile.dead) continue;
            for (const enemy of this.enemies) {
                if (enemy.dead || !overlaps(projectile, enemy)) continue;
                const hit = this.hitEnemy(enemy, projectile.damage, projectile.id, projectile.dir, projectile.crit);
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
        const summoned = [];
        for (const enemy of this.enemies) {
            if (enemy.dead) {
                this.dropLoot(enemy);
                continue;
            }
            enemy.update(dt, level, player);
            for (const action of enemy.takeActions()) this.applyEnemyAction(action, summoned);
            // Оглушённый враг не ранит — у ближнего боя есть окно для удара.
            if (enemy.stun <= 0 && overlaps(player, enemy)) this.hurtPlayer(enemy.damage);
        }
        this.enemies = this.enemies
            .filter((enemy) => !enemy.dead && enemy.y <= level.height)
            .concat(summoned);
    }

    // Применяет действие врага: удар, выстрел, ловушку или призыв.
    applyEnemyAction(action, summoned) {
        if (action.type === 'strike') {
            if (overlaps(action.box, this.player)) this.hurtPlayer(action.damage);
            this.effects.push({ kind: 'strike', ...action.box, ttl: 0.12, life: 0.12 });
        } else if (action.type === 'shot') {
            this.enemyShots.push(new Projectile(
                action.kind, action.x, action.y, action.dir, action.damage, action.target ?? null
            ));
        } else if (action.type === 'hazard') {
            this.addHazard(action);
        } else if (action.type === 'summon') {
            // Призванных одновременно не больше MAX_SUMMONED.
            const alive = this.enemies.filter((enemy) => enemy.summoned && !enemy.dead).length;
            if (alive + summoned.length >= MAX_SUMMONED) return;
            const enemy = this.createEnemy(action.enemy, action.x, action.y);
            enemy.summoned = true;
            summoned.push(enemy);
        }
    }

    // Ловушка: delay секунд видна метка, затем life секунд ранит.
    addHazard({ kind, x, w, h, bottom, delay, life, damage }) {
        this.hazards.push({ kind, x, y: bottom - h, w, h, delay, life, total: life, damage });
    }

    updateHazards(dt) {
        for (const hazard of this.hazards) {
            if (hazard.delay > 0) {
                hazard.delay -= dt;
                continue;
            }
            hazard.life -= dt;
            if (overlaps(hazard, this.player)) this.hurtPlayer(hazard.damage);
        }
        this.hazards = this.hazards.filter((hazard) => hazard.life > 0);
    }

    // Огненные столбы уровня срабатывают по таймеру.
    updatePillars(dt) {
        for (const pillar of this.pillars) {
            pillar.timer -= dt;
            if (pillar.timer > 0) continue;
            pillar.timer = PILLAR_PERIOD;
            this.addHazard({
                kind: 'pillar', x: pillar.x - 6, w: 12, h: 40, bottom: pillar.bottom,
                delay: 0.5, life: 0.7, damage: PILLAR_DAMAGE,
            });
        }
    }

    updateEnemyShots(dt) {
        for (const shot of this.enemyShots) {
            shot.update(dt, this.level);
            if (shot.dead || !overlaps(shot, this.player)) continue;
            this.hurtPlayer(shot.damage);
            shot.dead = true;
        }
        this.enemyShots = this.enemyShots.filter((shot) => !shot.dead);
    }

    // Из убитого врага всегда выпадает золото и иногда — предмет.
    dropLoot(enemy) {
        const x = enemy.x + enemy.w / 2;
        const y = enemy.y + enemy.h / 2;
        this.emit(enemy.def.boss ? 'bossDown' : 'kill');
        this.burst(x, y, enemy.def.color ?? '#ffffff', enemy.def.boss ? 24 : 8);
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
            this.burst(drop.x + 4, drop.y + 4, drop.kind === 'gold' ? '#ffe27a' : rarityOf(drop.item).color, 4);
            if (drop.kind === 'gold') {
                this.gold += drop.value;
                this.emit('coin');
            } else {
                this.collectItem(drop.item);
                this.emit('item');
            }
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

    // Попадание по врагу: звук и всплывающее число урона.
    hitEnemy(enemy, damage, id, dir, crit = false) {
        if (!enemy.hit(damage, id, dir)) return false;
        this.emit('hit');
        this.effects.push({
            kind: 'number', text: String(Math.round(damage)), crit,
            x: enemy.x + enemy.w / 2, y: enemy.y - 2, ttl: 0.6, life: 0.6,
        });
        return true;
    }

    hurtPlayer(amount) {
        if (this.player.hurt(amount)) this.emit('hurt');
    }

    // Россыпь частиц. Направления заданы по кругу, без случайности —
    // чтобы эффекты не влияли на бросок добычи.
    burst(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + 0.4;
            this.effects.push({
                kind: 'particle', color, x, y,
                vx: Math.cos(angle) * 55, vy: Math.sin(angle) * 55 - 50,
                ttl: 0.45, life: 0.45,
            });
        }
    }

    updateEffects(dt) {
        for (const effect of this.effects) {
            effect.ttl -= dt;
            if (effect.kind !== 'particle') continue;
            effect.x += effect.vx * dt;
            effect.y += effect.vy * dt;
            effect.vy += 400 * dt;
        }
        this.effects = this.effects.filter((effect) => effect.ttl > 0);
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
