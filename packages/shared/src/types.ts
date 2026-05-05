export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerState {
  id: number;
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  pitch: number;
  hp: number;
  ammo: number;
  isReloading: boolean;
  isSprinting: boolean;
  lastProcessedInput: number;
}

export interface InputPayload {
  seq: number;
  tick: number;
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  shoot: boolean;
  reload: boolean;
  yaw: number;
  pitch: number;
  deltaTime: number;
}

export interface WorldSnapshot {
  tick: number;
  timestamp: number;
  players: PlayerState[];
}

export interface ScoreEntry {
  id: number;
  name: string;
  kills: number;
  deaths: number;
}
