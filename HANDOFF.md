# Farshore handoff

## Date / Time / Model
2026-11-17 05:48 · Opus 5.5

## Important links
- [docs/README.md](docs/README.md): approved direction, character construction, asset workflow. Read it before the character art pass.
- [docs/history.md](docs/history.md): append-only log. The latest entry explains the surf, cave and lookout fixes and how they were tested.
- [docs/wishlist.md](docs/wishlist.md): deferred polish. Steps 2 and 3 below come from it.
- [docs/visual-development.md](docs/visual-development.md): prompts and review notes for the concept art.
- `art/farshore/concepts/character-sheet-v1.png`: the target for the character art pass.

## Plan / Spec
There is no phased spec yet. The ranked list under **Next steps** is the working plan, with direction from `docs/README.md`. Step 1 (fixes) is done except the backpack straps.

## Branch / Worktree
All work is merged to `main` (fast-forward, not pushed) in `/Users/irispepa/Projects/farshore`. This session ran on `claude/handoff-surf-cave-lookout-1e10a0` in `.claude/worktrees/handoff-surf-cave-lookout-1e10a0`, which can be archived. Start the next session from `main`.

## Status
First playable slice works end to end on desktop. This session:
- lowered the surf
- replaced the cave thump with soft singing tones (the user listened and likes them)
- moved the lookout to the cliff edge so the whale is visible through the spyglass

Nothing has run on a real iPhone yet.

## How to run it
- `npm install` (needed once per fresh worktree)
- `npm run dev`: port 5183 from `.claude/launch.json`. The preview tool moves to the next free port if 5183 is taken.
- `npx vite build`: production build plus service-worker precache (passes)
- Character viewer: open `/?char` on the dev server (parameters in `src/dev/charViewer.js`).
- Scripted playtests: the dev build exposes `window.ap` (`start()`, `st()`, `route([[x,z],…])`, `act()`, `ok()`, `run()`). The in-app preview pane stops `requestAnimationFrame` while hidden, so use headless Playwright at 844×390, or keep the pane visible.

## What exists
- `src/game/`
  - `game.js`: the game loop and screens, plus the spyglass
  - `walker.js`: on foot, walk 3.2 m/s, run 5.8 m/s
  - `sailing.js`: the canoe
  - `camera.js`: chase camera and spyglass zoom
  - `save.js`: one localStorage slot, `farshore-save-v1`
  - `input.js`: touch stick, right-thumb camera, keyboard
  - `audio.js`: synthesised sound, driven each frame by `sound.update(dt, state)`
  - `story.js`: cards, places, loot and hints
- `src/world/`, `src/entities/`, `src/fx/`, `src/ui/`: the cove, canoe, whale, character, HUD, journal and atlas.
- Story loop:
  1. The letter.
  2. Tūtū's tin, reached by canoe through the cave mouth, or on foot via the path and cleft.
  3. Spot the koholā with the spyglass, from the lookout or from the canoe.
  4. Mark the spot in the atlas.
  5. The "first heading" card.

  Two chests give outfit pieces, equipped from the journal's Looks page.
- PWA: manifest, icons (`scripts/make-icons.mjs`), service worker plugin in `vite.config.js`, `src/pwa.js`.

## Next steps
1. ~~Listen to the surf~~ done 2026-11-17: the user listened and the level is good.
2. ~~Backpack straps~~ done 2026-11-17 (see `docs/history.md`).
3. ~~Character art pass~~ done 2026-11-17: sneakers, hair, skinned knees and elbows, ground sit pose, expressions, shorts panel. Leftovers are in `docs/wishlist.md`.
   - **Hair needs another pass** (user feedback): the head hair is flat and the hanging mass reads like a strange hat.
4. **Feel and small features:**
   - canoe fast mode (a sprint input that trims the sheet, with a wake and a heavier camera pull-back)
   - chest lid inner face
   - sit on the lookout bench (it now faces the whale from the cliff edge)
   - canoe wake trail
   - seated steering pose
   - title orbit framing
   - spyglass lens ring
5. **New features:**
   - atlas marks and routes that unlock or gate something
   - more outfit pieces and chests, plus a wardrobe size decision
   - a reward beat after the first heading, so the chapter has an ending
6. **Expand:**
   - a second obstacle with several solutions
   - open-sea sailing and a second island
   - lock or revise the family-expedition plot
7. **Phone playtest:** touch feel, performance, safe areas, add-to-home-screen, offline launch.

## Key decisions
- **Lookout position:** the lookout is at (78, −34.5) on the plateau's east lip, not (63, −38). The old spot was 20 m behind the cliff, which hid the sea near the whale.
  - `inLookoutView` in `terrain.js` keeps shrubs, boulders and tall grass out of the sightline toward the whale. Anything placed on the headland top should respect it.
- **Spyglass:**
  - From the lookout, the eye stands at the bench, whatever spot she pressed it from.
  - Zoom follows the whale's distance (FOV 8–17°).
  - The spyglass aims through `whale.watchPoint()`, which points at the next breach spot while she is down.
- **Noise loops:** filtered noise buffers must loop without a jump at the join (`#noiseBuffer` runs its filter twice). A plain loop of filtered noise thumps once per loop, which was the cave thump.
- **Cave mix:** in the cave the surf ducks under the singing chord. The user approved the result by ear; keep it.
- **Clothing:** a stable base character with swappable top, bottoms, footwear and gear. Outfits are collectibles. Wardrobe size and where rewards go are still open.
- **Fiction:** keep the original fiction separate from researched Hawaiian traditions.

## Known limitations / blockers
- **No real-device run yet:** iPhone touch, performance and offline launch are all unverified.
- **Art requests are blocked:** the art-request CLI worker's model `gpt-6.1-sol` is rejected (`model_not_found`). `scripts/request-farshore-art.mjs` accepts `--model`. Don't change global auth or config.
- **Image generation is limited:** no new generations, retries or revisions without an explicit request.
- **Concepts awaiting review:** four, `character-sheet-v1`, `gameplay-ui-v1`, `loading-screen-v1`, `journal-concept-v1`.
- **Bundle size:** the JS bundle is about 712 kB because of three.js.
- **Hosting:** live at https://irispepa.github.io/farshore/ (GitHub Pages, source "GitHub Actions"). `.github/workflows/pages.yml` builds and deploys on every push to `main`; don't add GitHub's "Static HTML" starter, which would publish the raw source. Pages caches files for 10 minutes; browsers check `sw.js` for updates past the HTTP cache by default (recalled, not tested on iPhone).
