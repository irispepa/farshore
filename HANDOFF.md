# Farshore handoff

Session continuity lives here; design and asset docs are in `docs/`.

## Status · 2026-11-17 (build session, interrupted by usage limit)

Commit `2e9069c` ("WIP: save interrupted ... first build session") added a Vite + Three.js project (`npm run dev`, port 5183 via `.claude/launch.json`). `vite build` passes. Code is complete per file but not wired into a game.

**Written (~3,000 lines):**
- `src/world/`: terrain, water, sky, flora, rocks/props for Sheltered Cove; assembled in `world.js`.
- `src/entities/`: `character.js` (rigged, walk/sit, hair lag, blink, swappable outfit slots top/bottoms/footwear), `canoe.js`, `whale.js`; `src/fx/spray.js`.
- `src/game/`: `input.js` (floating left stick, right-thumb camera, keyboard), `audio.js`, `story.js` (objectives, clues, tasks, places, cards, map bounds).
- `src/ui/`: `ui.js` (HUD, title, pause, cards), `journal.js` (atlas/journal), `icons.js`; `src/style.css`.

**Not done:**
- `src/main.js` is a debug scaffold: builds the world, character, canoe and whale, renders from a fixed camera, character driven by `window.__spd` / `window.__sit`. `window.__dbg` and the hard-coded `view(...)` are dev-only and must go.
- `Input`, `UI`, `Journal`, `Sound` are not imported by anything. No movement, chase camera, board/disembark canoe, interact targets, objectives/clues/atlas flow, title or pause.
- Nothing has been viewed visually or tested on a phone. Character and world quality are unverified; the user expects to need model changes.
- No PWA layer (manifest, service worker, offline); `public/` is empty.

## Next

1. Run the dev server and review the character and world visually; fix the model first.
2. Propose, then write, the real `main.js`: game loop, state, third-person camera, walk/canoe mode switch, interact targets, wiring to Input/UI/Journal/Sound/story.
3. Finish the first slice: sail, walk, two routes to a clue, one atlas annotation.
4. Add PWA offline support; keep `docs/` in sync.

## Status · 2026-11-17 (import)

- Imported 2026-11-17 into this standalone project from the Codex worktree (originally the `flight-games` repo, commit `0f8f252`; art, docs, art script only). Original notes follow. Work was in the detached checkout initially based on `be4b2df`, `/Users/irispepa/.codex-workspaces/worktrees/ios-90991f9c-8abb-4190-99e3-9a42687d0625/flight-games`. The user authorized a local Farshore checkpoint commit in this worktree only; main must remain unchanged. No push was authorized or made.
- [Direction and asset workflow](docs/README.md): third-person stylised 3D, girly '90s beach aesthetic, Maui/Hawaiian setting, whales, island hopping, treasure hunting, multiple solutions and a personal atlas. The family-expedition plot is proposed, not selected.
- The user loves `art/farshore/concepts/gameplay-view-v1.png` and endorsed further exploration; it is a style reference. Runtime work started in the build session above.
- Four follow-ups await review: `character-sheet-v1.png`, `gameplay-ui-v1.png`, `loading-screen-v1.png`, `journal-concept-v1.png`, all under `art/farshore/concepts/`. See [visual development](docs/visual-development.md) for exact prompts, dimensions and review notes. "Some uli" was interpreted as UI and stated before generation.
- Clothing direction reaffirmed: outfits and accessories are discoverable collectibles. Keep a stable base character with swappable tops/bottoms/footwear and gear. Wardrobe size, individual looks and reward placement remain open.
- The user has limited generation usage. A single combined construction sheet was authorized and saved as `art/farshore/concepts/character-construction-v1.png`; [exact prompt](docs/requests/character-construction-v1.md). It depicts only the starting outfit to conserve generation usage, not to remove outfit collection. No additional variants, retries or automatic revisions without a new request. It awaits review.
- `scripts/request-farshore-art.mjs` prepares bounded CLI art requests. Syntax, dry run and overwrite refusal were checked. Direct built-in image generation succeeded in this chat.

## Blocker

A live CLI capability check failed because `gpt-6.1-sol` was rejected for the CLI's ChatGPT login (`model_not_found`). Automated image generation remains unverified. The script accepts `--model` for an explicitly available model; global authentication/configuration was not changed.

## Earlier next steps

Review the visual concepts and construction sheet. Resolve CLI model availability before relying on automatic calls. The proposed first playable slice is a small cove with sailing, walking, two routes to a clue and an atlas annotation interaction.

The generated PNGs remain review/reference material, not captured gameplay, rigged models or integrated production assets. Preserve approved references and save revisions as siblings.
