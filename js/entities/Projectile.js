import { touchesTile } from '../Collision.js';
import { SOLID } from '../Level.js';
import { PROJECTILES } from '../data/classes.js';

let nextProjectileId = 1;

// Стрела или магический шар. x, y при создании — центр снаряда.
export class Projectile {
    // target — точка {x, y}, в которую летит прицельный снаряд.
    constructor(kind, x, y, dir, damage, target = null) {
        const def = PROJECTILES[kind];
        this.kind = kind;
        this.sprite = def.sprite;
        this.w = def.w;
        this.h = def.h;
        this.x = x - def.w / 2;
        this.y = y - def.h / 2;
        this.dir = dir;
        this.vx = dir * def.speed;
        this.vy = -def.lift;
        if (def.aimed && target) {
            // Скорость направлена в цель и по величине равна speed.
            const dx = target.x - x;
            const dy = target.y - y;
            const length = Math.hypot(dx, dy) || 1;
            this.vx = (dx / length) * def.speed;
            this.vy = (dy / length) * def.speed;
            this.dir = dx < 0 ? -1 : 1;
        }
        this.gravity = def.gravity;
        this.pierce = def.pierce;
        this.life = def.life;
        this.damage = damage;
        // Номер попадания: пробивающая стрела ранит каждого врага один раз.
        this.id = `p${nextProjectileId++}`;
        this.dead = false;
    }

    update(dt, level) {
        this.vy += this.gravity * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        if (this.life <= 0 || this.y > level.height || touchesTile(this, level, SOLID)) {
            this.dead = true;
        }
    }
}
