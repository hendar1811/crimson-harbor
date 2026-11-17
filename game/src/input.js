// Keyboard and mouse input. Held keys are read every frame; one-shot presses
// (confirm, pause, interact, melee, mute, shoot) are queued as bit flags and
// taken once by the loop, so a press between frames is never lost or double-counted.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_MELEE = 8;
export const ACTION_MUTE = 16;
export const ACTION_SHOOT = 32;

const KEYS = {
  up: new Set(['ArrowUp', 'KeyW']),
  down: new Set(['ArrowDown', 'KeyS']),
  left: new Set(['ArrowLeft', 'KeyA']),
  right: new Set(['ArrowRight', 'KeyD']),
  run: new Set(['ShiftLeft', 'ShiftRight']),
  brake: new Set(['Space']),
  confirm: new Set(['Enter']),
  pause: new Set(['KeyP', 'Escape']),
  interact: new Set(['KeyE']),
  melee: new Set(['KeyF']),
  mute: new Set(['KeyM']),
};

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, run: false, brake: false };
  let actions = 0;
  const mouse = { x: 0, y: 0, worldX: 0, worldY: 0, down: false };

  function keyDown(event) {
    let handled = false;
    for (const [name, set] of Object.entries(KEYS)) {
      if (!set.has(event.code)) continue;
      handled = true;
      if (name === 'confirm' && !event.repeat) actions |= ACTION_CONFIRM;
      else if (name === 'pause' && !event.repeat) actions |= ACTION_PAUSE;
      else if (name === 'interact' && !event.repeat) actions |= ACTION_INTERACT;
      else if (name === 'melee' && !event.repeat) actions |= ACTION_MELEE;
      else if (name === 'mute' && !event.repeat) actions |= ACTION_MUTE;
      else if (held[name] !== undefined) held[name] = true;
    }
    if (handled) event.preventDefault();
  }
  function keyUp(event) {
    for (const [name, set] of Object.entries(KEYS)) {
      if (set.has(event.code) && held[name] !== undefined) held[name] = false;
    }
  }
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', () => {
    for (const k of Object.keys(held)) held[k] = false;
    mouse.down = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouse.down = true; actions |= ACTION_SHOOT; }
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });

  return {
    held,
    mouse,
    moveX() { return (held.right ? 1 : 0) - (held.left ? 1 : 0); },
    moveY() { return (held.down ? 1 : 0) - (held.up ? 1 : 0); },
    takeActions() { const t = actions; actions = 0; return t; },
  };
}
