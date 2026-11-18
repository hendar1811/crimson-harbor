// Entities: player, cars, pedestrians, police, pickups, particles.
import { CAR_TYPES } from './config.js';
import { clamp, dist, pick, range } from './random.js';

let nextId = 1;

export function makePlayer(x, y) {
  return {
    id: nextId++, kind: 'player', x, y, angle: -Math.PI / 2, radius: 13,
    speed: 0, hp: 100, armor: 0, cash: 150, onFoot: true, car: null,
    weapon: 'fists', ammo: 0, wanted: 0, wantedTimer: 0, hidden: false,
    pearls: 0, missionsDone: 0, taxiJob: null, courierJob: null,
    shootCd: 0, meleeCd: 0, stealT: 0, stealTarget: null, busted: 0, wasted: 0,
    vx: 0, vy: 0,
  };
}

export function makeCar(x, y, angle, typeIdx, opts = {}) {
  const t = CAR_TYPES[typeIdx];
  return {
    id: nextId++, kind: 'car', x, y, angle, radius: Math.max(t.w, t.h) / 2,
    type: typeIdx, color: opts.color || pick(Math.random, t.colors),
    speed: 0, damage: opts.damage || 0, driver: opts.driver || null,
    police: !!opts.police, parked: !!opts.parked, traffic: !!opts.traffic,
    brake: false, smoke: 0, skid: 0, stuck: 0, target: null,
  };
}

export function makePed(x, y, rng) {
  return {
    id: nextId++, kind: 'ped', x, y, angle: rng() * Math.PI * 2, radius: 11,
    speed: range(rng, 22, 42), state: 'walk', vx: 0, vy: 0,
    color: pick(rng, ['#e67e22', '#3498db', '#9b59b6', '#1abc9c', '#f39c12', '#e74c3c']),
    fleeT: 0, down: false, downT: 0, cash: 5 + Math.floor(rng() * 20),
    walkT: range(rng, 2, 6), chat: rng() < 0.2,
  };
}

export function makePickup(x, y, kind) {
  return { id: nextId++, kind: 'pickup', pkind: kind, x, y, radius: 14, bob: Math.random() * 6 };
}

export class Particles {
  constructor() { this.list = []; }
  add(x, y, opts = {}) {
    for (let i = 0; i < (opts.n || 8); i++) {
      const a = Math.random() * Math.PI * 2, s = (opts.speed || 90) * (0.4 + Math.random() * 0.8);
      this.list.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: opts.life || 0.6, max: opts.life || 0.6,
        color: opts.color || '#f1c40f', size: opts.size || 3, grav: opts.grav || 0,
      });
    }
  }
  smoke(x, y) { this.add(x, y, { n: 2, speed: 24, life: 1.2, color: '#888888', size: 6 }); }
  update(dt) {
    for (const p of this.list) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt;
      p.vx *= 0.98; p.vy *= 0.98;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }
}

// Arcade car physics shared by player-driven and AI cars.
export function driveCar(car, dt, input, city) {
  const t = CAR_TYPES[car.type];
  const steer = input.steer || 0;
  const hand = !!input.handbrake;
  if (input.throttle > 0) car.speed += t.accel * input.throttle * dt;
  if (input.throttle < 0) car.speed += t.accel * 0.7 * input.throttle * dt;
  if (!input.throttle) car.speed *= Math.pow(0.4, dt);
  car.speed = clamp(car.speed, -t.top * 0.45, t.top);
  const grip = hand ? t.grip * 0.45 : t.grip;
  const spd = Math.abs(car.speed);
  car.angle += steer * grip * dt * (spd / t.top) * (car.speed >= 0 ? 1 : -1) * 1.6;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Simple collision: stop and take damage on buildings/water.
  const hw = t.w / 2, hh = t.h / 2;
  if (city.solidAt(nx + Math.cos(car.angle) * hw, ny + Math.sin(car.angle) * hw)
    || city.solidAt(nx - Math.cos(car.angle) * hw, ny - Math.sin(car.angle) * hw)) {
    if (spd > 120) { car.damage += spd * 0.02; car.speed *= -0.25; }
    else car.speed *= 0.5;
  } else {
    car.x = nx; car.y = ny;
  }
  car.x = clamp(car.x, 30, 4770); car.y = clamp(car.y, 30, 4770);
  car.brake = input.throttle < 0 || hand;
  if (hand && spd > 140) car.skid = 0.3;
  if (car.damage > 60) car.smoke += dt;
  return car;
}

export function carHitsCar(a, b) {
  return dist(a.x, a.y, b.x, b.y) < (a.radius + b.radius) * 0.85;
}
