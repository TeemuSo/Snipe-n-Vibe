import { InputPayload, Vec3, WorldSnapshot, PlayerState, ScoreEntry } from './types';

export enum MessageType {
  CLIENT_INPUT = 1,
  SERVER_SNAPSHOT = 2,
  SERVER_PLAYER_HIT = 3,
  SERVER_PLAYER_DIED = 4,
  SERVER_PLAYER_JOIN = 5,
  SERVER_PLAYER_LEAVE = 6,
  CLIENT_SHOOT = 7,
  SERVER_SHOOT_CONFIRM = 8,
  SERVER_INIT = 9,
  SERVER_SCORES_UPDATE = 10,
  CLIENT_REQUEST_SCORES = 11,
}

const HEADER_SIZE = 3;

function writeHeader(view: DataView, type: MessageType, length: number): void {
  view.setUint8(0, type);
  view.setUint16(1, length, true);
}

function packInputBits(input: InputPayload): number {
  let bits = 0;
  if (input.forward) bits |= 1;
  if (input.backward) bits |= 2;
  if (input.left) bits |= 4;
  if (input.right) bits |= 8;
  if (input.jump) bits |= 16;
  if (input.sprint) bits |= 32;
  if (input.shoot) bits |= 64;
  if (input.reload) bits |= 128;
  return bits;
}

function unpackInputBits(bits: number): Pick<InputPayload, 'forward' | 'backward' | 'left' | 'right' | 'jump' | 'sprint' | 'shoot' | 'reload'> {
  return {
    forward: (bits & 1) !== 0,
    backward: (bits & 2) !== 0,
    left: (bits & 4) !== 0,
    right: (bits & 8) !== 0,
    jump: (bits & 16) !== 0,
    sprint: (bits & 32) !== 0,
    shoot: (bits & 64) !== 0,
    reload: (bits & 128) !== 0,
  };
}

export function encodeInput(input: InputPayload): ArrayBuffer {
  const payloadSize = 4 + 4 + 2 + 4 + 4 + 4;
  const totalSize = HEADER_SIZE + payloadSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  writeHeader(view, MessageType.CLIENT_INPUT, totalSize);

  let offset = HEADER_SIZE;
  view.setUint32(offset, input.seq, true); offset += 4;
  view.setUint32(offset, input.tick, true); offset += 4;
  view.setUint16(offset, packInputBits(input), true); offset += 2;
  view.setFloat32(offset, input.yaw, true); offset += 4;
  view.setFloat32(offset, input.pitch, true); offset += 4;
  view.setFloat32(offset, input.deltaTime, true); offset += 4;

  return buffer;
}

export function decodeInput(buffer: ArrayBuffer): InputPayload {
  const view = new DataView(buffer);
  let offset = HEADER_SIZE;

  const seq = view.getUint32(offset, true); offset += 4;
  const tick = view.getUint32(offset, true); offset += 4;
  const bits = view.getUint16(offset, true); offset += 2;
  const yaw = view.getFloat32(offset, true); offset += 4;
  const pitch = view.getFloat32(offset, true); offset += 4;
  const deltaTime = view.getFloat32(offset, true); offset += 4;

  return {
    seq,
    tick,
    ...unpackInputBits(bits),
    yaw,
    pitch,
    deltaTime,
  };
}

const PLAYER_RECORD_SIZE = 2 + 4 + 4 + 4 + 4 + 4 + 1 + 1 + 4;

export function encodeSnapshot(snapshot: WorldSnapshot, forPlayerId: number): ArrayBuffer {
  const playerCount = snapshot.players.length;
  const payloadSize = 4 + 8 + 1 + playerCount * PLAYER_RECORD_SIZE;
  const totalSize = HEADER_SIZE + payloadSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  writeHeader(view, MessageType.SERVER_SNAPSHOT, totalSize);

  let offset = HEADER_SIZE;
  view.setUint32(offset, snapshot.tick, true); offset += 4;
  view.setFloat64(offset, snapshot.timestamp, true); offset += 8;
  view.setUint8(offset, playerCount); offset += 1;

  for (let i = 0; i < playerCount; i++) {
    const p = snapshot.players[i];
    view.setUint16(offset, p.id, true); offset += 2;
    view.setFloat32(offset, p.position.x, true); offset += 4;
    view.setFloat32(offset, p.position.y, true); offset += 4;
    view.setFloat32(offset, p.position.z, true); offset += 4;
    view.setFloat32(offset, p.yaw, true); offset += 4;
    view.setFloat32(offset, p.pitch, true); offset += 4;
    view.setUint8(offset, p.hp); offset += 1;
    let flags = 0;
    if (p.isReloading) flags |= 1;
    if (p.isSprinting) flags |= 2;
    view.setUint8(offset, flags); offset += 1;
    view.setUint32(offset, p.lastProcessedInput, true); offset += 4;
  }

  return buffer;
}

