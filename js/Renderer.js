import { TILE, VIEW_W, VIEW_H } from './data/constants.js';
import { SOLID } from './Level.js';
import { PALETTE, SPRITES } from './data/sprites.js';
import { CLASSES } from './data/classes.js';
import { drawHud } from './ui/Hud.js';

const SKY = '#141b2b';
const FAR_TREES = '#1a2c33';
const NEAR_TREES = '#21403a';
const TREE_HEIGHTS = [38, 62, 46, 80, 54, 70, 42, 66];
const TREE_GAP = 44;
const HERO_FRAMES = ['heroIdle', 'heroRun1', 'heroRun2', 'heroJump'];

// Где герой держит оружие: смещение от левого верхнего угла хитбокса
// (для героя, смотрящего вправо).
const WEAPON_OFFSET = {
    sword: { x: 8, y: 1 },
    bow: { x: 8, y: 4 },
    staff: { x: 9, y: -1 },
};
const SLASH_OFFSET = { x: 10, y: -3 };

// Рисует спрайт из строк палитры во внеэкранный canvas (один раз при запуске).
//   flip    — зеркально по горизонтали;
//   recolor — замена части цветов палитры (цвета класса героя);
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

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        canvas.width = VIEW_W;
        canvas.height = VIEW_H;
        this.ctx = canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;

        // Каждый спрайт в четырёх видах: обычный, зеркальный и два белых.
        this.sprites = {};
        this.flipped = {};
        this.white = {};
        this.whiteFlipped = {};
        for (const [name, rows] of Object.entries(SPRITES)) {
            this.sprites[name] = buildSprite(rows);
            this.flipped[name] = buildSprite(rows, { flip: true });
            this.white[name] = buildSprite(rows, { tint: '#ffffff' });
            this.whiteFlipped[name] = buildSprite(rows, { flip: true, tint: '#ffffff' });
        }

        // Герой каждого класса — та же фигура в цветах класса.
        this.heroes = {};
        for (const [id, def] of Object.entries(CLASSES)) {
            this.heroes[id] = { right: {}, left: {} };
            for (const frame of HERO_FRAMES) {
                this.heroes[id].right[frame] = buildSprite(SPRITES[frame], { recolor: def.palette });
                this.heroes[id].left[frame] = buildSprite(SPRITES[frame], { recolor: def.palette, flip: true });
            }
        }
    }

    // Портрет героя для экрана выбора класса.
    portrait(classId) {
        return this.heroes[classId].right.heroIdle;
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

    draw(game) {
        const { ctx } = this;
        const camX = Math.round(game.camera.x);
        const camY = Math.round(game.camera.y);

        ctx.fillStyle = SKY;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        // Дальний слой движется медленнее ближнего — это и есть параллакс.
        this.drawTrees(camX * 0.2, FAR_TREES, 0.6);
        this.drawTrees(camX * 0.5, NEAR_TREES, 1);

        ctx.save();
        ctx.translate(-camX, -camY);
        this.drawTiles(game.level, camX);
        this.drawObjects(game);
        this.drawEnemies(game.enemies);
        this.drawPlayer(game.player);
        this.drawProjectiles(game.projectiles);
        this.drawEffects(game.effects);
        ctx.restore();

        drawHud(ctx, game, this.sprites);
    }

    drawTrees(offset, color, k) {
        const { ctx } = this;
        const base = VIEW_H - 30;
        ctx.fillStyle = color;
        ctx.fillRect(0, base, VIEW_W, 30);
        const first = Math.floor(offset / TREE_GAP);
        for (let i = first - 1; i <= first + VIEW_W / TREE_GAP + 1; i++) {
            const index = ((i % TREE_HEIGHTS.length) + TREE_HEIGHTS.length) % TREE_HEIGHTS.length;
            const height = Math.round(TREE_HEIGHTS[index] * k);
            const x = Math.round(i * TREE_GAP - offset);
            const trunk = Math.round(height * 0.4);
            const tier = Math.round(height * 0.15);
            ctx.fillRect(x + 9, base - trunk, 4, trunk);
            for (let t = 0; t < 4; t++) {
                const width = 22 - t * 5;
                ctx.fillRect(x + 11 - Math.round(width / 2), base - trunk - (t + 1) * tier, width, tier + 1);
            }
        }
    }

    drawTiles(level, camX) {
        const { ctx, sprites } = this;
        const first = Math.max(0, Math.floor(camX / TILE));
        const last = Math.min(level.cols - 1, Math.floor((camX + VIEW_W) / TILE));
        for (let row = 0; row < level.rows; row++) {
            for (let col = first; col <= last; col++) {
                const char = level.charAt(col, row);
                const x = col * TILE;
                const y = row * TILE;
                if (char === '#') {
                    const covered = level.tileAt(col, row - 1) === SOLID;
                    ctx.drawImage(covered ? sprites.ground : sprites.groundTop, x, y);
                } else if (char === '=') {
                    ctx.drawImage(sprites.platform, x, y);
                } else if (char === '^') {
                    ctx.drawImage(sprites.spikes, x, y + TILE - sprites.spikes.height);
                }
            }
        }
    }

    drawObjects(game) {
        const { ctx, sprites } = this;
        for (const checkpoint of game.level.checkpoints) {
            const lit = checkpoint === game.checkpoint;
            const sprite = lit ? sprites.campfire : sprites.campfireOff;
            ctx.drawImage(sprite, checkpoint.x + 3, checkpoint.y + TILE - sprite.height);
        }
        ctx.drawImage(sprites.portal, game.level.exit.x + 2, game.level.exit.y);
        for (const coin of game.coins) {
            if (coin.taken) continue;
            const bob = Math.round(Math.sin(game.time * 4 + coin.x) * 1.5);
            ctx.drawImage(sprites.coin, coin.x + 4, coin.y + 4 + bob);
        }
        for (const drop of game.drops) {
            ctx.drawImage(sprites.coin, Math.round(drop.x), Math.round(drop.y));
        }
    }

    drawEnemies(enemies) {
        const { ctx } = this;
        for (const enemy of enemies) {
            const name = `${enemy.def.sprite}${(Math.floor(enemy.animTime * 6) % 2) + 1}`;
            const right = enemy.facing === 1;
            // Вспышка белым при попадании.
            let set = right ? this.sprites : this.flipped;
            if (enemy.flash > 0) set = right ? this.white : this.whiteFlipped;
            const x = Math.round(enemy.x);
            const y = Math.round(enemy.y);
            ctx.drawImage(set[name], x, y);

            if (enemy.hp < enemy.maxHp) {
                ctx.fillStyle = '#1a1423';
                ctx.fillRect(x, y - 4, enemy.w, 2);
                ctx.fillStyle = '#d9442b';
                ctx.fillRect(x, y - 4, Math.ceil((enemy.w * enemy.hp) / enemy.maxHp), 2);
            }
        }
    }

    drawProjectiles(projectiles) {
        for (const projectile of projectiles) {
            const set = projectile.dir === 1 ? this.sprites : this.flipped;
            this.ctx.drawImage(set[projectile.sprite], Math.round(projectile.x), Math.round(projectile.y));
        }
    }

    drawEffects(effects) {
        const { ctx } = this;
        for (const effect of effects) {
            if (effect.kind !== 'blast') continue;
            // Расходящееся кольцо взрыва.
            const progress = 1 - effect.ttl / effect.life;
            ctx.save();
            ctx.globalAlpha = Math.max(0, 1 - progress);
            ctx.strokeStyle = '#c08bff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, effect.radius * (0.3 + 0.7 * progress), 0, Math.PI * 2);
            ctx.stroke();
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
        const hero = this.heroes[player.classDef.id][right ? 'right' : 'left'][frame];
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
