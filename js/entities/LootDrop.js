import { moveAndCollide } from '../Collision.js';
import { GRAVITY, MAX_FALL } from '../data/constants.js';

const PICKUP_DELAY = 0.35;  // добычу нельзя подобрать, пока она вылетает из врага

// Добыча, выпавшая из врага: подпрыгивает, падает и ждёт героя.
// Бывает трёх видов: золото ({ value }), предмет ({ item }) и сердце ({ heal }).
export class LootDrop {
    // x, y — центр точки, откуда выпадает; dir — в какую сторону отлетает.
    constructor(x, y, dir, { value = 0, item = null, heal = 0 }) {
        this.kind = 'gold';
        if (item) this.kind = 'item';
        else if (heal > 0) this.kind = 'heart';
        this.value = value;
        this.item = item;
        this.heal = heal;
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
