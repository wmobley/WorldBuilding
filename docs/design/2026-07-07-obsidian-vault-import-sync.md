# Obsidian Vault Import and Sync Spec

## Status

Implemented

## Objective

Let users bring an Obsidian vault into Worldbuilder so their worldbuilding notes are available online through the existing React/Supabase site. Users should be able to import from either a zip archive or a linked GitHub repository, then resync the same source without creating duplicate pages.

## User need

Users already have worldbuilding material in Obsidian. They need a path to connect that existing vault to Worldbuilder, preserve the folder/page structure, keep Obsidian wikilinks useful, and access the content online after import. They also need a reasonable sync story so updates from the same zip or GitHub repo can refresh the online copy.

## Current code/system summary

Worldbuilder is a Vite/React/TypeScript app backed by Supabase Auth, RLS, Postgres tables, and Supabase Storage.

Relevant current behavior:

- `src/pages/SettingsPage.tsx` owns campaign-level import/export UI.
- Existing imports are browser-side. Foundry, 5e.tools, vault JSON, and zip bundles are parsed in the browser, then written into Supabase rows for the active campaign.
- `jszip` is already installed and used by `SettingsPage`.
- Vault pages are stored in `docs` with `title`, `body`, `folder_id`, `campaign_id`, `updated_at`, `sort_index`, `shared`, and `deleted_at`.
- Folders are stored in `folders` with `name`, `parent_folder_id`, `campaign_id`, `shared`, and `deleted_at`.
- Wikilinks and tags are derived in `saveDocContent`, which updates `edges` and `tags`.
- The app already supports live Supabase change subscriptions through `src/lib/useSupabaseQuery.ts`.
- Auth and RLS are already in place, with owner-only writes and member/player read policies.
- There is no persistent source mapping between an external file path and a Worldbuilder doc, so repeat imports currently risk duplicates unless the import format carries stable ids.

## Proposed design

Add Obsidian vault import and source sync in phases.

Phase 1 should add a practical import path without new secrets handling:

- Add an Obsidian source option in Settings.
- Accept `.zip` archives that contain `.md` files and common Obsidian attachment files.
- Accept a public GitHub repository URL and optional branch/root path by downloading a zip snapshot from GitHub's archive endpoint in the browser.
- Parse the archive into folders and Markdown docs.
- Create or reuse Worldbuilder folders matching the vault path.
- Create docs for Markdown files and preserve their body content with minimal transformation.
- Preserve Obsidian wikilinks because Worldbuilder already parses `[[Page]]` links.
- Skip hidden/system directories by default: `.obsidian`, `.git`, `.trash`, `.stfolder`, `node_modules`.
- Reject or require explicit confirmation for unusually large imports before reading all content in memory. Initial limits should cover maximum zip size, maximum extracted file count, maximum Markdown file size, and maximum total Markdown bytes.
- Normalize archive paths before processing. Ignore absolute paths, parent-directory segments, empty path segments, and platform-specific separator tricks so a crafted archive cannot create unexpected folder names or source mappings.
- Skip unsupported binary attachments in the first implementation, but report them in the import result. Images/assets can be added later through Supabase Storage mapping.
- Add a preview/summary before writing: number of Markdown files, folders, skipped files, and potential title collisions.
- Support merge and overwrite-like modes, but default to merge/update source-tracked pages only.

Phase 2 should make resync deterministic:

- Add source tracking tables:
  - `vault_sources` for a campaign's linked import source.
  - `vault_source_files` to map each external file path to a Worldbuilder doc id and last imported content hash.
- On import, create or update a source record and file mappings.
- On resync, update the existing mapped doc when the local Worldbuilder body still matches the last imported hash.
- If both the source file and Worldbuilder doc changed, mark a conflict instead of silently overwriting. The comparison should use a deterministic hash of the last imported Markdown body and the current `docs.body`, not `updated_at`.
- If a source file disappears, mark its mapping missing and offer to trash the linked doc rather than deleting automatically.
- Show last sync status, counts, conflicts, and skipped files in Settings.

Phase 3 should support private GitHub and scheduled sync through a backend:

