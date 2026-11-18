// Canvas 2D rendering: city, entities, effects, day/night lighting.
import { WORLD, TILE, ROAD_W, DISTRICTS } from './config.js';
import { clamp } from './random.js';

export function daylight(t) {
  // t: 0..1 through the day. Returns 0 (night) .. 1 (noon).
  const s = Math.sin(t * Math.PI * 2 - Math.PI / 2);
  return clamp(0.25 + 0.75 * Math.max(0, s), 0, 1);
}

export function drawWorld(ctx, state, cam) {
  const { city, cars, peds, pickups, particles, player, time } = state;
  const day = daylight(time);
  const vw = state.view.w, vh = state.view.h;
  const x0 = Math.max(0, cam.x - vw / 2 - 80), y0 = Math.max(0, cam.y - vh / 2 - 80);
  const x1 = Math.min(WORLD, cam.x + vw / 2 + 80), y1 = Math.min(WORLD, cam.y + vh / 2 + 80);

  // Ground.
  ctx.fillStyle = '#2c332a';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Water along the east edge.
  ctx.fillStyle = day > 0.5 ? '#1f5f7a' : '#0e2f42';
  ctx.fillRect(Math.max(x0, 4500), y0, x1 - Math.max(x0, 4500), y1 - y0);
  // Beach strip along the south.
  ctx.fillStyle = '#a08c5e';
  ctx.fillRect(x0, Math.max(y0, 4500), x1 - x0, y1 - Math.max(y0, 4500));
  // District ground tint.
  for (const d of DISTRICTS) {
    if (d.x > x1 || d.x + d.w < x0 || d.y > y1 || d.y + d.h < y0) continue;
    ctx.fillStyle = d.ground;
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(d.name.toUpperCase(), d.x + 60, d.y + 60);
  }
  // Roads.
  ctx.fillStyle = '#23262b';
  for (let v = 0; v <= WORLD; v += TILE) {
    ctx.fillRect(v - ROAD_W / 2, y0, ROAD_W, y1 - y0);
    ctx.fillRect(x0, v - ROAD_W / 2, x1 - x0, ROAD_W);
  }
  // Lane dashes.
  ctx.fillStyle = '#d8c56a';
  for (let v = 0; v <= WORLD; v += TILE) {
    for (let u = 0; u < WORLD; u += 80) {
      if (u % 160 < 80) continue;
      if (v > x0 - 100 && v < x1 + 100) ctx.fillRect(v - 2, u, 4, 34);
      if (v > y0 - 100 && v < y1 + 100) ctx.fillRect(u, v - 2, 34, 4);
    }
  }
  // Sidewalks.
  ctx.fillStyle = '#4a4d52';
  for (let v = 0; v <= WORLD; v += TILE) {
    ctx.fillRect(v - ROAD_W / 2 - 14, y0, 14, y1 - y0);
    ctx.fillRect(v + ROAD_W / 2, y0, 14, y1 - y0);
    ctx.fillRect(x0, v - ROAD_W / 2 - 14, x1 - x0, 14);
    ctx.fillRect(x0, v + ROAD_W / 2, x1 - x0, 14);
  }
  // Harbor cranes and docks.
  ctx.strokeStyle = '#c96a2e'; ctx.lineWidth = 8;
  for (const c of city.cranes) {
    if (c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1) continue;
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x, c.y - 120);
    ctx.lineTo(c.x + 90, c.y - 120); ctx.stroke();
    ctx.fillStyle = '#8a4a1e'; ctx.fillRect(c.x - 16, c.y - 10, 32, 20);
  }
  // Buildings with roofs, shadows, lit windows at night.
  for (const b of city.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(b.x, b.y, b.w, 8);
    ctx.fillStyle = b.accent;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 5);
    if (b.tall) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(b.x + b.w / 2 - 6, b.y - 26, 12, 26); }
    // Windows.
    for (let i = 0; i < 6; i++) {
      const wx = b.x + 14 + (i % 3) * ((b.w - 28) / 2);
      const wy = b.y + 20 + Math.floor(i / 3) * ((b.h - 40) / 1);
      const lit = b.lit[i];
      ctx.fillStyle = lit && day < 0.6 ? '#ffd76a' : 'rgba(0,0,0,0.35)';
      ctx.fillRect(wx, wy, 16, 12);
    }
  }
  // Key locations (safehouse, garage, station, hospital, shop, diner).
  const spots = [
    { p: city.safehouse, c: '#2ecc71', label: 'SAFEHOUSE' },
    { p: city.garage, c: '#e67e22', label: 'GARAGE' },
    { p: city.policeStation, c: '#3498db', label: 'POLICE' },
    { p: city.hospital, c: '#e74c3c', label: 'HOSPITAL' },
    { p: city.ammoShop, c: '#f1c40f', label: 'AMMO' },
    { p: city.diner, c: '#9b59b6', label: 'DINER' },
  ];
  for (const s of spots) {
    if (s.p.x < x0 || s.p.x > x1 || s.p.y < y0 || s.p.y > y1) continue;
    ctx.fillStyle = s.c;
    ctx.beginPath(); ctx.arc(s.p.x, s.p.y, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(s.label, s.p.x, s.p.y + 4);
    ctx.textAlign = 'left';
  }
  // Pearls.
  for (const pr of city.pearls) {
    if (pr.taken || pr.x < x0 || pr.x > x1 || pr.y < y0 || pr.y > y1) continue;
    const pulse = 0.6 + 0.4 * Math.sin(state.time * 3 + pr.x);
    ctx.fillStyle = `rgba(255,255,255,${pulse})`;
    ctx.beginPath(); ctx.arc(pr.x, pr.y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b4d9';
    ctx.beginPath(); ctx.arc(pr.x, pr.y, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Crates and palms.
  for (const c of city.crates) {
    if (c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1) continue;
    ctx.fillStyle = '#8a6a3e'; ctx.fillRect(c.x - c.s / 2, c.y - c.s / 2, c.s, c.s);
    ctx.strokeStyle = '#5d4526'; ctx.strokeRect(c.x - c.s / 2, c.y - c.s / 2, c.s, c.s);
  }
  for (const pl of city.palms) {
    if (pl.x < x0 || pl.x > x1 || pl.y < y0 || pl.y > y1) continue;
    ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(pl.x, pl.y); ctx.lineTo(pl.x + 4, pl.y - 22); ctx.stroke();
    ctx.fillStyle = '#2e8b57';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath(); ctx.ellipse(pl.x + 4 + Math.cos(a) * 12, pl.y - 22 + Math.sin(a) * 8, 14, 5, a, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Skid marks.
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 4;
  for (const m of state.skids) {
    ctx.beginPath(); ctx.moveTo(m.x1, m.y1); ctx.lineTo(m.x2, m.y2); ctx.stroke();
  }
  // Pickups.
  for (const pk of pickups) {
    if (pk.x < x0 || pk.x > x1 || pk.y < y0 || pk.y > y1) continue;
    const bob = Math.sin(state.time * 4 + pk.bob) * 3;
    ctx.fillStyle = pk.pkind === 'health' ? '#2ecc71' : pk.pkind === 'armor' ? '#3498db' : pk.pkind === 'ammo' ? '#f1c40f' : '#e8b4d9';
    ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(pk.pkind === 'health' ? '+' : pk.pkind === 'armor' ? 'A' : pk.pkind === 'ammo' ? '•' : '$', pk.x, pk.y + bob + 5);
    ctx.textAlign = 'left';
  }
  // Cars.
  for (const car of cars) drawCar(ctx, car, day, state.time);
  // Pedestrians.
  for (const p of peds) {
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
    if (p.down) {
      ctx.fillStyle = p.color; ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 14, 8, p.angle, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(p.x, p.y + 3, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Player.
  drawPlayer(ctx, player, state.time);
  // Mission waypoint marker.
  const wp = state.missions.waypoint();
  if (wp) {
    const bob = Math.sin(state.time * 5) * 6;
    ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(wp.x, wp.y - 30 + bob, 18, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.moveTo(wp.x, wp.y - 8 + bob); ctx.lineTo(wp.x - 10, wp.y - 26 + bob); ctx.lineTo(wp.x + 10, wp.y - 26 + bob); ctx.closePath(); ctx.fill();
  }
  // Race checkpoints.
  if (state.raceCp) for (const cp of state.raceCp) {
    if (cp.hit) continue;
    ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(cp.x, cp.y, 60, 0, Math.PI * 2); ctx.stroke();
  }
  // Particles.
  for (const p of particles.list) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  // Night overlay + lamp glow.
  if (day < 0.7) {
    ctx.fillStyle = `rgba(8,12,40,${(0.7 - day) * 0.55})`;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    for (const l of city.lamps) {
      if (l.x < x0 || l.x > x1 || l.y < y0 || l.y > y1) continue;
      const g = ctx.createRadialGradient(l.x, l.y, 4, l.x, l.y, 90);
      g.addColorStop(0, 'rgba(255,214,120,0.28)'); g.addColorStop(1, 'rgba(255,214,120,0)');
      ctx.fillStyle = g;
      ctx.fillRect(l.x - 90, l.y - 90, 180, 180);
    }
  }
  // Headlight cones at night for the player's car.
  if (player.car && day < 0.6) {
    const car = player.car;
    const hx = car.x + Math.cos(car.angle) * 60, hy = car.y + Math.sin(car.angle) * 60;
    const g = ctx.createRadialGradient(hx, hy, 10, hx, hy, 160);
    g.addColorStop(0, 'rgba(255,240,180,0.25)'); g.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = g;
    ctx.fillRect(hx - 160, hy - 160, 320, 320);
  }
}

function drawCar(ctx, car, day, time) {
  const t = { w: 46, h: 22 }[0]; // placeholder replaced below by type dims
  void t;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const dims = carDims(car.type);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-dims.w / 2 + 4, -dims.h / 2 + 5, dims.w, dims.h);
  ctx.fillStyle = car.color;
  ctx.fillRect(-dims.w / 2, -dims.h / 2, dims.w, dims.h);
  // Roof / cabin.
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-dims.w / 4, -dims.h / 2 + 3, dims.w / 2, dims.h - 6);
  ctx.fillStyle = '#1a2530';
  ctx.fillRect(-dims.w / 6, -dims.h / 2 + 4, dims.w / 4, dims.h - 8);
  // Headlights / brake lights.
  ctx.fillStyle = car.brake ? '#ff2d2d' : '#7a1f1f';
  ctx.fillRect(-dims.w / 2 - 2, -dims.h / 2 + 2, 3, 5);
  ctx.fillRect(-dims.w / 2 - 2, dims.h / 2 - 7, 3, 5);
  ctx.fillStyle = day < 0.6 ? '#ffe9a8' : '#fff8d0';
  ctx.fillRect(dims.w / 2 - 1, -dims.h / 2 + 2, 3, 5);
  ctx.fillRect(dims.w / 2 - 1, dims.h / 2 - 7, 3, 5);
  if (car.police) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-dims.w / 2 + 4, -dims.h / 2, dims.w - 8, 4);
    const blink = Math.floor(time * 4) % 2 === 0;
    ctx.fillStyle = blink ? '#ff0000' : '#0044ff';
    ctx.fillRect(-6, -dims.h / 2 - 2, 12, 5);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
    ctx.textAlign = 'left';
  }
  if (car.type === 2) { // taxi sign
    ctx.fillStyle = '#f7dc6f'; ctx.fillRect(-8, -dims.h / 2 - 4, 16, 4);
    ctx.fillStyle = '#000'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, -dims.h / 2 - 5 + 8);
    ctx.textAlign = 'left';
  }
  // Damage smoke.
  if (car.damage > 60) {
    ctx.fillStyle = 'rgba(120,120,120,0.6)';
    ctx.beginPath(); ctx.arc(-dims.w / 3, 0, 6 + Math.random() * 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function carDims(typeIdx) {
  const dims = [
    { w: 46, h: 22 }, { w: 44, h: 20 }, { w: 46, h: 22 },
    { w: 56, h: 26 }, { w: 52, h: 24 }, { w: 46, h: 22 },
  ];
  return dims[typeIdx] || dims[0];
}

function drawPlayer(ctx, player, time) {
  const x = player.x, y = player.y;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(x + 3, y + 5, 12, 9, 0, 0, Math.PI * 2); ctx.fill();
  // Body: crimson jacket.
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#c0392b';
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath(); ctx.arc(6, 0, 5, 0, Math.PI * 2); ctx.fill();
  // Pistol in hand when armed.
  if (player.weapon === 'pistol') {
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -2, 12, 4);
  }
  ctx.restore();
  // Steal progress ring.
  if (player.stealT > 0) {
    ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (player.stealT / 1.2)); ctx.stroke();
  }
  void time;
}
