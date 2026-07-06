# Worldbuilder Reverse-Engineered Design Spec

## Status

In Review

## Objective

Capture the current Worldbuilder product and system design as implemented in this repository, so future changes have a reviewable baseline for architecture, data flow, product principles, known gaps, and test expectations.

This spec is reverse-engineered from the codebase on 2026-07-05. It is documentation-only and does not propose immediate runtime behavior changes.

## User Need

Dungeon Masters need a campaign and setting tool that behaves like a living grimoire: markdown pages, natural links, tags, map pins, references, prep helpers, session notes, and selective player sharing should work together without forcing the world into rigid records or a single rules engine.

Contributors need an accurate design baseline because the repository contains a mix of product philosophy, roadmap docs, implemented Supabase flows, imports, AI scaffolding, and session tooling. The spec should make it clear what is implemented, what is aspirational, and what needs validation before future work.

## Current Code/System Summary

Worldbuilder is a Vite, React 18, TypeScript app with Supabase as the primary persistence and authentication backend. The app entry point wraps all routes in `AuthGate` and `SessionProvider`, then serves vault, reference, timeline, map, settings, campaign sharing, player view, invite, and session routes from `src/App.tsx`.

The product philosophy in `WorldBuilder_readme.md` describes a grimoire-style worldbuilding tool where markdown pages, wikilinks, backlinks, and contextual tags are the core authoring model. That philosophy remains visible in the UI and data model, but one important mismatch exists: the README says data is local-first IndexedDB, while current runtime code requires Supabase environment variables and stores campaign state in Supabase tables.

Core domain tables are defined in `supabase/graph.sql`, `supabase/app-schema.sql`, and `supabase/campaign-sharing.sql`. The main entities are campaigns, folders, docs, edges, tags, settings, references, NPC profiles, DM screen cards, maps, map locations, session notes, campaign members, campaign invites, and shared snippets.

`src/vault/queries.ts` is the central data access layer. It maps Supabase rows to TypeScript types from `src/vault/types.ts`, performs CRUD operations, updates edges and tags when document content is saved, manages trash/restore/purge flows, seeds folder index docs, and exposes graph traversal helpers backed by Postgres RPC functions.

`src/lib/useSupabaseQuery.ts` is the shared query subscription hook. It fetches data once on mount/dependency changes and subscribes to configured Supabase table changes using `postgres_changes`, then refetches on any matching table event.

The vault experience is coordinated by `src/pages/VaultPage.tsx` with feature hooks under `src/pages/vault/`. It supports campaigns, folders, docs, templates, markdown editing/preview, wikilinks, link previews, backlinks, tags, trash, NPC creature association, map pin marginalia, prep helpers, AI chat, and worldbuilding prompt generation.

The default seed in `src/vault/seed.ts` creates a system-first campaign structure: Welcome, Factions, Religions, Magic & Cosmology, History & Ages, Places, Lore, People, and subfolders such as Regions, Notable Figures, and Myths & Legends. Migration helpers clean up earlier implicit World folder and index-doc structures.

Tags are namespaced strings parsed from inline `@namespace:value` and `#namespace:value` forms, plus frontmatter tags. The vocabulary in `src/domain/tags/vocabulary.ts` defines closed, semi-open, and open namespaces used by prep helpers, timelines, filtering, and future automation.

References are seeded from bundled SRD and 5e.tools-derived JSON. Reference pages provide table views, bestiary stat blocks, DM screen cards, encounter generation, CR calculation, loot generation, and NPC creation from creatures.

Settings provide import/export and configuration flows. Imports support Foundry JSON/DB, 5e.tools JSON, zip bundles, and full vault JSON transfer. Exports support Foundry JSON, Roll20 JSON, and a vault JSON containing folders, docs, edges, tags, and trash state for the active campaign.

Campaign sharing is owner-led. DMs can invite members by email, assign player or DM role, share folders/pages, share snippets from vault content, and preview player-visible content. Row-level security policies enforce owner or member access in SQL.

Maps are uploaded as browser-read image data URLs stored in Supabase, with normalized x/y map pins linked to docs.

