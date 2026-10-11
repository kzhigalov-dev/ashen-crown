import { Entity } from './Entity.js';
import { moveAndCollide } from '../Collision.js';
import { SOLID, ONEWAY, HAZARD } from '../Level.js';
import { ENEMIES } from '../data/enemies.js';
import { TILE, GRAVITY, MAX_FALL } from '../data/constants.js';

const STUN_TIME = 0.2;      // сколько враг оглушён после попадания
const KNOCKBACK = 70;       // скорость отбрасывания, px/с
const FLASH_TIME = 0.12;    // сколько враг мигает белым
const SIGHT_HEIGHT = 28;    // разница высот, при которой враг ещё видит героя

export class Enemy extends Entity {
    // x, y — левый верхний угол тайла, в котором враг появляется.
    constructor(type, x, y) {
        const def = ENEMIES[type];
        super(x + (TILE - def.w) / 2, y + TILE - def.h, def.w, def.h);
        this.type = type;
        this.def = def;
        this.maxHp = def.maxHp;
        this.hp = def.maxHp;
        this.damage = def.damage;
        this.facing = -1;
        this.chasing = false;
        this.stun = 0;
        this.knockDir = 0;
        this.flash = 0;
        this.lastHitId = null;
        this.animTime = 0;
    }

    update(dt, level, player) {
        this.animTime += dt;
        this.flash = Math.max(0, this.flash - dt);

        let dir;
        let speed;
        if (this.stun > 0) {
            this.stun -= dt;
            dir = this.knockDir;
            speed = KNOCKBACK;
            this.chasing = false;
        } else {
            this.chasing = this.def.behavior === 'charger' && this.sees(player);
            if (this.chasing) this.facing = this.centerX(player) < this.centerX(this) ? -1 : 1;
            dir = this.facing;
            speed = this.chasing ? this.def.chaseSpeed : this.def.speed;
        }

        // Враги не падают с платформ: у края патрульный разворачивается,
        // а преследующий и отброшенный останавливаются.
        if (this.onGround && dir !== 0 && !this.canStep(level, dir)) {
            if (this.stun > 0 || this.chasing) {
                speed = 0;
            } else {
                this.facing = -this.facing;
                dir = this.facing;
                if (!this.canStep(level, dir)) speed = 0;
            }
        }

        this.vx = dir * speed;
        this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
        const hit = moveAndCollide(this, level, dt);
        this.onGround = hit.onGround;
        if (hit.hitWall && this.stun <= 0 && !this.chasing) this.facing = -this.facing;
    }

    // Есть ли опора на шаг вперёд и нет ли там шипов.
    canStep(level, dir) {
        const frontX = dir > 0 ? this.x + this.w + 1 : this.x - 1;
        const col = Math.floor(frontX / TILE);
        const footRow = Math.floor((this.y + this.h + 1) / TILE);
        const floor = level.tileAt(col, footRow);
        if (floor !== SOLID && floor !== ONEWAY) return false;
        return level.tileAt(col, footRow - 1) !== HAZARD;
    }

    sees(player) {
        if (player.dead) return false;
        const dx = Math.abs(this.centerX(player) - this.centerX(this));
        const dy = Math.abs(player.y + player.h - (this.y + this.h));
        return dx < this.def.sight && dy < SIGHT_HEIGHT;
    }

    centerX(body) {
        return body.x + body.w / 2;
    }

    // Попадание. id — номер удара: тот же удар дважды не ранит.
    // dir — куда отбросить (1 или -1). Возвращает true, если урон прошёл.
    hit(damage, id, dir) {
        if (this.dead || id === this.lastHitId) return false;
        this.lastHitId = id;
        this.takeDamage(damage);
        this.stun = STUN_TIME;
        this.knockDir = dir;
        this.flash = FLASH_TIME;
        return true;
    }
}