export function decodeSnapshot(buffer: ArrayBuffer): WorldSnapshot & { lastProcessedInput: number } {
  const view = new DataView(buffer);
  let offset = HEADER_SIZE;

  const tick = view.getUint32(offset, true); offset += 4;
  const timestamp = view.getFloat64(offset, true); offset += 8;
  const playerCount = view.getUint8(offset); offset += 1;

  const players: PlayerState[] = [];
  let lastProcessedInput = 0;

  for (let i = 0; i < playerCount; i++) {
    const id = view.getUint16(offset, true); offset += 2;
    const x = view.getFloat32(offset, true); offset += 4;
    const y = view.getFloat32(offset, true); offset += 4;
    const z = view.getFloat32(offset, true); offset += 4;
    const yaw = view.getFloat32(offset, true); offset += 4;
    const pitch = view.getFloat32(offset, true); offset += 4;
    const hp = view.getUint8(offset); offset += 1;
    const flags = view.getUint8(offset); offset += 1;
    const playerLastInput = view.getUint32(offset, true); offset += 4;

    players.push({
      id,
      position: { x, y, z },
      velocity: { x: 0, y: 0, z: 0 },
      yaw,
      pitch,
      hp,
      ammo: 0,
      isReloading: (flags & 1) !== 0,
      isSprinting: (flags & 2) !== 0,
      lastProcessedInput: playerLastInput,
    });

    if (i === 0) lastProcessedInput = playerLastInput;
  }

  return { tick, timestamp, players, lastProcessedInput };
}

export function encodeShoot(seq: number, origin: Vec3, direction: Vec3, tick: number): ArrayBuffer {
  const payloadSize = 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4;
  const totalSize = HEADER_SIZE + payloadSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  writeHeader(view, MessageType.CLIENT_SHOOT, totalSize);

  let offset = HEADER_SIZE;
  view.setUint32(offset, seq, true); offset += 4;
  view.setFloat32(offset, origin.x, true); offset += 4;
  view.setFloat32(offset, origin.y, true); offset += 4;
  view.setFloat32(offset, origin.z, true); offset += 4;
  view.setFloat32(offset, direction.x, true); offset += 4;
  view.setFloat32(offset, direction.y, true); offset += 4;
  view.setFloat32(offset, direction.z, true); offset += 4;
  view.setUint32(offset, tick, true); offset += 4;

  return buffer;
}

export function decodeShoot(buffer: ArrayBuffer): { seq: number; origin: Vec3; direction: Vec3; tick: number } {
  const view = new DataView(buffer);
  let offset = HEADER_SIZE;

  const seq = view.getUint32(offset, true); offset += 4;
  const ox = view.getFloat32(offset, true); offset += 4;
  const oy = view.getFloat32(offset, true); offset += 4;
  const oz = view.getFloat32(offset, true); offset += 4;
  const dx = view.getFloat32(offset, true); offset += 4;
  const dy = view.getFloat32(offset, true); offset += 4;
  const dz = view.getFloat32(offset, true); offset += 4;
  const tick = view.getUint32(offset, true); offset += 4;

  return {
    seq,
    origin: { x: ox, y: oy, z: oz },
    direction: { x: dx, y: dy, z: dz },
    tick,
  };
}

export function encodeInit(playerId: number, snapshot: WorldSnapshot): ArrayBuffer {
  const snapshotBuffer = encodeSnapshot(snapshot, playerId);
  const snapshotPayload = new Uint8Array(snapshotBuffer, HEADER_SIZE);
  const payloadSize = 2 + snapshotPayload.byteLength;
  const totalSize = HEADER_SIZE + payloadSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  writeHeader(view, MessageType.SERVER_INIT, totalSize);

  let offset = HEADER_SIZE;
  view.setUint16(offset, playerId, true); offset += 2;
  bytes.set(snapshotPayload, offset);

  return buffer;
}

