# Farshore

Standalone offline iPhone PWA: a third-person, stylised 3D exploration adventure. Maui/Hawaiian setting, whales, sailing, island hopping, treasure hunting, a personal atlas. Girly '90s beach aesthetic.

Read first: `HANDOFF.md` (status, blockers), then `docs/README.md` (direction, asset workflow, build handoff).

## State

First playable slice exists: Vite + Three.js, `npm run dev`, `npx vite build`. Game code is in `src/` (`game/` loop and controllers, `world/`, `entities/`, `ui/`, `fx/`). Untested on a real phone. Imported from the `flight-games` repo (commit `0f8f252`); nothing else from that repo belongs here.

## Layout

- `art/farshore/concepts/` — generated concept PNGs. Style references only, not runtime assets. Never overwrite approved ones; save revisions as `-v2` siblings.
- `docs/README.md` — approved direction, character construction, asset workflow
- `docs/visual-development.md` — prompts, sizes, review notes for each concept
- `docs/requests/` — one brief per generated image
- `scripts/request-farshore-art.mjs` — bounded Codex CLI art request (`--dry-run` to preview)
- `HANDOFF.md` — session continuity

## Decisions already made

- Landscape, third person, stylised 3D (Three.js or similar), offline PWA, bundled assets only.
- Controls proposal: left thumb move/steer, right thumb assisted camera, contextual interact, close-up inspect, dedicated atlas screen. Needs a playable prototype to confirm.
- Stable base character with swappable top/bottoms/footwear and attached gear, on a shared joint/attachment layout. Outfits are collectibles found through exploration.
- Obstacles have several solutions (observation, equipment, routes, relationships).
- Atlas: draw routes, place symbols, annotate conditions, connect clues.
- `gameplay-view-v1.png` is the accepted style reference.
- Family-expedition plot is proposed, not locked. Keep original fiction separate from researched Hawaiian traditions.

## Constraints

- Image generation usage is limited. Do not generate, retry or revise art without an explicit request.
- A PNG is a style target, not a model, texture or captured gameplay. Inspect actual images; a written file does not mean visual acceptance.
- Keep concept art out of runtime folders until selected and prepared.
- CLI art worker is blocked on model availability (`gpt-6.1-sol` rejected); see `HANDOFF.md`. Don't change global auth/config.

## Next

See `HANDOFF.md`: phone playtest and tuning, art pass, more cove content.

## Working rules

- Propose an approach before writing code on non-trivial tasks.
- Ask before committing or pushing.
- Deferred or out-of-scope ideas go in `docs/wishlist.md`; append-only project log in `docs/history.md`.
