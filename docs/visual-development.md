# Farshore visual development

## Direction and review status

The user endorsed [gameplay view v1](../art/farshore/concepts/gameplay-view-v1.png): "I love the concept image so far!" They requested a character sheet for the main girl, UI, a loading screen and a journal concept. "Some uli" was interpreted as "some UI" and this assumption was stated before generation.

The four new images are review candidates. The accepted foundation remains third-person stylised 3D, a girly '90s beach-adventure style, Maui/Hawaiian setting, whales, island hopping, treasure hunting, multiple ways through obstacles and an atlas the player annotates.

## Images and reproducible requests

All four used built-in image generation with `gameplay-view-v1.png` as the supplied reference; no CLI/API fallback was used. Each PNG was copied into the workspace, its dimensions and PNG header checked, and its copied bytes verified against the generated source. The generated images were visually inspected. There are no runtime/UI performance or touch-test claims.

| Concept | Saved image | Dimensions | Exact prompt |
| --- | --- | --- | --- |
| Main girl: turnaround, expressions and gear | [Character sheet](../art/farshore/concepts/character-sheet-v1.png) | 1536 × 1024 | [Request](requests/character-sheet-v1.md) |
| Third-person touch controls | [Gameplay UI](../art/farshore/concepts/gameplay-ui-v1.png) | 1672 × 941 | [Request](requests/gameplay-ui-v1.md) |
| Ocean voyage, title and loading treatment | [Loading screen](../art/farshore/concepts/loading-screen-v1.png) | 1672 × 941 | [Request](requests/loading-screen-v1.md) |
| Annotatable atlas and clue notes | [Journal](../art/farshore/concepts/journal-concept-v1.png) | 1672 × 941 | [Request](requests/journal-concept-v1.md) |
| Base character and separable starting outfit | [Construction sheet](../art/farshore/concepts/character-construction-v1.png) | 1536 × 1024 | [Request](requests/character-construction-v1.md) |

The construction sheet was a later, single usage-conscious generation referenced to `character-sheet-v1.png`. It shows the base in a plain construction suit, hair hidden for silhouette visibility, front/side/back views, a dressed assembly and separate garment/gear groups. It is a visual construction guide; reconcile exact proportions, profile arm position and attachment alignment in the real 3D character rather than treating generated views as mechanically identical.

Clothing direction: players find and collect outfits/accessories. Support a stable base with swappable top, bottoms and footwear plus attached gear. The user explicitly reaffirmed that expectation. Only the starting outfit is depicted here to conserve image-generation usage; wardrobe designs and size remain open. No further image generations or outfit variants were requested. See [construction direction](README.md#character-and-clothing-construction).

## What each concept explores

- Character: same dark waves, pink flower/earrings/watch, white-and-aqua tee, pink shorts, lilac socks, pink/aqua sneakers and aqua expedition pack from the accepted reference. The previously unseen face is newly proposed. Front, side, back and three-quarter views, curious/delighted/concentrating expressions and a gear detail give the modeling work consistent visual targets. Fine accessory construction still needs reconciliation in a real 3D turnaround/model.
- Gameplay UI: accepted scene kept recognizable, with translucent aqua/pink movement joystick, Interact and Journal controls, location/objective plaque, pause and a canoe prompt. There is no minimap or economy/status clutter. These are image-based control concepts; validate their actual scale, opacity, thumb reach and safe areas in the playable landscape prototype.
- Loading: familiar explorer and canoe travelling toward islands, whale offshore, pearly pink Farshore title, aqua/pink progress treatment and "Packing your atlas…". The composition and lettering are exploratory; implementation should separate background art from live text/progress. The tagline is proposed interface copy, not a locked narrative requirement.
- Journal: aqua binding, cream paper, translucent pink corners, Map/Clues/Whales tabs, pink and lilac alternate routes, tide/whale notes, a cove photograph and Draw/Mark/Erase/Undo controls. It uses a pictorial cove illustration rather than a true overhead survey map. The map is a fictional schematic derived from the reference, not authoritative Maui geography. The next interaction study should establish drawing, zoom/pan, editable marks, undo and how unobserved terrain is represented.

## Handoff boundaries

These images establish proposals for visual composition, character and UI styling. They are not extracted textures, a rigged character, final typography, an interactive journal, or captured gameplay. Preserve the accepted source and keep revisions in sibling versioned files. The existing CLI model/login blocker is unchanged; see [workflow validation](README.md#asset-workflow).
