// Условные обозначения:
//   .  пусто            #  земля            =  платформа (можно запрыгнуть снизу)
//   ^  шипы             ~  лава             P  появление героя
//   C  костёр           o  золото           E  портал-выход
//   s  слизень          w  волк             z  скелет-мечник
//   a  скелет-лучник    i  бес              f  огненный столб
//   T  Древо-страж      K  Чёрный рыцарь    D  Демон
// Каждый сегмент — 17 строк по 20 символов. Уровень — сегменты слева направо,
// последний сегмент — арена босса с порталом.

const E = '....................';
const G = '####################';

// ---------- Проклятый лес ----------

const FOREST_START = [
    E, E, E, E, E, E, E, E, E, E, E, E, E,
    '..........o.o.o.....',
    '..P.............s...',
    G,
    G,
];

const FOREST_PLATFORMS = [
    E, E, E, E, E, E, E, E, E, E,
    '...........ooo......',
    '..........=====.....',
    E,
    '.....===.......o....',
    '.........s....###...',
    G,
    G,
];

const FOREST_PIT = [
    E, E, E, E, E, E, E, E, E, E, E, E,
    '........ooo.........',
    E,
    '..................w.',
    '########...#########',
    '########...#########',
];

const FOREST_SPIKES = [
    E, E, E, E, E, E, E, E, E, E, E, E,
    '...........oo.......',
    E,
    '...C.......^^...s...',
    G,
    G,
];

const FOREST_STAIRS = [
    E, E, E, E, E, E, E, E, E,
    '..............o.o...',
    '................w...',
    '............########',
    '............########',
    '........############',
    '....################',
    G,
    G,
];

const FOREST_CHASM = [
    E, E, E, E, E, E, E, E, E,
    '......o....o........',
    E,
    '####..==...==...####',
    '####............####',
    '####............####',
    '####............####',
    '####............####',
    '####............####',
];

const FOREST_DESCENT = [
    E, E, E, E, E, E, E, E, E, E, E,
    '####................',
    '####................',
    '########............',
    '########...C.s......',
    '################^^^#',
    G,
];

const FOREST_FINALE = [
    E, E, E, E, E, E, E, E, E, E,
    '...............ooo..',
    E,
    '..........o.........',
    '.........===........',
    '..........w..s......',
    G,
    G,
];

const FOREST_ARENA = [
    E, E, E, E, E, E, E, E, E, E, E, E, E, E,
    '............T....E..',
    G,
    G,
];

// ---------- Разрушенный замок ----------

const CASTLE_START = [
    E, E, E, E, E, E, E, E, E, E, E, E, E,
    '...........o.o......',
    '..P..............z..',
    G,
    G,
];

const CASTLE_BATTLEMENTS = [
    E, E, E, E, E, E, E, E, E, E,
    '..............o.....',
    E,
    '..............a.....',
    '.....o.......###....',
    '....###..^^..###....',
    G,
    G,
];

const CASTLE_BRIDGE = [
    E, E, E, E, E, E, E, E, E, E, E,
    '.......o....o.......',
    E,
    '......===..===......',
    '.................z..',
    '#####..........#####',
    '#####..........#####',
];

const CASTLE_STAIRS = [
    E, E, E, E, E, E, E, E, E,
    '..............o.o...',
    '.................a..',
    '............########',
    '.........z..########',
    '........############',
    '.C..################',
    G,
    G,
];

const CASTLE_WALKWAY = [
    E, E, E, E, E, E, E, E, E,
    '........o....o......',
    E,
    '######..==...==..###',
    '######...........###',
    '######...........###',
    '######...........###',
    '######^^^^^^^^^^^###',
    G,
];

const CASTLE_DESCENT = [
    E, E, E, E, E, E, E, E, E, E, E,
    '####................',
    '####......o.o.o.....',
    '########............',
    '########..C...z..z..',
    G,
    G,
];

const CASTLE_ARENA = [
    E, E, E, E, E, E, E, E, E, E, E, E, E, E,
    '............K....E..',
    G,
    G,
];

// ---------- Пылающее подземелье ----------

const DUNGEON_START = [
    E, E, E, E, E, E, E, E, E, E, E, E, E,
    '..........o.o.......',
    '..P..............z..',
    G,
    G,
];

