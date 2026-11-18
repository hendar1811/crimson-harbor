# Crimson Harbor

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/hendar1811/crimson-harbor/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/hendar1811/crimson-harbor/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Crimson Harbor is a top-down open-world crime game set in an original coastal city.
Explore five districts — Downtown, Old Town, the Hills, Palm Beach and the Harbor —
on foot or behind the wheel, steal cars, outrun the police, and run six story
missions for fixer Marla Venn, wheelman Ibo, mechanic Sinta Rahayu, smuggler
Dario Kelm and Officer Bima on the radio. Side work includes taxi fares, courier
parcels, a street race and 20 hidden harbour pearls.

Everything is original: the city, the characters, the art (canvas-drawn) and the
sound (WebAudio-synthesized). No libraries, no build step, no network requests —
just static files in `game/`.

## How to run

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

## Controls

- **WASD / arrows** — move / drive, **Shift** run
- **E** — enter or exit a car (hold near a parked car to steal it), start a mission at the diner, save at the safehouse
- **F** — melee, **mouse aim + click** — shoot (once you have the pistol)
- **Space** — handbrake, **R** — change radio station, **M** — mute, **P / Esc** — pause

## Features

- ~4800×4800 city with traffic AI, pedestrians, police pursuit and roadblocks
- Wanted level 1–5 stars, busted/wasted consequences, fines and hospital bills
- 6 story missions with dialogue, objectives and gold minimap markers
- Taxi and courier side jobs, a street race, 20 collectible harbour pearls
- HUD with minimap, wanted stars, health/armour, cash and speedometer
- Day/night cycle with lit windows, lamps and headlights
- Synthesized music, engine hum, sirens and gunshots; localStorage saves

Entry for the make.fun competition: https://make.fun/bounty/gta6-01
