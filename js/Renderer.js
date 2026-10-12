import { TILE, VIEW_W, VIEW_H, INTRO_TIME, HURT_FLASH, DEATH_TIME } from './data/constants.js';
import { SOLID } from './Level.js';
import { PALETTE, SPRITES, GLYPHS, HEROES } from './data/sprites.js';
import { CLASSES } from './data/classes.js';
import { WEAPONS } from './data/weapons.js';
import { BOSS_INTRO } from './data/constants.js';
import { ENEMIES } from './data/enemies.js';
import { rarityOf } from './systems/Loot.js';
import { drawHud } from './ui/Hud.js';

const SILHOUETTES = [38, 62, 46, 80, 54, 70, 42, 66];
const SILHOUETTE_GAP = 44;
const RUN_CYCLE = ['run1', 'run2', 'run3', 'run2'];
const TILE_SPRITES = ['groundTop', 'ground', 'platform'];
const AIR_PARTICLES = 38;
const FADE_IN = 0.6;   // сколько секунд уровень проявляется из темноты

// Где фигура держит оружие: смещение спрайта оружия от левого верхнего угла
// спрайта фигуры (для фигуры, смотрящей вправо). Кисть — в точке (13, 12).
const HOLD = {
    sword: { x: 12, y: 2 },
    axe: { x: 12, y: 2 },
    spear: { x: 12, y: -2 },
    bow: { x: 9, y: 6 },
    shortbow: { x: 10, y: 8 },
    crossbow: { x: 10, y: 9 },
    staffFire: { x: 11, y: -2 },
    staffIce: { x: 11, y: -2 },
    staffStorm: { x: 11, y: -2 },
};
// Кисть фигуры: вокруг этой точки спрайта оружие поворачивается при взмахе.
const HAND = { x: 13, y: 12 };
// След удара ближнего боя: взмах или выпад.
const SWING = {
    slash: { x: 13, y: -1 },
    thrust: { x: 10, y: 12 },
};
// Свечение снарядов и цвета ударов по площади.
const SHOT_GLOW = { fireball: '#f28a2e', shard: '#8fd8ff', spark: '#ffe27a' };
const BLAST_COLOR = { fire: '#f28a2e', frost: '#8fd8ff', whirl: '#d5dbe0' };

// Цвета короны: зубец золотой, если его локация пройдена, иначе пепельный.
const CROWN_GOLD = '#e8b923';
const CROWN_ASH = '#5f5a66';

// Псевдослучайное число от 0 до 1 по номеру: одно и то же при каждом вызове.
// Нужно для звёзд, пепла и украшений земли — они «случайны», но не дрожат.
function hash(n) {
    const x = Math.sin(n * 127.1) * 43758.5453;
    return x - Math.floor(x);
}

const wrap = (value, size) => ((value % size) + size) % size;

// Рисует спрайт из строк палитры во внеэкранный canvas (один раз при запуске).
//   flip    — зеркально по горизонтали;
//   recolor — замена части цветов палитры (цвета класса героя, скелета, темы);
//   tint    — залить все непрозрачные пиксели одним цветом (вспышка при попадании).
function buildSprite(rows, { flip = false, recolor = null, tint = null } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = rows[0].length;
    canvas.height = rows.length;
    const ctx = canvas.getContext('2d');
    rows.forEach((line, y) => {
        for (let x = 0; x < line.length; x++) {
            const char = line[x];
            const color = recolor?.[char] ?? PALETTE[char];
            if (!color) continue;
            ctx.fillStyle = tint ?? color;
            ctx.fillRect(flip ? line.length - 1 - x : x, y, 1, 1);
        }
    });
    return canvas;
}

// Четыре вида одного спрайта: вправо, влево и белые копии обоих.
function buildSet(rows, recolor = null) {
    return {
        right: buildSprite(rows, { recolor }),
        left: buildSprite(rows, { recolor, flip: true }),
        rightWhite: buildSprite(rows, { tint: '#ffffff' }),
        leftWhite: buildSprite(rows, { tint: '#ffffff', flip: true }),
    };
}

// Затемнение к краям экрана: прозрачный центр, цветные края.
function buildVignette(color) {
    const canvas = document.createElement('canvas');
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 90, VIEW_W / 2, VIEW_H / 2, 290);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, color);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    return canvas;
}

export class Renderer {
    // overlay — надписи поверх поля (HudOverlay); может отсутствовать.
    constructor(canvas, overlay = null) {
        this.canvas = canvas;
        this.overlay = overlay;
        this.scale = 1;   // во сколько раз увеличено поле (см. resize)
        this.alpha = 1;   // доля шага логики между кадрами (см. between)
        canvas.width = VIEW_W;
        canvas.height = VIEW_H;
        this.ctx = canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;

        this.sprites = {};
        this.flipped = {};
        for (const [name, rows] of Object.entries(SPRITES)) {
            this.sprites[name] = buildSprite(rows);
            this.flipped[name] = buildSprite(rows, { flip: true });
        }

        // Кадры героя каждого класса.
        this.heroes = {};
        for (const id of Object.keys(CLASSES)) {
            this.heroes[id] = {};
            for (const [frame, rows] of Object.entries(HEROES[id].frames)) {
                this.heroes[id][frame] = buildSet(rows, HEROES[id].recolor);
            }
        }

        // Кадры каждого врага в его цветах. Скелеты и рыцарь берут фигуру героя.
        this.foes = {};
        for (const [id, def] of Object.entries(ENEMIES)) {
            this.foes[id] = {};
            const figure = HEROES[def.figure];
            for (const frame of new Set([...def.frames, def.idle ?? def.frames[0]])) {
                const rows = figure ? figure.frames[frame] : SPRITES[frame];
                const recolor = figure ? { ...figure.recolor, ...def.recolor } : def.recolor;
                this.foes[id][frame] = buildSet(rows, recolor);
            }
        }

        this.tileSets = {};  // тайлы земли в цветах локации, строятся при первом показе

        // Темнота: отдельный холст, залитый полумраком, в котором источники света
        // «прожигают» дыры. Потом он накладывается на мир.
        this.shade = document.createElement('canvas');
        this.shade.width = VIEW_W;
        this.shade.height = VIEW_H;
        this.shadeCtx = this.shade.getContext('2d');
        this.lights = [];    // источники света кадра: [x, y, радиус, сила] в экранных координатах
        this.vignette = buildVignette('rgba(5, 4, 8, 0.62)');
        this.danger = buildVignette('rgba(226, 87, 43, 0.9)');
    }

    // Портрет героя для экрана выбора класса.
    portrait(classId) {
        return this.heroes[classId].idle.right;
    }

    // Значок предмета: у оружия — его спрайт, у брони и амулета — свои картинки.
    icon(item) {
        const weapon = WEAPONS[item.kind];
        if (weapon) return this.sprites[weapon.sprite];
        return this.sprites[item.slot === 'armor' ? 'iconArmor' : 'iconAmulet'];
    }

    // Корона — знак игры: cleared зубцов из трёх позолочены.
    crown(cleared) {
        const lit = (index) => (cleared > index ? CROWN_GOLD : CROWN_ASH);
        return buildSprite(SPRITES.crown, {
            recolor: {
                1: lit(0), 2: lit(1), 3: lit(2),
                B: cleared > 0 ? '#b0842a' : '#4a4650',
                R: cleared >= 3 ? '#e2572b' : '#35313b',
            },
        });
    }

