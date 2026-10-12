import { Level, HAZARD } from './Level.js';
import { Player } from './entities/Player.js';
import { Enemy } from './entities/Enemy.js';
import { Boss } from './entities/Boss.js';
import { Projectile } from './entities/Projectile.js';
import { LootDrop } from './entities/LootDrop.js';
import { overlaps, touchesTile } from './Collision.js';
import { CLASSES } from './data/classes.js';
import { WEAPONS } from './data/weapons.js';
import { ENEMIES } from './data/enemies.js';
import { rollDrop, dismantleValue, rarityOf } from './systems/Loot.js';
import { Save, defaultProfile } from './systems/Save.js';
import { LORE } from './data/story.js';
import {
    STEP, MAX_FRAME, VIEW_W, VIEW_H,
    HAZARD_DAMAGE, HAZARD_INSET, INVULN_TIME, COIN_VALUE, CAMERA_LERP, NOTICE_TIME,
    TILE, MAX_SUMMONED, PILLAR_PERIOD, PILLAR_DAMAGE,
    DEATH_TIME, INTRO_TIME, BANNER_TIME, LORE_TIME, SHAKE_DECAY, HITSTOP, HURT_FLASH,
    RECOIL_TIME, HEART_CHANCE, HEART_HEAL,
} from './data/constants.js';

// Состояния игры:
//   menu → classSelect → map ⇄ equipment
//   map → story → playing ⇄ paused      (story — только пока локация не пройдена)
//   playing ⇄ loot                      (найден предмет: надеть или убрать в сумку)
//   playing → complete | dead → map
//   playing → victory → map             (первая победа над последним боссом)
export class Game {
    // levels — описания локаций по порядку;
    // rng — источник случайных чисел от 0 до 1 (в тестах подставляется свой);
    // save — хранилище прогресса (по умолчанию ничего не сохраняет);
    // audio — звуковая система с методами play(name) и setVolume(v), может отсутствовать;
    // options — настройки игрока: shake — трясти ли экран при ударах.
    constructor({
        levels, input, renderer = null, onStateChange = () => {},
        rng = Math.random, save = null, audio = null, options = { shake: true },
    }) {
        this.levels = levels;
        this.levelIndex = 0;
        this.input = input;
        this.renderer = renderer;
        this.onStateChange = onStateChange;
        this.rng = rng;
        this.save = save ?? new Save(null);
        this.audio = audio;
        this.options = options;
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
        this.found = null;          // найденный предмет, ждущий решения: { item, index }
        this.alpha = 1;             // доля шага между кадрами — для плавной отрисовки
        this.lore = null;           // записка у костра: { text, ttl }
        this.banner = null;         // объявление о боссе: { title, text, ttl }
        this.trail = [];            // след рывка: прошлые положения героя
        this.stats = { kills: 0, hits: 0 };  // итоги забега
        this.shake = 0;             // сила тряски экрана, px
        this.freeze = 0;            // замирание кадра при ударе, с
        this.intro = 0;             // остаток заставки с названием локации, с
        this.hurtFlash = 0;         // остаток красной вспышки, с
        this.dying = 0;             // остаток паузы после гибели героя, с
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

    // Сколько уровней пройдено. Пока игра не загружена, берётся из сохранения.
    get cleared() {
        const profile = this.profile ?? this.save.load();
        return profile ? Math.min(this.levels.length, profile.unlocked - 1) : 0;
    }

    // Сколько стражей повержено — столько зубцов короны позолочено.
    get crowns() {
        return this.levels.slice(0, this.cleared).filter((level) => level.boss).length;
    }

    // Мир текущего уровня: от него зависят добыча, записки и оформление.
    get world() {
        return this.levelDef.world ?? this.levelDef.id;
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
        // Надетое оружие задаёт атаку и способность; без него — оружие класса по умолчанию.
        const { inventory } = this.profile;
        const weapon = WEAPONS[inventory.equipped.weapon?.kind] ?? WEAPONS[classDef.starter];
        this.player = new Player(classDef, { bonus: inventory.totals(), rng: this.rng, weapon });
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
        this.found = null;
        this.alpha = 1;
        this.lore = null;
        this.banner = null;
        this.trail = [];
        this.stats = { kills: 0, hits: 0 };
        this.shake = 0;
        this.freeze = 0;
        this.intro = INTRO_TIME;
        this.hurtFlash = 0;
        this.dying = 0;
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
                this.accumulator -= STEP;
                // Замирание кадра при ударе: мир стоит, нажатия не теряются.
                if (this.freeze > 0) {
                    this.freeze -= STEP;
                    continue;
                }
                this.update(STEP);
                this.input.endStep();
            }
        } else {
            this.accumulator = 0;
            this.input.endStep();
        }

