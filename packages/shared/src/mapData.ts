/**
 * Shared map geometry data for the sniper map.
 * Both client (WorldBuilder) and server (PhysicsWorld) consume this
 * to ensure identical collider placement.
 */

import { Vec3 } from './types';

export interface BoxDef {
  x: number;
  y: number;
  z: number;
  halfW: number;
  halfH: number;
  halfD: number;
  /** Optional color hint for the client renderer (hex) */
  color?: number;
  /** Optional label for debugging */
  label?: string;
}

export interface MapData {
  terrain: BoxDef[];
  buildings: BoxDef[];
  cover: BoxDef[];
}

// ============================================================================
// TERRAIN
// ============================================================================

const TERRAIN: BoxDef[] = [
  // Raised concrete platform (40x40m, height 3m) in the NW quadrant
  { x: -100, y: 1.5, z: -100, halfW: 20, halfH: 1.5, halfD: 20, color: 0x999999, label: 'raised_platform' },
  // Ramp up to the platform (south side)
  { x: -100, y: 0.75, z: -79, halfW: 5, halfH: 0.75, halfD: 2, color: 0x888888, label: 'platform_ramp_s' },
  // Ramp up to the platform (east side)
  { x: -79, y: 0.75, z: -100, halfW: 2, halfH: 0.75, halfD: 5, color: 0x888888, label: 'platform_ramp_e' },

  // Sunken pit (20x20m, depth 2m) — modeled as walls around the pit edges
  // The pit floor is just ground level minus 2, but since we have a flat ground plane,
  // we simulate the pit with surrounding walls that block movement
  // Actually: create a lower floor inside the pit and raised edges
  { x: 60, y: -1, z: 60, halfW: 10, halfH: 1, halfD: 10, color: 0x555544, label: 'pit_floor' },
  // Pit north wall (lip)
  { x: 60, y: 0.5, z: 50, halfW: 10, halfH: 0.5, halfD: 0.3, color: 0x777766, label: 'pit_lip_n' },
  // Pit south wall (lip)
  { x: 60, y: 0.5, z: 70, halfW: 10, halfH: 0.5, halfD: 0.3, color: 0x777766, label: 'pit_lip_s' },
  // Pit west wall (lip)
  { x: 50, y: 0.5, z: 60, halfW: 0.3, halfH: 0.5, halfD: 10, color: 0x777766, label: 'pit_lip_w' },
  // Pit east wall (lip)
  { x: 70, y: 0.5, z: 60, halfW: 0.3, halfH: 0.5, halfD: 10, color: 0x777766, label: 'pit_lip_e' },
];

// ============================================================================
// BUILDINGS
// ============================================================================

