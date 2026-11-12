# Same-Name Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow variants in one reference exercise to share a name when their tags differ, and tell same-name variants apart wherever names show without tags.

**Architecture:** One shared rule in `src/catalog.js` (`variantConflict`, `variantLabels`, `compareVariants`). The server applies the rule inside each catalog write transaction, replacing the name-only check. Migration 010 drops the old unique index, and the seed skips a conflicting starter. The catalog form treats this conflict as a field error. Catalog and picker order use the shared comparator, and the recap and the move dialog's preview use the labels.

**Tech Stack:** Vanilla ES modules, libSQL/SQLite migrations, `node:test`, Playwright.

**Spec:** docs/superpowers/specs/2026-11-12-same-name-variants-design.md, including its 2026-11-12 amendment: the AI review is unchanged because it already receives tags. **Prerequisite:** plan 1 (docs/superpowers/plans/2026-11-12-focus-set-page.md) Task 8, so log exercises carry `brand` and `focusTags`.

## Decisions

- **Tag identity.** Conflicts compare the sorted list of all tag IDs (brand and focus together). A brand ID can never equal a focus ID, so an equal list means the same brand and the same focus set. Labels compare tag names, normalized, because logs and templates carry names only.
- **A recognizable refusal.** The server throws `domainError('CONFLICT', message)` with `details: {field: 'name', reason: 'duplicate-variant'}`. `server/api.js` already forwards `details` for `CONFLICT`. The form keys on `reason`, never on the message.
- **Before migration 010.** The old index may still raise a SQLite `UNIQUE` error naming `catalog_family_name` (or `catalog_entries.family_id`). Every catalog write maps it to the same domain error, so the user never sees `Storage is unavailable`.
- **Order.** `compareVariants` replaces `nameOrder` for variants only. References keep `nameOrder`, and the server's `ORDER BY` is unchanged because the client sorts.

## Global Constraints

- Message, exactly: `A variant with this name and the same tags already exists in this reference exercise, possibly archived. Change the name or a tag.`
- Name normalization is the existing `normalizeSearch`. Archived variants and archived tags count. The rule applies inside one reference exercise only.
- Labels: `name · brand · focus…`, joined with ` · `, brand first, focus tags in the order given. Only colliding entries change, and an untagged colliding entry stays bare.
- Migration 010 is run explicitly per environment, never during builds or requests. No change to exports, imports, logs, history, Last time, Best, volume, tag rules or the AI review.
- Change values in `style.css` first, then `docs/design-system/README.md`, and update `AGENTS.md` in Task 4.
- Never claim physical-device or production verification from localhost or emulation. Never claim a pending deployment, or an unrun migration, was verified.
- Commit on `main` after each task; messages end with the session's `Co-Authored-By` attribution line. The plan ends green on `npm test`, `npm run test:e2e` and `npm run build`.

## Review Focus

1. Focus tags given in a different order, or one variant whose brand is archived: the same ID set still conflicts, and order never matters. (Task 1)
2. Saving an edit that keeps the name and tags (description or muscles only): the variant never conflicts with itself. (Task 2)
3. Moving a variant into a reference whose archived variant has the same name and tags: refused with the message, and nothing moves. (Task 2)
4. The same variant logged twice in one workout next to a same-name variant with other tags: all three get labels, and the two identical ones read identically. (Task 1)
5. An edit refused for a name-and-tags conflict: the form shows only the message, with no "Reload saved version" or "Save as variant", focuses the name and keeps every field. (Task 3)

---

### Task 1: Shared rule, labels and order (pure)

**Files:**
- Modify: `src/catalog.js`
- Test: `test/catalog.test.js`

**Interfaces:**
- Produces:
  - `variantTagIds(entry): string[]`: the sorted IDs of `entry.brandId ?? entry.brand?.id` (when present) and of `entry.focusTagIds ?? entry.focusTags?.map(t => t.id) ?? []`.
  - `variantConflict(a, b): boolean`: `normalizeSearch(a.name) === normalizeSearch(b.name)` and an equal `variantTagIds`.
  - `variantLabels(items: Array<{name, brand?, focusTags?}>): string[]`: labels in input order. `brand` and the elements of `focusTags` may be strings or `{name}` objects.
  - `compareVariants(a, b): number`: name (`localeCompare`), then brand name (none first), then focus tag names joined, then `id`.

