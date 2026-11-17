// Keyboard, mouse and touch input merged into one polled state.
// Edge-triggered actions (land/take off, interact, rest, flap-on-ground) are
// queued and consumed once per frame via takeEdges().

const EDGE_KEYS = {
  KeyF: 'land',
  KeyE: 'interact',
  KeyR: 'rest',
  Space: 'flap',
  Tab: 'menu'
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.edges = { land: false, interact: false, rest: false, flap: false, menu: false };
    this.lookX = 0;
    this.lookY = 0;
    this.enabled = false;
    this.dragging = false;
    this.touch = { moveX: 0, moveY: 0, flap: false, glide: false, boost: false, descend: false };
    this.onMenuKey = null;
    this.onPointerLockChange = null;

    window.addEventListener('keydown', (e) => this._key(e, true));
    window.addEventListener('keyup', (e) => this._key(e, false));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled || e.pointerType === 'touch') return;
      this.dragging = true;
      if (!document.pointerLockElement && canvas.requestPointerLock) {
        try { canvas.requestPointerLock(); } catch { /* ignore */ }
      }
    });
    window.addEventListener('mouseup', () => { this.dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (document.pointerLockElement === canvas || this.dragging) {
        this.lookX += e.movementX || 0;
        this.lookY += e.movementY || 0;
      }
    });
    document.addEventListener('pointerlockchange', () => this.onPointerLockChange?.(document.pointerLockElement === canvas));
  }

  _key(e, down) {
    const typing = e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (typing) return;
    if (e.code === 'Tab') {
      e.preventDefault();
      if (down && !e.repeat) this.onMenuKey?.();
      return;
    }
    if (!this.enabled) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (down) {
      if (!e.repeat && EDGE_KEYS[e.code]) this.edges[EDGE_KEYS[e.code]] = true;
      this.keys.add(e.code);
    } else {
      this.keys.delete(e.code);
    }
  }

  /** Merged continuous input. moveX: right is +1. moveY: forward is +1. */
  state() {
    const k = this.keys, t = this.touch;
    const axis = (neg, pos) => (neg.some((c) => k.has(c)) ? -1 : 0) + (pos.some((c) => k.has(c)) ? 1 : 0);
    const moveX = Math.max(-1, Math.min(1, axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']) + t.moveX));
    const moveY = Math.max(-1, Math.min(1, axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']) + t.moveY));
    return {
      moveX, moveY,
      flap: k.has('Space') || t.flap,
      glide: t.glide,
      boost: k.has('ShiftLeft') || k.has('ShiftRight') || t.boost,
      descend: k.has('KeyC') || t.descend
    };
  }

  takeEdges() {
    const out = { ...this.edges };
    for (const key of Object.keys(this.edges)) this.edges[key] = false;
    return out;
  }

  pushEdge(name) { this.edges[name] = true; }

  takeLook() {
    const out = { x: this.lookX, y: this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return out;
  }

  reset() {
    this.keys.clear();
    for (const key of Object.keys(this.edges)) this.edges[key] = false;
    this.lookX = this.lookY = 0;
    Object.assign(this.touch, { moveX: 0, moveY: 0, flap: false, glide: false, boost: false, descend: false });
  }
}
