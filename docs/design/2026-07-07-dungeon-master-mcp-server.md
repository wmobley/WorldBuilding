# Dungeon Master MCP Server Spec

## Status

Implementing

## Objective

Define a phased MCP server plan for Worldbuilder that helps a Dungeon Master develop, audit, prepare, and run a campaign without bypassing the app's existing Supabase/RLS, Markdown, wikilink, tag, template, map, sharing, and session models.

This spec focuses on the first planning artifact requested on 2026-07-07: three implementation phases, MCP tools, MCP resources, and MCP prompts with distinct personas for different parts of worldbuilding and play preparation.

## User Need

Dungeon Masters need an AI-accessible companion interface over Worldbuilder that can understand the current campaign, retrieve relevant lore, reason about continuity, suggest expansions, prepare playable material, and eventually make controlled updates. The MCP server should make the DM's world easier to develop with an assistant while keeping the DM in control of canon, spoilers, player-facing content, and persistent writes.

## Current Code/System Summary

Worldbuilder is a React/Vite/TypeScript campaign workspace backed by Supabase. It stores campaign content as Markdown docs with folders, wikilinks, graph edges, tags, references, NPC profiles, templates, assets, maps, map pins, session notes, campaign members, invites, and shared player-facing snippets.

The core data access layer is `src/vault/queries.ts`, with type definitions in `src/vault/types.ts`. Markdown parsing, wikilinks, tags, heading/page modeling, world context building, diagnostics, prep helpers, encounter helpers, treasure helpers, reference data, maps, assets, and session features already exist in app modules.

AI worldbuilding is currently app-local. Prompt templates live in `src/ai/prompts/*.md`, and `src/ai/worldbuild.ts` builds context-aware prompt inputs from the current doc, linked docs, backlinks, tags, related docs, recent docs, folder siblings, and selected anchors. Provider dispatch in `src/ai/client.ts` supports OpenAI-compatible and Ollama requests directly from the browser.

Supabase local configuration already exists under `supabase/`, including migrations, RLS, Storage, and docs. There is not currently a checked-in Supabase Edge Function or MCP server directory.

The MCP specification's server surfaces map cleanly to this product:

- Tools: model-invoked actions such as search, context assembly, draft creation, validation, and controlled writes.
- Resources: readable campaign, doc, graph, map, reference, diagnostic, and session context.
- Prompts: reusable user-invoked workflows and persona templates for focused DM tasks.

## Proposed Design

Build a Worldbuilder MCP server as a backend companion layer over the existing Supabase campaign model. The preferred hosted shape is a Supabase Edge Function exposing a Streamable HTTP MCP endpoint. A local stdio adapter can be added later for development convenience, but the product-facing server should be remote and user-scoped.

The server should be permission-first:

- Accept a user-scoped auth token or app-issued MCP token.
- Resolve the active user and allowed campaigns.
- Use RLS wherever practical.
- Require explicit confirmation or a proposal review step before persistent writes.
- Separate DM-only, player-facing, and shared content in every resource and prompt.
- Prefer structured outputs and patch proposals over freeform mutations.

Prompting should follow a "DM owns canon" model:

- Use AI for bounded tasks, not whole-world generation.
- Feed canon context first: relevant docs, tags, links, summaries, tone, examples, and explicit constraints.
- Ask for structured outputs when the result needs to become table notes, Markdown, YAML, JSON, map pins, tags, links, or validation findings.
- Add critique passes that look for generic fantasy defaults, contradictions, spoiler leakage, weak motivations, unresolved consequences, and missing table use.
- Generate variants and let the DM choose, instead of treating the first answer as final canon.
- Break large generation into staged pipelines: canon packet, structured draft, contradiction check, table-ready note, then optional proposal/write.
- Treat spatial and relational work as data plus visual/map context when prose alone is not enough.

Implementation should proceed in exactly three phases.

### Phase 1: Read-Only Campaign Context

Goal: make an assistant useful as a campaign-aware reader, lore analyst, and planning partner without any write access.

Capabilities:

- Expose campaign, folder, doc, graph, tag, map, reference, asset metadata, template, and diagnostic context as resources.
- Add safe tools for search, context building, graph neighborhoods, continuity checks, and exportable summaries.
- Add prompts/personas that help a DM inspect the world, identify gaps, prepare ideas, and ask better questions.
- Return doc/resource links instead of raw full-vault dumps unless the request scope is narrow.
- Treat deleted docs, unshared docs, and DM-only sections according to caller role and requested audience.

Phase 1 success criteria:

- An MCP client can list campaigns, select a campaign/doc, retrieve a bounded context bundle, search lore, inspect tags/links, and run read-only audits.
- No MCP tool can create, update, delete, share, invite, upload, or overwrite campaign data.
- Outputs identify their source docs and avoid silently inventing canon.

### Phase 2: Drafting and Proposal Workbench

