import { touchesTile } from '../Collision.js';
import { SOLID } from '../Level.js';
import { PROJECTILES } from '../data/classes.js';

let nextProjectileId = 1;

// Стрела или магический шар. x, y при создании — центр снаряда.
export class Projectile {
    constructor(kind, x, y, dir, damage) {
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
