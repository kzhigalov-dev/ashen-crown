// Экран
export const TILE = 16;
export const VIEW_W = 480;
export const VIEW_H = 270;

// Игровой цикл
export const STEP = 1 / 60;
export const MAX_FRAME = 0.1;

// Движение героя (пиксели и секунды)
export const GRAVITY = 900;
export const RUN_SPEED = 110;
// Разгон и торможение героя (px/с²): на земле резче, в воздухе мягче
export const RUN_ACCEL = 1400;
export const AIR_ACCEL = 1000;
export const JUMP_SPEED = 300;
export const MAX_FALL = 400;
export const COYOTE_TIME = 0.1;
export const JUMP_BUFFER = 0.1;
// Доля скорости прыжка, до которой он срезается, если клавишу отпустили
export const JUMP_CUT = 0.45;
// Сила прыжка в воздухе относительно обычного (двойной прыжок лучника)
export const AIR_JUMP_FACTOR = 0.9;

// Правила мира
export const HAZARD_DAMAGE = 15;
// Шипы нарисованы в нижней половине тайла: верхние 8 px тайла безопасны.
export const HAZARD_INSET = 8;
export const INVULN_TIME = 1;
export const COIN_VALUE = 5;
export const CAMERA_LERP = 8;
// Сколько секунд на экране висит название подобранного предмета
export const NOTICE_TIME = 2;

// Ощущение игры
export const DEATH_TIME = 0.8;     // пауза между гибелью героя и экраном поражения
export const INTRO_TIME = 2.4;     // заставка с названием локации в начале уровня
export const BANNER_TIME = 3.2;    // сколько висит объявление о боссе
export const LORE_TIME = 4.5;      // сколько видна записка у костра
export const SHAKE_DECAY = 24;     // на сколько пикселей в секунду затухает тряска
export const HITSTOP = 0.02;       // замирание кадра при ударе ближнего боя
export const RECOIL_TIME = 0.45;   // на сколько враг отскакивает после того, как ранил героя
// Сердце, выпадающее из врагов: шанс и сколько лечит
export const HEART_CHANCE = 0.12;
export const HEART_HEAL = 20;
export const HURT_FLASH = 0.3;     // красная вспышка при уроне герою
// Сколько слизней босс может держать призванными одновременно
export const MAX_SUMMONED = 2;
// Огненные столбы подземелья: период срабатывания и урон
export const PILLAR_PERIOD = 2.6;
export const PILLAR_DAMAGE = 10;