Goal: let the assistant generate useful campaign material as reviewable proposals, not immediate canon.

Capabilities:

- Add tools that produce structured draft docs, Markdown patches, new scene outlines, NPC concepts, faction expansions, region details, encounter plans, treasure suggestions, and session prep packets.
- Add proposal resources so MCP clients can re-open generated drafts and compare them to current docs.
- Add validation tools that check proposed content for broken wikilinks, invalid tags, duplicate titles, missing anchors, spoiler leakage, and continuity conflicts.
- Add prompts/personas for drafting by domain: lore, maps, encounters, plot, rules, player handouts, and continuity editing.
- Keep app UI or an explicit approval tool as the place where proposals become persistent campaign writes.

Phase 2 success criteria:

- The server can generate and validate draft content using existing templates and campaign context.
- Drafts clearly distinguish existing canon from proposed additions and mark newly invented entities.
- Persistent writes remain gated through an approval flow.

### Phase 3: Controlled Campaign Operations and Session Co-DM

Goal: support approved writes and live-session workflows after the read and draft surfaces are proven safe.

Capabilities:

- Add explicitly destructive or persistent tools only with strong confirmation, audit logs, and role checks.
- Support approved doc creation/update, template application, map pin creation, session note updates, shared snippet generation, player handout publishing, and post-session recap insertion.
- Add session-aware tools that read current session notes, summarize play, extract unresolved questions, update story trackers, and prepare next-session prompts.
- Add audit resources for MCP operations and rollback information for applied changes.
- Add prompt/persona flows for in-session assistant behavior, post-session scribe behavior, and player-safe communication.

Phase 3 success criteria:

- The DM can approve controlled writes from an MCP client.
- Every applied write has an audit trail with user, campaign, operation, affected records, before/after or patch summary, timestamp, and rollback guidance.
- Player-facing outputs are generated only from shared/player-safe context unless the DM explicitly asks for spoilered material.

### MCP Tools

Tool names should use a stable `worldbuilder.` prefix. Inputs and outputs should use JSON Schema and return structured content where practical.

#### Phase 1 Tools

`worldbuilder.list_campaigns`

- Purpose: list campaigns visible to the authenticated user.
- Inputs: optional `includeArchived`.
- Output: campaign ids, names, synopsis, role, updated time.

`worldbuilder.search_lore`

- Purpose: search doc titles, body excerpts, tags, references, and optionally assets.
- Inputs: `campaignId`, `query`, optional `scope`, `limit`, `audience`.
- Output: ranked results with resource URIs and excerpts.

`worldbuilder.get_doc_context`

- Purpose: assemble the same kind of bounded context the app uses for AI worldbuilding.
- Inputs: `docId`, optional `includeLinked`, `includeBacklinks`, `includeTags`, `includeRecent`, `maxDocs`, `audience`.
- Output: current doc summary, tags, linked docs, backlinks, related docs, recent docs, folder siblings.

`worldbuilder.build_canon_packet`

- Purpose: build a compact, source-linked canon packet for prompting without dumping the whole vault.
- Inputs: `campaignId`, optional `focusDocIds`, `topic`, `includeExamples`, `maxTokens`, `audience`.
- Output: canon facts, open questions, tone/style notes, relevant tags, linked resources, and explicit "do not invent" constraints.

`worldbuilder.get_graph_neighborhood`

- Purpose: retrieve k-hop graph context around a doc.
- Inputs: `campaignId`, `docId`, `hops`, `direction`.
- Output: nodes, edges, path metadata, source resource links.

`worldbuilder.find_continuity_issues`

- Purpose: run read-only checks for contradictions, dangling claims, duplicate names, missing links, and unresolved mysteries.
- Inputs: `campaignId`, optional `docIds`, `scope`, `severity`.
- Output: issue list with affected docs, evidence, confidence, and suggested next action.

`worldbuilder.get_vault_diagnostics`

- Purpose: expose existing diagnostics such as broken links, duplicate titles, invalid tags, orphan pages, missing map pins, and unresolved embeds.
- Inputs: `campaignId`, optional `types`, `limit`.
- Output: diagnostic findings with resource links.

`worldbuilder.build_session_brief`

- Purpose: assemble a read-only briefing for upcoming play.
- Inputs: `campaignId`, optional `focusDocIds`, `partyLocation`, `timeBudgetMinutes`, `audience`.
- Output: relevant lore, active NPCs/factions, dangling hooks, hazards, likely scenes, source links.

#### Phase 2 Tools

`worldbuilder.draft_doc`

- Purpose: create a proposed Markdown doc using a template and campaign context.
- Inputs: `campaignId`, `templateKind`, `title`, optional `anchorDocIds`, `tone`, `constraints`.
- Output: draft title, folder hint, Markdown body, proposed tags, proposed links, validation warnings.

`worldbuilder.draft_doc_patch`