Session play is transient browser/P2P state using PeerJS via `public/peerjs.js` and `src/lib/webConnect.js`. Session notes persist to Supabase and localStorage, while audio/video streams, captions, chat, dice rolls, and shared navigation are peer-to-peer runtime state.

AI is optional and user-configured through settings. The UI exposes OpenAI, Anthropic, Google, Mistral, Cohere, and Ollama settings. Current runtime dispatch in `src/ai/client.ts` implements OpenAI-compatible chat completions and Ollama generation only; other provider choices currently return "not wired" errors.

Roadmap tests exist under `src/__tests__/roadmap/` and validate parsing utilities, Supabase query subscriptions, session lobby rendering, prep helper determinism, AI prompt safety, UI empty states, architecture helpers, docs structure, initiative ordering, and treasure suggestions.

## Proposed Design

This reverse-engineered spec should become the baseline system design for Worldbuilder until superseded by narrower feature specs.

The authoritative product model should be:

- Worldbuilder is a campaign knowledge and play-prep workspace for tabletop RPG DMs.
- Markdown docs are the primary authoring unit.
- Wikilinks create graph edges and backlinks.
- Namespaced tags provide deterministic context for filtering, prep, timeline, encounters, and AI prompts.
- Folders organize pages, but relationships come from edges and tags rather than strict hierarchy.
- Supabase is the official required persistence/auth backend for the current product direction.
- Browser localStorage is used only for convenience caches and transient preferences such as pane widths, page mode, AI chat history, Ollama model cache, session display name, and local session-note backup.
- AI must stay opt-in and must not auto-write content without user action.
- Live session media and data channels are intentionally separate from persisted campaign state.
- Player sharing must expose only explicitly shared folders, docs, snippets, and campaign metadata permitted by RLS.

The core architecture should be described as these layers:

- App shell and routing: `src/App.tsx`, `src/main.tsx`, shared shell UI, and page components.
- Authentication and user scope: `src/auth/AuthGate.tsx`, Supabase auth, RLS owner/member policies.
- Data access: `src/vault/queries.ts`, Supabase row mappers, mutation helpers, graph RPC wrappers.
- Domain parsing and deterministic logic: vault parser, tag domain, timeline extraction, prep helpers, encounter/loot/CR/initiative utilities.
- Vault feature orchestration: `src/pages/VaultPage.tsx` and `src/pages/vault/*`.
- Reference and DM tools: `src/pages/ReferencePage.tsx`, `src/lib/reference*`, bestiary/stat block utilities, DM screen cards.
- Campaign collaboration: campaign settings, invites, sharing flags, player view, shared snippets.
- Session play: session provider, session page, PeerJS room mesh, Web Speech captions, notes persistence.
- Import/export: `src/lib/importExport.ts` and Settings page transfer flows.
- Optional AI: prompt builders, provider settings, provider client, chat/worldbuild hooks.

The current README should be treated as product philosophy, not as an exact implementation reference, until it is updated to reflect Supabase-first persistence. The product direction decision is now to keep Supabase rather than returning to a local-first IndexedDB vault.

## Files Likely Affected

Immediate documentation change:

- `docs/design/2026-07-05-worldbuilder-reverse-engineered-spec.md`

Likely future documentation updates after review:

- `README.md`
- `WorldBuilder_readme.md`
- `supabase/README.md`
- `docs/testing/roadmap-tests.md`
- Existing roadmap docs under `docs/roadmap/`

Likely future implementation areas if this spec drives cleanup:

- `src/vault/queries.ts`
- `src/vault/seed.ts`
- `src/lib/useSupabaseQuery.ts`
- `src/pages/VaultPage.tsx`
- `src/pages/SettingsPage.tsx`
- `src/pages/ReferencePage.tsx`
- `src/pages/CampaignSettingsPage.tsx`
- `src/pages/PlayerViewPage.tsx`
- `src/session/SessionContext.tsx`
- `src/ai/client.ts`
- `supabase/*.sql`

## API/Schema Changes

