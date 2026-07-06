# Worldbuilder

Phase 1 of the Worldbuilder app. Worldbuilder is a React/Vite campaign workspace backed by Supabase for auth, campaign data, sharing, references, maps, and session notes. The design and worldbuilding philosophy live in `WorldBuilder_readme.md`.

## Dev

```bash
npm install
supabase start
npm run dev
```

Required environment:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_REDIRECT_URL=
VITE_ENABLE_DEV_LOGIN=
```

Apply the Supabase SQL in `supabase/README.md` before running against a new project.
For local development, the repository includes Supabase CLI migrations. Run
`supabase start`, copy the local `ANON_KEY` into `.env`, and use
`supabase db reset --local --no-seed` whenever you need to recreate the local
database from scratch.
Set `VITE_ENABLE_DEV_LOGIN=true` locally to show the anonymous Supabase dev-login
button and skip magic-link email during development.

## Authoring

- Markdown pages support wikilinks, backlinks, tags, frontmatter infoboxes, heading anchors, spoiler/DM-only blocks, safe lore component blocks, page inserts, media embeds, and galleries.
- The page panel supports edit, preview, and split editor/preview modes with a table of contents, save status, breadcrumbs, previous/next links, and rename previews before wikilink updates.
- Header search scans page titles and body text for the active world.
- Bundled templates remain available, and campaign-scoped user templates can be created, edited, duplicated, deleted, and applied in the app.
- The page media library uploads private campaign files to Supabase Storage, edits asset metadata, replaces files, and inserts Storage-backed `![[asset:<id>|caption]]` embeds or `{{gallery: asset:id}}` galleries.
- Vault diagnostics report broken links, broken section anchors, duplicate titles, malformed frontmatter, invalid tags, orphan pages, unresolved embeds/galleries, broken inserts, import parse errors, and missing map pins for location-like pages.
- New map uploads use Supabase Storage with legacy data-URL maps still supported as a fallback.

## Vault Export/Import

- Export from Settings to download a single vault JSON (folders, docs, edges, tags, trash state).
- Import a vault JSON to merge into or overwrite the active campaign.
