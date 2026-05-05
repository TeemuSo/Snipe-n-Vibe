import * as THREE from 'three';
import { PLAYER_HEIGHT, PLAYER_RADIUS } from '@dayzcopy/shared';

export function createPlayerMesh(color: number = 0x888888): THREE.Group {
  const group = new THREE.Group();

  const bodyHeight = PLAYER_HEIGHT - 2 * PLAYER_RADIUS;
  const geometry = new THREE.CapsuleGeometry(PLAYER_RADIUS, bodyHeight, 8, 8);
  const material = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);

  group.add(mesh);
  return group;
}
