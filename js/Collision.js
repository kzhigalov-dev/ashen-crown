import { TILE } from './data/constants.js';
import { SOLID, ONEWAY } from './Level.js';

export function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Номера крайних тайлов, которые занимает отрезок [start, start + size).
// Правая и нижняя границы не включаются: тело шириной 16 в x=0 занимает один тайл.
function tileRange(start, size) {
    return [Math.floor(start / TILE), Math.ceil((start + size) / TILE) - 1];
}

// Двигает тело и выталкивает его из сплошных тайлов. Оси обрабатываются
// раздельно: сначала X, потом Y — так тело не цепляется за углы.
// Скорости ограничены так, что за шаг тело проходит меньше одного тайла.
export function moveAndCollide(body, level, dt) {
    const result = { onGround: false, hitWall: false, hitCeiling: false };

    body.x += body.vx * dt;
    if (body.vx !== 0) {
        const [top, bottom] = tileRange(body.y, body.h);
        const col = body.vx > 0 ? tileRange(body.x, body.w)[1] : Math.floor(body.x / TILE);
        for (let row = top; row <= bottom; row++) {
            if (level.tileAt(col, row) !== SOLID) continue;
            body.x = body.vx > 0 ? col * TILE - body.w : (col + 1) * TILE;
            body.vx = 0;
            result.hitWall = true;
            break;
        }
    }

    const prevBottom = body.y + body.h;
    body.y += body.vy * dt;
    const [left, right] = tileRange(body.x, body.w);
    if (body.vy > 0) {
        const row = tileRange(body.y, body.h)[1];
        const tileTop = row * TILE;
        for (let col = left; col <= right; col++) {
            const tile = level.tileAt(col, row);
            // Платформа держит, только если тело было выше её верха до шага.
            const lands = tile === SOLID || (tile === ONEWAY && prevBottom <= tileTop);
            if (!lands) continue;
            body.y = tileTop - body.h;
            body.vy = 0;
            result.onGround = true;
            break;
        }
    } else if (body.vy < 0) {
        const row = Math.floor(body.y / TILE);
        for (let col = left; col <= right; col++) {
            if (level.tileAt(col, row) !== SOLID) continue;
            body.y = (row + 1) * TILE;
            body.vy = 0;
            result.hitCeiling = true;
            break;
        }
    }

    return result;
}

export function touchesTile(body, level, type) {
    const [left, right] = tileRange(body.x, body.w);
    const [top, bottom] = tileRange(body.y, body.h);
    for (let row = top; row <= bottom; row++) {
        for (let col = left; col <= right; col++) {
            if (level.tileAt(col, row) === type) return true;
        }
    }
    return false;
}