- Purpose: propose a patch against an existing doc.
- Inputs: `docId`, `instruction`, optional `persona`, `audience`, `preserveSections`.
- Output: patch summary, replacement blocks, added wikilinks/tags, risk notes.

`worldbuilder.draft_scene`

- Purpose: prepare a playable scene from lore context.
- Inputs: `campaignId`, optional `locationDocId`, `npcDocIds`, `objective`, `partyLevel`, `tone`.
- Output: scene beats, boxed text if requested, NPC motivations, clues, complications, fallback paths.

`worldbuilder.draft_encounter`

- Purpose: draft a combat, hazard, social, or exploration encounter.
- Inputs: `campaignId`, `encounterType`, `partyLevel`, `partySize`, optional `locationDocId`, `creatureTags`, `difficulty`.
- Output: encounter roster, terrain, objectives, tactics, scaling notes, treasure/clue hooks.

`worldbuilder.draft_player_handout`

- Purpose: convert DM-facing lore into player-safe handout text.
- Inputs: `sourceDocIds`, `spoilerPolicy`, `format`, optional `tone`.
- Output: player-safe Markdown, omitted-spoiler summary for DM review, source links.

`worldbuilder.generate_variants`

- Purpose: generate multiple bounded options for a specific campaign element without declaring any option canon.
- Inputs: `campaignId`, `task`, optional `canonPacket`, `count`, `format`, `selectionCriteria`, `audience`.
- Output: variants, tradeoffs, best-fit notes, contradiction risks, and recommended follow-up questions.

`worldbuilder.critique_proposal`

- Purpose: stress-test a generated draft for taste, specificity, continuity, and table usefulness before validation or approval.
- Inputs: `campaignId`, `proposal`, optional `critiqueMode`, `sourceDocIds`.
- Output: critique findings grouped by genericness, contradiction, weak motivation, missing consequence, player-facing risk, and suggested revision.

`worldbuilder.validate_proposal`

- Purpose: validate draft docs or patches before approval.
- Inputs: `campaignId`, `proposal`, optional `checks`.
- Output: broken links, invalid tags, duplicate title risks, continuity warnings, spoiler warnings.

`worldbuilder.save_proposal`

- Purpose: store a draft proposal for later review without applying it to canon.
- Inputs: `campaignId`, `proposal`, optional `label`, `sourcePrompt`.
- Output: proposal id, resource URI, validation status.

#### Phase 3 Tools

`worldbuilder.apply_doc_patch`

- Purpose: apply an approved patch to an existing doc.
- Inputs: `docId`, `approvedPatchId` or explicit patch payload, `confirmationToken`.
- Output: updated doc URI, audit event URI, changed links/tags.

`worldbuilder.create_doc`

- Purpose: create an approved new campaign doc.
- Inputs: `campaignId`, `title`, `body`, optional `folderId`, `tags`, `links`, `confirmationToken`.
- Output: doc URI, audit event URI, created edges/tags.

`worldbuilder.apply_template`

- Purpose: create or patch a doc from an existing template.
- Inputs: `campaignId`, `templateId`, optional `targetDocId`, `title`, `variables`, `confirmationToken`.
- Output: created/updated doc URI, audit event URI.

`worldbuilder.create_map_pin`

- Purpose: add a doc-linked pin to a map.
- Inputs: `mapId`, `docId`, `x`, `y`, `confirmationToken`.
- Output: map location URI, audit event URI.

`worldbuilder.update_session_notes`

- Purpose: append or patch live session notes.
- Inputs: `roomId`, `campaignId`, `operation`, `content`, `confirmationToken`.
- Output: session notes URI, audit event URI.

`worldbuilder.publish_player_snippet`

- Purpose: create a player-facing shared snippet from approved text.
- Inputs: `campaignId`, `docId`, `snippetText`, optional offsets, `confirmationToken`.
- Output: snippet URI, audit event URI.

`worldbuilder.record_session_recap`

- Purpose: append an approved recap to a session/story tracker doc.
- Inputs: `campaignId`, `sourceRoomId`, `targetDocId`, `recapMarkdown`, `confirmationToken`.
- Output: updated doc URI, audit event URI.

### MCP Resources

Use a custom URI scheme so resources are portable across hosted and local deployments:

