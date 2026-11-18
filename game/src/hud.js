// HUD: minimap, wanted stars, bars, cash, objective, menus, dialogue.
import { WORLD, RADIO } from './config.js';
import { CAR_TYPES } from './config.js';

export function drawHUD(ctx, state) {
  const { player, view } = state;
  const w = view.w, h = view.h;
  // Top-left: cash, health, armor, weapon.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(12, 12, 250, 96);
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('$' + player.cash, 24, 40);
  ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif';
  ctx.fillText('Pearls ' + player.pearls + '/20', 150, 38);
  bar(ctx, 24, 50, 200, 12, player.hp / 100, '#e74c3c', 'HP');
  bar(ctx, 24, 68, 200, 12, player.armor / 100, '#3498db', 'ARMOR');
  ctx.fillStyle = '#fff';
  ctx.fillText(player.weapon === 'pistol' ? `Pistol  •  ${player.ammo} rounds` : 'Fists', 24, 100);
  // Wanted stars top-right.
  const blink = player.wanted > 0 && player.wantedTimer > 3 && Math.floor(state.time * 3) % 2 === 0;
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < player.wanted ? (blink ? '#888' : '#f1c40f') : 'rgba(255,255,255,0.25)';
    ctx.font = '26px sans-serif';
    ctx.fillText('★', w - 40 - i * 30, 44);
  }
  // Objective line.
  if (state.objective) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const ow = ctx.measureText(state.objective).width + 24;
    ctx.fillRect(12, h - 96, ow, 30);
    ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 15px sans-serif';
    ctx.fillText('▶ ' + state.objective, 24, h - 75);
  }
  // Radio + speed while driving.
  if (player.car) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(w - 262, h - 66, 250, 54);
    ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif';
    ctx.fillText(RADIO[state.audio.station], w - 250, h - 44);
    const kmh = Math.round(Math.abs(player.car.speed) * 0.55);
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(kmh + ' km/h', w - 250, h - 20);
    ctx.font = '12px sans-serif';
    ctx.fillText(CAR_TYPES[player.car.type].name + (player.car.damage > 60 ? '  — smoking!' : ''), w - 150, h - 20);
  }
  // Toasts.
  let ty = 120;
  for (const t of state.toasts) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const tw = ctx.measureText(t.text).width + 24;
    ctx.fillRect((w - tw) / 2, ty, tw, 30);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(t.text, w / 2, ty + 20);
    ctx.textAlign = 'left';
    ty += 38;
  }
  // Dialogue overlay.
  if (state.dialogue) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(40, h - 190, w - 80, 80);
    ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 15px sans-serif';
    ctx.fillText(state.dialogue, 60, h - 160, w - 120);
    ctx.fillStyle = '#ccc'; ctx.font = '13px sans-serif';
    ctx.fillText('(Enter to continue)', 60, h - 130);
  }
  drawMinimap(ctx, state);
}

function bar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  ctx.fillStyle = '#fff'; ctx.font = '9px sans-serif';
  ctx.fillText(label, x + 4, y + h - 2);
}

function drawMinimap(ctx, state) {
  const { player, view, city } = state;
  const size = 190, mx = view.w - size - 14, my = 64;
  const s = size / WORLD;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(mx - 4, my - 4, size + 8, size + 8);
  ctx.fillStyle = '#1f5f7a';
  ctx.fillRect(mx + 4500 * s, my, (WORLD - 4500) * s, size);
  ctx.fillStyle = '#3a3f46';
  ctx.fillRect(mx, my, size, size);
  ctx.fillStyle = '#23262b';
  for (let v = 0; v <= WORLD; v += 600) {
    ctx.fillRect(mx, my + v * s - 2, size, 4);
    ctx.fillRect(mx + v * s - 2, my, 4, size);
  }
  // Key spots.
  const dots = [
    { p: city.safehouse, c: '#2ecc71' }, { p: city.garage, c: '#e67e22' },
    { p: city.policeStation, c: '#3498db' }, { p: city.hospital, c: '#e74c3c' },
    { p: city.diner, c: '#9b59b6' },
  ];
  for (const d of dots) {
    ctx.fillStyle = d.c;
    ctx.fillRect(mx + d.p.x * s - 2, my + d.p.y * s - 2, 5, 5);
  }
  // Police blips.
  for (const c of state.cars) {
    if (!c.police) continue;
    ctx.fillStyle = '#4a90ff';
    ctx.beginPath(); ctx.arc(mx + c.x * s, my + c.y * s, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // Objective blip.
  const wp = state.missions.waypoint();
  if (wp) {
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.arc(mx + wp.x * s, my + wp.y * s, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  ctx.save();
  ctx.translate(mx + player.x * s, my + player.y * s);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  // Clock (day/night).
  const tod = state.time % 1;
  const hh = Math.floor(tod * 24);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(String(hh).padStart(2, '0') + ':00  •  ' + (city.districtAt(player.x, player.y)?.name || 'Crimson Harbor'), mx + size / 2, my + size + 18);
  ctx.textAlign = 'left';
}

export function drawTitle(ctx, state) {
  const { view } = state;
  const w = view.w, h = view.h;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(20,8,20,0.85)'); g.addColorStop(1, 'rgba(60,10,30,0.85)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText('CRIMSON HARBOR', w / 2, h / 2 - 110);
  ctx.fillStyle = '#f1c40f';
  ctx.font = '20px sans-serif';
  ctx.fillText('A coastal city. A stolen life. Six jobs to make it yours.', w / 2, h / 2 - 70);
  ctx.fillStyle = '#ddd'; ctx.font = '15px sans-serif';
  const lines = [
    'WASD move  •  Shift run  •  E enter/exit car  •  F melee  •  Mouse aim, click shoot',
    'Space handbrake  •  P pause  •  M mute  •  Enter confirm',
    'Steal cars, dodge the law, run Marla Venn\'s jobs — and find all 20 harbour pearls.',
  ];
  lines.forEach((l, i) => ctx.fillText(l, w / 2, h / 2 - 30 + i * 24));
  const hasSave = state.hasSave;
  const opts = hasSave ? ['NEW GAME', 'CONTINUE', 'HOW TO PLAY'] : ['NEW GAME', 'HOW TO PLAY'];
  state.menuOpts = opts;
  opts.forEach((o, i) => {
    const y = h / 2 + 70 + i * 46;
    const sel = state.menuSel === i;
    ctx.fillStyle = sel ? '#f1c40f' : '#fff';
    ctx.font = (sel ? 'bold ' : '') + '24px sans-serif';
    ctx.fillText((sel ? '▶ ' : '') + o, w / 2, y);
  });
  ctx.fillStyle = '#999'; ctx.font = '13px sans-serif';
  ctx.fillText('Crimson Harbor — an original game. No real places, people or cars.', w / 2, h - 24);
  ctx.textAlign = 'left';
}

export function drawPause(ctx, state) {
  const { view } = state;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff'; ctx.font = 'bold 40px sans-serif';
  ctx.fillText('PAUSED', view.w / 2, view.h / 2 - 80);
  const opts = ['RESUME', 'SAVE GAME', 'RESTART', 'QUIT TO TITLE'];
  state.menuOpts = opts;
  opts.forEach((o, i) => {
    const sel = state.menuSel === i;
    ctx.fillStyle = sel ? '#f1c40f' : '#ddd';
    ctx.font = (sel ? 'bold ' : '') + '22px sans-serif';
    ctx.fillText((sel ? '▶ ' : '') + o, view.w / 2, view.h / 2 - 20 + i * 40);
  });
  ctx.textAlign = 'left';
}
