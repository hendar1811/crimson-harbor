// Keyboard + mouse input state.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.anyKey = null;
    addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      this.keys.add(e.key.toLowerCase());
      this.anyKey = e.key;
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', () => { this.mouse.down = true; this.mouse.clicked = true; });
    addEventListener('mouseup', () => { this.mouse.down = false; });
    addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });
  }
  down(...ks) { return ks.some((k) => this.keys.has(k)); }
  pressed(key) {
    if (this.anyKey && this.anyKey.toLowerCase() === key.toLowerCase()) { this.anyKey = null; return true; }
    return false;
  }
  consumeClick() { const c = this.mouse.clicked; this.mouse.clicked = false; return c; }
  axis() {
    let x = 0, y = 0;
    if (this.down('a', 'arrowleft')) x -= 1;
    if (this.down('d', 'arrowright')) x += 1;
    if (this.down('w', 'arrowup')) y -= 1;
    if (this.down('s', 'arrowdown')) y += 1;
    return { x, y };
  }
}
