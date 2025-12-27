# Supabase Graph Setup

This project uses a graph-like model (docs as nodes, edges as links). The SQL in
`supabase/graph.sql` sets up tables, indexes, and traversal helpers in Postgres,
and enables `pg_graphql` so Supabase can expose the schema over GraphQL.
`supabase/app-schema.sql` adds the remaining application tables (folders, tags,
references, maps, etc.) with row-level security.

## Apply the schema

1. Create a Supabase project.
2. Open the SQL editor.
3. Run `supabase/graph.sql`.
4. Run `supabase/graph-rls.sql`.
5. Run `supabase/app-schema.sql`.

If you prefer migrations, paste the contents into your migration system.

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

- Row-level security is enabled in `supabase/graph-rls.sql` and
  `supabase/app-schema.sql`. Extend policies if you add shared campaigns.
- `edges` supports `edge_type` and `weight` for richer AI inference.
