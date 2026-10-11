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
export const JUMP_SPEED = 300;
export const MAX_FALL = 400;
export const COYOTE_TIME = 0.1;
export const JUMP_BUFFER = 0.1;
// Доля скорости прыжка, до которой он срезается, если клавишу отпустили
export const JUMP_CUT = 0.45;
// Сила прыжка в воздухе относительно обычного (двойной прыжок лучника)
export const AIR_JUMP_FACTOR = 0.9;

// Правила мира
export const HAZARD_DAMAGE = 20;
// Шипы нарисованы в нижней половине тайла: верхние 8 px тайла безопасны.
export const HAZARD_INSET = 8;
export const INVULN_TIME = 0.8;
export const COIN_VALUE = 5;
export const CAMERA_LERP = 8;
