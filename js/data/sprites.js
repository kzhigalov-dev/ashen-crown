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
};

const HERO_TOP = [
    '...kkkkk....',
    '..khhhhhk...',
    '.khhHHHhhk..',
    '.khHHHHHhk..',
    '.khhssssk...',
    '.khsswskk...',
    '.khssssk....',
    '..kkssk.....',
    '.kccccck....',
    'kcCCcccck...',
    'kcCCccccsk..',
    'kcCCcccck...',
    'kccccccck...',
    '.kbbbbbk....',
    '.kccccck....',
    '.kccccck....',
];

const LEGS_IDLE = [
    '.kllkllk....',
    '.kllkllk....',
    '.kllkllk....',
    '.kllkllk....',
    '.kLLkLLk....',
    '.kkkkkkk....',
];

const LEGS_RUN1 = [
    '.kllkkllk...',
    'kllk..kllk..',
    'kllk..kllk..',
    'kLLk...kllk.',
    'kkkk...kLLk.',
    '.......kkkk.',
];

const LEGS_RUN2 = [
    '.kllllk.....',
    '..kllk......',
    '..kllk......',
    '..kllkk.....',
    '..kLLLk.....',
    '..kkkkk.....',
];

const LEGS_JUMP = [
    '.kllkllk....',
    'kllk.kllk...',
    'kLLk.kllk...',
    'kkkk.kLLk...',
    '.....kkkk...',
    '............',
];

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
    heroIdle: [...HERO_TOP, ...LEGS_IDLE],
    heroRun1: [...HERO_TOP, ...LEGS_RUN1],
    heroRun2: [...HERO_TOP, ...LEGS_RUN2],
    heroJump: [...HERO_TOP, ...LEGS_JUMP],

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

    // Оружие в руке героя (герой смотрит вправо).
    sword: [
        '.X.',
        '.X.',
        '.X.',
        '.X.',
        '.X.',
        '.X.',
        '.X.',
        '.X.',
        'bbb',
        '.p.',
        '.p.',
        '.k.',
    ],

    bow: [
        '.p..',
        'wPp.',
        'w.Pp',
        'w..p',
        'w..p',
        'w..p',
        'w..p',
        'w..p',
        'w..p',
        'w.Pp',
        'wPp.',
        '.p..',
    ],

    staff: [
        '.M.',
        'MwM',
        '.M.',
        '.p.',
        '.p.',
        '.p.',
        '.p.',
        '.p.',
        '.p.',
        '.p.',
        '.p.',
        '.p.',
        '.p.',
        '.p.',
        '.p.',
        '.p.',
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

    bolt: [
        '.mMMm.',
        'mMwwMm',
        'MwwwwM',
        'MwwwwM',
        'mMwwMm',
        '.mMMm.',
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
};
