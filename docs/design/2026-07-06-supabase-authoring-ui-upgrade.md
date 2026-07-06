# Supabase Authoring and UI Upgrade Spec

## Status

Implemented locally

## Objective

Define a phased implementation plan for improving Worldbuilder's authoring, documentation-style UI, templates, page metadata, diagnostics, media support, and map architecture while keeping the current React and Supabase foundation.

This spec incorporates the accepted recommendations from the Chronicler comparison and the user's follow-up direction on 2026-07-05.

## User Need

Dungeon Masters need Worldbuilder to remain a Supabase-backed campaign workspace, but the vault should feel more like a polished wiki and campaign bible. Users should be able to write and maintain long-form lore with templates, metadata, previews, media, page inserts, broken-link reports, and a documentation-style navigation experience without moving the project to Astro Starlight, Docusaurus, or a desktop local-vault model.

The desired direction is:

- Keep the existing React site template and visual foundation.
- Treat Starlight and Docusaurus as feature checklists, not target frameworks.
- Keep Supabase as the persistence and collaboration backend.
- Add Chronicler-inspired authoring features where they fit Worldbuilder.
- Add worldbuilding-specific components for NPCs, deities, factions, dungeons, spoilers, rumors, quest hooks, timelines, diagrams, session recaps, and player-facing or DM-only sections.

## Current Code/System Summary

Worldbuilder is a React, Vite, TypeScript app backed by Supabase. Vault content is stored in `docs.body` as Markdown, rendered by `src/ui/MarkdownPreview.tsx` through `react-markdown` and `remark-gfm`, and edited through the CodeMirror-based `src/ui/Editor.tsx`.

`src/ui/PagePanel.tsx` currently supports two page modes: `edit` and `preview`. The mode is owned by `src/pages/VaultPage.tsx` as `pageMode`, persisted in localStorage, and passed through `src/pages/vault/VaultLayout.tsx`. There is no split editor/preview mode, page table of contents, heading anchor workflow, or explicit link-update-on-rename flow.

Templates are static bundled Markdown files imported in `src/lib/templates.ts` from `templates/*.md`. The vault sidebar lets users create pages from those bundled templates, but users cannot create, edit, organize, or delete templates in the app.

Tags already support a limited frontmatter parsing path through `src/domain/tags/parseTags.ts`, but there is no general YAML frontmatter model, no generic infobox renderer, and no visual page metadata editor. NPC creature association is handled separately through `npc_profiles`.

Worldbuilder has graph-derived edges, backlinks, tags, references, and a tag health report, but it does not expose a broad vault diagnostics surface for broken wikilinks, broken reference links, orphan docs, duplicate titles, malformed frontmatter, invalid tags, missing map pins, or import parse problems.

Maps are stored in `maps.image_data_url` in Supabase table rows, and pins are stored in `map_locations` with normalized coordinates. This is simple and works for small images, but it is not a scalable architecture for large maps, layers, tiles, clustering, or richer pin and region previews.

Player sharing and campaign collaboration are Supabase/RLS features. Any new rendering, attachments, DM-only sections, or page inserts must respect existing sharing boundaries and should not leak unshared content into player views.

## Proposed Design

Worldbuilder should stay a React/Supabase campaign workspace. Do not migrate to Astro Starlight or Docusaurus. Instead, add selected docs-style capabilities to the existing shell and vault.

The content model should remain Supabase-stored Markdown for user-authored pages. User-authored vault pages should not execute arbitrary MDX or JSX from the database. MDX is useful for trusted static docs or bundled developer-authored examples, but dynamic campaign content should render through a safe Markdown pipeline with a whitelist of supported worldbuilding components.

The renderer should support Markdown plus safe component syntax. The exact syntax can be chosen during implementation, but the first implementation should prefer parseable directives or shortcodes over raw JSX. Examples:

```markdown
---
type: deity
alignment: Celestial Corruption
domain: Suffering, Heroism, Trials
symbol: A cracked golden halo
tags:
  - religion:saint-applause
---

# Saint Applause

Saint Applause believes suffering produces heroes.

:::spoiler title="DM Truth"
He thinks the dungeon is the only way to forge champions.
:::

{{insert: Trial Oath}}

![[halo-fracture.png|A cracked golden halo]]
```

The first supported component set should focus on high-value worldbuilding blocks:

- Generic frontmatter infobox for locations, factions, items, NPCs, deities, lore pages, and session pages.
- NPC profile card that can optionally reuse existing `npc_profiles` creature links.
- Deity profile card.
- Faction profile card.
- Spoiler or DM-only block.
- Rumor block.
- Quest hook block.
- Timeline embed.
- Session recap block.
- Page insert/transclusion for reusable lore blocks.
- Image embed and gallery using Supabase Storage assets.

Player-facing rendering must filter DM-only blocks and inserted content by the same visibility rules as shared docs. The editor can show DM-only content to DMs, but player view must omit it unless explicitly marked as player-facing.

Implementation should be phased.

Phase 1: positioning and docs alignment.

- Update `README.md` and `WorldBuilder_readme.md` to present Worldbuilder as a Supabase-backed campaign workspace.
- Remove local-first IndexedDB claims unless a future local vault mode is separately designed.
- Document the React/Supabase direction and the reason Starlight/Docusaurus are not being adopted now.

Phase 2: editor ergonomics and docs-style layout.

- Extend page mode from `edit | preview` to `edit | preview | split`.
- Add live split editor/preview to `PagePanel`.
- Add clear save status: saved, saving, unsaved, and failed.
- Extract headings from Markdown and render a right-side table of contents in authoring and preview contexts.
- Generate stable heading anchors and support section links.
- Add copyable section links in preview.
- Add breadcrumbs and previous/next navigation where folder order is known.
- Add a full-site or campaign-site search surface. For the live Supabase app, use a client-side or Supabase-backed index first. Pagefind is a good option for a future static export, but it does not directly solve dynamic Supabase content search.
- Preserve dark mode and improve mobile docs layout around sidebar, content, and marginalia.

Phase 3: user-managed templates.

- Keep bundled templates as seed/default templates.
- Add a Supabase-backed template manager in settings or the vault sidebar.
- Let users create, edit, duplicate, delete, and apply templates.
- Support campaign-scoped templates first. User-global templates can be added later if needed.
- Add template metadata: name, description, kind/category, body, owner, campaign, created date, and updated date.

Phase 4: frontmatter and infoboxes.

- Add a shared parser for frontmatter, tags, headings, wikilinks, embeds, inserts, and component directives.
- Support generic YAML frontmatter for page metadata.
- Render a lightweight infobox from frontmatter using a safe whitelist of displayable scalar/list fields.
- Keep namespaced tags compatible with existing inline and frontmatter parsing.
- Do not force every page type into a table-backed record. Use frontmatter for flexible wiki metadata and reserve tables for behavior-heavy features such as NPC creature links, maps, references, sharing, and assets.

Phase 5: diagnostics.

- Add a vault diagnostics page or panel.
- Report broken wikilinks, broken `doc:` links, broken `ref:` links, orphan docs, duplicate titles, malformed frontmatter, invalid tags, missing map pins for docs tagged as locations, broken image embeds, broken page inserts, and import parse errors.
- Reuse existing graph, tag, reference, folder, map, and parser data where possible.
- Keep diagnostics derived at first instead of storing report rows. Add ignored diagnostics only if users need suppression controls.

Phase 6: media and attachments.

- Add Supabase Storage as the preferred asset backend.
- Add an `assets` or `attachments` metadata table to connect files to campaigns and optionally docs.
- Support image embeds, attachment links, simple galleries, and page inserts.
- Add upload, rename metadata, delete, and replace flows.
- Enforce storage policies that match campaign owner/member permissions and player visibility.
- Avoid storing large image data URLs in table rows for new media features.

Phase 7: worldbuilding components.

- Add whitelisted render components for NPC cards, deity cards, faction cards, dungeon floor templates, spoiler/DM-only blocks, rumor blocks, quest hooks, timelines, relationship or faction diagrams, session recaps, and player-facing sections.
- Components should be declarative data blocks parsed from Markdown, not arbitrary JSX execution.
- Start with components that render from frontmatter or fenced directives. Add visual editing later only for the highest-use components.

Phase 8: map architecture.

- Move new map images to Supabase Storage before adding richer map features.
- Keep normalized pins, but prepare the schema for layers, large-image metadata, and storage paths.
- Add layers, canvas-rendered pins, pin previews, clustering, and large-image performance work only after Storage migration is in place.
- Treat tiling and shape/region drawing as advanced map work, not as prerequisites for authoring parity.