export function decodeInit(buffer: ArrayBuffer): { playerId: number; snapshot: WorldSnapshot } {
  const view = new DataView(buffer);
  let offset = HEADER_SIZE;

  const playerId = view.getUint16(offset, true); offset += 2;

  const remainingSize = buffer.byteLength - offset;
  const snapshotBuffer = new ArrayBuffer(HEADER_SIZE + remainingSize);
  const snapshotView = new DataView(snapshotBuffer);
  const snapshotBytes = new Uint8Array(snapshotBuffer);

  snapshotView.setUint8(0, MessageType.SERVER_SNAPSHOT);
  snapshotView.setUint16(1, HEADER_SIZE + remainingSize, true);
  snapshotBytes.set(new Uint8Array(buffer, offset), HEADER_SIZE);

  const decoded = decodeSnapshot(snapshotBuffer);
  return {
    playerId,
    snapshot: { tick: decoded.tick, timestamp: decoded.timestamp, players: decoded.players },
  };
}

export function encodePlayerHit(shooterId: number, targetId: number, damage: number): ArrayBuffer {
  const payloadSize = 2 + 2 + 1;
  const totalSize = HEADER_SIZE + payloadSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  writeHeader(view, MessageType.SERVER_PLAYER_HIT, totalSize);

  let offset = HEADER_SIZE;
  view.setUint16(offset, shooterId, true); offset += 2;
  view.setUint16(offset, targetId, true); offset += 2;
  view.setUint8(offset, damage); offset += 1;

  return buffer;
}

export function encodePlayerDied(deadId: number, killerId: number): ArrayBuffer {
  const payloadSize = 2 + 2;
  const totalSize = HEADER_SIZE + payloadSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  writeHeader(view, MessageType.SERVER_PLAYER_DIED, totalSize);

  let offset = HEADER_SIZE;
  view.setUint16(offset, deadId, true); offset += 2;
  view.setUint16(offset, killerId, true); offset += 2;

  return buffer;
}

export function encodePlayerJoin(id: number, position: Vec3): ArrayBuffer {
  const payloadSize = 2 + 4 + 4 + 4;
  const totalSize = HEADER_SIZE + payloadSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  writeHeader(view, MessageType.SERVER_PLAYER_JOIN, totalSize);

  let offset = HEADER_SIZE;
  view.setUint16(offset, id, true); offset += 2;
  view.setFloat32(offset, position.x, true); offset += 4;
  view.setFloat32(offset, position.y, true); offset += 4;
  view.setFloat32(offset, position.z, true); offset += 4;

  return buffer;
}

export function encodePlayerLeave(id: number): ArrayBuffer {
  const payloadSize = 2;
  const totalSize = HEADER_SIZE + payloadSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  writeHeader(view, MessageType.SERVER_PLAYER_LEAVE, totalSize);

  let offset = HEADER_SIZE;
  view.setUint16(offset, id, true); offset += 2;

  return buffer;
}

// hitType: 0 = miss, 1 = body hit, 2 = headshot
export function encodeShootConfirm(seq: number, hit: boolean, hitType: number = hit ? 1 : 0): ArrayBuffer {
  const payloadSize = 4 + 1;
  const totalSize = HEADER_SIZE + payloadSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  writeHeader(view, MessageType.SERVER_SHOOT_CONFIRM, totalSize);

  let offset = HEADER_SIZE;
  view.setUint32(offset, seq, true); offset += 4;
  view.setUint8(offset, hitType); offset += 1;

  return buffer;
}

function decodePlayerHit(buffer: ArrayBuffer): { shooterId: number; targetId: number; damage: number } {
  const view = new DataView(buffer);
  let offset = HEADER_SIZE;
  const shooterId = view.getUint16(offset, true); offset += 2;
  const targetId = view.getUint16(offset, true); offset += 2;
  const damage = view.getUint8(offset); offset += 1;
  return { shooterId, targetId, damage };
}

function decodePlayerDied(buffer: ArrayBuffer): { deadId: number; killerId: number } {
  const view = new DataView(buffer);
  let offset = HEADER_SIZE;
  const deadId = view.getUint16(offset, true); offset += 2;
  const killerId = view.getUint16(offset, true); offset += 2;
  return { deadId, killerId };
}

function decodePlayerJoin(buffer: ArrayBuffer): { id: number; position: Vec3 } {
  const view = new DataView(buffer);
  let offset = HEADER_SIZE;
  const id = view.getUint16(offset, true); offset += 2;
  const x = view.getFloat32(offset, true); offset += 4;
  const y = view.getFloat32(offset, true); offset += 4;
  const z = view.getFloat32(offset, true); offset += 4;
  return { id, position: { x, y, z } };
}

