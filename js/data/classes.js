// Классы героя. Отличаются атакой (J), способностью (K) и запасом здоровья.
// palette — перекраска общей фигуры героя: капюшон (h, H) и плащ (c, C).

export const CLASSES = {
    swordsman: {
        id: 'swordsman',
        name: 'Мечник',
        description: 'Бьёт вблизи и держит удар. Рывок проносит сквозь врагов.',
        maxHp: 120,
        maxMana: 0,
        manaRegen: 0,
        extraJumps: 0,
        attack: { type: 'melee', name: 'удар мечом', damage: 14, cooldown: 0.4, reach: 24, duration: 0.12 },
        ability: { type: 'dash', name: 'рывок', damage: 20, cooldown: 4, speed: 320, duration: 0.18 },
        weapon: 'sword',
        palette: { h: '#6b7480', H: '#9aa3ad', c: '#6b2f3a', C: '#94434f' },
    },
    archer: {
        id: 'archer',
        name: 'Лучник',
        description: 'Стреляет издалека, стрела летит по дуге. Умеет прыгать дважды.',
        maxHp: 90,
        maxMana: 0,
        manaRegen: 0,
        extraJumps: 1,
        attack: { type: 'projectile', name: 'стрела', projectile: 'arrow', damage: 10, cooldown: 0.5 },
        ability: {
            type: 'projectile', name: 'пробивающий выстрел',
            projectile: 'piercingArrow', damage: 24, cooldown: 5,
        },
        weapon: 'bow',
        palette: { h: '#3f6b3a', H: '#63994f', c: '#5a4a2e', C: '#80693f' },
    },
    mage: {
        id: 'mage',
        name: 'Маг',
        description: 'Мощные шары тратят ману. Хрупок, но взрыв бьёт всех вокруг.',
        maxHp: 70,
        maxMana: 100,
        manaRegen: 8,
        extraJumps: 0,
        attack: {
            type: 'projectile', name: 'магический шар',
            projectile: 'bolt', damage: 16, cooldown: 0.45, manaCost: 12,
        },
        ability: { type: 'blast', name: 'взрыв', damage: 30, cooldown: 6, radius: 44, manaCost: 30 },
        weapon: 'staff',
        palette: { h: '#4a3a7a', H: '#7458b3', c: '#2f3f6b', C: '#435a94' },
    },
};

export const CLASS_ORDER = ['swordsman', 'archer', 'mage'];

// Снаряды. speed — скорость, lift — начальная скорость вверх,
// gravity — насколько снаряд снижается, life — секунды до исчезновения.
// aimed — летит не по горизонтали, а точно в указанную точку.
export const PROJECTILES = {
    arrow: { w: 8, h: 3, speed: 260, lift: 30, gravity: 120, pierce: false, life: 2, sprite: 'arrow' },
    piercingArrow: { w: 8, h: 3, speed: 380, lift: 0, gravity: 0, pierce: true, life: 1.2, sprite: 'arrowBright' },
    bolt: { w: 6, h: 6, speed: 200, lift: 0, gravity: 0, pierce: false, life: 1.2, sprite: 'bolt' },
    // Снаряды врагов
    enemyArrow: { w: 8, h: 3, speed: 150, lift: 0, gravity: 0, pierce: false, life: 2.5, sprite: 'arrow' },
    fireball: { w: 6, h: 6, speed: 115, lift: 0, gravity: 0, pierce: false, life: 3, sprite: 'fireball', aimed: true },
};
