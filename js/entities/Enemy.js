import { Entity } from './Entity.js';
import { moveAndCollide } from '../Collision.js';
import { SOLID, ONEWAY, HAZARD } from '../Level.js';
import { ENEMIES } from '../data/enemies.js';
import { TILE, GRAVITY, MAX_FALL } from '../data/constants.js';

const STUN_TIME = 0.2;      // сколько враг оглушён после попадания
const KNOCKBACK = 70;       // скорость отбрасывания, px/с
const FLASH_TIME = 0.12;    // сколько враг мигает белым
const SIGHT_HEIGHT = 28;    // разница высот, при которой враг ещё видит героя
const STRIKE_TIME = 0.15;   // сколько скелет стоит в позе удара

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
        this.frozen = 0;            // остаток заморозки (для отрисовки инея)
        this.lastHitId = null;
        this.animTime = 0;
        this.phase = 'walk';        // для скелета: walk → windup → strike → recover
        this.timer = def.rate ?? 0; // до следующего выстрела или смены фазы
        this.baseX = this.x;        // точка, вокруг которой летает бес
        this.baseY = this.y;
        this.actions = [];          // удары и выстрелы этого шага — их забирает Game
    }

    update(dt, level, player) {
        this.animTime += dt;
        this.flash = Math.max(0, this.flash - dt);
        this.frozen = Math.max(0, this.frozen - dt);

        if (this.def.behavior === 'flyer') {
            this.fly(dt, player);
            return;
        }
        if (this.stun > 0) {
            // Оглушение сбивает замах и погоню.
            this.stun -= dt;
            this.chasing = false;
            this.phase = 'walk';
            this.walk(dt, level, this.knockDir, KNOCKBACK, false);
            return;
        }

        switch (this.def.behavior) {
            case 'charger':
                this.charge(dt, level, player);
                break;
            case 'striker':
                this.strike(dt, level, player);
                break;
            case 'shooter':
                this.shoot(dt, level, player);
                break;
            default:
                this.walk(dt, level, this.facing, this.def.speed, true);
        }
    }

    // Шаг по земле. turn — разворачиваться у края и стены (патруль) или останавливаться.
    // Враги не падают с платформ.
    walk(dt, level, dir, speed, turn) {
        if (this.onGround && dir !== 0 && !this.canStep(level, dir)) {
            if (turn) {
                this.facing = -this.facing;
                dir = this.facing;
                if (!this.canStep(level, dir)) speed = 0;
            } else {
                speed = 0;
            }
        }
        this.vx = dir * speed;
        this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
        const hit = moveAndCollide(this, level, dt);
        this.onGround = hit.onGround;
        if (hit.hitWall && turn) this.facing = -this.facing;
        return hit;
    }

    // Волк: увидев героя, разгоняется в его сторону.
    charge(dt, level, player) {
        this.chasing = this.sees(player);
        if (this.chasing) {
            this.face(player);
            this.walk(dt, level, this.facing, this.def.chaseSpeed, false);
        } else {
            this.walk(dt, level, this.facing, this.def.speed, true);
        }
    }

    // Скелет-мечник: подходит, замахивается (видно заранее) и бьёт.
    strike(dt, level, player) {
        const { reach, windup, recover, strikeDamage } = this.def;
        if (this.phase === 'walk') {
            if (this.sees(player, reach + this.w / 2 + 4)) {
                this.face(player);
                this.phase = 'windup';
                this.timer = windup;
            } else {
                this.walk(dt, level, this.facing, this.def.speed, true);
                return;
            }
        }
        this.walk(dt, level, 0, 0, false);
        this.timer -= dt;
        if (this.timer > 0) return;
        if (this.phase === 'windup') {
            this.phase = 'strike';
            this.timer = STRIKE_TIME;
            const cx = this.centerX(this);
            this.actions.push({
                type: 'strike',
                damage: strikeDamage,
                box: { x: this.facing > 0 ? cx : cx - reach, y: this.y - 2, w: reach, h: this.h + 2 },
            });
        } else if (this.phase === 'strike') {
            this.phase = 'recover';
            this.timer = recover;
        } else {
            this.phase = 'walk';
        }
    }

    // Скелет-лучник: стоит, поворачивается к герою и стреляет.
    shoot(dt, level, player) {
        this.walk(dt, level, 0, 0, false);
        this.timer = Math.max(0, this.timer - dt);
        if (!this.sees(player)) return;
        this.face(player);
        if (this.timer > 0) return;
        this.timer = this.def.rate;
        this.actions.push({
            type: 'shot',
            kind: this.def.shot,
            damage: this.def.shotDamage,
            dir: this.facing,
            x: this.centerX(this) + this.facing * 8,
            y: this.y + 12,
        });
    }

    // Бес: летает туда-обратно возле точки появления, покачиваясь по синусоиде,
    // и стреляет огнём точно в героя. Стены ему не мешают.
    fly(dt, player) {
        const { speed, range, rate, shot, shotDamage, sight } = this.def;
        if (this.stun > 0) {
            this.stun -= dt;
        } else {
            this.x += this.facing * speed * dt;
            if (Math.abs(this.x - this.baseX) > range) {
                this.x = this.baseX + Math.sign(this.x - this.baseX) * range;
                this.facing = -this.facing;
            }
        }
        this.y = this.baseY + Math.sin(this.animTime * 3) * 8;

        this.timer = Math.max(0, this.timer - dt);
        const target = { x: this.centerX(player), y: player.y + player.h / 2 };
        const origin = { x: this.centerX(this), y: this.y + this.h / 2 };
        const near = Math.hypot(target.x - origin.x, target.y - origin.y) < sight;
        if (player.dead || !near || this.timer > 0) return;
        this.timer = rate;
        this.actions.push({
            type: 'shot', kind: shot, damage: shotDamage,
            dir: target.x < origin.x ? -1 : 1, x: origin.x, y: origin.y, target,
        });
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

    // Видит ли враг героя: по горизонтали ближе range и примерно на той же высоте.
    sees(player, range = this.def.sight) {
        if (player.dead) return false;
        const dx = Math.abs(this.centerX(player) - this.centerX(this));
        const dy = Math.abs(player.y + player.h - (this.y + this.h));
        return dx < range && dy < SIGHT_HEIGHT;
    }

    face(player) {
        this.facing = this.centerX(player) < this.centerX(this) ? -1 : 1;
    }

    centerX(body) {
        return body.x + body.w / 2;
    }

    // Отдаёт накопленные действия и очищает очередь.
    takeActions() {
        const actions = this.actions;
        this.actions = [];
        return actions;
    }

    // Попадание. id — номер удара: тот же удар дважды не ранит.
    // dir — куда отбросить (1 или -1); freeze — заморозка в секундах:
    // замороженный враг стоит на месте дольше обычного оглушения и не отлетает.
    // Возвращает true, если урон прошёл.
    hit(damage, id, dir, freeze = 0) {
        if (this.dead || id === this.lastHitId) return false;
        this.lastHitId = id;
        this.takeDamage(damage);
        this.stun = Math.max(STUN_TIME, freeze);
        this.frozen = freeze;
        this.knockDir = freeze > 0 ? 0 : dir;
        this.flash = FLASH_TIME;
        return true;
    }
}
