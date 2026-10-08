# Fart Flight

He has gas. He has a dream.

A one-button, Flappy-Bird-style arcade game. Press and hold to fart. Fly far.
Try to keep your dignity above 0%. It drains fast (about 4% a second, faster the
farther you fly), so Kurt's clothes are always coming off and going back on.

Kurt's dignity is his wardrobe: he starts every run dressed and loses his
socks (below 85%), shirt (65%), pants (45%) and finally his undies (20%).
Lost pieces float back by as pickups that put them back on and restore
dignity, and every clean gap (no near-miss) earns a little back, with a
bonus every 5 in a row.

Every snack helps: Bean Burrito (steady, floatier gas), Protein Shake (a
shield that eats one crash), Taco Tuesday (slow-mo), Hot Sauce (skinny
Kurt squeezes through tighter gaps), Gas-X (feather float) each also give
+10 dignity, and a Stack of Pancakes restores +30 dignity.

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

Controls: hold Space / Up / W / tap to fart, Esc or P to pause, Space or
Enter to start and restart.

Add `?debug` to the URL to expose `window.__kurt` for automated
playtesting: `autopilot()` returns whether to hold or release,
`jump(meters)` teleports the run forward, `god()` disables crashes, and
`give(key)` hands Kurt a power-up (e.g. `give("shake")`), and
`setDignity(n)` sets his dignity (and so his outfit).

## Deploy

Static HTML/CSS/JS, zero dependencies, zero backend. Point any static host
(GitHub Pages, Cloudflare Pages, Netlify, Vercel) at the repo root and it's
live. No build command, no environment variables, no API keys.

For GitHub Pages specifically: Settings → Pages → Source: Deploy from a
branch → Branch: `main`, folder: `/(root)` → Save. It'll be live at
`https://scottyfncodes.github.io/Fart-Flight/` within a minute or two.

## Home Screen app

Fart Flight installs as a full-screen app: Share → Add to Home Screen on iOS,
Install app on Android/Chrome. It launches without browser chrome and
works offline once it has loaded one time (`sw.js`, network-first, so
new deploys still arrive on the next launch).

The icons in `icons/` are rendered from `icons/icon.svg`, a hand-drawn
Kurt that matches his icon on haveanapp.com. To change the icon, edit that
SVG and re-render the PNGs from it (512, 192, 180 for `apple-touch-icon`,
a maskable 512 with the art pulled into the centre 80%, and a 32px
favicon cropped close on Kurt).

`tools/build-icons.mjs` still renders the older icon drawn with the game's
own `drawKurt`; running it will overwrite the current PNGs with that art.

Then bump the `?v=` number on every icon URL in `index.html`,
`manifest.webmanifest` and `sw.js`, and the `CACHE` name in `sw.js`.
iOS caches the Home Screen icon by URL, so without a new URL a phone can
keep showing the old icon even after it is removed and re-added.

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
- `src/clothes.js` — Kurt's dignity wardrobe: outfit tiers, clothing pickups, clothes flying off
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
