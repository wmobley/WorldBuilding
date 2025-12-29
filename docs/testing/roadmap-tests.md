# Roadmap Test Coverage

This document explains how each roadmap-aligned test works and why it validates the
corresponding issue outcome.

## Priority 1: Legacy / 5e.tools Code Cleanup

File: `src/__tests__/roadmap/01_legacy_code_cleanup.test.ts`

What it tests:
- `parseLinks` handles wikilinks, aliases, and doc ids.
- `parseTags` normalizes tag cases and types.
- `transformWikilinks` converts to app routes without losing labels.
- `stripIndexMarkers` removes index markers cleanly.
- `suggestTitleFromText` extracts reasonable titles from markdown.

Why it validates the issue:
- The cleanup goal is to ensure core utilities are reliable and not dead code.
- These assertions cover the most frequently reused parsing helpers and
  guarantee consistent outputs across legacy imports and new content.

## Priority 2: Supabase Sync & Authentication

File: `src/__tests__/roadmap/02_supabase_sync.test.tsx`

What it tests:
- `useSupabaseQuery` fetches once and subscribes to table changes when enabled.
- The hook skips all work when disabled.
- The Supabase channel is removed on unmount.

Why it validates the issue:
- Sync correctness depends on fetching and reacting to remote updates.
- The test enforces subscription behavior and safe teardown, a core
  requirement for reliable sync and offline handling.

## Priority 3: Session Play (Table Mode)

File: `src/__tests__/roadmap/03_session_play.test.tsx`

What it tests:
- Session lobby UI renders with join/create guidance and required inputs.

Why it validates the issue:
- The priority focuses on join/create UX for sessions. Rendering the entry
  panel and required input fields verifies the basic table mode workflow exists.

## Priority 4: Non-AI Prep Helpers

File: `src/__tests__/roadmap/04_non_ai_prep_helpers.test.ts`

What it tests:
- `buildPrepHelpers` produces encounter suggestions from `creature_type` + `terrain` tags (with legacy fallbacks).
- "Who’s involved" uses linked + backlink docs and classifies them properly.
- "What changed recently" reports deterministic reasons in order.
- Helper outputs include `explain`, `inputsUsed`, and `warnings` for determinism.

Why it validates the issue:
- The issue requires deterministic, explainable prep output without AI.
- This test fixes the input data and asserts stable, structured JSON results.

## Priority 5: AI Enhancement Layer

File: `src/__tests__/roadmap/05_ai_enhancement_layer.test.ts`

What it tests:
- `buildWorldbuildInputs` provides neutral defaults and safe structured inputs.
- `buildWorldbuildPrompt` formats input JSON without auto-writing content.
- `parseWorldbuildDrafts` only accepts structured JSON drafts.

Why it validates the issue:
- AI usage must remain opt-in and predictable. The tests assert a safe prompt
  format and strict parsing for structured outputs.

## Priority 6: UI Polish & Usability

File: `src/__tests__/roadmap/06_ui_polish.test.tsx`

What it tests:
- Empty-state copy in the Tags, Backlinks, and Prep Helpers panels renders.

Why it validates the issue:
- Usability improvements include clear empty states. These checks ensure
  the UI communicates that state instead of appearing broken or blank.

## Priority 7: Architecture & Maintainability

File: `src/__tests__/roadmap/07_architecture_cleanup.test.ts`

What it tests:
- `collectFolderPath` builds deterministic folder paths.
- `classifyAnchorType` maps folder paths to the right anchor types.

Why it validates the issue:
- The issue calls for clearer data flow and shared utilities.
- This validates core classification logic that multiple features depend on.

## Priority 8: Testing & Documentation

File: `src/__tests__/roadmap/08_testing_and_docs.test.ts`

What it tests:
- Roadmap docs contain Goal + Success Criteria sections.
- Templates expose core onboarding pages.

Why it validates the issue:
- Ensures the docs remain structured and that onboarding templates exist,
  supporting contributor and user understanding.

## Priority 12: Initiative Tracker Setup

File: `src/__tests__/roadmap/12_initiative_tracker_setup.test.ts`

What it tests:
- Deterministic initiative ordering with seeded rolls.
- Tie-breaking rules (dex mod, then name).

Why it validates the issue:
- The helper must be deterministic and transparent in how it orders combatants.
- These checks enforce the roll logic and ordering guarantees.

## Priority 13: Treasure Suggestion

File: `src/__tests__/roadmap/13_treasure_suggestion.test.ts`

What it tests:
- Individual loot aggregation across multiple monsters.
- Hoard loot selection by CR with seeded determinism.

Why it validates the issue:
- The helper should produce structured treasure outputs from deterministic table rolls.
