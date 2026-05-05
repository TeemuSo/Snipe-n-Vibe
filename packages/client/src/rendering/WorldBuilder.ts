import * as THREE from 'three';
import { Vec3, MAP_SIZE } from '@dayzcopy/shared';
import { ClientPhysics } from '../physics/ClientPhysics';

interface BuildingDef {
  x: number;
  z: number;
}

const BUILDING_POSITIONS: BuildingDef[] = [
  { x: -30, z: -30 },
  { x: 30, z: 30 },
  { x: -40, z: 40 },
  { x: 50, z: -20 },
  { x: 0, z: 60 },
  { x: -60, z: 0 },
];

export class WorldBuilder {
  structures: THREE.Mesh[] = [];

  build(scene: THREE.Scene, physics: ClientPhysics): void {
    this.createGround(scene, physics);
    this.createBuildings(scene, physics);
    this.createBarriers(scene, physics);
    this.createCrates(scene, physics);
  }

  getSpawnPoints(): Vec3[] {
    return [
      { x: -80, y: 0, z: -80 },
      { x: 80, y: 0, z: -80 },
      { x: -80, y: 0, z: 80 },
      { x: 80, y: 0, z: 80 },
      { x: 0, y: 0, z: -90 },
      { x: 0, y: 0, z: 90 },
      { x: -90, y: 0, z: 0 },
      { x: 90, y: 0, z: 0 },
    ];
  }

  private createGround(scene: THREE.Scene, physics: ClientPhysics): void {
    const groundGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x3a5f0b });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    scene.add(ground);
    this.structures.push(ground);

    physics.createGround();
  }

  private createBuildings(scene: THREE.Scene, physics: ClientPhysics): void {
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x888888 });

    for (const building of BUILDING_POSITIONS) {
      const { x, z } = building;
      const wallHeight = 4;
      const wallLength = 10;
      const wallThickness = 0.3;

      this.createWall(scene, physics, wallMat, x, wallHeight / 2, z - wallLength / 2, wallLength / 2, wallHeight / 2, wallThickness / 2);
      this.createWall(scene, physics, wallMat, x - wallLength / 2, wallHeight / 2, z, wallThickness / 2, wallHeight / 2, wallLength / 2);
      this.createWall(scene, physics, wallMat, x + wallLength / 2, wallHeight / 2, z, wallThickness / 2, wallHeight / 2, wallLength / 2);
    }
  }

  private createWall(
    scene: THREE.Scene,
    physics: ClientPhysics,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    halfW: number,
    halfH: number,
    halfD: number
  ): void {
    const geo = new THREE.BoxGeometry(halfW * 2, halfH * 2, halfD * 2);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    this.structures.push(mesh);

    physics.createBox(x, y, z, halfW, halfH, halfD);
  }

  private createBarriers(scene: THREE.Scene, physics: ClientPhysics): void {
    const barrierMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
    const barrierPositions: Vec3[] = [
      { x: 10, y: 0.6, z: -10 },
      { x: -15, y: 0.6, z: 15 },
      { x: 20, y: 0.6, z: 5 },
      { x: -25, y: 0.6, z: -5 },
      { x: 5, y: 0.6, z: 25 },
      { x: -10, y: 0.6, z: -25 },
      { x: 35, y: 0.6, z: -35 },
      { x: -35, y: 0.6, z: 35 },
      { x: 45, y: 0.6, z: 15 },
      { x: -50, y: 0.6, z: -15 },
    ];

    for (const pos of barrierPositions) {
      const halfW = 1;
      const halfH = 0.6;
      const halfD = 0.2;
      const geo = new THREE.BoxGeometry(halfW * 2, halfH * 2, halfD * 2);
      const mesh = new THREE.Mesh(geo, barrierMat);
      mesh.position.set(pos.x, pos.y, pos.z);
      scene.add(mesh);
      this.structures.push(mesh);

      physics.createBox(pos.x, pos.y, pos.z, halfW, halfH, halfD);
    }
  }

  private createCrates(scene: THREE.Scene, physics: ClientPhysics): void {
    const crateMat = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
    const cratePositions: Vec3[] = [
      { x: 15, y: 0.5, z: -20 },
      { x: -20, y: 0.5, z: 10 },
      { x: 25, y: 0.5, z: 25 },
      { x: -30, y: 0.5, z: -20 },
      { x: 15, y: 1.5, z: -20 },
      { x: -20, y: 1.5, z: 10 },
    ];

    for (const pos of cratePositions) {
      const half = 0.5;
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mesh = new THREE.Mesh(geo, crateMat);
      mesh.position.set(pos.x, pos.y, pos.z);
      scene.add(mesh);
      this.structures.push(mesh);

      physics.createBox(pos.x, pos.y, pos.z, half, half, half);
    }
  }
}
