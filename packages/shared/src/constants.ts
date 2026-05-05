export const TICK_RATE = 30;
export const TICK_INTERVAL = 1000 / 30;

export const MOVE_SPEED = 5.0;
export const SPRINT_MULTIPLIER = 1.6;

export const JUMP_IMPULSE = 5.0;
export const JUMP_CUT_MULTIPLIER = 0.4; // velocity multiplier when releasing jump early
export const GRAVITY = -9.81;

export const PLAYER_HEIGHT = 1.8;
export const PLAYER_RADIUS = 0.3;

export const MAX_HP = 100;
export const WEAPON_DAMAGE = 75;
export const HEADSHOT_MULTIPLIER = 2.0;

export const FIRE_RATE = 40;
export const MAGAZINE_SIZE = 5;
export const RELOAD_TIME = 3500;

export const SCOPE_FOV = 15;
export const DEFAULT_FOV = 90;
export const SCOPE_SENSITIVITY_MULTIPLIER = 0.3;
export const SCOPE_SWAY_AMPLITUDE = 0.003;
export const SCOPE_SWAY_FREQUENCY = 0.7;
export const HOLD_BREATH_DURATION = 3000;
export const HOLD_BREATH_COOLDOWN = 5000;

export const MAX_INPUT_BUFFER = 64;

export const INTERPOLATION_DELAY = 100;
export const MAX_EXTRAPOLATION = 250;

export const MAP_SIZE = 400;

// Ballistics
export const BULLET_SPEED = 300; // m/s muzzle velocity
export const BULLET_GRAVITY = 9.81; // m/s² drop
export const BULLET_MAX_LIFETIME = 3000; // ms before bullet despawns
export const BULLET_MAX_DISTANCE = 500; // meters max range