- Do not store GitHub personal access tokens in `settings` or browser localStorage.
- Use a Supabase Edge Function, GitHub OAuth App, or GitHub App installation flow for private repositories.
- Store only encrypted/server-side token references or installation ids.
- Fetch private repo contents server-side, then write sync results through authenticated Supabase APIs with RLS-compatible ownership checks.
- Add manual sync first. Scheduled/background sync is optional and should only be added after token storage and retry semantics are designed.

Initial product scope should be one-way source-to-Worldbuilder sync. Editing in Worldbuilder remains supported, but those edits are not pushed back to Obsidian or GitHub. Bidirectional sync is a separate design because it requires markdown serialization guarantees, merge handling, and remote write permissions.

## Files likely affected

- `src/pages/SettingsPage.tsx`
- `src/lib/importExport.ts`
- New `src/lib/obsidianImport.ts` or `src/features/obsidian/*`
- `src/vault/types.ts`
- `src/vault/queries.ts`
- `supabase/app-schema.sql`
- New Supabase migration under `supabase/migrations/`
- `supabase/README.md`
- `README.md`
- Focused tests under `src/__tests__/roadmap/` or `src/__tests__/obsidian/`

Likely later phase files:

- Supabase Edge Function files for private GitHub sync
- Supabase secrets/config documentation
- Storage import helpers if Obsidian attachments are mapped into Supabase Storage

## API/schema changes

Add `vault_sources`:

```sql
create table if not exists vault_sources (
  id text primary key,
  campaign_id text not null references campaigns(id) on delete cascade,
  owner_id uuid not null default auth.uid(),
  provider text not null,
  source_key text not null,
  display_name text not null,
  repo_owner text,
  repo_name text,
  repo_branch text,
  root_path text,
  last_sync_at bigint,
  last_sync_status text,
  last_sync_message text,
  last_commit_sha text,
  created_at bigint not null,
  updated_at bigint not null
);
```

Add `vault_source_files`:

```sql
create table if not exists vault_source_files (
  id text primary key,
  source_id text not null references vault_sources(id) on delete cascade,
  campaign_id text not null references campaigns(id) on delete cascade,
  kind text not null default 'doc',
  source_path text not null,
  doc_id text references docs(id) on delete set null,
  asset_id text references assets(id) on delete set null,
  content_hash text not null,
  imported_title text not null,
  last_seen_at bigint not null,
  deleted_at bigint,
  conflict_at bigint,
  conflict_reason text
);
```

Recommended indexes:

- `vault_sources_campaign_idx` on `vault_sources(campaign_id)`
- unique `vault_sources_campaign_source_key_idx` on `vault_sources(campaign_id, source_key)`
- `vault_source_files_source_path_idx` unique on `vault_source_files(source_id, source_path)`
- `vault_source_files_doc_idx` on `vault_source_files(doc_id)`
- `vault_source_files_asset_idx` on `vault_source_files(asset_id)`

RLS should allow campaign owners to select/insert/update/delete source records and mappings for campaigns they own. Campaign members should not be able to mutate linked source configuration in the first pass.

No changes are required to `docs` or `folders` for Phase 1/2 if source mappings are kept separate.

Importer result types should be explicit in TypeScript and should separate parsed candidates from write results:

- Parsed candidates: normalized source path, title, body, folder path, content hash, size bytes.
- Skipped files: source path, reason, size bytes when known.
- Warnings: duplicate title, ambiguous wikilink target, unsupported attachment, limit warning.
- Write results: created docs, updated docs, unchanged docs, missing source files, conflicts.

## Data flow

Zip archive import:

1. User opens Settings and selects an Obsidian zip archive.
2. Browser reads the zip with `JSZip`.
3. Import parser validates size/count limits, filters entries, extracts Markdown files, normalizes paths, and builds folder/doc candidates.
4. UI displays a preview and selected mode.
5. On confirmation, the app creates or updates a `vault_sources` row with provider `zip`.
6. The app creates folders by path under the active campaign.
7. The app creates or updates docs based on `vault_source_files(source_id, source_path)`.
8. The app calls existing content-saving logic or equivalent edge/tag rebuild logic so links and tags stay indexed.
9. The app updates source file mappings, sync status, skipped-file counts, and conflicts.

Public GitHub repository import:

