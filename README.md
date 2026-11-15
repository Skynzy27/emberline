# EMBERLINE — a three.js tactical FPS

A round-based tactical first-person shooter in the style Counter-Strike made
famous — with its own map, art, sounds and names. One player (Ember) against
four Warden bots on **Cinder Yard**, a dusk industrial yard with two charge
sites: the Furnace (west) and the Silo (east).

## The game

- **Rounds**: first to 5 round wins (max 9). A round ends when one team is
  eliminated, the charge detonates, it is defused, or the 100-second timer
  runs out.
- **Objective**: carry the charge to a site, hold **E** to plant it, then
  defend it for 35 seconds. Wardens rush to defuse (5-second channel).
- **Economy**: start at $800; +$300 per elimination, +$300 for planting,
  +$325 for a round win, +$140 for a loss. Spend it in the buy menu
  (**B**, open during the 8-second buy phase).
- **Arsenal**: P-12 sidearm (free), VK-9 carbine ($2,700), M7 scattergun
  ($1,700), frag charge ($300), flash charge ($200).
- **Gunplay**: hitscan with headshot bonus damage, recoil and spread that
  punish firing on the move, acceleration-based movement, crouching, jumping,
  and AABB collision with the map.
- **Bots**: four Wardens follow lane routes, hold sites, react to sight and
  to the sound of gunfire, strafe while engaging, and converge to defuse a
  planted charge. Flash charges blind them.
- **Sound**: fully procedural WebAudio — no audio files, no network.

## Run it

```sh
node serve.ts
# open http://localhost:8080 in desktop Chrome
```

No build step, no network request: `game/` is plain static ES modules with
three.js 0.187.0 vendored under `game/vendor/three/`.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Look (click to lock) |
| Click | Fire |
| R | Reload |
| Ctrl / C | Crouch |
| Space | Jump |
| E (hold) | Plant the charge at a site |
| B | Buy menu (buy phase) |
| 1 / 2 / 3 | Switch weapon |
| G / F | Throw frag / flash |
| 4 / 5 | Buy frag / flash (buy phase) |

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the kit's `vendor/makefun-threejs.ts`.

## License

MIT — see `LICENSE`.
