import { Entity } from './Entity.js';
import { moveAndCollide } from '../Collision.js';
import { CLASSES } from '../data/classes.js';
import {
    TILE, GRAVITY, RUN_SPEED, JUMP_SPEED, MAX_FALL,
    COYOTE_TIME, JUMP_BUFFER, JUMP_CUT, INVULN_TIME, AIR_JUMP_FACTOR,
} from '../data/constants.js';

// Номер удара. Враг запоминает номер последнего попадания,
// поэтому один взмах или рывок ранит его только один раз.
let nextActionId = 1;

export class Player extends Entity {
    constructor(classDef = CLASSES.swordsman) {
        super(0, 0, 10, 22);
        this.classDef = classDef;
        this.maxHp = classDef.maxHp;
        this.hp = classDef.maxHp;
        this.maxMana = classDef.maxMana;
        this.mana = classDef.maxMana;
        this.jumpsLeft = classDef.extraJumps;  // прыжки в воздухе (у лучника один)

        this.coyote = 0;      // сколько ещё можно прыгнуть после схода с края
        this.jumpBuffer = 0;  // сколько ещё помнится нажатие прыжка
        this.invuln = 0;      // остаток неуязвимости после урона
        this.animTime = 0;
        this.state = 'idle';

        this.attackCooldown = 0;
        this.abilityCooldown = 0;
        this.attackTime = 0;  // сколько ещё длится взмах или выстрел
        this.dashTime = 0;    // сколько ещё длится рывок
        this.swingId = 0;
        this.dashId = 0;
        this.actions = [];    // удары и выстрелы этого шага — их забирает Game
    }

    update(dt, input, level) {
        this.attackCooldown = Math.max(0, this.attackCooldown - dt);
        this.abilityCooldown = Math.max(0, this.abilityCooldown - dt);
        this.attackTime = Math.max(0, this.attackTime - dt);
        this.invuln = Math.max(0, this.invuln - dt);
        this.mana = Math.min(this.maxMana, this.mana + this.classDef.manaRegen * dt);
        this.animTime += dt;

        const dir = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
        if (dir !== 0 && this.dashTime <= 0) this.facing = dir;

        this.startAbility(input);
        this.startAttack(input);

        if (this.dashTime > 0) this.dash(dt, level);
        else this.move(dt, dir, input, level);

        if (this.attackTime > 0 && this.classDef.attack.type === 'melee') {
            const { damage, reach } = this.classDef.attack;
            this.actions.push({
                type: 'melee', id: this.swingId, damage, dir: this.facing, box: this.meleeBox(reach),
            });
        }
    }

    move(dt, dir, input, level) {
        this.vx = dir * RUN_SPEED;

        // onGround здесь — результат прошлого шага.
        const pressed = input.wasPressed('jump');
        this.coyote = this.onGround ? COYOTE_TIME : Math.max(0, this.coyote - dt);
        this.jumpBuffer = pressed ? JUMP_BUFFER : Math.max(0, this.jumpBuffer - dt);
        if (this.onGround) this.jumpsLeft = this.classDef.extraJumps;

        if (this.jumpBuffer > 0 && this.coyote > 0) {
            this.vy = -JUMP_SPEED;
            this.jumpBuffer = 0;
            this.coyote = 0;
        } else if (pressed && this.jumpsLeft > 0) {
            // Прыжок в воздухе: чуть слабее обычного.
            this.vy = -JUMP_SPEED * AIR_JUMP_FACTOR;
            this.jumpBuffer = 0;
            this.jumpsLeft--;
        }

        // Клавиша отпущена на взлёте — срезаем скорость, прыжок получается ниже.
        const cutSpeed = -JUMP_SPEED * JUMP_CUT;
        if (!input.isDown('jump') && this.vy < cutSpeed) this.vy = cutSpeed;

        this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
        this.onGround = moveAndCollide(this, level, dt).onGround;

        if (!this.onGround) this.state = 'jump';
        else this.state = dir !== 0 ? 'run' : 'idle';
    }

    // Рывок: быстрое движение по прямой, гравитация не действует.
    dash(dt, level) {
        const { speed, damage } = this.classDef.ability;
        this.dashTime -= dt;
        this.vx = this.facing * speed;
        this.vy = 0;
        this.onGround = moveAndCollide(this, level, dt).onGround;
        this.state = 'dash';
        this.actions.push({
            type: 'melee', id: this.dashId, damage, dir: this.facing,
            box: { x: this.x - 2, y: this.y, w: this.w + 4, h: this.h },
        });
    }

    startAttack(input) {
        const attack = this.classDef.attack;
        const cost = attack.manaCost ?? 0;
        if (!input.isDown('attack') || this.attackCooldown > 0 || this.dashTime > 0) return;
        if (cost > this.mana) return;

        this.mana -= cost;
        this.attackCooldown = attack.cooldown;
        this.attackTime = attack.duration ?? 0.15;
        if (attack.type === 'melee') this.swingId = nextActionId++;
        else this.fire(attack);
    }

    startAbility(input) {
        const ability = this.classDef.ability;
        const cost = ability.manaCost ?? 0;
        if (!input.wasPressed('ability') || this.abilityCooldown > 0 || this.dashTime > 0) return;
        if (cost > this.mana) return;

        this.mana -= cost;
        this.abilityCooldown = ability.cooldown;
        if (ability.type === 'dash') {
            this.dashTime = ability.duration;
            this.dashId = nextActionId++;
            this.invuln = Math.max(this.invuln, ability.duration + 0.1);
        } else if (ability.type === 'projectile') {
            this.fire(ability);
        } else if (ability.type === 'blast') {
            const cx = this.x + this.w / 2;
            const cy = this.y + this.h / 2;
            const r = ability.radius;
            this.actions.push({
                type: 'blast', id: nextActionId++, damage: ability.damage, dir: 0,
                x: cx, y: cy, radius: r,
                box: { x: cx - r, y: cy - r, w: r * 2, h: r * 2 },
            });
        }
    }

    // Выстрел: снаряд появляется перед героем на уровне рук.
    fire(move) {
        this.actions.push({
            type: 'projectile',
            kind: move.projectile,
            damage: move.damage,
            dir: this.facing,
            x: this.x + this.w / 2 + this.facing * 8,
            y: this.y + 10,
        });
    }

    // Область удара мечом: от середины героя вперёд.
    meleeBox(reach) {
        const cx = this.x + this.w / 2;
        return { x: this.facing > 0 ? cx : cx - reach, y: this.y - 4, w: reach, h: this.h + 4 };
    }

    // Отдаёт накопленные действия и очищает очередь.
    takeActions() {
        const actions = this.actions;
        this.actions = [];
        return actions;
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
