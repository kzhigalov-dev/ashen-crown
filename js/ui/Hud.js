import { INTRO_TIME } from '../data/constants.js';

const INK = '#1a1423';
const FRAME = '#6b5a4a';
const PARCHMENT = '#e6dcc6';
const EMBER = '#e2572b';
const GOLD = '#ffe27a';

// Полоска в рамке: тёмная подложка, заполнение и светлая кромка сверху.
function bar(ctx, x, y, width, height, fraction, back, fill) {
    ctx.fillStyle = INK;
    ctx.fillRect(x - 2, y - 2, width + 4, height + 4);
    ctx.fillStyle = FRAME;
    ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
    ctx.fillStyle = back;
    ctx.fillRect(x, y, width, height);
    const filled = Math.round(width * Math.max(0, Math.min(1, fraction)));
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, filled, height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(x, y, filled, 1);
}

// Часть HUD, нарисованная на игровом поле: портрет, здоровье, мана,
// способность, золото и полоса босса. Надписи словами — в HudOverlay.
export function drawHud(renderer, game) {
    const { ctx, sprites } = renderer;
    const { player, time } = game;

    // Портрет: голова героя в рамке.
    ctx.fillStyle = INK;
    ctx.fillRect(4, 4, 18, 18);
    ctx.fillStyle = FRAME;
    ctx.fillRect(5, 5, 16, 16);
    ctx.fillStyle = '#2a2630';
    ctx.fillRect(6, 6, 14, 14);
    ctx.drawImage(renderer.portrait(player.classDef.id), 0, 0, 11, 9, 8, 9, 11, 9);

    // Здоровье. Когда его мало, полоска мигает.
    const low = player.hp / player.maxHp < 0.3;
    const blink = low && Math.floor(time * 6) % 2 === 0;
    ctx.drawImage(sprites.heart, 26, 6);
    bar(ctx, 37, 7, 72, 5, player.hp / player.maxHp, '#3a1420', blink ? '#ff8a6a' : EMBER);
    renderer.drawText(Math.ceil(player.hp), 113, 7, PARCHMENT);

    if (player.maxMana > 0) {
        bar(ctx, 37, 17, 72, 2, player.mana / player.maxMana, '#1f2a5a', '#5a8cff');
    }

    // Способность: квадрат заполняется снизу вверх, пока идёт перезарядка;
    // готовая — подсвечена золотом.
    const ready = 1 - player.abilityCooldown / player.classDef.ability.cooldown;
    ctx.fillStyle = INK;
    ctx.fillRect(132, 4, 13, 13);
    ctx.fillStyle = ready >= 1 ? GOLD : FRAME;
    ctx.fillRect(133, 5, 11, 11);
    ctx.fillStyle = '#2a2630';
    ctx.fillRect(134, 6, 9, 9);
    const fill = Math.round(9 * ready);
    ctx.fillStyle = ready >= 1 ? '#d8a531' : '#57525c';
    ctx.fillRect(134, 6 + 9 - fill, 9, fill);
    renderer.drawText('K', 137, 8, ready >= 1 ? INK : PARCHMENT);

    // Золото забега.
    ctx.drawImage(sprites.coin, 150, 6);
    renderer.drawText(game.gold, 161, 8, GOLD);

    // Полоса здоровья босса внизу экрана, с отметкой второй фазы посередине.
    const boss = game.enemies.find((enemy) => enemy.def.boss && enemy.awake);
    if (boss) {
        bar(ctx, 120, 256, 240, 4, boss.hp / boss.maxHp, '#2a1018', '#b3312f');
        ctx.fillStyle = INK;
        ctx.fillRect(239, 255, 2, 6);
    }
}

// Надписи поверх игрового поля, сделанные обычным HTML: так текст остаётся
// чётким при любом увеличении. Название локации, объявление о боссе,
// имя босса, записка у костра и всплывающее сообщение.
export class HudOverlay {
    constructor(root) {
        this.root = root.getElementById('hud');
        this.card = root.getElementById('hud-card');
        this.cardName = root.getElementById('hud-card-name');
        this.cardIndex = root.getElementById('hud-card-index');
        this.banner = root.getElementById('hud-banner');
        this.bannerTitle = root.getElementById('hud-banner-title');
        this.bannerText = root.getElementById('hud-banner-text');
        this.toast = root.getElementById('hud-toast');
        this.lore = root.getElementById('hud-lore');
        this.boss = root.getElementById('hud-boss');
        this.shown = new Map();  // что сейчас написано в каждом элементе
    }

    // Меняет текст и видимость элемента, только если они изменились:
    // вызывается каждый кадр и не должна зря трогать страницу.
    set(element, text, extra = '') {
        const key = text === null ? null : `${text}|${extra}`;
        if (this.shown.get(element) === key) return false;
        this.shown.set(element, key);
        element.hidden = text === null;
        return text !== null;
    }

    // game = null — игра не идёт, все надписи скрыты.
    sync(game) {
        const playing = Boolean(game) && (game.state === 'playing' || game.state === 'paused');
        if (this.shown.get(this.root) !== playing) {
            this.shown.set(this.root, playing);
            this.root.hidden = !playing;
        }
        if (!playing) return;

        // Название локации в первые секунды уровня.
        const intro = game.intro > 0 && game.intro < INTRO_TIME - 0.3;
        if (this.set(this.card, intro ? game.levelDef.name : null)) {
            this.cardName.textContent = game.levelDef.name;
            this.cardIndex.textContent = `Локация ${game.levelIndex + 1} из ${game.levels.length}`;
        }

        const { banner, notice, lore } = game;
        if (this.set(this.banner, banner ? banner.title : null, banner?.text)) {
            this.bannerTitle.textContent = banner.title;
            this.bannerText.textContent = banner.text;
        }
        if (this.set(this.toast, notice ? notice.text : null, notice?.color)) {
            this.toast.textContent = notice.text;
            this.toast.style.color = notice.color;
        }
        if (this.set(this.lore, lore ? lore.text : null)) {
            this.lore.textContent = lore.text;
        }

        const boss = game.enemies.find((enemy) => enemy.def.boss && enemy.awake);
        if (this.set(this.boss, boss ? boss.def.name : null)) {
            this.boss.textContent = boss.def.name;
        }
    }
}
