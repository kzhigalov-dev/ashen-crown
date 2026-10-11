// Общее для всех подвижных объектов: прямоугольник, скорость, здоровье.
export class Entity {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.vx = 0;
        this.vy = 0;
        this.facing = 1;
        this.onGround = false;
        this.maxHp = 1;
        this.hp = 1;
        this.dead = false;
    }

    takeDamage(amount) {
        this.hp = Math.max(0, this.hp - amount);
        if (this.hp === 0) this.dead = true;
    }
}
