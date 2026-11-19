// DOM overlays: loading screen, start/pause menu and the in-flight HUD.

import { BIOME_LABELS } from './world.js';

const $ = (id) => document.getElementById(id);
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export class Hud {
  constructor() {
    this.el = {
      loading: $('loading'), loadingText: $('loading-text'), loadingBar: $('loading-bar'), loadingError: $('loading-error'),
      menu: $('menu'), menuSpecies: $('menu-species'), menuNotice: $('menu-notice'), start: $('start'), speciesList: $('species-list'),
      hud: $('hud'), biome: $('hud-biome'), time: $('hud-time'), message: $('hud-message'),
      speed: $('hud-speed'), alt: $('hud-alt'), heading: $('hud-heading'), mode: $('hud-mode'),
      stamina: $('hud-stamina'), hint: $('hud-hint'), nearby: $('hud-nearby'),
      food: $('hud-food'), level: $('hud-level'), prompt: $('hud-prompt'), target: $('hud-target'), targetLabel: $('hud-target-label')
    };
    this._acc = 0;
  }

  setLoading(text, fraction) {
    this.el.loadingText.textContent = text;
    if (fraction != null) this.el.loadingBar.style.width = `${Math.round(fraction * 100)}%`;
  }

  fatal(message) {
    this.el.loadingError.hidden = false;
    this.el.loadingError.textContent = message;
  }

  hideLoading() { this.el.loading.hidden = true; }

  /**
   * roster: [{ label, items: [{ id, name, status: 'model' | 'standin' }] }]
   * onPick(id) switches species without leaving the page.
   */
  setupMenu({ species, notice, onStart, onPick, roster }) {
    const f = species.flight;
    this.el.menuSpecies.textContent =
      `${species.name} (${species.scientific}). ${species.role}. Wingspan ${species.size.wingspan} m, cruises at ${Math.round(f.cruiseSpeed * 3.6)} km/h, ${species.diet}.`;
    this.el.menuNotice.hidden = !notice;
    this.el.menuNotice.textContent = notice || '';
    this.el.start.onclick = onStart;
    this.el.speciesList.replaceChildren();
    const standIns = roster.reduce((n, g) => n + g.items.filter((i) => i.status !== 'model').length, 0);
    if (standIns) {
      const toggle = document.createElement('button');
      toggle.textContent = this.showStandIns ? 'Hide species without a model' : `Show ${standIns} species without a model`;
      toggle.onclick = () => { this.showStandIns = !this.showStandIns; this.setupMenu({ species, notice, onStart, onPick, roster }); };
      this.el.speciesList.appendChild(toggle);
    }
    for (const group of roster) {
      const items = group.items.filter((i) => this.showStandIns || i.status === 'model' || i.id === species.id);
      if (!items.length) continue;
      const h = document.createElement('h3');
      h.textContent = group.label;
      this.el.speciesList.appendChild(h);
      const row = document.createElement('div');
      row.className = 'species-row';
      for (const item of items) {
        const b = document.createElement('button');
        b.textContent = item.name;
        b.title = item.status === 'model' ? '3D model loaded' : 'Stand-in model (no GLB yet)';
        b.dataset.status = item.status;
        if (item.id === species.id) b.setAttribute('aria-current', 'true');
        b.onclick = () => onPick(item.id);
        row.appendChild(b);
      }
      this.el.speciesList.appendChild(row);
    }
  }

  setBusy(text) {
    this.el.menuNotice.hidden = false;
    this.el.menuNotice.textContent = text;
  }

  showMenu(visible, resume = false) {
    this.el.menu.hidden = !visible;
    this.el.start.textContent = resume ? 'Resume' : 'Take flight';
    this.el.hud.hidden = visible;
  }

  /** Place the hunting marker; `t` is { x, y, label } in pixels, or null. */
  setTarget(t) {
    this.el.target.hidden = !t;
    if (!t) return;
    this.el.target.style.left = `${t.x}px`;
    this.el.target.style.top = `${t.y}px`;
    this.el.targetLabel.textContent = t.label;
  }

  update(dt, flight, world, wildlife, hunting) {
    this._acc += dt;
    if (this._acc < 0.1) return;
    this._acc = 0;
    const s = flight.state;
    this.el.speed.textContent = Math.round(s.speed * 3.6);
    this.el.alt.textContent = Math.round(s.agl);
    const deg = ((-s.yaw * 180) / Math.PI + 360) % 360;
    this.el.heading.textContent = COMPASS[Math.round(deg / 45) % 8];
    this.el.mode.textContent = s.resting ? 'resting' : s.action ? s.action : s.mode;
    const frac = s.stamina / s.staminaMax;
    this.el.stamina.style.width = `${Math.round(frac * 100)}%`;
    this.el.stamina.classList.toggle('low', s.exhausted || frac < 0.2);
    this.el.message.textContent = s.message || hunting?.message || '';
    if (hunting) {
      this.el.food.style.width = `${Math.round(hunting.food)}%`;
      this.el.food.classList.toggle('low', hunting.food < 20);
      this.el.level.textContent = `Level ${hunting.level}, ${hunting.stats.kills} kills, ${hunting.stats.fish} fish`;
      this.el.prompt.textContent = hunting.prompt;
    }
    const near = wildlife?.nearest(120);
    this.el.nearby.textContent = near ? `${near.name}, ${Math.round(near.dist)} m` : '';

    const h = world.hour, hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    this.el.time.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    this.el.biome.textContent = BIOME_LABELS[world.biomeAt(flight.pos.x, flight.pos.z)] || '';
    this.el.hint.textContent = s.mode === 'ground'
      ? (flight.f.flightless ? 'Shift: run. E: peck or drink. R: rest' : 'Space or F: take off. E: peck or drink. R: rest')
      : s.mode === 'landing' ? 'Hold course. F again or Space to abort'
      : 'F: land. Hold W to flap, Space to climb, C to dive';
  }
}
