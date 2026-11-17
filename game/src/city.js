// City generation: a seeded road grid, district palettes, solid buildings,
// props (palms, lamps, crates, benches), parking lots, docks and cranes,
// the harbor water on the east edge, and the 20 hidden pearls.
// Everything is plain data; render.js paints it.
import { DISTRICTS, PEARL_COUNT, ROAD_STEP, ROAD_W, WATER_X, WORLD } from './config.js';

const NOWHERE = { name: '', ground: '#4a5d3a', roof: '#5a6b7d', accent: '#8fa8c8' };

function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return NOWHERE;
}

function roadCoord(v) {
  // Roads run at multiples of ROAD_STEP, offset so the grid is centred.
  return Math.round(v / ROAD_STEP) * ROAD_STEP;
}

export function isOnRoad(x, y) {
  if (x > WATER_X) return false;
  const rx = Math.abs(x - roadCoord(x));
  const ry = Math.abs(y - roadCoord(y));
  return rx < ROAD_W / 2 || ry < ROAD_W / 2;
}

export function createCity(random) {
  const buildings = [];
  const props = [];
  const lamps = [];
  const parked = [];
  const pearls = [];
  const docks = [];
  const cranes = [];

  // One building per block, with a margin so streets stay clear.
  for (let bx = 0; bx < 8; bx += 1) {
    for (let by = 0; by < 8; by += 1) {
      const x0 = bx * ROAD_STEP + ROAD_W / 2 + 24;
      const y0 = by * ROAD_STEP + ROAD_W / 2 + 24;
      const x1 = (bx + 1) * ROAD_STEP - ROAD_W / 2 - 24;
      const y1 = (by + 1) * ROAD_STEP - ROAD_W / 2 - 24;
      if (x0 > WATER_X - 40) continue; // harbor water, no buildings
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      if (cx > WATER_X - 160) continue; // keep buildings clear of the water entirely
      const d = districtAt(cx, cy);
      const downtown = d.name === 'Downtown';
      const w = downtown ? random.range(140, 220) : random.range(90, 180);
      const h = downtown ? random.range(140, 220) : random.range(90, 170);
      const tall = downtown && random.chance(0.5);
      buildings.push({
        x: cx - w / 2, y: cy - h / 2, w, h,
        roof: d.roof, accent: d.accent, tall,
        floors: tall ? random.int(8, 18) : random.int(1, 4),
        seed: random(),
      });
      // Props sprinkled around the block, never on the road.
      const nProps = random.int(2, 5);
      for (let i = 0; i < nProps; i += 1) {
        const px = random.range(x0, x1);
        const py = random.range(y0, y1);
        if (px > cx - w / 2 - 20 && px < cx + w / 2 + 20 && py > cy - h / 2 - 20 && py < cy + h / 2 + 20) continue;
        const kind = d.name === 'Palm Beach' || random.chance(0.3) ? 'palm' : random.pick(['crate', 'bench', 'bush']);
        props.push({ x: px, y: py, kind, seed: random() });
      }
    }
  }

  // Street lamps along every road intersection corner.
  for (let gx = 0; gx <= 8; gx += 1) {
    for (let gy = 0; gy <= 8; gy += 1) {
      const x = gx * ROAD_STEP;
      const y = gy * ROAD_STEP;
      if (x > WATER_X) continue;
      lamps.push({ x: x + ROAD_W / 2 + 10, y: y + ROAD_W / 2 + 10 });
      lamps.push({ x: x - ROAD_W / 2 - 10, y: y - ROAD_W / 2 - 10 });
    }
  }

  // Parking lots: rows of parked cars near Downtown and Palm Beach.
  const lots = [[2100, 1200], [1500, 3300], [3300, 1800], [2700, 3900]];
  for (const [lx, ly] of lots) {
    for (let i = 0; i < 5; i += 1) {
      parked.push({ x: lx + i * 70, y: ly, angle: 0, type: random.int(0, 5), color: random.pick(['#c84a3a', '#3a6bc8', '#e8b73a', '#4a9a5a', '#d8d8d8']) });
    }
  }

  // Harbor: docks, cranes and warehouses along the water.
  for (let i = 0; i < 5; i += 1) {
    const y = 900 + i * 700;
    docks.push({ x: WATER_X + 40, y, w: 120, h: 220 });
    cranes.push({ x: WATER_X - 60, y: y - 60, angle: random.range(-0.6, 0.6) });
  }

  // Pearls: hidden collectibles, tucked near props and docks.
  for (let i = 0; i < PEARL_COUNT; i += 1) {
    let x;
    let y;
    if (i < 6) { x = random.range(WATER_X - 300, WATER_X - 60); y = random.range(700, 4200); }
    else if (i < 12) { x = random.range(700, 3600); y = random.range(3700, 4150); }
    else { x = random.range(700, 4200); y = random.range(700, 4200); }
    pearls.push({ x, y, taken: false });
  }

  function solidAt(x, y, r) {
    if (x > WATER_X - 6) return true; // water blocks movement
    if (x < 40 || y < 40 || x > WORLD - 40 || y > WORLD - 40) return true;
    for (const b of buildings) {
      if (x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r) return true;
    }
    return false;
  }

  // Push a circle out of any building it overlaps; returns true if it hit one.
  function resolveCircle(e, r) {
    let hit = false;
    if (e.x > WATER_X - r) { e.x = WATER_X - r; hit = true; }
    e.x = Math.max(40 + r, Math.min(WORLD - 40 - r, e.x));
    e.y = Math.max(40 + r, Math.min(WORLD - 40 - r, e.y));
    for (const b of buildings) {
      const cx = Math.max(b.x, Math.min(e.x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(e.y, b.y + b.h));
      const dx = e.x - cx;
      const dy = e.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        e.x = cx + (dx / d) * r;
        e.y = cy + (dy / d) * r;
        hit = true;
      } else if (d2 <= 0.0001) {
        e.x = b.x - r;
        hit = true;
      }
    }
    return hit;
  }

  function districtName(x, y) { return districtAt(x, y).name; }
  function groundColor(x, y) { return districtAt(x, y).ground; }

  return { buildings, props, lamps, parked, pearls, docks, cranes, solidAt, resolveCircle, districtAt, districtName, groundColor };
}
