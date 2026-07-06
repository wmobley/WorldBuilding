# Chronicler Comparison Brief

## Status

In Review

## Scope

This brief compares the Worldbuilder reverse-engineered design spec against `mak-kirkland/chronicler` as a neighboring worldbuilding/wiki product.

It is not an implementation plan. It identifies feature overlap, UI differences, strategic positioning, and possible changes to consider in future Worldbuilder specs.

## Sources

- Worldbuilder baseline: [2026-07-05-worldbuilder-reverse-engineered-spec.md](./2026-07-05-worldbuilder-reverse-engineered-spec.md)
- Chronicler repository: <https://github.com/mak-kirkland/chronicler>
- Chronicler README: <https://github.com/mak-kirkland/chronicler/blob/master/README.md>
- Chronicler HELP: <https://github.com/mak-kirkland/chronicler/blob/master/HELP.md>
- Chronicler CHANGELOG: <https://github.com/mak-kirkland/chronicler/blob/master/CHANGELOG.md>
- Chronicler package: <https://github.com/mak-kirkland/chronicler/blob/master/package.json>
- Chronicler layout and view source:
  - <https://github.com/mak-kirkland/chronicler/blob/master/src/routes/%2Blayout.svelte>
  - <https://github.com/mak-kirkland/chronicler/blob/master/src/routes/%2Bpage.svelte>
  - <https://github.com/mak-kirkland/chronicler/blob/master/src/lib/components/sidebar/Sidebar.svelte>
  - <https://github.com/mak-kirkland/chronicler/blob/master/src/lib/components/views/FileView.svelte>
  - <https://github.com/mak-kirkland/chronicler/blob/master/src/lib/components/views/Preview.svelte>
  - <https://github.com/mak-kirkland/chronicler/blob/master/src/lib/components/map/MapView.svelte>
  - <https://github.com/mak-kirkland/chronicler/blob/master/src/lib/commands.ts>

## Executive Summary

Chronicler and Worldbuilder share a markdown/wiki foundation: files or pages, wikilinks, backlinks, tags, templates, maps, and a strong worldbuilding audience.

They diverge sharply in product posture:

- Chronicler is a desktop-first, offline, local Markdown vault. Its strongest product promise is data ownership, privacy, zero account setup, file compatibility, and polished wiki authoring.
- Worldbuilder, as currently implemented, is a web/Supabase campaign workspace. Its strongest product promise is graph-backed campaign context, DM prep helpers, rules/reference tools, player sharing, and live session support.

The comparison suggests two different winning strategies:

- If Worldbuilder wants to compete directly with Chronicler as a writing/wiki tool, it needs local-first storage, richer infobox/media/template tooling, diagnostics, and editor polish.
- If Worldbuilder stays a campaign operations tool, it should lean away from generic wiki parity and double down on D&D/session workflow: prep helpers, encounter/loot/reference integration, player view, session play, campaign graph context, and optional AI.

The product direction decision is now explicit: Worldbuilder stays Supabase-backed. That means the documentation should stop implying local-first storage and instead frame Supabase as a deliberate collaboration, sharing, and session-workflow foundation.

## Product Positioning

| Area | Chronicler | Worldbuilder Spec |
| --- | --- | --- |
| Primary identity | Offline local wiki for writers, worldbuilders, and GMs | Campaign knowledge and play-prep workspace for tabletop RPG DMs |
| Storage promise | Plain Markdown files in a user-chosen local vault | Supabase-backed campaigns, docs, folders, edges, tags, references, sharing |
| Trust posture | No sign-up, no subscription, no cloud for core use | Magic-link auth, Supabase RLS, cloud persistence, optional player sharing |
| Platform | Desktop app built with Svelte, Rust, and Tauri | Browser app built with React, Vite, and Supabase |
| Revenue/licensing | Source-available, free core, license-gated cosmetic/pro features | Private project; no product licensing model described |
| Differentiator | Local file ownership plus wiki authoring polish | DM-specific prep, rules references, session play, sharing, AI context |

## Feature Comparison

