import * as THREE from 'three';
import { PLAYER_HEIGHT, PLAYER_RADIUS } from '@dayzcopy/shared';

/**
 * Creates a humanoid player mesh with separate head and body hitboxes.
 * Head and body meshes have userData.playerId and userData.isHead set
 * so the ShootingSystem can identify what was hit.
 */
export function createPlayerMesh(color: number = 0x888888): THREE.Group {
  const group = new THREE.Group();

  // Derive colors from base
  const headColor = new THREE.Color(color).offsetHSL(0, 0, 0.15).getHex();
  const limbColor = new THREE.Color(color).offsetHSL(0, 0, -0.2).getHex();

  // --- Head (sphere) ---
  const headRadius = 0.15;
  const headY = PLAYER_HEIGHT / 2 - headRadius; // relative to group center
  const headGeo = new THREE.SphereGeometry(headRadius, 10, 8);
  const headMat = new THREE.MeshLambertMaterial({ color: headColor });
  const headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.position.set(0, headY, 0);
  headMesh.userData.isHead = true;
  headMesh.name = 'head';
  group.add(headMesh);

  // --- Body/Torso (box) ---
  const torsoWidth = 0.4;
  const torsoHeight = 0.7;
  const torsoDepth = 0.25;
  const torsoY = PLAYER_HEIGHT * 0.55 - PLAYER_HEIGHT / 2; // relative to group center
  const torsoGeo = new THREE.BoxGeometry(torsoWidth, torsoHeight, torsoDepth);
  const torsoMat = new THREE.MeshLambertMaterial({ color });
  const torsoMesh = new THREE.Mesh(torsoGeo, torsoMat);
  torsoMesh.position.set(0, torsoY, 0);
  torsoMesh.userData.isHead = false;
  torsoMesh.name = 'body';
  group.add(torsoMesh);

  // --- Legs (two cylinders, visual only - not hittable separately) ---
  const legRadius = 0.08;
  const legHeight = 0.8;
  const legY = -PLAYER_HEIGHT / 2 + legHeight / 2 + 0.02; // just above bottom
  const legGeo = new THREE.CylinderGeometry(legRadius, legRadius, legHeight, 6);
  const legMat = new THREE.MeshLambertMaterial({ color: limbColor });

  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.1, legY, 0);
  leftLeg.userData.isHead = false;
  leftLeg.name = 'leg-left';
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.position.set(0.1, legY, 0);
  rightLeg.userData.isHead = false;
  rightLeg.name = 'leg-right';
  group.add(rightLeg);

  // --- Arms (two boxes, slight outward angle) ---
  const armWidth = 0.12;
  const armHeight = 0.6;
  const armDepth = 0.12;
  const armY = torsoY + 0.05;
  const armGeo = new THREE.BoxGeometry(armWidth, armHeight, armDepth);
  const armMat = new THREE.MeshLambertMaterial({ color: limbColor });

  const leftArm = new THREE.Mesh(armGeo, armMat);
  leftArm.position.set(-(torsoWidth / 2 + armWidth / 2 + 0.02), armY, 0);
  leftArm.rotation.z = 0.1; // slight outward angle
  leftArm.userData.isHead = false;
  leftArm.name = 'arm-left';
  group.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, armMat);
  rightArm.position.set(torsoWidth / 2 + armWidth / 2 + 0.02, armY, 0);
  rightArm.rotation.z = -0.1; // slight outward angle
  rightArm.userData.isHead = false;
  rightArm.name = 'arm-right';
  group.add(rightArm);

  return group;
}
