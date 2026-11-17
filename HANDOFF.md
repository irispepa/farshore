# Farshore handoff

Session continuity lives here; design and asset docs are in `docs/`, deferred polish in `docs/wishlist.md`, dated log in `docs/history.md`.

## Status · 2026-11-17

First playable slice, merged to `main` at `81d9ae8` (not pushed). `npm run dev` serves on port 5183 (`.claude/launch.json`; the preview tool moves to the next free port if it is taken). `npx vite build` passes.

**What exists**
- `src/game/`: `game.js` (loop and flow: title → play ↔ card / journal / pause, spyglass), `walker.js` (on foot, walk 3.2 / run 5.8 m/s, slopes, wading, cave roof layer), `sailing.js` (wind-driven canoe, reef and depth collision, landing search), `camera.js` (assisted chase camera, spyglass, title orbit), `save.js` (one localStorage slot, `farshore-save-v1`), `input.js` (floating stick, right-thumb camera, keyboard; edge-of-stick or Shift runs), `audio.js` (synthesised layers driven by `sound.update(dt, state)` plus one-shots), `story.js`.
- `src/world/`, `src/entities/`, `src/fx/`, `src/ui/`: cove, canoe, whale, character, HUD, journal and atlas.
- PWA: `public/manifest.webmanifest`, icons from `scripts/make-icons.mjs`, build-time service worker plugin in `vite.config.js`, `src/pwa.js`.
- Dev-only `src/dev/autopilot.js` exposes `window.ap` (`st()`, `route([[x,z],…])`, `act()`, `ok()`, `run()`, `start()`) for scripted playtests; not in production builds.
- Story loop: letter → Tūtū's tin (canoe through the cave mouth, or on foot via the path and cleft) → spot the koholā with the spyglass → mark the spot in the atlas → "first heading" card. Two chests give outfit pieces (islet: Sunset tee, by canoe; lava shelf tip: Seafoam high-tops, on foot), equipped from the journal's Looks page.

**Verified** (scripted, headless Chromium at 844×390): both routes to the tin, cave clue, place discovery, chests and equipping, spyglass sighting, wrong and right atlas marks, save/continue, pause and two-tap restart, journal layout at phone size, running, production build and precache list.

**Not verified:** nothing has run on a real iPhone (touch feel, performance, safe areas, add-to-home-screen, offline launch). Whale-watching from the canoe ("Watch") shares the spyglass code but was not exercised by script; the user reports the spyglass works from the shore and other angles.

**User playtest feedback (desktop)**
- UI is excellent. Whale sound and wave sound are good in character, but waves are too loud and distracting.
- Cave sound reads as a thump, not the intended soft "singing" tones (two detuned tones near 330 Hz with slow tremolo and echo). Cause not yet diagnosed.
- Spyglass from the top of the lookout hill is blocked by foliage, and she cannot get close enough to see the whale well.
- Backpack straps disappear into the shirt.
- Confirmed wanted: chest lid fix, bench sit at the lookout, title camera framing, canoe wake, and a fast sail mode for the canoe like land running.

## Next, in order

**1. Fixes to what exists**
1. Lower the surf level (`audio.js`; surf follows `shore`, so also check it stays modest at the waterline).
2. Replace the cave thump with the intended singing tones: find what is thumping (echo feedback, tremolo, or the darkened surf), then retune; listen after each change.
3. Lookout whale view: clear or hide foliage between the lookout and the water, move or raise the eye point, and let the glass zoom or aim so the whale is large enough to see well. Check the spyglass at the lookout and from the canoe.
4. Backpack straps: make them sit proud of the shirt (`character.js`, `#gear`; the straps are tori on the chest joint and the top shell now covers them).

**2. Character art pass** (list in `docs/wishlist.md`): sneaker soles, hair, knee crease, sit pose sinking into flat ground, expressions, shorts side panel. Check the result against `art/farshore/concepts/character-sheet-v1.png`.

**3. Feel and small features**
1. Canoe fast mode, matching land running: a sprint input that trims the sheet for more speed, with a wake and heavier camera pull-back.
2. Chest lid (hollow half-cylinder), sit on the lookout bench, canoe wake trail, seated steering pose, title orbit camera framing, spyglass lens ring.

**4. New features**
1. Atlas symbols that matter: let marks and routes unlock or gate something, not just decorate.
2. More outfit pieces and chests, and a wardrobe size decision (open, see `docs/README.md`).
3. A visible reward or beat after the first heading, so the chapter has an ending.

**5. Expand the game**
1. A second obstacle with several solutions (observation, equipment, route, relationship), per the design.
2. Open-sea sailing and a second island; island hopping and treasure hunting.
3. Lock or revise the proposed family-expedition plot, keeping original fiction separate from researched Hawaiian traditions.

**6. Tech**
- JS bundle is about 710 kB (three.js); trim imports if load time matters.
- Hosting must serve `sw.js` with no-cache so new builds are picked up.
- The in-app preview pane stops `requestAnimationFrame` when hidden, so the game will not boot there unless the pane is visible.

## Art and asset workflow

- Direction and workflow: [docs/README.md](docs/README.md). Prompts and review notes: [docs/visual-development.md](docs/visual-development.md).
- `art/farshore/concepts/gameplay-view-v1.png` is the accepted style reference. Four follow-ups still await the user's review: `character-sheet-v1.png`, `gameplay-ui-v1.png`, `loading-screen-v1.png`, `journal-concept-v1.png`. A fifth, `character-construction-v1.png`, shows only the starting outfit; it does not remove outfit collection.
- Clothing: stable base character with swappable top/bottoms/footwear plus attached gear; outfits are collectibles. Wardrobe size and reward placement are open.
- Image generation is limited. No new generations, retries or revisions without an explicit request. PNGs are style targets, not models or textures.
- Blocker: the art-request CLI worker's model `gpt-6.1-sol` is rejected for the CLI login (`model_not_found`), so automated generation is unverified. `scripts/request-farshore-art.mjs` accepts `--model`; do not change global auth or config.