## Files Likely Affected

Documentation:

- `README.md`
- `WorldBuilder_readme.md`
- `supabase/README.md`
- `docs/design/2026-07-05-worldbuilder-reverse-engineered-spec.md`
- `docs/design/2026-07-05-chronicler-comparison.md`
- This spec

Authoring and rendering:

- `src/ui/PagePanel.tsx`
- `src/ui/Editor.tsx`
- `src/ui/MarkdownPreview.tsx`
- `src/pages/VaultPage.tsx`
- `src/pages/vault/VaultLayout.tsx`
- `src/pages/vault/utils.ts`
- New parser/rendering modules under `src/domain/markdown/` or `src/features/authoring/`

Templates:

- `src/lib/templates.ts`
- `src/ui/Sidebar.tsx`
- `src/pages/vault/VaultModals.tsx`
- `src/pages/SettingsPage.tsx`
- New template query helpers in `src/vault/queries.ts` or a feature-specific query module

Diagnostics:

- Existing `src/features/vaultHealth/*`
- New diagnostics modules under `src/features/vaultDiagnostics/`
- Vault or settings UI for diagnostics results

Media and maps:

- `src/pages/MapsPage.tsx`
- `src/ui/Marginalia.tsx`
- `src/vault/types.ts`
- `src/vault/queries.ts`
- `supabase/app-schema.sql`
- New Supabase Storage policy SQL

Tests:

- `src/__tests__/roadmap/*`
- New focused tests for parsing, rendering, templates, diagnostics, assets, and map migrations.

## API/Schema Changes

Use additive schema changes. Do not rewrite existing docs, tags, edges, maps, or NPC profile tables as part of the first pass.

Recommended new `templates` table:

- `id text primary key`
- `campaign_id text references campaigns(id) on delete cascade`
- `owner_id uuid not null default auth.uid()`
- `name text not null`
- `description text`
- `kind text`
- `body text not null`
- `created_at bigint not null`
- `updated_at bigint not null`

Recommended new `assets` table:

- `id text primary key`
- `campaign_id text not null references campaigns(id) on delete cascade`
- `doc_id text references docs(id) on delete set null`
- `owner_id uuid not null default auth.uid()`
- `storage_path text not null`
- `filename text not null`
- `content_type text`
- `size_bytes bigint`
- `alt_text text`
- `created_at bigint not null`
- `updated_at bigint not null`

Recommended map additions for a later phase:

- Add `image_storage_path text` and image dimension metadata to `maps`.
- Keep `image_data_url` for backward compatibility until migration is complete.
- Add `map_layers` if multiple layer visibility becomes a product requirement.
- Extend `map_locations` only after pin clustering, shapes, or typed pins are designed.

Frontmatter metadata should be parsed from `docs.body` initially, not stored in a new table. A separate metadata table can be considered later if filtering or indexing needs exceed what parsed docs and existing `tags` can support.

Diagnostics should be derived on demand initially. Do not store diagnostics until ignore/snooze workflows exist.

## Data Flow

Authoring save flow:

1. User edits title/body in `PagePanel`.
2. Debounced save writes `docs.body` and updated timestamp through existing query helpers.
3. Shared parsing extracts wikilinks, tags, headings, frontmatter, embeds, inserts, and component directives.
4. Existing edge and tag rebuild behavior continues.
5. New derived UI state provides table of contents, save status, and diagnostics inputs.

Preview render flow:

1. `MarkdownPreview` receives content and render context: DM view or player view, active campaign, docs index, references index, and assets index.
2. The parser strips or interprets frontmatter.
3. The renderer transforms wikilinks, doc links, reference links, heading anchors, image embeds, page inserts, and whitelisted component directives.
4. DM-only content renders only in DM contexts.
5. Player view omits DM-only blocks and refuses to insert unshared docs.

Template flow:

1. Bundled templates seed the create-page menu.
2. User-managed templates load from Supabase for the active campaign.
3. Template manager writes template CRUD changes to the new `templates` table.
4. Create-from-template inserts a new doc with the selected template body.

Diagnostics flow:

1. Diagnostics loads docs, folders, edges, tags, references, maps, map locations, and assets for the active campaign.
2. Shared parsers derive expected links, embeds, inserts, headings, frontmatter, and tags.
3. Diagnostics compare expected references against existing rows and report actionable issues.
4. Users can open the affected doc directly from each issue.