| Feature Area | Chronicler | Worldbuilder Spec | Takeaway |
| --- | --- | --- | --- |
| Markdown authoring | Local `.md` files, CodeMirror editor, autosave, preview/editor/split modes | Supabase `docs.body`, CodeMirror editor, debounced autosave, edit/preview mode | Chronicler is stronger for authoring ergonomics because split view is first-class. |
| Wikilinks | `[[Page]]`, aliases, section/header links, autocomplete, link updates on rename | `[[Page]]`, aliases, `doc:` links, folder/reference link options, edges/backlinks; unresolved links auto-create docs on save | Chronicler is stronger for file-safe rename behavior and section links. Worldbuilder is stronger for graph-backed context and references. |
| Backlinks | Right sidebar with backlink count/list | Marginalia panel with backlink context snippets | Worldbuilder has richer contextual excerpts; Chronicler has simpler wiki-native UI. |
| Tags | Frontmatter tags with tag index and hierarchy-oriented organization | Namespaced inline/frontmatter tags with vocabulary and deterministic helper usage | Worldbuilder is stronger for automation; Chronicler is simpler for non-technical writers. |
| Templates | User-managed page templates in settings | Bundled templates in `templates/` surfaced in vault creation | Chronicler is stronger because users can manage templates in-app. |
| Infoboxes | YAML frontmatter infoboxes, graphical editor, custom fields, image carousels, layout rules | No generic infobox model; NPC creature association and stat block rendering are special cases | Chronicler has a major UI/content-structure advantage for wiki-style pages. |
| Media embeds | Local images, external paths, `![[image]]`, galleries, carousels, clickable images | Map uploads and reference/stat-block rendering; no comparable generic page media system in the spec | Chronicler is much stronger for visual wiki pages. |
| Page inserts/transclusion | `{{insert: Page}}` and variants for reusable page content | Not in spec | Chronicler is stronger for reusable lore blocks/navboxes/stat blocks. |
| Tables/math/HTML | Advanced markdown tables, HTML styling, KaTeX | Markdown preview with GFM; no explicit math/advanced wiki component support in spec | Chronicler is stronger for formatted encyclopedia pages. |
| Maps | Current alpha has Leaflet map view, tiled large images, canvas pins/shapes, clustering/performance work, page/map previews | Upload image data URLs, place normalized doc pins, open docs from pins | Chronicler maps are much more mature technically. Worldbuilder maps are simpler but directly tied to campaign docs. |
| Timeline | Pro v1.0 roadmap says timelines with custom non-Gregorian calendars | Implemented tag-derived timeline using `@timeline`, `@plot`, `@subplot`, `@time` | Worldbuilder has a useful current timeline, but Chronicler's stated calendar ambition is broader. |
| Family trees | Planned Pro feature | Not present | Chronicler has a stated roadmap advantage. |
| Diagnostics | Broken links, broken images, YAML parse errors, vault health reports | Tag health report code exists, but diagnostics are not a major spec/UI surface | Chronicler is stronger here and offers a clear model to copy. |
| Imports | `.docx`, folder import, MediaWiki/Fandom XML, Obsidian vault compatibility | Foundry JSON/DB, 5e.tools JSON, zip bundles, vault JSON import | Different strengths: Chronicler wins writer/wiki migration; Worldbuilder wins RPG data migration. |
| Exports | Local Markdown is already portable; theme import/export exists | Foundry/Roll20/vault JSON exports | Worldbuilder is stronger for VTT export workflows. |
| References/rules data | Generic wiki content, no bundled SRD/reference system in observed docs | SRD/5e.tools references, bestiary, NPC from creature, DM screen, encounter/loot/CR tools | Worldbuilder is much stronger for D&D table prep. |
| Session play | Not observed | PeerJS audio/video, chat, captions, dice, shared notes, session summaries | Worldbuilder has a unique live-play dimension. |
| Player sharing | Offline/private by default; no native cloud player view observed | Campaign invites, shared folders/docs/snippets, player view via RLS | Worldbuilder is stronger for table sharing; Chronicler is stronger for privacy. |
| AI | Not observed in README/HELP/source areas checked | Optional AI chat, prompt generation, OpenAI-compatible/Ollama dispatch | Worldbuilder has a differentiator, though provider scope needs cleanup. |
| Customization | Theme editor, fonts, atmosphere packs, theme import/export | Light/dark themes in settings | Chronicler is stronger for personalization and visual theming. |
| Licensing/entitlements | Source-available, license store, maps entitlement in UI | Not described | Chronicler has a more productized distribution model. |

