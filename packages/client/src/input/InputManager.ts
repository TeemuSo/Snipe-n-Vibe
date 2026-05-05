export interface InputSnapshot {
  dx: number;
  dy: number;
  keys: Set<string>;
  mouseLeftDown: boolean;
  mouseRightDown: boolean;
}

export class InputManager {
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private keys = new Set<string>();
  private mouseLeftDown = false;
  private mouseRightDown = false;
  private canvas: HTMLCanvasElement | null = null;
  sensitivity = 0.002;

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isLocked()) return;
      this.mouseDeltaX += e.movementX;
      this.mouseDeltaY += e.movementY;
    });

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      this.keys.add(e.code);
    });

    document.addEventListener('keyup', (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    });

    document.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button === 0) this.mouseLeftDown = true;
      if (e.button === 2) this.mouseRightDown = true;
    });

    document.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button === 0) this.mouseLeftDown = false;
      if (e.button === 2) this.mouseRightDown = false;
    });
  }

  poll(): InputSnapshot {
    const dx = this.mouseDeltaX;
    const dy = this.mouseDeltaY;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return {
      dx,
      dy,
      keys: new Set(this.keys),
      mouseLeftDown: this.mouseLeftDown,
      mouseRightDown: this.mouseRightDown,
    };
  }

  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  requestPointerLock(): void {
    this.canvas?.requestPointerLock();
  }

  isLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }
}
