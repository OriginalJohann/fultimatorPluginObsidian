# Plan: Fultimator → Obsidian Plugin (Release 1)

> **Status:** Agreed design (grill-session, 19.10.2026). This document is the single
> source of truth for Release 1 implementation.
>
> **Source spec:** `INSTRUCTIONS.md` · **Test vault:** `./flosFabUBox` ·
> **Reference code:** `fultimator-fork` (clone of
> `github.com/OriginalJohann/fultimatorPluginObsidian`, 818 commits, read-only reference)

---

## 1. Goal & Scope

Convert the Fultimator web app (React + Firebase, Fabula Ultima homebrew tool) into a
**native Obsidian plugin** that uses the vault's Markdown files as its data backend.

### Release 1 (this plan)
- **Adversary Designer** – form-based editor for Fabula Ultima adversaries.
- **Adversary Compendium** – vault index over all adversary files (list, search, filter,
  duplicate, derive) **plus** JSON import (Fultimator `TypeNpc` format).

### Explicitly out of scope for Release 1
- Dice Roller, Combat Simulator (per decision Q2).
- Full original adversary form (all original fields) → Release 1.x (decision Q6, hybrid).
- Items, Rituals, Projects, NPC Generator → later releases (Q2 roadmap order).
- Conversion of the user's existing `flosFabUBox/1. Beastiary/` statblocks → on explicit
  user request (Q7).
- Removal of the web app from the fork repo → perspective, after Release 1 (Q14).

---

## 2. Agreed Decisions (Grill-Session Summary)

