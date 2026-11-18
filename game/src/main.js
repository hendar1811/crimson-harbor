// Crimson Harbor — game state, loop, combat, wanted system, side jobs, save/load.
import { WORLD, DAY_LEN, SAVE_KEY, START_CASH, PEARL_TOTAL, RADIO } from './config.js';
import { clamp, dist, mulberry32, pick, range, angleTo } from './random.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { City, isOnRoad } from './city.js';
import { makePlayer, makeCar, makePed, makePickup, Particles, driveCar, carHitsCar } from './entities.js';
import { updateTraffic, updatePeds, updatePolice, spawnTrafficCar } from './ai.js';
import { MissionRunner, MISSIONS } from './missions.js';
import { drawWorld } from './render.js';
import { drawHUD, drawTitle, drawPause } from './hud.js';
import { applyShotScene } from './shots.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.view = { w: canvas.width, h: canvas.height };
    this.input = new Input(canvas);
    this.audio = new AudioSys();
    this.particles = new Particles();
    this.rng = mulberry32(7);
    this.state = 'title'; // title | play | pause | busted | wasted
    this.time = 0.35; // day fraction (morning)
    this.cam = { x: WORLD / 2, y: WORLD / 2 };
    this.shake = 0;
    this.skids = [];
    this.toasts = [];
    this.dialogue = null;
    this.dialogueT = 0;
    this.objective = '';
    this.menuSel = 0;
    this.menuOpts = [];
    this.gunshotT = 0;
    this.busted = false;
    this.raceCp = null;
    this.roadblock = null;
    this.hasSave = false;
    try { this.hasSave = !!localStorage.getItem(SAVE_KEY); } catch (e) {}
    this.shot = new URLSearchParams(location.search).get('shot');
    this.seed = parseInt(new URLSearchParams(location.search).get('seed') || '7', 10);
    this.newGame(this.seed);
    if (this.shot) applyShotScene(this, this.shot, this.seed);
    this.last = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  newGame(seed) {
    this.city = new City(seed);
    this.player = makePlayer(1350, 3450);
    this.cars = [];
    this.peds = [];
    this.pickups = [];
    this.missions = new MissionRunner(this);
    this.time = 0.35;
    this.objective = 'Visit Marla\'s diner to start the first mission';
    this._factories = { makeCar, makePed };
    // Parked cars in the lots.
    for (const lot of this.city.parkingLots) {
      for (let i = 0; i < 3; i++) {
        const car = makeCar(lot.x + i * 60 - 60, lot.y + (i % 2) * 40, (i % 2) * Math.PI, Math.floor(this.rng() * 5), { parked: true });
        this.cars.push(car);
      }
    }
    // A red Coupe for mission 2, parked by the beach.
    const coupe = makeCar(3300, 4050, Math.PI / 2, 1, { parked: true, color: '#e74c3c' });
    this.cars.push(coupe);
    // Pickups near the ammo shop.
    this.pickups.push(makePickup(1950, 2200, 'ammo'), makePickup(1990, 2200, 'armor'), makePickup(2030, 2200, 'health'));
    // Initial traffic + peds.
    for (let i = 0; i < 12; i++) {
      const s = spawnTrafficCar(this, this.rng, this.player);
      const car = makeCar(s.x, s.y, s.angle, s.typeIdx, { traffic: true });
      car.speed = 120 + this.rng() * 80;
      this.cars.push(car);
    }
    for (let i = 0; i < 20; i++) {
      const s = spawnTrafficCar(this, this.rng, this.player);
      this.peds.push(makePed(s.x, s.y, this.rng));
    }
  }

  save() {
    try {
      const p = this.player;
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        x: p.x, y: p.y, cash: p.cash, hp: p.hp, armor: p.armor,
        missionsDone: p.missionsDone, pearls: p.pearls, weapon: p.weapon, ammo: p.ammo,
        pearlsTaken: this.city.pearls.map((pr) => pr.taken),
      }));
      this.hasSave = true;
    } catch (e) {}
  }
  load() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!d) return false;
      const p = this.player;
      p.x = d.x; p.y = d.y; p.cash = d.cash; p.hp = d.hp; p.armor = d.armor;
      p.missionsDone = d.missionsDone; p.pearls = d.pearls; p.weapon = d.weapon; p.ammo = d.ammo;
      d.pearlsTaken.forEach((t, i) => { if (this.city.pearls[i]) this.city.pearls[i].taken = t; });
      this.objective = p.missionsDone >= MISSIONS.length ? 'All missions complete — free roam!' : 'Visit Marla\'s diner to start the next mission';
      return true;
    } catch (e) { return false; }
  }

  toast(text, dur = 3) { this.toasts.push({ text, t: dur }); }
  addWanted(n, why) {
    const p = this.player;
    if (p.wanted < 5) {
      p.wanted = Math.min(5, p.wanted + n);
      p.wantedTimer = 0;
      this.toast(`Wanted level ${p.wanted} — ${why}`, 3);
    }
  }

  frame(dt) {
    const inp = this.input;
    if (inp.pressed('m')) { this.audio.muted = !this.audio.muted; this.toast(this.audio.muted ? 'Muted' : 'Sound on', 2); }
    if (this.state === 'title') {
      this.time += dt / DAY_LEN;
      this.cam.x = 2400 + Math.cos(this.time * 2) * 600;
      this.cam.y = 2400 + Math.sin(this.time * 2) * 600;
      if (inp.pressed('arrowup') || inp.pressed('w')) this.menuSel = Math.max(0, this.menuSel - 1);
      if (inp.pressed('arrowdown') || inp.pressed('s')) this.menuSel = Math.min(this.menuOpts.length - 1, this.menuSel + 1);
      if (inp.pressed('enter') || inp.consumeClick()) {
        const opt = this.menuOpts[this.menuSel];
        this.audio.ensure();
        if (opt === 'NEW GAME') { this.newGame(this.seed); this.state = 'play'; this.toast('Welcome to Crimson Harbor', 4); }
        else if (opt === 'CONTINUE') { this.load(); this.state = 'play'; }
        else if (opt === 'HOW TO PLAY') { this.toast('WASD move, E car, F melee, click shoot, P pause', 5); }
      }
      this.render();
      return;
    }
    if (this.state === 'pause') {
      if (inp.pressed('arrowup') || inp.pressed('w')) this.menuSel = Math.max(0, this.menuSel - 1);
      if (inp.pressed('arrowdown') || inp.pressed('s')) this.menuSel = Math.min(this.menuOpts.length - 1, this.menuSel + 1);
      if (inp.pressed('enter') || inp.pressed('p') || inp.pressed('escape')) {
        const opt = this.menuOpts[this.menuSel];
        if (opt === 'RESUME' || inp.pressed('p') || inp.pressed('escape')) this.state = 'play';
        else if (opt === 'SAVE GAME') { this.save(); this.toast('Game saved', 2); }
        else if (opt === 'RESTART') { this.newGame(this.seed); this.state = 'play'; }
        else if (opt === 'QUIT TO TITLE') { this.state = 'title'; this.menuSel = 0; }
      }
      this.render();
      return;
    }
    if (this.state === 'busted' || this.state === 'wasted') {
      if (inp.pressed('enter')) {
        this.state = 'play';
        this.player.hp = 100;
        this.player.wanted = 0;
      }
      this.render();
      return;
    }
    // --- play ---
    if (inp.pressed('p') || inp.pressed('escape')) { this.state = 'pause'; this.menuSel = 0; this.render(); return; }
    if (inp.pressed('r')) { this.audio.station = (this.audio.station + 1) % RADIO.length; this.toast(RADIO[this.audio.station], 2); }
    this.update(dt);
    this.render();
  }

  update(dt) {
    const p = this.player, inp = this.input;
    this.time = (this.time + dt / DAY_LEN) % 1;
    this.gunshotT = Math.max(0, this.gunshotT - dt);
    this.shake = Math.max(0, this.shake - dt * 20);
    this.audio.ensure();
    this.audio.music(dt);
    this.audio.siren(dt, p.wanted);
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
    if (this.dialogue) { this.dialogueT -= dt; if (this.dialogueT <= 0 || inp.pressed('enter')) this.dialogue = null; }
    p.shootCd = Math.max(0, p.shootCd - dt);
    p.meleeCd = Math.max(0, p.meleeCd - dt);

    // Diner: start next mission.
    if (dist(p.x, p.y, this.city.diner.x, this.city.diner.y) < 60 && !this.missions.active && inp.pressed('e')) {
      const next = p.missionsDone;
      if (next < MISSIONS.length) this.missions.start(next);
      else this.toast('All missions complete — free roam!', 3);
    }
    // Safehouse: manual save.
    if (dist(p.x, p.y, this.city.safehouse.x, this.city.safehouse.y) < 60 && inp.pressed('e')) {
      this.save(); this.toast('Saved at the safehouse', 2);
    }

    if (p.car) this.updateDriving(dt);
    else this.updateOnFoot(dt);

    // Car-car collisions.
    for (let i = 0; i < this.cars.length; i++) {
      for (let j = i + 1; j < this.cars.length; j++) {
        const a = this.cars[i], b = this.cars[j];
        if (carHitsCar(a, b)) {
          const overlap = (a.radius + b.radius) * 0.85 - dist(a.x, a.y, b.x, b.y);
          const ang = angleTo(b.x, b.y, a.x, a.y);
          a.x += Math.cos(ang) * overlap / 2; a.y += Math.sin(ang) * overlap / 2;
          b.x -= Math.cos(ang) * overlap / 2; b.y -= Math.sin(ang) * overlap / 2;
          if (Math.abs(a.speed) > 150 || Math.abs(b.speed) > 150) {
            a.damage += 4; b.damage += 4;
            if (a === p.car || b === p.car) { this.shake = Math.max(this.shake, 5); this.audio.crash(); this.particles.add(p.x, p.y, { n: 10, color: '#f39c12' }); }
          }
          const tmp = a.speed; a.speed = b.speed * 0.5; b.speed = tmp * 0.5;
        }
      }
    }
    // Player car hitting peds (hit-and-run).
    if (p.car) for (const ped of this.peds) {
      if (!ped.down && dist(ped.x, ped.y, p.x, p.y) < 34 && Math.abs(p.car.speed) > 60) {
        ped.down = true; ped.downT = 8;
        p.cash += ped.cash;
        this.particles.add(ped.x, ped.y, { n: 8, color: '#e74c3c' });
        this.addWanted(1, 'hit-and-run');
        this.toast(`+$${ped.cash}`, 2);
      }
    }
    // Wrecked cars explode.
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      if (c.damage >= 100) {
        this.particles.add(c.x, c.y, { n: 26, color: '#e67e22', speed: 220, life: 0.9 });
        this.audio.crash();
        this.shake = Math.max(this.shake, 10);
        if (c === p.car) { p.car = null; p.onFoot = true; p.x = c.x + 40; p.y = c.y; p.hp -= 20; }
        this.cars.splice(i, 1);
      }
    }
    // Pickups.
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      if (dist(p.x, p.y, pk.x, pk.y) < 30) {
        if (pk.pkind === 'health') p.hp = Math.min(100, p.hp + 40);
        if (pk.pkind === 'armor') p.armor = Math.min(100, p.armor + 50);
        if (pk.pkind === 'ammo') { p.weapon = 'pistol'; p.ammo += 24; }
        if (pk.pkind === 'cash') p.cash += 25;
        this.audio.pickup();
        this.pickups.splice(i, 1);
      }
    }
    // Pearls.
    for (const pr of this.city.pearls) {
      if (!pr.taken && dist(p.x, p.y, pr.x, pr.y) < 34) {
        pr.taken = true; p.pearls++;
        p.cash += 50;
        this.audio.cash();
        this.toast(`Harbour pearl ${p.pearls}/${PEARL_TOTAL}  +$50`, 3);
        if (p.pearls === PEARL_TOTAL) { p.cash += 2000; this.toast('All pearls! Bonus +$2000', 5); }
      }
    }
    // Taxi / courier side jobs: a nearby ped with a job.
    if (!p.taxiJob && !p.courierJob && !p.car && Math.random() < dt * 0.02) {
      const near = this.peds.find((pd) => !pd.down && dist(pd.x, pd.y, p.x, p.y) < 120);
      if (near) {
        if (Math.random() < 0.5) {
          p.taxiJob = { x: 600 + Math.random() * 3600, y: 600 + Math.random() * 3600, fare: 60 + Math.floor(Math.random() * 90), ped: near };
          this.toast('Taxi job: drive the passenger to the gold marker', 4);
        } else {
          p.courierJob = { x: 600 + Math.random() * 3600, y: 600 + Math.random() * 3600, pay: 80 + Math.floor(Math.random() * 70) };
          this.toast('Courier job: deliver the parcel to the gold marker', 4);
        }
      }
    }
    if (p.taxiJob && p.car && dist(p.x, p.y, p.taxiJob.x, p.taxiJob.y) < 90) {
      p.cash += p.taxiJob.fare; this.audio.cash(); this.toast(`Fare paid +$${p.taxiJob.fare}`, 3); p.taxiJob = null;
    }
    if (p.courierJob && dist(p.x, p.y, p.courierJob.x, p.courierJob.y) < 90) {
      p.cash += p.courierJob.pay; this.audio.cash(); this.toast(`Parcel delivered +$${p.courierJob.pay}`, 3); p.courierJob = null;
    }

    updateTraffic(this, dt, this.rng);
    updatePeds(this, dt, this.rng);
    updatePolice(this, dt, this.rng);
    this.missions.update(dt);
    this.particles.update(dt);
    // Skid marks decay.
    if (this.skids.length > 200) this.skids.splice(0, this.skids.length - 200);
    // Smoke from damaged cars.
    for (const c of this.cars) if (c.damage > 60 && Math.random() < dt * 6) this.particles.smoke(c.x, c.y);
    // Busted / wasted.
    if (this.busted) {
      this.busted = false;
      const fine = Math.min(p.cash, 200);
      p.cash -= fine; p.wanted = 0; p.x = this.city.policeStation.x; p.y = this.city.policeStation.y + 60;
      if (p.car) { this.cars.splice(this.cars.indexOf(p.car), 1); p.car = null; p.onFoot = true; }
      this.state = 'busted';
      this.toast(`Busted! Fine $${fine}. Released at the station.`, 4);
    }
    if (p.hp <= 0) {
      p.hp = 100; p.cash = Math.max(0, p.cash - 150); p.wanted = 0;
      p.x = this.city.hospital.x; p.y = this.city.hospital.y + 60;
      if (p.car) { this.cars.splice(this.cars.indexOf(p.car), 1); p.car = null; p.onFoot = true; }
      this.state = 'wasted';
      this.toast('Wasted! Hospital bill $150.', 4);
    }
    // Camera follows player (or car).
    const tx = p.x, ty = p.y;
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 5);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 5);
    this.cam.x = clamp(this.cam.x, this.view.w / 2, WORLD - this.view.w / 2);
    this.cam.y = clamp(this.cam.y, this.view.h / 2, WORLD - this.view.h / 2);
    // Engine hum.
    this.audio.engine(!!p.car, p.car ? Math.abs(p.car.speed) / 400 : 0);
  }

  updateOnFoot(dt) {
    const p = this.player, inp = this.input;
    const ax = inp.axis();
    const run = inp.down('shift') ? 1.7 : 1;
    const sp = 150 * run;
    let mx = ax.x, my = ax.y;
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; p.angle = Math.atan2(my, mx); }
    this.city.moveCircle(p, mx * sp * dt, my * sp * dt);
    p.x = clamp(p.x, 30, WORLD - 30); p.y = clamp(p.y, 30, WORLD - 30);
    // Aim with mouse.
    const wx = this.cam.x - this.view.w / 2 + inp.mouse.x;
    const wy = this.cam.y - this.view.h / 2 + inp.mouse.y;
    if (Math.hypot(wx - p.x, wy - p.y) > 20) p.angle = Math.atan2(wy - p.y, wx - p.x);
    // Melee.
    if (inp.pressed('f') && p.meleeCd <= 0) {
      p.meleeCd = 0.45;
      this.audio.punch();
      const hx = p.x + Math.cos(p.angle) * 34, hy = p.y + Math.sin(p.angle) * 34;
      for (const ped of this.peds) {
        if (!ped.down && dist(ped.x, ped.y, hx, hy) < 30) {
          ped.down = true; ped.downT = 8; p.cash += ped.cash;
          this.particles.add(ped.x, ped.y, { n: 6, color: '#e74c3c' });
          this.addWanted(1, 'assault');
        }
      }
      this.particles.add(hx, hy, { n: 4, color: '#fff', speed: 60 });
    }
    // Shoot.
    if (p.weapon === 'pistol' && inp.mouse.down && p.shootCd <= 0 && p.ammo > 0) {
      p.shootCd = 0.22; p.ammo--;
      this.audio.shoot();
      this.gunshotT = 0.8;
      this.shake = Math.max(this.shake, 2);
      const gx = p.x + Math.cos(p.angle) * 420, gy = p.y + Math.sin(p.angle) * 420;
      this.particles.add(p.x + Math.cos(p.angle) * 24, p.y + Math.sin(p.angle) * 24, { n: 3, color: '#ffd76a', speed: 140, life: 0.15 });
      // Hitscan: nearest ped / cop car along the line.
      let best = null, bestD = 420;
      for (const ped of this.peds) {
        if (ped.down) continue;
        const d = dist(p.x, p.y, ped.x, ped.y);
        if (d < bestD && Math.abs(((Math.atan2(ped.y - p.y, ped.x - p.x) - p.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.12) { best = ped; bestD = d; }
      }
      if (best) {
        best.down = true; best.downT = 8; p.cash += best.cash;
        this.particles.add(best.x, best.y, { n: 8, color: '#e74c3c' });
        this.addWanted(1, 'shots fired');
      }
      void gx; void gy;
    }
    // Enter nearest car.
    const nearCar = this.cars.find((c) => dist(c.x, c.y, p.x, p.y) < 70);
    if (nearCar && inp.pressed('e')) {
      if (nearCar.parked || nearCar.traffic) {
        p.stealTarget = nearCar; p.stealT = 0.01;
      } else if (nearCar.driver === null) {
        p.car = nearCar; p.onFoot = false; nearCar.parked = false; nearCar.traffic = false;
        this.audio.tone(300, 0.08, 'sine', 0.15, 500);
      }
    }
    if (p.stealTarget) {
      const t = p.stealTarget;
      if (dist(t.x, t.y, p.x, p.y) > 90 || inp.down('w', 'a', 's', 'd')) { p.stealTarget = null; p.stealT = 0; }
      else {
        p.stealT += dt;
        if (p.stealT >= 1.2) {
          p.car = t; p.onFoot = false; t.parked = false; t.traffic = false;
          p.stealTarget = null; p.stealT = 0;
          this.addWanted(1, 'grand theft auto');
          this.audio.tone(300, 0.08, 'sine', 0.15, 500);
        }
      }
    }
  }

  updateDriving(dt) {
    const p = this.player, inp = this.input, car = p.car;
    let steer = (inp.down('a', 'arrowleft') ? -1 : 0) + (inp.down('d', 'arrowright') ? 1 : 0);
    let throttle = (inp.down('w', 'arrowup') ? 1 : 0) + (inp.down('s', 'arrowdown') ? -1 : 0);
    // Shot-scene autopilot: keep the staged car moving for the screenshot.
    if (this.autopilot) { steer = this.autopilot.steer || 0; throttle = this.autopilot.throttle || 0; }
    const prevX = car.x, prevY = car.y;
    driveCar(car, dt, { steer, throttle, handbrake: inp.down(' ') }, this.city);
    if (car.skid > 0) {
      car.skid -= dt;
      this.skids.push({ x1: prevX, y1: prevY, x2: car.x, y2: car.y });
    }
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    // Exit car.
    if (inp.pressed('e')) {
      const ex = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
      const ey = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
      p.car = null; p.onFoot = true;
      p.x = this.city.solidAt(ex, ey) ? car.x - 40 : ex;
      p.y = this.city.solidAt(ex, ey) ? car.y : ey;
    }
    // Drive-by shooting.
    if (p.weapon === 'pistol' && inp.mouse.down && p.shootCd <= 0 && p.ammo > 0) {
      p.shootCd = 0.3; p.ammo--;
      this.audio.shoot(); this.gunshotT = 0.8;
      this.addWanted(1, 'drive-by shooting');
    }
  }

  render() {
    const ctx = this.ctx, { w, h } = this.view;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    ctx.translate(w / 2 - this.cam.x, h / 2 - this.cam.y);
    drawWorld(ctx, this, this.cam);
    ctx.restore();
    if (this.state === 'title') drawTitle(ctx, this);
    else if (this.state === 'pause') drawPause(ctx, this);
    else {
      drawHUD(ctx, this);
      if (this.state === 'busted' || this.state === 'wasted') {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, w, h);
        ctx.textAlign = 'center';
        ctx.fillStyle = this.state === 'busted' ? '#3498db' : '#e74c3c';
        ctx.font = 'bold 64px sans-serif';
        ctx.fillText(this.state === 'busted' ? 'BUSTED' : 'WASTED', w / 2, h / 2 - 20);
        ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif';
        ctx.fillText('Press Enter to continue', w / 2, h / 2 + 30);
        ctx.textAlign = 'left';
      }
    }
  }
}