function createApartmentTower(): BoxDef[] {
  const bx = -120, bz = -100;
  const boxes: BoxDef[] = [];
  const floorW = 4, floorD = 4; // half-extents of 8x8
  const wallThick = 0.15; // half-thickness
  const floorHeight = 3;
  const numFloors = 4;
  const color = 0x888888;

  for (let floor = 0; floor < numFloors; floor++) {
    const baseY = floor * floorHeight;
    const wallCenterY = baseY + floorHeight / 2;

    // Floor platform (except ground floor which uses ground)
    if (floor > 0) {
      boxes.push({ x: bx, y: baseY, z: bz, halfW: floorW, halfH: 0.1, halfD: floorD, color: 0x777777, label: `apt_floor_${floor}` });
    }

    // North wall - two segments with window gap in center
    // Wall spans Z = bz - floorD, from X = bx-floorW to bx+floorW
    // Window gap: 1.5m wide centered, 1.2m tall starting at 1m from floor
    const wallY = wallCenterY;
    const segLen = 1.5; // half-length of each side segment

    // North wall left segment
    boxes.push({ x: bx - 2.25, y: wallY, z: bz - floorD, halfW: segLen, halfH: floorHeight / 2, halfD: wallThick, color, label: `apt_n_wall_l_${floor}` });
    // North wall right segment
    boxes.push({ x: bx + 2.25, y: wallY, z: bz - floorD, halfW: segLen, halfH: floorHeight / 2, halfD: wallThick, color, label: `apt_n_wall_r_${floor}` });
    // North wall above window
    boxes.push({ x: bx, y: baseY + 2.6, z: bz - floorD, halfW: 0.75, halfH: 0.4, halfD: wallThick, color, label: `apt_n_wall_top_${floor}` });
    // North wall below window
    boxes.push({ x: bx, y: baseY + 0.5, z: bz - floorD, halfW: 0.75, halfH: 0.5, halfD: wallThick, color, label: `apt_n_wall_bot_${floor}` });

    // South wall - same pattern
    boxes.push({ x: bx - 2.25, y: wallY, z: bz + floorD, halfW: segLen, halfH: floorHeight / 2, halfD: wallThick, color, label: `apt_s_wall_l_${floor}` });
    boxes.push({ x: bx + 2.25, y: wallY, z: bz + floorD, halfW: segLen, halfH: floorHeight / 2, halfD: wallThick, color, label: `apt_s_wall_r_${floor}` });
    boxes.push({ x: bx, y: baseY + 2.6, z: bz + floorD, halfW: 0.75, halfH: 0.4, halfD: wallThick, color, label: `apt_s_wall_top_${floor}` });
    boxes.push({ x: bx, y: baseY + 0.5, z: bz + floorD, halfW: 0.75, halfH: 0.5, halfD: wallThick, color, label: `apt_s_wall_bot_${floor}` });

    // West wall
    boxes.push({ x: bx - floorW, y: wallY, z: bz - 2.25, halfW: wallThick, halfH: floorHeight / 2, halfD: segLen, color, label: `apt_w_wall_l_${floor}` });
    boxes.push({ x: bx - floorW, y: wallY, z: bz + 2.25, halfW: wallThick, halfH: floorHeight / 2, halfD: segLen, color, label: `apt_w_wall_r_${floor}` });
    boxes.push({ x: bx - floorW, y: baseY + 2.6, z: bz, halfW: wallThick, halfH: 0.4, halfD: 0.75, color, label: `apt_w_wall_top_${floor}` });
    boxes.push({ x: bx - floorW, y: baseY + 0.5, z: bz, halfW: wallThick, halfH: 0.5, halfD: 0.75, color, label: `apt_w_wall_bot_${floor}` });

    // East wall
    boxes.push({ x: bx + floorW, y: wallY, z: bz - 2.25, halfW: wallThick, halfH: floorHeight / 2, halfD: segLen, color, label: `apt_e_wall_l_${floor}` });
    boxes.push({ x: bx + floorW, y: wallY, z: bz + 2.25, halfW: wallThick, halfH: floorHeight / 2, halfD: segLen, color, label: `apt_e_wall_r_${floor}` });
    boxes.push({ x: bx + floorW, y: baseY + 2.6, z: bz, halfW: wallThick, halfH: 0.4, halfD: 0.75, color, label: `apt_e_wall_top_${floor}` });
    boxes.push({ x: bx + floorW, y: baseY + 0.5, z: bz, halfW: wallThick, halfH: 0.5, halfD: 0.75, color, label: `apt_e_wall_bot_${floor}` });
  }

  // External staircase (series of steps along the east side)
  for (let i = 0; i < 12; i++) {
    const stepY = (i + 1) * 1.0;
    const stepZ = bz - floorD + i * 0.7;
    boxes.push({ x: bx + floorW + 1.2, y: stepY, z: stepZ, halfW: 0.6, halfH: 0.1, halfD: 0.35, color: 0x666666, label: `apt_stair_${i}` });
  }

  return boxes;
}

function createWarehouse(): BoxDef[] {
  const bx = 80, bz = 120;
  const boxes: BoxDef[] = [];
  const color = 0x8b5e3c; // rusty brown

  // Roof
  boxes.push({ x: bx, y: 5, z: bz, halfW: 10, halfH: 0.15, halfD: 6, color, label: 'warehouse_roof' });

  // Back wall (north side, solid)
  boxes.push({ x: bx, y: 2.5, z: bz - 6, halfW: 10, halfH: 2.5, halfD: 0.15, color, label: 'warehouse_back_wall' });

  // Front wall (south side) - partial, with large opening
  boxes.push({ x: bx - 7.5, y: 2.5, z: bz + 6, halfW: 2.5, halfH: 2.5, halfD: 0.15, color, label: 'warehouse_front_l' });
  boxes.push({ x: bx + 7.5, y: 2.5, z: bz + 6, halfW: 2.5, halfH: 2.5, halfD: 0.15, color, label: 'warehouse_front_r' });

  // Support pillars (6 pillars, 3 per side)
  for (let i = 0; i < 3; i++) {
    const pz = bz - 4 + i * 4;
    boxes.push({ x: bx - 9.5, y: 2.5, z: pz, halfW: 0.25, halfH: 2.5, halfD: 0.25, color: 0x555555, label: `warehouse_pillar_l_${i}` });
    boxes.push({ x: bx + 9.5, y: 2.5, z: pz, halfW: 0.25, halfH: 2.5, halfD: 0.25, color: 0x555555, label: `warehouse_pillar_r_${i}` });
  }

  // Interior crates for close-range cover
  boxes.push({ x: bx - 4, y: 0.75, z: bz - 2, halfW: 1, halfH: 0.75, halfD: 0.75, color: 0x8b4513, label: 'warehouse_crate_1' });
  boxes.push({ x: bx + 3, y: 0.75, z: bz + 1, halfW: 1.2, halfH: 0.75, halfD: 0.6, color: 0x8b4513, label: 'warehouse_crate_2' });
  boxes.push({ x: bx + 5, y: 0.75, z: bz - 3, halfW: 0.75, halfH: 0.75, halfD: 1, color: 0x8b4513, label: 'warehouse_crate_3' });
  boxes.push({ x: bx - 2, y: 1.5, z: bz - 2, halfW: 0.6, halfH: 0.6, halfD: 0.6, color: 0x8b4513, label: 'warehouse_crate_4' });

  return boxes;
}

