// Виды оружия. У каждого вида свой облик в руке героя, своя атака (J)
// и своя способность (K): сменил оружие — изменился стиль боя.
//   gender — род названия, чтобы согласовать редкость: «редкая секира», «редкое копьё»;
//   sprite — спрайт оружия в руке;
//   text   — одна строка о том, чем вид отличается.
// Типы атак и способностей:
//   melee      — удар перед собой: reach — дальность, swing — вид следа (slash или thrust);
//   projectile — выстрел; offsets — несколько снарядов разом на разной высоте,
//                lifts — несколько снарядов с разной дугой;
//   dash       — рывок; blast — удар по площади вокруг героя (stun — заморозка, с);
//   chain      — молния, перескакивающая между ближайшими врагами.

export const WEAPONS = {
    // ---------- Мечник ----------
    sword: {
        id: 'sword', classId: 'swordsman', name: 'меч', gender: 'm', sprite: 'sword',
        text: 'Быстрый и надёжный.',
        attack: { type: 'melee', name: 'удар мечом', damage: 14, cooldown: 0.4, reach: 24, duration: 0.12, swing: 'slash' },
        ability: {
            type: 'dash', name: 'рывок', text: 'проносит сквозь врагов; в рывке герой неуязвим',
            damage: 20, cooldown: 4, speed: 320, duration: 0.18,
        },
    },
    axe: {
        id: 'axe', classId: 'swordsman', name: 'секира', gender: 'f', sprite: 'axe',
        text: 'Медленная, но бьёт почти вдвое сильнее.',
        attack: { type: 'melee', name: 'удар секирой', damage: 24, cooldown: 0.7, reach: 22, duration: 0.16, swing: 'slash' },
        ability: {
            type: 'blast', name: 'круговой удар', text: 'бьёт всех вокруг героя',
            effect: 'whirl', damage: 30, cooldown: 5, radius: 30,
        },
    },
    spear: {
        id: 'spear', classId: 'swordsman', name: 'копьё', gender: 'n', sprite: 'spear',
        text: 'Достаёт врага издалека, но урон меньше.',
        attack: { type: 'melee', name: 'выпад копьём', damage: 11, cooldown: 0.35, reach: 38, duration: 0.1, swing: 'thrust' },
        ability: {
            type: 'projectile', name: 'бросок копья', text: 'летит далеко и пробивает врагов насквозь',
            projectile: 'spear', damage: 28, cooldown: 5,
        },
    },

    // ---------- Лучник ----------
    bow: {
        id: 'bow', classId: 'archer', name: 'лук', gender: 'm', sprite: 'bow',
        text: 'Стрела летит по дуге.',
        attack: { type: 'projectile', name: 'стрела', projectile: 'arrow', damage: 10, cooldown: 0.5 },
        ability: {
            type: 'projectile', name: 'пробивающий выстрел', text: 'быстрая стрела насквозь через всех врагов',
            projectile: 'piercingArrow', damage: 24, cooldown: 5,
        },
    },
    crossbow: {
        id: 'crossbow', classId: 'archer', name: 'арбалет', gender: 'm', sprite: 'crossbow',
        text: 'Бьёт редко и сильно, болт летит по прямой.',
        attack: { type: 'projectile', name: 'болт', projectile: 'quarrel', damage: 19, cooldown: 0.9 },
        ability: {
            type: 'projectile', name: 'залп', text: 'три болта разом на разной высоте',
            projectile: 'quarrel', damage: 14, cooldown: 5, offsets: [-7, -2, 3],
        },
    },
    shortbow: {
        id: 'shortbow', classId: 'archer', name: 'короткий лук', gender: 'm', sprite: 'shortbow',
        text: 'Стреляет вдвое чаще, но слабее.',
        attack: { type: 'projectile', name: 'быстрая стрела', projectile: 'arrow', damage: 6, cooldown: 0.25 },
        ability: {
            type: 'projectile', name: 'дождь стрел', text: 'пять стрел навесом накрывают землю впереди',
            projectile: 'lob', damage: 9, cooldown: 6, lifts: [120, 170, 220, 270, 320],
        },
    },

    // ---------- Маг ----------
    fireStaff: {
        id: 'fireStaff', classId: 'mage', name: 'посох огня', gender: 'm', sprite: 'staffFire',
        text: 'Самый сильный урон.',
        attack: { type: 'projectile', name: 'огненный шар', projectile: 'flame', damage: 16, cooldown: 0.45, manaCost: 12 },
        ability: {
            type: 'blast', name: 'взрыв', text: 'бьёт всех вокруг героя',
            effect: 'fire', damage: 30, cooldown: 6, radius: 44, manaCost: 30,
        },
    },
    iceStaff: {
        id: 'iceStaff', classId: 'mage', name: 'посох льда', gender: 'm', sprite: 'staffIce',
        text: 'Слабее, зато замораживает врагов.',
        attack: { type: 'projectile', name: 'ледяной осколок', projectile: 'shard', damage: 11, cooldown: 0.4, manaCost: 9 },
        ability: {
            type: 'blast', name: 'ледяная волна', text: 'надолго замораживает всех вокруг',
            effect: 'frost', damage: 14, cooldown: 7, radius: 54, manaCost: 35, stun: 1.6,
        },
    },
    stormStaff: {
        id: 'stormStaff', classId: 'mage', name: 'посох бури', gender: 'm', sprite: 'staffStorm',
        text: 'Молния мгновенна и пробивает насквозь.',
        attack: { type: 'projectile', name: 'молния', projectile: 'spark', damage: 12, cooldown: 0.5, manaCost: 14 },
        ability: {
            type: 'chain', name: 'цепная молния', text: 'перескакивает между четырьмя ближайшими врагами',
            damage: 22, cooldown: 6, range: 120, targets: 4, manaCost: 40,
        },
    },
};

