// City layout: road grid, districts, buildings, props, pearls, key locations.
// All generated deterministically from a seed so shot scenes are reproducible.
import { WORLD, TILE, ROAD_W, DISTRICTS, PEARL_TOTAL } from './config.js';
import { mulberry32, pick, range } from './random.js';

export function roadCenters() {
  const xs = [], ys = [];
  for (let v = 0; v <= WORLD; v += TILE) { xs.push(v); ys.push(v); }
  return { xs, ys };
}

export function isOnRoad(x, y) {
  const m = ((v) => { const r = v % TILE; return Math.min(r, TILE - r); });
  return m(x) < ROAD_W / 2 + 6 || m(y) < ROAD_W / 2 + 6;
}

export function nearestRoadPoint(x, y) {
  const snap = (v) => Math.round(v / TILE) * TILE;
  const dx = Math.abs(snap(x) - x), dy = Math.abs(snap(y) - y);
  return dx < dy ? { x: snap(x), y } : { x, y: snap(y) };
}

export class City {
  constructor(seed) {
    this.seed = seed;
    const rng = mulberry32(seed);
    this.buildings = [];
    this.palms = [];
    this.lamps = [];
    this.crates = [];
    this.pearls = [];
    this.parkingLots = [];
    // Buildings fill each block between roads (skip the harbor water strip and beach).
    for (let bx = 0; bx < 8; bx++) {
      for (let by = 0; by < 8; by++) {
        const x0 = bx * TILE + ROAD_W / 2 + 24;
        const y0 = by * TILE + ROAD_W / 2 + 24;
        const x1 = (bx + 1) * TILE - ROAD_W / 2 - 24;
        const y1 = (by + 1) * TILE - ROAD_W / 2 - 24;
        // East edge is water (harbor), south strip is beach.
        if (x0 > 4200) continue;
        if (y0 > 4200 && bx < 4) continue;
        const d = DISTRICTS.find((dd) => x0 >= dd.x && x0 < dd.x + dd.w && y0 >= dd.y && y0 < dd.y + dd.h)
          || DISTRICTS[0];
        const n = 2 + Math.floor(rng() * 3);
        for (let i = 0; i < n; i++) {
          const bw = range(rng, 110, 200), bh = range(rng, 110, 200);
          const bx0 = range(rng, x0, Math.max(x0 + 1, x1 - bw));
          const by0 = range(rng, y0, Math.max(y0 + 1, y1 - bh));
          const tall = d.name === 'Downtown' && rng() < 0.5;
          this.buildings.push({
            x: bx0, y: by0, w: bw, h: bh,
            roof: d.roof, accent: d.accent, tall,
            lit: Array.from({ length: 6 }, () => rng() < 0.6),
            district: d.name,
          });
        }
        // Props sprinkled on the block.
        const propCount = 3 + Math.floor(rng() * 4);
        for (let i = 0; i < propCount; i++) {
          const px = range(rng, x0, x1), py = range(rng, y0, y1);
          if (rng() < 0.45) this.palms.push({ x: px, y: py });
          else if (rng() < 0.5) this.crates.push({ x: px, y: py, s: range(rng, 16, 26) });
        }
      }
    }
    // Street lamps along every road.
    for (let v = TILE; v < WORLD; v += TILE) {
      for (let u = TILE / 2; u < WORLD; u += TILE) {
        this.lamps.push({ x: v - ROAD_W / 2 - 10, y: u });
        this.lamps.push({ x: u, y: v - ROAD_W / 2 - 10 });
      }
    }
    // Harbor cranes + docks on the east edge.
    this.cranes = [];
    for (let y = 900; y < 3600; y += 700) this.cranes.push({ x: 4350, y });
    // Parking lots with parked cars (stealable) near downtown and the harbor.
    this.parkingLots = [
      { x: 1500, y: 1500 }, { x: 2700, y: 900 }, { x: 3900, y: 2100 },
      { x: 1500, y: 3300 }, { x: 3300, y: 3900 },
    ];
    // 20 hidden harbour pearls, mostly around the harbor and beach.
    const spots = [];
    for (let i = 0; i < PEARL_TOTAL; i++) {
      if (i < 12) spots.push({ x: range(rng, 3600, 4400), y: range(rng, 700, 3500) });
      else if (i < 16) spots.push({ x: range(rng, 2400, 3500), y: range(rng, 3900, 4400) });
      else spots.push({ x: range(rng, 700, 3400), y: range(rng, 700, 3400) });
    }
    this.pearls = spots.map((s) => ({ x: s.x, y: s.y, taken: false }));
    // Key locations.
    this.safehouse = { x: 1350, y: 3450, name: 'Safehouse' };
    this.garage = { x: 2550, y: 2850, name: "Sinta's Garage" };
    this.policeStation = { x: 1350, y: 1350, name: 'Police Station' };
    this.hospital = { x: 2550, y: 1350, name: 'Harbor General' };
    this.ammoShop = { x: 1950, y: 2250, name: 'Ammo & Armour' };
    this.diner = { x: 3150, y: 3150, name: 'Marla\'s Diner' };
    this.raceStart = { x: 900, y: 4500, name: 'Street Race' };
  }

  districtAt(x, y) {
    return DISTRICTS.find((d) => x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) || null;
  }
  isWater(x, y) { return x > 4500; }
  // Solid test: buildings + water + world edge.
  solidAt(x, y) {
    if (x < 20 || y < 20 || x > WORLD - 20 || y > WORLD - 20) return true;
    if (this.isWater(x, y)) return true;
    for (const b of this.buildings) {
      if (x > b.x - 4 && x < b.x + b.w + 4 && y > b.y - 4 && y < b.y + b.h + 4) return true;
    }
    return false;
  }
  // Move a circle, sliding along solids.
  moveCircle(e, dx, dy) {
    const r = e.radius || 12;
    if (!this.solidAt(e.x + dx, e.y)) e.x += dx;
    else if (!this.solidAt(e.x + dx * 0.5, e.y)) e.x += dx * 0.5;
    if (!this.solidAt(e.x, e.y + dy)) e.y += dy;
    else if (!this.solidAt(e.x, e.y + dy * 0.5)) e.y += dy * 0.5;
    void r;
  }
}
