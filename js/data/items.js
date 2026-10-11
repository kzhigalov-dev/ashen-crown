// Снаряжение: редкости, свойства, названия, шансы выпадения.

// Порядок важен: индекс в массиве — «уровень» редкости.
//   forms   — название по родам: «редкий меч», «редкая секира», «редкое копьё»;
//   mult    — множитель чисел предмета;
//   affixes — сколько случайных свойств добавляется к базовому;
//   scrap   — сколько золота даёт разбор.
export const RARITIES = [
    { id: 'common', forms: { m: 'Обычный', f: 'Обычная', n: 'Обычное' }, mult: 1.0, affixes: 0, scrap: 2, color: '#b9ad98' },
    { id: 'rare', forms: { m: 'Редкий', f: 'Редкая', n: 'Редкое' }, mult: 1.3, affixes: 1, scrap: 6, color: '#5a8cff' },
    { id: 'epic', forms: { m: 'Эпический', f: 'Эпическая', n: 'Эпическое' }, mult: 1.7, affixes: 2, scrap: 15, color: '#c08bff' },
    { id: 'legendary', forms: { m: 'Легендарный', f: 'Легендарная', n: 'Легендарное' }, mult: 2.2, affixes: 3, scrap: 40, color: '#ffb23e' },
];

// Веса редкости по локациям: [обычный, редкий, эпический, легендарный].
export const RARITY_WEIGHTS = {
    forest: [70, 25, 5, 0],
    castle: [50, 35, 13, 2],
    dungeon: [30, 40, 22, 8],
};

// Чем дальше локация, тем сильнее предметы.
export const LOCATION_TIER = { forest: 1, castle: 2, dungeon: 3 };
export const TIER_MULT = { 1: 1, 2: 1.5, 3: 2.2 };

export const SLOTS = ['weapon', 'armor', 'amulet'];
export const SLOT_NAMES = { weapon: 'Оружие', armor: 'Броня', amulet: 'Амулет' };

// Названия брони и амулета. Виды оружия со своими названиями — в data/weapons.js.
export const ITEM_NAMES = { armor: 'доспех', amulet: 'амулет' };

// Свойства предметов. base — значение для обычного предмета первой локации.
export const STATS = {
    damage: { name: 'Урон', base: 4, unit: '' },
    hp: { name: 'Здоровье', base: 15, unit: '' },
    attackSpeed: { name: 'Скорость атаки', base: 6, unit: '%' },
    crit: { name: 'Шанс крита', base: 5, unit: '%' },
};
export const STAT_ORDER = ['damage', 'hp', 'attackSpeed', 'crit'];

// Базовое свойство слота. У амулета оно случайное.
export const SLOT_BASE_STAT = { weapon: 'damage', armor: 'hp' };

export const AFFIX_SCALE = 0.6;       // случайное свойство слабее базового
export const AMULET_SCALE = 1.5;      // базовое свойство амулета сильнее обычного
export const DROP_CHANCE = 0.15;      // шанс предмета с обычного врага
export const BOSS_MIN_RARITY = 1;     // с босса — не ниже редкого
export const INVENTORY_SIZE = 12;
export const CRIT_MULT = 2;