- [ ] **Step 1: Failing unit tests** in `test/catalog.test.js`:

```js
test('variantConflict needs the same name and the same tags',()=>{
 const v=(name,brandId=null,focusTagIds=[])=>({name,brandId,focusTagIds});
 assert.equal(variantConflict(v('Chest press'),v(' chést PRESS ')),true);
 assert.equal(variantConflict(v('Chest press'),v('Chest press','hammer')),false);
 assert.equal(variantConflict(v('Chest press','hammer'),v('Chest press','technogym')),false);
 assert.equal(variantConflict(v('Chest press','hammer',['a','b']),v('Chest press','hammer',['b','a'])),true);
 assert.equal(variantConflict(v('Chest press','hammer',['a']),v('Chest press','hammer')),false);
 assert.equal(variantConflict({name:'Chest press',brand:{id:'hammer'},focusTags:[{id:'a'}]},v('Chest press','hammer',['a'])),true);
 assert.equal(variantConflict(v('Chest press'),v('Incline press')),false);
});
test('variantLabels add tags only where names collide',()=>{
 assert.deepEqual(variantLabels([{name:'Chest press',brand:'Hammer'},{name:'Lateral raise',brand:'Hammer'}]),['Chest press','Lateral raise']);
 assert.deepEqual(variantLabels([{name:'Chest press',brand:'Hammer',focusTags:['Stretch']},{name:'chest press',brand:{name:'Technogym'}},{name:'Chest press'}]),['Chest press · Hammer · Stretch','chest press · Technogym','Chest press']);
 assert.deepEqual(variantLabels([{name:'Chest press',brand:'Hammer'},{name:'Chest press',brand:'Hammer'},{name:'Chest press',brand:'Technogym'}]),['Chest press · Hammer','Chest press · Hammer','Chest press · Technogym']);
 assert.deepEqual(variantLabels([{name:'Chest press',brand:'Hammer'},{name:'Chest press',brand:'Hammer'}]),['Chest press','Chest press']);
});
test('compareVariants keeps same-name variants together',()=>{
 const e=(id,name,brand=null,focus=[])=>({id,name,brand:brand&&{name:brand},focusTags:focus.map(name=>({name}))});
 const list=[e('4','Chest press','Technogym'),e('2','Chest press','Hammer',['Stretch']),e('1','Chest press'),e('5','Arm curl'),e('3','Chest press','Hammer')];
 assert.deepEqual(list.sort(compareVariants).map(x=>x.id),['5','1','3','2','4']);
});
```

