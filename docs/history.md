# History

## 2026-11-17 — Character correction pass (after Codex review)

- New `src/entities/charGeo.js`: `loft` (elliptical cross-section profiles), `strand` (flattened capped hair tubes, outward winding), sculpted head surface, hair cap, drawn face texture.
- `character.js`: lofted torso/limbs with knee, calf, wrist shapes and thumb; sculpted head with face patch and geometric nose; hair rebuilt as cap + two swoops + 13 broad locks; shorts as seat + per-hip leg sleeves; garments declare `covers` regions that hide the body under them; flat cuffs, collar, hems; slouch sock.
- Joint layout, animation, backpack, shoes and wardrobe ids unchanged.

## 2026-11-17 — Wiring session: first playable slice

- New game core: `game.js`, `walker.js`, `sailing.js`, `camera.js`, `save.js`; `main.js` is now a small bootstrap. Debug scaffold (`window.__dbg`) removed.
- Story additions in `story.js`: heading card, chest loot table, hint strings. Cave clue is granted silently when the tin is reached by the cleft.
- World fixes: trail colour no longer bleeds onto cave walls, cave sand limited to the floor, cave rocks moved off the walls, chest lids hinge open, moored canoe points at open water.
- UI fixes: journal fits phone widths (icon-only tools under 960px), toast shows above overlays, HUD flower stays under overlays.
- Delegated to Opus agents: synthesised audio expansion (`audio.js`) and the PWA layer (manifest, icons, service worker plugin, `pwa.js`).
- Dev-only autopilot (`src/dev/autopilot.js`) used for a scripted end-to-end playthrough.

- Running added: push the stick to its edge (or hold Shift with the keys) to run at 5.8 m/s; walk is 3.2 m/s. Running gait blends lean, longer stride and bent arms; no running while wading.

## 2026-11-17 — Fixes: surf level, cave thump, lookout whale view

- Surf about 6 dB quieter with a shallower swell (`audio.js`).
- Cave thump diagnosed by rendering the audio graph offline: the looped brown-noise buffer jumped at its wrap point, and the cave low-pass turned that step into a bass thump every 4 s. Noise buffers now loop seamlessly (filter run twice over the same white noise). In the cave the surf ducks to a muffled wash about 7 dB under the singing rock; the singing rock is now a soft E chord of near-unison sine pairs with slow beats instead of a 1.3 Hz pulse. Rock footsteps are a lighter tap so the echo does not repeat a knock.
- Lookout moved from (63, −38) to (78, −34.5) on the plateau's east lip. The old spot was 20 m behind the cliff edge, so the cliff hid the sea near the whale. Path extended to it; the atlas place moved with it. Shrubs, boulders and tall grass are kept out of a sightline wedge toward the whale (`inLookoutView` in `terrain.js`).
- Spyglass: from the lookout the eye stands at the bench, a metre toward the sea. Zoom follows whale distance (about 16 m of height in view, FOV 8–17°). Once she has dived, the glass pre-aims at her next breach spot (`whale.watchPoint`), so the breach starts in frame.
- User listened afterwards: the singing cave sounds good. The surf level has not been confirmed by ear yet.
- Testing note: the in-app preview pane stops `requestAnimationFrame` while hidden, so this session used headless Playwright (844×390) with `window.ap` for screenshots. Audio was checked by patching `AudioContext` to an `OfflineAudioContext` and measuring RMS envelopes per layer.

## 2026-11-17 — Character art pass and backpack straps

- Backpack straps: the old straps were fixed-radius tori on the chest joint, smaller than the tee, so they sat inside the cloth. They are now flat bands laid on the tee's own profile (`TOP_SHELL` in `character.js`), from the pack top over the shoulder, down the chest and under the arm, with a pink slider each. They hang on the spine joint like the tee. The pack also gained a grab handle and a ring for the shell charm.
- Knees and elbows: each arm and leg is one skinned mesh over two joints (`limbGeometry`, `Character.#limb`), so the crease where two domes met is gone. A small ball inside the joint only shows in deep bends.
- Sneakers: lofted chunky sole with a midsole stripe, an upper that rises from the toe box to the collar, heel counter, side panels, toe cap and laces. `high: true` in the wardrobe gives a taller collar (Seafoam high-tops). Sock top widened so the calf no longer pokes through.
- Shorts: lilac side panel with white piping and a notched hem (`loftPatch`, `notchHem`); `panel` colour in the wardrobe entry.
- Hair: the two smooth bunches and loose tube locks became one grooved mass (`hairMassGeometry`) with clumps that snake side to side and end at different lengths, tinted lighter on the ridges, plus a small braid across the back of the crown. The sway sign was wrong (ends swung forward into the chest when running); the ends now trail behind.
- Sit pose: `sitting: 'ground'` is a new pose for flat ground (legs out, heels down, hands on thighs). `sitting: true` keeps the canoe-seat pose. Nothing in the game uses the ground pose yet; it is ready for the lookout bench or a beach rest.
- Expressions: `faceTexture(name)` draws neutral, blink, surprised, laugh and focused (`EXPRESSIONS` in `charGeo.js`), built on first use. `Character.setExpression(name, hold)`. In the game she looks surprised while a find's card is up (tin, chests, whale, first heading), laughs for a moment after, and looks focused while reading the signpost.
- Dev character viewer: `http://localhost:<port>/?char` in the dev build (`src/dev/charViewer.js`) shows her from several angles; see the comment at the top of that file for the query parameters (`yaws`, `focus`, `pose`, `expr`, outfit slots). Used with headless Playwright to compare against `character-sheet-v1.png`.
- Checked: viewer shots of every pose, expression and both footwear and top variants; a headless new-game run at 844×390 (no console errors, about 60 fps under software rendering); `npx vite build` passes. Not checked on a phone.
- User feedback afterwards: the surf level is good by ear. The hair needs another pass later: flat on the head, and the hanging mass reads like a strange hat (logged in the wishlist).

## 2026-11-17 — Deployed to GitHub Pages

- Repo pushed to https://github.com/irispepa/farshore. `.github/workflows/pages.yml` runs `npm ci` and `npx vite build` and publishes `dist/` on each push to `main`; Pages source is "GitHub Actions". The build already used relative paths, so it runs under `/farshore/` without changes.
- Checked on https://irispepa.github.io/farshore/ with headless Chromium: the page, `sw.js`, manifest and icons return 200; the service worker precaches 16 files; a new game starts; the page relaunches offline from the cache with the save intact. Not yet checked on an iPhone.
