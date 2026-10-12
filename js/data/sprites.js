// Каждый спрайт — массив строк, символ = пиксель, цвет берётся из палитры.
// Герой нарисован лицом вправо; зеркальная копия строится в Renderer.

export const PALETTE = {
    '.': null,       // прозрачный
    k: '#1a1423',    // контур
    h: '#3b5d6e',    // капюшон
    H: '#5a8a9a',    // капюшон, свет
    s: '#e0b28a',    // кожа
    w: '#f2f0e6',    // глаз
    c: '#6b2f3a',    // плащ
    C: '#94434f',    // плащ, свет
    b: '#c9a24a',    // пояс
    l: '#2b2433',    // штаны
    L: '#4a3b2a',    // сапоги
    g: '#4f7a3a',    // трава
    G: '#7fae4a',    // трава, свет
    d: '#4a3328',    // земля
    D: '#6b4a38',    // земля, свет
    e: '#33221c',    // земля, тень
    p: '#8a5a2b',    // дерево
    P: '#b07a3d',    // дерево, свет
    x: '#9aa3ad',    // металл шипов
    X: '#d5dbe0',    // металл, блик
    y: '#e8b923',    // золото
    Y: '#ffe27a',    // золото, блик
    o: '#a8780f',    // золото, тень
    r: '#d9442b',    // огонь, край
    f: '#f28a2e',    // огонь
    F: '#ffd75e',    // огонь, сердцевина
    m: '#7a3fd1',    // портал
    M: '#c08bff',    // портал, свет
    n: '#5a5560',    // камень
    j: '#58b368',    // слизень
    J: '#9be0a0',    // слизень, блик
    q: '#2f7a45',    // слизень, тень
    u: '#6a6f7d',    // шерсть волка
    U: '#9aa0ad',    // шерсть, свет
    v: '#3c4050',    // шерсть, тень
    a: '#7d8792',    // сталь, тень
    i: '#3f6b3a',    // плащ лучника
    I: '#63994f',    // плащ лучника, свет
    t: '#5a4a2e',    // кожа доспеха
    T: '#80693f',    // кожа доспеха, свет
    z: '#2f3f6b',    // мантия мага
    Z: '#435a94',    // мантия мага, свет
    E: '#8fd8ff',    // лёд
    O: '#d9f4ff',    // лёд, блик
    1: '#d8a531',    // корона: левый зубец (перекрашивается по прогрессу)
    2: '#d8a531',    // корона: средний зубец
    3: '#d8a531',    // корона: правый зубец
    B: '#b0842a',    // корона: обод
    R: '#e2572b',    // корона: камни
};

// Мелкий шрифт для чисел на игровом поле: цифры и несколько знаков, 3×5 пикселей.
export const GLYPHS = {
    0: ['###', '#.#', '#.#', '#.#', '###'],
    1: ['.#.', '##.', '.#.', '.#.', '###'],
    2: ['###', '..#', '###', '#..', '###'],
    3: ['###', '..#', '###', '..#', '###'],
    4: ['#.#', '#.#', '###', '..#', '..#'],
    5: ['###', '#..', '###', '..#', '###'],
    6: ['###', '#..', '###', '#.#', '###'],
    7: ['###', '..#', '..#', '.#.', '.#.'],
    8: ['###', '#.#', '###', '#.#', '###'],
    9: ['###', '#.#', '###', '..#', '###'],
    '!': ['.#.', '.#.', '.#.', '...', '.#.'],
    '+': ['...', '.#.', '###', '.#.', '...'],
    '-': ['...', '...', '###', '...', '...'],
    '/': ['..#', '..#', '.#.', '#..', '#..'],
    K: ['#.#', '#.#', '##.', '#.#', '#.#'],
};

// ---------- Герои ----------
// Фигура 16×24 собирается из трёх частей: голова (9 строк), торс (9) и ноги (6).
// У торса два вида — обычный и с выставленной вперёд рукой (атака);
// у ног — стойка, три кадра бега, прыжок и падение. Все смотрят вправо.