function createChurchTower(): BoxDef[] {
  const bx = 0, bz = -140;
  const boxes: BoxDef[] = [];
  const color = 0xeeeeee; // white
  const halfSize = 2.5;
  const wallThick = 0.15;
  const towerHeight = 15;
  const numLevels = 5;
  const levelHeight = towerHeight / numLevels;

  for (let level = 0; level < numLevels; level++) {
    const baseY = level * levelHeight;
    const centerY = baseY + levelHeight / 2;

    // Platform at each level (except ground)
    if (level > 0) {
      // Platform with a hole for jumping up - two halves
      boxes.push({ x: bx - 1.25, y: baseY, z: bz, halfW: 1.25, halfH: 0.1, halfD: halfSize, color: 0xcccccc, label: `church_plat_l_${level}` });
      boxes.push({ x: bx + 1.25, y: baseY, z: bz, halfW: 1.25, halfH: 0.1, halfD: halfSize, color: 0xcccccc, label: `church_plat_r_${level}` });
    }

    // North wall with small window
    const winHalfW = 0.3;
    boxes.push({ x: bx - 1.5, y: centerY, z: bz - halfSize, halfW: 1, halfH: levelHeight / 2, halfD: wallThick, color, label: `church_n_l_${level}` });
    boxes.push({ x: bx + 1.5, y: centerY, z: bz - halfSize, halfW: 1, halfH: levelHeight / 2, halfD: wallThick, color, label: `church_n_r_${level}` });
    boxes.push({ x: bx, y: baseY + 0.4, z: bz - halfSize, halfW: winHalfW, halfH: 0.4, halfD: wallThick, color, label: `church_n_bot_${level}` });
    boxes.push({ x: bx, y: baseY + levelHeight - 0.4, z: bz - halfSize, halfW: winHalfW, halfH: 0.4, halfD: wallThick, color, label: `church_n_top_${level}` });

    // South wall with small window
    boxes.push({ x: bx - 1.5, y: centerY, z: bz + halfSize, halfW: 1, halfH: levelHeight / 2, halfD: wallThick, color, label: `church_s_l_${level}` });
    boxes.push({ x: bx + 1.5, y: centerY, z: bz + halfSize, halfW: 1, halfH: levelHeight / 2, halfD: wallThick, color, label: `church_s_r_${level}` });
    boxes.push({ x: bx, y: baseY + 0.4, z: bz + halfSize, halfW: winHalfW, halfH: 0.4, halfD: wallThick, color, label: `church_s_bot_${level}` });
    boxes.push({ x: bx, y: baseY + levelHeight - 0.4, z: bz + halfSize, halfW: winHalfW, halfH: 0.4, halfD: wallThick, color, label: `church_s_top_${level}` });

    // West wall with small window
    boxes.push({ x: bx - halfSize, y: centerY, z: bz - 1.5, halfW: wallThick, halfH: levelHeight / 2, halfD: 1, color, label: `church_w_l_${level}` });
    boxes.push({ x: bx - halfSize, y: centerY, z: bz + 1.5, halfW: wallThick, halfH: levelHeight / 2, halfD: 1, color, label: `church_w_r_${level}` });
    boxes.push({ x: bx - halfSize, y: baseY + 0.4, z: bz, halfW: wallThick, halfH: 0.4, halfD: winHalfW, color, label: `church_w_bot_${level}` });
    boxes.push({ x: bx - halfSize, y: baseY + levelHeight - 0.4, z: bz, halfW: wallThick, halfH: 0.4, halfD: winHalfW, color, label: `church_w_top_${level}` });

    // East wall - door on ground floor, window on others
    if (level === 0) {
      // Door opening on east side - just side segments
      boxes.push({ x: bx + halfSize, y: centerY, z: bz - 1.5, halfW: wallThick, halfH: levelHeight / 2, halfD: 1, color, label: `church_e_l_${level}` });
      boxes.push({ x: bx + halfSize, y: centerY, z: bz + 1.5, halfW: wallThick, halfH: levelHeight / 2, halfD: 1, color, label: `church_e_r_${level}` });
      boxes.push({ x: bx + halfSize, y: baseY + 2.5, z: bz, halfW: wallThick, halfH: 0.5, halfD: 0.5, color, label: `church_e_top_${level}` });
    } else {
      boxes.push({ x: bx + halfSize, y: centerY, z: bz - 1.5, halfW: wallThick, halfH: levelHeight / 2, halfD: 1, color, label: `church_e_l_${level}` });
      boxes.push({ x: bx + halfSize, y: centerY, z: bz + 1.5, halfW: wallThick, halfH: levelHeight / 2, halfD: 1, color, label: `church_e_r_${level}` });
      boxes.push({ x: bx + halfSize, y: baseY + 0.4, z: bz, halfW: wallThick, halfH: 0.4, halfD: winHalfW, color, label: `church_e_bot_${level}` });
      boxes.push({ x: bx + halfSize, y: baseY + levelHeight - 0.4, z: bz, halfW: wallThick, halfH: 0.4, halfD: winHalfW, color, label: `church_e_top_${level}` });
    }
  }

  return boxes;
}

