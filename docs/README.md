# Farshore

[HANDOFF.md](../HANDOFF.md) holds session notes.

## Approved direction

A standalone exploration adventure built around direct movement, spatial discovery and learning how a living world works.

- Offline iPhone PWA; third-person, stylised 3D.
- User's visual direction: "girly beach 90s kids game style".
- Maui-based setting with Hawaiian culture and lore, whales, sailing, island hopping and treasure hunting.
- Several ways to solve obstacles, using observation, equipment, routes and relationships.
- A personal atlas inspired by the user's DS mapping experience: draw routes, place symbols, annotate conditions and connect clues.
- A plot with a concrete destination and meaningful progress.
- Find and collect outfits and accessories through exploration. This was part of the original visual-direction proposal; the user explicitly reaffirmed that expectation. Keep a consistent base character and allow clothing/gear changes. A curated wardrobe's size, individual designs and exact reward placement remain open.
- The proposed controls are landscape, left thumb to move/steer, right thumb to adjust an assisted camera, contextual interaction, close-up inspection and a dedicated atlas screen. The user accepted third person and stylised 3D; exact touch behaviour still needs a playable prototype.

## Character and clothing construction

Build the character as actual stylised 3D in the browser, using Three.js or similar. Base-body parts, garments and attached gear should use a compatible common joint/attachment layout; this does not require a Blender/Unreal production pipeline. The character's face, proportions and base remain stable when outfits change. Plan swappable top, bottoms and footwear slots, plus independently attached accessories/gear. Initial implementation can validate the system with the starting outfit before adding collectible looks.

The user has limited generation usage. One combined construction-sheet generation was authorized: consistent front/side/back base views in a relaxed A-pose, a dressed assembly view, and the existing outfit's separate pieces. "No extra outfits" in that generation means no additional outfit images/variants, not removing outfit collection from the game. Do not generate a wardrobe, alternative sheets or automatic revisions without a new request. Clothing collection is a game feature; extra concept art is a separate usage decision.

## Visual development

- [Gameplay view](../art/farshore/concepts/gameplay-view-v1.png)
- [Exact image request and prompt](requests/gameplay-view-v1.md)
- Built-in image generation; 1672 × 941 PNG. This is concept art, not captured gameplay.
- Visual observations: third-person character, readable inland path and cave, sailing canoe, distant whale, pink/aqua accessories and warm volcanic coastline. The character is larger and the landscape more detailed than requested; camera distance and production detail remain review choices.
- The user said "I love the concept image so far" and requested a character sheet, UI, loading screen and journal concepts. The first image is now the accepted style reference for continued exploration; this does not settle production geometry, exact camera distance, or touch behaviour.
- [Four follow-up concepts, exact prompts and review notes](visual-development.md). These new designs await review. No Farshore runtime code or production asset integration exists yet.

## Proposed story, not yet locked

An original fictional expedition: help a living grandmother finish a voyage she abandoned, reconstruct clues across islands, locate her missing canoe and uncover what happened at the last anchorage. This was a suggested plot, not a user-selected final script. Treat original fiction separately from researched Hawaiian traditions.

## Asset workflow

Claude owns the game implementation. A bounded art worker owns one requested image at a time. The brief and any supplied references carry the context; a fresh CLI session does not automatically contain this conversation. The user reviews style candidates before they become production references.

1. Write an asset brief under `docs/requests/`: purpose, dimensions/aspect, subject, framing, approved style, references, invariants and review criteria. Use the v1 brief as a worked example.
2. Preview the worker request without launching it:

   ```sh
   node scripts/request-farshore-art.mjs docs/requests/gameplay-view-v1.md art/farshore/concepts/gameplay-view-v2.png --dry-run
   ```

3. Omit `--dry-run` to invoke the installed `codex exec` worker. Add `--reference art/farshore/concepts/gameplay-view-v1.png` only when explicitly using that candidate as a reference. Supply an updated brief for a revision.
4. The worker uses the built-in image tool and copies the output into the requested workspace path. The script refuses existing outputs/reports. Run requests serially and use a new versioned filename for revisions.
5. Inspect the actual image. A successful file write does not establish visual acceptance, usable textures, a 3D model, or iPhone performance. Keep references outside runtime folders until selected and prepared for their intended role.

The script uses the current CLI authentication and permissions. It does not bypass approvals, configure credentials or invoke the Image API. If the worker lacks built-in image generation, it must report the block rather than switch providers. Review the adjacent `.report.md` for the prompt/method and any failure.

Validation on 2026-11-17: the direct built-in generation succeeded; script syntax, dry-run construction and overwrite refusal passed. A live read-only CLI capability check failed before model execution: the configured `gpt-6.1-sol` was rejected with `model_not_found` / "not supported when using Codex with a ChatGPT account". No CLI image generation has been verified. Use `--model <available-model>` once a model accepted by that CLI login is known, or correct the CLI authentication/configuration; do not silently change global settings. The local model cache lists `gpt-6.1-sol`, so that cache alone does not establish account availability.

## Build handoff

Keep sailing, traversal, whale behaviour, multiple solutions and the atlas as connected parts of one 3D adventure. A PNG is a style target; geometry, animation, controls and mechanics are implementation work. Bundle any selected runtime assets locally for offline caching.

Farshore is a standalone offline PWA; no shared shell exists yet. Choose the landscape orientation, safe areas and PWA config when scaffolding the first playable slice. Bundle selected runtime assets locally for offline caching.

Next: review the character, gameplay UI, loading screen and journal concepts, then build a small explorable cove with sailing, walking, two routes to a clue and one atlas annotation interaction.
