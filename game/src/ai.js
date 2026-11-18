// Traffic, pedestrian and police AI.
import { TILE, ROAD_W, WORLD } from './config.js';
import { angDiff, clamp, dist, angleTo } from './random.js';
import { driveCar, carHitsCar } from './entities.js';

export function spawnTrafficCar(state, rng, near) {
  const tIdx = Math.floor(rng() * 5);
  let x, y, angle;
  if (near) { x = near.x + (rng() - 0.5) * 900; y = near.y + (rng() - 0.5) * 900; }
  else { x = rng() * WORLD; y = rng() * WORLD; }
  // Snap onto a road and face along it.
  const rx = Math.round(x / TILE) * TILE, ry = Math.round(y / TILE) * TILE;
  if (Math.abs(rx - x) < Math.abs(ry - y)) { x = rx + (rng() < 0.5 ? -ROAD_W / 4 : ROAD_W / 4); y = Math.round(y / TILE) * TILE + (rng() < 0.5 ? -ROAD_W / 4 : ROAD_W / 4); angle = rng() < 0.5 ? 0 : Math.PI; }
  else { y = ry + (rng() < 0.5 ? -ROAD_W / 4 : ROAD_W / 4); x = Math.round(x / TILE) * TILE + (rng() < 0.5 ? -ROAD_W / 4 : ROAD_W / 4); angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2; }
  return { x, y, angle, typeIdx: tIdx };
}

export function updateTraffic(state, dt, rng) {
  const { city, cars, player } = state;
  // Keep traffic topped up near the player.
  const traffic = cars.filter((c) => c.traffic);
  if (traffic.length < 16 && Math.random() < dt * 2) {
    const s = spawnTrafficCar(state, rng, player);
    const { makeCar } = state._factories;
    const car = makeCar(s.x, s.y, s.angle, s.typeIdx, { traffic: true });
    car.speed = 120 + rng() * 80;
    cars.push(car);
  }
  for (const car of traffic) {
    // Follow the road: steer toward the lane centre line ahead.
    const aheadX = car.x + Math.cos(car.angle) * 120;
    const aheadY = car.y + Math.sin(car.angle) * 120;
    const alongX = Math.abs(Math.cos(car.angle)) > Math.abs(Math.sin(car.angle));
    let steer = 0;
    if (alongX) {
      const laneY = Math.round(aheadY / TILE) * TILE + (Math.sin(car.angle) > 0 ? -ROAD_W / 4 : ROAD_W / 4);
      steer = clamp((laneY - car.y) / 60, -1, 1) * (Math.cos(car.angle) > 0 ? 1 : -1) * -1;
      // At an intersection keep going straight most of the time, sometimes turn.
      if (Math.abs((car.x % TILE) - TILE / 2) > TILE / 2 - 40 && rng() < dt * 0.4) {
        car.angle += (rng() < 0.5 ? 1 : -1) * Math.PI / 2;
      }
    } else {
      const laneX = Math.round(aheadX / TILE) * TILE + (Math.cos(car.angle) > 0 ? -ROAD_W / 4 : ROAD_W / 4);
      steer = clamp((laneX - car.x) / 60, -1, 1) * (Math.sin(car.angle) > 0 ? 1 : -1);
      if (Math.abs((car.y % TILE) - TILE / 2) > TILE / 2 - 40 && rng() < dt * 0.4) {
        car.angle += (rng() < 0.5 ? 1 : -1) * Math.PI / 2;
      }
    }
    // Brake for a car or ped ahead.
    let throttle = 0.6;
    for (const o of cars) {
      if (o === car) continue;
      const d = dist(car.x, car.y, o.x, o.y);
      if (d < 110 && Math.abs(angDiff(car.angle, angleTo(car.x, car.y, o.x, o.y))) < 0.6) { throttle = -0.5; break; }
    }
    if (throttle > 0) for (const p of state.peds) {
      if (p.down) continue;
      const d = dist(car.x, car.y, p.x, p.y);
      if (d < 90 && Math.abs(angDiff(car.angle, angleTo(car.x, car.y, p.x, p.y))) < 0.5) { throttle = -0.5; break; }
    }
    // Fleeing peds near a fast car.
    driveCar(car, dt, { steer, throttle, handbrake: false }, city);
  }
  // Remove traffic far away.
  for (let i = cars.length - 1; i >= 0; i--) {
    const c = cars[i];
    if (c.traffic && dist(c.x, c.y, player.x, player.y) > 1600) cars.splice(i, 1);
  }
}

