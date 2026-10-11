import { Entity } from './Entity.js';
import { moveAndCollide } from '../Collision.js';
import { CLASSES } from '../data/classes.js';
import { CRIT_MULT } from '../data/items.js';
import {
    TILE, GRAVITY, RUN_SPEED, JUMP_SPEED, MAX_FALL,
    COYOTE_TIME, JUMP_BUFFER, JUMP_CUT, INVULN_TIME, AIR_JUMP_FACTOR,
} from '../data/constants.js';

// Номер удара. Враг запоминает номер последнего попадания,
// поэтому один взмах или рывок ранит его только один раз.
let nextActionId = 1;

export class Player extends Entity {
    // bonus — сумма свойств надетого снаряжения; rng — источник случайности для крита.
    constructor(classDef = CLASSES.swordsman, { bonus = null, rng = Math.random } = {}) {
        super(0, 0, 10, 22);
        this.classDef = classDef;
        this.bonus = { damage: 0, hp: 0, attackSpeed: 0, crit: 0, ...bonus };
        this.rng = rng;
        this.maxHp = classDef.maxHp + this.bonus.hp;
        this.hp = this.maxHp;
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
        this.swingHit = { damage: 0, crit: false };  // урон текущего взмаха
        this.dashHit = { damage: 0, crit: false };   // урон текущего рывка
        this.actions = [];    // удары и выстрелы этого шага — их забирает Game
        this.events = [];     // что произошло за шаг (для звука): jump, attack, shot…
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
            this.actions.push({
                type: 'melee', id: this.swingId, ...this.swingHit, dir: this.facing,
                box: this.meleeBox(this.classDef.attack.reach),
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
            this.events.push('jump');
        } else if (pressed && this.jumpsLeft > 0) {
            // Прыжок в воздухе: чуть слабее обычного.
            this.vy = -JUMP_SPEED * AIR_JUMP_FACTOR;
            this.jumpBuffer = 0;
            this.jumpsLeft--;
            this.events.push('jump');
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
        const { speed } = this.classDef.ability;
        this.dashTime -= dt;
        this.vx = this.facing * speed;
        this.vy = 0;
        this.onGround = moveAndCollide(this, level, dt).onGround;
        this.state = 'dash';
        this.actions.push({
            type: 'melee', id: this.dashId, ...this.dashHit, dir: this.facing,
            box: { x: this.x - 2, y: this.y, w: this.w + 4, h: this.h },
        });
    }

    startAttack(input) {
        const attack = this.classDef.attack;
        const cost = attack.manaCost ?? 0;
        if (!input.isDown('attack') || this.attackCooldown > 0 || this.dashTime > 0) return;
        if (cost > this.mana) return;

        this.mana -= cost;
        // Скорость атаки от снаряжения сокращает перезарядку.
        this.attackCooldown = attack.cooldown / (1 + this.bonus.attackSpeed / 100);
        this.attackTime = attack.duration ?? 0.15;
        if (attack.type === 'melee') {
            this.swingId = nextActionId++;
            this.swingHit = this.rollDamage(attack.damage);
            this.events.push('attack');
        } else {
            this.fire(attack);
        }
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
            this.dashHit = this.rollDamage(ability.damage);
            this.events.push('dash');
            this.invuln = Math.max(this.invuln, ability.duration + 0.1);
        } else if (ability.type === 'projectile') {
            this.fire(ability);
        } else if (ability.type === 'blast') {
            const cx = this.x + this.w / 2;
            const cy = this.y + this.h / 2;
            const r = ability.radius;
            this.events.push('blast');
            this.actions.push({
                type: 'blast', id: nextActionId++, ...this.rollDamage(ability.damage), dir: 0,
                x: cx, y: cy, radius: r,
                box: { x: cx - r, y: cy - r, w: r * 2, h: r * 2 },
            });
        }
    }

    // Выстрел: снаряд появляется у самого героя на уровне пояса —
    // так он попадает и по врагу вплотную, и по низкому врагу.
    fire(move) {
        this.events.push('shot');
        this.actions.push({
            type: 'projectile',
            kind: move.projectile,
            ...this.rollDamage(move.damage),
            dir: this.facing,
            x: this.x + this.w / 2 + this.facing * 2,
            y: this.y + 14,
        });
    }

    // Урон удара с учётом снаряжения. Крит бросается один раз на удар.
    rollDamage(base) {
        const crit = this.bonus.crit > 0 && this.rng() * 100 < this.bonus.crit;
        return { damage: (base + this.bonus.damage) * (crit ? CRIT_MULT : 1), crit };
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

    takeEvents() {
        const events = this.events;
        this.events = [];
        return events;
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
