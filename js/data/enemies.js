// Враги и боссы. behavior:
//   patrol  — ходит по платформе туда-обратно;
//   charger — патрулирует, а увидев героя, разгоняется в его сторону;
//   striker — патрулирует, вблизи замахивается и бьёт с задержкой;
//   shooter — стоит на месте и стреляет в сторону героя;
//   flyer   — летает по синусоиде и стреляет прицельно;
//   treant, knight, demon — боссы (см. entities/Boss.js).
// gold  — сколько золота выпадает: [от, до].
// sight — на каком расстоянии враг замечает героя.
// Отрисовка: frames — кадры движения, idle — кадр стоя, scale — увеличение,
// recolor — замена цветов палитры, weapon — оружие в руке (для фигур-людей).

const BONE = { h: '#cfc8b4', H: '#ece6d2', s: '#ece6d2', w: '#1a1423', c: '#8f8a78', C: '#b3ad98', b: '#5a5560', l: '#8f8a78', L: '#6b6658' };
const DARK_STEEL = { h: '#2b2f3a', H: '#454b5a', s: '#1a1423', w: '#ff4a3a', c: '#20232c', C: '#343946', b: '#8a1f1f', l: '#20232c', L: '#14161c' };

export const ENEMIES = {
    slime: {
        id: 'slime', name: 'Слизень', behavior: 'patrol',
        w: 14, h: 10, maxHp: 30, damage: 10, speed: 22, gold: [3, 6],
        frames: ['slime1', 'slime2'],
    },
    wolf: {
        id: 'wolf', name: 'Волк', behavior: 'charger',
        w: 20, h: 12, maxHp: 45, damage: 15, speed: 36, chaseSpeed: 125, sight: 96, gold: [6, 10],
        frames: ['wolf1', 'wolf2'],
    },
    skeleton: {
        id: 'skeleton', name: 'Скелет-мечник', behavior: 'striker',
        w: 10, h: 22, maxHp: 60, damage: 8, speed: 30, gold: [8, 12],
        reach: 20, windup: 0.4, recover: 0.7, strikeDamage: 18,
        frames: ['heroRun1', 'heroRun2'], idle: 'heroIdle', recolor: BONE, weapon: 'sword',
    },
    skeletonArcher: {
        id: 'skeletonArcher', name: 'Скелет-лучник', behavior: 'shooter',
        w: 10, h: 22, maxHp: 40, damage: 8, speed: 0, sight: 170, gold: [8, 12],
        rate: 2, shot: 'enemyArrow', shotDamage: 10,
        frames: ['heroIdle'], idle: 'heroIdle', recolor: BONE, weapon: 'bow',
    },
    imp: {
        id: 'imp', name: 'Бес', behavior: 'flyer',
        w: 12, h: 12, maxHp: 35, damage: 10, speed: 28, sight: 130, gold: [8, 14],
        range: 40, rate: 2.5, shot: 'fireball', shotDamage: 12,
        frames: ['imp1', 'imp2'],
    },

    // ---------- Боссы ----------
    treant: {
        id: 'treant', name: 'Древо-страж', behavior: 'treant', boss: true,
        w: 26, h: 42, maxHp: 260, damage: 12, speed: 0, gold: [40, 60],
        attackRate: [2.2, 1.4], hazardDamage: 15, summonRate: 7,
        frames: ['treant'], scale: 2,
    },
    knight: {
        id: 'knight', name: 'Чёрный рыцарь', behavior: 'knight', boss: true,
        w: 18, h: 42, maxHp: 380, damage: 18, speed: 30, gold: [60, 90],
        attackRate: [2.0, 1.2], dashSpeed: 230, hazardDamage: 15,
        frames: ['heroRun1', 'heroRun2'], idle: 'heroIdle', recolor: DARK_STEEL, weapon: 'sword', scale: 2,
    },
    demon: {
        id: 'demon', name: 'Демон', behavior: 'demon', boss: true,
        w: 32, h: 34, maxHp: 480, damage: 15, speed: 40, gold: [90, 130],
        attackRate: [2.4, 1.6], shotDamage: 12, hazardDamage: 15,
        frames: ['demon'], scale: 2,
    },
};
