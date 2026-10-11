// Классы героя. Класс задаёт здоровье, ману и то, каким оружием герой владеет.
// Атака (J) и способность (K) принадлежат оружию — см. data/weapons.js.
//   weapons — виды оружия класса; starter — с каким герой начинает.

export const CLASSES = {
    swordsman: {
        id: 'swordsman',
        name: 'Мечник',
        description: 'Бьётся вблизи и держит удар. Владеет мечом, секирой и копьём.',
        maxHp: 120,
        maxMana: 0,
        manaRegen: 0,
        extraJumps: 0,
        weapons: ['sword', 'axe', 'spear'],
        starter: 'sword',
    },
    archer: {
        id: 'archer',
        name: 'Лучник',
        description: 'Стреляет издалека и прыгает дважды. Владеет луком, арбалетом и коротким луком.',
        maxHp: 90,
        maxMana: 0,
        manaRegen: 0,
        extraJumps: 1,
        weapons: ['bow', 'crossbow', 'shortbow'],
        starter: 'bow',
    },
    mage: {
        id: 'mage',
        name: 'Маг',
        description: 'Хрупок, но сильнее всех на расстоянии. Заклинания тратят ману; посохи огня, льда и бури.',
        maxHp: 70,
        maxMana: 100,
        // В спецификации было 8: маг убивал босса втрое дольше остальных классов.
        manaRegen: 14,
        extraJumps: 0,
        weapons: ['fireStaff', 'iceStaff', 'stormStaff'],
        starter: 'fireStaff',
    },
};

export const CLASS_ORDER = ['swordsman', 'archer', 'mage'];