function createLShapedOffice(): BoxDef[] {
  const bx = 150, bz = -50;
  const boxes: BoxDef[] = [];
  const color = 0x99aaaa;
  const wallThick = 0.15;
  const storyH = 3;

  // L-shape: main leg 15m long (X) x 8m wide (Z), secondary leg 10m long (Z) x 8m wide (X)
  // Main leg: from bx-7.5 to bx+7.5, bz-4 to bz+4
  // Secondary leg: from bx+3.5 to bx+7.5 (continuing east), bz+4 to bz+14 (going south)
  // Wait, let's simplify:
  // Part A: 15m x 8m (halfW=7.5, halfD=4) centered at bx, bz
  // Part B: 8m x 10m (halfW=4, halfD=5) centered at bx+3.5, bz+9

  for (let floor = 0; floor < 2; floor++) {
    const baseY = floor * storyH;
    const wallY = baseY + storyH / 2;

    // Floor platform
    if (floor > 0) {
      boxes.push({ x: bx, y: baseY, z: bz, halfW: 7.5, halfH: 0.1, halfD: 4, color: 0x777777, label: `office_floorA_${floor}` });
      boxes.push({ x: bx + 3.5, y: baseY, z: bz + 9, halfW: 4, halfH: 0.1, halfD: 5, color: 0x777777, label: `office_floorB_${floor}` });
    }

    // Part A walls
    // North wall (with window on upper floor)
    if (floor === 1) {
      boxes.push({ x: bx - 4, y: wallY, z: bz - 4, halfW: 3.5, halfH: storyH / 2, halfD: wallThick, color, label: `office_a_n_l_${floor}` });
      boxes.push({ x: bx + 4, y: wallY, z: bz - 4, halfW: 3.5, halfH: storyH / 2, halfD: wallThick, color, label: `office_a_n_r_${floor}` });
      boxes.push({ x: bx, y: baseY + 2.5, z: bz - 4, halfW: 1, halfH: 0.5, halfD: wallThick, color, label: `office_a_n_top_${floor}` });
      boxes.push({ x: bx, y: baseY + 0.5, z: bz - 4, halfW: 1, halfH: 0.5, halfD: wallThick, color, label: `office_a_n_bot_${floor}` });
    } else {
      boxes.push({ x: bx, y: wallY, z: bz - 4, halfW: 7.5, halfH: storyH / 2, halfD: wallThick, color, label: `office_a_n_${floor}` });
    }

    // West wall of Part A
    if (floor === 1) {
      boxes.push({ x: bx - 7.5, y: wallY, z: bz - 2, halfW: wallThick, halfH: storyH / 2, halfD: 2, color, label: `office_a_w_l_${floor}` });
      boxes.push({ x: bx - 7.5, y: wallY, z: bz + 2, halfW: wallThick, halfH: storyH / 2, halfD: 2, color, label: `office_a_w_r_${floor}` });
      boxes.push({ x: bx - 7.5, y: baseY + 2.5, z: bz, halfW: wallThick, halfH: 0.5, halfD: 0.5, color, label: `office_a_w_top_${floor}` });
      boxes.push({ x: bx - 7.5, y: baseY + 0.5, z: bz, halfW: wallThick, halfH: 0.5, halfD: 0.5, color, label: `office_a_w_bot_${floor}` });
    } else {
      // Ground floor: door opening on west
      boxes.push({ x: bx - 7.5, y: wallY, z: bz - 2.5, halfW: wallThick, halfH: storyH / 2, halfD: 1.5, color, label: `office_a_w_l_${floor}` });
      boxes.push({ x: bx - 7.5, y: wallY, z: bz + 2.5, halfW: wallThick, halfH: storyH / 2, halfD: 1.5, color, label: `office_a_w_r_${floor}` });
      boxes.push({ x: bx - 7.5, y: baseY + 2.5, z: bz, halfW: wallThick, halfH: 0.5, halfD: 1, color, label: `office_a_w_top_${floor}` });
    }

    // South wall of Part A (partial - east section connects to Part B)
    boxes.push({ x: bx - 3.75, y: wallY, z: bz + 4, halfW: 3.75, halfH: storyH / 2, halfD: wallThick, color, label: `office_a_s_${floor}` });

    // East wall of Part A (north portion, above Part B connection)
    boxes.push({ x: bx + 7.5, y: wallY, z: bz - 2, halfW: wallThick, halfH: storyH / 2, halfD: 2, color, label: `office_a_e_${floor}` });

    // Part B walls
    // East wall of Part B
    if (floor === 1) {
      boxes.push({ x: bx + 7.5, y: wallY, z: bz + 6, halfW: wallThick, halfH: storyH / 2, halfD: 2, color, label: `office_b_e_l_${floor}` });
      boxes.push({ x: bx + 7.5, y: wallY, z: bz + 12, halfW: wallThick, halfH: storyH / 2, halfD: 2, color, label: `office_b_e_r_${floor}` });
      boxes.push({ x: bx + 7.5, y: baseY + 2.5, z: bz + 9, halfW: wallThick, halfH: 0.5, halfD: 0.5, color, label: `office_b_e_top_${floor}` });
      boxes.push({ x: bx + 7.5, y: baseY + 0.5, z: bz + 9, halfW: wallThick, halfH: 0.5, halfD: 0.5, color, label: `office_b_e_bot_${floor}` });
    } else {
      boxes.push({ x: bx + 7.5, y: wallY, z: bz + 9, halfW: wallThick, halfH: storyH / 2, halfD: 5, color, label: `office_b_e_${floor}` });
    }

    // South wall of Part B
    boxes.push({ x: bx + 3.5, y: wallY, z: bz + 14, halfW: 4, halfH: storyH / 2, halfD: wallThick, color, label: `office_b_s_${floor}` });

    // West wall of Part B
    boxes.push({ x: bx - 0.5, y: wallY, z: bz + 9, halfW: wallThick, halfH: storyH / 2, halfD: 5, color, label: `office_b_w_${floor}` });
  }

  // Roof
  boxes.push({ x: bx, y: 6, z: bz, halfW: 7.5, halfH: 0.1, halfD: 4, color: 0x555555, label: 'office_roofA' });
  boxes.push({ x: bx + 3.5, y: 6, z: bz + 9, halfW: 4, halfH: 0.1, halfD: 5, color: 0x555555, label: 'office_roofB' });

  // Roof edge barriers (waist height)
  boxes.push({ x: bx, y: 6.5, z: bz - 4, halfW: 7.5, halfH: 0.5, halfD: 0.1, color: 0x555555, label: 'office_roof_barrier_n' });
  boxes.push({ x: bx - 7.5, y: 6.5, z: bz, halfW: 0.1, halfH: 0.5, halfD: 4, color: 0x555555, label: 'office_roof_barrier_w' });

  return boxes;
}

