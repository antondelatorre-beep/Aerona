// On-screen controls for touch devices: virtual joystick, flap and glide
// buttons, a contextual interaction button and drag-to-look on the free area.
// Styles live in styles.css (.touch-*).

export function isTouchDevice() {
  return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || new URLSearchParams(location.search).has('touch');
}

export class MobileControls {
  constructor(input, parent = document.body) {
    this.input = input;
    this.root = document.createElement('div');
    this.root.className = 'touch-root';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="touch-look" data-role="look"></div>
      <div class="touch-joy" data-role="joy"><div class="touch-joy-thumb"></div></div>
      <div class="touch-buttons">
        <button class="touch-btn touch-flap" data-hold="flap">Flap</button>
        <button class="touch-btn" data-hold="glide">Glide</button>
        <button class="touch-btn" data-hold="boost">Boost</button>
        <button class="touch-btn" data-hold="descend">Dive</button>
        <button class="touch-btn" data-tap="land">Land / Take off</button>
        <button class="touch-btn" data-tap="interact">Interact</button>
        <button class="touch-btn touch-menu" data-tap="menu">Menu</button>
      </div>`;
    parent.appendChild(this.root);
    this._bindLook();
    this._bindJoystick();
    this._bindButtons();
  }

  show(visible) { this.root.hidden = !visible; }

  _bindLook() {
    const zone = this.root.querySelector('[data-role="look"]');
    let id = null, lx = 0, ly = 0;
    zone.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      id = e.pointerId; lx = e.clientX; ly = e.clientY;
      zone.setPointerCapture(id);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      this.input.lookX += (e.clientX - lx) * 1.6;
      this.input.lookY += (e.clientY - ly) * 1.6;
      lx = e.clientX; ly = e.clientY;
    });
    const end = (e) => { if (e.pointerId === id) id = null; };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }

  _bindJoystick() {
    const joy = this.root.querySelector('[data-role="joy"]');
    const thumb = joy.querySelector('.touch-joy-thumb');
    let id = null;
    const radius = 52;
    const update = (e) => {
      const r = joy.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > radius) { dx = (dx / len) * radius; dy = (dy / len) * radius; }
      thumb.style.transform = `translate(${dx}px, ${dy}px)`;
      this.input.touch.moveX = dx / radius;
      this.input.touch.moveY = -dy / radius;
    };
    joy.addEventListener('pointerdown', (e) => { if (id !== null) return; id = e.pointerId; joy.setPointerCapture(id); update(e); });
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === id) update(e); });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      thumb.style.transform = 'translate(0, 0)';
      this.input.touch.moveX = 0;
      this.input.touch.moveY = 0;
    };
    joy.addEventListener('pointerup', end);
    joy.addEventListener('pointercancel', end);
  }

  _bindButtons() {
    for (const btn of this.root.querySelectorAll('[data-hold]')) {
      const key = btn.dataset.hold;
      btn.addEventListener('pointerdown', (e) => { btn.setPointerCapture(e.pointerId); this.input.touch[key] = true; btn.classList.add('down'); });
      const up = () => { this.input.touch[key] = false; btn.classList.remove('down'); };
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
    }
    for (const btn of this.root.querySelectorAll('[data-tap]')) {
      btn.addEventListener('pointerdown', () => {
        const name = btn.dataset.tap;
        if (name === 'menu') this.input.onMenuKey?.();
        else this.input.pushEdge(name);
        btn.classList.add('down');
      });
      const up = () => btn.classList.remove('down');
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
    }
  }
}