// Снаряды. speed — скорость, lift — начальная скорость вверх,
// gravity — насколько снаряд снижается, life — секунды до исчезновения,
// pierce — пробивает врагов насквозь, stun — на сколько секунд замораживает,
// aimed — летит не по горизонтали, а точно в указанную точку.
export const PROJECTILES = {
    arrow: { w: 8, h: 3, speed: 260, lift: 30, gravity: 120, pierce: false, life: 2, sprite: 'arrow' },
    piercingArrow: { w: 8, h: 3, speed: 380, lift: 0, gravity: 0, pierce: true, life: 1.2, sprite: 'arrowBright' },
    lob: { w: 8, h: 3, speed: 150, lift: 0, gravity: 520, pierce: false, life: 2, sprite: 'arrow' },
    quarrel: { w: 7, h: 3, speed: 340, lift: 0, gravity: 0, pierce: false, life: 1.2, sprite: 'quarrel' },
    spear: { w: 12, h: 3, speed: 300, lift: 10, gravity: 60, pierce: true, life: 1.4, sprite: 'spearShot' },
    flame: { w: 6, h: 6, speed: 200, lift: 0, gravity: 0, pierce: false, life: 1.2, sprite: 'fireball' },
    shard: { w: 7, h: 4, speed: 230, lift: 0, gravity: 0, pierce: false, life: 1.2, sprite: 'shard', stun: 0.6 },
    spark: { w: 10, h: 3, speed: 520, lift: 0, gravity: 0, pierce: true, life: 0.45, sprite: 'spark' },
    // Снаряды врагов
    enemyArrow: { w: 8, h: 3, speed: 150, lift: 0, gravity: 0, pierce: false, life: 2.5, sprite: 'arrow' },
    fireball: { w: 6, h: 6, speed: 115, lift: 0, gravity: 0, pierce: false, life: 3, sprite: 'fireball', aimed: true },
};