const SWORDSMAN_HEAD = [
    '......rr........',
    '.....rrkkkk.....',
    '....krXXXXxk....',
    '....kXXxxxxxk...',
    '....kXxxxxxxk...',
    '....kxkkkkkkk...',
    '....kxsswskxk...',
    '....kxsssskak...',
    '.....kkssskk....',
];
const SWORDSMAN_TORSO = [
    '...kXXkccckXXk..',
    '..kXxxkcCCckxxk.',
    '..kxakxcCCcxkak.',
    '..kakkxccccxksk.',
    '...kk.kxccxk.k..',
    '......kbbbbk....',
    '......kccCck....',
    '......kcccck....',
    '......kccCck....',
];
const SWORDSMAN_ATTACK = [
    '...kXXkccckXXk..',
    '..kXxxkcCCckxxkk',
    '..kxakxcCCcxkask',
    '..kakkxccccxkkk.',
    '...kk.kxccxk....',
    '......kbbbbk....',
    '......kccCck....',
    '......kcccck....',
    '......kccCck....',
];

const ARCHER_HEAD = [
    '................',
    '......kkkk......',
    '.....kIIIIk.....',
    '....kIIiiiik....',
    '....kIiiiiiik...',
    '....kiikkkkkk...',
    '....kiksswsk....',
    '....kikssssk....',
    '....kiikssk.....',
];
const ARCHER_TORSO = [
    '..wkiikttttk....',
    '..kkiiktTTttk...',
    '..kpkiktTTttkk..',
    '..kpkiktttttksk.',
    '..kpkiikttttkk..',
    '...kkikbbbbk....',
    '....kikttttk....',
    '....kikttttk....',
    '.....kkttttk....',
];
const ARCHER_ATTACK = [
    '..wkiikttttk....',
    '..kkiiktTTttk...',
    '..kpkiktTTttkkk.',
    '..kpkiktttttkssk',
    '..kpkiikttttkkk.',
    '...kkikbbbbk....',
    '....kikttttk....',
    '....kikttttk....',
    '.....kkttttk....',
];

const MAGE_HEAD = [
    '.......kk.......',
    '......kMmk......',
    '......kMmmk.....',
    '.....kMMmmk.....',
    '....kMMmmmmk....',
    '..kkkkkkkkkkkk..',
    '....kssswsk.....',
    '....kwsssswk....',
    '.....kwwwwk.....',
];
const MAGE_TORSO = [
    '....kzkwwkzk....',
    '...kzZzkkzZzk...',
    '...kzZzzzzZzkk..',
    '...kzkzZZzzzksk.',
    '...kskzZZzzzkk..',
    '....kkbbbbbk....',
    '.....kzZZzzk....',
    '.....kzZZzzk....',
    '....kzzZZzzzk...',
];
const MAGE_ATTACK = [
    '....kzkwwkzk....',
    '...kzZzkkzZzk...',
    '...kzZzzzzZzkkk.',
    '...kzkzZZzzzkssk',
    '...kskzZZzzzkkk.',
    '....kkbbbbbk....',
    '.....kzZZzzk....',
    '.....kzZZzzk....',
    '....kzzZZzzzk...',
];

// Ноги мечника и лучника (цвет штанов и сапог у каждого свой — см. recolor).
const LEGS = {
    idle: [
        '......kllkllk...',
        '......kllkllk...',
        '......kllkllk...',
        '......kLLkLLk...',
        '......kLLkLLk...',
        '.....kkLLkLLLk..',
    ],
    run1: [
        '......kllkllk...',
        '.....kllkkllk...',
        '....kllk..kllk..',
        '...kLLk....kLLk.',
        '...kLLk....kLLLk',
        '...kkk.....kkkkk',
    ],
    run2: [
        '......kllkllk...',
        '......kllkllk...',
        '......kllkllk...',
        '.......kLkLLk...',
        '.......kkkLLLk..',
        '.........kkkkk..',
    ],
    run3: [
        '......kllkllk...',
        '.....kllkkllk...',
        '....kllk..kllk..',
        '...kLLk...kLLk..',
        '..kLLLk...kLLk..',
        '..kkkkk...kkkk..',
    ],
    jump: [
        '......kllkllk...',
        '.....kllkkllk...',
        '.....kLLk.kllk..',
        '.....kkkk.kLLk..',
        '..........kkkk..',
        '................',
    ],
    fall: [
        '......kllkllk...',
        '.....kllk.kllk..',
        '.....kllk.kllk..',
        '.....kLLk.kLLk..',
        '.....kLLk.kLLk..',
        '.....kkkk.kkkk..',
    ],
};