- [ ] **Step 2:** Run `node --test test/catalog.test.js`. Expected: FAIL, the functions are not exported.
- [ ] **Step 3:** Implement the four functions in `src/catalog.js`. Labels compare normalized names, and tag sets by normalized tag names.
- [ ] **Step 4:** Run `node --test test/catalog.test.js`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(catalog): shared same-name rule, labels and order`.

### Task 2: Server enforcement, migration 010 and the seed guard

**Files:**
- Create: `migrations/010-variant-names.sql` (`DROP INDEX IF EXISTS catalog_family_name;`)
- Modify: `server/catalog-repository.js` (`unique` → `assertDistinct`, `write` maps the old index error), `server/catalog-seed.js:61–65`
- Test: `test/catalog-repository.test.js`, `test/reference-move.test.js`

**Interfaces:**
- Consumes: `variantConflict` (Task 1).
- Produces:
  - `assertDistinct(tx, familyId, candidate: {name, brandId, focusTagIds}, except = ''): Promise<void>`. It reads the family's other variants as `SELECT e.id, e.name, (SELECT json_group_array(tag_id) FROM catalog_variant_tags WHERE variant_id = e.id) AS tag_ids FROM catalog_entries e WHERE e.family_id = ? AND e.id <> ?`, archived included. When one conflicts it throws the Global message with `details: {field:'name', reason:'duplicate-variant'}`.
  - `create` and `update` pass `clean` as the candidate. `move` passes `{name: old.name, brandId: old.brand?.id ?? null, focusTagIds: old.focusTags.map(t => t.id)}` against the destination.

- [ ] **Step 1: Failing tests** in `test/catalog-repository.test.js`, on a fresh migrated database with a configured reference, a brand `hammer`, a brand `technogym` and a focus tag `stretch`:
  - `'same-name variants need different tags'`:
    - an untagged `Chest press` and a `Chest press` with `hammer` both save;
    - a second `Chest press` with `hammer` throws `code:'CONFLICT'`, the exact message and `details.reason:'duplicate-variant'`;
    - `Chest Préss` with `hammer` throws the same;
    - an archived `Chest press` with `technogym` still blocks a new one with `technogym`.
  - `'create from, edit and move apply the same rule'`:
    - creating from the `hammer` variant with `sourceVariantId`, unchanged, conflicts; after adding `stretch` it saves;
    - editing the untagged variant to `hammer` conflicts;
    - editing the `hammer` variant's description only saves (Review Focus 2).
  - `'concurrent creates of the same name and tags let one through'`: two `create` calls in `Promise.allSettled`. Exactly one is fulfilled and one rejects with `duplicate-variant`.
  - `'the old index refusal maps to the conflict'`: after migrating, recreate `CREATE UNIQUE INDEX catalog_family_name ON catalog_entries(family_id, lower(name))`. Creating `Chest press` with `technogym` next to `Chest press` with `hammer` rejects with `code:'CONFLICT'` and `duplicate-variant`, never a raw SQLite error.
  - `'migration 010 drops the index once'`: after `migrate`, `SELECT name FROM sqlite_master WHERE name='catalog_family_name'` is empty, and a second `migrate` succeeds with no new `schema_migrations` row.
  - `'seed skips a starter that would conflict'`: before `seedCatalog`, insert the first starter's family and an untagged user variant with the same name under a different ID. After seeding, the starter's ID is absent and the other starters exist. With a tagged user variant instead, the starter is inserted.
  - In `test/reference-move.test.js`, `'a move into an archived same-name same-tag variant is refused'` (Review Focus 3): the variant's family and revision are unchanged afterwards.
- [ ] **Step 2:** Run `node --test test/catalog-repository.test.js test/reference-move.test.js`. Expected: FAIL. The second `hammer` variant is refused as today, but `Chest press` with `hammer` next to the untagged one is refused too.
- [ ] **Step 3: Implement.**
  - Create the migration.
  - Replace the three `unique(...)` calls with `assertDistinct`.
  - In `write`, catch errors whose message matches `/UNIQUE/i` and `/catalog_family_name|catalog_entries\.family_id/` and rethrow the domain conflict (the pattern used by `isActiveViolation` in `workout-repository.js`).
  - The seed checks each starter with `variantConflict` (starters have no tags) against the family's variants, read with the same query, and skips conflicting ones.
- [ ] **Step 4:** Run `npm test`. Expected: PASS, including `test/catalog-api.test.js` and `test/reference-api.test.js`.
- [ ] **Step 5:** Commit `feat(catalog): same-name variants need different tags; drop the name index`.

### Task 3: The catalog form and order

**Files:**
- Modify: `src/catalog-form.js:94–100` (handle `duplicate-variant`), `src/catalog-groups.js:2,10,14` (variants sort with `compareVariants`), `src/catalog.js:41` (`searchCatalog` tie-break)
- Test: `test/catalog-groups.test.js`, `e2e/catalog-metadata-forms.spec.js`

**Interfaces:**
- Consumes: `compareVariants` (Task 1) and the server's `details.reason` (Task 2).

- [ ] **Step 1: Failing tests.**
  - In `test/catalog-groups.test.js`, `'same-name variants sort by brand then focus'`: a reference with `Chest press` [Technogym], `Chest press` [Hammer, Stretch], `Chest press` (untagged) and `Chest press` [Hammer]. Its `variants` come out in the order untagged, Hammer, Hammer·Stretch, Technogym, in both `catalog` and `picker` mode with no query.
  - In `e2e/catalog-metadata-forms.spec.js`, `'variants can share a name when their tags differ'`:
    - Create `Chest press` (untagged), then `Chest press` with Brand Hammer, in one reference; both rows show, adjacent, with the second showing `Brand: Hammer`.
    - Create a third `Chest press` with Hammer: the dialog stays open, shows the exact message, focuses `Exercise name`, keeps the Hammer selection and the muscles, and shows no `Reload saved version` or `Save as variant`.
    - Edit the untagged variant to Hammer: the same message and controls (Review Focus 5).
    - "Create variant from" the Hammer one, add Focus `Stretch` and save: three `Chest press` rows.
    - In a session editor's exercise picker, typing `chest press` lists the three adjacent. Each option's accessible name contains its tags, for example `Brand: Hammer` and `Focus: Stretch`.
- [ ] **Step 2:** Run `node --test test/catalog-groups.test.js` and `npx playwright test e2e/catalog-metadata-forms.spec.js`. Expected: FAIL (name order only; edit shows the recovery buttons).
- [ ] **Step 3: Implement.** When `e.details?.reason === 'duplicate-variant'`, the form shows `e.message`, adds no recovery buttons and focuses `fields.exerciseName`. Every other path is unchanged. Variants sort with `compareVariants`; references keep `nameOrder`.
- [ ] **Step 4:** Run `npm test` and `npx playwright test e2e/catalog-metadata-forms.spec.js e2e/reference-exercises.spec.js e2e/catalog.spec.js`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(catalog): same-name variants in forms and lists`.