```text
worldbuilder://campaign/{campaignId}
worldbuilder://campaign/{campaignId}/folders
worldbuilder://campaign/{campaignId}/docs
worldbuilder://campaign/{campaignId}/tags
worldbuilder://campaign/{campaignId}/diagnostics
worldbuilder://campaign/{campaignId}/templates
worldbuilder://campaign/{campaignId}/maps
worldbuilder://campaign/{campaignId}/references
worldbuilder://campaign/{campaignId}/canon-packet
worldbuilder://campaign/{campaignId}/prompt-recipes
worldbuilder://campaign/{campaignId}/style-examples
worldbuilder://campaign/{campaignId}/session/{roomId}
worldbuilder://doc/{docId}
worldbuilder://doc/{docId}/canon-summary
worldbuilder://doc/{docId}/context
worldbuilder://doc/{docId}/links
worldbuilder://doc/{docId}/backlinks
worldbuilder://doc/{docId}/tags
worldbuilder://doc/{docId}/frontmatter
worldbuilder://doc/{docId}/headings
worldbuilder://doc/{docId}/diagnostics
worldbuilder://graph/{campaignId}/neighborhood/{docId}
worldbuilder://map/{mapId}
worldbuilder://map/{mapId}/locations
worldbuilder://asset/{assetId}/metadata
worldbuilder://reference/{slug}
worldbuilder://proposal/{proposalId}
worldbuilder://audit/{auditEventId}
```

Resource principles:

- Resources should be bounded and paginated when listing docs, references, assets, diagnostics, or graph nodes.
- Resource payloads should include `audience` metadata where possible: `dm`, `player`, or `assistant`.
- Full doc bodies should be available only when directly requested and authorized.
- Context resources should prefer excerpts, summaries, headings, tags, links, and source URIs over full corpus dumps.
- Player-safe resources must exclude DM-only blocks and unshared docs.
- Canon packet resources should explicitly separate established facts, inferences, open questions, constraints, and style examples.
- Prompt recipe resources should encode reusable patterns such as "canon notes to structured generation to contradiction check to table-ready note to proposal".
- Phase 1 can synthesize resources on demand without new database tables.
- Phase 2 likely needs a `mcp_proposals` table or equivalent persisted proposal store.
- Phase 3 should add `mcp_audit_events` or reuse an app-wide audit event table if one exists by then.

### MCP Prompts

Prompts should be the primary user-facing workflow layer. Each prompt should declare its intended persona, inputs, output format, allowed tools/resources, and safety boundaries.

Prompt definitions should consistently include:

- Canon input: exact docs, tags, summaries, tone examples, and constraints the assistant may use.
- Task boundary: one narrow job such as "generate 10 rumors", "stress-test this faction", or "draft three floor-9 complications".
- Output contract: Markdown, table, YAML, JSON, patch proposal, or diagnostic list.
- Canon labels: `canon`, `inferred`, `new option`, `contradiction`, and `needs DM decision`.
- Critique step: what the assistant must check before presenting the answer.
- Variant policy: when to provide several options rather than one final answer.
- Player-safety policy: whether the output may include DM-only information.

#### Core Personas

`Lorekeeper`

- Focus: setting canon, historical consistency, factions, religions, cosmology, cultures, and myths.
- Best for: expanding lore, reconciling contradictions, identifying missing connective tissue.
- Boundary: never silently changes canon; labels speculation and new inventions.

`Continuity Editor`

- Focus: contradictions, naming collisions, broken links, timelines, dangling plot threads, and retcons.
- Best for: campaign audits, pre-session checks, post-session cleanup.
- Boundary: treats existing docs as source of truth and provides evidence for every claim.

`Dungeon Architect`

- Focus: dungeons, sites, lairs, hazards, clues, rooms, factions inside locations, and exploration flow.
- Best for: turning a place into playable structure.
- Boundary: avoids over-keying; prioritizes table-ready choices and meaningful navigation.

`Cartographer`

- Focus: maps, regions, routes, borders, landmarks, travel logic, map pins, and spatial consistency.
- Best for: regional planning and deciding where places belong.
- Boundary: marks uncertain geography and asks for missing scale assumptions.

`Encounter Smith`

- Focus: combat, hazards, social encounters, puzzles, rewards, pacing, and difficulty.
- Best for: producing playable encounters from lore and reference data.
- Boundary: keeps stat/rules claims traceable to reference data or marks them as custom.

`Dramaturge`

- Focus: plot arcs, scenes, reveals, NPC motivations, pressure clocks, and dramatic turns.
- Best for: session prep, adventure chapters, branching scene plans.
- Boundary: preserves player agency and avoids single-solution plotting.

`Rules Steward`

- Focus: rules references, creature data, CR, treasure, encounter balance, and table procedures.
- Best for: mechanics checks and rules-grounded prep.
- Boundary: distinguishes rules-as-written references from house rules and homebrew.

`Player Handout Editor`

- Focus: player-safe summaries, rumors, letters, clues, recaps, and invitations.
- Best for: transforming DM material into shareable text.
- Boundary: removes spoilers unless explicitly instructed otherwise.

`Session Scribe`

- Focus: live notes, recap extraction, unresolved questions, NPC changes, loot, clues found, and next steps.
- Best for: during-session or post-session continuity capture.
- Boundary: separates observed play from proposed cleanup.

`Archivist`

- Focus: organization, templates, folder placement, metadata, tags, backlinks, and diagnostics.
- Best for: keeping the vault maintainable.
- Boundary: recommends structure before applying it.

`Prompt Architect`