        // Отрисовка плавно ведёт объекты от прошлого шага к текущему:
        // alpha — какая часть следующего шага уже «прошла» к моменту кадра.
        const moving = this.state === 'playing' && this.freeze <= 0;
        this.alpha = moving ? this.accumulator / STEP : 1;

        this.flushEvents();
        if (this.renderer && this.level) this.renderer.draw(this);
    }

    update(dt) {
        const { player, level } = this;
        this.remember();
        this.time += dt;
        this.intro = Math.max(0, this.intro - dt);
        this.shake = Math.max(0, this.shake - SHAKE_DECAY * dt);
        this.hurtFlash = Math.max(0, this.hurtFlash - dt);
        for (const key of ['notice', 'lore', 'banner']) {
            if (this[key] && (this[key].ttl -= dt) <= 0) this[key] = null;
        }
        this.trail = this.trail.filter((ghost) => (ghost.ttl -= dt) > 0);

        // Герой погиб: мир замирает, разлетаются частицы, затем экран поражения.
        if (player.dead) {
            this.dying -= dt;
            this.updateEffects(dt);
            if (this.dying <= 0) this.loseLevel();
            return;
        }

        player.update(dt, this.input, level);
        this.reactToPlayer(player.takeEvents());

        this.applyActions(player.takeActions());
        this.updateProjectiles(dt);
        this.updateEnemies(dt);
        this.updatePillars(dt);
        this.updateHazards(dt);
        this.updateEnemyShots(dt);
        this.updateDrops(dt);
        this.updateEffects(dt);
        // Найден предмет — игра ждёт решения игрока, остаток шага не нужен.
        if (this.state !== 'playing') return;

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
            // У каждого костра лежит записка — кусочек истории. На разных уровнях
            // мира записки разные: номер зависит от уровня и от костра.
            const notes = LORE[this.world];
            if (notes) {
                const index = ((this.levelDef.number ?? 1) - 1) * 2 + level.checkpoints.indexOf(checkpoint);
                this.lore = { text: notes[index % notes.length], ttl: LORE_TIME };
            }
        }

        const fellOut = player.y > level.height;
        if (fellOut || touchesTile(this.hazardBox(), level, HAZARD)) {
            player.takeDamage(HAZARD_DAMAGE);
            player.invuln = INVULN_TIME;
            this.feelHurt();
            if (!player.dead) player.placeAt(this.checkpoint);
        }

        this.camera.x += (this.cameraTarget() - this.camera.x) * Math.min(1, CAMERA_LERP * dt);

        if (player.dead) this.startDying();
        else if (!this.bossAlive && overlaps(player, level.exit)) this.finishLevel();
    }

    // Запоминает положения перед шагом: отрисовка сглаживает движение между шагами.
    remember() {
        const bodies = [this.player, ...this.enemies, ...this.projectiles, ...this.enemyShots, ...this.drops];
        for (const body of bodies) {
            body.prevX = body.x;
            body.prevY = body.y;
        }
        this.camera.prevX = this.camera.x;
    }

    // Отклик мира на действия героя: пыль, след рывка, тряска.
    reactToPlayer(events) {
        const { player } = this;
        for (const name of events) {
            this.emit(name);
            if (name === 'jump' || name === 'land') this.puff(player.x + player.w / 2, player.y + player.h);
            if (name === 'blast') this.addShake(4);
        }
        if (player.dashTime > 0) {
            this.trail.push({ x: player.x, y: player.y, facing: player.facing, ttl: 0.18 });
        }
    }

    addShake(power) {
        if (this.options.shake) this.shake = Math.max(this.shake, power);
    }

    // Всё, что сопровождает урон герою: звук, вспышка, тряска, замирание кадра.
    feelHurt() {
        this.emit('hurt');
        this.stats.hits++;
        this.hurtFlash = HURT_FLASH;
        this.freeze = Math.max(this.freeze, HITSTOP * 2);
        this.addShake(3);
    }

    startDying() {
        const { player } = this;
        this.dying = DEATH_TIME;
        this.emit('death');
        this.addShake(6);
        this.burst(player.x + player.w / 2, player.y + player.h / 2, '#e2572b', 16);
    }

    // Облачко пыли у ног.
    puff(x, y) {
        for (const vx of [-34, -14, 14, 34]) {
            this.effects.push({ kind: 'particle', color: '#8f8794', x, y: y - 2, vx, vy: -24, ttl: 0.3, life: 0.3 });
        }
    }

    // Пока жив босс, портал закрыт.
    get bossAlive() {
        return this.enemies.some((enemy) => enemy.def.boss && !enemy.dead);
    }

    // Обычные враги на поздних уровнях мира крепче и бьют больнее (power уровня).
    createEnemy(type, x, y) {
        if (ENEMIES[type].boss) return new Boss(type, x, y);
        const enemy = new Enemy(type, x, y);
        const power = this.levelDef.power ?? 1;
        enemy.maxHp = Math.round(enemy.maxHp * power);
        enemy.hp = enemy.maxHp;
        enemy.damage = Math.round(enemy.damage * power);
        return enemy;
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
                const projectile = new Projectile(
                    action.kind, action.x, action.y, action.dir, action.damage, null, action.lift
                );
                projectile.crit = action.crit;
                this.projectiles.push(projectile);
                continue;
            }
            if (action.type === 'chain') {
                this.chainLightning(action);
                continue;
            }
            if (action.type === 'blast') {
                this.effects.push({
                    kind: 'blast', style: action.effect, x: action.x, y: action.y,
                    radius: action.radius, ttl: 0.3, life: 0.3,
                });
            }
            for (const enemy of this.enemies) {
                if (!overlaps(action.box, enemy)) continue;
                // Взрыв отбрасывает от центра, удар — в сторону удара.
                const dir = action.dir || (enemy.x + enemy.w / 2 < action.x ? -1 : 1);
                this.hitEnemy(enemy, action.damage, action.id, dir, action.crit, action.stun ?? 0);
            }
        }
    }

    updateProjectiles(dt) {
        for (const projectile of this.projectiles) {
            // Сначала проверка на месте: снаряд, выпущенный вплотную к врагу,
            // должен попасть, даже если следующим шагом упрётся в стену.
            this.strikeEnemies(projectile);
            if (projectile.dead) continue;
            projectile.update(dt, this.level);
            if (!projectile.dead) this.strikeEnemies(projectile);
        }
        this.projectiles = this.projectiles.filter((projectile) => !projectile.dead);
    }

    // Попадания снаряда по врагам. Обычный снаряд гибнет о первого, пробивающий летит дальше.
    strikeEnemies(projectile) {
        for (const enemy of this.enemies) {
            if (enemy.dead || !overlaps(projectile, enemy)) continue;
            const hit = this.hitEnemy(
                enemy, projectile.damage, projectile.id, projectile.dir, projectile.crit, projectile.stun, false
            );
            if (hit && !projectile.pierce) {
                projectile.dead = true;
                return;
            }
        }
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
            // Босс проснулся: объявление с его репликой.
            if (enemy.def.boss && enemy.awake && !enemy.announced) {
                enemy.announced = true;
                this.banner = { title: enemy.def.name, text: enemy.def.line, ttl: BANNER_TIME };
                this.emit('bossWake');
                this.addShake(4);
            }
            // Оглушённый враг не ранит — у ближнего боя есть окно для удара.
            // Ранив героя, обычный враг отскакивает, а не остаётся вплотную.
            if (enemy.stun <= 0 && overlaps(player, enemy) && this.hurtPlayer(enemy.damage) && !enemy.def.boss) {
                const away = enemy.x + enemy.w / 2 < player.x + player.w / 2 ? -1 : 1;
                enemy.recoil(away, RECOIL_TIME);
            }
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
        this.stats.kills++;
        if (enemy.def.boss) {
            this.addShake(8);
            this.banner = { title: enemy.def.name, text: 'повержен. Портал открыт.', ttl: BANNER_TIME };
        }
        const [min, max] = enemy.def.gold;
        const value = min + Math.floor(this.rng() * (max - min + 1));
        const dir = this.rng() < 0.5 ? -1 : 1;
        this.drops.push(new LootDrop(x, y, dir, { value }));

        const item = rollDrop({
            locationId: this.world,
            classId: this.profile.classId,
            rng: this.rng,
            boss: enemy.def.boss === true,
        });
        if (item) this.drops.push(new LootDrop(x, y, -dir, { item }));
        // Иногда из врага выпадает сердце.
        if (this.rng() < HEART_CHANCE) this.drops.push(new LootDrop(x, y, 0, { heal: HEART_HEAL }));
    }

    updateDrops(dt) {
        for (const drop of this.drops) {
            drop.update(dt, this.level);
            if (!drop.ready || drop.dead || !overlaps(this.player, drop)) continue;
            // Сердце ждёт, пока герой ранен; второй предмет — пока не решена судьба первого.
            if (drop.kind === 'heart' && this.player.hp >= this.player.maxHp) continue;
            if (drop.kind === 'item' && this.found) continue;
            drop.dead = true;
            if (drop.kind === 'gold') {
                this.gold += drop.value;
                this.emit('coin');
                this.burst(drop.x + 4, drop.y + 4, '#ffe27a', 4);
            } else if (drop.kind === 'heart') {
                this.player.hp = Math.min(this.player.maxHp, this.player.hp + drop.heal);
                this.emit('heal');
                this.burst(drop.x + 4, drop.y + 4, '#e2572b', 6);
            } else {
                this.burst(drop.x + 4, drop.y + 4, rarityOf(drop.item).color, 6);
                this.collectItem(drop.item);
            }
        }
        this.drops = this.drops.filter((drop) => !drop.dead);
    }

    // Найден предмет: он кладётся в сумку, игра встаёт на паузу и спрашивает,
    // надеть ли его сразу. index = null — сумка полна, предмет ещё не в ней.
    collectItem(item) {
        const { inventory } = this.profile;
        const index = inventory.add(item) ? inventory.items.length - 1 : null;
        this.found = { item, index };
        this.emit('item');
        this.setState('loot');
    }

    // Решение по найденному предмету. equip = true — надеть сейчас.
    // Если сумка полна: надетый прежде предмет (или сама находка) разбирается в золото.
    takeFound(equip) {
        if (!this.found) return;
        const { item, index } = this.found;
        const { inventory } = this.profile;
        let text = equip ? `Надето: ${item.name}` : `В сумку: ${item.name}`;
        if (index !== null) {
            if (equip) inventory.equip(index);
        } else {
            const scrapped = equip ? inventory.equipped[item.slot] : item;
            if (equip) inventory.equipped[item.slot] = item;
            if (scrapped) {
                const gold = dismantleValue(scrapped);
                this.gold += gold;
                text = equip ? `${text}; прежний разобран: +${gold}` : `Сумка полна, разобрано: +${gold} золота`;
            }
        }
        if (equip) this.applyGear();
        this.found = null;
        this.notice = { text, color: rarityOf(item).color, ttl: NOTICE_TIME };
        this.persist();
        this.last = null;
        this.setState('playing');
    }

    // Пересчитывает бонусы и оружие героя по надетому снаряжению.
    applyGear() {
        const { inventory, classId } = this.profile;
        const weapon = WEAPONS[inventory.equipped.weapon?.kind] ?? WEAPONS[CLASSES[classId].starter];
        this.player.setGear(inventory.totals(), weapon);
    }

    // Цепная молния: бьёт ближайших врагов в радиусе, перескакивая от одного к другому.
    chainLightning({ x, y, damage, id, crit, range, targets }) {
        const center = (enemy) => ({ x: enemy.x + enemy.w / 2, y: enemy.y + enemy.h / 2 });
        const distance = (enemy) => Math.hypot(center(enemy).x - x, center(enemy).y - y);
        const struck = this.enemies
            .filter((enemy) => !enemy.dead && distance(enemy) <= range)
            .sort((a, b) => distance(a) - distance(b))
            .slice(0, targets);
        let from = { x, y };
        for (const enemy of struck) {
            const to = center(enemy);
            this.effects.push({ kind: 'lightning', x: from.x, y: from.y, x2: to.x, y2: to.y, ttl: 0.18, life: 0.18 });
            this.hitEnemy(enemy, damage, id, to.x < x ? -1 : 1, crit);
            from = to;
        }
    }

    // Попадание по врагу: звук и всплывающее число урона.
    // impact — удар ближнего боя или по площади: от него кадр на миг замирает.
    hitEnemy(enemy, damage, id, dir, crit = false, freeze = 0, impact = true) {
        if (!enemy.hit(damage, id, dir, freeze)) return false;
        this.emit('hit');
        if (impact) this.freeze = Math.max(this.freeze, HITSTOP);
        if (crit) this.addShake(2);
        this.effects.push({
            kind: 'number', text: String(Math.round(damage)), crit,
            x: enemy.x + enemy.w / 2, y: enemy.y - 2, ttl: 0.6, life: 0.6,
        });
        return true;
    }

    // Возвращает true, если урон прошёл (герой не был неуязвим).
    hurtPlayer(amount) {
        if (!this.player.hurt(amount)) return false;
        this.feelHurt();
        return true;
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