| # | Decision |
|---|----------|
| Q1 | **Headless core port.** New standalone Obsidian plugin unit; Fultimator logic (models, generators, calc) re-implemented as TS modules; UI rebuilt natively; Firebase replaced by vault files. |
| Q2 | Release 1 = Adversary Designer + Adversary Compendium. Roadmap: Items, Rituals, Projects, NPC Generator. No dice roller, no combat simulator. |
| Q3 | Target vault structure **configurable**; `7. Blue` is the reference structure. |
| Q4 | **Template = single source of truth (SOT)** for output format. Strict reproduction of template structure (frontmatter, headings, ` ```statblock ` block, tags). |
| Q5 | Compendium = **vault index** (B) + **JSON import** as bonus. No bundled adversary content. |
| Q6 | **Hybrid UI:** Release 1 form covers exactly the template fields; full original form in 1.x. |
| Q7 | **Marker-based bidirectional editing.** Only files with `generator: fultimator` frontmatter are edited in place. Foreign files are read-only in the editor and **never overwritten** (hard invariant). |
| Q8 | UI technology: **Svelte** (official Obsidian plugin template standard). |
| Q9 | **Template is SOT; the model adapts to the template.** Refinements: immunities are expressed via affinity values (RS/VU/AB/IM); armor maps to flat `DEF`/`MDEF`; `spCost` moves to frontmatter (template extension); `raregear` dropped; `sheild` dropped (dead field, verified in source). |
| Q10 | **Two-track editor → simplified:** structured subfields are kept in the model and serialized as a **reversible `~`-encoding** inside `desc`/`name` lines (deterministic round-trip, no JSON block needed). See §5. |
| Q11 | **JSON import = Fultimator `TypeNpc` schema** with a conscious, one-time lossy transformation into the template-based model. Export = the `.md` file itself. No third JSON format. |
| Q12 | **Lazy check** on file open (mtime/hash compare, merge preview on divergence). No file watcher. |
| Q13 | **Name = filename** (`sanitized(name).md`); collisions → `Name (2).md`, `Name (3).md`; foreign unmarked files are never overwritten. |
| Q14 | Plugin lives in a **`plugin/` subfolder** of the fork repo. Web app (`src/`, `functions/`, Firebase) stays as read-only reference for now, removed later. |
| Q15 | **Minimal settings:** `adversaryFolder` (default `6. Bestiary`) + `generatorMarker` (default `generator: fultimator`). All format details (tags, cssclasses, fields, affinity keys) are **read from the template file** – no duplicated truth. |
| Q16 | **Vitest unit tests** (parser, serializer, mapper, collision logic) + **fixture vault** (`tests/fixtures/` with real bestiary files) + manual smoke test in `flosFabUBox`. |

### Post-grill refinements (user confirmations)
- `sp_pool` is a **derived value** (`calcAvailableSkills`), not a free-input field.
- `NpcAttack.special[]` and `NpcSpell` subfields (`range`, `attr1/2`, `damagetype`,
  `mp`, `target`, `duration`, `special`) **stay in the model**; they are parsed/serialized
  through the template's `~`-separated line format.
- The web app's **SP-pool calculation logic must be ported** (see §7).

---

## 3. Architecture & Repo Layout

```
fultimatorPluginObsidian/            (fork repo = target)
├── src/                             # web app – READ-ONLY REFERENCE (818 commits)
├── functions/                       # firebase – reference only
├── plugin/                          # NEW: standalone Obsidian plugin unit
│   ├── main.ts                      # plugin entry (Plugin subclass)
│   ├── manifest.json                # id, name, minAppVersion, isDesktopOnly
│   ├── versions.json
│   ├── esbuild.config.mjs
│   ├── package.json                 # svelte, obsidian, vitest, @types
│   ├── styles.css                   # minimal; theme compatibility via vault themes
│   ├── src/
│   │   ├── core/                    # headless logic (no Obsidian imports)
│   │   │   ├── model.ts             # Adversary model (see §4)
│   │   │   ├── template.ts          # template SOT reader (parses template .md)
│   │   │   ├── serialize.ts         # model → ```statblock``` + frontmatter
│   │   │   ├── parse.ts             # .md → model (incl. ~-decoding, §5)
│   │   │   ├── sp.ts                # ported calc* SP/HP/MP/DEF/MDEF logic (§7)
│   │   │   ├── import-npc.ts        # Fultimator TypeNpc JSON → model (lossy map)
│   │   │   └── filename.ts          # sanitization + collision suffix (Q13)
│   │   ├── ui/                      # Svelte views
│   │   │   ├── designer/            # adversary designer (multi-tab form)
│   │   │   └── compendium/          # vault index view
│   │   └── plugin/                  # Obsidian glue: views, commands, settings
│   └── tests/
│       ├── unit/                    # vitest specs for core/
│       └── fixtures/vault/          # mini vault w/ real bestiary files
└── plans/                           # this file
```

Key architectural rules:
- `core/` has **zero Obsidian imports** → fully unit-testable in Node.
- Template file path is resolved at runtime from the vault; the template **defines**
  field names, order, tags, cssclasses (Q15 – no duplicated format config).
- Build: esbuild (official Obsidian plugin workflow). UI: Svelte.

---

## 4. Data Model (Release 1 Adversary)

The model mirrors the template SOT **plus** the structured subfields the user kept
(Q9 refinement). Source of the template:
`flosFabUBox/7. Blue/1. Basics/Templates/add new Fantasy Statblock Monster.md`.

### 4.1 `statblock` block fields (SOT)
| Field | Type | Notes |
|---|---|---|
| `layout` | `"Fabula Ultima NPC"` | fixed |
| `name` | string | |
| `rank` | string? | optional in template |
| `level` | number | |
| `species` | string | |
| `description` | string | |
| `traits` / `typicaltraits` | string | mutual exclusivity per template comment |
| `DEX` `INS` `MIG` `WLP` | number | attributes |
| `HP` `MP` `DEF` `MDEF` | number | `DEF`/`MDEF` are the armor projection (Q9) |
| `initiative` | number? | optional |
| `physical` `air` `bolt` `dark` `earth` `fire` `ice` `light` `poison` | `RS` \| `VU` `AB` \| `IM` \| ∅ | value set from `src/types/Misc.ts` enum (`rs`,`vu`,`ab`,`im`,`no`); **immunities live here** (Q9) |
| `attacks-m[]` / `attacks-r[]` | `{name, desc}` | desc = `~`-encoding (§5) |
| `spells[]` | `{name, desc}` | desc = `~`-encoding (§5) |
| `skills[]` | `{name, desc}` | desc = `~`-encoding (§5) |
| `rules[]` | `{name, desc}` | plain text (no structured subfields) |

### 4.2 Structured subfields kept in the model (Q9 refinement)
- `NpcAttack`: `range`, `attr1`, `attr2`, `type`, `special[]`, `extraDamage?`
- `NpcSpell`: `range`, `type`, `damagetype`, `attr1`, `attr2`, `mp`, `special[]`,
  `target`, `duration`, `effect`
- `NpcAction` / `NpcSpecial`: `spCost` (→ frontmatter, §5.2), `effect` (→ `desc` text)

These are **not** stored as free text: they are encoded deterministically into the
`~`-separated lines and decoded back (round-trip lossless, §5).

### 4.3 Frontmatter (template + plugin extensions)
| Field | Source |
|---|---|
| `statblock: inline` | template |
| `tags: [NPCs, homebrew]` | template |
| `cssclasses: [Folder-6]` | template |
| `generator: fultimator` | **plugin marker** (Q7) |
| `sp_costs:` (list of `{name, spCost}` for actions+special) | **plugin extension** (Q9) – feeds SP budget validation |
| `sp_pool` | **plugin extension** – derived value = `calcAvailableSkills` (§7), cached for export |

### 4.4 Dropped from `TypeNpc` (conscious, documented)
`sheild` (dead field – verified: declared in `types/Npcs.ts:132`, referenced nowhere),
`armor`/`sheild` structures (→ flat `DEF`/`MDEF`), `raregear`, `NpcImmunities`
(status conditions; damage-type immunity covered by affinity `IM`), `notes`, `tags`,
`imgurl`, `label`, `sizes`, `id`/`uid` (vault filename is the identity).

---

## 5. Serialization Format (Round-Trip Contract)

The ` ```statblock ` block is YAML. Structured subfields are encoded as a
**deterministic, reversible `~`-separated format** inside `name`/`desc` lines
(user-specified mapping, Q10 refinement).

### 5.1 Spells (user-confirmed mapping)
Template line:
```
- name: "Spell name ($ if offensive) ~ [Check] + modifier (if any) ~ Cost ~ Target ~ Duration."
  desc: "Effect."
```
decodes to:
| segment | model field |
|---|---|
| `Spell name ($ if offensive)` | `name` (`$` prefix ⇔ offensive ⇔ `type`) |
| `[Check] + modifier (if any)` | `attr1`/`attr2` (+ optional modifier) |
| `Cost` | `mp` |
| `Target` | `target` |
| `Duration` | `duration` |
| `desc:` | `effect` (free text) |

`damagetype`/`range`/`special[]` of spells and `attr1/attr2/type/special[]/extraDamage`
of attacks use the same positional `~` convention (exact grammar defined in
`core/serialize.ts` + `core/parse.ts` and fixed by unit tests).

### 5.2 Attacks / Skills
- `attacks-m`/`attacks-r`: `name` = attack name; `desc` = `~`-encoded
  `[attr1 + attr2] ~ [damage formula] ~ <damagetype>` + free-text suffix
  (matches existing bestiary style, e.g. `Brigand.md`:
  `desc: "**[MIG + MIG] ~ [HR + 10] physical** damage"`).
- `skills`/`rules`: `name` = action name; `desc` = effect text. `spCost` of
  actions/specials is **not** in the block – it lives in frontmatter `sp_costs`
  (see §4.3), keeping the rendered statblock clean.

### 5.3 Round-trip guarantees (tested)
1. `serialize(parse(file)) == file` for all plugin-generated files (byte-identical
   modulo whitespace normalization).
2. `parse(serialize(model)) == model` (structure-preserving).
3. Foreign/hand-edited files: parse is **tolerant** – unparseable `desc` segments
   fall back to raw text (editor shows them as free text); no data loss, no crash.

---

## 6. Sync & File Handling

- **Marker (Q7):** frontmatter `generator: fultimator` (key configurable, Q15).
  Only marked files are opened for in-place editing. Unmarked files: read-only in
  the editor; saving a derived copy creates a new file, never overwrites.
- **Lazy check (Q12):** on opening a marked file in the designer, compare stored
  hash (plugin-side index) with current file content. On divergence → merge preview
  (field-level diff) with *Take file version* / *Keep editor version* / *Cancel*.
  No file watcher.
- **Naming (Q13):** filename = `sanitize(name) + ".md"` into `adversaryFolder`.
  Sanitization: replace `/ \ : * ? " < > |` with space, collapse whitespace, trim.
  Collision with existing file → `Name (2).md`, `Name (3).md`, …
  **Hard invariant:** a file without the plugin marker is never overwritten.
- **Writes:** atomic (write temp file in same folder, then rename) to avoid
  partial files on crash.

---

## 7. SP-Pool & Derived-Value Calculation (Port from Web App)

Port from `fultimator-fork/src/libs/npcs.js` into `plugin/src/core/sp.ts`
(exact logic, including species special cases):

| Function | Logic summary |
|---|---|
| `calcAvailableSkills` | `FromSpecies` (L266) + `FromLevel` (L292) + `FromVulnerabilities` (L296, **VU values grant SP**) + `FromRank` (L330) |
| `calcUsedSkills` | `FromOtherActions` (Σ `spCost`, default 1) + `FromSpecialAttacks` (Σ `special.length` + `extraDamage`) + `FromSpecial` (Σ `spCost`) + `FromSpells` + `FromResistances` (Σ `rs` / 2; Construct: earth free; Demon: −2 free) + `FromImmunities` (Σ `im`; Construct/Elemental/Undead: poison free; Undead: dark free; Elemental: −1 free) + `FromAbsorbs` (Σ `ab`) + extra fields (`statusImmunity`, `extraDefs`, `extraHP`, `extraMP`, `extraInit`, `extraPrecision`, `extraMagic`, `equip`) |
| `calcHP` `calcMP` `calcInit` `calcDef` `calcMDef` `calcDamage` `calcPrecision` `calcMagic` | ported 1:1 (L1, L48, L69, L114, L150, L178, L207, L237) |

Behaviour in the designer:
- `sp_pool` (frontmatter) = **derived** `calcAvailableSkills(npc)`, recomputed live;
  not a user input.
- Live validation: `calcUsedSkills(npc) ≤ sp_pool`; over-budget → inline warning
  (non-blocking, user can still save).
- `HP`/`MP`/`DEF`/`MDEF`/`initiative` are derived previews in the form (overridable
  where the template field allows, mirroring the original `extra` overrides).

---

## 8. JSON Import (Fultimator `TypeNpc`)

- **Input:** Fultimator web-app JSON export (single object or array of `TypeNpc`,
  schema per `fultimator-fork/src/types/Npcs.ts`).
- **Mapping (conscious, one-time lossy):**
  - `name`, `lvl`→`level`, `species`, `rank`, `description`, `traits` → direct.
  - `attributes` → `DEX/INS/MIG/WLP`.
  - `extra.hp`/`def`/`mDef` (with overrides) → `HP`/`DEF`/`MDEF`; `extra.init` → `initiative`.
  - `affinities` (keys incl. `wind` → **`air`** rename) values `rs/vu/ab/im/no`
    → uppercase `RS/VU/AB/IM`/empty.
  - `attacks[]`/`weaponattacks[]` → `attacks-m`/`attacks-r` with `~`-encoded `desc`
    (`attr1+attr2`, `type`, `special[]` appended as text, `extraDamage` flagged).
  - `spells[]` → `spells` with `~`-encoded `name` (mp/target/duration) + `effect`→`desc`.
  - `actions[]`/`special[]` → `skills` (`effect`→`desc`) + `spCost` → frontmatter `sp_costs`.
  - **Dropped (logged to import report):** `armor`, `sheild`, `raregear`, `immunities`,
    `notes`, `tags`, `imgurl`, `label`, `sizes`, `id`/`uid`.
- **Result:** import writes new files via the normal save path (marker, naming,
  collision rules apply). A per-file import report lists dropped/transformed fields.
- No plugin-defined export JSON: the `.md` file **is** the export (Q11).

---

## 9. Settings (Minimal, Q15)

| Setting | Default | Description |
|---|---|---|
| `adversaryFolder` | `6. Bestiary` | Target folder for adversary files (vault-relative). |
| `generatorMarker` | `generator: fultimator` | Frontmatter key+value identifying plugin-managed files. |
| `templatePath` | `7. Blue/1. Basics/Templates/add new Fantasy Statblock Monster.md` | Template SOT; format (fields, order, tags, cssclasses) is **derived from it at runtime**. |

No format details in settings (no duplicated truth). Validation: folder created on
first save; template readable → else plugin disables itself with a clear notice.

---

## 10. UI (Svelte)

### 10.1 Adversary Designer (ItemView)
- Multi-tab form mirroring template sections: **Basics** (name, rank, level, species,
  description, traits/typicaltraits), **Attributes & Defense** (DEX/INS/MIG/WLP,
  derived HP/MP/DEF/MDEF/initiative), **Affinities** (9 keys × RS/VU/AB/IM/∅),
  **Attacks** (melee/ranged lists), **Spells**, **Skills/Actions** (with `spCost`),
  **Rules**.
- Live derived panel: `sp_pool`, used SP, over-budget warning (§7).
- Actions: *New*, *Open file*, *Save*, *Duplicate*, *Import JSON*.
- Opening an existing marked file → lazy check (§6) before editing.

### 10.2 Adversary Compendium (ItemView)
- Index of all `.md` files in `adversaryFolder` (frontmatter + statblock parsed).
- Search (name/species/rank), filter (level range, affinity, tags), sort.
- Row actions: open in designer, duplicate, derive (pre-filled copy), open in leaf.
- Unmarked files are listed (read-only badge) – the compendium is a vault index (Q5-B).

---

## 11. Testing Strategy (Q16)

- **Unit (Vitest, `plugin/tests/unit/`):** `parse`/`serialize` round-trip, `~`-grammar,
  tolerant parsing of hand-edited files, `sp.ts` calc functions (golden values from
  the web app), `import-npc` mapping, `filename` sanitization/collision.
- **Fixture vault (`plugin/tests/fixtures/vault/`):** representative real files –
  `Brigand.md` (existing bestiary style, unmarked), a plugin-generated marked file,
  a colliding name, a hand-broken `desc` – used as parse/save fixtures.
- **Manual smoke test in `flosFabUBox`:** plugin linked via `ln -s` into
  `.obsidian/plugins/`; flow: create adversary → file appears in `6. Bestiary`
  rendering correctly in Minimal/Strategy Guide theme → open in designer → edit →
  save → file updated → import JSON → compendium lists all.
- **Definition of Done (Release 1):** unit + fixture tests green, smoke test passed,
  zero data loss on all fixture round-trips.

---

## 12. Task Breakdown (implementation order)

| # | Task | Depends on |
|---|---|---|
| T1 | Scaffold `plugin/` (esbuild + Svelte template, manifest, empty Plugin class, builds `main.js`) | – |
| T2 | `core/model.ts` + `core/template.ts` (template SOT reader) | T1 |
| T3 | `core/serialize.ts` + `core/parse.ts` incl. `~`-grammar + round-trip unit tests | T2 |
| T4 | `core/sp.ts` (ported calc functions) + golden-value tests | T2 |
| T5 | `core/filename.ts` + atomic write helper + unit tests | T2 |
| T6 | `core/import-npc.ts` (TypeNpc JSON mapping) + tests | T3, T4 |
| T7 | Settings UI (`adversaryFolder`, `generatorMarker`, `templatePath`) | T1 |
| T8 | Designer view (Svelte) wired to core (new/save/open, lazy check, SP panel) | T3–T7 |
| T9 | Compendium view (index, search, filter, duplicate/derive) | T3, T7 |
| T10 | JSON import flow (command + mapping report) | T6, T8 |
| T11 | Fixture vault + full test suite green | T3–T6 |
| T12 | Smoke test in `flosFabUBox` (theme rendering, full loop) | T8–T10 |

---

## 13. Roadmap Beyond Release 1

1. **Release 1.x:** full original adversary form (all `TypeNpc` fields where a
   template representation is defined); bestiary conversion tool for
   `flosFabUBox/1. Beastiary/` (on explicit user request).
2. **Release 2:** Items (template `add new Rare Item.md` + `2. Fabula Ultima/Items/`).
3. **Release 3:** Rituals.
4. **Release 4:** Projects.
5. **Release 5:** NPC Generator (`routes/generator` reference).
6. **Perspective:** remove web app (`src/`, `functions/`, Firebase config) from repo.

---

## 14. Risks & Open Points

| Risk / Point | Mitigation |
|---|---|
| `~`-grammar ambiguity on hand-edited `desc` lines | Tolerant parse (§5.3.3) + fixture tests with real files |
| Template file missing/moved in other vaults | `templatePath` setting + plugin self-disable with clear notice |
| 5e-statblocks plugin not installed in a target vault | Statblock block is plain YAML – files remain readable; rendering degrades gracefully |
| `sp_pool` divergence after model edits | Always recomputed on save; cached value never trusted over calculation |
| Large form complexity (designer) | Svelte components per template section; hybrid scope (Q6) keeps R1 bounded |
| Fork repo divergence from upstream | Web app is reference-only; plugin code self-contained in `plugin/` |

