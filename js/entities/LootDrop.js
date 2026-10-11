import { moveAndCollide } from '../Collision.js';
import { GRAVITY, MAX_FALL } from '../data/constants.js';

const PICKUP_DELAY = 0.35;  // добычу нельзя подобрать, пока она вылетает из врага

// Добыча, выпавшая из врага: подпрыгивает, падает и ждёт героя.
// Бывает двух видов: золото ({ value }) и предмет ({ item }).
export class LootDrop {
    // x, y — центр точки, откуда выпадает; dir — в какую сторону отлетает.
    constructor(x, y, dir, { value = 0, item = null }) {
        this.kind = item ? 'item' : 'gold';
        this.value = value;
        this.item = item;
        this.w = 8;
        this.h = 8;
        this.x = x - this.w / 2;
        this.y = y - this.h / 2;
        this.vx = dir * 40;
        this.vy = -160;
        this.delay = PICKUP_DELAY;
        this.dead = false;
    }

    get ready() {
        return this.delay <= 0;
    }

    update(dt, level) {
        this.delay = Math.max(0, this.delay - dt);
        this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
        if (moveAndCollide(this, level, dt).onGround) this.vx = 0;
        if (this.y > level.height) this.dead = true;
    }
}
