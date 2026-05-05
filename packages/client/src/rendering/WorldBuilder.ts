import * as THREE from 'three';
import {
  Vec3,
  MAP_SIZE,
  getAllMapBoxes,
  BoxDef,
  SPAWN_POINTS,
} from '@dayzcopy/shared';
import { ClientPhysics } from '../physics/ClientPhysics';

export class WorldBuilder {
  structures: THREE.Mesh[] = [];

  build(scene: THREE.Scene, physics: ClientPhysics): void {
    this.createGround(scene, physics);
    this.createRoads(scene);
    this.createTrees(scene);
    this.createMapGeometry(scene, physics);
  }

  getSpawnPoints(): Vec3[] {
    return SPAWN_POINTS.map((p) => ({ ...p }));
  }

  private createGround(scene: THREE.Scene, physics: ClientPhysics): void {
    // Main ground plane with subtle color variation (grid of patches)
    const patchSize = 20;
    const patches = MAP_SIZE / patchSize;
    const groundGroup = new THREE.Group();

    for (let ix = 0; ix < patches; ix++) {
      for (let iz = 0; iz < patches; iz++) {
        const geo = new THREE.PlaneGeometry(patchSize, patchSize);
        // Slightly vary green shades
        const shade = 0.22 + Math.random() * 0.08;
        const color = new THREE.Color(shade * 0.4, shade, shade * 0.1);
        const mat = new THREE.MeshLambertMaterial({ color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(
          -MAP_SIZE / 2 + ix * patchSize + patchSize / 2,
          0,
          -MAP_SIZE / 2 + iz * patchSize + patchSize / 2
        );
        groundGroup.add(mesh);
      }
    }
    scene.add(groundGroup);

    // Single ground mesh for raycast
    const groundGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x3a5f0b, transparent: true, opacity: 0 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.01;
    scene.add(ground);
    this.structures.push(ground);

    physics.createGround();
  }

  private createRoads(scene: THREE.Scene): void {
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const roadWidth = 6;

    // Main north-south road
    const nsGeo = new THREE.PlaneGeometry(roadWidth, MAP_SIZE * 0.8);
    const nsRoad = new THREE.Mesh(nsGeo, roadMat);
    nsRoad.rotation.x = -Math.PI / 2;
    nsRoad.position.set(0, 0.02, 0);
    scene.add(nsRoad);

    // Main east-west road
    const ewGeo = new THREE.PlaneGeometry(MAP_SIZE * 0.8, roadWidth);
    const ewRoad = new THREE.Mesh(ewGeo, roadMat);
    ewRoad.rotation.x = -Math.PI / 2;
    ewRoad.position.set(0, 0.02, 0);
    scene.add(ewRoad);

    // Diagonal road connecting apartment tower to warehouse area
    const diagGeo = new THREE.PlaneGeometry(roadWidth, 180);
    const diagRoad = new THREE.Mesh(diagGeo, roadMat);
    diagRoad.rotation.x = -Math.PI / 2;
    diagRoad.rotation.z = Math.PI / 4;
    diagRoad.position.set(-20, 0.02, 10);
    scene.add(diagRoad);

    // Road markings (center lines)
    const markingMat = new THREE.MeshLambertMaterial({ color: 0xcccc00 });
    for (let i = -15; i <= 15; i++) {
      const markGeo = new THREE.PlaneGeometry(0.2, 4);
      const mark = new THREE.Mesh(markGeo, markingMat);
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(0, 0.03, i * 10);
      scene.add(mark);
    }
    for (let i = -15; i <= 15; i++) {
      const markGeo = new THREE.PlaneGeometry(4, 0.2);
      const mark = new THREE.Mesh(markGeo, markingMat);
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(i * 10, 0.03, 0);
      scene.add(mark);
    }
  }

  private createTrees(scene: THREE.Scene): void {
    // Visual trees (canopy spheres) - the trunks have colliders via mapData
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

    const canopyMat = new THREE.MeshLambertMaterial({ color: 0x2d6b2d });
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c3d1e });

    for (const pos of treePositions) {
      // Trunk visual
      const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 4, 6);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(pos.x, 2, pos.z);
      scene.add(trunk);

      // Canopy visual (no collider - visual only)
      const canopyGeo = new THREE.SphereGeometry(2.5, 8, 6);
      const canopy = new THREE.Mesh(canopyGeo, canopyMat);
      canopy.position.set(pos.x, 5.5, pos.z);
      scene.add(canopy);
    }
  }

  private createMapGeometry(scene: THREE.Scene, physics: ClientPhysics): void {
    const allBoxes = getAllMapBoxes();
    const materialCache = new Map<number, THREE.MeshLambertMaterial>();

    for (const box of allBoxes) {
      const color = box.color ?? 0x888888;
      let mat = materialCache.get(color);
      if (!mat) {
        mat = new THREE.MeshLambertMaterial({ color });
        materialCache.set(color, mat);
      }

      const geo = new THREE.BoxGeometry(
        box.halfW * 2,
        box.halfH * 2,
        box.halfD * 2
      );
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(box.x, box.y, box.z);
      scene.add(mesh);
      this.structures.push(mesh);

      physics.createBox(box.x, box.y, box.z, box.halfW, box.halfH, box.halfD);
    }
  }
}
