import * as THREE from 'three';

/**
 * Creates a proper connected humanoid player mesh that looks like a soldier.
 * All parts are positioned relative to a group where Y=0 is the feet.
 * Head mesh has userData.isHead = true for headshot detection.
 */
export function createPlayerMesh(color?: number): THREE.Group {
  const group = new THREE.Group();

  // Color scheme
  const skinColor = 0xD2A679;
  const torsoColor = color ?? 0x3D4F2F; // dark olive tactical
  const pantsColor = 0x2A3525;
  const bootsColor = 0x1A1A1A;

  // --- Boots ---
  const bootGeo = new THREE.BoxGeometry(0.1, 0.05, 0.15);
  const bootMat = new THREE.MeshLambertMaterial({ color: bootsColor });

  const leftBoot = new THREE.Mesh(bootGeo, bootMat);
  leftBoot.position.set(-0.08, 0.025, 0.02);
  leftBoot.userData.isHead = false;
  leftBoot.name = 'boot-left';
  group.add(leftBoot);

  const rightBoot = new THREE.Mesh(bootGeo, bootMat);
  rightBoot.position.set(0.08, 0.025, 0.02);
  rightBoot.userData.isHead = false;
  rightBoot.name = 'boot-right';
  group.add(rightBoot);

  // --- Legs ---
  const legGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.8, 8);
  const legMat = new THREE.MeshLambertMaterial({ color: pantsColor });

  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.08, 0.45, 0);
  leftLeg.userData.isHead = false;
  leftLeg.name = 'leg-left';
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.position.set(0.08, 0.45, 0);
  rightLeg.userData.isHead = false;
  rightLeg.name = 'leg-right';
  group.add(rightLeg);

  // --- Lower Torso ---
  const lowerTorsoGeo = new THREE.BoxGeometry(0.3, 0.25, 0.18);
  const lowerTorsoMat = new THREE.MeshLambertMaterial({ color: torsoColor });
  const lowerTorso = new THREE.Mesh(lowerTorsoGeo, lowerTorsoMat);
  lowerTorso.position.set(0, 0.95, 0);
  lowerTorso.userData.isHead = false;
  lowerTorso.name = 'torso-lower';
  group.add(lowerTorso);

  // --- Upper Torso ---
  const upperTorsoGeo = new THREE.BoxGeometry(0.35, 0.3, 0.2);
  const upperTorsoMat = new THREE.MeshLambertMaterial({ color: torsoColor });
  const upperTorso = new THREE.Mesh(upperTorsoGeo, upperTorsoMat);
  upperTorso.position.set(0, 1.2, 0);
  upperTorso.userData.isHead = false;
  upperTorso.name = 'torso-upper';
  group.add(upperTorso);

  // --- Arms ---
  const armGeo = new THREE.CylinderGeometry(0.055, 0.05, 0.55, 8);
  const armMat = new THREE.MeshLambertMaterial({ color: torsoColor });

  const leftArm = new THREE.Mesh(armGeo, armMat);
  leftArm.position.set(-0.23, 1.1, 0);
  leftArm.rotation.z = 0.12; // slight outward angle (at ease)
  leftArm.userData.isHead = false;
  leftArm.name = 'arm-left';
  group.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, armMat);
  rightArm.position.set(0.23, 1.1, 0);
  rightArm.rotation.z = -0.12; // slight outward angle (at ease)
  rightArm.userData.isHead = false;
  rightArm.name = 'arm-right';
  group.add(rightArm);

  // --- Neck ---
  const neckGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8);
  const neckMat = new THREE.MeshLambertMaterial({ color: skinColor });
  const neck = new THREE.Mesh(neckGeo, neckMat);
  neck.position.set(0, 1.4, 0);
  neck.userData.isHead = false;
  neck.name = 'neck';
  group.add(neck);

  // --- Head ---
  const headGeo = new THREE.SphereGeometry(0.12, 12, 8);
  const headMat = new THREE.MeshLambertMaterial({ color: skinColor });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0, 1.55, 0);
  head.userData.isHead = true;
  head.name = 'head';
  group.add(head);

  // No shadows in this game
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });

  return group;
}
