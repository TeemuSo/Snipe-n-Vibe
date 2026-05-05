import * as THREE from 'three';

export class Renderer {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 50, 200);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 100, 50);
    this.scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    window.addEventListener('resize', () => this.handleResize());
  }

  render(camera: THREE.PerspectiveCamera): void {
    this.renderer.render(this.scene, camera);
  }

  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  private handleResize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
