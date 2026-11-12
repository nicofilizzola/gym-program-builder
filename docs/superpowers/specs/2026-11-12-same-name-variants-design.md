# Same-name variants

Date: 2026-11-12.

Status: Design approved in conversation on 2026-11-12; written specification awaiting user review. This is spec 4 of four from the 2026-11-11 backlog (item 3). It ships after [spec 1, Focus set page](2026-11-12-focus-set-page-design.md), which shows tags in the tracker and copies them into logs.

## Purpose and agreed direction

The user asked to "make it possible to create exercise variants that share the same name, under the condition that there's at least one different tag." The typical case is one machine name from different brands, such as `Chest press` by Hammer and by Technogym, inside one reference exercise.

Decisions:

- Any tag difference allows a shared name: a different brand, a different set of focus tags, or tags on one and none on the other.
- Two variants conflict only when their names match and their tags are identical.
- Wherever a list shows names without tags and two of them collide, those names get their tags appended.

Success means the user can name variants after the machine and tell them apart by their tags everywhere they choose, log or review them.

## Existing requirements and boundaries

This extends [Exercise catalog](2026-10-25-exercise-catalog-design.md), [Reference exercises](2026-10-25-reference-exercises-design.md) and [Reference metadata and tags](2026-10-29-linked-sessions-catalog-design.md). It replaces these rules, and `AGENTS.md` and `docs/design-system/README.md` are updated in the same change:

| Existing rule | Replaced by |
|---|---|
| Server: "A variant with this name already exists in this reference exercise, possibly archived. Choose a distinct variant name." (name alone, compared ignoring case and accents) | A conflict needs the same name and the same tags (§1). |
| Migration 002: `CREATE UNIQUE INDEX catalog_family_name ON catalog_entries(family_id, lower(name))` | Dropped by migration 010; the server rule is the only guard (§1). |
| Reference exercises: "never merge colliding variant names" | Still never merged; "colliding" now means same name and same tags (§1). |

Unchanged:
- Tag rules: kinds, names unique within a kind, archive, restore and propagation.
- Variant identity and IDs; moves, copies and links.
- Equal names across different reference exercises, which are already allowed.
- Logs (they carry the tag names since spec 1), templates, exports and imports. Imports stay unlinked until the user confirms.
- History, Last time and Best (all keyed by variant ID) and volume.
- The AI review's input shape and prompt version.

## 1. The rule

- **Conflict.** Inside one reference exercise, two variants conflict when:
  - their names are equal after the existing normalization (`normalizeSearch`: trimmed, case- and accent-insensitive), **and**
  - their tags are identical: the same brand, or neither has one, and the same set of focus tags, compared by tag ID.
  - Archived variants and archived tags count.
- **Everything else is allowed.** Examples in one reference exercise: `Chest press` (no tags), `Chest press` [Hammer], `Chest press` [Technogym] and `Chest press` [Hammer, Stretch] can all coexist. A second `Chest press` [Hammer] is refused.
- **Where it is checked.** Every write that sets a name or tags, inside that write's transaction, so two saves at once cannot both pass:
  - creating a variant, including from a picker's "New variant";
  - "Create variant from";
  - editing a variant's name or tags;
  - moving a variant, against the destination's variants.
- **Message.** `A variant with this name and the same tags already exists in this reference exercise, possibly archived. Change the name or a tag.`
- **Tag changes elsewhere** (rename, archive, restore) never create a conflict, because assignments are by tag ID and tag names are unique within a kind.
- **Seeding.** A starter variant that would conflict with an existing one in its reference exercise is skipped. Today the unique index silently skips it.
- **Migration 010** drops `catalog_family_name`. It is run explicitly per environment, never during builds or requests. Until it has run, the database still refuses a same-name variant, and the server reports that refusal with the message above, never as a server error.

## 2. Catalog screens

- **Forms.** The create and edit forms keep their fields. A conflict shows inline as other save errors do, focus moves to the name field and the draft is kept.
- **"Create variant from"** starts with the source's name, description, muscles and tags, as today. Changing one tag is now enough to save under the same name.
- **Order.** In the catalog list and the exercise picker, variants sort by name, then brand (none first), then focus tags, then ID. Same-name variants therefore sit together and read as a set. Their tags already show as labelled metadata and are part of each row's and option's accessible name.
- Search, filters, archive and the move dialog are unchanged apart from the rule in §1.

## 3. Places that show names only

- **Rule.** In a list that shows variant names without their tags, when two or more entries share a normalized name with different tags, each of them shows its tags after the name. The brand comes first, then the focus tags in catalog order, all joined with ` · `, for example `Chest press · Hammer · Stretch`. An untagged entry stays `Chest press`, and names that do not collide never change.
- **Places and their scope** (the list within which a collision is detected):
  - the reference exercise's variant preview: that reference's variants;
  - the workout recap's exercise rows: that workout;
  - the program AI review input: the whole program snapshot, every occurrence included.
- **One pure helper** in `src/catalog.js` computes these labels from `{name, brand, focusTags}`. Templates carry the tag names, and logs carry them since spec 1.
- **AI review.** The input's shape, the facts and the prompt version stay the same; only colliding names gain their tags.
- **Tagged places stay as they are:** the catalog, the picker, template cards, the tracker (spec 1) and the overview (spec 2).

## 4. Delivery order

One plan, one shippable part:

1. The shared rule and its server enforcement, with migration 010 and the seed guard.
2. Catalog order and form behaviour.
3. Labels in name-only places.

## 5. Verification

- **Unit:**
  - the conflict rule: same name and same tags; case and accent variants; brand only; focus only; untagged next to tagged; focus sets in different orders; archived variants;
  - the label helper: no collision, two-way and three-way collisions, an untagged member, focus order;
  - the sort order.
- **Server (`node --test`):**
  - create, "Create variant from", edit and move each accept a different tag set and refuse an identical one with the message;
  - two concurrent creates of the same name and tags: one succeeds;
  - before migration 010, the index refusal maps to the message;
  - seed replay skips a conflicting starter.
- **Browser (`npm run test:e2e`):**
  - creating `Chest press` with Hammer next to an untagged `Chest press`;
  - the inline conflict with the draft kept;
  - "Create variant from" saving after one tag change;
  - picker and catalog order with tags shown and announced;
  - recap rows with two same-name variants;
  - the reference preview.
- **Migration:** `npm run db:migrate` on a copy of the local database applies 010 once; running it again changes nothing.
- **Review:** the catalog and picker populated with same-name variants at 390px, 1366×768, 200% text and touch.
- Evidence goes in `docs/superpowers/verification/2026-11-12-same-name-variants.md`. Run migration 010 explicitly in each environment (local, preview, production); never claim a pending deployment or an unrun migration was verified.
- `npm test`, `npm run test:e2e` and `npm run build` pass.

## Out of scope

Merging duplicate variants; a duplicates view or warnings; automatic name suffixes; same-name reference exercises; changing tag uniqueness or tag kinds; showing tags in workout history rows (which show workout names, not exercises); and any change to exports, imports or the AI prompt.
