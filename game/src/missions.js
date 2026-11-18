// Story missions — six jobs with an original cast. Each mission is a small
// state machine: intro dialogue, objective, waypoint, completion, reward.
import { dist } from './random.js';

export const MISSIONS = [
  {
    id: 0, name: 'First Pickup', giver: 'Marla Venn',
    intro: 'Marla Venn: "Kid, I need a package from the Harbor docks. Drive there, grab it, bring it to my diner. No cops, no questions."',
    objective: 'Pick up the package at the Harbor docks',
    start: { x: 3150, y: 3150 }, target: { x: 4050, y: 1200 }, deliver: { x: 3150, y: 3150 },
    reward: 400, type: 'fetch',
  },
  {
    id: 1, name: 'The Getaway Coupe', giver: 'Sinta Rahayu',
    intro: 'Sinta Rahayu: "A cherry-red Coupe is parked by the beach. Bring it to my garage in one piece — I pay for clean paint."',
    objective: 'Steal the red Coupe and deliver it to Sinta\'s garage',
    start: { x: 2550, y: 2850 }, target: { x: 3300, y: 4050 }, deliver: { x: 2550, y: 2850 },
    reward: 650, type: 'car',
  },
  {
    id: 2, name: 'Hot Pursuit', giver: 'Officer Bima (radio)',
    intro: 'Radio — Officer Bima: "All units, suspect spotted in Old Town. Venn\'s kid is running. Lose the heat or get booked."',
    objective: 'Escape a 3-star wanted level',
    start: { x: 1200, y: 2700 }, target: null, deliver: null,
    reward: 800, type: 'escape',
  },
  {
    id: 3, name: 'Harbor Lights Run', giver: 'Dario Kelm',
    intro: 'Dario Kelm: "Three checkpoints, one harbour to the Hills. Beat the clock and the cargo is yours. Miss one and we never met."',
    objective: 'Hit all 3 checkpoints before time runs out',
    start: { x: 3900, y: 900 }, checkpoints: [
      { x: 3900, y: 2700 }, { x: 2100, y: 2700 }, { x: 900, y: 3900 },
    ], timeLimit: 150, reward: 1000, type: 'race',
  },
  {
    id: 4, name: 'Ibo\'s Escort', giver: 'Ibo',
    intro: 'Ibo: "I need to cross the harbor on foot and I\'m worth money to the wrong people. Walk with me. Anyone with a gun gets dropped."',
    objective: 'Escort Ibo across the Harbor to the east pier',
    start: { x: 3750, y: 1500 }, target: { x: 4350, y: 3000 }, deliver: null,
    reward: 1200, type: 'escort',
  },
  {
    id: 5, name: 'The Crimson Job', giver: 'Marla Venn',
    intro: 'Marla Venn: "Last one. Grab the ledger from the Downtown tower, then get out of this city. Whatever happens — drive like the harbor is on fire."',
    objective: 'Grab the ledger in Downtown, then reach the Harbor pier',
    start: { x: 1500, y: 900 }, target: { x: 1500, y: 900 }, deliver: { x: 4350, y: 3300 },
    reward: 2500, type: 'fetch',
  },
];

export class MissionRunner {
  constructor(state) { this.state = state; this.active = null; this.stage = 0; this.timer = 0; this.cpIdx = 0; this.escort = null; }
  start(idx) {
    const m = MISSIONS[idx];
    this.active = m; this.stage = 0; this.timer = m.timeLimit || 0; this.cpIdx = 0;
    const s = this.state;
    s.dialogue = m.intro;
    s.dialogueT = 6;
    s.objective = m.objective;
    s.toast(`Mission started: ${m.name}`, 4);
    if (m.type === 'escape') { s.player.wanted = 3; s.player.wantedTimer = 0; }
    if (m.type === 'escort') {
      const { makePed } = s._factories;
      this.escort = makePed(m.start.x + 40, m.start.y + 40, Math.random);
      this.escort.color = '#f1c40f';
      s.peds.push(this.escort);
    }
    if (m.type === 'race') { s.raceCp = m.checkpoints.map((c) => ({ ...c, hit: false })); }
    s.audio.jingle();
  }
  waypoint() {
    if (!this.active) return null;
    const m = this.active;
    if (m.type === 'race') return m.checkpoints[this.cpIdx] || null;
    if (m.type === 'escort') return this.escort ? { x: this.escort.x, y: this.escort.y } : null;
    if (this.stage === 0) return m.target;
    return m.deliver;
  }
  update(dt) {
    if (!this.active) return;
    const s = this.state, p = s.player, m = this.active;
    if (m.type === 'race') {
      this.timer -= dt;
      if (this.timer <= 0) { this.fail('Out of time.'); return; }
      const cp = m.checkpoints[this.cpIdx];
      if (cp && dist(p.x, p.y, cp.x, cp.y) < 90) {
        s.audio.cash(); s.toast(`Checkpoint ${this.cpIdx + 1} of ${m.checkpoints.length}`, 2);
        this.cpIdx++;
        if (this.cpIdx >= m.checkpoints.length) this.complete();
      }
      return;
    }
    if (m.type === 'escape') {
      if (p.wanted === 0) this.complete();
      return;
    }
    if (m.type === 'escort') {
      if (!this.escort || this.escort.down) { this.fail('Ibo didn\'t make it.'); return; }
      // Ibo follows the player.
      const d = dist(this.escort.x, this.escort.y, p.x, p.y);
      if (d > 60) {
        const a = Math.atan2(p.y - this.escort.y, p.x - this.escort.x);
        this.escort.x += Math.cos(a) * 90 * dt;
        this.escort.y += Math.sin(a) * 90 * dt;
      }
      if (dist(this.escort.x, this.escort.y, m.target.x, m.target.y) < 100) this.complete();
      return;
    }
    // fetch / car missions: reach target, then deliver.
    const goal = this.stage === 0 ? m.target : m.deliver;
    if (!goal) { this.complete(); return; }
    if (dist(p.x, p.y, goal.x, goal.y) < 90) {
      if (this.stage === 0) {
        this.stage = 1;
        s.audio.pickup();
        s.objective = m.type === 'car' ? 'Deliver the Coupe to Sinta\'s garage' : 'Deliver it to Marla\'s diner';
        s.toast(m.type === 'car' ? 'Got the Coupe — now deliver it!' : 'Package secured — deliver it!', 3);
        if (m.type === 'fetch' && m.id === 5) s.player.wanted = Math.max(s.player.wanted, 2);
      } else this.complete();
    }
  }
  complete() {
    const s = this.state, m = this.active;
    s.player.cash += m.reward;
    s.player.missionsDone = Math.max(s.player.missionsDone, m.id + 1);
    s.audio.jingle();
    s.toast(`Mission complete: ${m.name}  +$${m.reward}`, 5);
    s.save();
    this.active = null; this.stage = 0; this.escort = null; s.raceCp = null;
    s.objective = s.player.missionsDone >= MISSIONS.length ? 'All missions complete — free roam!' : 'Visit Marla\'s diner to start the next mission';
  }
  fail(reason) {
    const s = this.state;
    s.audio.fail();
    s.toast(`Mission failed: ${reason}`, 4);
    this.active = null; this.stage = 0; this.escort = null; s.raceCp = null;
    s.objective = 'Visit Marla\'s diner to retry the mission';
  }
}
