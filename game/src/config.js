// Crimson Harbor — configuration and shared constants.
// All tuning for the world, the player, vehicles, police and missions lives here
// so the rest of the game reads numbers, not magic literals.
export const WORLD = 4800;
export const ROAD_STEP = 600;
export const ROAD_W = 132;
export const WATER_X = 4380; // east of this is the harbor water
export const STEP = 1 / 60;
export const SAVE_KEY = 'crimson-harbor-save-v1';

export const DISTRICTS = [
  { name: 'Downtown', x0: 1200, y0: 600, x1: 3000, y1: 2400, ground: '#3d4a3a', roof: '#5a6b7d', accent: '#8fa8c8' },
  { name: 'Harbor', x0: 3600, y0: 600, x1: 4380, y1: 4200, ground: '#4a4640', roof: '#7a6a55', accent: '#c8a25a' },
  { name: 'Palm Beach', x0: 600, y0: 3600, x1: 3600, y1: 4200, ground: '#c2b280', roof: '#e8d8b0', accent: '#3fae8a' },
  { name: 'Old Town', x0: 600, y0: 600, x1: 1200, y1: 2400, ground: '#6b5a48', roof: '#8a6a4a', accent: '#d8b878' },
  { name: 'Hills', x0: 600, y0: 2400, x1: 1800, y1: 3600, ground: '#44543c', roof: '#5d7355', accent: '#9ab88a' },
];

export const CAR_TYPES = [
  { name: 'Hatch', len: 52, wid: 26, accel: 340, top: 420, grip: 3.2, color: '#c84a3a' },
  { name: 'Sedan', len: 62, wid: 28, accel: 300, top: 460, grip: 3.0, color: '#3a6bc8' },
  { name: 'Coupe', len: 58, wid: 27, accel: 380, top: 540, grip: 3.6, color: '#e8b73a' },
  { name: 'Van', len: 72, wid: 32, accel: 230, top: 360, grip: 2.6, color: '#7a8a96' },
  { name: 'Pickup', len: 66, wid: 30, accel: 280, top: 430, grip: 2.9, color: '#4a9a5a' },
  { name: 'Taxi', len: 60, wid: 28, accel: 310, top: 470, grip: 3.1, color: '#e8c832' },
];

export const CAR_COLORS = ['#c84a3a', '#3a6bc8', '#e8b73a', '#4a9a5a', '#8a4ac8', '#d8d8d8', '#2a2a30', '#c86a2a', '#3aa8a0'];

export const STATIONS = [
  { name: 'HARBOUR FM', tag: 'synthwave nights', bass: [55, 55, 65.4, 49], pad: [220, 261.6, 329.6] },
  { name: 'PALM 98.2', tag: 'sunset drive', bass: [49, 58.3, 65.4, 58.3], pad: [196, 246.9, 293.7] },
  { name: 'STATIC 107', tag: 'midnight talk', bass: [41.2, 49, 55, 49], pad: [174.6, 220, 261.6] },
];

