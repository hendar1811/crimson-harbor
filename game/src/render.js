// Drawing only: the city, the actors and the effects. The camera follows the
// player; everything outside the viewport is culled. Day and night shift the
// palette, light the windows and switch on lamps and headlights.
import { CAR_TYPES, GARAGE, HOSPITAL, PICKUP_SPOTS, POLICE_STATION, ROAD_STEP, ROAD_W, SAFEHOUSE, WATER_X, WORLD, dist } from './config.js';
import { isOnRoad } from './city.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { w: 1280, h: 800, scale: 1 };
  const cam = { x: 0, y: 0 };

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    canvas.width = Math.round(view.w * ratio);
    canvas.height = Math.round(view.h * ratio);
    canvas.style.width = `${view.w}px`;
    canvas.style.height = `${view.h}px`;
    view.scale = ratio;
  }
  resize();
  window.addEventListener('resize', resize);

  function nightFactor(dayT) {
    // 0 = noon, 1 = deep night. dayT 0..1 over the 4-minute cycle.
    const s = Math.sin(dayT * Math.PI * 2 - Math.PI / 2); // -1 night .. 1 day
    return (1 - s) / 2;
  }

  function groundAt(city, x, y) {
    return city.groundColor(x, y);
  }

  function drawCity(state, city) {
    const night = nightFactor(state.dayT);
    const x0 = Math.max(0, cam.x - 80);
    const y0 = Math.max(0, cam.y - 80);
    const x1 = Math.min(WORLD, cam.x + view.w + 80);
    const y1 = Math.min(WORLD, cam.y + view.h + 80);
    // Base ground: district colours in blocks, grass green elsewhere.
    ctx.fillStyle = '#4a5d3a';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    for (let bx = 0; bx < 8; bx += 1) {
      for (let by = 0; by < 8; by += 1) {
        const cx = bx * ROAD_STEP + ROAD_STEP / 2;
        const cy = by * ROAD_STEP + ROAD_STEP / 2;
        if (cx < x0 - 400 || cx > x1 + 400 || cy < y0 - 400 || cy > y1 + 400) continue;
        ctx.fillStyle = groundAt(city, cx, cy);
        ctx.fillRect(bx * ROAD_STEP + ROAD_W / 2, by * ROAD_STEP + ROAD_W / 2, ROAD_STEP - ROAD_W, ROAD_STEP - ROAD_W);
      }
    }
    // Harbor water.
    ctx.fillStyle = night > 0.5 ? '#0e2a3a' : '#2a6a8a';
    ctx.fillRect(Math.max(WATER_X, x0), y0, x1 - Math.max(WATER_X, x0), y1 - y0);
    // Water shimmer.
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    for (let y = Math.floor(y0 / 90) * 90; y < y1; y += 90) {
      ctx.beginPath();
      ctx.moveTo(Math.max(WATER_X + 10, x0), y + 20);
      ctx.lineTo(Math.min(WATER_X + 90, x1), y + 20);
      ctx.stroke();
    }
    // Docks and cranes.
    for (const d of city.docks) {
      if (d.x > x1 || d.x + d.w < x0 || d.y > y1 || d.y + d.h < y0) continue;
      ctx.fillStyle = '#8a7a5a';
      ctx.fillRect(d.x - 40, d.y, 60, d.h);
      ctx.fillStyle = '#6a5a42';
      ctx.fillRect(d.x - 40, d.y, 60, 10);
    }
    for (const cr of city.cranes) {
      if (cr.x < x0 || cr.x > x1 || cr.y < y0 || cr.y > y1) continue;
      ctx.strokeStyle = '#c8a25a';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(cr.x, cr.y + 60);
      ctx.lineTo(cr.x, cr.y - 90);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cr.x, cr.y - 90);
      ctx.lineTo(cr.x + Math.cos(cr.angle) * 130, cr.y - 90 + Math.sin(cr.angle) * 40);
      ctx.stroke();
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(cr.x - 16, cr.y + 40, 32, 22);
    }
    // Roads.
    ctx.fillStyle = '#2e2e34';
    for (let g = 0; g <= 8; g += 1) {
      const v = g * ROAD_STEP;
      if (v > x0 - ROAD_W && v < x1 + ROAD_W) ctx.fillRect(v - ROAD_W / 2, Math.max(0, y0), ROAD_W, y1 - y0);
      if (v > y0 - ROAD_W && v < y1 + ROAD_W) ctx.fillRect(Math.max(0, x0), v - ROAD_W / 2, x1 - x0, ROAD_W);
    }
    // Sidewalks.
    ctx.fillStyle = '#5a5a58';
    for (let g = 0; g <= 8; g += 1) {
      const v = g * ROAD_STEP;
      if (v > x0 - ROAD_W && v < x1 + ROAD_W) {
        ctx.fillRect(v - ROAD_W / 2 - 14, Math.max(0, y0), 14, y1 - y0);
        ctx.fillRect(v + ROAD_W / 2, Math.max(0, y0), 14, y1 - y0);
      }
      if (v > y0 - ROAD_W && v < y1 + ROAD_W) {
        ctx.fillRect(Math.max(0, x0), v - ROAD_W / 2 - 14, x1 - x0, 14);
        ctx.fillRect(Math.max(0, x0), v + ROAD_W / 2, x1 - x0, 14);
      }
    }
    // Lane markings.
    ctx.fillStyle = '#d8c84a';
    ctx.strokeStyle = 'rgba(216,200,74,0.8)';
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    for (let g = 0; g <= 8; g += 1) {
      const v = g * ROAD_STEP;
      if (v > x0 - 10 && v < x1 + 10) {
        ctx.beginPath(); ctx.moveTo(v, Math.max(0, y0)); ctx.lineTo(v, y1); ctx.stroke();
      }
      if (v > y0 - 10 && v < y1 + 10) {
        ctx.beginPath(); ctx.moveTo(Math.max(0, x0), v); ctx.lineTo(x1, v); ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    // Buildings with roofs, shadows and lit windows at night.
    for (const b of city.buildings) {
      if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(b.x + 10, b.y + 12, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(b.x, b.y, b.w, 8);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      if (b.tall) {
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.2, b.w * 0.6, b.h * 0.6);
      }
      // Windows: lit at night.
      const cols = Math.max(2, Math.floor(b.w / 26));
      const rows = Math.max(2, Math.floor(b.h / 26));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          const lit = ((cx * 7 + cy * 13 + Math.floor(b.seed * 100)) % 5) < (night > 0.45 ? 3 : 1);
          ctx.fillStyle = lit ? '#ffd97a' : 'rgba(20,30,50,0.55)';
          ctx.fillRect(b.x + 8 + cx * ((b.w - 16) / cols), b.y + 8 + cy * ((b.h - 16) / rows), 10, 12);
        }
      }
    }
    // Props.
    for (const pr of city.props) {
      if (pr.x < x0 || pr.x > x1 || pr.y < y0 || pr.y > y1) continue;
      if (pr.kind === 'palm') {
        ctx.strokeStyle = '#5a4632';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x + 4, pr.y - 26); ctx.stroke();
        ctx.fillStyle = '#2a8a4a';
        for (let i = 0; i < 5; i += 1) {
          const a = (i / 5) * Math.PI * 2 + pr.seed;
          ctx.beginPath();
          ctx.ellipse(pr.x + 4 + Math.cos(a) * 12, pr.y - 28 + Math.sin(a) * 8, 14, 5, a, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (pr.kind === 'crate') {
        ctx.fillStyle = '#8a6a3a';
        ctx.fillRect(pr.x - 10, pr.y - 10, 20, 20);
        ctx.strokeStyle = '#5a4632';
        ctx.strokeRect(pr.x - 10, pr.y - 10, 20, 20);
      } else if (pr.kind === 'bench') {
        ctx.fillStyle = '#6a4a2a';
        ctx.fillRect(pr.x - 16, pr.y - 5, 32, 10);
      } else {
        ctx.fillStyle = '#2a5a2a';
        ctx.beginPath(); ctx.arc(pr.x, pr.y, 10, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Lamps (glow at night).
    for (const l of city.lamps) {
      if (l.x < x0 || l.x > x1 || l.y < y0 || l.y > y1) continue;
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
      if (night > 0.4) {
        ctx.fillStyle = `rgba(255,220,120,${0.25 + night * 0.4})`;
        ctx.beginPath(); ctx.arc(l.x, l.y, 26, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffe9a0';
        ctx.beginPath(); ctx.arc(l.x, l.y, 5, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Key locations.
    drawMarker(SAFEHOUSE.x, SAFEHOUSE.y, '#4ac86a', 'H', 'Safehouse');
    drawMarker(GARAGE.x, GARAGE.y, '#c86a2a', 'G', "Sinta's Garage");
    drawMarker(POLICE_STATION.x, POLICE_STATION.y, '#3a6bc8', 'P', 'Police');
    drawMarker(HOSPITAL.x, HOSPITAL.y, '#e8e8e8', '+', 'Hospital');
    // Shop pickups.
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      if (pk.x < x0 || pk.x > x1 || pk.y < y0 || pk.y > y1) continue;
      const col = pk.kind === 'ammo' ? '#f2c94c' : pk.kind === 'armor' ? '#6ab8e8' : '#4ac86a';
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(pk.x, pk.y, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.font = `bold 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pk.kind === 'ammo' ? 'A' : pk.kind === 'armor' ? 'V' : '+', pk.x, pk.y + 1);
    }
    // Pearls.
    for (const pearl of city.pearls) {
      if (pearl.taken) continue;
      if (pearl.x < x0 || pearl.x > x1 || pearl.y < y0 || pearl.y > y1) continue;
      const tw = 0.6 + 0.4 * Math.sin(state.time * 3 + pearl.x);
      ctx.fillStyle = `rgba(255,220,240,${tw})`;
      ctx.beginPath(); ctx.arc(pearl.x, pearl.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c86a9a';
      ctx.beginPath(); ctx.arc(pearl.x, pearl.y, 4, 0, Math.PI * 2); ctx.fill();
    }
    // Cash drops.
    for (const d of state.cashDrops) {
      ctx.fillStyle = '#2a8a3a';
      ctx.fillRect(d.x - 7, d.y - 4, 14, 8);
      ctx.fillStyle = '#f2c94c';
      ctx.font = `bold 9px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('$', d.x, d.y + 3);
    }
    // Night overlay (drawn after the city, before actors, so actors stay readable).
    if (night > 0.05) {
      ctx.fillStyle = `rgba(8,12,34,${night * 0.42})`;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
    return night;
  }

  function drawMarker(x, y, color, letter, label) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.font = `bold 14px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, x, y + 1);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `11px ${FONT}`;
    ctx.fillText(label, x, y + 28);
  }

  function drawCar(c, night) {
    const t = CAR_TYPES[c.type];
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-t.len / 2 + 4, -t.wid / 2 + 5, t.len, t.wid);
    ctx.fillStyle = c.police ? '#20242c' : c.color;
    ctx.beginPath();
    ctx.roundRect(-t.len / 2, -t.wid / 2, t.len, t.wid, 7);
    ctx.fill();
    if (c.police) {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(-t.len / 2 + 6, -t.wid / 2, t.len - 12, 5);
      ctx.fillRect(-t.len / 2 + 6, t.wid / 2 - 5, t.len - 12, 5);
      const flash = Math.floor(c.x + c.y + Date.now() / 200) % 2 === 0;
      ctx.fillStyle = flash ? '#ff2a2a' : '#2a6bff';
      ctx.beginPath(); ctx.arc(0, -t.wid / 2 + 2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = flash ? '#2a6bff' : '#ff2a2a';
      ctx.beginPath(); ctx.arc(0, t.wid / 2 - 2, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(20,30,45,0.85)';
    ctx.beginPath();
    ctx.roundRect(-t.len / 2 + t.len * 0.28, -t.wid / 2 + 4, t.len * 0.32, t.wid - 8, 4);
    ctx.fill();
    // Headlights at night, brake lights when braking.
    if (night > 0.4) {
      ctx.fillStyle = 'rgba(255,240,180,0.9)';
      ctx.beginPath(); ctx.arc(t.len / 2, -t.wid / 2 + 4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(t.len / 2, t.wid / 2 - 4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,180,0.12)';
      ctx.beginPath();
      ctx.moveTo(t.len / 2, -t.wid / 2 + 4);
      ctx.lineTo(t.len / 2 + 110, -26);
      ctx.lineTo(t.len / 2 + 110, 26);
      ctx.lineTo(t.len / 2, t.wid / 2 - 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = c.brake ? '#ff2a2a' : '#a02020';
    ctx.fillRect(-t.len / 2, -t.wid / 2 + 3, 4, 6);
    ctx.fillRect(-t.len / 2, t.wid / 2 - 9, 4, 6);
    if (c.damage > 55) {
      ctx.fillStyle = 'rgba(120,120,120,0.7)';
      ctx.beginPath(); ctx.arc(-t.len / 4, 0, 8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawPed(ped, isCop) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.mode === 'down') {
      ctx.rotate(ped.angle + Math.PI / 2);
      ctx.globalAlpha = Math.max(0.25, ped.down / 2.2);
    }
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(2, 3, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = isCop ? '#20242c' : ped.shirt;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.color || '#e8b88a';
    ctx.beginPath(); ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3, 5, 0, Math.PI * 2); ctx.fill();
    if (isCop) {
      ctx.fillStyle = '#3a6bc8';
      ctx.fillRect(-6, -3, 12, 3);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    if (ped.taxi && ped.mode !== 'down') {
      ctx.fillStyle = '#e8c832';
      ctx.font = `bold 10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', ped.x, ped.y - 18);
    }
  }

  function drawPlayer(state, input) {
    const p = state.player;
    if (p.inCar) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) ctx.globalAlpha = 0.4;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(2, 3, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c8102e'; // crimson jacket — the runner's signature
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 4, Math.sin(p.angle) * 4, 6, 0, Math.PI * 2); ctx.fill();
    // Aim direction tick.
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(p.angle) * 10, Math.sin(p.angle) * 10);
    ctx.lineTo(Math.cos(p.angle) * 18, Math.sin(p.angle) * 18);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
    // Break-in progress ring.
    if (p.breakTarget && p.breakTimer > 0) {
      ctx.strokeStyle = '#f2c94c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 24, 12, -Math.PI / 2, -Math.PI / 2 + (p.breakTimer / 1.2) * Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawObjectiveMarker(state) {
    const o = state.objectivePos;
    if (!o) return;
    const bob = Math.sin(state.time * 4) * 6;
    ctx.save();
    ctx.translate(o.x, o.y + bob);
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(-12, -14);
    ctx.lineTo(12, -14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(0, -6, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // A guiding line from the player to the objective when far away.
    const p = state.player;
    const d = dist(p.x, p.y, o.x, o.y);
    if (d > 500) {
      const a = Math.atan2(o.y - p.y, o.x - p.x);
      const ex = p.x + Math.cos(a) * 90;
      const ey = p.y + Math.sin(a) * 90;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-8, -9);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function draw(state, city, input, screen) {
    const p = state.player;
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    cam.x = Math.max(0, Math.min(WORLD - view.w, p.x - view.w / 2 + shakeX));
    cam.y = Math.max(0, Math.min(WORLD - view.h, p.y - view.h / 2 + shakeY));
    // Mouse position in world space (for aiming).
    input.mouse.worldX = cam.x + (input.mouse.x || 0);
    input.mouse.worldY = cam.y + (input.mouse.y || 0);
    ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
    ctx.fillStyle = '#11141b';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    const night = drawCity(state, city);
    // Skid marks.
    for (const s of state.skids) {
      ctx.strokeStyle = `rgba(20,20,20,${Math.min(0.6, s.life / 2.5)})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.angle) * 18, s.y - Math.sin(s.angle) * 18);
      ctx.lineTo(s.x + Math.cos(s.angle) * 18, s.y + Math.sin(s.angle) * 18);
      ctx.stroke();
    }
    for (const c of state.cars) {
      if (c.x < cam.x - 120 || c.x > cam.x + view.w + 120 || c.y < cam.y - 120 || c.y > cam.y + view.h + 120) continue;
      drawCar(c, night);
    }
    for (const ped of state.peds) {
      if (ped.x < cam.x - 60 || ped.x > cam.x + view.w + 60 || ped.y < cam.y - 60 || ped.y > cam.y + view.h + 60) continue;
      drawPed(ped, false);
    }
    for (const cop of state.cops) drawPed(cop, true);
    drawPlayer(state, input);
    // Tracers and particles.
    for (const t of state.tracers) {
      ctx.strokeStyle = `rgba(255,220,120,${t.life / 0.12})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
    }
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    drawObjectiveMarker(state);
    ctx.restore();
    return { cam, night };
  }

  return { draw, view, cam };
}