Media flow:

1. User uploads a file from a doc or media manager.
2. The file is uploaded to Supabase Storage under a campaign-scoped path.
3. An `assets` row records metadata.
4. The editor inserts an asset embed token into Markdown.
5. Preview resolves embeds through authorized storage URLs.

Map flow:

1. New maps store image files in Supabase Storage and metadata in `maps`.
2. Existing data URL maps keep rendering until migrated.
3. Pins continue to store normalized coordinates.
4. Later layers, tiles, and clustering consume the storage-backed image metadata.

## Risks and Tradeoffs

- Raw MDX from Supabase-stored user content would allow too much executable UI behavior. A whitelisted Markdown component renderer is safer and easier to test.
- Directive/shortcode syntax is less flexible than MDX, but it keeps user content portable and controlled.
- Frontmatter parsing can become inconsistent if tag parsing, prep helpers, and infobox rendering use separate parsers. A shared parser should be introduced early.
- Split preview can be expensive on large pages if rendering happens on every keystroke. Debounce preview parsing or memoize derived results.
- Link-update-on-rename can corrupt content if implemented as blind string replacement. It needs a parser-aware update path and previewable changes.
- Page inserts can create cycles. The renderer must detect insert depth and circular references.
- Supabase Storage requires careful bucket naming and RLS/storage policy design, especially for player-visible assets.
- Diagnostics can overwhelm users if every minor issue is surfaced equally. Group by severity and make results actionable.
- Map tiling, layers, and clustering can grow into a large feature area. Keep map architecture phased behind Storage migration.
- Pagefind is attractive for static docs, but a live Supabase app needs a different first search implementation unless a static export pipeline is added.

## Alternatives Considered

- Move to Astro Starlight. Rejected because the user wants to keep the React template and avoid rebuilding the site around Astro.
- Move to Docusaurus. Rejected for now because it would make the app primarily a docs framework. It remains a useful feature checklist and possible future migration option.
- Use raw MDX for user-authored vault pages. Rejected because Supabase-stored campaign content should not execute arbitrary React components.
- Stay with plain Markdown only. Rejected because the requested worldbuilding blocks, infoboxes, spoilers, inserts, and media galleries need structured rendering.
- Rebuild around a local-first desktop vault. Rejected because the product direction is now explicitly Supabase-backed.
- Implement full Chronicler-style map parity immediately. Rejected because Storage, assets, and authoring parity are more urgent foundations.

## Test Plan

Parser tests:

- Frontmatter parses valid YAML and reports malformed frontmatter.
- Existing inline and frontmatter tags remain compatible.
- Wikilinks, `doc:` links, `ref:` links, heading anchors, embeds, inserts, and component directives are extracted deterministically.
- Circular page inserts stop at a safe depth and produce a visible diagnostic.

Renderer tests:

- Markdown preview renders wikilinks, doc links, reference links, section links, infoboxes, spoiler blocks, DM-only blocks, image embeds, galleries, and page inserts.
- Player view hides DM-only content and refuses to render inserts or assets from unshared docs.
- Raw JSX-like input renders as text or unsupported markup, not executable React components.

Editor/UI tests:

- `PagePanel` supports edit, preview, and split modes.
- Save status transitions through unsaved, saving, saved, and failed states.
- Table of contents updates when headings change.
- Section link controls use stable heading IDs.
- Rename-link workflow previews and applies only parser-confirmed link occurrences.

Template tests:

- Bundled templates still load.
- User templates can be listed, created, edited, duplicated, deleted, and applied.
- Campaign-scoped template visibility respects owner/member rules.

Diagnostics tests:

- Reports broken wikilinks, broken references, orphan docs, duplicate titles, malformed frontmatter, invalid tags, broken embeds, broken inserts, and map pin issues.
- Diagnostics link back to affected docs.
- Existing tag health behavior is preserved or intentionally folded into the new diagnostics UI.

Media/map tests:

- Asset uploads create Storage objects and `assets` rows.
- Asset embeds resolve to authorized URLs.
- Asset deletion handles orphaned references predictably.
- Existing data URL maps still render.
- New storage-backed map metadata renders pins at the same normalized coordinates.

Recommended command checks after implementation:

- `npm run test:run`
- `npm run build`

## Documentation Plan