None for this documentation-only spec.

Existing schema surfaces to preserve unless a future approved spec changes them:

- `campaigns`: campaign identity, owner, synopsis, archive state.
- `docs`: markdown page bodies, titles, campaign, folder, sort, sharing, trash.
- `folders`: hierarchy, campaign, sharing, trash.
- `edges`: graph links derived from wikilinks.
- `tags`: parsed namespaced context tags.
- `settings`: owner-scoped app settings and AI configuration.
- `references`: imported/seeded rules/reference entries.
- `npc_profiles`: optional creature association for NPC docs.
- `dm_screen_cards`: campaign-specific pinned reference/doc cards.
- `maps` and `map_locations`: uploaded map images and doc pins.
- `session_notes`: persisted room notes.
- `campaign_members`, `campaign_invites`, `shared_snippets`: sharing and player-view support.

Existing route surface to preserve unless changed by a future approved spec:

- `/`
- `/doc/:docId`
- `/folder/:folderName`
- `/trash`
- `/timeline`
- `/maps`
- `/settings`
- `/campaign/:id/settings`
- `/campaign/:id/player`
- `/invite/:inviteId`
- `/reference/:slug`
- `/session`
- `/session/:roomId`

## Data Flow

Authentication:

1. `AuthGate` loads the Supabase session.
2. Unauthenticated users enter an email and receive a Supabase magic link.
3. Authenticated users access all app routes inside `AuthContext`.
4. Supabase RLS policies scope query results and mutations by campaign ownership or membership.

Campaign activation and seeding:

1. Pages and hooks read `activeCampaignId` from owner-scoped settings.
2. If none exists, the app selects an existing campaign or creates "Campaign One".
3. `seedCampaignIfNeeded` creates the default folder/doc structure only when a campaign has no docs.
4. Migration helpers update older structures and folder indexes.

Vault document saving:

1. User edits title/body in the vault page.
2. Title and body updates are debounced.
3. `saveDocContent` writes the body and timestamp to `docs`.
4. The saved markdown is parsed for wikilinks and tags.
5. Existing outgoing edges and tags for the doc are deleted.
6. New wikilinks create or resolve docs, then insert `edges`.
7. New parsed tags insert into `tags`.
8. Subscribed queries refetch relevant docs, edges, tags, and derived panels.

Graph and context:

1. `buildWorldContext` loads the current doc, tags, one-hop outgoing and incoming graph neighbors, related tagged docs, recent campaign docs, folder siblings, and location-related docs.
2. Prep helpers and AI prompt builders consume that context.
3. UI panels render backlinks, tags, related prep, and worldbuilding controls.

Reference data:

1. `seedReferencesIfNeeded` loads bundled SRD/reference seed data into Supabase references.
2. Reference pages query by slug.
3. Bestiary entries can create NPC docs and attach an `npc_profiles` creature association.
4. DM screen cards persist references/docs by campaign.

Import/export:

1. Settings page reads local files in the browser.
2. Foundry and 5e.tools imports are parsed into world docs or reference rows.
3. Vault JSON import merges or overwrites folders/docs/edges/tags in the active campaign.
4. Export flows assemble docs/references into Foundry, Roll20, or vault JSON downloads.

Sharing:

1. Campaign owners invite members by email through Supabase magic links.
2. Invite acceptance creates `campaign_members` rows after email matching.
3. DMs toggle `shared` on folders/docs and create shared snippets.
4. Player view queries visible docs/folders/snippets through RLS and renders markdown read-only.

Session play:

1. A session room is created or joined from `/session/:roomId`.
2. Browser media devices provide local audio/video streams.
3. `webConnect` uses PeerJS for room discovery, roster, data channels, and media calls.
4. Chat, captions, dice rolls, and navigation messages are sent over peer data channels.
5. Session notes are debounced to Supabase and mirrored in localStorage.
6. Leaving a session can append a summary block to the last opened vault doc.

AI:

