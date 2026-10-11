// Полоска здоровья и счётчик золота поверх игрового поля.
export function drawHud(ctx, game, sprites) {
    const { player } = game;

    ctx.fillStyle = '#1a1423';
    ctx.fillRect(6, 6, 66, 8);
    ctx.fillStyle = '#5a1f1f';
    ctx.fillRect(7, 7, 64, 6);
    ctx.fillStyle = '#d9442b';
    ctx.fillRect(7, 7, Math.round((64 * player.hp) / player.maxHp), 6);

    ctx.drawImage(sprites.coin, 78, 6);
    ctx.font = '8px monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#1a1423';
    ctx.fillText(String(game.gold), 90, 7);
    ctx.fillStyle = '#ffe27a';
    ctx.fillText(String(game.gold), 89, 6);
}
