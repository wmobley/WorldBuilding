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

create index if not exists folders_campaign_idx on folders (campaign_id);
create index if not exists docs_campaign_idx on docs (campaign_id);
create index if not exists tags_doc_idx on tags (doc_id);
create index if not exists references_slug_idx on "references" (slug);
create index if not exists maps_campaign_idx on maps (campaign_id);
create index if not exists map_locations_map_idx on map_locations (map_id);

alter table folders enable row level security;
alter table tags enable row level security;
alter table settings enable row level security;
alter table "references" enable row level security;
alter table npc_profiles enable row level security;
alter table dm_screen_cards enable row level security;
alter table maps enable row level security;
alter table map_locations enable row level security;
alter table session_notes enable row level security;

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