### Task 4: Labels where names show alone, and docs

**Files:**
- Modify: `src/workout-recap.js:42–45` (row names), `src/reference-form.js:66` (destination preview), `AGENTS.md`, `docs/design-system/README.md` (catalog entries)
- Create: `docs/superpowers/verification/2026-11-12-same-name-variants.md`
- Test: `e2e/workout-recap.spec.js`, `e2e/reference-exercises.spec.js`

**Interfaces:**
- Consumes: `variantLabels` (Task 1); the log exercises' `brand` and `focusTags` (plan 1).

- [ ] **Step 1: Failing e2e.**
  - `e2e/workout-recap.spec.js`, `'same-name exercises read with their tags in the recap'`: a log with `Chest press` `{brand:'Hammer'}` and `Chest press` `{brand:'Technogym'}`, both with done working sets, plus `Lateral raise`. After a Focus finish, the recap rows read `Chest press · Hammer`, `Chest press · Technogym`, `Lateral raise`.
  - `e2e/reference-exercises.spec.js`, `'the move preview tells same-name variants apart'`: two references named `Press`, one with `Chest press` [Hammer] and `Chest press` [Technogym]. The move dialog's destination option for that reference ends with `Chest press · Hammer, Chest press · Technogym`.
- [ ] **Step 2:** Run `npx playwright test e2e/workout-recap.spec.js e2e/reference-exercises.spec.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The recap computes `variantLabels(log.exercises)` once per render and uses `labels[i]` for `.recap-exercise-name`.
  - The move preview computes labels over that reference's variants (sorted with `compareVariants`) and takes the first two.
- [ ] **Step 4: Search for other name-only spots.** `rg -n "\.name\b" src --glob '!*test*'` lists the candidates. Any other place that renders a variant or exercise name without its tags, in a list where same-name variants can meet, gets the same labels in this task with a test. Record the places checked, and those left out with the reason, in the verification file.
- [ ] **Step 5:** Run `npm test`, `npm run test:e2e`, `npm run build`. Expected: PASS.
- [ ] **Step 6: Docs and evidence.**
  - `AGENTS.md`: add a top section `## Same-name variants (2026-11-12)` naming the spec, this plan and the verification file, with the rule, the message, migration 010 (run explicitly per environment) and the labels. In "Reference exercises and nested catalog", "never merge colliding variant names" gains "(same name and same tags)".
  - Mirror the rule and the order in the design system's catalog entry.
  - Run `npm run db:migrate` on a copy of the local database and record that 010 applied once and a second run changed nothing.
  - Inspect the catalog and picker with same-name variants at 390px, 1366×768, 200% text and touch.
  - Record migration 010 as `pending` for preview and production until the user runs it there.
- [ ] **Step 7:** Commit `feat(catalog): tell same-name variants apart in the recap and move preview; document`.

---

## Self-review

- **Spec coverage:**
  - §1 rule, places checked, message, tag changes, seed and migration → Tasks 1–2.
  - §2 forms, "Create variant from" and order → Task 3; search and filters unchanged.
  - §3 recap and move preview → Task 4. The AI review is an amendment, with no task.
  - §5 unit, server, browser, migration and review → Tasks 1–4 and the verification file.
- **Names:** `variantTagIds`, `variantConflict`, `variantLabels`, `compareVariants`, `assertDistinct`, `duplicate-variant` and `010-variant-names.sql` keep one spelling throughout.
- **Known gaps:**
  - The concurrency test relies on libSQL serializing write transactions locally. Turso behaviour under real concurrency is unverified.
  - The Tags screen's usage counts were not checked.