export const MISSIONS = [
  {
    id: 1, title: 'The Harbor Run', reward: 400,
    brief: 'Marla Venn needs a package moved from the docks to Old Town. No questions, no stops.',
    lines: [
      ['Marla Venn', 'You are the new runner, yes? Good. A parcel waits at Pier 4. Old Town wants it by sundown.'],
      ['Marla Venn', 'The docks are watched. Walk in quiet, drive out fast. Do not open the parcel.'],
      ['You', 'Quiet in, fast out. Got it.'],
    ],
    steps: [
      { type: 'goto', x: 4200, y: 900, label: 'Pick up the parcel at Pier 4' },
      { type: 'goto', x: 900, y: 1500, label: 'Deliver the parcel to Old Town' },
    ],
  },
  {
    id: 2, title: "Sinta's Coupe", reward: 600,
    brief: 'A crimson coupe is parked near Palm Beach. Bring it to Sinta\'s garage — in one piece.',
    lines: [
      ['Sinta Rahayu', 'There is a coupe down on Palm Beach, cherry red, owner is… away. Bring it to my garage.'],
      ['Sinta Rahayu', 'Scratches are fine. A wreck is not. And if the owner\'s friends show up, drive like you mean it.'],
      ['Marla Venn', 'Sinta vouches for you. Do not make her regret it.'],
    ],
    steps: [
      { type: 'stealCar', x: 1500, y: 3900, label: 'Steal the crimson coupe on Palm Beach' },
      { type: 'deliverCar', x: 2700, y: 2700, label: 'Deliver the coupe to Sinta\'s garage' },
    ],
  },
  {
    id: 3, title: 'Hot Water', reward: 800,
    brief: 'The pickup went loud. Lose a 3-star wanted level and get back to the safehouse.',
    lines: [
      ['Officer Bima', 'All units, suspect vehicle fleeing the harbor district. Three stars. Box them in.'],
      ['Marla Venn', 'You tripped every alarm in the port, runner. Lose them. Lose them all. Then come home.'],
      ['You', 'Three stars. Fine. I know these streets better than they do.'],
    ],
    steps: [
      { type: 'escape', stars: 3, label: 'Escape a 3-star wanted level' },
      { type: 'goto', x: 1500, y: 900, label: 'Return to the safehouse' },
    ],
  },
  {
    id: 4, title: 'The Long Way Round', reward: 1000,
    brief: 'A checkpoint race across town — Downtown to the Hills, through Palm Beach. Beat the clock.',
    lines: [
      ['Ibo', 'Marla says you can drive. Prove it. Five checkpoints, one clock, no shortcuts that kill you.'],
      ['Ibo', 'I will be timing you from the radio. Do not embarrass me, runner.'],
    ],
    steps: [
      { type: 'race', label: 'Hit every checkpoint before the clock runs out', time: 150,
        points: [[1500, 900], [2700, 1500], [3300, 2700], [2100, 3900], [900, 3300]] },
    ],
  },
  {
    id: 5, title: 'Across the Harbor', reward: 1400,
    brief: 'Escort Ibo\'s truck across the harbor while the port crews try to stop you.',
    lines: [
      ['Ibo', 'I am hauling Dario\'s cargo across the harbor. Port crews are not happy about it.'],
      ['Dario Kelm', 'Keep my truck breathing, runner. If it stops, the cargo walks — and so do you.'],
      ['Ibo', 'Stay close. When I stop, you stop. When I move, you move.'],
    ],
    steps: [
      { type: 'escort', label: 'Escort Ibo\'s truck across the harbor', path: [[3900, 1200], [3900, 2400], [3900, 3600], [3300, 3900]] },
    ],
  },
  {
    id: 6, title: 'The Crimson Job', reward: 2500,
    brief: 'The final job: lift Dario\'s ledger from the harbor warehouse, then get away clean.',
    lines: [
      ['Dario Kelm', 'One last job, runner. My ledger sits in the harbor warehouse. The whole port will come for it.'],
      ['Marla Venn', 'Take the ledger, reach the boat at Pier 9, and we are done. Crimson Harbor is yours after this.'],
      ['Officer Bima', 'All units converge on the harbor. Do not let that ledger leave the docks.'],
    ],
    steps: [
      { type: 'goto', x: 4050, y: 2100, label: 'Reach the harbor warehouse' },
      { type: 'grab', x: 4050, y: 2100, label: 'Grab the ledger (hold near it)' },
      { type: 'getaway', x: 4200, y: 3900, label: 'Getaway — reach the boat at Pier 9' },
    ],
  },
];

export const PEARL_COUNT = 20;
export const PICKUP_SPOTS = [
  { kind: 'ammo', x: 1500, y: 1500, label: 'Ammo Mart' },
  { kind: 'armor', x: 2700, y: 900, label: 'Vest & Co' },
  { kind: 'ammo', x: 3300, y: 3300, label: 'Ammo Mart' },
  { kind: 'armor', x: 900, y: 3300, label: 'Vest & Co' },
  { kind: 'health', x: 2100, y: 2100, label: 'Clinic' },
];
export const SAFEHOUSE = { x: 1500, y: 900 };
export const GARAGE = { x: 2700, y: 2700 };
export const POLICE_STATION = { x: 2100, y: 900 };
export const HOSPITAL = { x: 900, y: 2100 };

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
export function angleDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