1. User enters a GitHub repository URL, branch, and optional vault root path.
2. Browser validates the URL is a GitHub repository URL.
3. Browser downloads a zip snapshot for the requested branch when CORS and rate limits allow it. If browser fetch is blocked, the same parser should be reused behind a Supabase Edge Function fallback.
4. The same archive parser and sync write path as zip import runs.
5. `vault_sources` stores provider `github`, repo owner/name, branch, root path, and last sync status.

Private GitHub later phase:

1. User authorizes GitHub through a backend-backed OAuth/App flow.
2. Server-side function fetches repository metadata and archive/content.
3. Function records source metadata and returns parsed/syncable file metadata or performs the import through controlled Supabase writes.
4. Browser shows the same status/conflict UI.

## Risks and tradeoffs

- Browser-only GitHub import can support public repositories but not private repos safely.
- GitHub archive endpoints can be affected by CORS or rate limits; if that blocks browser import, Phase 1 GitHub should move to a Supabase Edge Function even for public repos.
- Obsidian allows duplicate note titles in different folders. Worldbuilder wikilinks currently resolve by title, so duplicates can create ambiguous links. The importer should detect and report duplicates instead of pretending all wikilinks are unambiguous.
- Reusing `saveDocContent` for hundreds of files can be slow because it rebuilds links/tags per doc and may create placeholder docs for unresolved links. A batch link/tag rebuild may be needed for large vaults.
- Browser memory can spike when reading large zips. The first implementation should cap import size and report a clear error instead of attempting unbounded parsing.
- Crafted archives can contain unsafe or surprising paths. Path normalization and root filtering must happen before candidate generation and source mapping writes.
- Obsidian attachments can be large and private. Importing them into Supabase Storage needs file type validation, size limits, and visibility decisions. This should not be bundled into the first markdown-only import unless scoped explicitly.
- One-way sync will not satisfy users who expect edits in Worldbuilder to write back to GitHub. That should be called out in the UI.
- Overwrite behavior can destroy online edits. Default behavior should preserve local edits and surface conflicts.

## Alternatives considered

- Import everything as a single JSON vault export: rejected because users already have Obsidian folders and Markdown files, and the requested inputs are GitHub repos or zip archives.
- Add path/source columns directly to `docs`: rejected for now because source tracking is optional metadata and a separate mapping table avoids changing core doc semantics.
- Store GitHub personal access tokens in app settings: rejected because `settings` is user-readable from the browser and unsuitable for long-lived repo credentials.
- Full bidirectional sync in the first version: rejected because it requires conflict resolution, remote write permissions, markdown serialization guarantees, and user trust around overwrites.
- Convert Obsidian Markdown to a proprietary format: rejected because Worldbuilder already uses Markdown and supports wikilinks.

## Test plan

Unit tests:

- Parse a zip with nested folders and Markdown files into normalized folder/doc candidates.
- Ignore `.obsidian`, `.git`, hidden/system folders, and unsupported files.
- Preserve Markdown body content, including frontmatter, tags, embeds, and wikilinks.
- Detect duplicate titles and report them.
- Normalize GitHub repository URLs into owner/name/branch/root path metadata.
- Detect conflict when imported source hash no longer matches the current Worldbuilder doc body.

Integration/component tests:

- Settings UI shows Obsidian import controls and preview counts.
- Import disabled state appears while parsing/writing.
- Existing mapped files update instead of duplicating on resync.
- Conflicts are displayed without overwriting the edited doc.

Manual QA:

- Import a small zip vault with nested folders.
- Import a zip with duplicate note titles in different folders.
- Import a public GitHub repo snapshot.
- Resync after source changes.
- Resync after editing the Worldbuilder doc and verify conflict behavior.

Checks:

- `npm run test:run`
- `npm run build`

## Documentation plan

- Update `README.md` to mention Obsidian zip/public GitHub import and one-way sync scope.
- Update `supabase/README.md` with new tables, RLS, and migration order.
- Add user-facing copy in Settings that clearly distinguishes public GitHub import from future private repo support.
- Document that GitHub write-back and bidirectional sync are not part of the first release.

## Rollout/rollback plan

Rollout:

1. Add parser and tests without schema changes.
2. Add additive schema migration for source tracking.
3. Add Settings UI behind ordinary authenticated app access.
4. Start with markdown-only zip import and public GitHub snapshot import.
5. Add private GitHub only after backend credential handling is implemented.