1. User selects a provider and stores provider settings in Supabase settings.
2. AI chat and session summary features build prompts from current context and recent conversation/notes.
3. OpenAI-compatible and Ollama requests are dispatched by `sendPromptToProvider`.
4. Worldbuild generation first creates reviewable prompts and only sends them to AI when the user explicitly asks.
5. Insertions into docs require a user action.

## Risks and Tradeoffs

- The README still claims local-first IndexedDB storage, but current code requires Supabase. This can mislead contributors and users.
- Supabase is a hard runtime dependency because `src/lib/supabase.ts` throws when env vars are missing.
- Realtime refetching is table-level and broad. It is simple, but potentially inefficient as campaigns grow.
- `saveDocContent` deletes and rebuilds all outgoing edges and tags for a doc on every save. This keeps derived state simple but can be expensive and can create empty docs from unresolved wikilinks.
- The AI settings UI exposes providers that are not implemented in the dispatch client.
- API keys are stored in Supabase settings through the client. That is convenient but deserves a security review before production use.
- Map images are stored as data URLs in Supabase rows. This is simple but may hit row size, bandwidth, or performance limits.
- PeerJS session play depends on browser APIs, PeerJS availability, media permissions, and network conditions. It is not the same reliability model as persisted campaign data.
- RLS policies are split across multiple SQL files. Deployment order matters and should be documented.
- Import/export and vault overwrite flows mutate many rows from the client and need continued test coverage to avoid data loss.
- Some roadmap docs describe missing work that is partially or fully implemented now, which can confuse planning.

## Alternatives Considered

- Keep README as the only design source. Rejected because it no longer fully matches the implemented Supabase architecture.
- Write only a high-level product spec. Rejected because future maintainers need concrete file, schema, and data-flow references.
- Treat current code as self-documenting. Rejected because several important behaviors are cross-cutting and not visible from a single module.
- Propose a local-first IndexedDB re-architecture in this spec. Rejected for now because this task is reverse engineering, not redesign.
- Create separate specs per feature area. Deferred. A baseline system spec should come first, then narrower specs can supersede sections as needed.

## Test Plan

Documentation-only validation:

- Review the spec against current source files listed above.
- Verify every required design-spec section is present.
- Verify claims that contradict README are marked as implementation drift, not silently treated as resolved.

Recommended command checks after this doc change:

- `npm run test:run`
- `npm run build`

Existing tests that should remain relevant:

- `src/__tests__/roadmap/01_legacy_code_cleanup.test.ts`
- `src/__tests__/roadmap/02_supabase_sync.test.tsx`
- `src/__tests__/roadmap/03_session_play.test.tsx`
- `src/__tests__/roadmap/04_non_ai_prep_helpers.test.ts`
- `src/__tests__/roadmap/05_ai_enhancement_layer.test.ts`
- `src/__tests__/roadmap/06_ui_polish.test.tsx`
- `src/__tests__/roadmap/07_architecture_cleanup.test.ts`
- `src/__tests__/roadmap/08_testing_and_docs.test.ts`
- `src/__tests__/roadmap/12_initiative_tracker_setup.test.ts`
- `src/__tests__/roadmap/13_treasure_suggestion.test.ts`

Future test gaps identified by this spec:

- Import/export round-trip tests for vault JSON merge and overwrite.
- RLS policy tests or documented SQL verification steps.
- AI provider dispatch tests for implemented and unimplemented providers.
- Session notes persistence tests.
- Campaign sharing/player visibility tests.
- Map upload/pin persistence tests.
- Edge/tag rebuild tests for renamed, deleted, and unresolved wikilinks.

## Documentation Plan

After review, update `README.md` and `WorldBuilder_readme.md` to distinguish product philosophy from current Supabase-backed implementation. Remove or rewrite local-first IndexedDB claims unless a future local vault mode is explicitly designed and implemented.

Update `supabase/README.md` with schema application order, required env vars, and RLS/sharing policy notes.

Update roadmap docs to mark implemented, partially implemented, and still-missing items.

Add a contributor architecture guide if this spec is approved and future work continues to touch multiple feature areas.

## Rollout/Rollback Plan

Rollout:

1. Commit this spec as `In Review`.
2. Review with the project owner.
3. Update decisions and open questions based on feedback.
4. If accepted, mark as `Approved` or keep as the baseline `In Review` reference while narrower feature specs are written.

Rollback:

1. Delete this documentation file if it is rejected.
2. No runtime rollback is required because no app code, schema, package, or generated asset is changed.

## Open Questions

- Should AI API keys be stored in Supabase settings, localStorage, or a server-side secret store?
- Should non-OpenAI/Ollama providers be hidden until implemented, or should the client add real support for them?
- Should map images move from table data URLs to Supabase Storage?
- Should unresolved wikilinks auto-create docs, prompt the user, or remain unresolved until explicit creation?
- Should session play be considered production scope or experimental scope?
- Should roadmap docs be converted into status-tracked implementation records?
- What is the intended deployment target beyond Netlify configuration?

## Decisions

### 2026-07-05 - Reverse-engineer current implementation into a design baseline

- **Decision:** Create a design spec that documents current implementation, known drift, and future review points without changing runtime behavior.
- **Reason:** The project has enough implemented cross-cutting behavior that future work needs a shared architecture baseline.
- **Alternatives rejected:** Using the README alone, because it is philosophical and partly stale; writing a new implementation plan, because the request was to reverse engineer the current project.
- **User feedback:** The user requested a reverse-engineered design spec for the project.
- **Impact on implementation:** Documentation only. Future code changes should reference this spec or a narrower approved spec.

### 2026-07-05 - Mark Supabase as current runtime persistence

- **Decision:** Describe Supabase as the current required persistence and auth backend, while calling out README drift around local-first IndexedDB.
- **Reason:** `src/lib/supabase.ts`, query helpers, page flows, SQL schemas, and tests all show Supabase-backed runtime behavior.
- **Alternatives rejected:** Preserving the README's local-first wording as implementation truth, because that would be inaccurate for the current codebase.
- **User feedback:** Superseded by the 2026-07-05 decision to keep Worldbuilder Supabase-backed.
- **Impact on implementation:** Future documentation should reconcile product philosophy with runtime dependency.

### 2026-07-05 - Keep Supabase as the product foundation

- **Decision:** Keep Worldbuilder as a Supabase-backed campaign workspace rather than returning to the README's local-first IndexedDB promise.
- **Reason:** The existing app architecture, sharing model, player view, RLS policies, reference data, and session-note persistence are already centered on Supabase.
- **Alternatives rejected:** Rebuilding around a local-first vault model, because that would compete directly with Chronicler's strongest positioning and would require a broad persistence redesign.
- **User feedback:** User said, "Lets keep it as supabase."
- **Impact on implementation:** Future specs, README updates, schema changes, storage work, media support, diagnostics, and collaboration features should assume Supabase as the backend.

### 2026-07-05 - Plan authoring parity improvements

- **Decision:** Treat split preview, infoboxes, user-managed templates, diagnostics, media embeds, page inserts, and link rename updates as important authoring improvements for future implementation.
- **Reason:** These features close the highest-value UI and content-authoring gaps found in the Chronicler comparison while preserving Worldbuilder's DM workflow focus.
- **Alternatives rejected:** Leaving the authoring surface at static templates plus edit/preview mode, because that would keep Worldbuilder weak for long-form wiki-style campaign writing.
- **User feedback:** User approved the Chronicler-inspired authoring feature list with "yes."
- **Impact on implementation:** A narrower follow-up spec should define the feature phases, schema additions, renderer changes, tests, and docs updates.

## User Feedback / Decisions

- 2026-07-05: Initial user request: "Lets reverse engineer a design spec for the following project."
- 2026-07-05: User resolved the Supabase/local-first direction: "Lets keep it as supabase."
- 2026-07-05: User approved planning the Chronicler-inspired authoring improvements: split preview, infoboxes, user-managed templates, diagnostics, media embeds, page inserts, and link rename updates.
- Pending: User review of the remaining open questions, especially AI provider scope, session play maturity, map storage, and wikilink creation behavior.