Update `README.md` and `WorldBuilder_readme.md` to state that Worldbuilder is Supabase-backed and collaboration-oriented.

Document the authoring model:

- Markdown remains the base content format.
- User-authored vault pages support whitelisted worldbuilding components through directives or shortcodes.
- Raw MDX/JSX is not executed from Supabase content.
- Frontmatter powers infoboxes and page metadata.
- Tags continue to use namespaced Worldbuilder conventions.

Document templates, diagnostics, media attachments, player-facing vs DM-only content, and map storage behavior as those phases ship.

Update `supabase/README.md` with new tables, Storage bucket setup, policy requirements, and migration order.

## Rollout/Rollback Plan

Rollout should be incremental and additive.

1. Land documentation alignment first.
2. Add split preview and table of contents without schema changes.
3. Add parser and renderer support behind feature-scoped tests.
4. Add user-managed templates with an additive table migration.
5. Add diagnostics as derived UI without stored report rows.
6. Add Supabase Storage and assets with new policies.
7. Migrate maps to storage-backed metadata only after asset handling is proven.

Rollback:

- UI-only phases can be reverted by restoring the previous page mode and preview components.
- Parser features should fail closed by rendering unsupported directives as plain content or visible unsupported blocks.
- Additive schema changes can remain unused if a rollout is paused.
- Storage-backed assets should not replace existing data URL maps until a migration and rollback path exists.
- Link rename updates must provide a preview before applying, so users can cancel before mutation.

## Open Questions

- Should player-facing extracts eventually be materialized for stronger permission boundaries, or is render-time filtering sufficient for the current product?
- Should relationship diagrams evolve from the current safe directive block into Mermaid, React Flow, or an edge-backed visual graph?
- Should user-global templates be added after campaign-scoped templates, or should template reuse remain campaign-local?
- Should search graduate from client-side loaded-doc search to Supabase text search once campaign sizes justify it?
- Should map tiling, clustering, layers, and large-image previews be implemented before or after map sharing/player-map requirements are defined?

## Decisions

### 2026-07-06 - Keep Supabase and React as the foundation

- **Decision:** Keep Worldbuilder as a React/Supabase campaign workspace and add docs-style authoring features inside the existing app.
- **Reason:** The current implementation, sharing model, and user direction all support Supabase as the product foundation.
- **Alternatives rejected:** Astro Starlight, Docusaurus, and local-first desktop vault migration.
- **User feedback:** User said, "Lets keep it as supabase" and advised keeping the React site template.
- **Impact on implementation:** Future work should update docs and app features around Supabase, not plan a framework or persistence migration.

### 2026-07-06 - Use safe Markdown components instead of raw user MDX

- **Decision:** User-authored Supabase vault pages should use Markdown plus whitelisted directives or shortcodes, not arbitrary MDX/JSX execution.
- **Reason:** This preserves the desired component authoring workflow while avoiding executable database content.
- **Alternatives rejected:** Raw MDX from `docs.body`, because it is too risky for shared campaign content and harder to secure in player views.
- **User feedback:** User suggested MDX as the preferred authoring model; this spec adapts that goal into a safer React rendering model.
- **Impact on implementation:** Add parser and renderer modules for supported components instead of wiring arbitrary MDX compilation into runtime content.

### 2026-07-06 - Prioritize Chronicler-inspired authoring parity

- **Decision:** Plan split preview, infoboxes, user templates, diagnostics, media embeds, page inserts, and link rename updates as core authoring upgrades.
- **Reason:** These close the highest-value gaps identified by the Chronicler comparison without abandoning Worldbuilder's campaign operations strengths.
- **Alternatives rejected:** Leaving those features as optional future ideas.
- **User feedback:** User approved the authoring feature set with "yes."
- **Impact on implementation:** The roadmap should be phased around authoring, templates, metadata, diagnostics, media, and maps.

### 2026-07-06 - Implement local app changes before remote Supabase writes

- **Decision:** Implement schema files, app code, docs, and tests locally first; do not reset, push, or mutate the remote Supabase project without a separate explicit approval.
- **Reason:** Recreating Supabase is destructive external state work, while the app and SQL changes can be prepared and validated locally.
- **Alternatives rejected:** Running `supabase db reset`, `supabase db push`, or manual remote SQL immediately, because data loss and auth/config drift need a separate approval gate.
- **User feedback:** User said, "ok, lets implement all our changes."
- **Impact on implementation:** This pass can add SQL and app code, but deployment to Supabase remains a separate controlled step.