Rollback:

- Hide or remove the Settings UI controls if import causes user-facing issues.
- Source tracking tables are additive; existing vault docs/folders continue to work.
- Imported docs can be manually trashed or removed by campaign owners.
- If a migration has been applied, leave tables in place unless a separate data cleanup is approved.

## Open questions

- Should duplicate title handling rename pages with folder prefixes, preserve titles and warn, or block import until resolved?
- Should source-linked docs be visually marked in the UI?

## Decisions

### 2026-07-07 - Keep Initial Sync One-Way

- **Decision:** The first design treats Obsidian/GitHub as the source of truth for sync and does not push Worldbuilder edits back to GitHub or local Obsidian archives.
- **Reason:** Bidirectional sync requires remote write credentials, merge semantics, and careful overwrite handling that are not present in the current app.
- **Alternatives rejected:** Immediate bidirectional sync was rejected as too risky for user data. Import-only was rejected because the user explicitly asked for sync.
- **User feedback:** Pending.
- **Impact on implementation:** Add source mappings and conflict reporting, but no GitHub write API calls.

### 2026-07-07 - Do Not Store GitHub Tokens In Browser Settings

- **Decision:** Private GitHub support requires a backend/OAuth/App path. Browser-only support is limited to public repository snapshots.
- **Reason:** Existing `settings` values are readable by the authenticated browser client and should not hold long-lived GitHub credentials.
- **Alternatives rejected:** Storing a PAT in Supabase `settings` or localStorage was rejected for credential safety.
- **User feedback:** Pending.
- **Impact on implementation:** Phase 1 can implement zip and public GitHub import; private repo sync waits for backend credential handling.

### 2026-07-07 - Map Imported Vaults To Campaign Root

- **Decision:** Imported Obsidian folders map directly into the active campaign root.
- **Reason:** The user explicitly chose campaign root, which keeps imported vault navigation natural and avoids an extra wrapper folder.
- **Alternatives rejected:** A top-level `Obsidian` folder was rejected for this implementation.
- **User feedback:** "campaign root."
- **Impact on implementation:** Folder creation starts at `parent_folder_id = null`, with archive/root paths preserved below that point.

### 2026-07-07 - Ship Public GitHub Import First

- **Decision:** Public GitHub repository snapshot import is sufficient for the first implementation.
- **Reason:** The user confirmed public import is fine, and this avoids unsafe browser-side token storage.
- **Alternatives rejected:** Private GitHub repo support in the first pass was deferred.
- **User feedback:** "yup public import is fine."
- **Impact on implementation:** Settings should accept a GitHub repository URL, branch, and optional root path, then fetch a public zip snapshot. No GitHub OAuth or token UI is added.

### 2026-07-07 - Import Common Image Files

- **Decision:** Common Obsidian image attachments should be imported into Supabase Storage.
- **Reason:** The user explicitly requested common image import, and the app already has private campaign asset storage.
- **Alternatives rejected:** Skipping all attachments in Phase 1 was rejected.
- **User feedback:** "Import common image files too."
- **Impact on implementation:** The importer should upload common images, create `assets` rows, and rewrite matching Obsidian image embeds to stable `asset:<id>` embeds where possible.

### 2026-07-07 - Add Source Keys And Image File Mappings

- **Decision:** Source tracking includes a stable `source_key`, file `kind`, and optional `asset_id` mapping.
- **Reason:** Repeat imports need to find the same zip/GitHub source without changing the source id, and image resync needs to reuse or replace the existing Storage asset instead of creating duplicate assets for the same source path.
- **Alternatives rejected:** Using only display name for source identity was rejected as too ambiguous. Mapping only docs was rejected because image import is now in scope.
- **User feedback:** Implied by approval for public GitHub import, campaign-root import, and common image import.
- **Impact on implementation:** SQL, query helpers, and import writes include `source_key`, `kind`, and `asset_id`.

## User feedback / decisions

- 2026-07-07: User approved campaign-root import, public GitHub import first, and common image import.
- 2026-07-07: Implemented locally. The main planned deviation is additive: source tracking includes `source_key`, file `kind`, and `asset_id` so zip/GitHub resync and imported image reuse can work deterministically.
