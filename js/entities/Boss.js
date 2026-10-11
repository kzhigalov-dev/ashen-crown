import { Enemy } from './Enemy.js';
import { moveAndCollide } from '../Collision.js';
import { GRAVITY, MAX_FALL, TILE } from '../data/constants.js';

const FLASH_TIME = 0.12;
const TELEGRAPH = 0.6;      // сколько видна метка перед срабатыванием ловушки

// Босс. В отличие от обычного врага, не оглушается и не отбрасывается,
// а после потери половины здоровья атакует чаще (вторая фаза).
export class Boss extends Enemy {
    constructor(type, x, y) {
        super(type, x, y);
        this.floorY = y + TILE;             // уровень пола арены
        this.attackTimer = 1.5;             // пауза перед первой атакой
        this.summonTimer = this.def.summonRate ?? 0;
        this.state = 'walk';                // для рыцаря: walk, windup, dash, jump, rest
        this.stateTimer = 0;
        this.nextAttack = 0;                // чередование двух атак
        this.dashDir = 1;
    }

    get phase2() {
        return this.hp <= this.maxHp / 2;
    }

    // Пауза между атаками: во второй фазе короче.
    get attackRate() {
        return this.def.attackRate[this.phase2 ? 1 : 0];
    }

    update(dt, level, player) {
        this.animTime += dt;
        this.flash = Math.max(0, this.flash - dt);
        if (this.def.behavior === 'treant') this.treant(dt, level, player);
        else if (this.def.behavior === 'knight') this.knight(dt, level, player);
        else this.demon(dt, level, player);
    }

    // Ловушка с предупреждением: метка на полу, потом удар.
    hazard(kind, centerX, w, h, delay = TELEGRAPH, life = 0.4) {
        this.actions.push({
            type: 'hazard', kind, damage: this.def.hazardDamage,
            x: centerX - w / 2, w, h, bottom: this.floorY, delay, life,
        });
    }

    // Древо-страж: стоит на месте, бьёт корнями под героем и призывает слизней.
    treant(dt, level, player) {
        this.face(player);
        this.walk(dt, level, 0, 0, false);

        this.attackTimer -= dt;
        if (this.attackTimer <= 0 && !player.dead) {
            this.attackTimer = this.attackRate;
            this.hazard('root', this.centerX(player), 12, 22);
        }

        this.summonTimer -= dt;
        if (this.summonTimer <= 0) {
            this.summonTimer = this.def.summonRate;
            this.actions.push({
                type: 'summon', enemy: 'slime',
                x: this.x + (this.facing > 0 ? this.w + 8 : -24), y: this.floorY - TILE,
            });
        }
    }

    // Чёрный рыцарь: идёт к герою и чередует рывок через арену и прыжок с ударной волной.
    knight(dt, level, player) {
        let vx = 0;
        if (this.state === 'walk') {
            this.face(player);
            vx = this.facing * this.def.speed;
            this.attackTimer -= dt;
            if (this.attackTimer <= 0 && !player.dead) {
                if (this.nextAttack++ % 2 === 0) {
                    this.state = 'windup';
                    this.stateTimer = 0.5;
                } else {
                    // Прыжок рассчитан так, чтобы приземлиться около героя.
                    this.state = 'jump';
                    this.vy = -330;
                    const distance = this.centerX(player) - this.centerX(this);
                    this.dashDir = Math.max(-170, Math.min(170, distance / 0.7));
                    this.onGround = false;
                }
            }
        } else if (this.state === 'windup') {
            // Замах перед рывком: рыцарь стоит и мигает — время отойти или перепрыгнуть.
            this.flash = FLASH_TIME;
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.state = 'dash';
                this.stateTimer = 0.8;
                this.dashDir = this.facing;
            }
        } else if (this.state === 'dash') {
            vx = this.dashDir * this.def.dashSpeed;
            this.stateTimer -= dt;
        } else if (this.state === 'jump') {
            vx = this.dashDir;
        } else {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.state = 'walk';
                this.attackTimer = this.attackRate;
            }
        }

        this.vx = vx;
        this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
        const wasAirborne = !this.onGround;
        const hit = moveAndCollide(this, level, dt);
        this.onGround = hit.onGround;

        if (this.state === 'dash' && (hit.hitWall || this.stateTimer <= 0)) this.rest();
        if (this.state === 'jump' && wasAirborne && this.onGround) {
            // Приземление: ударная волна по полу в обе стороны.
            this.hazard('shock', this.x - 20, 40, 10, 0, 0.2);
            this.hazard('shock', this.x + this.w + 20, 40, 10, 0, 0.2);
            this.rest();
        }
    }

    rest() {
        this.state = 'rest';
        this.stateTimer = 0.6;
    }

    // Демон: парит над ареной, следует за героем и чередует залп шаров и огненные столбы.
    demon(dt, level, player) {
        const targetX = this.centerX(player);
        const distance = targetX - this.centerX(this);
        if (Math.abs(distance) > 8) {
            const nextX = this.x + Math.sign(distance) * this.def.speed * dt;
            // Не залетает в стены арены.
            if (nextX > TILE && nextX + this.w < level.width - TILE) this.x = nextX;
        }
        this.face(player);
        // Высота меняется: то опускается под удар меча, то поднимается.
        const lift = 34 + Math.sin(this.animTime * 1.2) * 16;
        this.y = this.floorY - lift - this.h;

        this.attackTimer -= dt;
        if (this.attackTimer > 0 || player.dead) return;
        this.attackTimer = this.attackRate;
        const origin = { x: this.centerX(this), y: this.y + this.h / 2 };
        if (this.nextAttack++ % 2 === 0) {
            const count = this.phase2 ? 5 : 3;
            for (let i = 0; i < count; i++) {
                const spread = (i - (count - 1) / 2) * 28;
                this.actions.push({
                    type: 'shot', kind: 'fireball', damage: this.def.shotDamage,
                    dir: this.facing, x: origin.x, y: origin.y,
                    target: { x: targetX + spread, y: player.y + player.h / 2 },
                });
            }
        } else {
            for (const offset of [-56, 0, 56]) this.hazard('pillar', targetX + offset, 12, 44, 0.7, 0.5);
        }
    }

    // Босс получает урон и мигает, но не оглушается и не отбрасывается.
    hit(damage, id) {
        if (this.dead || id === this.lastHitId) return false;
        this.lastHitId = id;
        this.takeDamage(damage);
        this.flash = FLASH_TIME;
        return true;
    }
}
