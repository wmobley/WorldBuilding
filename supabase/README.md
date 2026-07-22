# Supabase Graph Setup

This project uses a graph-like model (docs as nodes, edges as links). The SQL in
`supabase/graph.sql` sets up tables, indexes, and traversal helpers in Postgres,
and enables `pg_graphql` so Supabase can expose the schema over GraphQL.
`supabase/app-schema.sql` adds the remaining application tables (folders, tags,
references, templates, assets, maps, etc.) with row-level security.
`supabase/campaign-sharing.sql` adds campaign members, invites, shared snippets,
and shared folder/page policies.

## Local Supabase

This repo is configured for the Supabase CLI. To start a local database and API:

```bash
supabase start
supabase status -o env
```

Create `.env` from `.env.example` and copy the local `ANON_KEY` into
`VITE_SUPABASE_ANON_KEY`.

To recreate the local database from the checked-in migrations:

```bash
supabase db reset --local --no-seed
```

The migration order mirrors the raw SQL files:

1. `supabase/migrations/20260706000100_graph.sql`
2. `supabase/migrations/20260706000200_graph_rls.sql`
3. `supabase/migrations/20260706000300_app_schema.sql`
4. `supabase/migrations/20260706000400_campaign_sharing.sql`
5. `supabase/migrations/20260706000500_assets_storage.sql`
6. `supabase/migrations/20260707000100_obsidian_vault_sources.sql`
7. `supabase/migrations/20260707000200_mcp_proposals.sql`

## Worldbuilder MCP Edge Function

The repo includes a Phase 2 MCP proposal-workbench server at
`supabase/functions/worldbuilder-mcp`.

Local endpoint:

```text
http://127.0.0.1:54321/functions/v1/worldbuilder-mcp/mcp
```

Serve it locally after `supabase start`:

```bash
supabase functions serve worldbuilder-mcp
```

Data-bearing MCP methods require a Supabase user access token:

```text
Authorization: Bearer <Supabase user access token>
```

The function passes that user token to Supabase REST with the anon key, so
existing RLS policies remain the data boundary. It can save proposal records to
`mcp_proposals`, but it does not create, update, delete, share, upload, publish,
or otherwise mutate campaign canon.

For browser clients, set `WB_MCP_ALLOWED_ORIGINS` as a comma-separated allow
list. Non-browser MCP clients usually omit `Origin` and are accepted.

## Apply the Schema To A Hosted Project

1. Create a Supabase project.
2. Open the SQL editor.
3. Run `supabase/graph.sql`.
4. Run `supabase/graph-rls.sql`.
5. Run `supabase/app-schema.sql`.
6. Run `supabase/campaign-sharing.sql`.
7. Run `supabase/assets-storage.sql`.
8. Run `supabase/mcp-proposals.sql`.

The checked-in migrations can also be used with a linked hosted project, but
`supabase db push` mutates remote state and should only be run after confirming
the target project.

## App environment

The Vite app requires:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_REDIRECT_URL=
```

Configure Supabase Auth magic-link redirect URLs to include the local dev URL and
the deployed app URL. `VITE_SUPABASE_REDIRECT_URL` is optional locally; the app
falls back to `window.location.origin`.

Local Supabase enables anonymous sign-in so the development login button can
skip magic-link email while still exercising real Supabase sessions and RLS.
The app only shows that button when `import.meta.env.DEV` is true and
`VITE_ENABLE_DEV_LOGIN=true`.

## Tables added by app schema

`app-schema.sql` creates or updates:

- `folders`
- `tags`
- `settings`
- `references`
- `npc_profiles`
- `dm_screen_cards`
- `maps`
- `map_locations`
- `session_notes`
- `templates`
- `assets`
- `vault_sources`
- `vault_source_files`

`mcp-proposals.sql` creates:

- `mcp_proposals`

Maps still support existing `image_data_url` rows. New map/media work can use the
Storage-ready `image_storage_path`, `width`, `height`, and `assets` metadata
columns after Supabase Storage buckets and policies are configured.

## Storage Bucket

`assets-storage.sql` creates a private Supabase Storage bucket:

- Bucket id: `campaign-assets`
- Object path shape for page assets: `<campaign_id>/<asset_id>-<safe_filename>`
- Object path shape for map images: `<campaign_id>/maps/<map_id>-<safe_filename>`
- Maximum file size: 50 MiB
- Allowed MIME types: common images, PDF, audio, and video formats

Storage object policies allow campaign owners to select, insert, update, and
delete objects whose first path segment matches their campaign id. Campaign
members can select only asset objects whose `assets` row points to a shared page
or a page inside a shared folder. Map Storage paths are not exposed to players by
that shared-asset policy.
Markdown stores stable asset references such as:

```markdown
![[asset:asset-id|Caption]]
```

The app resolves those references to short-lived signed Storage URLs at render
time. Do not paste signed URLs into page Markdown.

Simple galleries use stable asset ids:

```markdown
{{gallery: asset:asset-id, asset:other-asset-id}}
```

New map uploads write image files to the same private bucket and store
`maps.image_storage_path`, while existing `maps.image_data_url` rows continue to
render as a fallback.

## Obsidian Vault Sources

Settings can import an Obsidian vault from a zip archive or public GitHub
repository snapshot. The importer writes Markdown files into the active campaign
root, uploads common image files to the private `campaign-assets` bucket, and
records source mappings for one-way resync.

Source tracking tables:

- `vault_sources` stores the linked zip/GitHub source metadata, source key, and
  last sync status.
- `vault_source_files` maps source paths to imported docs or Storage assets,
  stores the last imported content hash, and records conflicts or missing files.

Reimports update a mapped page only when the current Worldbuilder page still
matches the last imported body hash. If the page changed locally, the source
file is marked as a conflict instead of overwriting the user's online edit.
Private GitHub repository access is intentionally not handled in the browser;
that requires a backend OAuth or GitHub App flow.

## Example SQL queries

Get a 2-hop neighborhood:

```sql
select * from graph_k_hop_docs('campaign-id', 'doc-a', 2, 'both');
```

Find a shortest path (up to 6 hops):

```sql
select graph_shortest_path('campaign-id', 'doc-a', 'doc-b', 6, 'both');
```

## Example GraphQL

Supabase exposes tables and functions via GraphQL when `pg_graphql` is enabled.

```graphql
query TwoHop {
  graph_k_hop_docs(
    args: { p_campaign_id: "campaign-id", p_start_doc_id: "doc-a", p_max_hops: 2, p_direction: "both" }
  ) {
    doc_id
    hop
    path
  }
}
```

```graphql
query ShortestPath {
  graph_shortest_path(
    args: { p_campaign_id: "campaign-id", p_start_doc_id: "doc-a", p_target_doc_id: "doc-b", p_max_hops: 6, p_direction: "both" }
  )
}
```

## Notes

- Row-level security is enabled in `supabase/graph-rls.sql`,
  `supabase/app-schema.sql`, and `supabase/campaign-sharing.sql`.
- `edges` supports `edge_type` and `weight` for richer AI inference.
- Remote project resets, `supabase db push`, and Storage bucket changes are
  external state mutations. Back up data and confirm the target project before
  running those commands.