    // Маленький вид локации для карты: та же сцена, уменьшенная вчетверо.
    thumbnail(levelDef) {
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 68;
        const small = canvas.getContext('2d');
        small.imageSmoothingEnabled = false;
        small.scale(0.25, 0.25);
        const main = this.ctx;
        this.ctx = small;   // на время рисуем в маленький холст теми же методами
        this.drawScene(levelDef.theme, 2, 0);
        const tiles = this.tilesFor(levelDef);
        for (let x = 0; x < VIEW_W; x += TILE) {
            small.drawImage(tiles.groundTop, x, VIEW_H - 44);
            small.drawImage(tiles.ground, x, VIEW_H - 28);
            small.drawImage(tiles.ground, x, VIEW_H - 12);
        }
        this.ctx = main;
        return canvas;
    }

    // Увеличивает поле в целое число раз, чтобы пиксели оставались чёткими.
    resize() {
        const scale = Math.max(
            1,
            Math.floor(Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H))
        );
        const stage = this.canvas.parentElement;
        stage.style.width = `${VIEW_W * scale}px`;
        stage.style.height = `${VIEW_H * scale}px`;
        stage.style.setProperty('--scale', scale);

        // Холст создаётся в полном разрешении экрана, а рисование масштабируется.
        // Объекты могут стоять на долях игрового пикселя, поэтому движение
        // плавное, а сами спрайты остаются чёткими.
        this.scale = scale;
        this.canvas.width = VIEW_W * scale;
        this.canvas.height = VIEW_H * scale;
        this.ctx.imageSmoothingEnabled = false;
    }

    // Округление до пикселя экрана (а не до игрового пикселя).
    snap(value) {
        return Math.round(value * this.scale) / this.scale;
    }

    // Значение между прошлым и текущим шагом логики. Логика идёт 60 раз в секунду,
    // а кадры могут рисоваться чаще или не в такт — без этого движение дёргается.
    // Большой скачок (перенос к костру) не сглаживается.
    between(previous, current) {
        if (previous === undefined || Math.abs(current - previous) > 24) return current;
        return previous + (current - previous) * this.alpha;
    }

    // Сглаженное положение объекта на экране.
    pos(body) {
        return {
            x: this.snap(this.between(body.prevX, body.x)),
            y: this.snap(this.between(body.prevY, body.y)),
        };
    }

    tilesFor(levelDef) {
        const key = levelDef.world ?? levelDef.id;
        if (!this.tileSets[key]) {
            const set = {};
            for (const name of TILE_SPRITES) {
                set[name] = buildSprite(SPRITES[name], { recolor: levelDef.theme.tiles });
            }
            this.tileSets[key] = set;
        }
        return this.tileSets[key];
    }

    // ---------- Кадр игры ----------

    draw(game) {
        const { ctx } = this;
        const { theme } = game.levelDef;
        const { player, time } = game;
        // Тряска: камера дрожит на несколько пикселей и быстро успокаивается.
        ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
        this.alpha = game.alpha;
        const shakeX = Math.round(Math.sin(time * 93) * game.shake);
        const shakeY = Math.round(Math.cos(time * 71) * game.shake);
        const camX = this.snap(this.between(game.camera.prevX, game.camera.x)) + shakeX;
        const camY = Math.round(game.camera.y) + shakeY;
        this.lights = [];
        this.camX = camX;
        this.camY = camY;

        this.drawScene(theme, time, camX);

        ctx.save();
        ctx.translate(-camX, -camY);
        this.drawTiles(game, camX);
        this.drawObjects(game);
        this.drawHazards(game.hazards, time);
        this.drawEnemies(game.enemies);
        this.drawTrail(game);
        this.drawPlayer(player, game);
        this.drawShots(game.projectiles);
        this.drawShots(game.enemyShots);
        this.drawEffects(game.effects);
        ctx.restore();

        this.drawAir(theme, time, camX);
        this.collectLights(game);
        this.drawShade(theme);
        ctx.drawImage(this.vignette, 0, 0);

        // Мало здоровья — края экрана пульсируют красным; урон — короткая вспышка.
        const low = !player.dead && player.hp / player.maxHp < 0.3;
        const pulse = low ? 0.1 + 0.07 * Math.sin(time * 6) : 0;
        const flash = (game.hurtFlash / HURT_FLASH) * 0.45;
        if (pulse + flash > 0) {
            ctx.globalAlpha = Math.min(1, pulse + flash);
            ctx.drawImage(this.danger, 0, 0);
            ctx.globalAlpha = 1;
        }

        // Сцена пробуждения стража: экран сужается чёрными полосами сверху и снизу.
        if (game.cinema > 0) {
            const bar = Math.round(22 * Math.min(1, (game.cinema / BOSS_INTRO) * 3, (1 - game.cinema / BOSS_INTRO) * 6 + 0.2));
            ctx.fillStyle = '#0d0b10';
            ctx.fillRect(0, 0, VIEW_W, bar);
            ctx.fillRect(0, VIEW_H - bar, VIEW_W, bar);
        }

        drawHud(this, game);

        // Уровень проявляется из темноты.
        const fade = (game.intro - (INTRO_TIME - FADE_IN)) / FADE_IN;
        if (fade > 0) {
            ctx.fillStyle = `rgba(13, 11, 16, ${Math.min(1, fade)})`;
            ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        }

        this.overlay?.sync(game);
    }

    // ---------- Сцена за меню ----------

    // Охотник у костра под падающим пеплом. Камера неподвижна, живёт только воздух.
    drawTitle(time, levelDef, classId, weaponSprite) {
        const { ctx } = this;
        const { theme } = levelDef;
        const tiles = this.tilesFor(levelDef);
        const ground = VIEW_H - 44;
        ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

        this.lights = [];
        this.drawScene(theme, time, 0);
        for (let x = 0; x < VIEW_W; x += TILE) {
            ctx.drawImage(tiles.groundTop, x, ground);
            ctx.drawImage(tiles.ground, x, ground + TILE);
            ctx.drawImage(tiles.ground, x, ground + TILE * 2);
            this.drawDecor(theme, x, ground, x / TILE + 3, 0);
        }
        this.drawCampfire(352, ground, time, true);

        const hero = this.heroes[classId].idle.right;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(323, ground - 1, 10, 2);
        this.drawFigure(hero, 320, ground - hero.height, true, weaponSprite, 1, Math.floor(time * 2) % 2);

        this.drawAir(theme, time, 0);
        this.camX = 0;
        this.camY = 0;
        this.light(357, ground - 8, 110 + Math.sin(time * 9) * 4, 1);
        this.drawShade(theme);
        ctx.drawImage(this.vignette, 0, 0);
        this.overlay?.sync(null);
    }

    // ---------- Фон ----------

    // Небо, светила, три слоя силуэтов и туман.
    drawScene(theme, time, camX) {
        const { ctx } = this;
        const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
        sky.addColorStop(0, theme.skyTop);
        sky.addColorStop(1, theme.skyBottom);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);

        if (theme.moon) {
            this.drawStars(time);
            this.drawMoon(theme.moon);
        }

        // Дальние слои движутся медленнее ближних — это и есть параллакс.
        this.drawSilhouettes(camX * 0.15, theme.far, 0.55, VIEW_H - 46, theme, false, time);
        this.drawSilhouettes(camX * 0.35, theme.mid, 0.8, VIEW_H - 38, theme, false, time);
        this.drawSilhouettes(camX * 0.6, theme.near, 1, VIEW_H - 30, theme, true, time);

        // Туман: три полупрозрачные полосы, которые медленно плывут и колышутся.
        ctx.fillStyle = theme.fog;
        for (let band = 0; band < 3; band++) {
            ctx.globalAlpha = 0.035 + band * 0.012;
            const y = VIEW_H - 84 + band * 20 + Math.sin(time * 0.3 + band * 2) * 3;
            const drift = wrap(time * (5 + band * 3) - camX * 0.4, 96);
            for (let x = -96 + drift; x < VIEW_W; x += 96) ctx.fillRect(Math.round(x), Math.round(y), 70, 12);
            ctx.fillRect(0, Math.round(y) + 4, VIEW_W, 10);
        }
        ctx.globalAlpha = 1;
    }

    drawStars(time) {
        const { ctx } = this;
        ctx.fillStyle = '#e6dcc6';
        for (let i = 0; i < 46; i++) {
            const twinkle = Math.sin(time * (0.8 + hash(i + 9) * 2) + i);
            ctx.globalAlpha = 0.3 + 0.3 * twinkle;
            ctx.fillRect(Math.floor(hash(i) * VIEW_W), Math.floor(hash(i + 50) * 150), 1, 1);
        }
        ctx.globalAlpha = 1;
    }

    // Луна из горизонтальных полосок — так круг остаётся пиксельным.
    drawMoon(color) {
        const { ctx } = this;
        const cx = 392;
        const cy = 48;
        const radius = 14;
        this.glow(cx, cy, 52, color, 0.16);
        this.lights.push([cx, cy, 80, 0.75]);
        ctx.fillStyle = color;
        for (let dy = -radius; dy <= radius; dy++) {
            const half = Math.floor(Math.sqrt(radius * radius - dy * dy));
            ctx.fillRect(cx - half, cy + dy, half * 2, 1);
        }
        // Кратеры.
        ctx.fillStyle = 'rgba(13, 11, 16, 0.18)';
        ctx.fillRect(cx - 7, cy - 5, 5, 4);
        ctx.fillRect(cx + 2, cy + 3, 6, 5);
        ctx.fillRect(cx + 4, cy - 8, 3, 3);
    }

    // Мягкое пятно света. Режим lighter складывает цвета — получается свечение.
    glow(x, y, radius, color, alpha) {
        const { ctx } = this;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha;
        ctx.fillStyle = gradient;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        ctx.restore();
    }

    // Один слой силуэтов: ели в лесу, колонны в замке и подземелье.
    drawSilhouettes(offset, color, k, base, theme, front, time) {
        const { ctx } = this;
        const columns = theme.backdrop === 'columns';
        ctx.fillStyle = color;
        ctx.fillRect(0, base, VIEW_W, VIEW_H - base);
        const first = Math.floor(offset / SILHOUETTE_GAP);
        for (let i = first - 1; i <= first + VIEW_W / SILHOUETTE_GAP + 1; i++) {
            const height = Math.round(SILHOUETTES[wrap(i, SILHOUETTES.length)] * k);
            const x = this.snap(i * SILHOUETTE_GAP - offset);
            ctx.fillStyle = color;
            if (!columns) {
                const trunk = Math.round(height * 0.4);
                const tier = Math.round(height * 0.15);
                ctx.fillRect(x + 9, base - trunk, 4, trunk);
                for (let t = 0; t < 4; t++) {
                    const width = 22 - t * 5;
                    ctx.fillRect(x + 11 - Math.round(width / 2), base - trunk - (t + 1) * tier, width, tier + 1);
                }
                continue;
            }
            ctx.fillRect(x + 6, base - height, 10, height);
            ctx.fillRect(x + 3, base - height - 4, 16, 4);
            if (theme.particles === 'embers') {
                // Подземелье: сверху свисают сталактиты.
                const drop = Math.round(height * 0.5);
                ctx.fillRect(x + 26, 0, 8, drop);
                ctx.fillRect(x + 28, drop, 4, 6);
            } else if (front && wrap(i, 3) === 0) {
                // Замок: на ближних колоннах горят факелы.
                const flicker = Math.floor(time * 9 + i) % 2;
                const fy = base - height - 10;
                ctx.fillStyle = '#f28a2e';
                ctx.fillRect(x + 9, fy + flicker, 4, 6 - flicker);
                ctx.fillStyle = '#ffd75e';
                ctx.fillRect(x + 10, fy + 2, 2, 3);
                this.glow(x + 11, fy + 2, 30, '#f28a2e', 0.2 + flicker * 0.04);
                this.lights.push([x + 11, fy + 2, 52 + flicker * 3, 0.7]);
            }
        }
    }

    // То, что летает в воздухе: пепел падает, искры поднимаются, пыль дрейфует.
    // Положение каждой частицы вычисляется из времени — хранить их не нужно.
    drawAir(theme, time, camX) {
        const { ctx } = this;
        for (let i = 0; i < AIR_PARTICLES; i++) {
            const depth = 0.3 + hash(i * 3.7) * 0.7;      // ближние частицы крупнее и быстрее
            const startX = hash(i * 3.7 + 2) * VIEW_W;
            const startY = hash(i * 3.7 + 3) * VIEW_H;
            const sway = Math.sin(time * 0.6 + i) * 12;
            const x = wrap(startX + sway - camX * depth * 0.4, VIEW_W);
            let y;
            if (theme.particles === 'embers') {
                y = wrap(startY - time * (14 + depth * 22), VIEW_H);
                ctx.fillStyle = i % 3 === 0 ? '#ffd75e' : '#f28a2e';
                ctx.globalAlpha = (y / VIEW_H) * (0.5 + 0.4 * Math.sin(time * 9 + i));
            } else if (theme.particles === 'dust') {
                y = wrap(startY + Math.sin(time * 0.4 + i) * 10 + time * 2, VIEW_H);
                ctx.fillStyle = '#c9cde0';
                ctx.globalAlpha = 0.12 + depth * 0.14;
            } else {
                y = wrap(startY + time * (8 + depth * 14), VIEW_H);
                ctx.fillStyle = '#b9b2bd';
                ctx.globalAlpha = 0.2 + depth * 0.4;
            }
            const size = depth > 0.82 ? 2 : 1;
            ctx.fillRect(Math.round(x), Math.round(y), size, size);
        }
        ctx.globalAlpha = 1;
    }

    // ---------- Свет ----------

    // Источник света в координатах мира.
    light(x, y, radius, strength = 1) {
        this.lights.push([x - this.camX, y - this.camY, radius, strength]);
    }

    // Собирает всё, что светится в этом кадре: героя, костры, портал, снаряды,
    // огненные ловушки, заклинания, добычу. Лава и факелы добавляют себя сами при отрисовке.
    collectLights(game) {
        const { player, time } = game;
        const hero = this.pos(player);
        this.light(hero.x + player.w / 2, hero.y + player.h / 2, 104, 1);
        if (game.checkpoint && game.checkpoint !== game.level.spawn) {
            const fire = game.checkpoint;
            this.light(fire.x + 8, fire.y + 6, 96 + Math.sin(time * 9) * 4, 1);
        }
        if (!game.bossAlive) this.light(game.level.exit.x + 8, game.level.exit.y + 8, 64, 0.9);
        for (const shot of [...game.projectiles, ...game.enemyShots]) {
            if (SHOT_GLOW[shot.sprite]) this.light(shot.x + shot.w / 2, shot.y + shot.h / 2, 38, 0.8);
        }
        for (const hazard of game.hazards) {
            if (hazard.delay <= 0 && hazard.kind === 'pillar') this.light(hazard.x + hazard.w / 2, hazard.y + hazard.h / 2, 74, 1);
        }
        for (const effect of game.effects) {
            if (effect.kind === 'blast') this.light(effect.x, effect.y, effect.radius * 1.6, effect.ttl / effect.life);
            else if (effect.kind === 'lightning') this.light(effect.x2, effect.y2, 46, effect.ttl / effect.life);
        }
        for (const drop of game.drops) {
            if (drop.kind !== 'gold') this.light(drop.x + 4, drop.y + 4, 24, 0.7);
        }
        for (const enemy of game.enemies) {
            if (enemy.type === 'demon') this.light(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, 80, 0.85);
            else if (enemy.type === 'imp') this.light(enemy.x + 6, enemy.y + 6, 28, 0.6);
        }
    }

    // Накладывает темноту с дырами от источников света.
    drawShade(theme) {
        const shade = this.shadeCtx;
        shade.globalCompositeOperation = 'source-over';
        shade.clearRect(0, 0, VIEW_W, VIEW_H);
        shade.fillStyle = theme.dark ?? 'rgba(5, 6, 14, 0.58)';
        shade.fillRect(0, 0, VIEW_W, VIEW_H);
        // destination-out стирает темноту там, где рисуется свет.
        shade.globalCompositeOperation = 'destination-out';
        for (const [x, y, radius, strength] of this.lights) {
            const gradient = shade.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
            gradient.addColorStop(0.5, `rgba(0, 0, 0, ${strength * 0.55})`);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            shade.fillStyle = gradient;
            shade.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }
        // Темнота растягивается со сглаживанием: свет мягкий, без ступенек.
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.drawImage(this.shade, 0, 0);
        this.ctx.imageSmoothingEnabled = false;
    }

    // ---------- Мир ----------

    drawTiles(game, camX) {
        const { ctx, sprites } = this;
        const { level } = game;
        const { theme } = game.levelDef;
        const tiles = this.tilesFor(game.levelDef);
        const first = Math.max(0, Math.floor(camX / TILE) - 1);
        const last = Math.min(level.cols - 1, Math.floor((camX + VIEW_W) / TILE) + 1);
        this.drawArena(game);
        this.drawProps(game, first - 3, last + 3);
        for (let row = 0; row < level.rows; row++) {
            for (let col = first; col <= last; col++) {
                const char = level.charAt(col, row);
                const x = col * TILE;
                const y = row * TILE;
                if (char === '#') {
                    const covered = level.tileAt(col, row - 1) === SOLID;
                    ctx.drawImage(covered ? tiles.ground : tiles.groundTop, x, y);
                    this.shadeTile(level, col, row, x, y);
                    if (!covered && level.charAt(col, row - 1) === '.') this.drawDecor(theme, x, y, col, row);
                } else if (char === '=') {
                    ctx.drawImage(tiles.platform, x, y);
                } else if (char === '^') {
                    ctx.drawImage(sprites.spikes, x, y + TILE - sprites.spikes.height);
                } else if (char === '~') {
                    this.drawLava(x, y, col, game.time);
                } else if (char === 'f') {
                    // Решётка, из которой бьёт огненный столб.
                    ctx.fillStyle = '#1a1423';
                    ctx.fillRect(x + 2, y + TILE - 2, 12, 2);
                    ctx.fillStyle = '#f28a2e';
                    ctx.fillRect(x + 4, y + TILE - 1, 8, 1);
                }
            }
        }
    }

    // Объём земли: чем глубже тайл, тем он темнее; у обрывов и нависаний — тёмная кромка.
    shadeTile(level, col, row, x, y) {
        const { ctx } = this;
        let depth = 0;
        while (depth < 4 && level.tileAt(col, row - depth - 1) === SOLID) depth++;
        if (depth > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${depth * 0.12})`;
            ctx.fillRect(x, y, TILE, TILE);
        }
        ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
        if (level.tileAt(col - 1, row) !== SOLID) ctx.fillRect(x, y, 2, TILE);
        if (level.tileAt(col + 1, row) !== SOLID) ctx.fillRect(x + TILE - 2, y, 2, TILE);
        if (row + 1 < level.rows && level.tileAt(col, row + 1) !== SOLID) ctx.fillRect(x, y + TILE - 3, TILE, 3);
    }

    // Логово стража: за ареной стоит то, что он стережёт. В лесу — исполинское дерево,
    // в замке — трон под знамёнами, в подземелье — огненный провал с рогатым черепом.
    drawArena(game) {
        const { level, time } = game;
        level.bossSpawn ??= level.enemies.find((spawn) => ENEMIES[spawn.type].boss) ?? null;
        const spawn = level.bossSpawn;
        if (!spawn || Math.abs(spawn.x - this.camX - VIEW_W / 2) > VIEW_W) return;
        const { ctx } = this;
        const x = spawn.x + 8;
        const y = spawn.y + TILE;
        if (spawn.type === 'treant') {
            ctx.fillStyle = '#17120e';
            ctx.fillRect(x - 46, y - 270, 92, 270);
            ctx.fillRect(x - 70, y - 22, 140, 22);
            ctx.fillRect(x - 96, y - 8, 192, 8);
            ctx.fillStyle = '#13261c';
            ctx.fillRect(x - 170, y - 270, 340, 74);
            ctx.fillRect(x - 130, y - 200, 260, 26);
            // Вырезанные на коре знаки клятвы тлеют.
            ctx.fillStyle = `rgba(127, 174, 74, ${0.35 + 0.2 * Math.sin(time * 2)})`;
            for (const [dx, dy] of [[-30, -120], [24, -150], [-8, -84], [30, -70]]) {
                ctx.fillRect(x + dx, y + dy, 2, 8);
                ctx.fillRect(x + dx - 2, y + dy + 3, 6, 2);
            }
        } else if (spawn.type === 'knight') {
            // Высокое окно с лунным светом.
            ctx.fillStyle = '#12131b';
            ctx.fillRect(x - 22, y - 150, 44, 96);
            ctx.fillStyle = 'rgba(201, 205, 224, 0.28)';
            ctx.fillRect(x - 18, y - 146, 36, 88);
            ctx.fillStyle = '#12131b';
            ctx.fillRect(x - 2, y - 146, 4, 88);
            ctx.fillRect(x - 18, y - 106, 36, 3);
            this.light(x, y - 100, 90, 0.55);
            // Трон.
            ctx.fillStyle = '#2a2c3a';
            ctx.fillRect(x - 16, y - 58, 32, 58);
            ctx.fillRect(x - 22, y - 26, 44, 26);
            ctx.fillStyle = '#b0842a';
            ctx.fillRect(x - 16, y - 60, 32, 2);
            ctx.fillRect(x - 3, y - 68, 6, 8);
            // Знамёна по сторонам.
            for (const dx of [-84, 70]) {
                ctx.fillStyle = '#5a1822';
                ctx.fillRect(x + dx, y - 150, 16, 78);
                ctx.fillRect(x + dx, y - 72, 5, 8);
                ctx.fillRect(x + dx + 11, y - 72, 5, 8);
                ctx.fillStyle = '#b0842a';
                ctx.fillRect(x + dx, y - 150, 16, 3);
            }
        } else {
            // Огненный провал за спиной Демона.
            const pulse = 0.5 + 0.12 * Math.sin(time * 3);
            this.glow(x, y - 20, 150, '#e2572b', pulse * 0.5);
            this.light(x, y - 30, 150, 0.7);
            ctx.fillStyle = '#1a0a0a';
            ctx.fillRect(x - 40, y - 96, 80, 96);
            ctx.fillRect(x - 64, y - 126, 16, 60);
            ctx.fillRect(x + 48, y - 126, 16, 60);
            ctx.fillRect(x - 64, y - 76, 128, 14);
            ctx.fillStyle = `rgba(242, 138, 46, ${pulse})`;
            ctx.fillRect(x - 22, y - 70, 12, 10);
            ctx.fillRect(x + 10, y - 70, 12, 10);
            ctx.fillRect(x - 14, y - 40, 28, 4);
        }
    }

    // Строка поверхности в колонке: верхний твёрдый тайл, над которым пусто.
    // Считается один раз на уровень.
    surface(level, col) {
        level.surfaceRows ??= [];
        if (level.surfaceRows[col] === undefined) {
            let found = null;
            for (let row = 3; row < level.rows; row++) {
                if (level.tileAt(col, row) !== SOLID) continue;
                if (level.charAt(col, row - 1) === '.' && level.charAt(col, row - 2) === '.') found = row;
                break;
            }
            level.surfaceRows[col] = found;
        }
        return level.surfaceRows[col];
    }

    // Крупные предметы окружения за героем: деревья и надгробия в лесу, знамёна и окна
    // в замке, сталагмиты и кристаллы в подземелье. Где что стоит, решает номер колонки.
    drawProps(game, first, last) {
        const { level } = game;
        const { theme } = game.levelDef;
        for (let col = Math.max(1, first); col <= Math.min(level.cols - 2, last); col++) {
            const roll = hash(col * 3.17 + level.cols);
            if (roll > 0.2) continue;
            const row = this.surface(level, col);
            if (row === null || this.surface(level, col + 1) !== row) continue;
            const x = col * TILE;
            const y = row * TILE;
            const kind = Math.floor(roll * 15);   // 0, 1 или 2
            if (theme.particles === 'ash') this.forestProp(kind, x, y);
            else if (theme.particles === 'dust') this.castleProp(kind, x, y, game.time);
            else this.dungeonProp(kind, x, y, game.time);
        }
    }

    forestProp(kind, x, y) {
        const { ctx } = this;
        if (kind === 0) {
            // Ель на переднем плане фона.
            ctx.fillStyle = '#231a14';
            ctx.fillRect(x + 6, y - 44, 5, 44);
            for (const [dx, dy, w, color] of [[-9, -62, 34, '#1b3327'], [-5, -76, 26, '#214030'], [-1, -88, 18, '#28503a'], [3, -97, 10, '#28503a']]) {
                ctx.fillStyle = color;
                ctx.fillRect(x + dx, y + dy, w, 16);
            }
        } else if (kind === 1) {
            // Куст с ягодами.
            ctx.fillStyle = '#254a31';
            ctx.fillRect(x, y - 7, 18, 7);
            ctx.fillRect(x + 3, y - 11, 12, 4);
            ctx.fillStyle = '#e2572b';
            ctx.fillRect(x + 5, y - 8, 1, 1);
            ctx.fillRect(x + 11, y - 5, 1, 1);
        } else {
            // Надгробие.
            ctx.fillStyle = '#4a4650';
            ctx.fillRect(x + 4, y - 12, 9, 12);
            ctx.fillRect(x + 5, y - 14, 7, 2);
            ctx.fillStyle = '#2a2630';
            ctx.fillRect(x + 8, y - 11, 1, 6);
            ctx.fillRect(x + 6, y - 9, 5, 1);
        }
    }

    castleProp(kind, x, y, time) {
        const { ctx } = this;
        if (kind === 0) {
            // Истрёпанное знамя на древке.
            ctx.fillStyle = '#3a3c48';
            ctx.fillRect(x + 6, y - 54, 2, 54);
            ctx.fillStyle = '#6b1f2a';
            ctx.fillRect(x + 8, y - 52, 13, 20);
            ctx.fillRect(x + 8, y - 32, 4, 5);
            ctx.fillRect(x + 15, y - 32, 4, 3);
            ctx.fillStyle = '#b0842a';
            ctx.fillRect(x + 8, y - 52, 13, 2);
            ctx.fillRect(x + 13, y - 46, 3, 3);
        } else if (kind === 1) {
            // Обломок колонны.
            ctx.fillStyle = '#42455180';
            ctx.fillStyle = '#424551';
            ctx.fillRect(x + 2, y - 24, 13, 24);
            ctx.fillRect(x, y - 28, 17, 4);
            ctx.fillStyle = '#2c2e3a';
            ctx.fillRect(x + 6, y - 20, 1, 9);
            ctx.fillRect(x + 7, y - 12, 4, 1);
        } else {
            // Стрельчатое окно, в котором ещё горит свет.
            ctx.fillStyle = '#20212c';
            ctx.fillRect(x + 1, y - 50, 14, 24);
            ctx.fillRect(x + 4, y - 53, 8, 3);
            ctx.fillStyle = `rgba(242, 193, 78, ${0.5 + 0.08 * Math.sin(time * 5 + x)})`;
            ctx.fillRect(x + 3, y - 48, 10, 20);
            ctx.fillStyle = '#20212c';
            ctx.fillRect(x + 7, y - 48, 2, 20);
            ctx.fillRect(x + 3, y - 39, 10, 2);
            this.light(x + 8, y - 38, 44, 0.6);
        }
    }

    dungeonProp(kind, x, y, time) {
        const { ctx } = this;
        if (kind === 0) {
            // Сталагмит.
            ctx.fillStyle = '#3a1816';
            ctx.fillRect(x + 2, y - 8, 12, 8);
            ctx.fillRect(x + 4, y - 16, 8, 8);
            ctx.fillRect(x + 6, y - 23, 4, 7);
        } else if (kind === 1) {
            // Цепь с клеткой.
            ctx.fillStyle = '#4a4650';
            for (let link = 0; link < 9; link++) ctx.fillRect(x + 7, y - 96 + link * 6, 2, 4);
            ctx.fillRect(x + 2, y - 44, 12, 2);
            ctx.fillRect(x + 2, y - 28, 12, 2);
            for (const bar of [2, 5, 8, 11, 13]) ctx.fillRect(x + bar, y - 44, 1, 18);
        } else {
            // Тлеющий кристалл.
            const pulse = 0.75 + 0.2 * Math.sin(time * 3 + x);
            ctx.fillStyle = '#8a2a1a';
            ctx.fillRect(x + 4, y - 9, 8, 9);
            ctx.fillStyle = '#e2572b';
            ctx.fillRect(x + 5, y - 14, 5, 12);
            ctx.fillStyle = '#ffd75e';
            ctx.fillRect(x + 7, y - 12, 1, 7);
            this.glow(x + 8, y - 8, 22, '#f28a2e', 0.3 * pulse);
            this.light(x + 8, y - 8, 44, 0.7 * pulse);
        }
    }

    // Мелочи на земле: трава и грибы в лесу, кости в замке, тлеющие трещины в подземелье.
    // Что именно растёт на тайле, решает его номер — картина не меняется от кадра к кадру.
    drawDecor(theme, x, y, col, row) {
        const { ctx } = this;
        const pick = Math.floor(hash(col * 7.3 + row * 1.9) * 9);
        if (theme.particles === 'ash') {
            if (pick <= 1) {
                ctx.fillStyle = '#7fae4a';
                ctx.fillRect(x + 3, y - 2, 1, 2);
                ctx.fillRect(x + 5, y - 3, 1, 3);
                ctx.fillRect(x + 11, y - 2, 1, 2);
            } else if (pick === 2) {
                ctx.fillStyle = '#4f7a3a';
                ctx.fillRect(x + 8, y - 4, 1, 4);
                ctx.fillStyle = '#e2572b';
                ctx.fillRect(x + 7, y - 5, 3, 2);
            } else if (pick === 3) {
                ctx.fillStyle = '#e6dcc6';
                ctx.fillRect(x + 7, y - 2, 1, 2);
                ctx.fillStyle = '#c9a24a';
                ctx.fillRect(x + 5, y - 4, 5, 2);
            }
        } else if (theme.particles === 'dust') {
            if (pick === 0) {
                ctx.fillStyle = '#ece6d2';
                ctx.fillRect(x + 4, y - 1, 6, 1);
                ctx.fillRect(x + 3, y - 2, 2, 2);
                ctx.fillRect(x + 9, y - 2, 2, 2);
            } else if (pick === 1) {
                ctx.fillStyle = '#3a3c48';
                ctx.fillRect(x + 3, y + 3, 4, 1);
                ctx.fillRect(x + 6, y + 4, 1, 3);
                ctx.fillRect(x + 7, y + 6, 4, 1);
            }
        } else if (pick <= 1) {
            ctx.fillStyle = '#f28a2e';
            ctx.fillRect(x + 3, y + 2, 5, 1);
            ctx.fillRect(x + 7, y + 3, 3, 1);
            ctx.fillStyle = '#ffd75e';
            ctx.fillRect(x + 5, y + 2, 2, 1);
        }
    }

    // Лава: красная толща, бегущая по поверхности рябь и зарево над ней.
    drawLava(x, y, col, time) {
        const { ctx } = this;
        ctx.fillStyle = '#d9442b';
        ctx.fillRect(x, y + 4, TILE, TILE - 4);
        const shift = Math.floor(time * 4);
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = (i + col * 4 + shift) % 3 === 0 ? '#ffd75e' : '#f28a2e';
            ctx.fillRect(x + i * 4, y + 3 + ((i + col + shift) % 2), 4, 2);
        }
        if (col % 2 === 0) {
            this.glow(x + TILE, y + 4, 34, '#f28a2e', 0.14 + 0.03 * Math.sin(time * 3 + col));
            this.light(x + TILE, y + 2, 62, 0.85);
        }
    }

    // Костёр: горящий — с пляшущим пламенем, светом и искрами; потухший — только поленья.
    drawCampfire(x, groundY, time, lit) {
        const { ctx, sprites, flipped } = this;
        if (!lit) {
            ctx.drawImage(sprites.campfireOff, x, groundY - sprites.campfireOff.height);
            return;
        }
        const frame = Math.floor(time * 8) % 2;
        this.glow(x + 5, groundY - 6, 44, '#f28a2e', 0.26 + 0.05 * Math.sin(time * 11));
        ctx.drawImage(frame ? flipped.campfire : sprites.campfire, x, groundY - sprites.campfire.height - frame);
        ctx.drawImage(sprites.campfireOff, x, groundY - sprites.campfireOff.height);
        ctx.fillStyle = '#ffd75e';
        for (let i = 0; i < 3; i++) {
            const life = wrap(time * 0.9 + i * 0.37, 1);
            ctx.globalAlpha = 1 - life;
            ctx.fillRect(Math.round(x + 4 + Math.sin(time * 3 + i * 2) * 4), Math.round(groundY - 10 - life * 22), 1, 1);
        }
        ctx.globalAlpha = 1;
    }

    drawObjects(game) {
        const { ctx, sprites } = this;
        const { time } = game;
        for (const checkpoint of game.level.checkpoints) {
            this.drawCampfire(checkpoint.x + 3, checkpoint.y + TILE, time, checkpoint === game.checkpoint);
        }

        // Портал: открытый светится и окружён кружащими искрами; пока жив босс — тусклый.
        const { exit } = game.level;
        const cx = exit.x + 8;
        const cy = exit.y + 8;
        if (game.bossAlive) {
            ctx.globalAlpha = 0.3;
            ctx.drawImage(sprites.portal, exit.x + 2, exit.y);
            ctx.globalAlpha = 1;
        } else {
            this.glow(cx, cy, 36, '#7a3fd1', 0.3 + 0.08 * Math.sin(time * 4));
            ctx.drawImage(sprites.portal, exit.x + 2, exit.y);
            ctx.fillStyle = '#c08bff';
            for (let i = 0; i < 4; i++) {
                const angle = time * 2 + (i * Math.PI) / 2;
                ctx.fillRect(Math.round(cx + Math.cos(angle) * 11), Math.round(cy + Math.sin(angle) * 13), 1, 1);
            }
        }

        for (const coin of game.coins) {
            if (coin.taken) continue;
            const bob = Math.round(Math.sin(time * 4 + coin.x) * 1.5);
            ctx.drawImage(sprites.coin, coin.x + 4, coin.y + 4 + bob);
            // Время от времени по монете пробегает блик.
            if (wrap(time * 1.2 + coin.x * 0.013, 2) < 0.12) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(coin.x + 6, coin.y + 5 + bob, 2, 2);
            }
        }
        for (const drop of game.drops) {
            const { x, y } = this.pos(drop);
            if (drop.kind === 'gold') {
                ctx.drawImage(sprites.coin, x, y);
                continue;
            }
            if (drop.kind === 'heart') {
                // Сердце слегка покачивается и светится.
                this.glow(x + 4, y + 4, 14, '#e2572b', 0.35);
                ctx.drawImage(sprites.heart, x, y + 1 + Math.round(Math.sin(time * 5) * 1));
                continue;
            }
            // Предмет: мешочек в мерцающей рамке и свечении цвета редкости.
            const color = rarityOf(drop.item).color;
            this.glow(x + 4, y + 4, 16, color, 0.3);
            ctx.globalAlpha = 0.55 + 0.45 * Math.sin(time * 6);
            ctx.fillStyle = color;
            ctx.fillRect(x - 2, y - 2, 12, 12);
            ctx.globalAlpha = 1;
            ctx.drawImage(sprites.lootBag, x, y);
        }
    }

    // Ловушки: сначала мигающая метка на полу, затем сама ловушка.
    drawHazards(hazards, time) {
        const { ctx } = this;
        for (const hazard of hazards) {
            const { x, y, w, h } = hazard;
            const bottom = y + h;
            const fire = hazard.kind !== 'root';
            if (hazard.delay > 0) {
                if (Math.floor(time * 12) % 2 === 0) {
                    ctx.fillStyle = fire ? '#f28a2e' : '#b07a3d';
                    ctx.fillRect(x, bottom - 2, w, 2);
                    ctx.fillRect(x + w / 2 - 1, bottom - 5, 2, 3);
                }
                continue;
            }
            if (hazard.kind === 'root') {
                ctx.fillStyle = '#4a3328';
                ctx.fillRect(x + 3, y + 6, w - 6, h - 6);
                ctx.fillRect(x + 5, y, 2, 6);
                ctx.fillStyle = '#8a5a2b';
                ctx.fillRect(x + 4, y + 8, 2, h - 8);
            } else if (hazard.kind === 'shock') {
                ctx.fillStyle = '#d5dbe0';
                ctx.fillRect(x, bottom - 4, w, 4);
                ctx.fillStyle = '#9aa3ad';
                ctx.fillRect(x + 4, y, w - 8, h - 4);
            } else {
                // Огненный столб: три слоя, которые дрожат, и свет вокруг.
                const flicker = Math.floor(time * 20) % 2;
                this.glow(x + w / 2, y + h / 2, 40, '#f28a2e', 0.3);
                ctx.fillStyle = '#d9442b';
                ctx.fillRect(x, y + flicker * 2, w, h - flicker * 2);
                ctx.fillStyle = '#f28a2e';
                ctx.fillRect(x + 2, y + 4, w - 4, h - 4);
                ctx.fillStyle = '#ffd75e';
                ctx.fillRect(x + 4, y + 10 - flicker * 2, w - 8, h - 10 + flicker * 2);
            }
        }
    }

    // Тень под стоящим на земле. x, y — сглаженное положение тела.
    drawShadow(x, y, body) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        this.ctx.fillRect(x + 1, y + body.h - 1, body.w - 2, 2);
    }

    // Поза: рисует картинку, повернув и растянув её вокруг точки опоры (ступней).
    //   angle — наклон в радианах; stretch — растяжение по высоте (ширина сжимается в ответ).
    posed(footX, footY, angle, stretch, alpha, drawBody) {
        const { ctx } = this;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(footX, footY);
        ctx.rotate(angle);
        ctx.scale(1 - stretch * 0.6, 1 + stretch);
        ctx.translate(-footX, -footY);
        drawBody();
        ctx.restore();
    }

    // Угол оружия врага: занесено при замахе, опущено при ударе.
    foeWeaponAngle(enemy) {
        if (enemy.phase === 'windup' || enemy.state === 'windup') return -1.5;
        if (enemy.phase === 'strike' || enemy.state === 'dash') return 1.1;
        return 0;
    }

    drawEnemies(enemies) {
        const { ctx } = this;
        for (const enemy of enemies) {
            const { def } = enemy;
            const scale = def.scale ?? 1;
            const moving = Math.abs(enemy.vx) > 1 || def.behavior === 'flyer';
            const frame = moving
                ? def.frames[Math.floor(enemy.animTime * 6) % def.frames.length]
                : def.idle ?? def.frames[0];
            const right = enemy.facing === 1;
            const at = this.pos(enemy);
            if (enemy.onGround) this.drawShadow(at.x, at.y, enemy);

            // Белым: вспышка при попадании и мигание во время замаха перед ударом.
            const windup = enemy.phase === 'windup' || enemy.state === 'windup';
            const white = enemy.flash > 0 || (windup && Math.floor(enemy.animTime * 16) % 2 === 0);
            const side = (right ? 'right' : 'left') + (white ? 'White' : '');
            const sprite = this.foes[enemy.type][frame][side];

            // Спрайт стоит на нижнем крае хитбокса, по центру.
            const sw = sprite.width * scale;
            const sh = sprite.height * scale;
            const sx = this.snap(at.x + enemy.w / 2 - sw / 2);
            const sy = this.snap(at.y + enemy.h - sh);

            // Живость: слизень пульсирует, получивший удар враг сплющивается, страж «дышит».
            let stretch = 0;
            if (enemy.stun > 0 && !def.boss) stretch = -0.14;
            else if (enemy.type === 'slime') stretch = Math.sin(enemy.animTime * 8) * 0.07;
            else if (def.boss) stretch = Math.sin(enemy.animTime * 2) * 0.015;
            // Спящий страж стоит в тени, пока герой не подойдёт.
            const asleep = def.boss && !enemy.awake;
            this.posed(sx + sw / 2, sy + sh, 0, asleep ? 0 : stretch, asleep ? 0.55 : 1, () => {
                ctx.drawImage(sprite, sx, sy, sw, sh);
                if (def.weapon) this.drawHeld(def.weapon, sx, sy, sprite.width, right, scale, this.foeWeaponAngle(enemy));
            });

            // Замороженный враг покрыт инеем.
            if (enemy.frozen > 0) {
                ctx.globalAlpha = 0.5;
                ctx.drawImage(this.foes[enemy.type][frame][right ? 'rightWhite' : 'leftWhite'], sx, sy, sw, sh);
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#8fd8ff';
                ctx.fillRect(sx + 1, sy + sh - 2, sw - 2, 2);
            }

            // Полоска здоровья над раненым врагом. У босса она в HUD.
            if (!def.boss && enemy.hp < enemy.maxHp) {
                const { x, y } = at;
                ctx.fillStyle = '#1a1423';
                ctx.fillRect(x - 1, y - 5, enemy.w + 2, 3);
                ctx.fillStyle = '#e2572b';
                ctx.fillRect(x, y - 4, Math.ceil((enemy.w * enemy.hp) / enemy.maxHp), 1);
            }
        }
    }

    // Снаряды героя и врагов. Огненные, ледяные и молнии светятся.
    drawShots(shots) {
        for (const shot of shots) {
            const set = shot.dir === 1 ? this.sprites : this.flipped;
            const glow = SHOT_GLOW[shot.sprite];
            const { x, y } = this.pos(shot);
            if (glow) this.glow(x + shot.w / 2, y + shot.h / 2, 14, glow, 0.5);
            this.ctx.drawImage(set[shot.sprite], x, y);
        }
    }

    // Оружие в руке фигуры. sx, sy — левый верхний угол спрайта фигуры.
    // Оружие поворачивается вокруг кисти: angle < 0 — занесено назад, angle > 0 — опущено вперёд;
    // push — выдвинуто вперёд (выпад копьём).
    drawHeld(name, sx, sy, figureWidth, right, scale = 1, angle = 0, push = 0) {
        const { ctx } = this;
        const weapon = this.sprites[name];
        const hold = HOLD[name];
        ctx.save();
        ctx.translate(sx + (right ? HAND.x : figureWidth - HAND.x) * scale, sy + HAND.y * scale);
        ctx.scale(right ? 1 : -1, 1);   // для взгляда влево оружие отражается
        ctx.translate(push, 0);
        ctx.rotate(angle);
        ctx.drawImage(
            weapon, (hold.x - HAND.x) * scale, (hold.y - HAND.y) * scale,
            weapon.width * scale, weapon.height * scale
        );
        ctx.restore();
    }

    // Фигура героя с оружием. bob = 1 — «вдох»: верх тела на пиксель ниже.
    drawFigure(sprite, sx, sy, right, weaponName, scale = 1, bob = 0, angle = 0, push = 0) {
        const { ctx } = this;
        if (bob) {
            ctx.drawImage(sprite, 0, 0, 16, 18, sx, sy + 1, 16, 18);
            ctx.drawImage(sprite, 0, 18, 16, 6, sx, sy + 18, 16, 6);
        } else {
            ctx.drawImage(sprite, sx, sy);
        }
        if (weaponName) this.drawHeld(weaponName, sx, sy + bob, sprite.width, right, scale, angle, push);
    }

    drawEffects(effects) {
        const { ctx } = this;
        for (const effect of effects) {
            const progress = 1 - effect.ttl / effect.life;
            ctx.globalAlpha = Math.max(0, 1 - progress);
            if (effect.kind === 'blast') {
                // Удар по площади: расходящееся кольцо цвета стихии.
                // Круговой удар секиры — две дуги вместо полного кольца.
                const color = BLAST_COLOR[effect.style] ?? '#c08bff';
                const radius = effect.radius * (0.3 + 0.7 * progress);
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                if (effect.style === 'whirl') {
                    const turn = progress * Math.PI * 2;
                    ctx.arc(effect.x, effect.y, effect.radius, turn, turn + 2.2);
                    ctx.moveTo(effect.x - Math.cos(turn) * effect.radius, effect.y - Math.sin(turn) * effect.radius);
                    ctx.arc(effect.x, effect.y, effect.radius, turn + Math.PI, turn + Math.PI + 2.2);
                } else {
                    ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
                }
                ctx.stroke();
                this.glow(effect.x, effect.y, effect.radius, color, 0.35 * (1 - progress));
            } else if (effect.kind === 'lightning') {
                // Молния: ломаная линия между точками, изломы постоянны для каждой пары.
                ctx.strokeStyle = '#ffe27a';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(effect.x, effect.y);
                for (let i = 1; i <= 4; i++) {
                    const t = i / 4;
                    const jitter = i < 4 ? (hash(effect.x2 + i * 3.3) - 0.5) * 12 : 0;
                    ctx.lineTo(
                        effect.x + (effect.x2 - effect.x) * t + jitter,
                        effect.y + (effect.y2 - effect.y) * t + jitter
                    );
                }
                ctx.stroke();
                this.glow(effect.x2, effect.y2, 18, '#ffe27a', 0.6 * (1 - progress));
            } else if (effect.kind === 'strike') {
                // След удара скелета.
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(effect.x, effect.y + effect.h / 2 - 2, effect.w, 4);
            } else if (effect.kind === 'corpse') {
                // Поверженный враг: отлетает, заваливается и тает. Страж ещё и вспыхивает.
                const def = ENEMIES[effect.type];
                const scale = def.scale ?? 1;
                const frame = def.idle ?? def.frames[0];
                const flash = effect.boss && Math.floor(effect.ttl * 14) % 2 === 0;
                const side = (effect.facing === 1 ? 'right' : 'left') + (flash ? 'White' : '');
                const sprite = this.foes[effect.type][frame][side];
                const sw = sprite.width * scale;
                const sh = sprite.height * scale;
                const sx = effect.x + effect.w / 2 - sw / 2;
                const sy = effect.y + effect.h - sh;
                const lean = effect.boss ? 0 : -effect.facing * progress * 1.5;
                this.posed(sx + sw / 2, sy + sh, lean, effect.boss ? -progress * 0.3 : 0, 1 - progress, () => {
                    ctx.drawImage(sprite, sx, sy, sw, sh);
                });
            } else if (effect.kind === 'particle') {
                ctx.fillStyle = effect.color;
                ctx.fillRect(Math.round(effect.x), Math.round(effect.y), 2, 2);
            } else if (effect.kind === 'number') {
                // Число урона всплывает вверх; критический удар — жёлтым с восклицанием.
                const text = effect.crit ? `${effect.text}!` : effect.text;
                const y = Math.round(effect.y - 5 - progress * 12);
                this.drawText(text, Math.round(effect.x), y, effect.crit ? '#ffd75e' : '#ffffff', 'center');
            }
        }
        ctx.globalAlpha = 1;
    }

    // Надпись мелким пиксельным шрифтом (цифры и несколько знаков) с тёмной тенью.
    drawText(text, x, y, color, align = 'left') {
        const { ctx } = this;
        const chars = String(text);
        const width = chars.length * 4 - 1;
        let left = x;
        if (align === 'center') left = x - Math.floor(width / 2);
        else if (align === 'right') left = x - width;
        for (const [dx, dy, fill] of [[1, 1, '#1a1423'], [0, 0, color]]) {
            ctx.fillStyle = fill;
            for (let i = 0; i < chars.length; i++) {
                const glyph = GLYPHS[chars[i]];
                if (!glyph) continue;
                for (let row = 0; row < glyph.length; row++) {
                    for (let col = 0; col < 3; col++) {
                        if (glyph[row][col] === '#') ctx.fillRect(left + i * 4 + col + dx, y + row + dy, 1, 1);
                    }
                }
            }
        }
    }

    // След рывка: полупрозрачные копии героя на прошлых местах.
    drawTrail(game) {
        const { ctx } = this;
        const frames = this.heroes[game.player.classDef.id].run1;
        for (const ghost of game.trail) {
            ctx.globalAlpha = (ghost.ttl / 0.18) * 0.45;
            const sprite = ghost.facing === 1 ? frames.rightWhite : frames.leftWhite;
            ctx.drawImage(
                sprite,
                Math.round(ghost.x + game.player.w / 2 - sprite.width / 2),
                Math.round(ghost.y + game.player.h - sprite.height)
            );
        }
        ctx.globalAlpha = 1;
    }

    drawPlayer(player, game) {
        // Гибель: герой заваливается назад и тает. Мигание при неуязвимости — только у живого
        // (и не во время рывка — он должен быть виден).
        const dying = player.dead ? 1 - Math.max(0, game.dying) / DEATH_TIME : 0;
        const blinking = !player.dead && player.invuln > 0 && player.dashTime <= 0;
        if (blinking && Math.floor(player.invuln * 20) % 2 === 0) return;

        const { weapon } = player;
        const attacking = !player.dead && player.attackTime > 0;
        let frame = 'idle';
        if (player.dead) frame = 'fall';
        else if (attacking) frame = 'attack';
        else if (player.state === 'jump') frame = player.vy < 0 ? 'jump' : 'fall';
        else if (player.state === 'dash') frame = 'run1';
        else if (player.state === 'run') frame = RUN_CYCLE[Math.floor(player.animTime * 10) % RUN_CYCLE.length];

        const right = player.facing === 1;
        const dir = right ? 1 : -1;
        const at = this.pos(player);
        if (player.onGround && !player.dead) this.drawShadow(at.x, at.y, player);
        const white = player.hurtTime > 0.15;   // короткая белая вспышка в момент ранения
        const sprite = this.heroes[player.classDef.id][frame][(right ? 'right' : 'left') + (white ? 'White' : '')];
        // Спрайт шире и выше хитбокса: стоит на его нижнем крае, по центру.
        const sx = this.snap(at.x + player.w / 2 - sprite.width / 2);
        const sy = this.snap(at.y + player.h - sprite.height);

        // Взмах: оружие проходит дугу от занесённого положения до опущенного.
        // Выпад копьём: древко ложится горизонтально и выдвигается вперёд.
        const { attack } = weapon;
        const progress = attacking ? 1 - player.attackTime / (attack.duration ?? 0.15) : 0;
        let angle = 0;
        let push = 0;
        if (attacking && attack.type === 'melee') {
            if (attack.swing === 'thrust') {
                angle = Math.PI / 2;
                push = 2 + progress * 7;
            } else {
                angle = -1.9 + progress * 3.1;
            }
        } else if (attacking) {
            angle = 0.35;   // выстрел: оружие чуть подаётся вперёд
        }

        // Поза: наклон назад при ранении, падение при гибели, растяжение при прыжке.
        let lean = 0;
        if (player.dead) lean = -dir * 1.5 * Math.min(1, dying * 1.6);
        else if (player.hurtTime > 0) lean = -dir * 0.22;
        const breathing = frame === 'idle' && Math.floor(player.animTime * 2) % 2 === 1;
        this.posed(sx + sprite.width / 2, sy + sprite.height, lean, player.squash, 1 - dying * 0.85, () => {
            this.drawFigure(sprite, sx, sy, right, weapon.sprite, 1, breathing ? 1 : 0, angle, push);
            // След взмаха или выпада поверх оружия.
            if (attacking && attack.type === 'melee') {
                const trace = right ? this.sprites[attack.swing] : this.flipped[attack.swing];
                const offset = SWING[attack.swing];
                const x = right ? offset.x : sprite.width - offset.x - trace.width;
                this.ctx.globalAlpha = 0.35 + 0.65 * progress;
                this.ctx.drawImage(trace, sx + x, sy + offset.y);
            }
        });
    }
}
