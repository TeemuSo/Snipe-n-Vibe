import { ScoreEntry } from '@dayzcopy/shared';

export class Scoreboard {
  private container: HTMLElement;
  private tbody: HTMLElement;
  private visible: boolean = false;
  private localPlayerId: number = -1;

  constructor() {
    this.container = document.getElementById('scoreboard')!;
    this.tbody = document.querySelector('#scoreboard-table tbody')!;
  }

  show(): void {
    if (this.visible) return;
    this.visible = true;
    this.container.style.display = 'flex';
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.container.style.display = 'none';
  }

  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  setLocalPlayerId(id: number): void {
    this.localPlayerId = id;
  }

  updateScores(scores: ScoreEntry[]): void {
    // Sort by kills descending, then deaths ascending as tiebreaker
    const sorted = [...scores].sort((a, b) => {
      if (b.kills !== a.kills) return b.kills - a.kills;
      return a.deaths - b.deaths;
    });

    // Clear existing rows
    this.tbody.innerHTML = '';

    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i];
      const kd = s.deaths === 0 ? s.kills.toFixed(1) : (s.kills / s.deaths).toFixed(1);
      const row = document.createElement('tr');
      const isLocal = s.id === this.localPlayerId;

      if (isLocal) {
        row.classList.add('scoreboard-local');
      }

      row.innerHTML =
        `<td>${i + 1}</td>` +
        `<td>${this.escapeHtml(s.name)}</td>` +
        `<td>${s.kills}</td>` +
        `<td>${s.deaths}</td>` +
        `<td>${kd}</td>`;

      this.tbody.appendChild(row);
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
