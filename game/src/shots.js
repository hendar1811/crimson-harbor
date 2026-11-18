// Deterministic shot scenes: ?shot=title|city|chase|mission&seed=7
// Each scene stages the world, runs a short autopilot, then sets
// window.__shotReady = true once the frame is staged.
import { makeCar, makePed } from './entities.js';
import { MISSIONS } from './missions.js';

export function applyShotScene(game, shot, seed) {
  const g = game, p = g.player;
  const rng = () => Math.random();
  if (shot === 'title') {
    g.state = 'title';
    g.cam.x = 2400; g.cam.y = 1800;
    g.time = 0.78; // dusk
    setTimeout(() => { window.__shotReady = true; }, 600);
    return;
  }
  g.state = 'play';
  if (shot === 'city') {
    g.time = 0.78; // dusk
    const car = makeCar(1800, 2100, Math.PI / 2, 1, {});
    car.speed = 260;
    g.cars.push(car);
    p.car = car; p.onFoot = false; p.x = car.x; p.y = car.y;
    p.weapon = 'pistol'; p.ammo = 48;
    // Surrounding traffic on the same avenue.
    for (let i = 0; i < 8; i++) {
      const c = makeCar(1800 + (i % 2 ? 60 : -60), 1500 + i * 220, i % 2 ? -Math.PI / 2 : Math.PI / 2, i % 5, { traffic: true });
      c.speed = 140 + i * 10;
      g.cars.push(c);
    }
    for (let i = 0; i < 10; i++) g.peds.push(makePed(1500 + i * 120, 2250 + (i % 3) * 40, rng));
    g.autopilot = { throttle: 1, steer: 0 }; // cruise straight down the avenue
    g.cam.x = p.x; g.cam.y = p.y;
    g.objective = 'Cruise the city — traffic, dusk, Palm Beach ahead';
    setTimeout(() => { window.__shotReady = true; }, 1500);
    return;
  }
  if (shot === 'chase') {
    g.time = 0.15; // night
    const car = makeCar(1800, 1800, 0, 0, {});
    car.speed = 300;
    g.cars.push(car);
    p.car = car; p.onFoot = false; p.x = car.x; p.y = car.y;
    p.wanted = 3; p.wantedTimer = 0;
    g.autopilot = { throttle: 1, steer: 0 }; // fleeing straight down the road
    // Three pursuit cars.
    for (let i = 0; i < 3; i++) {
      const a = Math.PI + (i - 1) * 0.5;
      const cop = makeCar(p.x + Math.cos(a) * 320, p.y + Math.sin(a) * 320, Math.atan2(p.y - (p.y + Math.sin(a) * 320), p.x - (p.x + Math.cos(a) * 320)), 5, { police: true });
      cop.speed = 280;
      g.cars.push(cop);
    }
    g.cam.x = p.x; g.cam.y = p.y;
    g.objective = 'Lose the 3-star wanted level!';
    setTimeout(() => { window.__shotReady = true; }, 1500);
    return;
  }
  if (shot === 'mission') {
    g.time = 0.3; // morning
    const car = makeCar(3600, 1200, 0, 3, {});
    car.speed = 200;
    g.cars.push(car);
    p.car = car; p.onFoot = false; p.x = car.x; p.y = car.y;
    p.weapon = 'pistol'; p.ammo = 36;
    g.autopilot = { throttle: 0.7, steer: 0 }; // rolling toward the docks
    g.missions.start(0);
    // Marla's package marker is the mission waypoint; add a couple of peds.
    for (let i = 0; i < 6; i++) g.peds.push(makePed(3950 + i * 40, 1250 + (i % 2) * 60, rng));
    g.cam.x = p.x; g.cam.y = p.y;
    setTimeout(() => { window.__shotReady = true; }, 1500);
    return;
  }
  window.__shotReady = true;
}
