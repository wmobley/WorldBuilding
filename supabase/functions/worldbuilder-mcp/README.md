# Worldbuilder MCP Edge Function

Phase 2 MCP proposal-workbench server for Worldbuilder campaign context.

Endpoint:

```text
http://127.0.0.1:54321/functions/v1/worldbuilder-mcp/mcp
```

Production endpoint shape:

```text
https://<project-ref>.supabase.co/functions/v1/worldbuilder-mcp/mcp
```

## Auth

The function is configured with `verify_jwt = false` so MCP transport initialization and
CORS preflight can reach the function. Data-bearing MCP methods still require:

```text
Authorization: Bearer <Supabase user access token>
```

The function passes that token to Supabase REST with the anon key, so existing RLS
policies continue to scope campaign data. Do not replace this with a service-role
key for normal MCP reads or proposal writes.

## Local Development

Start Supabase:

```bash
supabase start
```

Serve the function:

```bash
supabase functions serve worldbuilder-mcp
```

Optional browser-origin allow list:

```bash
supabase functions serve worldbuilder-mcp --env-file .env
```

```text
WB_MCP_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Non-browser MCP clients usually omit `Origin` and are allowed through. Browser
requests with an `Origin` header must match `WB_MCP_ALLOWED_ORIGINS` or the local
defaults.

## Exposed MCP Surface

Implemented methods:

- `initialize`
- `ping`
- `tools/list`
- `tools/call`
- `resources/list`
- `resources/templates/list`
- `resources/read`
- `prompts/list`
- `prompts/get`

Phase 1 context tools:

- `worldbuilder.list_campaigns`
- `worldbuilder.search_lore`
- `worldbuilder.get_doc_context`
- `worldbuilder.build_canon_packet`
- `worldbuilder.get_graph_neighborhood`
- `worldbuilder.get_vault_diagnostics`
- `worldbuilder.build_session_brief`

Phase 2 proposal tools:

- `worldbuilder.draft_doc`
- `worldbuilder.draft_doc_patch`
- `worldbuilder.draft_scene`
- `worldbuilder.draft_encounter`
- `worldbuilder.draft_player_handout`
- `worldbuilder.generate_variants`
- `worldbuilder.critique_proposal`
- `worldbuilder.validate_proposal`
- `worldbuilder.save_proposal`

`save_proposal` writes only to `mcp_proposals`. This function intentionally does
not create, update, delete, share, upload, or publish campaign canon.
