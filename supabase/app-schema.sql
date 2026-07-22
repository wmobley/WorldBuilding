-- Additional application tables for Supabase (run after supabase/graph.sql).

create table if not exists folders (
  id text primary key,
  campaign_id text not null references campaigns(id) on delete cascade,
  name text not null,
  parent_folder_id text references folders(id) on delete set null,
  deleted_at bigint
);

alter table campaigns
  add column if not exists archived_at bigint;

alter table docs
  add column if not exists folder_id text references folders(id) on delete set null;

alter table docs
  add column if not exists sort_index integer;

create table if not exists tags (
  id bigserial primary key,
  doc_id text not null references docs(id) on delete cascade,
  type text not null,
  value text not null
);

create table if not exists settings (
  owner_id uuid not null default auth.uid(),
  key text not null,
  value text not null,
  primary key (owner_id, key)
);

create table if not exists "references" (
  id text primary key,
  slug text not null,
  name text not null,
  source text not null,
  content text not null,
  raw_json text,
  owner_id uuid not null default auth.uid()
);

create table if not exists npc_profiles (
  doc_id text primary key references docs(id) on delete cascade,
  creature_id text,
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists dm_screen_cards (
  id bigserial primary key,
  campaign_id text not null references campaigns(id) on delete cascade,
  kind text not null,
  entry_id text not null,
  "column" integer not null,
  position integer not null,
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists maps (
  id text primary key,
  campaign_id text not null references campaigns(id) on delete cascade,
  name text not null,
  image_data_url text not null,
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists map_locations (
  id bigserial primary key,
  map_id text not null references maps(id) on delete cascade,
  doc_id text not null references docs(id) on delete cascade,
  x numeric not null,
  y numeric not null,
  created_at bigint not null
);

create table if not exists session_notes (
  room_id text primary key,
  room_name text not null,
  campaign_id text references campaigns(id) on delete set null,
  content text not null,
  created_at bigint not null,
  updated_at bigint not null,
  owner_id uuid not null default auth.uid()
);

create table if not exists templates (
  id text primary key,
  campaign_id text not null references campaigns(id) on delete cascade,
  owner_id uuid not null default auth.uid(),
  name text not null,
  description text not null default '',
  kind text not null default '',
  body text not null,
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists assets (
  id text primary key,
  campaign_id text not null references campaigns(id) on delete cascade,
  doc_id text references docs(id) on delete set null,
  owner_id uuid not null default auth.uid(),
  storage_path text not null,
  filename text not null,
  content_type text,
  size_bytes bigint,
  alt_text text,
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists vault_sources (
  id text primary key,
  campaign_id text not null references campaigns(id) on delete cascade,
  owner_id uuid not null default auth.uid(),
  provider text not null check (provider in ('zip', 'github')),
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

create table if not exists vault_source_files (
  id text primary key,
  source_id text not null references vault_sources(id) on delete cascade,
  campaign_id text not null references campaigns(id) on delete cascade,
  kind text not null default 'doc' check (kind in ('doc', 'image')),
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

alter table maps
  add column if not exists image_storage_path text;

alter table maps
  add column if not exists width integer;

alter table maps
  add column if not exists height integer;

create index if not exists folders_campaign_idx on folders (campaign_id);
create index if not exists docs_campaign_idx on docs (campaign_id);
create index if not exists tags_doc_idx on tags (doc_id);
create index if not exists references_slug_idx on "references" (slug);
create unique index if not exists references_unique_idx on "references" (owner_id, slug, name, source);
create index if not exists maps_campaign_idx on maps (campaign_id);
create index if not exists map_locations_map_idx on map_locations (map_id);
create index if not exists templates_campaign_idx on templates (campaign_id);
create index if not exists assets_campaign_idx on assets (campaign_id);
create index if not exists assets_doc_idx on assets (doc_id);
create index if not exists vault_sources_campaign_idx on vault_sources (campaign_id);
create unique index if not exists vault_sources_campaign_source_key_idx on vault_sources (campaign_id, source_key);
create index if not exists vault_source_files_doc_idx on vault_source_files (doc_id);
create index if not exists vault_source_files_asset_idx on vault_source_files (asset_id);
create unique index if not exists vault_source_files_source_path_idx on vault_source_files (source_id, source_path);

alter table folders enable row level security;
alter table tags enable row level security;
alter table settings enable row level security;
alter table "references" enable row level security;
alter table npc_profiles enable row level security;
alter table dm_screen_cards enable row level security;
alter table maps enable row level security;
alter table map_locations enable row level security;
alter table session_notes enable row level security;
alter table templates enable row level security;
alter table assets enable row level security;
alter table vault_sources enable row level security;
alter table vault_source_files enable row level security;

drop policy if exists folders_select_owned_campaign on folders;
create policy folders_select_owned_campaign on folders
  for select
  using (
    exists (
      select 1 from campaigns c
      where c.id = folders.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists folders_insert_owned_campaign on folders;
create policy folders_insert_owned_campaign on folders
  for insert
  with check (
    exists (
      select 1 from campaigns c
      where c.id = folders.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists folders_update_owned_campaign on folders;
create policy folders_update_owned_campaign on folders
  for update
  using (
    exists (
      select 1 from campaigns c
      where c.id = folders.campaign_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from campaigns c
      where c.id = folders.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists folders_delete_owned_campaign on folders;
create policy folders_delete_owned_campaign on folders
  for delete
  using (
    exists (
      select 1 from campaigns c
      where c.id = folders.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists tags_select_owned_doc on tags;
create policy tags_select_owned_doc on tags
  for select
  using (
    exists (
      select 1 from docs d
      join campaigns c on c.id = d.campaign_id
      where d.id = tags.doc_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists tags_insert_owned_doc on tags;
create policy tags_insert_owned_doc on tags
  for insert
  with check (
    exists (
      select 1 from docs d
      join campaigns c on c.id = d.campaign_id
      where d.id = tags.doc_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists tags_update_owned_doc on tags;
create policy tags_update_owned_doc on tags
  for update
  using (
    exists (
      select 1 from docs d
      join campaigns c on c.id = d.campaign_id
      where d.id = tags.doc_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from docs d
      join campaigns c on c.id = d.campaign_id
      where d.id = tags.doc_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists tags_delete_owned_doc on tags;
create policy tags_delete_owned_doc on tags
  for delete
  using (
    exists (
      select 1 from docs d
      join campaigns c on c.id = d.campaign_id
      where d.id = tags.doc_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists settings_select_own on settings;
create policy settings_select_own on settings
  for select
  using (owner_id = auth.uid());

drop policy if exists settings_insert_own on settings;
create policy settings_insert_own on settings
  for insert
  with check (owner_id = auth.uid());

drop policy if exists settings_update_own on settings;
create policy settings_update_own on settings
  for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists settings_delete_own on settings;
create policy settings_delete_own on settings
  for delete
  using (owner_id = auth.uid());

drop policy if exists references_select_own on "references";
create policy references_select_own on "references"
  for select
  using (owner_id = auth.uid());

drop policy if exists references_insert_own on "references";
create policy references_insert_own on "references"
  for insert
  with check (owner_id = auth.uid());

drop policy if exists references_update_own on "references";
create policy references_update_own on "references"
  for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists references_delete_own on "references";
create policy references_delete_own on "references"
  for delete
  using (owner_id = auth.uid());

drop policy if exists vault_sources_select_owned_campaign on vault_sources;
create policy vault_sources_select_owned_campaign on vault_sources
  for select
  using (
    exists (
      select 1 from campaigns c
      where c.id = vault_sources.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists vault_sources_insert_owned_campaign on vault_sources;
create policy vault_sources_insert_owned_campaign on vault_sources
  for insert
  with check (
    exists (
      select 1 from campaigns c
      where c.id = vault_sources.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists vault_sources_update_owned_campaign on vault_sources;
create policy vault_sources_update_owned_campaign on vault_sources
  for update
  using (
    exists (
      select 1 from campaigns c
      where c.id = vault_sources.campaign_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from campaigns c
      where c.id = vault_sources.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists vault_sources_delete_owned_campaign on vault_sources;
create policy vault_sources_delete_owned_campaign on vault_sources
  for delete
  using (
    exists (
      select 1 from campaigns c
      where c.id = vault_sources.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists vault_source_files_select_owned_campaign on vault_source_files;
create policy vault_source_files_select_owned_campaign on vault_source_files
  for select
  using (
    exists (
      select 1 from campaigns c
      where c.id = vault_source_files.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists vault_source_files_insert_owned_campaign on vault_source_files;
create policy vault_source_files_insert_owned_campaign on vault_source_files
  for insert
  with check (
    exists (
      select 1 from campaigns c
      where c.id = vault_source_files.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists vault_source_files_update_owned_campaign on vault_source_files;
create policy vault_source_files_update_owned_campaign on vault_source_files
  for update
  using (
    exists (
      select 1 from campaigns c
      where c.id = vault_source_files.campaign_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from campaigns c
      where c.id = vault_source_files.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists vault_source_files_delete_owned_campaign on vault_source_files;
create policy vault_source_files_delete_owned_campaign on vault_source_files
  for delete
  using (
    exists (
      select 1 from campaigns c
      where c.id = vault_source_files.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists npc_profiles_select_owned_doc on npc_profiles;
create policy npc_profiles_select_owned_doc on npc_profiles
  for select
  using (
    exists (
      select 1 from docs d
      join campaigns c on c.id = d.campaign_id
      where d.id = npc_profiles.doc_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists npc_profiles_upsert_owned_doc on npc_profiles;
create policy npc_profiles_upsert_owned_doc on npc_profiles
  for all
  using (
    exists (
      select 1 from docs d
      join campaigns c on c.id = d.campaign_id
      where d.id = npc_profiles.doc_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from docs d
      join campaigns c on c.id = d.campaign_id
      where d.id = npc_profiles.doc_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists dm_screen_cards_select_owned_campaign on dm_screen_cards;
create policy dm_screen_cards_select_owned_campaign on dm_screen_cards
  for select
  using (
    exists (
      select 1 from campaigns c
      where c.id = dm_screen_cards.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists dm_screen_cards_upsert_owned_campaign on dm_screen_cards;
create policy dm_screen_cards_upsert_owned_campaign on dm_screen_cards
  for all
  using (
    exists (
      select 1 from campaigns c
      where c.id = dm_screen_cards.campaign_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from campaigns c
      where c.id = dm_screen_cards.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists maps_select_owned_campaign on maps;
create policy maps_select_owned_campaign on maps
  for select
  using (
    exists (
      select 1 from campaigns c
      where c.id = maps.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists maps_upsert_owned_campaign on maps;
create policy maps_upsert_owned_campaign on maps
  for all
  using (
    exists (
      select 1 from campaigns c
      where c.id = maps.campaign_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from campaigns c
      where c.id = maps.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists map_locations_select_owned_map on map_locations;
create policy map_locations_select_owned_map on map_locations
  for select
  using (
    exists (
      select 1 from maps m
      join campaigns c on c.id = m.campaign_id
      where m.id = map_locations.map_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists map_locations_upsert_owned_map on map_locations;
create policy map_locations_upsert_owned_map on map_locations
  for all
  using (
    exists (
      select 1 from maps m
      join campaigns c on c.id = m.campaign_id
      where m.id = map_locations.map_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from maps m
      join campaigns c on c.id = m.campaign_id
      where m.id = map_locations.map_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists session_notes_select_own on session_notes;
create policy session_notes_select_own on session_notes
  for select
  using (owner_id = auth.uid());

drop policy if exists session_notes_upsert_own on session_notes;
create policy session_notes_upsert_own on session_notes
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists templates_select_owned_campaign on templates;
create policy templates_select_owned_campaign on templates
  for select
  using (
    exists (
      select 1 from campaigns c
      where c.id = templates.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists templates_write_owned_campaign on templates;
create policy templates_write_owned_campaign on templates
  for all
  using (
    exists (
      select 1 from campaigns c
      where c.id = templates.campaign_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from campaigns c
      where c.id = templates.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists assets_select_owned_campaign on assets;
create policy assets_select_owned_campaign on assets
  for select
  using (
    exists (
      select 1 from campaigns c
      where c.id = assets.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists assets_write_owned_campaign on assets;
create policy assets_write_owned_campaign on assets
  for all
  using (
    exists (
      select 1 from campaigns c
      where c.id = assets.campaign_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from campaigns c
      where c.id = assets.campaign_id and c.owner_id = auth.uid()
    )
  );
