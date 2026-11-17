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