export function updatePeds(state, dt, rng) {
  const { city, peds, player, cars } = state;
  if (peds.length < 26 && Math.random() < dt * 3) {
    const s = spawnTrafficCar(state, rng, player);
    const { makePed } = state._factories;
    peds.push(makePed(s.x, s.y, rng));
  }
  for (const p of peds) {
    if (p.down) { p.downT -= dt; if (p.downT <= 0) peds.splice(peds.indexOf(p), 1); continue; }
    // Flee from gunfire / fast cars nearby.
    let flee = p.fleeT > 0;
    if (!flee) for (const c of cars) {
      if (Math.abs(c.speed) > 200 && dist(c.x, c.y, p.x, p.y) < 130) { flee = true; p.fleeT = 1.5; break; }
    }
    if (state.gunshotT > 0 && dist(p.x, p.y, player.x, player.y) < 500) { flee = true; p.fleeT = 2; }
    p.fleeT = Math.max(0, p.fleeT - dt);
    const speed = flee ? p.speed * 2.6 : p.speed;
    if (p.chat && !flee) { p.walkT -= dt; if (p.walkT <= 0) { p.walkT = 3 + rng() * 4; p.angle = rng() * Math.PI * 2; } }
    else {
      p.walkT -= dt;
      if (p.walkT <= 0) { p.walkT = 3 + rng() * 5; p.angle = rng() * Math.PI * 2; }
      if (flee) p.angle = angleTo(player.x, player.y, p.x, p.y);
      const nx = p.x + Math.cos(p.angle) * speed * dt;
      const ny = p.y + Math.sin(p.angle) * speed * dt;
      if (!city.solidAt(nx, ny)) { p.x = nx; p.y = ny; }
      else p.angle += Math.PI / 2;
      // Keep peds near sidewalks: nudge off the road centre.
      if (city.isOnRoad && Math.random() < dt * 0.2) { /* cosmetic only */ }
    }
    p.x = clamp(p.x, 40, WORLD - 40); p.y = clamp(p.y, 40, WORLD - 40);
  }
  for (let i = peds.length - 1; i >= 0; i--) {
    if (dist(peds[i].x, peds[i].y, player.x, player.y) > 1800) peds.splice(i, 1);
  }
}

export function updatePolice(state, dt, rng) {
  const { player, cars, city } = state;
  const cops = cars.filter((c) => c.police);
  const want = player.wanted;
  // Spawn pursuit cars up to the wanted level.
  const target = want === 0 ? 0 : Math.min(want, 4);
  if (cops.length < target && Math.random() < dt * 1.2) {
    const a = rng() * Math.PI * 2;
    const { makeCar } = state._factories;
    const car = makeCar(player.x + Math.cos(a) * 700, player.y + Math.sin(a) * 700, angleTo(player.x + Math.cos(a) * 700, player.y + Math.sin(a) * 700, player.x, player.y), 5, { police: true });
    car.speed = 200;
    cars.push(car);
  }
  for (const cop of cops) {
    if (want === 0) {
      // No wanted level: cruise away and despawn.
      driveCar(cop, dt, { steer: 0, throttle: 0.4, handbrake: false }, city);
      if (dist(cop.x, cop.y, player.x, player.y) > 1200) cars.splice(cars.indexOf(cop), 1);
      continue;
    }
    const targetPos = player.car || player;
    const d = dist(cop.x, cop.y, targetPos.x, targetPos.y);
    const desired = angleTo(cop.x, cop.y, targetPos.x, targetPos.y);
    const steer = clamp(angDiff(cop.angle, desired) * 1.6, -1, 1);
    let throttle = d > 90 ? 1 : 0.2;
    // Ram: if close and aligned, full speed.
    if (d < 160) throttle = 1;
    driveCar(cop, dt, { steer, throttle, handbrake: false }, city);
    // Ram damage on contact.
    if (player.car && carHitsCar(cop, player.car)) {
      player.car.damage += 12 * dt * 10;
      player.car.speed *= 0.9;
      state.shake = Math.max(state.shake, 6);
      if (Math.random() < dt * 2) state.audio.crash();
    }
    if (!player.car && d < 46) {
      // Caught on foot: busted.
      state.busted = true;
    }
  }
  // Roadblocks from 3 stars: two parked police cars across the road ahead.
  if (want >= 3 && !state.roadblock && Math.random() < dt * 0.15) {
    const a = player.angle || 0;
    const bx = player.x + Math.cos(a) * 500, by = player.y + Math.sin(a) * 500;
    const { makeCar } = state._factories;
    const c1 = makeCar(bx, by - 30, a + Math.PI / 2, 5, { police: true });
    const c2 = makeCar(bx, by + 30, a + Math.PI / 2, 5, { police: true });
    c1.speed = 0; c2.speed = 0;
    cars.push(c1, c2);
    state.roadblock = { x: bx, y: by, t: 12 };
    state.toast('Roadblock ahead!', 3);
  }
  if (state.roadblock) {
    state.roadblock.t -= dt;
    if (state.roadblock.t <= 0) state.roadblock = null;
  }
  // Wanted drain when hidden (out of sight of police for a while).
  if (want > 0) {
    const nearestCop = cops.length ? Math.min(...cops.map((c) => dist(c.x, c.y, player.x, player.y))) : 9999;
    if (nearestCop > 500) {
      player.wantedTimer += dt;
      if (player.wantedTimer > 6) {
        player.wanted = Math.max(0, player.wanted - 1);
        player.wantedTimer = 0;
        if (player.wanted === 0) state.toast('You lost the cops.', 3);
      }
    } else player.wantedTimer = 0;
  }
}
