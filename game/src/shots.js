// Screenshot scenes: ?shot=title|city|chase|mission&seed=7
// Each one builds the real world from a fixed seed, stages the actors,
// drives the simulation forward a few seconds with a simple autopilot,
// and returns the screen to paint. The same seed always gives the same frame.
import { STEP } from './config.js';

function fakeInput() {
  return {
    held: { up: true, down: false, left: false, right: false, run: false, brake: false },
    mouse: { x: 640, y: 300, worldX: 0, worldY: 0 },
    moveX() { return (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0); },
    moveY() { return (this.held.down ? 1 : 0) - (this.held.up ? 1 : 0); },
    takeActions() { return 0; },
  };
}

// Steer the player's car toward a target point.
function driveToward(world, input, tx, ty, seconds) {
  const p = world.state.player;
  for (let i = 0; i < seconds / STEP; i += 1) {
    const dx = tx - p.x;
    const dy = ty - p.y;
    const want = Math.atan2(dy, dx);
    let diff = want - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    input.held.left = diff < -0.15;
    input.held.right = diff > 0.15;
    input.held.up = true;
    input.held.brake = Math.abs(diff) > 1.2;
    world.step(STEP, input, 0);
    if (!p.inCar) break;
  }
}

function putPlayerInCar(world, x, y) {
  const st = world.state;
  let best = null;
  let bd = Infinity;
  for (const c of st.cars) {
    if (c.police || c.parked) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bd) { bd = d; best = c; }
  }
  // If the nearest car is far away, stage a fresh one at the spot instead of
  // teleporting the player across town to whatever traffic happens to be near.
  if (!best || bd > 400) {
    best = world.addCar(x, y, 0, 2, '#c8102e', { driver: true });
  }
  best.driver = true;
  best.parked = false;
  st.player.inCar = best;
  st.player.x = best.x;
  st.player.y = best.y;
  st.player.angle = best.angle;
  return best;
}

export function stageShot(name, world, missions) {
  const st = world.state;
  const input = fakeInput();
  world.reset(true);
  if (name === 'title') {
    // Dusk city pan: the player drives slowly through Downtown behind the title.
    st.dayT = 0.82;
    putPlayerInCar(world, 1800, 1800);
    driveToward(world, input, 3000, 1800, 6);
    return { screen: 'title', hasSave: false };
  }
  if (name === 'city') {
    // Dusk drive in traffic, Downtown.
    st.dayT = 0.86;
    putPlayerInCar(world, 1800, 1800);
    for (let i = 0; i < 5; i += 1) world.spawnTrafficCar();
    driveToward(world, input, 3000, 2400, 7);
    return { screen: 'play', hasSave: false };
  }
  if (name === 'chase') {
    // Three-star pursuit near the harbor.
    st.dayT = 0.55;
    putPlayerInCar(world, 3600, 1800);
    world.addWanted(3, '');
    st.wanted = 3;
    // Flee along the roads (x=3600 south, then y=3600 east) so the car keeps
    // moving: cutting across blocks hits buildings and lets police box it in.
    // Short run so the frame catches the pursuit mid-flight, not the box-in.
    driveToward(world, input, 3600, 3300, 3);
    driveToward(world, input, 3900, 3600, 1.5);
    return { screen: 'play', hasSave: false };
  }
  // mission: the first job is live, the gold marker points at Pier 4.
  st.dayT = 0.35;
  missions.startMission(0);
  st.dialogue = null; // skip the intro lines for the shot
  st.player.x = 4200;
  st.player.y = 1500;
  putPlayerInCar(world, 4200, 1500);
  // Drive north along the harbor road toward the Pier 4 marker.
  driveToward(world, input, 4200, 950, 3);
  return { screen: 'play', hasSave: false };
}
