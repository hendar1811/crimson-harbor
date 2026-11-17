// Boot and the one loop: input every frame, the world in fixed 1/60 s steps,
// the renderer and HUD paint what is there. Screens: title, play, paused,
// complete (after the sixth mission). ?shot=title|city|chase|mission&seed=7
// stages a deterministic screenshot scene instead of running the loop.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createWorld } from './entities.js';
import { createMissions } from './missions.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const missions = createMissions(world);
const audio = createAudio();
world.setAudio(audio);
const renderer = createRenderer(canvas);
const hud = createHud(canvas);

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  // Shots never touch real audio: headless has no user gesture, and the
  // AudioContext warnings would only pollute the console.
  const NO_AUDIO = { crash() {}, gunshot() {}, melee() {}, pickup() {}, cash() {}, skid() {}, jingle() {}, fail() {}, busted() {}, siren() {}, engine() {} };
  world.setAudio(NO_AUDIO);
  const scene = stageShot(name, world, missions);
  const st = world.state;
  st.districtName = world.city.districtName(st.player.x, st.player.y);
  let painted = 0;
  function paint() {
    hud.setView(window.innerWidth, window.innerHeight);
    renderer.draw(st, world.city, { mouse: { x: 640, y: 400, worldX: st.player.x, worldY: st.player.y } }, scene.screen);
    if (scene.screen === 'title') hud.drawTitle(st, scene.hasSave);
    else hud.drawHud(st, scene.screen);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = 'title';
  let hasSave = false;
  let accumulator = 0;
  let last = performance.now();
  let districtShown = '';
  let districtTimer = 0;
  let pendingActions = 0; // one-shot presses, consumed by the next fixed step

  const saved = world.loadGame();
  if (saved) hasSave = true;

  function newGame() {
    world.reset(true);
    missions.startMission(0);
    screen = 'play';
    announce('Playing. Marla Venn has work for you.');
  }

  function continueGame() {
    world.reset(true);
    world.applySave(saved);
    // Resume at the next mission's start marker.
    const m = missions.current();
    if (m) {
      world.state.objective = `Next job: ${m.title}. Go to the gold marker to start.`;
      world.state.objectivePos = missions.startPointFor(world.state.missionIndex);
    }
    screen = 'play';
    announce('Continuing your run.');
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      world.say(audio.isMuted() ? 'Muted' : 'Sound on', 1.5);
    }
    if (screen === 'title') {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        if (hasSave) continueGame();
        else newGame();
      }
      return;
    }
    if (screen === 'complete') {
      if (actions & ACTION_CONFIRM) screen = 'play';
      return;
    }
    if (screen === 'paused') {
      if (actions & ACTION_PAUSE || actions & ACTION_CONFIRM) screen = 'play';
      return;
    }
    // Playing.
    if (world.state.dialogue) {
      if (actions & ACTION_CONFIRM) {
        const d = world.state.dialogue;
        d.index += 1;
        if (d.index >= d.lines.length) world.state.dialogue = null;
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      screen = 'paused';
      announce('Paused.');
      return;
    }
    // Everything else (E, F, shoot) goes to the world on the next fixed step.
    pendingActions = actions;
  }

  // Extra keys: C cycles the radio station, N starts a new game from the title,
  // S saves while paused, R restarts from the safehouse while paused.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyC' && screen === 'play' && world.state.player.inCar) {
      world.state.station = (world.state.station + 1) % 3;
      audio.setStation(world.state.station);
      world.say(`Radio: ${audio.stationName()} — ${audio.stationTag()}`, 2);
    }
    if (event.code === 'KeyN' && screen === 'title' && hasSave) {
      audio.unlock();
      newGame();
    }
    if (event.code === 'KeyS' && screen === 'paused') {
      world.saveGame();
      world.say('Game saved.', 2);
      screen = 'play';
    }
    if (event.code === 'KeyR' && screen === 'paused') {
      const cash = world.state.cash;
      world.reset(true);
      world.state.cash = cash;
      missions.startMission(world.state.missionIndex);
      screen = 'play';
    }
  });

  function step() {
    const st = world.state;
    if (screen === 'title') {
      // The title's backdrop city idles: traffic rolls, peds stroll.
      world.step(STEP, { held: {}, mouse: input.mouse, moveX: () => 0, moveY: () => 0, takeActions: () => 0 }, 0);
      return;
    }
    if (screen !== 'play') return;
    const actions = pendingActions;
    pendingActions = 0;
    world.step(STEP, input, actions);
    missions.step(STEP);
    missions.streetRaceStep(STEP);
    // District label.
    const d = world.city.districtName(st.player.x, st.player.y);
    if (d !== districtShown) {
      districtShown = d;
      districtTimer = 3;
    }
    st.districtName = districtTimer > 0 ? districtShown : '';
    if (districtTimer > 0) districtTimer -= STEP;
    if (st.completed && screen === 'play') screen = 'complete';
    if (st.wastedTimer > 0 || st.bustedTimer > 0) { /* world handles the respawn */ }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions(input.takeActions());
    while (accumulator >= STEP) {
      step();
      accumulator -= STEP;
      if (screen === 'paused' || screen === 'complete') { accumulator = 0; break; }
    }
    hud.setView(window.innerWidth, window.innerHeight);
    renderer.draw(world.state, world.city, input, screen);
    if (screen === 'title') hud.drawTitle(world.state, hasSave);
    else if (screen === 'paused') hud.drawPaused(world.state);
    else if (screen === 'complete') hud.drawComplete(world.state);
    else {
      hud.drawHud(world.state, screen);
      hud.drawDialogue(world.state);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') screen = 'paused';
  });

  announce('Crimson Harbor. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
