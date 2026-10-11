import { Entity } from './Entity.js';
import { moveAndCollide } from '../Collision.js';
import {
    TILE, GRAVITY, RUN_SPEED, JUMP_SPEED, MAX_FALL,
    COYOTE_TIME, JUMP_BUFFER, JUMP_CUT, INVULN_TIME,
} from '../data/constants.js';

export class Player extends Entity {
    constructor() {
        super(0, 0, 10, 22);
        this.maxHp = 100;
        this.hp = 100;
        this.coyote = 0;      // сколько ещё можно прыгнуть после схода с края
        this.jumpBuffer = 0;  // сколько ещё помнится нажатие прыжка
        this.invuln = 0;      // остаток неуязвимости после урона
        this.animTime = 0;
        this.state = 'idle';
    }

    update(dt, input, level) {
        const dir = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
        this.vx = dir * RUN_SPEED;
        if (dir !== 0) this.facing = dir;

        // onGround здесь — результат прошлого шага.
        this.coyote = this.onGround ? COYOTE_TIME : Math.max(0, this.coyote - dt);
        this.jumpBuffer = input.wasPressed('jump') ? JUMP_BUFFER : Math.max(0, this.jumpBuffer - dt);

        if (this.jumpBuffer > 0 && this.coyote > 0) {
            this.vy = -JUMP_SPEED;
            this.jumpBuffer = 0;
            this.coyote = 0;
        }

        // Клавиша отпущена на взлёте — срезаем скорость, прыжок получается ниже.
        const cutSpeed = -JUMP_SPEED * JUMP_CUT;
        if (!input.isDown('jump') && this.vy < cutSpeed) this.vy = cutSpeed;

        this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
        this.onGround = moveAndCollide(this, level, dt).onGround;

        this.invuln = Math.max(0, this.invuln - dt);
        this.animTime += dt;
        if (!this.onGround) this.state = 'jump';
        else this.state = dir !== 0 ? 'run' : 'idle';
    }

    // Урон от врагов и ловушек. Возвращает false, если урон не прошёл.
    hurt(amount) {
        if (this.dead || this.invuln > 0) return false;
        this.takeDamage(amount);
        this.invuln = INVULN_TIME;
        return true;
    }

    // Ставит героя ногами на нижний край тайла, по центру.
    placeAt(point) {
        this.x = point.x + (TILE - this.w) / 2;
        this.y = point.y + TILE - this.h;
        this.vx = 0;
        this.vy = 0;
    }
}