const DUNGEON_POOLS = [
    E, E, E, E, E, E, E, E, E, E,
    '.........i..........',
    E,
    '......o......o......',
    E,
    '...f............f...',
    '#####~~~###~~~######',
    G,
];

const DUNGEON_LAKE = [
    E, E, E, E, E, E, E, E, E,
    '.......o.....o......',
    '..........i.........',
    '.......==....==.....',
    E,
    '....===...===..===..',
    E,
    '###~~~~~~~~~~~~~~###',
    G,
];

const DUNGEON_CORRIDOR = [
    E, E, E, E, E, E, E, E, E, E, E, E, E,
    '.......o.......o....',
    '.C...f...z...f...z..',
    G,
    G,
];

const DUNGEON_STAIRS = [
    E, E, E, E, E, E, E, E,
    '..............i.....',
    '..............o.o...',
    E,
    '............########',
    '............########',
    '........############',
    '....################',
    G,
    G,
];

const DUNGEON_CHASM = [
    E, E, E, E, E, E, E, E, E,
    '......o....o........',
    E,
    '####..==...==...####',
    '####............####',
    '####............####',
    '####............####',
    '####~~~~~~~~~~~~####',
    G,
];

const DUNGEON_DESCENT = [
    E, E, E, E, E, E, E, E, E, E, E,
    '####................',
    '####................',
    '########............',
    '########..C.........',
    G,
    G,
];

const DUNGEON_ARENA = [
    E, E, E, E, E, E, E, E, E, E, E, E, E, E,
    '............D....E..',
    G,
    G,
];

// boss — кто стережёт локацию (id из data/enemies.js).
// theme — оформление локации:
//   skyTop, skyBottom — градиент неба; sky — его средний тон (запасной);
//   far, mid, near    — три слоя силуэтов на фоне, от дальнего к ближнему;
//   backdrop          — вид силуэтов: trees (ели) или columns (колонны);
//   moon              — цвет луны или null; fog — цвет тумана;
//   particles         — что летает в воздухе: ash (пепел), dust (пыль), embers (искры);
//   tiles             — перекраска тайлов земли (ключи — символы палитры из data/sprites.js).
export const LEVELS = [
    {
        id: 'forest',
        name: 'Проклятый лес',
        boss: 'treant',
        theme: {
            sky: '#141b2b', skyTop: '#0b101c', skyBottom: '#26384c',
            far: '#15242b', mid: '#1a2f36', near: '#21403a',
            backdrop: 'trees', moon: '#d9e4d2', fog: '#8fb0b0', particles: 'ash', tiles: null,
        },
        segments: [
            FOREST_START, FOREST_PLATFORMS, FOREST_PIT, FOREST_SPIKES,
            FOREST_STAIRS, FOREST_CHASM, FOREST_DESCENT, FOREST_FINALE, FOREST_ARENA,
        ],
    },
    {
        id: 'castle',
        name: 'Разрушенный замок',
        boss: 'knight',
        theme: {
            sky: '#16161f', skyTop: '#0c0c14', skyBottom: '#2c2e44',
            far: '#191a24', mid: '#21232f', near: '#2b2d3a',
            backdrop: 'columns', moon: '#c9cde0', fog: '#9aa0b5', particles: 'dust',
            tiles: { G: '#9aa0ad', g: '#6a6f7d', d: '#4a4d5a', D: '#5f6372', e: '#3a3c48' },
        },
        segments: [
            CASTLE_START, CASTLE_BATTLEMENTS, CASTLE_BRIDGE, CASTLE_STAIRS,
            CASTLE_WALKWAY, CASTLE_DESCENT, CASTLE_ARENA,
        ],
    },
    {
        id: 'dungeon',
        name: 'Пылающее подземелье',
        boss: 'demon',
        theme: {
            sky: '#1a0f12', skyTop: '#0f0809', skyBottom: '#521812',
            far: '#200f11', mid: '#2c1315', near: '#3d1a18',
            backdrop: 'columns', moon: null, fog: '#e2572b', particles: 'embers',
            tiles: { G: '#a8492e', g: '#6e2f22', d: '#33201f', D: '#4a2a26', e: '#221514' },
        },
        segments: [
            DUNGEON_START, DUNGEON_POOLS, DUNGEON_LAKE, DUNGEON_CORRIDOR,
            DUNGEON_STAIRS, DUNGEON_CHASM, DUNGEON_DESCENT, DUNGEON_ARENA,
        ],
    },
];
