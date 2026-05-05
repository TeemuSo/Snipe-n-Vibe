export interface InputSnapshot {
  dx: number;
  dy: number;
  keys: Set<string>;
  mouseDown: boolean;
}

export class InputManager {
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private keys = new Set<string>();
  private mouseDown = false;
  private canvas: HTMLCanvasElement | null = null;
  sensitivity = 0.002;

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;

    canvas.addEventListener('click', () => {
      this.requestPointerLock();
    });

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

    document.addEventListener('mousedown', () => {
      this.mouseDown = true;
    });

    document.addEventListener('mouseup', () => {
      this.mouseDown = false;
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
      mouseDown: this.mouseDown,
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
