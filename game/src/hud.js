// HUD, minimap and menus: wanted stars, cash, health/armour, weapon, objective,
// speedometer, radio station, dialogue overlay, title and pause screens.
// All screen-space drawing; the world renderer owns the canvas transform.
import { DISTRICTS, GARAGE, MISSIONS, POLICE_STATION, SAFEHOUSE, STATIONS, WATER_X, WORLD, dist } from './config.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');
  let view = { w: 1280, h: 800 };

  function setView(w, h) { view = { w, h }; }

  function text(str, x, y, size, color, align, bold) {
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  }

  function panel(x, y, w, h, alpha) {
    ctx.fillStyle = `rgba(10,12,18,${alpha ?? 0.72})`;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function bar(x, y, w, h, frac, color, bg) {
    ctx.fillStyle = bg || 'rgba(255,255,255,0.18)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
  }

  function drawMinimap(state) {
    const size = 208;
    const x = view.w - size - 16;
    const y = 16;
    const s = size / WORLD;
    panel(x - 6, y - 6, size + 12, size + 12, 0.8);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.clip();
    ctx.fillStyle = '#3a4a34';
    ctx.fillRect(x, y, size, size);
    // Districts as tinted blocks.
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.ground;
      ctx.fillRect(x + d.x0 * s, y + d.y0 * s, (d.x1 - d.x0) * s, (d.y1 - d.y0) * s);
    }
    // Water.
    ctx.fillStyle = '#2a6a8a';
    ctx.fillRect(x + WATER_X * s, y, size - WATER_X * s, size);
    // Roads.
    ctx.strokeStyle = 'rgba(220,220,220,0.55)';
    ctx.lineWidth = 2;
    for (let g = 0; g <= 8; g += 1) {
      const v = g * 600;
      ctx.beginPath(); ctx.moveTo(x + v * s, y); ctx.lineTo(x + v * s, y + size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + v * s); ctx.lineTo(x + size, y + v * s); ctx.stroke();
    }
    // Safehouse / garage.
    ctx.fillStyle = '#4ac86a';
    ctx.beginPath(); ctx.arc(x + SAFEHOUSE.x * s, y + SAFEHOUSE.y * s, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c86a2a';
    ctx.beginPath(); ctx.arc(x + GARAGE.x * s, y + GARAGE.y * s, 4, 0, Math.PI * 2); ctx.fill();
    // Objective blip (gold, pulsing).
    const o = state.objectivePos;
    if (o) {
      const r = 5 + Math.sin(state.time * 5) * 2;
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath(); ctx.arc(x + o.x * s, y + o.y * s, r, 0, Math.PI * 2); ctx.fill();
    }
    // Taxi / courier destinations.
    if (state.taxi) {
      ctx.fillStyle = '#e8c832';
      ctx.beginPath(); ctx.arc(x + state.taxi.dest.x * s, y + state.taxi.dest.y * s, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (state.courier) {
      ctx.fillStyle = '#e8a0c8';
      ctx.beginPath(); ctx.arc(x + state.courier.dest.x * s, y + state.courier.dest.y * s, 4, 0, Math.PI * 2); ctx.fill();
    }
    // Police blips (blue).
    ctx.fillStyle = '#5a8aff';
    for (const c of state.cars) {
      if (!c.police) continue;
      ctx.beginPath(); ctx.arc(x + c.x * s, y + c.y * s, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow.
    const p = state.player;
    ctx.save();
    ctx.translate(x + p.x * s, y + p.y * s);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    // North label.
    text('N', x + size / 2, y + size + 16, 12, 'rgba(255,255,255,0.7)', 'center');
  }

  function drawHud(state, screen) {
    const p = state.player;
    // Wanted stars, top-left.
    panel(16, 16, 190, 44, 0.72);
    const blink = state.wantedBlink && Math.floor(state.time * 4) % 2 === 0;
    for (let i = 0; i < 5; i += 1) {
      text('★', 30 + i * 34, 48, 26, i < state.wanted ? (blink ? '#555' : '#ffd23a') : 'rgba(255,255,255,0.22)', 'left', true);
    }
    // Cash and mission.
    panel(16, 68, 300, 58, 0.72);
    text(`$${state.cash}`, 28, 96, 26, '#7ae08a', 'left', true);
    const m = MISSIONS[Math.min(state.missionIndex, MISSIONS.length - 1)];
    text(state.completed ? 'All missions complete' : `Job ${Math.min(state.missionIndex + 1, 6)}/6: ${m.title}`, 28, 118, 13, 'rgba(255,255,255,0.85)');
    // Health / armour.
    panel(16, 134, 220, 62, 0.72);
    text('HP', 28, 158, 13, '#fff');
    bar(66, 146, 150, 12, state.health / 100, state.health > 30 ? '#4ac86a' : '#e84a3a');
    text('ARMOR', 28, 182, 13, '#fff');
    bar(66, 170, 150, 12, state.armor / 100, '#6ab8e8');
    // Weapon.
    panel(16, 204, 220, 40, 0.72);
    text(state.hasPistol ? `PISTOL  •  ${state.ammo} rounds` : 'FISTS ONLY', 28, 230, 14, '#fff', 'left', true);
    // Objective line, bottom-left.
    const objW = Math.min(560, view.w - 32);
    panel(16, view.h - 64, objW, 48, 0.72);
    text('◆ ' + state.objective, 28, view.h - 34, 15, '#ffe9a0');
    // Speedometer + radio, bottom-right (driving).
    if (p.inCar) {
      panel(view.w - 236, view.h - 108, 220, 92, 0.72);
      const speed = Math.abs(p.inCar.speed) * 0.24;
      text(`${Math.round(speed)}`, view.w - 30, view.h - 52, 34, '#fff', 'right', true);
      text('km/h', view.w - 30, view.h - 30, 12, 'rgba(255,255,255,0.7)', 'right');
      const st = STATIONS[state.station];
      text(`${st.name}`, view.w - 220, view.h - 88, 13, '#8ad8ff', 'left', true);
      text(st.tag, view.w - 220, view.h - 70, 11, 'rgba(255,255,255,0.6)');
    }
    // Toast.
    if (state.toastTimer > 0 && state.toast) {
      const tw = ctx.measureText(state.toast).width + 40;
      panel((view.w - tw) / 2, 16, tw, 40, 0.8);
      ctx.font = `15px ${FONT}`;
      text(state.toast, view.w / 2, 42, 15, '#fff', 'center');
    }
    // District name, top-centre, below the toast line.
    const d = state.districtName || '';
    if (d) text(d, view.w / 2, 84, 15, 'rgba(255,255,255,0.75)', 'center', true);
    drawMinimap(state);
    // Pearls.
    text(`◆ Pearls ${state.pearls}/20`, view.w - 16, view.h - 130, 13, 'rgba(255,255,255,0.85)', 'right');
  }

  function drawDialogue(state) {
    const d = state.dialogue;
    if (!d) return;
    const [who, line] = d.lines[d.index];
    const w = Math.min(760, view.w - 60);
    const x = (view.w - w) / 2;
    const y = view.h - 190;
    panel(x, y, w, 130, 0.88);
    text(who, x + 24, y + 34, 17, '#ffd23a', 'left', true);
    // Word-wrap the line.
    ctx.font = `16px ${FONT}`;
    const words = line.split(' ');
    let row = '';
    let ly = y + 64;
    for (const word of words) {
      if (ctx.measureText(row + word).width > w - 48) {
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.fillText(row, x + 24, ly);
        row = '';
        ly += 24;
      }
      row += word + ' ';
    }
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(row, x + 24, ly);
    text('Enter — continue', x + w - 24, y + 108, 13, 'rgba(255,255,255,0.6)', 'right');
  }

  function drawTitle(state, hasSave) {
    const cx = view.w / 2;
    ctx.fillStyle = 'rgba(10,8,14,0.55)';
    ctx.fillRect(0, 0, view.w, view.h);
    text('CRIMSON HARBOR', cx, view.h * 0.30, 64, '#e8102e', 'center', true);
    text('an open-world crime story', cx, view.h * 0.30 + 40, 20, '#ffd23a', 'center');
    const story = [
      'You are the Runner — new in town, fast on foot and faster behind the wheel.',
      'Marla Venn has work for you. Six jobs stand between you and the harbor.',
      'Steal cars. Lose the heat. Do not get caught.',
    ];
    story.forEach((line, i) => text(line, cx, view.h * 0.44 + i * 26, 16, 'rgba(255,255,255,0.9)', 'center'));
    const controls = [
      'WASD / arrows — move & drive      Shift — run      Space — handbrake',
      'E — enter / steal car, talk, save      F — punch      Mouse — aim, click — shoot',
      'P / Esc — pause      M — mute      Enter — confirm',
    ];
    controls.forEach((line, i) => text(line, cx, view.h * 0.60 + i * 24, 14, 'rgba(255,255,255,0.65)', 'center'));
    text(hasSave ? 'Enter — Continue      N — New Game' : 'Enter — New Game', cx, view.h * 0.76, 18, '#7ae08a', 'center', true);
    text('Missions pay. Pearls hide in the harbor. The police do not forget.', cx, view.h * 0.82, 13, 'rgba(255,255,255,0.5)', 'center');
  }

  function drawPaused(state) {
    ctx.fillStyle = 'rgba(8,10,16,0.6)';
    ctx.fillRect(0, 0, view.w, view.h);
    const cx = view.w / 2;
    text('PAUSED', cx, view.h * 0.34, 48, '#fff', 'center', true);
    const lines = [
      'P / Esc — resume',
      'S — save game',
      'M — mute / unmute',
      `R — restart from the safehouse (cash $${state.cash} kept)`,
      'Enter — resume',
    ];
    lines.forEach((line, i) => text(line, cx, view.h * 0.46 + i * 30, 17, 'rgba(255,255,255,0.85)', 'center'));
  }

  function drawComplete(state) {
    ctx.fillStyle = 'rgba(10,8,14,0.6)';
    ctx.fillRect(0, 0, view.w, view.h);
    const cx = view.w / 2;
    text('CRIMSON HARBOR IS YOURS', cx, view.h * 0.36, 44, '#ffd23a', 'center', true);
    text('All six jobs done. The ledger is safe, the boat is gone,', cx, view.h * 0.46, 18, '#fff', 'center');
    text('and Marla Venn owes you a drink. Keep driving — the city is open.', cx, view.h * 0.50, 18, '#fff', 'center');
    text(`Cash $${state.cash}   •   Pearls ${state.pearls}/20   •   Cars stolen ${state.stats.carsStolen}`, cx, view.h * 0.58, 16, 'rgba(255,255,255,0.8)', 'center');
    text('Enter — keep playing', cx, view.h * 0.68, 17, '#7ae08a', 'center', true);
  }

  return { setView, drawHud, drawDialogue, drawTitle, drawPaused, drawComplete };
}