// Подол мантии мага вместо ног.
const ROBE = {
    idle: [
        '....kzzZZzzzk...',
        '....kzzZZzzzk...',
        '...kzzzZZzzzzk..',
        '...kzzzZZzzzzk..',
        '...kzzzzzzzzzk..',
        '...kkLLkkkLLkk..',
    ],
    run1: [
        '....kzzZZzzzk...',
        '....kzzZZzzzzk..',
        '...kzzzZZzzzzzk.',
        '...kzzzZZzzzzzk.',
        '..kzzzzzzzzzzk..',
        '..kLLkkkkkkLLLk.',
    ],
    run2: [
        '....kzzZZzzzk...',
        '....kzzZZzzzk...',
        '...kzzzZZzzzzk..',
        '...kzzzZZzzzzk..',
        '...kzzzzzzzzzk..',
        '....kkLLkLLkk...',
    ],
    run3: [
        '....kzzZZzzzk...',
        '...kzzzZZzzzk...',
        '..kzzzzZZzzzk...',
        '..kzzzzZZzzzzk..',
        '...kzzzzzzzzzk..',
        '....kkLLkLLkk...',
    ],
    jump: [
        '....kzzZZzzzk...',
        '...kzzzZZzzzzk..',
        '..kzzzzZZzzzzzk.',
        '..kzzkkzzzkkzzk.',
        '..kkk.kLLLk.kkk.',
        '.......kkk......',
    ],
    fall: [
        '....kzzZZzzzk...',
        '...kzzzZZzzzzk..',
        '..kzzzzZZzzzzzk.',
        '..kzzkkzzzkkzzk.',
        '..kkk.kLLLk.kkk.',
        '.......kkk......',
    ],
};

// Кадры героя: стойка, бег (три кадра), прыжок, падение, атака.
function figure(head, torso, attack, legs) {
    return {
        idle: [...head, ...torso, ...legs.idle],
        run1: [...head, ...torso, ...legs.run1],
        run2: [...head, ...torso, ...legs.run2],
        run3: [...head, ...torso, ...legs.run3],
        jump: [...head, ...torso, ...legs.jump],
        fall: [...head, ...torso, ...legs.fall],
        attack: [...head, ...attack, ...legs.idle],
    };
}

// recolor — цвета штанов (l) и сапог (L) класса.
export const HEROES = {
    swordsman: {
        recolor: { l: '#3a3f4a', L: '#7d8792' },
        frames: figure(SWORDSMAN_HEAD, SWORDSMAN_TORSO, SWORDSMAN_ATTACK, LEGS),
    },
    archer: {
        recolor: { l: '#4a3b2a', L: '#2b2433' },
        frames: figure(ARCHER_HEAD, ARCHER_TORSO, ARCHER_ATTACK, LEGS),
    },
    mage: {
        recolor: { L: '#4a3b2a' },
        frames: figure(MAGE_HEAD, MAGE_TORSO, MAGE_ATTACK, ROBE),
    },
};

const CAMPFIRE = [
    '....F.....',
    '...FfF....',
    '...fFf....',
    '..fFFFf...',
    '..rfFfr...',
    '.rffFffr..',
    '.rrfffrr..',
    '..rrrrr...',
    'kppkkkppk.',
    '.kpppppk..',
];

const SLIME_BODY = [
    '..kkjJJJjjkk..',
    '.kjJJjjjjjjjk.',
    'kjjjkjjjjkjjjk',
    'kjjjkjjjjkjjjk',
    'kjjjjjjjjjjjjk',
    'kjjqjjjjjjqjjk',
    'kqqqqqqqqqqqqk',
    '.kkkkkkkkkkkk.',
];

// Волк нарисован мордой вправо.
const WOLF_BODY = [
    '..............kk.k..',
    '.............kuukuk.',
    'k...........kuuuuuuk',
    'kk.kkkkkkkkkuuUuuruk',
    '.kkuUUUUUUUuuuuuuuuk',
    '.kuuUUUUUUuuuuuukkk.',
    '.kuuuuuuuuuuuuuuk...',
    '.kuuvvvvvvvvvvuuk...',
    '.kuuk.kkkkkk.kuuk...',
];

