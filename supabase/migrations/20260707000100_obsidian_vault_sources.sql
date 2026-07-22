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

create index if not exists vault_sources_campaign_idx on vault_sources (campaign_id);
create unique index if not exists vault_sources_campaign_source_key_idx on vault_sources (campaign_id, source_key);
create index if not exists vault_source_files_doc_idx on vault_source_files (doc_id);
create index if not exists vault_source_files_asset_idx on vault_source_files (asset_id);
create unique index if not exists vault_source_files_source_path_idx on vault_source_files (source_id, source_path);

alter table vault_sources enable row level security;
alter table vault_source_files enable row level security;

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