function createGasStation(): BoxDef[] {
  const bx = -80, bz = 70;
  const boxes: BoxDef[] = [];
  const color = 0xaaaaaa;

  // Canopy roof (15m x 8m at 4m height)
  boxes.push({ x: bx, y: 4, z: bz, halfW: 7.5, halfH: 0.15, halfD: 4, color, label: 'gas_canopy' });

  // Support pillars (4 corners)
  boxes.push({ x: bx - 6.5, y: 2, z: bz - 3, halfW: 0.2, halfH: 2, halfD: 0.2, color: 0x444444, label: 'gas_pillar_1' });
  boxes.push({ x: bx + 6.5, y: 2, z: bz - 3, halfW: 0.2, halfH: 2, halfD: 0.2, color: 0x444444, label: 'gas_pillar_2' });
  boxes.push({ x: bx - 6.5, y: 2, z: bz + 3, halfW: 0.2, halfH: 2, halfD: 0.2, color: 0x444444, label: 'gas_pillar_3' });
  boxes.push({ x: bx + 6.5, y: 2, z: bz + 3, halfW: 0.2, halfH: 2, halfD: 0.2, color: 0x444444, label: 'gas_pillar_4' });

  // Cashier booth (enclosed, 3m x 3m x 2.5m)
  const cbx = bx + 5, cbz = bz - 2;
  boxes.push({ x: cbx, y: 1.25, z: cbz - 1.5, halfW: 1.5, halfH: 1.25, halfD: 0.1, color: 0x666677, label: 'gas_booth_n' });
  boxes.push({ x: cbx, y: 1.25, z: cbz + 1.5, halfW: 1.5, halfH: 1.25, halfD: 0.1, color: 0x666677, label: 'gas_booth_s' });
  boxes.push({ x: cbx - 1.5, y: 1.25, z: cbz, halfW: 0.1, halfH: 1.25, halfD: 1.5, color: 0x666677, label: 'gas_booth_w' });
  // East wall with door gap
  boxes.push({ x: cbx + 1.5, y: 1.25, z: cbz - 0.9, halfW: 0.1, halfH: 1.25, halfD: 0.6, color: 0x666677, label: 'gas_booth_e_l' });
  boxes.push({ x: cbx + 1.5, y: 2.0, z: cbz + 0.5, halfW: 0.1, halfH: 0.5, halfD: 0.6, color: 0x666677, label: 'gas_booth_e_r' });
  // Booth roof
  boxes.push({ x: cbx, y: 2.5, z: cbz, halfW: 1.5, halfH: 0.1, halfD: 1.5, color: 0x555555, label: 'gas_booth_roof' });

  // Gas pumps (as small boxes)
  boxes.push({ x: bx - 3, y: 0.6, z: bz, halfW: 0.3, halfH: 0.6, halfD: 0.2, color: 0xcc3333, label: 'gas_pump_1' });
  boxes.push({ x: bx - 1, y: 0.6, z: bz, halfW: 0.3, halfH: 0.6, halfD: 0.2, color: 0xcc3333, label: 'gas_pump_2' });
  boxes.push({ x: bx + 1, y: 0.6, z: bz, halfW: 0.3, halfH: 0.6, halfD: 0.2, color: 0xcc3333, label: 'gas_pump_3' });

  return boxes;
}