- Focus: turning a vague DM intention into a bounded, contextual, structured prompt workflow.
- Best for: designing reusable prompts, canon packets, output schemas, critique passes, and staged generation pipelines.
- Boundary: optimizes the assistant workflow but does not decide campaign canon.

#### Phase 1 Prompts

`worldbuilder.campaign_briefing`

- Persona: Lorekeeper plus Archivist.
- Inputs: `campaignId`, optional focus docs, audience, time budget.
- Output: concise campaign state, major anchors, active tensions, source links, open questions.

`worldbuilder.lore_continuity_audit`

- Persona: Continuity Editor.
- Inputs: `campaignId`, optional doc scope, severity threshold.
- Output: evidence-backed findings, affected docs, suggested fixes, confidence.

`worldbuilder.prep_question_generator`

- Persona: Dramaturge.
- Inputs: current doc or campaign focus, next session goal.
- Output: high-leverage DM questions grouped by lore, characters, locations, encounters, and player-facing reveals.

`worldbuilder.prompt_recipe_builder`

- Persona: Prompt Architect.
- Inputs: DM goal, available canon docs, desired output format, audience.
- Output: reusable prompt recipe with canon packet requirements, task boundary, schema, critique pass, and follow-up iteration step.

`worldbuilder.map_context_review`

- Persona: Cartographer.
- Inputs: map id or region doc.
- Output: landmarks, missing pins, route questions, spatial contradictions, suggested map work.

`worldbuilder.player_safe_summary`

- Persona: Player Handout Editor.
- Inputs: source docs, audience, spoiler policy.
- Output: safe summary plus a DM-only list of omitted spoilers.

#### Phase 2 Prompts

`worldbuilder.expand_location`

- Persona: Dungeon Architect plus Lorekeeper.
- Inputs: location doc, tone, intended level of detail, campaign anchors.
- Output: proposed sections, rooms/areas if appropriate, hooks, tags, links, validation notes.

`worldbuilder.build_encounter`

- Persona: Encounter Smith plus Rules Steward.
- Inputs: location, party level/size, desired difficulty, encounter type.
- Output: encounter design, scaling, rules references, terrain, rewards, failure states.

`worldbuilder.develop_npc`

- Persona: Dramaturge plus Lorekeeper.
- Inputs: NPC doc or seed concept, connected factions/locations, role in next session.
- Output: motives, secrets, tells, relationships, scene uses, player-facing description.

`worldbuilder.generate_lore_variants`

- Persona: Lorekeeper plus Continuity Editor.
- Inputs: canon packet, specific bounded request, count, selection criteria.
- Output: several labeled options, each with agenda/use case, canon fit, contradiction risk, moral cost or consequence, and follow-up question.

`worldbuilder.critique_lore_draft`

- Persona: Continuity Editor plus Prompt Architect.
- Inputs: draft proposal, source canon, desired table use.
- Output: critique of genericness, contradictions, missing specificity, weak table utility, player-safety risks, and revision instructions.

`worldbuilder.faction_pressure_update`

- Persona: Lorekeeper plus Dramaturge.
- Inputs: faction docs, recent session notes, current campaign tension.
- Output: faction moves, clocks, consequences, rumors, proposed doc patch.

`worldbuilder.prepare_session_packet`

- Persona: Session Scribe plus Dramaturge plus Encounter Smith.
- Inputs: campaign, focus docs, expected party location, time budget.
- Output: scenes, NPCs, encounters, clues, recap, table notes, unresolved questions.

#### Phase 3 Prompts

`worldbuilder.apply_approved_lore_update`

- Persona: Archivist plus Continuity Editor.
- Inputs: approved proposal id, target doc, confirmation context.
- Output: final patch summary, audit summary, follow-up diagnostics.

`worldbuilder.live_session_assistant`

- Persona: Session Scribe.
- Inputs: session room, current notes, active scene, spoiler mode.
- Output: terse running notes, reminders, unresolved threads, optional tool calls for approved note updates.

`worldbuilder.post_session_cleanup`

- Persona: Session Scribe plus Continuity Editor.
- Inputs: session notes, changed docs, loot/clues/NPC changes.
- Output: recap, canon changes, proposed tracker updates, player-safe summary, follow-up prep.

`worldbuilder.publish_player_recap`

- Persona: Player Handout Editor.
- Inputs: session recap, shared docs/snippets, spoiler policy.
- Output: player-facing recap and optional approved shared snippet.

## Files Likely Affected

Documentation:

- `docs/design/2026-07-07-dungeon-master-mcp-server.md`
- `README.md`
- `supabase/README.md`
- Future MCP setup documentation under `docs/` or `supabase/functions/`

New server code:

- `supabase/functions/worldbuilder-mcp/index.ts`
- `supabase/functions/worldbuilder-mcp/supabaseRest.ts`
- `supabase/functions/worldbuilder-mcp/types.ts`
- `supabase/functions/worldbuilder-mcp/worldbuilder.ts`
- `supabase/functions/worldbuilder-mcp/deno.json`
- `supabase/functions/worldbuilder-mcp/README.md`

