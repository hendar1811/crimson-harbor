// Steering brains: traffic cars follow road lanes, pedestrians stroll the
// sidewalks and flee trouble, police cars pursue, ram and box in.
import { ROAD_STEP, ROAD_W, WORLD, angleDiff, angleTo, clamp, dist } from './config.js';
import { isOnRoad } from './city.js';

function roadCoord(v) { return Math.round(v / ROAD_STEP) * ROAD_STEP; }

export function steerTraffic(car, dt, state, city) {
  // Follow the route waypoints; at each one, pick the next.
  if (!car.route || car.route.length === 0) return;
  const target = car.route[car.wp];
  const d = dist(car.x, car.y, target.x, target.y);
  if (d < 60) {
    car.wp = (car.wp + 1) % car.route.length;
    return;
  }
  const want = angleTo(car.x, car.y, target.x, target.y);
  const diff = angleDiff(car.angle, want);
  car.angle += clamp(diff, -1.8 * dt, 1.8 * dt);
  // Brake for the car ahead and for pedestrians in the lane.
  let slow = false;
  for (const other of state.cars) {
    if (other === car || other.parked) continue;
    const ahead = (other.x - car.x) * Math.cos(car.angle) + (other.y - car.y) * Math.sin(car.angle);
    const side = Math.abs((other.x - car.x) * -Math.sin(car.angle) + (other.y - car.y) * Math.cos(car.angle));
    if (ahead > 0 && ahead < 110 && side < 40) { slow = true; break; }
  }
  if (!slow) {
    for (const ped of state.peds) {
      if (ped.mode === 'down') continue;
      const ahead = (ped.x - car.x) * Math.cos(car.angle) + (ped.y - car.y) * Math.sin(car.angle);
      const side = Math.abs((ped.x - car.x) * -Math.sin(car.angle) + (ped.y - car.y) * Math.cos(car.angle));
      if (ahead > 0 && ahead < 90 && side < 34) { slow = true; break; }
    }
  }
  const cruise = slow ? 0 : 150;
  car.speed += (cruise - car.speed) * Math.min(1, dt * 1.2);
  car.brake = slow;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Stay inside the world; bounce off buildings by sliding along them.
  const beforeX = car.x;
  const beforeY = car.y;
  city.resolveCircle(car, 24);
  if (car.x !== beforeX || car.y !== beforeY) {
    // Nudged out of a building: slow down and turn away.
    car.speed *= 0.5;
    car.angle += 0.6 * dt * 10;
  }
  car.x = clamp(car.x, 60, WORLD - 60);
  car.y = clamp(car.y, 60, WORLD - 60);
}

export function steerPed(ped, dt, state, city, player) {
  ped.timer -= dt;
  if (ped.mode === 'flee') {
    // Run away from the player / the last tracer.
    const a = angleTo(player.x, player.y, ped.x, ped.y);
    ped.angle = a;
    ped.x += Math.cos(a) * 150 * dt;
    ped.y += Math.sin(a) * 150 * dt;
    if (ped.timer <= 0) { ped.mode = 'walk'; ped.timer = 3; }
  } else if (ped.mode === 'follow') {
    // Taxi passenger: walk to the player's car door and wait.
    const target = player.inCar ? player.inCar : player;
    const d = dist(ped.x, ped.y, target.x, target.y);
    if (d > 40) {
      const a = angleTo(ped.x, ped.y, target.x, target.y);
      ped.angle = a;
      ped.x += Math.cos(a) * 120 * dt;
      ped.y += Math.sin(a) * 120 * dt;
    }
    return;
  } else {
    // Stroll: pick a nearby sidewalk point, walk to it, idle, repeat.
    if (ped.timer <= 0) {
      ped.timer = 3 + Math.random() * 4;
      const gx = roadCoord(ped.x);
      const gy = roadCoord(ped.y);
      // Aim for a point just off the road (on the sidewalk).
      const alongRoad = Math.random() < 0.5;
      if (alongRoad) {
        ped.tx = clamp(ped.x + (Math.random() - 0.5) * 500, 200, 4200);
        ped.ty = gy + (Math.random() < 0.5 ? ROAD_W / 2 + 26 : -ROAD_W / 2 - 26);
      } else {
        ped.tx = gx + (Math.random() < 0.5 ? ROAD_W / 2 + 26 : -ROAD_W / 2 - 26);
        ped.ty = clamp(ped.y + (Math.random() - 0.5) * 500, 200, 4200);
      }
      // Sometimes two peds chat: stand still for a while.
      if (Math.random() < 0.12) ped.timer = 8;
    }
    const d = dist(ped.x, ped.y, ped.tx, ped.ty);
    if (d > 12) {
      const a = angleTo(ped.x, ped.y, ped.tx, ped.ty);
      ped.angle = a;
      ped.x += Math.cos(a) * ped.speed * dt;
      ped.y += Math.sin(a) * ped.speed * dt;
    }
  }
  city.resolveCircle(ped, 12);
  ped.x = clamp(ped.x, 80, WORLD - 80);
  ped.y = clamp(ped.y, 80, WORLD - 80);
}

export function steerPolice(car, player, dt, state, city) {
  // Pursue the player: steer toward them, ram when close, box in when slow.
  const d = dist(car.x, car.y, player.x, player.y);
  const want = angleTo(car.x, car.y, player.x, player.y);
  const diff = angleDiff(car.angle, want);
  const agility = 2.6;
  car.angle += clamp(diff, -agility * dt, agility * dt);
  const top = 520;
  if (d > 90) car.speed += (top - car.speed) * Math.min(1, dt * 0.9);
  else car.speed += (120 - car.speed) * Math.min(1, dt * 2);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  city.resolveCircle(car, 24);
  // Ramming the player's car damages it; ramming the player on foot hurts.
  if (player.inCar && d < 52 && Math.abs(car.speed) > 120) {
    player.inCar.damage += 3;
    state.shake = Math.max(state.shake, 4);
  }
  if (!player.inCar && d < 30 && Math.abs(car.speed) > 100) {
    // The player is knocked down, not killed outright by a ram.
    player.x += Math.cos(car.angle) * 60;
    player.y += Math.sin(car.angle) * 60;
    car.speed *= 0.3;
  }
  car.x = clamp(car.x, 60, WORLD - 60);
  car.y = clamp(car.y, 60, WORLD - 60);
}
