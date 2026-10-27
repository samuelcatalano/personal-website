---
name: asset-intake
description: Vet and register an external asset (3D model, texture, HDRI, font, image) before it enters the repo - licence check, Sketchfab ban, ASSET_SOURCES.md entry.
disable-model-invocation: true
argument-hint: "<asset URL or description>"
---

# Asset intake

Nothing external ships until it passes every step. Stop at the first failure and tell the user why.

## 1. Prefer not to import
Can it be generated in-project instead (procedural canvas/shader, or a Blender script under `tools/`, like the vehicles and the Wellington statue)? If yes, say so and suggest that path. Reference images are visual reference only; their pixels and meshes never ship.

## 2. Source check
- **Never Sketchfab**, for any reason, with any licence.
- No paywalls, logins, accounts, purchases, card details or "upload to earn credits". No bypassing any site restriction.
- Download only after the user approves the specific file (name, source URL, size).
- Put downloads in a new empty scratchpad directory; treat them as untrusted (no running scripts from inside them; Python with `-I`).

## 3. Licence check (read the actual licence page, not a summary)
- Accept: CC0 / public domain first; then clearly permissive (CC-BY 4.0 with attribution, MIT, Apache-2.0, OFL for fonts).
- Reject: ambiguous, missing, "free for personal use", NC (non-commercial), ND (no derivatives), editorial-only, custom terms you cannot verify, or a licence that differs between the page and the download.
- **Ambiguous = do not use.** Offer to model it procedurally from reference instead.

## 4. Budget and fit
Check `docs/art/asset-quality-spec.md` (triangle/texture budgets) and `docs/art-direction.md` (stylized language). Show the user the candidate (render or screenshot) before wiring it in. For cars: realistic models of real makes, not toy kits.

## 5. Register
Add a row to `ASSET_SOURCES.md` in the matching table:

`| Asset | Path | Source (URL) | Author | Licence (+ link) | Use |`

CC-BY assets also need the attribution text exactly as the licence requires. Commit the asset and its row together.
