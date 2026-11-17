// Touch-first input: floating left-thumb stick, right-thumb camera drag, keyboard fallback.
export class Input {
  constructor(surface, stickEl) {
    this.move = { x: 0, y: 0 };
    this.look = { dx: 0, dy: 0 };
    this.enabled = true;
    this.stick = null;   // { id, ox, oy }
    this.cam = null;     // { id, x, y }
    this.keys = new Set();
    this.onKey = () => {};
    this.stickEl = stickEl;
    this.knob = stickEl.firstElementChild;
    this.radius = 52;
    this.home = null;

    surface.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      surface.setPointerCapture?.(e.pointerId);
      if (!this.stick && e.clientX < innerWidth * 0.45) {
        this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY };
        this.#placeStick(e.clientX, e.clientY, true);
      } else if (!this.cam) {
        this.cam = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }
    });
    surface.addEventListener('pointermove', (e) => {
      if (this.stick && e.pointerId === this.stick.id) {
        let dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
        const d = Math.hypot(dx, dy);
        if (d > this.radius) { dx *= this.radius / d; dy *= this.radius / d; }
        this.move.x = dx / this.radius;
        this.move.y = -dy / this.radius;
        this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      } else if (this.cam && e.pointerId === this.cam.id) {
        this.look.dx += e.clientX - this.cam.x;
        this.look.dy += e.clientY - this.cam.y;
        this.cam.x = e.clientX; this.cam.y = e.clientY;
      }
    });
    const end = (e) => {
      if (this.stick && e.pointerId === this.stick.id) this.#releaseStick();
      if (this.cam && e.pointerId === this.cam.id) this.cam = null;
    };
    surface.addEventListener('pointerup', end);
    surface.addEventListener('pointercancel', end);
    surface.addEventListener('contextmenu', (e) => e.preventDefault());

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.onKey(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.reset(); });
  }

  #placeStick(x, y, active) {
    const s = this.stickEl.style;
    s.left = `${x}px`; s.top = `${y}px`; s.bottom = 'auto';
    this.stickEl.classList.toggle('active', active);
  }

  #releaseStick() {
    this.stick = null;
    this.move.x = this.move.y = 0;
    this.knob.style.transform = '';
    this.stickEl.classList.remove('active');
    this.stickEl.style.left = this.stickEl.style.top = this.stickEl.style.bottom = '';
  }

  reset() {
    if (this.stick) this.#releaseStick();
    this.cam = null;
    this.look.dx = this.look.dy = 0;
  }

  // Combined stick + keyboard vector, magnitude ≤ 1. x = right, y = forward.
  axis(out) {
    let x = this.move.x, y = this.move.y;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    out.x = this.enabled ? x : 0;
    out.y = this.enabled ? y : 0;
    return out;
  }

  // Run when the stick is pushed to its edge, or Shift is held with the keys.
  get sprint() {
    if (!this.enabled) return false;
    if (this.stick) return Math.hypot(this.move.x, this.move.y) > 0.88;
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }

  consumeLook(out) {
    out.dx = this.look.dx; out.dy = this.look.dy;
    this.look.dx = this.look.dy = 0;
    return out;
  }
}
