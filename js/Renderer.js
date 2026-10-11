import { TILE, VIEW_W, VIEW_H } from './data/constants.js';
import { SOLID } from './Level.js';
import { PALETTE, SPRITES } from './data/sprites.js';
import { drawHud } from './ui/Hud.js';

const SKY = '#141b2b';
const FAR_TREES = '#1a2c33';
const NEAR_TREES = '#21403a';
const TREE_HEIGHTS = [38, 62, 46, 80, 54, 70, 42, 66];
const TREE_GAP = 44;

// Рисует спрайт из строк палитры во внеэкранный canvas (один раз при запуске).
function buildSprite(rows, flip) {
    const canvas = document.createElement('canvas');
    canvas.width = rows[0].length;
    canvas.height = rows.length;
    const ctx = canvas.getContext('2d');
    rows.forEach((line, y) => {
        for (let x = 0; x < line.length; x++) {
            const color = PALETTE[line[x]];
            if (!color) continue;
            ctx.fillStyle = color;
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

        this.sprites = {};
        this.flipped = {};
        for (const [name, rows] of Object.entries(SPRITES)) {
            this.sprites[name] = buildSprite(rows, false);
            this.flipped[name] = buildSprite(rows, true);
        }
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
        this.drawPlayer(game.player);
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
    }

    drawPlayer(player) {
        // Мигание во время неуязвимости.
        if (player.invuln > 0 && Math.floor(player.invuln * 20) % 2 === 0) return;

        let name = 'heroIdle';
        if (player.state === 'jump') name = 'heroJump';
        else if (player.state === 'run') name = Math.floor(player.animTime * 10) % 2 ? 'heroRun1' : 'heroRun2';

        const right = player.facing === 1;
        const sprite = right ? this.sprites[name] : this.flipped[name];
        // Спрайт шире хитбокса: лишние пиксели (рука) торчат в сторону взгляда.
        const x = right ? player.x : player.x - (sprite.width - player.w);
        this.ctx.drawImage(sprite, Math.round(x), Math.round(player.y));
    }
}