export const SPRITES = {
    groundTop: [
        'GGGGGGGGGGGGGGGG',
        'GgGGGgGGGGgGGGgG',
        'gggggggggggggggg',
        'gdggdgggdggggdgg',
        'dddddddddddddddd',
        'ddDddddddddDdddd',
        'dddddddedddddddd',
        'dddddddddddddddd',
        'dDdddddddddddded',
        'dddddeddddDddddd',
        'dddddddddddddddd',
        'ddddddddDddddddd',
        'deddddddddddeddd',
        'dddddDdddddddddd',
        'dddddddddddddddd',
        'ddddDdddddeddddd',
    ],

    ground: [
        'dddddddddddddddd',
        'ddDddddddddDdddd',
        'dddddddedddddddd',
        'dddddddddddddddd',
        'dDdddddddddddded',
        'dddddeddddDddddd',
        'dddddddddddddddd',
        'ddddddddDddddddd',
        'deddddddddddeddd',
        'dddddDdddddddddd',
        'dddddddddddddddd',
        'ddddDdddddeddddd',
        'dddddddddddddddd',
        'dddDddddddddDddd',
        'ddddddeddddddddd',
        'dddddddddddddddd',
    ],

    platform: [
        'PPPPPPPPPPPPPPPP',
        'pPpppppPpppppPpp',
        'pppppppppppppppp',
        'kpppkkkkkkkkpppk',
        '.kpk........kpk.',
        '..k..........k..',
    ],

    spikes: [
        '.X...X...X...X..',
        '.X...X...X...X..',
        'xXx.xXx.xXx.xXx.',
        'xXx.xXx.xXx.xXx.',
        'xXx.xXx.xXx.xXx.',
        'xXxxxXxxxXxxxXxx',
        'xXxxxXxxxXxxxXxx',
        'kkkkkkkkkkkkkkkk',
    ],

    coin: [
        '..oyyo..',
        '.oyYYyo.',
        'oyYyyyyo',
        'oyYyyyyo',
        'oyyyyyyo',
        'oyyyyyyo',
        '.oyyyyo.',
        '..oooo..',
    ],

    campfire: CAMPFIRE,
    campfireOff: CAMPFIRE.slice(8),

    portal: [
        '...nnnnnn...',
        '..nmmmmmmn..',
        '.nmmMMMMmmn.',
        '.nmMMMMMMmn.',
        'nmmMMmmMMmmn',
        'nmMMmmmmMMmn',
        'nmMMmmmmMMmn',
        'nmMMmmmmMMmn',
        'nmMMmmmmMMmn',
        'nmMMmmmmMMmn',
        'nmMMmmmmMMmn',
        'nmmMMmmMMmmn',
        'nmmMMMMMMmmn',
        'nmmmMMMMmmmn',
        'nnmmmmmmmmnn',
        'nnnnnnnnnnnn',
    ],

    // ---------- Оружие в руке героя (герой смотрит вправо) ----------
    sword: [
        '.X.', '.X.', '.X.', '.X.', '.X.', '.X.', '.X.', '.X.', '.x.',
        'bbb',
        '.p.', '.p.',
        '.k.',
    ],
    axe: [
        '.pXXX..',
        '.pxXXX.',
        '.pxxXXX',
        '.pxxXXX',
        '.pxXXX.',
        '.pXXX..',
        '.p.....', '.p.....', '.p.....', '.p.....', '.p.....', '.p.....', '.p.....',
        '.k.....',
    ],
    spear: [
        '.X.', '.X.', 'XXX', 'XXX', '.X.',
        '.p.', '.p.', '.p.', '.p.', '.p.', '.p.', '.p.', '.p.',
        '.p.', '.p.', '.p.', '.p.', '.p.', '.p.', '.p.', '.p.',
        '.k.',
    ],
    bow: [
        '..pp.',
        '.wPp.',
        'w..Pp',
        'w...p', 'w...p', 'w...p', 'w...p', 'w...p', 'w...p', 'w...p', 'w...p',
        'w..Pp',
        '.wPp.',
        '..pp.',
    ],
    shortbow: [
        '.pp.',
        'wPp.',
        'w.Pp',
        'w..p', 'w..p', 'w..p', 'w..p',
        'w.Pp',
        'wPp.',
        '.pp.',
    ],
    crossbow: [
        '......pk..',
        '.....kPk..',
        'kpppppPxX.',
        'kPPPPPPxXX',
        'kpppppPxX.',
        '.....kPk..',
        '......pk..',
    ],
    staffFire: [
        '..F..',
        '.fFf.',
        'rfFfr',
        '.rfr.',
        '..p..', '..p..', '..p..', '..p..', '..p..', '..p..', '..p..', '..p..',
        '..p..', '..p..', '..p..', '..p..', '..p..', '..p..', '..p..', '..p..',
        '..k..',
    ],
    staffIce: [
        '..O..',
        '.EOE.',
        'EOwOE',
        '.EOE.',
        '..p..', '..p..', '..p..', '..p..', '..p..', '..p..', '..p..', '..p..',
        '..p..', '..p..', '..p..', '..p..', '..p..', '..p..', '..p..', '..p..',
        '..k..',
    ],
    staffStorm: [
        'Y...Y',
        'y.Y.y',
        'y.w.y',
        '.yyy.',
        '..p..', '..p..', '..p..', '..p..', '..p..', '..p..', '..p..', '..p..',
        '..p..', '..p..', '..p..', '..p..', '..p..', '..p..', '..p..', '..p..',
        '..k..',
    ],

    // След от взмаха меча.
    slash: [
        '....ww......',
        '......ww....',
        '........w...',
        '.........w..',
        '..........w.',
        '..........ww',
        '..........Xw',
        '..........Xw',
        '..........Xw',
        '..........Xw',
        '..........Xw',
        '..........Xw',
        '..........ww',
        '..........w.',
        '.........w..',
        '........w...',
        '......ww....',
        '....ww......',
    ],

    // След выпада копьём.
    thrust: [
        '.................ww.',
        'wwwwwwwwwwwwwwwwwwww',
        '.................ww.',
    ],

    // ---------- Снаряды ----------
    arrow: [
        'w.....X.',
        'wpppppXX',
        'w.....X.',
    ],

    arrowBright: [
        'Y.....Y.',
        'YyyyyyYY',
        'Y.....Y.',
    ],

    quarrel: [
        '.....X.',
        'kppppXX',
        '.....X.',
    ],
    spearShot: [
        '.........XX.',
        'pppppppppXXX',
        '.........XX.',
    ],
    shard: [
        '..EOO..',
        'EEOOOOw',
        'EEOOOOw',
        '..EOO..',
    ],
    spark: [
        '.Y..Y...Y.',
        'YwYYwYYYwY',
        '..Y...Y...',
    ],

    // Слизень: высокий кадр и приплюснутый — вместе дают «дыхание».
    slime1: [
        '....kkkkkk....',
        SLIME_BODY[0],
        SLIME_BODY[1],
        '.kjJjjjjjjjjk.',
        ...SLIME_BODY.slice(2),
    ],
    slime2: ['..............', '....kkkkkk....', ...SLIME_BODY],

    wolf1: [
        ...WOLF_BODY,
        '.kvvk........kvvk...',
        '.kvvk........kvvk...',
        '.kkkk........kkkk...',
    ],
    wolf2: [
        ...WOLF_BODY,
        'kvvk..........kvvk..',
        'kvk............kvvk.',
        'kk..............kkk.',
    ],

    // Мешочек с предметом. Рамку цвета редкости рисует Renderer.
    lootBag: [
        '..kppk..',
        '...bb...',
        '.kppppk.',
        'kpPPpppk',
        'kpPppppk',
        'kppppppk',
        'kppppppk',
        '.kkkkkk.',
    ],

    // Огненный шар беса и Демона.
    fireball: [
        '.rffr.',
        'rfFFfr',
        'fFFFFf',
        'fFFFFf',
        'rfFFfr',
        '.rffr.',
    ],

    // Бес: два кадра — крылья вверх и вниз.
    imp1: [
        'c..........c',
        'cc.k....k.cc',
        'ccckkkkkkccc',
        '.cckrrrrkcc.',
        '..kwrrrrwk..',
        '..krrrrrrk..',
        '..krfrrfrk..',
        '...krrrrk...',
        '...kcrrck...',
        '....krrk....',
        '....k..k....',
        '...kk..kk...',
    ],
    imp2: [
        '............',
        '...k....k...',
        '...kkkkkk...',
        'c..krrrrk..c',
        'cckwrrrrwkcc',
        'cckrrrrrrkcc',
        '.ckrfrrfrkc.',
        '...krrrrk...',
        '...kcrrck...',
        '....krrk....',
        '....k..k....',
        '...kk..kk...',
    ],

    // Боссы рисуются увеличенными вдвое.
    treant: [
        '....gGGGGGg.....',
        '..gGGGgGGGGGg...',
        '.gGGgGGGGgGGGGg.',
        'gGGGGGgGGGGGgGGg',
        'gGgGGGGGGgGGGGGg',
        '.gGGGgGGGGGGgGg.',
        '..ggkkkkkkkkgg..',
        '...kpPPppppppk..',
        '..kpPFFppFFpppk.',
        '..kpPFkppFkpppk.',
        '..kpPppppppppek.',
        '.kkpPppkkkppppek',
        'kpkpPpkeeekpppek',
        'kpkpPppkkkpppekk',
        '.kkpPpppppppepk.',
        '..kpPpppppppepk.',
        '..kpPppppppppek.',
        '..kpPppppppppek.',
        '.kppPpppppppppek',
        '.kpPppkppkpppepk',
        'kpPpkk.kk.kkppek',
        'kkkkk.kk.kkkkkkk',
    ],

    demon: [
        '..X..............X..',
        '..XX............XX..',
        '...XXkkkkkkkkkkXX...',
        '....krrrrrrrrrrk....',
        'c...krFFrrrrFFrk...c',
        'cc..krFkrrrrFkrk..cc',
        'ccc.krrrrrrrrrrk.ccc',
        'cccckrrkkkkkkrrkcccc',
        'cccckrrkFkFkFkrkcccc',
        '.ccckrrrrrrrrrrkccc.',
        '..cckkrrrrrrrrkkcc..',
        '...ckcrrrrrrrrckc...',
        '....kcrrrrrrrrck....',
        '....kcrrrffrrrck....',
        '....kcrrffffrrck....',
        '.....kcrrrrrrck.....',
        '.....kcrrkkrrck.....',
        '....kcrrk..krrck....',
        '....kccrk..krcck....',
        '....kkkk....kkkk....',
    ],

    // Сердце рядом с полоской здоровья.
    heart: [
        '.rr.rr.',
        'rfrrrrr',
        'rrrrrrr',
        '.rrrrr.',
        '..rrr..',
        '...r...',
    ],

    // Корона — знак игры. Три зубца (1, 2, 3) золотятся по мере прохождения локаций.
    crown: [
        '..1.......2.......3..',
        '.111.....222.....333.',
        '.111.....222.....333.',
        '..1.......2.......3..',
        '..1k.....k2k.....k3..',
        '.k11k...k222k...k33k.',
        '.k111k.k22222k.k333k.',
        '.k1111k2222222k3333k.',
        '.kBBBBBBBBBBBBBBBBBk.',
        '.kBRBBBRBBBRBBBRBBBk.',
        '.kBBBBBBBBBBBBBBBBBk.',
        '.kkkkkkkkkkkkkkkkkkk.',
    ],

    // Значки брони и амулета для сумки (у оружия значок — его же спрайт).
    iconArmor: [
        '.xx....xx.',
        'xXXx..xXXx',
        'xXXXxxXXXx',
        '.xXXXXXXx.',
        '.xXXbbXXx.',
        '.xXXXXXXx.',
        '.xXXXXXXx.',
        '.xaXXXXax.',
        '..xaaaax..',
        '...xxxx...',
    ],
    iconAmulet: [
        '.y....y.',
        'y......y',
        'y......y',
        '.y....y.',
        '..y..y..',
        '...yy...',
        '..yRRy..',
        '.yRFFRy.',
        '..yRRy..',
        '...yy...',
    ],
};
