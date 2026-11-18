// Crimson Harbor — shared constants and tuning.
export const WORLD = 4800; // world is WORLD x WORLD px
export const TILE = 600;   // city block pitch
export const ROAD_W = 96;  // road width
export const DAY_LEN = 240; // seconds per full day/night cycle

export const DISTRICTS = [
  { name: 'Downtown',   x: 600,  y: 600,  w: 1200, h: 1200, ground: '#3a3f46', roof: '#565d68', accent: '#7fb2d9' },
  { name: 'Old Town',   x: 600,  y: 2400, w: 1200, h: 1200, ground: '#4a4238', roof: '#6b5a44', accent: '#d9a05b' },
  { name: 'The Hills',  x: 600,  y: 3600, w: 1200, h: 600,  ground: '#2f4034', roof: '#4a5d4e', accent: '#8fbf7f' },
  { name: 'Palm Beach', x: 2400, y: 3600, w: 1200, h: 600,  ground: '#8a7a52', roof: '#b09a68', accent: '#e8d27a' },
  { name: 'The Harbor', x: 3600, y: 600,  w: 1200, h: 3000, ground: '#3c4148', roof: '#5d6673', accent: '#e07840' },
];

export const CAR_TYPES = [
  { name: 'Sedan',    w: 46, h: 22, accel: 260, top: 330, grip: 3.2, colors: ['#c0392b', '#2e86c1', '#7d3c98', '#b7950b'] },
  { name: 'Coupe',    w: 44, h: 20, accel: 320, top: 400, grip: 3.6, colors: ['#e74c3c', '#f1c40f', '#16a085', '#ecf0f1'] },
  { name: 'Taxi',     w: 46, h: 22, accel: 250, top: 320, grip: 3.2, colors: ['#f7dc6f'] },
  { name: 'Van',      w: 56, h: 26, accel: 190, top: 260, grip: 2.6, colors: ['#95a5a6', '#5d6d7e', '#a93226'] },
  { name: 'Pickup',   w: 52, h: 24, accel: 230, top: 310, grip: 3.0, colors: ['#1e8449', '#922b21', '#2c3e50'] },
  { name: 'Police',   w: 46, h: 22, accel: 330, top: 420, grip: 3.8, colors: ['#1a1a2e'] },
];

export const RADIO = ['Harbor FM 88.1 — smooth dusk jazz', 'CRIMSON 104.7 — late-night synth', 'PALM 97.3 — beachside reggae'];

export const SAVE_KEY = 'crimson-harbor-save-v1';
export const START_CASH = 150;
export const PEARL_TOTAL = 20;
