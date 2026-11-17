// Story missions: six jobs with dialogue, objectives, gold markers and pay.
// Each mission is a small state machine over the steps declared in config.js.
// The module only reads/writes world state; main.js owns dialogue display.
import { GARAGE, MISSIONS, SAFEHOUSE, dist } from './config.js';

export function createMissions(world) {
  const state = world.state;

  function current() {
    return MISSIONS[state.missionIndex] || null;
  }

  function startMission(index) {
    const m = MISSIONS[index];
    if (!m) return;
    state.missionIndex = index;
    state.missionDone = false;
    const rt = { step: 0, timer: 0, grab: 0, raceIdx: 0, raceTime: 0, escortIdx: 0, started: false };
    state.missionRt = rt;
    state.dialogue = { lines: m.lines, index: 0 };
    state.objective = m.brief;
    updateObjectivePos();
  }

  function updateObjectivePos() {
    const m = current();
    const rt = state.missionRt;
    if (!m || !rt) return;
    const s = m.steps[Math.min(rt.step, m.steps.length - 1)];
    if (!s) return;
    if (s.type === 'race') {
      const pt = s.points[rt.raceIdx] || s.points[s.points.length - 1];
      state.objectivePos = { x: pt[0], y: pt[1] };
    } else if (s.type === 'escort') {
      const pt = s.path[Math.min(rt.escortIdx, s.path.length - 1)];
      state.objectivePos = { x: pt[0], y: pt[1] };
    } else if (s.x !== undefined) {
      state.objectivePos = { x: s.x, y: s.y };
    }
  }

  function advanceStep() {
    const m = current();
    const rt = state.missionRt;
    rt.step += 1;
    rt.grab = 0;
    if (rt.step >= m.steps.length) {
      completeMission();
      return;
    }
    const s = m.steps[rt.step];
    state.objective = s.label;
    if (s.type === 'escape') {
      world.addWanted(s.stars, 'The heat is on — lose them!');
      state.objective = s.label;
    }
    if (s.type === 'race') {
      rt.raceIdx = 0;
      rt.raceTime = s.time;
      state.objective = `${s.label} — ${Math.ceil(rt.raceTime)}s left`;
    }
    if (s.type === 'escort') {
      startEscort(s);
    }
    if (s.type === 'getaway') {
      world.addWanted(3, 'The whole port is coming for you!');
    }
    updateObjectivePos();
  }

  function completeMission() {
    const m = current();
    state.cash += m.reward;
    state.missionDone = true;
    state.objective = `Mission complete: ${m.title} — +$${m.reward}`;
    world.say(`Mission complete: ${m.title} — +$${m.reward}`, 4);
    if (world.playJingle) world.playJingle();
    state.missionIndex += 1;
    if (state.missionIndex >= MISSIONS.length) {
      state.completed = true;
      state.objective = 'All six missions done. Crimson Harbor is yours — free roam!';
      state.objectivePos = { x: SAFEHOUSE.x, y: SAFEHOUSE.y };
    } else {
      state.missionRt = null;
      state.objective = `Next job: ${MISSIONS[state.missionIndex].title}. Go to the gold marker to start.`;
      state.objectivePos = startPointFor(state.missionIndex);
    }
    world.saveGame();
  }

  function startPointFor(index) {
    const m = MISSIONS[index];
    const s = m.steps[0];
    if (s.type === 'race') return { x: s.points[0][0], y: s.points[0][1] };
    if (s.type === 'escort') return { x: s.path[0][0], y: s.path[0][1] };
    return { x: s.x, y: s.y };
  }

  function startEscort(stepDef) {
    // Ibo's truck drives the harbor path; the player must stay near it.
    const start = stepDef.path[0];
    const truck = world.addCar(start[0], start[1], Math.PI / 2, 3, '#7a5a2a', { traffic: false, driver: true, escort: true });
    truck.speed = 0;
    state.escort = { truck, path: stepDef.path, idx: 0, hp: 100, wait: 0 };
    state.objectivePos = { x: stepDef.path[0][0], y: stepDef.path[0][1] };
  }

  function stepEscort(dt) {
    const esc = state.escort;
    if (!esc) return;
    const truck = esc.truck;
    const p = state.player;
    const near = dist(p.x, p.y, truck.x, truck.y) < 260;
    const target = esc.path[Math.min(esc.idx, esc.path.length - 1)];
    if (near) {
      const d = dist(truck.x, truck.y, target.x, target.y);
      if (d < 70) {
        esc.idx += 1;
        if (esc.idx >= esc.path.length) {
          state.escort = null;
          world.say('Ibo is across. The cargo is safe.', 3);
          advanceStep();
          return;
        }
      } else {
        const a = Math.atan2(target.y - truck.y, target.x - truck.x);
        truck.angle = a;
        truck.speed = 150;
        truck.x += Math.cos(a) * 150 * dt;
        truck.y += Math.sin(a) * 150 * dt;
      }
    } else {
      truck.speed = 0;
      esc.wait += dt;
      if (esc.wait > 1) {
        state.objective = 'Escort Ibo — stay close to the truck!';
        esc.wait = 0;
      }
    }
    // Port crews take pot shots at the truck while it moves.
    if (truck.speed > 0 && Math.random() < dt * 0.25) {
      esc.hp -= 4;
      world.addParticles(truck.x, truck.y, 4, '#f2c94c', 120, 0.3);
      if (esc.hp <= 0) {
        state.escort = null;
        state.cars = state.cars.filter((c) => c !== truck);
        world.say('The truck was shot up. Ibo pulls out — the job failed. Try again.', 4);
        failMission();
      }
    }
    state.objectivePos = { x: truck.x, y: truck.y };
  }

  function failMission() {
    const m = current();
    state.missionRt = null;
    state.objective = `${m.title} failed. Return to the gold marker to try again.`;
    state.objectivePos = startPointFor(state.missionIndex);
  }

  function step(dt) {
    const m = current();
    if (!m || state.completed && !state.missionRt) {
      // Free roam after the finale, or between missions.
      if (!state.missionRt && !state.completed) {
        // Waiting at the start marker of the next mission.
        const sp = startPointFor(state.missionIndex);
        if (dist(state.player.x, state.player.y, sp.x, sp.y) < 80) {
          startMission(state.missionIndex);
        }
      }
      return;
    }
    if (state.dialogue) return; // intro dialogue pauses mission progress
    const rt = state.missionRt;
    if (!rt) return;
    const s = m.steps[Math.min(rt.step, m.steps.length - 1)];
    const p = state.player;
    if (s.type === 'goto') {
      if (dist(p.x, p.y, s.x, s.y) < 75) advanceStep();
    } else if (s.type === 'stealCar') {
      const coupe = state.cars.find((c) => c.missionCar);
      if (coupe && p.inCar === coupe) {
        world.say('The coupe is yours. Get it to Sinta\'s garage.', 3);
        advanceStep();
      }
    } else if (s.type === 'deliverCar') {
      const coupe = state.cars.find((c) => c.missionCar);
      if (coupe && p.inCar === coupe && dist(p.x, p.y, GARAGE.x, GARAGE.y) < 90) {
        if (coupe.damage < 80) advanceStep();
        else world.say('Sinta will not take a wreck. Find another way — or restart the job.', 3);
      }
    } else if (s.type === 'escape') {
      if (state.wanted === 0) advanceStep();
    } else if (s.type === 'race') {
      rt.raceTime -= dt;
      const pt = s.points[rt.raceIdx];
      state.objective = `${s.label} — checkpoint ${rt.raceIdx + 1}/${s.points.length} — ${Math.max(0, Math.ceil(rt.raceTime))}s`;
      state.objectivePos = { x: pt[0], y: pt[1] };
      if (dist(p.x, p.y, pt[0], pt[1]) < 80) {
        rt.raceIdx += 1;
        world.say(`Checkpoint ${rt.raceIdx}/${s.points.length}!`, 1.5);
        if (rt.raceIdx >= s.points.length) advanceStep();
      } else if (rt.raceTime <= 0) {
        world.say('Out of time. The race is lost — go back to the start marker.', 4);
        failMission();
      }
    } else if (s.type === 'escort') {
      stepEscort(dt);
    } else if (s.type === 'grab') {
      if (dist(p.x, p.y, s.x, s.y) < 70) {
        rt.grab += dt;
        state.objective = `Grabbing the ledger… ${Math.ceil(3 - rt.grab)}s`;
        if (rt.grab >= 3) advanceStep();
      } else rt.grab = 0;
    } else if (s.type === 'getaway') {
      if (dist(p.x, p.y, s.x, s.y) < 80) advanceStep();
    }
  }

  // Street race side job: a marker near Downtown starts a 3-checkpoint sprint.
  function streetRaceStep(dt) {
    const r = state.race;
    if (!r) return;
    r.time -= dt;
    const pt = r.points[r.idx];
    state.objectivePos = { x: pt[0], y: pt[1] };
    if (dist(state.player.x, state.player.y, pt[0], pt[1]) < 80) {
      r.idx += 1;
      if (r.idx >= r.points.length) {
        state.cash += 300;
        world.say('Street race won! +$300', 3);
        state.race = null;
        state.objective = 'Free roam — find the next job at the gold marker.';
        return;
      }
      world.say(`Checkpoint ${r.idx + 1}/${r.points.length}`, 1.5);
    } else if (r.time <= 0) {
      world.say('Race lost. The marker stays open if you want another go.', 3);
      state.race = null;
    }
  }

  return { current, startMission, step, failMission, streetRaceStep, startPointFor };
}
