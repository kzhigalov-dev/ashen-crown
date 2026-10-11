const INK = '#1a1423';

function bar(ctx, x, y, width, height, fraction, back, fill) {
    ctx.fillStyle = INK;
    ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
    ctx.fillStyle = back;
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, Math.round(width * Math.max(0, Math.min(1, fraction))), height);
}

// Здоровье, мана, готовность способности и золото поверх игрового поля.
export function drawHud(ctx, game, sprites) {
    const { player } = game;

    bar(ctx, 7, 7, 64, 6, player.hp / player.maxHp, '#5a1f1f', '#d9442b');
    if (player.maxMana > 0) {
        bar(ctx, 7, 16, 64, 3, player.mana / player.maxMana, '#1f2a5a', '#5a8cff');
    }

    // Квадрат способности: заполняется снизу вверх, пока идёт перезарядка.
    const ability = player.classDef.ability;
    const ready = 1 - player.abilityCooldown / ability.cooldown;
    ctx.fillStyle = INK;
    ctx.fillRect(76, 6, 10, 10);
    ctx.fillStyle = '#3a3046';
    ctx.fillRect(77, 7, 8, 8);
    const fill = Math.round(8 * ready);
    ctx.fillStyle = ready >= 1 ? '#ffe27a' : '#8a7a5a';
    ctx.fillRect(77, 7 + 8 - fill, 8, fill);

    ctx.font = '8px monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = INK;
    ctx.fillText('K', 79, 7);

    ctx.drawImage(sprites.coin, 92, 7);
    ctx.fillStyle = INK;
    ctx.fillText(String(game.gold), 104, 8);
    ctx.fillStyle = '#ffe27a';
    ctx.fillText(String(game.gold), 103, 7);

    // Название подобранного предмета — по центру вверху, цветом редкости.
    if (game.notice) {
        ctx.textAlign = 'center';
        ctx.fillStyle = INK;
        ctx.fillText(game.notice.text, 241, 25);
        ctx.fillStyle = game.notice.color;
        ctx.fillText(game.notice.text, 240, 24);
        ctx.textAlign = 'left';
    }
}
