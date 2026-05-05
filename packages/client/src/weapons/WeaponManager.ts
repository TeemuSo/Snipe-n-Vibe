import { FIRE_RATE, MAGAZINE_SIZE, RELOAD_TIME } from '@dayzcopy/shared';

export class WeaponManager {
  private ammo: number = MAGAZINE_SIZE;
  private isReloading: boolean = false;
  private reloadStartTime: number = 0;
  private lastFireTime: number = 0;
  private fireInterval: number = 60000 / FIRE_RATE; // 1500ms for 40 RPM
  private shotsFired: number = 0;
  private lastShotTime: number = 0;

  // Scope state
  isScoped: boolean = false;
  private scopeTransitionStart: number = 0;
  private scopeTransitionDuration: number = 200;

  canFire(): boolean {
    if (this.isReloading) return false;
    if (this.ammo <= 0) return false;
    const now = performance.now();
    if (now - this.lastFireTime < this.fireInterval) return false;
    return true;
  }

  fire(): boolean {
    if (!this.canFire()) return false;
    const now = performance.now();
    this.ammo--;
    this.lastFireTime = now;
    this.lastShotTime = now;
    this.shotsFired++;

    // Keep scope up after firing — player watches tracer through scope
    // Recoil still kicks the view, but scope stays active

    return true;
  }

  reload(): void {
    if (this.isReloading) return;
    if (this.ammo >= MAGAZINE_SIZE) return;
    this.isReloading = true;
    this.reloadStartTime = performance.now();
    // Scope out when reloading
    if (this.isScoped) {
      this.scopeOut();
    }
  }

  update(dt: number): void {
    const now = performance.now();

    if (this.isReloading && now - this.reloadStartTime >= RELOAD_TIME) {
      this.ammo = MAGAZINE_SIZE;
      this.isReloading = false;
    }

    if (now - this.lastShotTime > 500) {
      this.shotsFired = 0;
    }
  }

  scopeIn(): void {
    if (this.isReloading) return;
    this.isScoped = true;
    this.scopeTransitionStart = performance.now();
  }

  scopeOut(): void {
    this.isScoped = false;
    this.scopeTransitionStart = performance.now();
  }

  toggleScope(): void {
    if (this.isScoped) {
      this.scopeOut();
    } else {
      this.scopeIn();
    }
  }

  getScopeTransitionProgress(): number {
    const elapsed = performance.now() - this.scopeTransitionStart;
    return Math.min(elapsed / this.scopeTransitionDuration, 1.0);
  }

  getAmmo(): number {
    return this.ammo;
  }

  isCurrentlyReloading(): boolean {
    return this.isReloading;
  }

  getShotIndex(): number {
    return this.shotsFired;
  }
}