## UI Comparison

### Chronicler UI

Chronicler presents as a desktop wiki editor:

- Launches into a vault selector with recent vaults and a local folder picker.
- Uses a fixed, resizable left sidebar.
- Sidebar tabs are Files, Tags, Gallery, and Reports.
- Sidebar footer provides new page, new folder, optional new map, Help, About, and Settings.
- Main content is a single active view selected from welcome, tag index, file, image, map, or report.
- File view has a header with title, save state, map-navigation button, table-of-contents toggle, backlink count, and editor/preview/split controls.
- Preview is wiki-like: floated infobox, table of contents, link hover previews, footer tags, rendered galleries/carousels/math/tables.
- Backlinks appear in a right sidebar only when invoked.
- Settings are modal-heavy and include appearance, font, theme editor, templates, imports, atmosphere, licensing, logs, and telemetry.

The UI is optimized around writing, reading, and maintaining local files. It reduces global navigation in favor of a persistent file explorer and a focused content pane.

### Worldbuilder UI

Worldbuilder presents as a campaign workspace:

- Uses a sticky top header plus app shell with sidebar, page, and optional marginalia.
- Has routes for vault, document, folder, trash, timeline, maps, settings, campaign settings, player view, invite acceptance, reference pages, and session play.
- CampaignPanel anchors campaign selection, campaign synopsis, view switching, settings, and campaign lifecycle.
- Vault sidebar handles campaign folders/docs, templates, trash, quick open, and page creation.
- Page panel handles title/body editing and preview.
- Marginalia carries backlinks, tags, prep helpers, worldbuilding generation, map pins, NPC stat block association, AI chat, and related context.
- Reference page is effectively a rules/reference workspace with bestiary, DM tools, encounter generation, loot, CR, and DM screen cards.
- Session page is a separate table mode with lobby, audio/video, chat, notes, captions, dice, and AI summaries.

The UI is optimized around campaign operations, not just prose authoring. It has more domain-specific panels and routes, but less generic wiki page polish.

### UI Implication

Chronicler has a clearer "one app, one core surface" model: sidebar plus content, with modal tools. Worldbuilder has a broader "campaign cockpit" model: multiple routes, panels, and tools.

Worldbuilder should not simply copy Chronicler's UI. The better path is to separate modes more deliberately:

- Authoring mode: make page editing/preview/backlinks/tags feel as polished as Chronicler.
- Prep mode: keep Worldbuilder's marginalia, deterministic helpers, reference data, and AI context.
- Table mode: keep live session tools separate and fast.
- Sharing mode: keep campaign/player controls explicit and permission-aware.

## Strategic Gaps For Worldbuilder

### High-Value Gaps To Close

1. Resolve local-first vs Supabase positioning.
   - Decision: keep Worldbuilder Supabase-backed.
   - Chronicler owns the offline/local Markdown message.
   - Worldbuilder documentation should stop claiming or implying local-first vault behavior unless a future local mode is explicitly designed.

2. Add user-managed templates.
   - Bundled templates are useful, but Chronicler's in-app template manager is a stronger authoring workflow.

3. Add generic infobox/frontmatter support.
   - Worldbuilder has D&D-specific NPC profiles, but no general-purpose page metadata renderer.
   - A lightweight YAML-frontmatter infobox could improve locations, factions, items, NPCs, and lore pages without forcing database records.

4. Add diagnostics.
   - Broken wikilinks, broken reference links, orphan docs, duplicate titles, malformed frontmatter, invalid tags, and missing map pins would fit Worldbuilder's graph model well.

5. Improve editor ergonomics.
   - Split editor/preview mode, table of contents, save status, section links, and link-update-on-rename are high-impact parity items.

6. Improve media support.
   - Local/Supabase Storage attachments, image embeds, galleries, and page inserts would close a visible wiki-authoring gap.

7. Revisit map architecture.
   - Worldbuilder's current map model is intentionally simple. If maps become core, borrow Chronicler's lessons: tiling, layers, canvas pins, clustering, large-image performance, and preview positioning.

### Gaps Worldbuilder Does Not Need To Close Immediately

