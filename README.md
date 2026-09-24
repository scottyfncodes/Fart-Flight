# KURT

He has gas. He has a dream.

A one-button, Flappy-Bird-style arcade game. Press and hold to fart. Fly far.
Try to keep your dignity above 0%.

Seven themed zones (forest, construction site, power lines, downtown,
desert, castle, the void), each with its own sky and parallax scenery.
Squeak through a gap for a slow-mo CLOSE ONE, grab snacks for power-ups,
climb the F-grades, unlock costumes, and when it all goes wrong, enjoy
the crash, the dizzy stars and the sad trombone. The oompah soundtrack
is synthesized live and speeds up as you do.

## Play locally

No build step. Any static file server works:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

Controls: hold Space / Up / tap to fart, Esc or P to pause, Space or
Enter to start and restart.

Add `?debug` to the URL to expose `window.__kurt` for automated
playtesting: `autopilot()` returns whether to hold or release,
`jump(meters)` teleports the run forward, and `god()` disables crashes.

## Deploy

Static HTML/CSS/JS, zero dependencies, zero backend. Point any static host
(GitHub Pages, Cloudflare Pages, Netlify, Vercel) at the repo root and it's
live. No build command, no environment variables, no API keys.

For GitHub Pages specifically: Settings → Pages → Source: Deploy from a
branch → Branch: `main`, folder: `/(root)` → Save. It'll be live at
`https://scottyfncodes.github.io/fart-flight/` within a minute or two.

## Home Screen app

KURT installs as a full-screen app: Share → Add to Home Screen on iOS,
Install app on Android/Chrome. It launches without browser chrome and
works offline once it has loaded one time (`sw.js`, network-first, so
new deploys still arrive on the next launch).

The icons in `icons/` are drawn with the game's own `drawKurt`, so they
always match the character. After changing Kurt, re-render them:

```
npm i -g playwright
NODE_PATH="$(npm root -g)" node tools/build-icons.mjs
```

If you add a new file under `src/`, also add it to `SHELL` in `sw.js` so
it's available offline.

## Architecture

- `index.html` / `styles.css` — layout, HUD, and screen overlays (DOM), safe-area aware
- `src/config.js` — every tunable constant (physics, obstacles, grades, power-ups, cosmetics)
- `src/game.js` — state machine (start / ready / playing / dying / game over, plus pause) and the main loop
- `src/kurt.js` — player physics (hold-to-thrust, gravity, rotation, squash/stretch) and rendering
- `src/hair.js` — procedural hair-strand physics
- `src/obstacles.js` — themed obstacle spawning, movement, rendering, hazards (birds/helicopters)
- `src/powerups.js` — rare power-up spawning, effects, rendering
- `src/particles.js` — fart cloud / sparkle particle system
- `src/fx.js` — floating callouts, screen flashes, confetti, speed lines, dizzy stars
- `src/background.js` — per-theme sky, sun, stars, parallax mountains/hills/skyline, and ground
- `src/scoring.js` / `src/progression.js` — distance, farts, efficiency, streak, F-grades
- `src/collision.js` — generous circle-vs-rect / circle-vs-circle collision
- `src/input.js` — unified press-and-hold handling (pointer + keyboard)
- `src/audio.js` — all sound effects and the oompah soundtrack, synthesized live via the Web Audio API (no audio files)
- `src/ui.js` — DOM screen/HUD updates
- `src/storage.js` — localStorage persistence (personal best, grade, lifetime farts, settings)
- `manifest.webmanifest` / `sw.js` / `icons/` — Home Screen install, offline play, app icons
- `tools/icon-art.js` / `tools/build-icons.mjs` — icon artwork and the PNG renderer
- `fonts/` — self-hosted Luckiest Guy (Apache 2.0) so the cartoon type works offline

Everything renders to a single `<canvas>` using `requestAnimationFrame` with
delta-time, except the start/HUD/game-over chrome, which is plain DOM updated
only on state changes.