Shared domain extraction or reuse:

- Existing parsing/context logic may need extraction from browser-only modules into server-safe modules.
- Candidate shared modules: `src/vault/parser.ts`, `src/domain/tags/*`, `src/domain/markdown/pageModel.ts`, `src/prep/context.ts`, `src/ai/worldbuild.ts`, `src/features/vaultDiagnostics/buildVaultDiagnostics.ts`.

Supabase schema:

- Phase 2 optional: `mcp_proposals`
- Phase 3 likely: `mcp_audit_events`
- Optional token/session table if app-issued MCP tokens are used instead of direct Supabase user JWTs.

Tests:

- New Edge Function unit tests if a test harness is added.
- Focused tests for tool schema validation, authorization, resource filtering, proposal validation, and write audit behavior.

## API/Schema Changes

Phase 1 should avoid schema changes. It can expose read-only MCP resources and tools from existing tables, RPC functions, and derived parsers.

Phase 2 should add a proposal store only if generated drafts need to persist beyond one MCP response. Candidate table:

- `mcp_proposals`
- `id text primary key`
- `campaign_id text not null references campaigns(id) on delete cascade`
- `created_by uuid not null default auth.uid()`
- `kind text not null`
- `title text not null`
- `payload jsonb not null`
- `validation jsonb`
- `source_prompt text`
- `status text not null default 'draft'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Phase 3 should add an audit table before persistent tools are enabled. Candidate table:

- `mcp_audit_events`
- `id text primary key`
- `campaign_id text not null references campaigns(id) on delete cascade`
- `actor_id uuid not null default auth.uid()`
- `operation text not null`
- `target_type text not null`
- `target_id text`
- `request jsonb not null`
- `summary text not null`
- `before_snapshot jsonb`
- `after_snapshot jsonb`
- `created_at timestamptz not null default now()`

All new tables need RLS policies that restrict access to campaign owners and DM-role members unless the record is intentionally player-facing.

## Data Flow

Read-only MCP flow:

1. MCP client connects to the hosted MCP endpoint.
2. Server authenticates the caller and resolves visible campaigns.
3. Client lists tools, resources, and prompts.
4. Assistant requests resources or calls read-only tools.
5. Server queries Supabase and derived parsers with caller role and audience constraints.
6. Server returns bounded structured content with source resource links.

Draft proposal flow:

1. User invokes a prompt such as `prepare_session_packet` or `expand_location`.
2. Assistant reads or builds a bounded canon packet from campaign resources.
3. Assistant calls draft tools that use templates, tags, graph context, prompt persona instructions, and the requested output schema.
4. For larger work, assistant generates variants first, then critiques the selected or strongest candidate.
5. Server returns a proposal with canon/inference/new-option labels, validation warnings, critique findings, and source links.
6. Optional `save_proposal` persists the proposal for app-side review.
7. No canon changes until the DM explicitly approves.

Prompt recipe flow:

1. User gives a broad or vague prep goal.
2. `Prompt Architect` narrows it into a bounded task, canon requirements, output contract, and critique step.
3. Server builds a canon packet from relevant docs, tags, links, summaries, tone examples, and constraints.
4. Assistant produces structured output such as a table, YAML/JSON, Markdown section, patch proposal, or diagnostic list.
5. Assistant runs the configured critique pass for genericness, contradictions, player-safety issues, and table usefulness.
6. Output remains a recommendation or proposal until the DM chooses what becomes canon.

Controlled write flow:

1. DM reviews a proposal in an MCP client or the app.
2. The write request includes an approved proposal id or explicit patch and a confirmation token.
3. Server re-checks auth, role, target campaign, proposal status, and validation.
4. Server captures before state.
5. Server applies the write through existing Supabase operations or server-side RPCs.
6. Server rebuilds affected links/tags when doc content changes.
7. Server records an audit event and returns updated resource links.

Player-safe output flow:

1. User requests a player-facing handout, recap, or snippet.
2. Prompt and tool inputs set `audience: player`.
3. Server retrieves only shared/player-safe context or strips DM-only blocks.
4. Output includes a DM-only spoiler report listing omitted content sources.
5. Publishing requires Phase 3 confirmation.

## Risks and Tradeoffs

- MCP clients can make tool calls quickly; write tools need confirmation, idempotency, and auditability before they are safe.
- Supabase Edge Functions are a good hosted fit, but long-running generation, large vault context, or streaming-heavy workflows may need strict limits and pagination.
- Reusing browser-oriented modules on the server may expose hidden dependencies on `window`, React, or Vite import behavior. Shared logic should be extracted carefully.
- AI assistants may over-treat drafts as canon. Prompts and tool outputs must label existing canon, inferred claims, and new inventions separately.
- Vague "make a world" prompts tend to produce generic fantasy defaults. The server should prefer prompt recipes that bind context, task, format, critique, and iteration.
- Structured outputs improve downstream validation, but over-structuring can flatten creative prose. Use schemas for decisions, tables, links, tags, patches, and audits; keep prose where atmosphere matters.
- Player-safe rendering is a security and trust issue, not just a formatting issue. DM-only content must be filtered before it reaches a player-facing prompt.
- Direct service-role access inside Edge Functions can bypass RLS if implemented carelessly. Prefer user-scoped clients or explicit role checks.
- Prompt persona proliferation can make the server feel noisy. Start with fewer high-value prompts and expand from real DM workflows.
- Proposal persistence adds product surface area. If the app cannot review proposals, Phase 2 should initially return ephemeral proposals.

## Alternatives Considered

- Browser-only AI tools instead of MCP. Rejected for this feature because MCP lets external assistants retrieve bounded context and use structured workflows without adding every workflow to the React UI first.
- Local stdio-only MCP server. Deferred because Worldbuilder is already Supabase-backed and a remote MCP server aligns better with hosted campaign data and collaboration.
- Full write access from the first phase. Rejected because the risk to canon, spoilers, and player-facing data is too high.
- Expose raw Supabase tables as generic database resources. Rejected because MCP should provide domain-safe campaign resources, not leak schema details or bypass app invariants.
- One generic "ask the DM assistant" prompt. Rejected because personas make context boundaries, output formats, and safety expectations clearer.
- Whole-world generation as a primary workflow. Rejected because the strongest use case is bounded assistance over existing canon, with the DM selecting from variants and approving what enters the vault.

## Test Plan

Phase 1:

- Verify tool schemas with valid and invalid inputs.
- Verify user can list only authorized campaigns.
- Verify `audience: player` excludes unshared docs and DM-only content.
- Verify search and context tools return bounded results with source URIs.
- Verify diagnostics and graph tools match existing app-derived results.
- Verify canon packets separate established facts, inferences, open questions, constraints, and style examples.

Phase 2:

- Verify drafts follow selected templates and mark new entities.
- Verify variant tools produce multiple options without marking them canon.
- Verify critique tools report genericness, contradiction risk, weak table utility, and player-safety issues.
- Verify structured prompt outputs conform to requested schemas when a schema is supplied.
- Verify proposal validation catches broken wikilinks, invalid tags, duplicate titles, and spoiler leakage.
- Verify saved proposals are scoped by campaign and creator role.
- Verify no draft tool mutates `docs`, `tags`, `edges`, maps, assets, or session notes.

Phase 3:

- Verify write tools reject missing confirmation tokens and non-DM users.
- Verify doc writes rebuild tags and edges.
- Verify audit events are written for every persistent operation.
- Verify rollback data is sufficient for manual restoration.
- Verify player-facing publish tools cannot include DM-only content by default.

Recommended repo checks after implementation begins:

- `npm run test:run`
- `npm run build`
- Supabase local function invocation tests once the function exists.

## Documentation Plan

- Add MCP setup documentation for local and hosted use.
- Document auth expectations, including how MCP clients obtain or pass tokens.
- Document each tool, resource URI, and prompt with examples.
- Document prompt recipe patterns, especially canon packet to structured generation to contradiction check to table-ready note to proposal.
- Add a DM-facing guide that explains read-only, proposal, and approved-write modes.
- Add a security note explaining player-safe filtering, DM-only blocks, and audit logs.

## Rollout/Rollback Plan

Rollout:

1. Ship Phase 1 behind documentation and a disabled-by-default function deployment.
2. Enable read-only MCP access for a test campaign.
3. Add Phase 2 proposal workflows after read-only auth/resource behavior is stable.
4. Add Phase 3 write tools one at a time, each behind confirmation and audit logging.

Rollback:

- Phase 1 rollback is disabling or undeploying the Edge Function.
- Phase 2 rollback is disabling proposal creation and leaving existing proposals read-only.
- Phase 3 rollback is disabling write tools while preserving audit events and existing app behavior.
- No rollback path should require mutating campaign content unless a write tool already applied a bad change; in that case use the audit event before snapshot or patch summary.

## Open Questions

- Should MCP clients authenticate directly with Supabase user JWTs, or should the app mint separate MCP-scoped tokens?
- Should proposals be stored in Supabase from Phase 2, or stay ephemeral until the app has a proposal review UI?
- Which DM roles should be allowed to use write tools: campaign owner only, or owner plus DM-role campaign members?
- How should existing DM-only block syntax be normalized for server-side player-safe filtering?
- Should the first hosted server be Supabase Edge Function only, or should a local stdio adapter be built at the same time for desktop clients?
- Which prompts are the highest-value first slice: session prep, continuity audit, player-safe summary, or location expansion?
- Should prompt recipes be static server definitions, campaign-editable templates, or both?
- How should map/spatial context be represented when prose summaries are not enough for relationship control?

## Decisions

### 2026-07-07 - Phase 2 Proposal Workbench

- **Decision:** Implement Phase 2 as proposal-workbench tools and resources, including draft scaffolds, variant scaffolds, critique, validation, player-safe handout shaping, and `mcp_proposals` persistence, while still excluding canon writes.
- **Reason:** This gives MCP clients a reviewable staging area for generated campaign material without allowing docs, tags, edges, maps, snippets, or session notes to be mutated before Phase 3 safeguards exist.
- **Alternatives rejected:** Server-side LLM generation was deferred because the MCP client can perform creative generation from prompts/resources and because adding AI provider secrets to the Edge Function would expand the security surface. Direct doc creation/update remains Phase 3 work.
- **User feedback:** The user asked to move on to Phase 2 on 2026-07-07.
- **Impact on implementation:** Add `mcp_proposals` schema/RLS, proposal resources, Phase 2 tools, and tests/smoke checks that prove discovery works and unauthenticated data writes are denied.

### 2026-07-07 - Phase 1 Edge Function MVP

- **Decision:** Start with a dependency-free Supabase Edge Function that implements the MCP JSON-RPC methods directly and exposes only Phase 1 read-only tools, resources, and prompts.
- **Reason:** This avoids adding Deno/npm dependencies before the protocol surface settles, keeps the setup small, and lets the function pass the caller's JWT through to Supabase REST so existing RLS remains the main data boundary.
- **Alternatives rejected:** Starting with `mcp-lite` was deferred because a tiny read-only JSON-RPC handler is enough for the first setup and avoids external dependency resolution in local development. Starting with write/proposal tools was rejected because Phase 1 success is read-only campaign context.
- **User feedback:** The user approved moving from planning to setup on 2026-07-07.
- **Impact on implementation:** Add `supabase/functions/worldbuilder-mcp/` with no write tools, require bearer auth for data-bearing methods, validate browser origins, document the MCP endpoint, and defer proposal/audit tables.

### 2026-07-07 - Three-Phase MCP Rollout

- **Decision:** Plan the MCP server in three phases: read-only campaign context, drafting/proposal workbench, and controlled campaign operations/session co-DM.
- **Reason:** This sequence provides useful assistant behavior early while protecting campaign canon, player-facing content, and Supabase data from premature writes.
- **Alternatives rejected:** Immediate write access was rejected as too risky. A generic database MCP was rejected because Worldbuilder needs domain-aware resources and role-aware filtering.
- **User feedback:** The user asked to outline the three phases, tools, resources, and prompts with different personas.
- **Impact on implementation:** Phase 1 should avoid schema changes and persistent mutations. Phase 2 may add proposal storage. Phase 3 should not ship without confirmation and audit logging.

### 2026-07-07 - Persona-Based Prompt Surface

- **Decision:** Prompts should be organized around DM personas such as Lorekeeper, Continuity Editor, Dungeon Architect, Cartographer, Encounter Smith, Dramaturge, Rules Steward, Player Handout Editor, Session Scribe, and Archivist.
- **Reason:** Distinct personas make each workflow's context, output format, and safety boundaries clearer than one broad assistant prompt.
- **Alternatives rejected:** A single general DM assistant prompt was rejected because it would blur lore creation, rules checking, player-facing writing, and write-safety expectations.
- **User feedback:** The user explicitly requested prompts with different personas for different parts.
- **Impact on implementation:** Prompt definitions should include persona, inputs, output shape, allowed tools/resources, and boundaries.

### 2026-07-07 - Canon-First Prompt Recipes

- **Decision:** MCP prompts should use canon-first, bounded, structured prompt recipes with critique and variant-generation steps.
- **Reason:** User-provided prompting notes emphasized that TTRPG AI works best as a brainstorming and stress-testing assistant when it receives existing canon, a specific task, a format instruction, structured outputs, iteration, and contradiction checks.
- **Alternatives rejected:** Broad world-generation prompts and first-answer-as-canon workflows were rejected because they produce generic results and weaken DM control.
- **User feedback:** The user provided a prompting reference note summarizing TTRPG Reddit discussions, GM blog guidance, prompt-engineering principles, and RPG generation research patterns.
- **Impact on implementation:** Add canon packet resources, `build_canon_packet`, variant and critique tools, `Prompt Architect` persona, and tests for canon labels, structured outputs, and critique behavior.

## User Feedback / Decisions

- 2026-07-07: User requested an outline for a Dungeon Master-focused MCP server for Worldbuilder, specifically covering three phases, tools, resources, and prompts/personas.
- 2026-07-07: User provided prompting guidance emphasizing bounded tasks, canon context, structured outputs, contradiction checks, variants, staged generation, and DM control over canon.
- Pending: User review of phase boundaries, first prompt set, and auth/write-safety assumptions.
