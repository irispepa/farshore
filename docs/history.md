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
