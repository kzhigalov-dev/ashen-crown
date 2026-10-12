// Враги и боссы. behavior:
//   patrol  — ходит по платформе туда-обратно;
//   charger — патрулирует, а увидев героя, разгоняется в его сторону;
//   striker — патрулирует, вблизи замахивается и бьёт с задержкой;
//   shooter — стоит на месте и стреляет в сторону героя;
//   flyer   — летает по синусоиде и стреляет прицельно;
//   treant, knight, demon — боссы (см. entities/Boss.js).
// gold  — сколько золота выпадает: [от, до].
// sight — на каком расстоянии враг замечает героя (нужна прямая видимость);
// alert — сколько секунд волк замирает, заметив героя, прежде чем броситься.
// Отрисовка: frames — кадры движения, idle — кадр стоя, scale — увеличение,
// figure — чью фигуру из HEROES брать (иначе кадры ищутся в SPRITES),
// recolor — замена цветов палитры, weapon — оружие в руке (для фигур-людей),
// color — цвет частиц при гибели, line — реплика босса при пробуждении.

// Скелеты и Чёрный рыцарь — фигуры героев (figure) в других цветах:
// доспех мечника становится костью или воронёной сталью.
const BONE = {
    X: '#ece6d2', x: '#cfc8b4', a: '#8f8a78', s: '#ece6d2', w: '#1a1423',
    c: '#4a4450', C: '#5f5966', r: '#4a4450', b: '#5a5560', l: '#cfc8b4', L: '#8f8a78',
};
const BONE_ARCHER = {
    I: '#5f5966', i: '#4a4450', t: '#cfc8b4', T: '#ece6d2', p: '#3a3640',
    s: '#ece6d2', w: '#1a1423', b: '#5a5560', l: '#cfc8b4', L: '#8f8a78',
};
const DARK_STEEL = {
    X: '#454b5a', x: '#343946', a: '#20232c', s: '#14161c', w: '#ff4a3a',
    c: '#5a1212', C: '#8a1f1f', r: '#8a1f1f', b: '#8a1f1f', l: '#20232c', L: '#14161c',
};

export const ENEMIES = {
    slime: {
        id: 'slime', name: 'Слизень', behavior: 'patrol', color: '#58b368',
        w: 14, h: 10, maxHp: 24, damage: 6, speed: 22, gold: [3, 6],
        frames: ['slime1', 'slime2'],
    },
    wolf: {
        id: 'wolf', name: 'Волк', behavior: 'charger', color: '#6a6f7d',
        w: 20, h: 12, maxHp: 36, damage: 9, speed: 36, chaseSpeed: 100, sight: 96, alert: 0.4, gold: [6, 10],
        frames: ['wolf1', 'wolf2'],
    },
    skeleton: {
        id: 'skeleton', name: 'Скелет-мечник', behavior: 'striker', color: '#ece6d2',
        w: 10, h: 22, maxHp: 48, damage: 5, speed: 30, gold: [8, 12],
        reach: 20, windup: 0.5, recover: 0.8, strikeDamage: 12,
        figure: 'swordsman', frames: ['run1', 'run2', 'run3', 'run2'], idle: 'idle', recolor: BONE, weapon: 'sword',
    },
    skeletonArcher: {
        id: 'skeletonArcher', name: 'Скелет-лучник', behavior: 'shooter', color: '#ece6d2',
        w: 10, h: 22, maxHp: 30, damage: 5, speed: 0, sight: 170, gold: [8, 12],
        rate: 2.2, shot: 'enemyArrow', shotDamage: 7,
        figure: 'archer', frames: ['idle'], idle: 'idle', recolor: BONE_ARCHER, weapon: 'bow',
    },
    imp: {
        id: 'imp', name: 'Бес', behavior: 'flyer', color: '#d9442b',
        w: 12, h: 12, maxHp: 26, damage: 6, speed: 28, sight: 130, gold: [8, 14],
        range: 40, rate: 2.8, shot: 'fireball', shotDamage: 8,
        frames: ['imp1', 'imp2'],
    },

    // ---------- Боссы ----------
    treant: {
        id: 'treant', name: 'Древо-страж', behavior: 'treant', boss: true, color: '#8a5a2b',
        w: 26, h: 42, maxHp: 260, damage: 8, speed: 0, gold: [40, 60],
        attackRate: [2.4, 1.6], hazardDamage: 11, summonRate: 8,
        frames: ['treant'], scale: 2,
        line: '«Клятва… ещё… держит»',
    },
    knight: {
        id: 'knight', name: 'Чёрный рыцарь', behavior: 'knight', boss: true, color: '#454b5a',
        w: 18, h: 42, maxHp: 380, damage: 12, speed: 30, gold: [60, 90],
        attackRate: [2.2, 1.4], windup: 0.7, dashSpeed: 200, dashTime: 0.55, hazardDamage: 11,
        figure: 'swordsman', frames: ['run1', 'run2', 'run3', 'run2'], idle: 'idle', recolor: DARK_STEEL, weapon: 'axe', scale: 2,
        line: '«Никто не войдёт в зал. Таков был приказ»',
    },
    demon: {
        id: 'demon', name: 'Демон', behavior: 'demon', boss: true, color: '#d9442b',
        w: 32, h: 34, maxHp: 480, damage: 10, speed: 40, gold: [90, 130],
        attackRate: [2.6, 1.8], shotDamage: 9, hazardDamage: 11,
        frames: ['demon'], scale: 2,
        line: '«Корона горела красиво. Гори и ты»',
    },
};
