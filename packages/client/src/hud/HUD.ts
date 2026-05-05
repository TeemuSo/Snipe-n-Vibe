export class HUD {
  private healthFill: HTMLElement | null;
  private ammoDisplay: HTMLElement | null;
  private killFeed: HTMLElement | null;
  private startScreen: HTMLElement | null;
  private crosshair: HTMLElement | null;
  private scopeOverlay: HTMLElement | null;

  constructor() {
    this.healthFill = document.getElementById('health-fill');
    this.ammoDisplay = document.getElementById('ammo-display');
    this.killFeed = document.getElementById('kill-feed');
    this.startScreen = document.getElementById('start-screen');
    this.crosshair = document.getElementById('crosshair');
    this.scopeOverlay = document.getElementById('scope-overlay');
  }

  updateHealth(hp: number, maxHp: number): void {
    if (!this.healthFill) return;
    const pct = (hp / maxHp) * 100;
    this.healthFill.style.width = `${pct}%`;

    if (pct > 60) {
      this.healthFill.style.backgroundColor = '#4caf50';
    } else if (pct > 30) {
      this.healthFill.style.backgroundColor = '#ffeb3b';
    } else {
      this.healthFill.style.backgroundColor = '#f44336';
    }
  }

  updateAmmo(current: number, magazine: number): void {
    if (!this.ammoDisplay) return;
    this.ammoDisplay.textContent = `${current} / ${magazine}`;

    if (current <= 1) {
      this.ammoDisplay.classList.add('low-ammo');
    } else {
      this.ammoDisplay.classList.remove('low-ammo');
    }
  }

  showScope(): void {
    if (this.scopeOverlay) this.scopeOverlay.style.display = 'block';
    if (this.crosshair) this.crosshair.style.display = 'none';
    if (this.ammoDisplay) this.ammoDisplay.style.display = 'none';
  }

  hideScope(): void {
    if (this.scopeOverlay) this.scopeOverlay.style.display = 'none';
    if (this.crosshair) this.crosshair.style.display = 'block';
    if (this.ammoDisplay) this.ammoDisplay.style.display = 'block';
  }

  addKillFeedEntry(killer: string, victim: string): void {
    if (!this.killFeed) return;

    const entry = document.createElement('div');
    entry.className = 'kill-entry';
    entry.textContent = `${killer} > ${victim}`;
    this.killFeed.prepend(entry);

    while (this.killFeed.children.length > 5) {
      this.killFeed.removeChild(this.killFeed.lastChild!);
    }

    setTimeout(() => {
      if (entry.parentNode) {
        entry.parentNode.removeChild(entry);
      }
    }, 5000);
  }

  showDeathScreen(killerId: number): void {
    const overlay = document.getElementById('death-screen');
    if (!overlay) return;
    overlay.style.display = 'flex';
    const msg = overlay.querySelector('.death-message');
    if (msg) {
      msg.textContent = `You were killed by Player ${killerId}`;
    }
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 3000);
  }

  hideStartScreen(): void {
    if (!this.startScreen) return;
    this.startScreen.style.display = 'none';
  }

  showStartScreen(): void {
    if (!this.startScreen) return;
    this.startScreen.style.display = 'flex';
  }
}