function createRuins(): BoxDef[] {
  const bx = 100, bz = -130;
  const boxes: BoxDef[] = [];
  const color = 0x887766;

  // Irregular half-walls at varying heights
  boxes.push({ x: bx - 4, y: 1.5, z: bz - 3, halfW: 2, halfH: 1.5, halfD: 0.2, color, label: 'ruins_wall_1' });
  boxes.push({ x: bx + 2, y: 1.0, z: bz - 4, halfW: 0.2, halfH: 1.0, halfD: 3, color, label: 'ruins_wall_2' });
  boxes.push({ x: bx + 5, y: 2.0, z: bz, halfW: 2.5, halfH: 2.0, halfD: 0.2, color, label: 'ruins_wall_3' });
  boxes.push({ x: bx - 1, y: 0.75, z: bz + 3, halfW: 3, halfH: 0.75, halfD: 0.2, color, label: 'ruins_wall_4' });
  boxes.push({ x: bx - 5, y: 1.25, z: bz + 1, halfW: 0.2, halfH: 1.25, halfD: 2, color, label: 'ruins_wall_5' });
  boxes.push({ x: bx + 3, y: 1.5, z: bz + 4, halfW: 0.2, halfH: 1.5, halfD: 2.5, color, label: 'ruins_wall_6' });
  boxes.push({ x: bx, y: 0.5, z: bz - 1, halfW: 1.5, halfH: 0.5, halfD: 1.5, color, label: 'ruins_rubble_1' });
  boxes.push({ x: bx - 3, y: 0.3, z: bz + 5, halfW: 1, halfH: 0.3, halfD: 1, color, label: 'ruins_rubble_2' });
  // A partially collapsed upper section
  boxes.push({ x: bx + 5, y: 4, z: bz, halfW: 2, halfH: 0.15, halfD: 1.5, color: 0x776655, label: 'ruins_slab' });

  return boxes;
}

function createShippingContainers(): BoxDef[] {
  const bx = -140, bz = -30;
  const boxes: BoxDef[] = [];
  const colors = [0x2255aa, 0xaa3322, 0x338833, 0xaaaa22, 0x884488, 0x228888];
  // Container dimensions: 6m x 2.5m x 2.5m (halfW=3, halfH=1.25, halfD=1.25)

  // Ground level containers
  boxes.push({ x: bx, y: 1.25, z: bz, halfW: 3, halfH: 1.25, halfD: 1.25, color: colors[0], label: 'container_1' });
  boxes.push({ x: bx, y: 1.25, z: bz + 3, halfW: 3, halfH: 1.25, halfD: 1.25, color: colors[1], label: 'container_2' });
  boxes.push({ x: bx + 7, y: 1.25, z: bz - 1, halfW: 3, halfH: 1.25, halfD: 1.25, color: colors[2], label: 'container_3' });
  boxes.push({ x: bx + 7, y: 1.25, z: bz + 2, halfW: 3, halfH: 1.25, halfD: 1.25, color: colors[3], label: 'container_4' });

  // Stacked containers (2-high)
  boxes.push({ x: bx, y: 3.75, z: bz, halfW: 3, halfH: 1.25, halfD: 1.25, color: colors[4], label: 'container_5_stacked' });
  boxes.push({ x: bx + 7, y: 3.75, z: bz + 2, halfW: 3, halfH: 1.25, halfD: 1.25, color: colors[5], label: 'container_6_stacked' });

  return boxes;
}

