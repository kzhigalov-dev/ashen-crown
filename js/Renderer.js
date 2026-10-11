import { TILE, VIEW_W, VIEW_H } from './data/constants.js';
import { SOLID } from './Level.js';
import { PALETTE, SPRITES } from './data/sprites.js';
import { CLASSES } from './data/classes.js';
import { ENEMIES } from './data/enemies.js';
import { rarityOf } from './systems/Loot.js';
import { drawHud } from './ui/Hud.js';

const SILHOUETTES = [38, 62, 46, 80, 54, 70, 42, 66];
const SILHOUETTE_GAP = 44;
const HERO_FRAMES = ['heroIdle', 'heroRun1', 'heroRun2', 'heroJump'];
const TILE_SPRITES = ['groundTop', 'ground', 'platform'];

// Где фигура держит оружие: смещение от левого края спрайта
// (для фигуры, смотрящей вправо).
const WEAPON_OFFSET = {
    sword: { x: 8, y: 1 },
    bow: { x: 8, y: 4 },
    staff: { x: 9, y: -1 },
};
const SLASH_OFFSET = { x: 10, y: -3 };

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

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
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
    }

    // Портрет героя для экрана выбора класса.
    portrait(classId) {
        return this.heroes[classId].heroIdle.right;
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
                set[name] = buildSprite(SPRITES[name], { recolor: levelDef.theme?.tiles });
            }
            this.tileSets[levelDef.id] = set;
        }
        return this.tileSets[levelDef.id];
    }

    draw(game) {
        const { ctx } = this;
        const camX = Math.round(game.camera.x);
        const camY = Math.round(game.camera.y);
        const theme = game.levelDef.theme ?? { sky: '#141b2b', far: '#1a2c33', near: '#21403a', backdrop: 'trees' };

        ctx.fillStyle = theme.sky;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        // Дальний слой движется медленнее ближнего — это и есть параллакс.
        this.drawBackdrop(camX * 0.2, theme.far, 0.6, theme.backdrop);
        this.drawBackdrop(camX * 0.5, theme.near, 1, theme.backdrop);

        ctx.save();
        ctx.translate(-camX, -camY);
        this.drawTiles(game, camX);
        this.drawObjects(game);
        this.drawHazards(game.hazards, game.time);
        this.drawEnemies(game.enemies);
        this.drawPlayer(game.player);
        this.drawShots(game.projectiles);
        this.drawShots(game.enemyShots);
        this.drawEffects(game.effects);
        ctx.restore();

        drawHud(ctx, game, this.sprites);
    }

    // Силуэты на фоне: ели в лесу, колонны в замке и подземелье.
    drawBackdrop(offset, color, k, kind) {
        const { ctx } = this;
        const base = VIEW_H - 30;
        ctx.fillStyle = color;
        ctx.fillRect(0, base, VIEW_W, 30);
        const first = Math.floor(offset / SILHOUETTE_GAP);
        for (let i = first - 1; i <= first + VIEW_W / SILHOUETTE_GAP + 1; i++) {
            const index = ((i % SILHOUETTES.length) + SILHOUETTES.length) % SILHOUETTES.length;
            const height = Math.round(SILHOUETTES[index] * k);
            const x = Math.round(i * SILHOUETTE_GAP - offset);
            if (kind === 'columns') {
                ctx.fillRect(x + 6, base - height, 10, height);
                ctx.fillRect(x + 3, base - height - 4, 16, 4);
                continue;
            }
            const trunk = Math.round(height * 0.4);
            const tier = Math.round(height * 0.15);
            ctx.fillRect(x + 9, base - trunk, 4, trunk);
            for (let t = 0; t < 4; t++) {
                const width = 22 - t * 5;
                ctx.fillRect(x + 11 - Math.round(width / 2), base - trunk - (t + 1) * tier, width, tier + 1);
            }
        }
    }

    drawTiles(game, camX) {
        const { ctx, sprites } = this;
        const { level } = game;
        const tiles = this.tilesFor(game.levelDef);
        const first = Math.max(0, Math.floor(camX / TILE));
        const last = Math.min(level.cols - 1, Math.floor((camX + VIEW_W) / TILE));
        for (let row = 0; row < level.rows; row++) {
            for (let col = first; col <= last; col++) {
                const char = level.charAt(col, row);
                const x = col * TILE;
                const y = row * TILE;
                if (char === '#') {
                    const covered = level.tileAt(col, row - 1) === SOLID;
                    ctx.drawImage(covered ? tiles.ground : tiles.groundTop, x, y);
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

    // Лава: красная толща и бегущая по поверхности светлая рябь.
    drawLava(x, y, col, time) {
        const { ctx } = this;
        ctx.fillStyle = '#d9442b';
        ctx.fillRect(x, y + 4, TILE, TILE - 4);
        const shift = Math.floor(time * 4);
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = (i + col * 4 + shift) % 3 === 0 ? '#ffd75e' : '#f28a2e';
            ctx.fillRect(x + i * 4, y + 3 + ((i + col + shift) % 2), 4, 2);
        }
    }

    drawObjects(game) {
        const { ctx, sprites } = this;
        for (const checkpoint of game.level.checkpoints) {
            const lit = checkpoint === game.checkpoint;
            const sprite = lit ? sprites.campfire : sprites.campfireOff;
            ctx.drawImage(sprite, checkpoint.x + 3, checkpoint.y + TILE - sprite.height);
        }
        // Пока жив босс, портал закрыт и нарисован тусклым.
        ctx.globalAlpha = game.bossAlive ? 0.3 : 1;
        ctx.drawImage(sprites.portal, game.level.exit.x + 2, game.level.exit.y);
        ctx.globalAlpha = 1;

        for (const coin of game.coins) {
            if (coin.taken) continue;
            const bob = Math.round(Math.sin(game.time * 4 + coin.x) * 1.5);
            ctx.drawImage(sprites.coin, coin.x + 4, coin.y + 4 + bob);
        }
        for (const drop of game.drops) {
            const x = Math.round(drop.x);
            const y = Math.round(drop.y);
            if (drop.kind === 'gold') {
                ctx.drawImage(sprites.coin, x, y);
                continue;
            }
            // Предмет: мешочек в мерцающей рамке цвета редкости.
            ctx.globalAlpha = 0.55 + 0.45 * Math.sin(game.time * 6);
            ctx.fillStyle = rarityOf(drop.item).color;
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
                // Огненный столб: три слоя, которые дрожат.
                const flicker = Math.floor(time * 20) % 2;
                ctx.fillStyle = '#d9442b';
                ctx.fillRect(x, y + flicker * 2, w, h - flicker * 2);
                ctx.fillStyle = '#f28a2e';
                ctx.fillRect(x + 2, y + 4, w - 4, h - 4);
                ctx.fillStyle = '#ffd75e';
                ctx.fillRect(x + 4, y + 10 - flicker * 2, w - 8, h - 10 + flicker * 2);
            }
        }
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
                ctx.fillRect(x, y - 4, enemy.w, 2);
                ctx.fillStyle = '#d9442b';
                ctx.fillRect(x, y - 4, Math.ceil((enemy.w * enemy.hp) / enemy.maxHp), 2);
            }
        }
    }

    // Снаряды героя и врагов.
    drawShots(shots) {
        for (const shot of shots) {
            const set = shot.dir === 1 ? this.sprites : this.flipped;
            this.ctx.drawImage(set[shot.sprite], Math.round(shot.x), Math.round(shot.y));
        }
    }

    drawEffects(effects) {
        const { ctx } = this;
        for (const effect of effects) {
            const progress = 1 - effect.ttl / effect.life;
            ctx.save();
            ctx.globalAlpha = Math.max(0, 1 - progress);
            if (effect.kind === 'blast') {
                // Расходящееся кольцо взрыва.
                ctx.strokeStyle = '#c08bff';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(effect.x, effect.y, effect.radius * (0.3 + 0.7 * progress), 0, Math.PI * 2);
                ctx.stroke();
            } else if (effect.kind === 'strike') {
                // След удара скелета.
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(effect.x, effect.y + effect.h / 2 - 2, effect.w, 4);
            }
            ctx.restore();
        }
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
