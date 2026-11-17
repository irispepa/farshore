# Farshore handoff

Session continuity lives here; design and asset docs are in `docs/`.

## Status · 2026-11-17

- Imported 2026-11-17 into this standalone project from the Codex worktree (originally the `flight-games` repo, commit `0f8f252`; art, docs, art script only). Original notes follow. Work was in the detached checkout initially based on `be4b2df`, `/Users/irispepa/.codex-workspaces/worktrees/ios-90991f9c-8abb-4190-99e3-9a42687d0625/flight-games`. The user authorized a local Farshore checkpoint commit in this worktree only; main must remain unchanged. No push was authorized or made.
- [Direction and asset workflow](docs/README.md): third-person stylised 3D, girly '90s beach aesthetic, Maui/Hawaiian setting, whales, island hopping, treasure hunting, multiple solutions and a personal atlas. The family-expedition plot is proposed, not selected.
- The user loves `art/farshore/concepts/gameplay-view-v1.png` and endorsed further exploration; it is a style reference. No Farshore runtime implementation or game integration has started.
- Four follow-ups await review: `character-sheet-v1.png`, `gameplay-ui-v1.png`, `loading-screen-v1.png`, `journal-concept-v1.png`, all under `art/farshore/concepts/`. See [visual development](docs/visual-development.md) for exact prompts, dimensions and review notes. "Some uli" was interpreted as UI and stated before generation.
- Clothing direction reaffirmed: outfits and accessories are discoverable collectibles. Keep a stable base character with swappable tops/bottoms/footwear and gear. Wardrobe size, individual looks and reward placement remain open.
- The user has limited generation usage. A single combined construction sheet was authorized and saved as `art/farshore/concepts/character-construction-v1.png`; [exact prompt](docs/requests/character-construction-v1.md). It depicts only the starting outfit to conserve generation usage, not to remove outfit collection. No additional variants, retries or automatic revisions without a new request. It awaits review.
- `scripts/request-farshore-art.mjs` prepares bounded CLI art requests. Syntax, dry run and overwrite refusal were checked. Direct built-in image generation succeeded in this chat.

## Blocker

A live CLI capability check failed because `gpt-6.1-sol` was rejected for the CLI's ChatGPT login (`model_not_found`). Automated image generation remains unverified. The script accepts `--model` for an explicitly available model; global authentication/configuration was not changed.

## Next

Review the visual concepts and construction sheet. Resolve CLI model availability before relying on automatic calls. The proposed first playable slice is a small cove with sailing, walking, two routes to a clue and an atlas annotation interaction.

The generated PNGs remain review/reference material, not captured gameplay, rigged models or integrated production assets. Preserve approved references and save revisions as siblings.