function createOverpass(): BoxDef[] {
  const bx = 0, by = 4, bz = 80;
  const boxes: BoxDef[] = [];
  const color = 0x777777;

  // Bridge deck (40m long along X, 6m wide along Z, 0.3m thick)
  boxes.push({ x: bx, y: by, z: bz, halfW: 20, halfH: 0.15, halfD: 3, color, label: 'overpass_deck' });

  // Support pillars (4 pillars underneath)
  for (let i = -1; i <= 1; i += 2) {
    boxes.push({ x: bx + i * 12, y: by / 2, z: bz - 2.5, halfW: 0.4, halfH: by / 2, halfD: 0.4, color: 0x555555, label: `overpass_pillar_${i}_l` });
    boxes.push({ x: bx + i * 12, y: by / 2, z: bz + 2.5, halfW: 0.4, halfH: by / 2, halfD: 0.4, color: 0x555555, label: `overpass_pillar_${i}_r` });
  }

  // Waist-height barriers on both sides (1m high from deck)
  boxes.push({ x: bx, y: by + 0.5, z: bz - 3, halfW: 20, halfH: 0.5, halfD: 0.15, color: 0x666666, label: 'overpass_barrier_n' });
  boxes.push({ x: bx, y: by + 0.5, z: bz + 3, halfW: 20, halfH: 0.5, halfD: 0.15, color: 0x666666, label: 'overpass_barrier_s' });

  // Ramp up (west side) - series of angled steps
  for (let i = 0; i < 8; i++) {
    const rx = bx - 20 - (i + 1) * 1.5;
    const ry = by - (i + 1) * 0.5;
    boxes.push({ x: rx, y: ry, z: bz, halfW: 0.75, halfH: 0.1, halfD: 3, color: 0x666666, label: `overpass_ramp_w_${i}` });
  }

  // Ramp up (east side) - series of angled steps
  for (let i = 0; i < 8; i++) {
    const rx = bx + 20 + (i + 1) * 1.5;
    const ry = by - (i + 1) * 0.5;
    boxes.push({ x: rx, y: ry, z: bz, halfW: 0.75, halfH: 0.1, halfD: 3, color: 0x666666, label: `overpass_ramp_e_${i}` });
  }

  return boxes;
}

// ============================================================================
// SCATTERED COVER
// ============================================================================

