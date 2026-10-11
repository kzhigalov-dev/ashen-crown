import { TILE, VIEW_W, VIEW_H, INTRO_TIME, HURT_FLASH } from './data/constants.js';
import { SOLID } from './Level.js';
import { PALETTE, SPRITES, GLYPHS } from './data/sprites.js';
import { CLASSES } from './data/classes.js';
import { ENEMIES } from './data/enemies.js';
import { rarityOf } from './systems/Loot.js';
import { drawHud } from './ui/Hud.js';

const SILHOUETTES = [38, 62, 46, 80, 54, 70, 42, 66];
const SILHOUETTE_GAP = 44;
const HERO_FRAMES = ['heroIdle', 'heroRun1', 'heroRun2', 'heroJump'];
const TILE_SPRITES = ['groundTop', 'ground', 'platform'];
const AIR_PARTICLES = 38;
const FADE_IN = 0.6;   // сколько секунд уровень проявляется из темноты

// Где фигура держит оружие: смещение от левого края спрайта
// (для фигуры, смотрящей вправо).
const WEAPON_OFFSET = {
    sword: { x: 8, y: 1 },
    bow: { x: 8, y: 4 },
    staff: { x: 9, y: -1 },
};
const SLASH_OFFSET = { x: 10, y: -3 };

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

        // Герой каждого класса — та же фигура в цветах класса.
        this.heroes = {};
        for (const [id, def] of Object.entries(CLASSES)) {
            this.heroes[id] = {};
            for (const frame of HERO_FRAMES) this.heroes[id][frame] = buildSet(SPRITES[frame], def.palette);
        }

        // Кадры каждого врага в его цветах.
        this.foes = {};
        for (const [id, def] of Object.entries(ENEMIES)) {
            this.foes[id] = {};
            for (const frame of new Set([...def.frames, def.idle ?? def.frames[0]])) {
                this.foes[id][frame] = buildSet(SPRITES[frame], def.recolor);
            }
        }

        this.tileSets = {};  // тайлы земли в цветах локации, строятся при первом показе
        this.vignette = buildVignette('rgba(5, 4, 8, 0.62)');
        this.danger = buildVignette('rgba(226, 87, 43, 0.9)');
    }

    // Портрет героя для экрана выбора класса.
    portrait(classId) {
        return this.heroes[classId].heroIdle.right;
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
    }

    tilesFor(levelDef) {
        if (!this.tileSets[levelDef.id]) {
            const set = {};
            for (const name of TILE_SPRITES) {
                set[name] = buildSprite(SPRITES[name], { recolor: levelDef.theme.tiles });
            }
            this.tileSets[levelDef.id] = set;
        }
        return this.tileSets[levelDef.id];
    }

    // ---------- Кадр игры ----------

    draw(game) {
        const { ctx } = this;
        const { theme } = game.levelDef;
        const { player, time } = game;
        // Тряска: камера дрожит на несколько пикселей и быстро успокаивается.
        const shakeX = Math.round(Math.sin(time * 93) * game.shake);
        const shakeY = Math.round(Math.cos(time * 71) * game.shake);
        const camX = Math.round(game.camera.x) + shakeX;
        const camY = Math.round(game.camera.y) + shakeY;

        this.drawScene(theme, time, camX);

        ctx.save();
        ctx.translate(-camX, -camY);
        this.drawTiles(game, camX);
        this.drawObjects(game);
        this.drawHazards(game.hazards, time);
        this.drawEnemies(game.enemies);
        this.drawTrail(game);
        if (!player.dead) this.drawPlayer(player);
        this.drawShots(game.projectiles);
        this.drawShots(game.enemyShots);
        this.drawEffects(game.effects);
        ctx.restore();

        this.drawAir(theme, time, camX);
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
    drawTitle(time, levelDef, classId) {
        const { ctx } = this;
        const { theme } = levelDef;
        const tiles = this.tilesFor(levelDef);
        const ground = VIEW_H - 44;

        this.drawScene(theme, time, 0);
        for (let x = 0; x < VIEW_W; x += TILE) {
            ctx.drawImage(tiles.groundTop, x, ground);
            ctx.drawImage(tiles.ground, x, ground + TILE);
            ctx.drawImage(tiles.ground, x, ground + TILE * 2);
            this.drawDecor(theme, x, ground, x / TILE + 3, 0);
        }
        this.drawCampfire(352, ground, time, true);

        const hero = this.heroes[classId].heroIdle.right;
        const weapon = CLASSES[classId].weapon;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(325, ground - 1, 10, 2);
        ctx.drawImage(hero, 324, ground - hero.height);
        ctx.drawImage(
            this.sprites[weapon],
            324 + WEAPON_OFFSET[weapon].x, ground - hero.height + WEAPON_OFFSET[weapon].y
        );

        this.drawAir(theme, time, 0);
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
            const x = Math.round(i * SILHOUETTE_GAP - offset);
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

    // ---------- Мир ----------

    drawTiles(game, camX) {
        const { ctx, sprites } = this;
        const { level } = game;
        const { theme } = game.levelDef;
        const tiles = this.tilesFor(game.levelDef);
        const first = Math.max(0, Math.floor(camX / TILE) - 1);
        const last = Math.min(level.cols - 1, Math.floor((camX + VIEW_W) / TILE) + 1);
        for (let row = 0; row < level.rows; row++) {
            for (let col = first; col <= last; col++) {
                const char = level.charAt(col, row);
                const x = col * TILE;
                const y = row * TILE;
                if (char === '#') {
                    const covered = level.tileAt(col, row - 1) === SOLID;
                    ctx.drawImage(covered ? tiles.ground : tiles.groundTop, x, y);
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
        if (col % 2 === 0) this.glow(x + TILE, y + 4, 34, '#f28a2e', 0.14 + 0.03 * Math.sin(time * 3 + col));
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
            const x = Math.round(drop.x);
            const y = Math.round(drop.y);
            if (drop.kind === 'gold') {
                ctx.drawImage(sprites.coin, x, y);
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

    // Тень под стоящим на земле.
    drawShadow(body) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        this.ctx.fillRect(Math.round(body.x) + 1, Math.round(body.y + body.h) - 1, body.w - 2, 2);
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
            if (enemy.onGround) this.drawShadow(enemy);

            // Белым: вспышка при попадании и мигание во время замаха перед ударом.
            const windup = enemy.phase === 'windup' || enemy.state === 'windup';
            const white = enemy.flash > 0 || (windup && Math.floor(enemy.animTime * 16) % 2 === 0);
            const side = (right ? 'right' : 'left') + (white ? 'White' : '');
            const sprite = this.foes[enemy.type][frame][side];

            // Спрайт стоит на нижнем крае хитбокса, по центру.
            const sw = sprite.width * scale;
            const sh = sprite.height * scale;
            const sx = Math.round(enemy.x + enemy.w / 2 - sw / 2);
            const sy = Math.round(enemy.y + enemy.h - sh);
            ctx.drawImage(sprite, sx, sy, sw, sh);

            if (def.weapon) {
                const weapon = right ? this.sprites[def.weapon] : this.flipped[def.weapon];
                const offset = WEAPON_OFFSET[def.weapon];
                const wx = right ? offset.x : sprite.width - offset.x - weapon.width;
                ctx.drawImage(
                    weapon, sx + wx * scale, sy + offset.y * scale,
                    weapon.width * scale, weapon.height * scale
                );
            }

            // Полоска здоровья над раненым врагом. У босса она в HUD.
            if (!def.boss && enemy.hp < enemy.maxHp) {
                const x = Math.round(enemy.x);
                const y = Math.round(enemy.y);
                ctx.fillStyle = '#1a1423';
                ctx.fillRect(x - 1, y - 5, enemy.w + 2, 3);
                ctx.fillStyle = '#e2572b';
                ctx.fillRect(x, y - 4, Math.ceil((enemy.w * enemy.hp) / enemy.maxHp), 1);
            }
        }
    }

    // Снаряды героя и врагов. Магические и огненные светятся.
    drawShots(shots) {
        for (const shot of shots) {
            const set = shot.dir === 1 ? this.sprites : this.flipped;
            if (shot.sprite === 'bolt') this.glow(shot.x + 3, shot.y + 3, 12, '#7a3fd1', 0.5);
            else if (shot.sprite === 'fireball') this.glow(shot.x + 3, shot.y + 3, 14, '#f28a2e', 0.5);
            this.ctx.drawImage(set[shot.sprite], Math.round(shot.x), Math.round(shot.y));
        }
    }

    drawEffects(effects) {
        const { ctx } = this;
        for (const effect of effects) {
            const progress = 1 - effect.ttl / effect.life;
            ctx.globalAlpha = Math.max(0, 1 - progress);
            if (effect.kind === 'blast') {
                // Расходящееся кольцо взрыва.
                ctx.strokeStyle = '#c08bff';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(effect.x, effect.y, effect.radius * (0.3 + 0.7 * progress), 0, Math.PI * 2);
                ctx.stroke();
                this.glow(effect.x, effect.y, effect.radius, '#7a3fd1', 0.35 * (1 - progress));
            } else if (effect.kind === 'strike') {
                // След удара скелета.
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(effect.x, effect.y + effect.h / 2 - 2, effect.w, 4);
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
        const frames = this.heroes[game.player.classDef.id].heroRun1;
        for (const ghost of game.trail) {
            ctx.globalAlpha = (ghost.ttl / 0.18) * 0.45;
            const sprite = ghost.facing === 1 ? frames.rightWhite : frames.leftWhite;
            const x = ghost.facing === 1 ? ghost.x : ghost.x + game.player.w - sprite.width;
            ctx.drawImage(sprite, Math.round(x), Math.round(ghost.y));
        }
        ctx.globalAlpha = 1;
    }

    drawPlayer(player) {
        // Мигание во время неуязвимости (но не во время рывка — он должен быть виден).
        const blinking = player.invuln > 0 && player.dashTime <= 0;
        if (blinking && Math.floor(player.invuln * 20) % 2 === 0) return;

        let frame = 'heroIdle';
        if (player.state === 'jump') frame = 'heroJump';
        else if (player.state === 'dash') frame = 'heroRun1';
        else if (player.state === 'run') frame = Math.floor(player.animTime * 10) % 2 ? 'heroRun1' : 'heroRun2';

        const right = player.facing === 1;
        if (player.onGround) this.drawShadow(player);
        const hero = this.heroes[player.classDef.id][frame][right ? 'right' : 'left'];
        // Спрайт шире хитбокса: лишние пиксели (рука) торчат в сторону взгляда.
        this.ctx.drawImage(hero, Math.round(this.mirrorX(player, 0, hero.width)), Math.round(player.y));

        const swinging = player.classDef.attack.type === 'melee' && player.attackTime > 0;
        const name = swinging ? 'slash' : player.classDef.weapon;
        const offset = swinging ? SLASH_OFFSET : WEAPON_OFFSET[name];
        const sprite = right ? this.sprites[name] : this.flipped[name];
        this.ctx.drawImage(
            sprite,
            Math.round(this.mirrorX(player, offset.x, sprite.width)),
            Math.round(player.y + offset.y)
        );
    }

    // X для детали героя: смещение задано для взгляда вправо,
    // для взгляда влево оно отражается относительно хитбокса.
    mirrorX(player, offsetX, width) {
        return player.facing === 1 ? player.x + offsetX : player.x + player.w - offsetX - width;
    }
}