### 2026-07-06 - Local authoring upgrade implemented

- **Decision:** Implement the local app/schema/docs/test portion of the authoring upgrade: split preview, table of contents, save status, safe frontmatter infoboxes, safe block directives, page inserts, user-managed templates, vault diagnostics, Storage-ready asset/map schema, docs alignment, and tests.
- **Reason:** These changes close the highest-value authoring gaps without requiring destructive remote Supabase work.
- **Alternatives rejected:** Waiting to implement UI work until the remote Supabase project is recreated, because local code and additive SQL can be validated independently.
- **User feedback:** User approved implementation.
- **Impact on implementation:** Remote SQL application, Supabase Storage bucket setup, actual file upload UI, gallery management, map tiling/layers/clustering, and static export search remain follow-up deployment/product work.

### 2026-07-06 - Implement private campaign media workflow first

- **Decision:** Add the first media workflow using a private `campaign-assets` Supabase Storage bucket, campaign-scoped object paths, asset metadata rows, a page media library, and `asset:<id>` Markdown embeds.
- **Reason:** Media support is the largest remaining authoring gap, and a private Storage-backed implementation lets Worldbuilder avoid data URLs and local-only attachments while preserving campaign ownership checks.
- **Alternatives rejected:** Public buckets were rejected because campaign media may include spoilers or private DM material. Storing signed URLs in Markdown was rejected because signed URLs expire and should be generated at render time. Player-visible asset sharing was deferred because it needs a separate sharing policy design.
- **User feedback:** User said, "ok lets start" after the remaining feature list identified media and Storage as the biggest next feature.
- **Impact on implementation:** Add Storage bucket/policy SQL, asset upload/delete helpers, visible media library UI, signed URL rendering for `asset:<id>` embeds, diagnostics wired to asset ids/paths, focused tests, and docs. Do not mutate hosted Supabase.

### 2026-07-06 - Close remaining local spec gaps

- **Decision:** Implement the remaining local spec checklist items that do not require hosted Supabase mutation: body search, template duplication, rename previews, duplicate-safe section anchors, gallery embeds, asset metadata/replace flows, player-view media resolution, shared asset RLS SQL, safe worldbuilding component blocks, broken section diagnostics, optional import parse diagnostics, Storage-backed map uploads, and document title/description metadata.
- **Reason:** These were the remaining gaps identified after the first authoring and media passes, and they can be implemented locally with additive app and SQL changes.
- **Alternatives rejected:** Deferring them as a later roadmap item, because the user asked to implement the missed spec changes. Full map tiling, clustering, public asset publishing, and arbitrary MDX execution remain out of scope because they require larger product/security decisions.
- **User feedback:** User said, "Ok implment them."
- **Impact on implementation:** Add search/render/parser/test helpers, widen media callbacks and UI, update player rendering, add map Storage upload helpers, update Storage/RLS SQL files and migrations, update documentation, and verify with full tests/build. Hosted Supabase remains untouched.

## User Feedback / Decisions

- 2026-07-05: User approved keeping Worldbuilder Supabase-backed: "Lets keep it as supabase."
- 2026-07-05: User approved the Chronicler authoring features as important enough to plan: split preview, infoboxes, user-managed templates, diagnostics, media embeds, page inserts, and link rename updates.
- 2026-07-05: User asked to keep the React template and use Starlight/Docusaurus as feature checklists rather than migrating frameworks.
- 2026-07-05: User suggested MDX for worldbuilding pages with embedded React components. This spec keeps the authoring goal but recommends a safe whitelisted component syntax for Supabase-stored vault content.
- 2026-07-06: User approved implementation of the planned changes: "ok, lets implement all our changes."
- 2026-07-06: Local implementation completed and verified with `npm run build` and `npm run test:run`. Remote Supabase mutation was not performed.
- 2026-07-06: Private campaign media workflow implemented locally with Supabase Storage SQL, upload/list/delete UI, `asset:<id>` embeds, signed preview URLs, diagnostics coverage, and focused tests. Hosted Supabase was not mutated.
- 2026-07-06: Remaining local spec gaps implemented and verified with `npm run test:run` and `npm run build`. Hosted Supabase was not mutated.
