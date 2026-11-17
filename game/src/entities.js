// The simulation: player, cars, pedestrians, police, particles, pickups,
// combat and the wanted system. No drawing here — render.js paints state.
// Missions read and write this state through the returned object.
import { CAR_COLORS, CAR_TYPES, GARAGE, HOSPITAL, PICKUP_SPOTS, POLICE_STATION, SAFEHOUSE, WORLD, angleDiff, angleTo, clamp, dist } from './config.js';
import { createCity, isOnRoad } from './city.js';
import { steerTraffic, steerPed, steerPolice } from './ai.js';

const MAX_TRAFFIC = 22;
const MAX_PEDS = 36;

export function createWorld(random) {
  const city = createCity(random);
  const state = {
    time: 0,
    dayT: 0.3, // 0 = dawn, 0.5 = noon, 1 = dusk; cycles every ~4 minutes
    cash: 120,
    health: 100,
    armor: 0,
    ammo: 0,
    hasPistol: false,
    wanted: 0,
    wantedBlink: false,
    hiddenTimer: 0,
    bustedTimer: 0,
    wastedTimer: 0,
    station: 0,
    pearls: 0,
    pearlsTaken: 0,
    missionIndex: 0,
    missionDone: false,
    completed: false,
    toast: '',
    toastTimer: 0,
    shake: 0,
    dialogue: null, // {lines, index} or null
    objective: 'Find Marla Venn — start the first mission at the gold marker.',
    objectivePos: { x: 4200, y: 900 },
    player: { x: 1500, y: 1000, angle: 0, speed: 0, inCar: null, breakTimer: 0, breakTarget: null, meleeCd: 0, shootCd: 0, invuln: 0, run: false },
    cars: [],
    peds: [],
    cops: [],
    particles: [],
    tracers: [],
    skids: [],
    cashDrops: [],
    pickups: [],
    race: null, // street race runtime
    taxi: null, // {ped, dest}
    courier: null,
    escort: null,
    stats: { crimes: 0, carsStolen: 0, pedsHit: 0 },
  };

  let carId = 1;

  function addCar(x, y, angle, type, color, opts) {
    const c = {
      id: carId += 1, x, y, angle, speed: 0,
      type: type ?? random.int(0, CAR_TYPES.length - 1),
      color: color ?? random.pick(CAR_COLORS),
      damage: 0, traffic: false, parked: false, police: false,
      driver: false, route: null, wp: 0, brake: false, smoke: 0,
      ...(opts || {}),
    };
    state.cars.push(c);
    return c;
  }

  function spawnTrafficCar() {
    // Spawn on a road near the player, already moving along a lane.
    const px = state.player.x;
    const py = state.player.y;
    for (let tries = 0; tries < 12; tries += 1) {
      const gx = Math.round((px + random.range(-900, 900)) / 600) * 600;
      const gy = Math.round((py + random.range(-900, 900)) / 600) * 600;
      if (gx < 300 || gy < 300 || gx > 4200 || gy > 4200) continue;
      if (dist(gx, gy, px, py) < 500) continue;
      const horizontal = random.chance(0.5);
      const dir = random.chance(0.5) ? 1 : -1;
      const lane = 30;
      const x = horizontal ? gx : gx + (dir > 0 ? lane : -lane);
      const y = horizontal ? gy + (dir > 0 ? lane : -lane) : gy;
      const c = addCar(x, y, horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2), random.int(0, 5), null, { traffic: true, driver: true });
      c.speed = random.range(120, 200);
      c.route = buildRoute(gx, gy, horizontal, dir);
      c.wp = 0;
      return c;
    }
    return null;
  }

  function buildRoute(gx, gy, horizontal, dir) {
    const pts = [];
    let x = gx;
    let y = gy;
    let h = horizontal;
    let d = dir;
    for (let i = 0; i < 6; i += 1) {
      const steps = random.int(1, 3);
      if (h) x += d * 600 * steps; else y += d * 600 * steps;
      x = clamp(x, 300, 4200);
      y = clamp(y, 300, 4200);
      pts.push({ x, y });
      if (random.chance(0.6)) { h = !h; d = random.chance(0.5) ? 1 : -1; }
    }
    return pts;
  }

  function spawnPed(nearX, nearY) {
    const x = clamp((nearX ?? state.player.x) + random.range(-700, 700), 200, 4200);
    const y = clamp((nearY ?? state.player.y) + random.range(-700, 700), 200, 4200);
    const p = {
      x, y, angle: random.range(0, Math.PI * 2), speed: random.range(28, 55),
      mode: 'walk', timer: random.range(2, 8), tx: x, ty: y,
      color: random.pick(['#e8b88a', '#c88a5a', '#8ab8e8', '#d8d8d8', '#e8a0a0', '#a0c8a0']),
      shirt: random.pick(['#c84a3a', '#3a6bc8', '#e8b73a', '#4a9a5a', '#8a4ac8', '#d8d8d8']),
      taxi: random.chance(0.18), courier: false, down: 0, cash: random.int(5, 25),
    };
    state.peds.push(p);
    return p;
  }

  function addParticles(x, y, n, color, speed, life) {
    for (let i = 0; i < n; i += 1) {
      const a = random.range(0, Math.PI * 2);
      const s = random.range(speed * 0.3, speed);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: random.range(life * 0.5, life), maxLife: life, color, size: random.range(2, 5) });
    }
    if (state.particles.length > 400) state.particles.splice(0, state.particles.length - 400);
  }

  function say(text, secs) {
    state.toast = text;
    state.toastTimer = secs || 3;
  }

  function addWanted(n, reason) {
    if (state.wanted >= 5) return;
    state.wanted = clamp(state.wanted + n, 0, 5);
    state.hiddenTimer = 0;
    state.wantedBlink = false;
    state.stats.crimes += 1;
    if (reason) say(reason, 2.5);
  }

  function nearestCar(x, y, maxD) {
    let best = null;
    let bd = maxD;
    for (const c of state.cars) {
      const d = dist(x, y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  function carLength(c) { return CAR_TYPES[c.type].len; }

  function collideCars(dt) {
    const cars = state.cars;
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        const a = cars[i];
        const b = cars[j];
        const d = dist(a.x, a.y, b.x, b.y);
        const min = (carLength(a) + carLength(b)) / 2 - 8;
        if (d < min && d > 0.01) {
          const nx = (b.x - a.x) / d;
          const ny = (b.y - a.y) / d;
          const push = (min - d) / 2;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
          const impact = Math.abs(a.speed - b.speed);
          if (impact > 120) {
            a.damage += impact * 0.02;
            b.damage += impact * 0.02;
            addParticles((a.x + b.x) / 2, (a.y + b.y) / 2, 6, '#f2c94c', 160, 0.4);
            if ((a === state.player.inCar || b === state.player.inCar) && impact > 200) {
              state.shake = Math.min(10, impact * 0.02);
              audioRef.crash();
            }
          }
          const tmp = a.speed;
          a.speed = b.speed * 0.4;
          b.speed = tmp * 0.4;
        }
      }
    }
  }

  function damagePlayer(n) {
    if (state.player.invuln > 0) return;
    let left = n;
    if (state.armor > 0) {
      const absorbed = Math.min(state.armor, left * 0.6);
      state.armor -= absorbed;
      left -= absorbed;
    }
    state.health -= left;
    state.player.invuln = 0.4;
    if (state.health <= 0) {
      state.health = 0;
      state.wastedTimer = 2.2;
      say('WASTED — the harbor ambulance picks you up.', 3);
      audioRef.fail();
    }
  }

  // Audio is wired in by main.js after creation (avoids a circular import).
  let audioRef = { crash() {}, gunshot() {}, melee() {}, pickup() {}, cash() {}, skid() {}, jingle() {}, fail() {}, busted() {}, siren() {}, engine() {} };

  function reset(newGame) {
    state.time = 0;
    state.dayT = 0.3;
    state.cash = newGame ? 120 : state.cash;
    state.health = 100;
    state.armor = 0;
    state.ammo = 24;
    state.hasPistol = true;
    state.wanted = 0;
    state.hiddenTimer = 0;
    state.pearls = 0;
    state.pearlsTaken = 0;
    state.missionIndex = 0;
    state.missionDone = false;
    state.completed = false;
    state.player.x = SAFEHOUSE.x;
    state.player.y = SAFEHOUSE.y + 120;
    state.player.angle = 0;
    state.player.inCar = null;
    state.player.breakTimer = 0;
    state.cars.length = 0;
    state.peds.length = 0;
    state.cops.length = 0;
    state.particles.length = 0;
    state.tracers.length = 0;
    state.skids.length = 0;
    state.cashDrops.length = 0;
    state.pickups.length = 0;
    state.race = null;
    state.taxi = null;
    state.courier = null;
    state.escort = null;
    for (const s of PICKUP_SPOTS) state.pickups.push({ kind: s.kind, x: s.x, y: s.y, label: s.label, taken: false, respawn: 0 });
    for (const p of city.parked) {
      addCar(p.x, p.y, p.angle, p.type, p.color, { parked: true });
    }
    // The hero car for mission 2: a crimson coupe on Palm Beach.
    addCar(1500, 3900, 0, 2, '#c8102e', { parked: true, missionCar: true });
    for (let i = 0; i < 14; i += 1) spawnTrafficCar();
    for (let i = 0; i < 26; i += 1) spawnPed();
    state.objective = 'Find Marla Venn — start the first mission at the gold marker.';
    state.objectivePos = { x: 4200, y: 900 };
  }

  function stepPlayer(dt, input, actions) {
    const p = state.player;
    if (p.meleeCd > 0) p.meleeCd -= dt;
    if (p.shootCd > 0) p.shootCd -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.inCar) return; // driving is handled in stepDriving
    const mx = input.moveX();
    const my = input.moveY();
    const run = input.held.run;
    const speed = run ? 300 : 175;
    if (mx !== 0 || my !== 0) {
      const a = Math.atan2(my, mx);
      p.angle = a;
      p.x += Math.cos(a) * speed * dt;
      p.y += Math.sin(a) * speed * dt;
      p.speed = speed;
      if (city.resolveCircle(p, 14)) p.speed = 0;
    } else {
      p.speed = 0;
    }
    // Breaking into a parked car.
    if (p.breakTarget) {
      const c = p.breakTarget;
      if (dist(p.x, p.y, c.x, c.y) > 90 || !c.parked) {
        p.breakTarget = null;
        p.breakTimer = 0;
      } else {
        p.breakTimer += dt;
        if (p.breakTimer > 1.2) {
          c.parked = false;
          c.driver = true;
          p.inCar = c;
          p.breakTarget = null;
          p.breakTimer = 0;
          state.stats.carsStolen += 1;
          say('Car stolen — witnesses may have seen that.', 2.5);
          if (nearbyWitness(p.x, p.y, 420)) addWanted(1, 'Witnessed! Wanted level up.');
        }
      }
    }
    if (actions & 4) { // E: enter car / talk / start job
      tryInteract();
    }
    if (actions & 8) { // F: melee
      melee();
    }
    if ((actions & 32) && state.hasPistol && state.ammo > 0) shoot();
  }

  function nearbyWitness(x, y, r) {
    for (const ped of state.peds) if (ped.mode !== 'down' && dist(x, y, ped.x, ped.y) < r) return true;
    for (const c of state.cops) if (dist(x, y, c.x, c.y) < r) return true;
    return false;
  }

  function tryInteract() {
    const p = state.player;
    // Taxi / courier peds first.
    for (const ped of state.peds) {
      if (ped.mode === 'down') continue;
      if (dist(p.x, p.y, ped.x, ped.y) < 46) {
        if (ped.taxi && !state.taxi && !p.inCar) {
          const dest = { x: 900 + random.range(0, 6) * 600, y: 900 + random.range(0, 5) * 600 };
          state.taxi = { ped, dest, fare: random.int(40, 120) };
          ped.mode = 'follow';
          say(`Taxi job: drive this passenger to the marker. Fare $${state.taxi.fare}. Get a car!`, 4);
          return;
        }
        if (ped.courier && !state.courier) {
          state.courier = { dest: { x: 900 + random.range(0, 6) * 600, y: 900 + random.range(0, 5) * 600 }, pay: random.int(50, 110) };
          say(`Courier job: deliver the parcel to the marker. Pays $${state.courier.pay}.`, 4);
          return;
        }
      }
    }
    // Pearls, cash drops, pickups.
    for (const pearl of city.pearls) {
      if (!pearl.taken && dist(p.x, p.y, pearl.x, pearl.y) < 40) {
        pearl.taken = true;
        state.pearls += 1;
        state.pearlsTaken += 1;
        state.cash += 50;
        say(`Harbour pearl ${state.pearls}/20 — +$50`, 2.5);
        audioRef.pickup();
        return;
      }
    }
    // Enter nearest car.
    const c = nearestCar(p.x, p.y, 70);
    if (c) {
      if (c.police) { say('That is a police car. Stealing it is a bad idea.', 2); return; }
      if (c.parked) {
        p.breakTarget = c;
        p.breakTimer = 0;
        say('Breaking in…', 1.5);
      } else if (c.driver) {
        // Jack a driven car: the driver flees, witnesses matter.
        c.driver = false;
        p.inCar = c;
        say('You pulled the driver out!', 2);
        if (nearbyWitness(p.x, p.y, 420)) addWanted(1, 'Witnessed carjacking! Wanted level up.');
        spawnPed(c.x + 40, c.y + 40);
      } else {
        p.inCar = c;
        c.driver = true;
      }
    }
  }

  function melee() {
    const p = state.player;
    if (p.meleeCd > 0) return;
    p.meleeCd = 0.45;
    audioRef.melee();
    const hx = p.x + Math.cos(p.angle) * 34;
    const hy = p.y + Math.sin(p.angle) * 34;
    for (const ped of state.peds) {
      if (ped.mode === 'down') continue;
      if (dist(hx, hy, ped.x, ped.y) < 36) {
        ped.mode = 'down';
        ped.down = 2.2;
        ped.cash = Math.max(0, ped.cash);
        state.cashDrops.push({ x: ped.x, y: ped.y, amount: ped.cash, life: 12 });
        state.stats.pedsHit += 1;
        addParticles(ped.x, ped.y, 8, '#e8e8e8', 120, 0.4);
        if (nearbyWitness(p.x, p.y, 500)) addWanted(1, 'Assault witnessed! Wanted level up.');
        return;
      }
    }
    for (const c of state.cars) {
      if (c.police) continue;
      if (dist(hx, hy, c.x, c.y) < 44) {
        c.damage += 4;
        addParticles(c.x, c.y, 6, '#f2c94c', 140, 0.35);
      }
    }
  }

  function shoot() {
    const p = state.player;
    if (p.shootCd > 0) return;
    p.shootCd = 0.22;
    state.ammo -= 1;
    audioRef.gunshot();
    state.shake = Math.max(state.shake, 3);
    const mx = inputRef.mouse.worldX;
    const my = inputRef.mouse.worldY;
    const a = angleTo(p.x, p.y, mx, my);
    const range = 620;
    const ex = p.x + Math.cos(a) * range;
    const ey = p.y + Math.sin(a) * range;
    let hitX = ex;
    let hitY = ey;
    let bestT = range;
    // Hitscan against peds, cops and cars.
    for (const ped of state.peds) {
      if (ped.mode === 'down') continue;
      const t = rayHit(p.x, p.y, a, ped.x, ped.y, 16, range);
      if (t !== null && t < bestT) { bestT = t; hitX = p.x + Math.cos(a) * t; hitY = p.y + Math.sin(a) * t; ped.mode = 'down'; ped.down = 2.2; state.cashDrops.push({ x: ped.x, y: ped.y, amount: ped.cash, life: 12 }); }
    }
    for (const cop of state.cops) {
      const t = rayHit(p.x, p.y, a, cop.x, cop.y, 16, range);
      if (t !== null && t < bestT) { bestT = t; hitX = p.x + Math.cos(a) * t; hitY = p.y + Math.sin(a) * t; cop.hp -= 50; if (cop.hp <= 0) cop.down = true; }
    }
    for (const c of state.cars) {
      const t = rayHit(p.x, p.y, a, c.x, c.y, 30, range);
      if (t !== null && t < bestT) { bestT = t; hitX = p.x + Math.cos(a) * t; hitY = p.y + Math.sin(a) * t; c.damage += 12; if (c.driver && c !== p.inCar) c.driver = false; }
    }
    state.tracers.push({ x1: p.x, y1: p.y, x2: hitX, y2: hitY, life: 0.12 });
    addParticles(hitX, hitY, 5, '#f2c94c', 120, 0.3);
    addWanted(1, 'Shots fired! Wanted level up.');
  }

  function rayHit(ox, oy, a, cx, cy, r, range) {
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const rx = cx - ox;
    const ry = cy - oy;
    const t = rx * dx + ry * dy;
    if (t < 0 || t > range) return null;
    const px = ox + dx * t;
    const py = oy + dy * t;
    if (dist(px, py, cx, cy) < r) return t;
    return null;
  }

  function stepDriving(dt, input) {
    const p = state.player;
    const c = p.inCar;
    if (!c) return;
    const type = CAR_TYPES[c.type];
    const steer = input.moveX();
    const gas = input.held.up;
    const rev = input.held.down;
    const hand = input.held.brake;
    const speedSign = c.speed >= 0 ? 1 : -1;
    if (gas) c.speed += type.accel * dt;
    else if (rev) {
      if (c.speed > 30) c.speed -= type.accel * 1.4 * dt;
      else c.speed -= type.accel * 0.7 * dt;
    } else {
      c.speed -= c.speed * 0.6 * dt;
    }
    if (hand) {
      c.speed -= c.speed * 2.2 * dt;
      if (Math.abs(c.speed) > 120 && Math.random() < 0.3) {
        state.skids.push({ x: c.x, y: c.y, angle: c.angle, life: 2.5 });
      }
    }
    c.speed = clamp(c.speed, -type.top * 0.45, type.top);
    const turn = steer * type.grip * dt * clamp(Math.abs(c.speed) / 120, 0, 1) * speedSign;
    c.angle += turn * (hand ? 1.6 : 1);
    const nx = c.x + Math.cos(c.angle) * c.speed * dt;
    const ny = c.y + Math.sin(c.angle) * c.speed * dt;
    c.x = nx;
    c.y = ny;
    c.brake = rev || hand;
    p.x = c.x;
    p.y = c.y;
    p.angle = c.angle;
    // Buildings block the car.
    const before = { x: c.x, y: c.y };
    if (city.resolveCircle(c, 24)) {
      const impact = Math.abs(c.speed);
      if (impact > 160) {
        c.damage += impact * 0.03;
        addParticles(c.x, c.y, 8, '#f2c94c', 180, 0.4);
        state.shake = Math.min(9, impact * 0.02);
        audioRef.crash();
        c.speed *= -0.25;
      } else {
        c.speed *= 0.4;
      }
      void before;
    }
    if (c.damage > 60 && Math.random() < 0.2) {
      state.particles.push({ x: c.x, y: c.y - 10, vx: random.range(-10, 10), vy: -30, life: 1, maxLife: 1, color: '#888', size: 5 });
    }
    if (c.damage >= 100) {
      // Car wrecked: bail out.
      addParticles(c.x, c.y, 30, '#ff8844', 260, 0.8);
      state.cars.splice(state.cars.indexOf(c), 1);
      p.inCar = null;
      p.x = c.x + 50;
      p.y = c.y;
      state.shake = 12;
      audioRef.crash();
      say('Your car is wrecked!', 2.5);
    }
    // Running over peds.
    for (const ped of state.peds) {
      if (ped.mode === 'down') continue;
      if (dist(c.x, c.y, ped.x, ped.y) < 30 && Math.abs(c.speed) > 60) {
        ped.mode = 'down';
        ped.down = 2.2;
        state.cashDrops.push({ x: ped.x, y: ped.y, amount: ped.cash, life: 12 });
        state.stats.pedsHit += 1;
        state.shake = Math.max(state.shake, 5);
        audioRef.crash();
        if (nearbyWitness(c.x, c.y, 500)) addWanted(1, 'Hit-and-run witnessed! Wanted level up.');
      }
    }
    // Exit the car.
    if (input.takeActions && false) { /* handled below via actions param */ }
    // E is handled by the caller through actions.
    audioRef.engine(Math.abs(c.speed) / type.top, true);
  }

  let inputRef = { mouse: { worldX: 0, worldY: 0 } };

  function stepWanted(dt) {
    const p = state.player;
    // Police spawn to match the wanted level.
    const wantCars = state.wanted >= 1 ? Math.min(2 + state.wanted, 7) : 0;
    const policeCars = state.cars.filter((c) => c.police).length;
    if (policeCars < wantCars && Math.random() < dt * 0.8) {
      const a = random.range(0, Math.PI * 2);
      const d = random.range(600, 900);
      const c = addCar(clamp(p.x + Math.cos(a) * d, 300, 4200), clamp(p.y + Math.sin(a) * d, 300, 4200), 0, 1, '#20242c', { police: true, driver: true });
      c.speed = 300;
      c.siren = true;
    }
    // Foot cops near stations when wanted.
    if (state.wanted >= 2 && state.cops.length < state.wanted && Math.random() < dt * 0.5) {
      const a = random.range(0, Math.PI * 2);
      state.cops.push({ x: p.x + Math.cos(a) * 500, y: p.y + Math.sin(a) * 500, angle: 0, hp: 100, down: false, speed: 130 });
    }
    // Lose the heat: no police close by for a while, stars blink then drain.
    let nearest = Infinity;
    for (const c of state.cars) if (c.police) nearest = Math.min(nearest, dist(p.x, p.y, c.x, c.y));
    for (const cop of state.cops) if (!cop.down) nearest = Math.min(nearest, dist(p.x, p.y, cop.x, cop.y));
    if (state.wanted > 0) {
      if (nearest > 520) {
        state.hiddenTimer += dt;
        state.wantedBlink = state.hiddenTimer > 2;
        if (state.hiddenTimer > 9) {
          state.wanted -= 1;
          state.hiddenTimer = 0;
          state.wantedBlink = false;
          say(state.wanted === 0 ? 'You lost them. Clean.' : 'Heat is cooling off…', 2.5);
        }
      } else {
        state.hiddenTimer = 0;
        state.wantedBlink = false;
      }
    }
    // Busted: a cop car boxes the player in while stopped, or a foot cop touches the player on foot.
    if (state.wanted > 0) {
      if (!p.inCar) {
        for (const cop of state.cops) {
          if (!cop.down && dist(p.x, p.y, cop.x, cop.y) < 26) {
            busted();
            return;
          }
        }
      } else if (Math.abs(p.inCar.speed) < 20) {
        let boxers = 0;
        for (const c of state.cars) if (c.police && dist(p.x, p.y, c.x, c.y) < 130) boxers += 1;
        if (boxers >= 2) {
          state.bustedTimer += dt;
          if (state.bustedTimer > 2.5) { busted(); return; }
        } else state.bustedTimer = 0;
      }
    }
    audioRef.siren(state.wanted > 0, state.time);
  }

  function busted() {
    const fine = Math.min(state.cash, 100 + state.wanted * 50);
    state.cash -= fine;
    state.wanted = 0;
    state.bustedTimer = 0;
    state.player.inCar = null;
    state.player.x = POLICE_STATION.x;
    state.player.y = POLICE_STATION.y + 120;
    state.cars = state.cars.filter((c) => !c.police);
    state.cops.length = 0;
    say(`BUSTED — fined $${fine}. Released at the police station.`, 4);
    audioRef.busted();
  }

  function wasted() {
    const fee = Math.min(state.cash, 150);
    state.cash -= fee;
    state.wanted = 0;
    state.health = 100;
    state.armor = 0;
    state.player.inCar = null;
    state.player.x = HOSPITAL.x;
    state.player.y = HOSPITAL.y + 120;
    state.cars = state.cars.filter((c) => !c.police);
    state.cops.length = 0;
    state.wastedTimer = 0;
    say(`WASTED — hospital bill $${fee}. You keep your mission progress.`, 4);
  }

  function stepTraffic(dt) {
    // Keep the streets alive near the player.
    const nearTraffic = state.cars.filter((c) => c.traffic && dist(c.x, c.y, state.player.x, state.player.y) < 1200).length;
    if (nearTraffic < 10 && Math.random() < dt * 1.5) spawnTrafficCar();
    const nearPeds = state.peds.filter((p) => p.mode !== 'down' && dist(p.x, p.y, state.player.x, state.player.y) < 900).length;
    if (nearPeds < 14 && Math.random() < dt * 2) spawnPed();
    for (const c of state.cars) {
      if (c.police) {
        steerPolice(c, state.player, dt, state, city);
      } else if (c.traffic && c.driver) {
        steerTraffic(c, dt, state, city);
      }
      if (c.damage > 60 && Math.random() < dt * 2) {
        state.particles.push({ x: c.x, y: c.y, vx: random.range(-8, 8), vy: -24, life: 0.9, maxLife: 0.9, color: '#777', size: 4 });
      }
    }
    // Remove far-away traffic and dead peds.
    state.cars = state.cars.filter((c) => {
      if (c.police || c.parked || c === state.player.inCar || c.missionCar) return true;
      if (c.traffic && dist(c.x, c.y, state.player.x, state.player.y) > 1600) return false;
      return true;
    });
    state.cars = state.cars.filter((c) => c.damage < 100 || c === state.player.inCar);
    state.peds = state.peds.filter((p) => p.mode !== 'down' || p.down > 0);
  }

  function stepPeds(dt) {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.mode === 'down') {
        ped.down -= dt;
        if (ped.down <= 0) ped.mode = 'walk';
        continue;
      }
      steerPed(ped, dt, state, city, p);
      // Flee gunfire / fast cars nearby.
      const threat = state.tracers.length > 0 || (p.inCar && Math.abs(p.inCar.speed) > 200 && dist(ped.x, ped.y, p.x, p.y) < 160);
      if (threat && ped.mode !== 'flee') { ped.mode = 'flee'; ped.timer = 2.5; }
    }
    // Foot cops chase on foot.
    for (const cop of state.cops) {
      if (cop.down) continue;
      const d = dist(cop.x, cop.y, p.x, p.y);
      if (d > 24) {
        const a = angleTo(cop.x, cop.y, p.x, p.y);
        cop.angle = a;
        cop.x += Math.cos(a) * cop.speed * dt;
        cop.y += Math.sin(a) * cop.speed * dt;
        city.resolveCircle(cop, 12);
      }
    }
    state.cops = state.cops.filter((c) => !c.down && dist(c.x, c.y, p.x, p.y) < 1800);
  }

  function stepPickups(dt) {
    const p = state.player;
    for (const pk of state.pickups) {
      if (pk.taken) {
        pk.respawn -= dt;
        if (pk.respawn <= 0) pk.taken = false;
        continue;
      }
      if (dist(p.x, p.y, pk.x, pk.y) < 42 && !p.inCar) {
        pk.taken = true;
        pk.respawn = 45;
        if (pk.kind === 'ammo') { state.ammo += 36; say('Ammo +36', 2); }
        else if (pk.kind === 'armor') { state.armor = 100; say('Body armour equipped', 2); }
        else { state.health = 100; say('Health restored', 2); }
        audioRef.pickup();
      }
    }
    for (const drop of state.cashDrops) {
      drop.life -= dt;
      if (drop.life > 0 && dist(p.x, p.y, drop.x, drop.y) < 36 && !p.inCar) {
        state.cash += drop.amount;
        drop.life = 0;
        say(`+$${drop.amount}`, 1.5);
        audioRef.cash();
      }
    }
    state.cashDrops = state.cashDrops.filter((d) => d.life > 0);
    // Pearls on foot.
    for (const pearl of city.pearls) {
      if (!pearl.taken && dist(p.x, p.y, pearl.x, pearl.y) < 40) {
        pearl.taken = true;
        state.pearls += 1;
        state.pearlsTaken += 1;
        state.cash += 50;
        say(`Harbour pearl ${state.pearls}/20 — +$50`, 2.5);
        audioRef.pickup();
      }
    }
  }

  function stepParticles(dt) {
    for (const pt of state.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.98;
      pt.vy *= 0.98;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);
    for (const t of state.tracers) t.life -= dt;
    state.tracers = state.tracers.filter((t) => t.life > 0);
    for (const s of state.skids) s.life -= dt;
    state.skids = state.skids.filter((s) => s.life > 0);
    if (state.toastTimer > 0) state.toastTimer -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 22);
  }

  function step(dt, input, actions) {
    inputRef = input;
    state.time += dt;
    state.dayT = (state.dayT + dt / 240) % 1;
    if (state.wastedTimer > 0) {
      state.wastedTimer -= dt;
      if (state.wastedTimer <= 0) wasted();
      return;
    }
    if (state.dialogue) return; // dialogue pauses the world
    const p = state.player;
    // Exit car with E while driving.
    if (p.inCar && (actions & 4)) {
      const c = p.inCar;
      c.driver = false;
      p.inCar = null;
      p.x = c.x + Math.cos(c.angle + Math.PI / 2) * 40;
      p.y = c.y + Math.sin(c.angle + Math.PI / 2) * 40;
      audioRef.engine(0, false);
    }
    if (p.inCar) stepDriving(dt, input);
    else stepPlayer(dt, input, actions);
    collideCars(dt);
    stepTraffic(dt);
    stepPeds(dt);
    stepWanted(dt);
    stepPickups(dt);
    stepParticles(dt);
    // Taxi fare.
    if (state.taxi && p.inCar) {
      const d = dist(p.x, p.y, state.taxi.dest.x, state.taxi.dest.y);
      if (d < 70) {
        state.cash += state.taxi.fare;
        say(`Taxi fare collected: $${state.taxi.fare}`, 3);
        audioRef.cash();
        state.taxi = null;
      }
    }
    if (state.courier && !p.inCar) {
      if (dist(p.x, p.y, state.courier.dest.x, state.courier.dest.y) < 70) {
        state.cash += state.courier.pay;
        say(`Parcel delivered: $${state.courier.pay}`, 3);
        audioRef.cash();
        state.courier = null;
      }
    }
    // Safehouse save prompt.
    if (!p.inCar && dist(p.x, p.y, SAFEHOUSE.x, SAFEHOUSE.y) < 90 && (actions & 4)) {
      saveGame();
      say('Game saved at the safehouse.', 2.5);
    }
    if (!p.inCar && dist(p.x, p.y, GARAGE.x, GARAGE.y) < 90 && p.inCar === null && (actions & 4)) {
      // garage repair is handled by missions; here it is just a save point too
    }
  }

  function saveGame() {
    try {
      const data = {
        cash: state.cash, health: state.health, armor: state.armor, ammo: state.ammo,
        hasPistol: state.hasPistol, missionIndex: state.missionIndex, pearls: state.pearls,
        pearlsTaken: state.pearlsTaken, x: state.player.x, y: state.player.y,
        completed: state.completed,
      };
      window.localStorage.setItem('crimson-harbor-save-v1', JSON.stringify(data));
      return true;
    } catch { return false; }
  }

  function loadGame() {
    try {
      const raw = window.localStorage.getItem('crimson-harbor-save-v1');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }

  function applySave(data) {
    state.cash = data.cash ?? 120;
    state.health = data.health ?? 100;
    state.armor = data.armor ?? 0;
    state.ammo = data.ammo ?? 24;
    state.hasPistol = data.hasPistol ?? true;
    state.missionIndex = data.missionIndex ?? 0;
    state.pearls = data.pearls ?? 0;
    state.pearlsTaken = data.pearlsTaken ?? 0;
    state.completed = data.completed ?? false;
    state.player.x = data.x ?? SAFEHOUSE.x;
    state.player.y = data.y ?? SAFEHOUSE.y + 120;
    // Pearls already collected stay collected.
    let n = 0;
    for (const pearl of city.pearls) {
      if (n < state.pearlsTaken) { pearl.taken = true; n += 1; }
    }
  }

  reset(true);
  return {
    state, city, reset, step, saveGame, loadGame, applySave,
    addWanted, say, addParticles, nearestCar, damagePlayer,
    setAudio(a) { audioRef = a; },
    playJingle() { audioRef.jingle(); },
    spawnTrafficCar, spawnPed, addCar,
  };
}