function createScatteredCover(): BoxDef[] {
  const boxes: BoxDef[] = [];

  // Jersey barriers (concrete barriers): 2m x 1.2m x 0.4m
  const barrierPositions: { x: number; z: number; rotated?: boolean }[] = [
    { x: -40, z: -40 },
    { x: -60, z: -60 },
    { x: 30, z: -70 },
    { x: -30, z: 90 },
    { x: 50, z: 50 },
    { x: -90, z: -20 },
    { x: 120, z: 40 },
    { x: -50, z: 140 },
    { x: 70, z: -60 },
    { x: -110, z: 50, rotated: true },
    { x: 130, z: -100, rotated: true },
    { x: -20, z: -170, rotated: true },
    { x: 40, z: 160, rotated: true },
  ];

  for (const pos of barrierPositions) {
    const halfW = pos.rotated ? 0.2 : 1;
    const halfD = pos.rotated ? 1 : 0.2;
    boxes.push({ x: pos.x, y: 0.6, z: pos.z, halfW, halfH: 0.6, halfD, color: 0x999999, label: 'barrier' });
  }

  // Burnt car hulks: ~4m x 2m x 1.5m
  const carPositions: { x: number; z: number; rotated?: boolean }[] = [
    { x: -30, z: -120 },
    { x: 60, z: -30, rotated: true },
    { x: -70, z: -80 },
    { x: 110, z: 90 },
    { x: -150, z: 70, rotated: true },
    { x: 20, z: 120 },
    { x: -100, z: -150 },
  ];

  for (const pos of carPositions) {
    const halfW = pos.rotated ? 1 : 2;
    const halfD = pos.rotated ? 2 : 1;
    boxes.push({ x: pos.x, y: 0.75, z: pos.z, halfW, halfH: 0.75, halfD, color: 0x333333, label: 'car_hulk' });
  }

  // Sandbag walls: 3m x 1m x 0.3m
  const sandbagPositions: { x: number; z: number; rotated?: boolean }[] = [
    { x: 0, z: -50 },
    { x: -80, z: -40, rotated: true },
    { x: 100, z: 0 },
    { x: -40, z: 120, rotated: true },
    { x: 50, z: -150 },
    { x: -160, z: -100 },
  ];

  for (const pos of sandbagPositions) {
    const halfW = pos.rotated ? 0.15 : 1.5;
    const halfD = pos.rotated ? 1.5 : 0.15;
    boxes.push({ x: pos.x, y: 0.5, z: pos.z, halfW, halfH: 0.5, halfD, color: 0x8b7d5b, label: 'sandbag' });
  }

  // Dumpsters: 2m x 1m x 1.2m
  const dumpsterPositions: { x: number; z: number }[] = [
    { x: -120, z: -60 },
    { x: 40, z: -100 },
    { x: -60, z: 150 },
    { x: 160, z: -30 },
  ];

  for (const pos of dumpsterPositions) {
    boxes.push({ x: pos.x, y: 0.6, z: pos.z, halfW: 1, halfH: 0.6, halfD: 0.5, color: 0x445544, label: 'dumpster' });
  }

  // Tree trunks (collision cylinders approximated as thin boxes)
  const treePositions: { x: number; z: number }[] = [
    { x: -150, z: -150 },
    { x: -130, z: -70 },
    { x: -50, z: -100 },
    { x: 30, z: -160 },
    { x: 90, z: -80 },
    { x: 140, z: -150 },
    { x: -170, z: 30 },
    { x: -100, z: 100 },
    { x: 50, z: 140 },
    { x: 130, z: 130 },
    { x: 170, z: 60 },
    { x: -30, z: 170 },
  ];

  for (const pos of treePositions) {
    // Trunk collider (thin tall box approximating cylinder)
    boxes.push({ x: pos.x, y: 2, z: pos.z, halfW: 0.25, halfH: 2, halfD: 0.25, color: 0x5c3d1e, label: 'tree_trunk' });
  }

  return boxes;
}

// ============================================================================
// EXPORT: Full map data
// ============================================================================

export function getMapData(): MapData {
  return {
    terrain: TERRAIN,
    buildings: [
      ...createApartmentTower(),
      ...createWarehouse(),
      ...createChurchTower(),
      ...createLShapedOffice(),
      ...createGasStation(),
      ...createRuins(),
      ...createShippingContainers(),
      ...createOverpass(),
    ],
    cover: createScatteredCover(),
  };
}

/** All collidable boxes in the map, flattened */
export function getAllMapBoxes(): BoxDef[] {
  const data = getMapData();
  return [...data.terrain, ...data.buildings, ...data.cover];
}

/** Spawn points spread across the 400m map */
export const SPAWN_POINTS: Vec3[] = [
  { x: -160, y: 0, z: -160 },
  { x: 160, y: 0, z: -160 },
  { x: -160, y: 0, z: 160 },
  { x: 160, y: 0, z: 160 },
  { x: 0, y: 0, z: -180 },
  { x: 0, y: 0, z: 180 },
  { x: -180, y: 0, z: 0 },
  { x: 180, y: 0, z: 0 },
  { x: -80, y: 0, z: -120 },
  { x: 80, y: 0, z: 120 },
  { x: 120, y: 0, z: -80 },
  { x: -120, y: 0, z: 80 },
];

/** Bot patrol points spread across the 400m map (all in open areas, away from buildings) */
export const BOT_PATROL_POINTS: Vec3[] = [
  { x: -40, y: 0, z: -40 },
  { x: 40, y: 0, z: -40 },
  { x: -40, y: 0, z: 40 },
  { x: 40, y: 0, z: 40 },
  { x: 10, y: 0, z: 15 },
  { x: -80, y: 0, z: 0 },
  { x: 80, y: 0, z: 0 },
  { x: 0, y: 0, z: -80 },
  { x: 0, y: 0, z: 60 },
  { x: -100, y: 0, z: -60 },
  { x: 100, y: 0, z: 60 },
  { x: -60, y: 0, z: 100 },
  { x: 60, y: 0, z: -100 },
  { x: -120, y: 0, z: 40 },
  { x: 120, y: 0, z: -40 },
  { x: -140, y: 0, z: -10 },
  { x: 80, y: 0, z: 120 },
  { x: 0, y: 0, z: -140 },
  { x: 165, y: 0, z: -50 },
  { x: -70, y: 0, z: 55 },
  { x: 115, y: 0, z: -130 },
  { x: 20, y: 0, z: 100 },
  { x: -160, y: 0, z: -100 },
  { x: 160, y: 0, z: 100 },
];