1. Full desktop/Tauri local vault parity.
   - Only pursue this if local-first ownership becomes a product requirement.

2. Theme/atmosphere depth.
   - Chronicler's theme editor is polished, but Worldbuilder's higher-value differentiator is DM workflow, not cosmetic customization.

3. Family trees.
   - Useful for worldbuilding, but less urgent than campaign graph, prep, references, and session tools.

4. MediaWiki/docx imports.
   - Nice for writer migration, but Worldbuilder's Foundry/5e.tools/VTT workflows are more aligned with its target DM use case.

## Worldbuilder Strengths To Preserve

Worldbuilder should keep and emphasize these differentiators:

- Supabase-backed sharing and player view.
- Campaign member/invite model with RLS boundaries.
- Bestiary/reference integration and stat block rendering.
- DM screen, encounter, loot, CR, and initiative/treasure helpers.
- Deterministic prep helpers derived from graph context and namespaced tags.
- Optional AI prompt generation grounded in current page, links, backlinks, tags, siblings, and recent changes.
- Live session play: notes, captions, chat, dice, media, and session summaries.
- System-first default seed for factions, religions, cosmology, history, places, people, and lore.

Chronicler is stronger as a writing environment. Worldbuilder is stronger as a table-prep and play operations environment.

## Recommended Design Spec Changes

The comparison is accepted as directionally useful. The follow-up implementation plan is now captured in [2026-07-06-supabase-authoring-ui-upgrade.md](./2026-07-06-supabase-authoring-ui-upgrade.md).

That spec covers:

1. Documentation alignment.
   - Present Worldbuilder as a Supabase campaign workspace.
   - Update `README.md` and `WorldBuilder_readme.md` accordingly.

2. Authoring polish.
   - Add split editor/preview, save status, table-of-contents support, section links, rename link updates, and user-managed templates.

3. Page metadata and infoboxes.
   - Define YAML/frontmatter support that coexists with namespaced tags and NPC creature profiles.

4. Vault diagnostics.
   - Define broken links, unresolved references, invalid tags, duplicate titles, orphan docs, map pin issues, and import parse errors.

5. Media and attachments.
   - Decide whether assets live in Supabase Storage, data URLs, local files, or a hybrid.

6. Map maturity.
   - Decide whether maps stay simple or become a major product area with layers, large-image tiling, pin clustering, and shape regions.

## Open Questions

- How directly should Worldbuilder compete with local wiki tools like Chronicler and Obsidian, now that Supabase remains the backend?
- Should Worldbuilder offer an import path from Chronicler/Obsidian-style Markdown vaults?
- Should Worldbuilder support local Markdown export as a first-class backup format, not only vault JSON and VTT exports?
- Should Worldbuilder use YAML frontmatter for page metadata, or keep tags and profiles as Supabase-derived structures?
- Should maps and media move to Supabase Storage before richer media features are added?
- Should "authoring mode" and "table mode" become explicit top-level UI modes?

## Decisions

### 2026-07-05 - Positioning against Chronicler

- **Decision:** Keep Worldbuilder as a Supabase-backed campaign operations workspace, not a local-first Markdown vault.
- **Reason:** Chronicler already strongly owns local/offline Markdown wiki positioning.
- **Alternatives rejected:** Rebuilding around a local-first vault model, because the current implementation and collaboration/sharing workflows are Supabase-centered.
- **User feedback:** User said, "Lets keep it as supabase."
- **Impact:** README language, storage architecture, import/export priorities, and future UI planning should assume Supabase as the product foundation.

### 2026-07-05 - Authoring parity priority

- **Decision:** Plan the Chronicler-inspired authoring improvements as important Worldbuilder features: split preview, infoboxes, user-managed templates, diagnostics, media embeds, page inserts, and link rename updates.
- **Reason:** These are the areas where Chronicler most clearly exceeds the current Worldbuilder spec.
- **Alternatives rejected:** Leaving the vault authoring surface at the current edit/preview and bundled-template level, because that would keep Worldbuilder weak as a long-form worldbuilding workspace.
- **User feedback:** User approved the listed authoring features with "yes."
- **Impact:** Drives future feature specs and avoids diluting the DM-specific roadmap with generic wiki work.
