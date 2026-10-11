// Враги. behavior:
//   patrol  — ходит по платформе туда-обратно;
//   charger — патрулирует, а увидев героя, разгоняется в его сторону.
// gold — сколько золота выпадает: [от, до].
// sight — на каком расстоянии по горизонтали враг замечает героя.

export const ENEMIES = {
    slime: {
        id: 'slime',
        name: 'Слизень',
        behavior: 'patrol',
        w: 14,
        h: 10,
        maxHp: 30,
        damage: 10,
        speed: 22,
        gold: [3, 6],
        sprite: 'slime',
    },
    wolf: {
        id: 'wolf',
        name: 'Волк',
        behavior: 'charger',
        w: 20,
        h: 12,
        maxHp: 45,
        damage: 15,
        speed: 36,
        chaseSpeed: 125,
        sight: 96,
        gold: [6, 10],
        sprite: 'wolf',
    },
};