function decodePlayerLeave(buffer: ArrayBuffer): { id: number } {
  const view = new DataView(buffer);
  let offset = HEADER_SIZE;
  const id = view.getUint16(offset, true); offset += 2;
  return { id };
}

function decodeShootConfirm(buffer: ArrayBuffer): { seq: number; hit: boolean; hitType: number } {
  const view = new DataView(buffer);
  let offset = HEADER_SIZE;
  const seq = view.getUint32(offset, true); offset += 4;
  const hitType = view.getUint8(offset); offset += 1;
  return { seq, hit: hitType > 0, hitType };
}

export function encodeScoresUpdate(scores: ScoreEntry[]): ArrayBuffer {
  const encoder = new TextEncoder();
  // Calculate total size: header + playerCount(u8) + per player data
  let payloadSize = 1; // playerCount
  const encodedNames: Uint8Array[] = [];
  for (let i = 0; i < scores.length; i++) {
    const nameBytes = encoder.encode(scores[i].name);
    encodedNames.push(nameBytes);
    // id(u16) + kills(u16) + deaths(u16) + nameLength(u8) + name bytes
    payloadSize += 2 + 2 + 2 + 1 + nameBytes.byteLength;
  }

  const totalSize = HEADER_SIZE + payloadSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  writeHeader(view, MessageType.SERVER_SCORES_UPDATE, totalSize);

  let offset = HEADER_SIZE;
  view.setUint8(offset, scores.length); offset += 1;

  for (let i = 0; i < scores.length; i++) {
    const s = scores[i];
    const nameBytes = encodedNames[i];
    view.setUint16(offset, s.id, true); offset += 2;
    view.setUint16(offset, s.kills, true); offset += 2;
    view.setUint16(offset, s.deaths, true); offset += 2;
    view.setUint8(offset, nameBytes.byteLength); offset += 1;
    bytes.set(nameBytes, offset); offset += nameBytes.byteLength;
  }

  return buffer;
}

export function decodeScoresUpdate(buffer: ArrayBuffer): ScoreEntry[] {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder();
  let offset = HEADER_SIZE;

  const playerCount = view.getUint8(offset); offset += 1;
  const scores: ScoreEntry[] = [];

  for (let i = 0; i < playerCount; i++) {
    const id = view.getUint16(offset, true); offset += 2;
    const kills = view.getUint16(offset, true); offset += 2;
    const deaths = view.getUint16(offset, true); offset += 2;
    const nameLength = view.getUint8(offset); offset += 1;
    const name = decoder.decode(bytes.slice(offset, offset + nameLength));
    offset += nameLength;
    scores.push({ id, name, kills, deaths });
  }

  return scores;
}

export function encodeRequestScores(): ArrayBuffer {
  const totalSize = HEADER_SIZE;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  writeHeader(view, MessageType.CLIENT_REQUEST_SCORES, totalSize);
  return buffer;
}

export function decode(buffer: ArrayBuffer): { type: MessageType; data: any } {
  const view = new DataView(buffer);
  const type: MessageType = view.getUint8(0);

  switch (type) {
    case MessageType.CLIENT_INPUT:
      return { type, data: decodeInput(buffer) };
    case MessageType.SERVER_SNAPSHOT:
      return { type, data: decodeSnapshot(buffer) };
    case MessageType.SERVER_PLAYER_HIT:
      return { type, data: decodePlayerHit(buffer) };
    case MessageType.SERVER_PLAYER_DIED:
      return { type, data: decodePlayerDied(buffer) };
    case MessageType.SERVER_PLAYER_JOIN:
      return { type, data: decodePlayerJoin(buffer) };
    case MessageType.SERVER_PLAYER_LEAVE:
      return { type, data: decodePlayerLeave(buffer) };
    case MessageType.CLIENT_SHOOT:
      return { type, data: decodeShoot(buffer) };
    case MessageType.SERVER_SHOOT_CONFIRM:
      return { type, data: decodeShootConfirm(buffer) };
    case MessageType.SERVER_INIT:
      return { type, data: decodeInit(buffer) };
    case MessageType.SERVER_SCORES_UPDATE:
      return { type, data: decodeScoresUpdate(buffer) };
    case MessageType.CLIENT_REQUEST_SCORES:
      return { type, data: null };
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}
