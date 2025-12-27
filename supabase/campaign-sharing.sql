-- Campaign sharing, membership, and snippet sharing.
-- Run after supabase/graph.sql, supabase/graph-rls.sql, supabase/app-schema.sql.

create extension if not exists pgcrypto;

create or replace function is_campaign_owner(target_campaign_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from campaigns c
    where c.id = target_campaign_id
      and c.owner_id = auth.uid()
  );
$$;

create or replace function is_campaign_member(target_campaign_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from campaign_members m
    where m.campaign_id = target_campaign_id
      and m.user_id = auth.uid()
  );
$$;

alter table docs
  add column if not exists shared boolean not null default false;

alter table folders
  add column if not exists shared boolean not null default false;

create table if not exists campaign_members (
  id bigserial primary key,
  campaign_id text not null references campaigns(id) on delete cascade,
  user_id uuid not null,
  role text not null,
  email text,
  created_at bigint not null
);

create table if not exists campaign_invites (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null references campaigns(id) on delete cascade,
  email text not null,
  role text not null,
  invited_by uuid not null,
  created_at bigint not null,
  accepted_at bigint
);

create table if not exists shared_snippets (
  id bigserial primary key,
  campaign_id text not null references campaigns(id) on delete cascade,
  doc_id text not null references docs(id) on delete cascade,
  created_by uuid not null,
  snippet_text text not null,
  start_offset integer,
  end_offset integer,
  created_at bigint not null
);

create index if not exists campaign_members_campaign_idx on campaign_members (campaign_id);
create index if not exists campaign_invites_campaign_idx on campaign_invites (campaign_id);
create index if not exists shared_snippets_campaign_idx on shared_snippets (campaign_id);
create index if not exists shared_snippets_doc_idx on shared_snippets (doc_id);

alter table campaign_members enable row level security;
alter table campaign_invites enable row level security;
alter table shared_snippets enable row level security;

drop policy if exists campaigns_select_shared on campaigns;
create policy campaigns_select_shared on campaigns
  for select
  using (
    owner_id = auth.uid()
    or is_campaign_member(id)
  );

drop policy if exists campaigns_update_shared on campaigns;
create policy campaigns_update_shared on campaigns
  for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists campaigns_delete_shared on campaigns;
create policy campaigns_delete_shared on campaigns
  for delete
  using (owner_id = auth.uid());

drop policy if exists folders_select_shared on folders;
create policy folders_select_shared on folders
  for select
  using (
    is_campaign_owner(folders.campaign_id)
    or (is_campaign_member(folders.campaign_id) and folders.shared = true)
  );

drop policy if exists folders_write_owner on folders;
create policy folders_write_owner on folders
  for all
  using (
    is_campaign_owner(folders.campaign_id)
  )
  with check (
    is_campaign_owner(folders.campaign_id)
  );

drop policy if exists docs_select_shared on docs;
create policy docs_select_shared on docs
  for select
  using (
    is_campaign_owner(docs.campaign_id)
    or (
      is_campaign_member(docs.campaign_id)
      and (
        docs.shared = true
        or exists (
          select 1 from folders f
          where f.id = docs.folder_id and f.shared = true
        )
      )
    )
  );

drop policy if exists docs_write_owner on docs;
create policy docs_write_owner on docs
  for all
  using (
    is_campaign_owner(docs.campaign_id)
  )
  with check (
    is_campaign_owner(docs.campaign_id)
  );

drop policy if exists edges_select_shared on edges;
create policy edges_select_shared on edges
  for select
  using (
    is_campaign_owner(edges.campaign_id)
    or (
      is_campaign_member(edges.campaign_id)
      and exists (
        select 1
        from docs d
        left join folders f on f.id = d.folder_id
        where d.id = edges.from_doc_id
          and (d.shared = true or f.shared = true)
      )
    )
  );

drop policy if exists edges_write_owner on edges;
create policy edges_write_owner on edges
  for all
  using (
    is_campaign_owner(edges.campaign_id)
  )
  with check (
    is_campaign_owner(edges.campaign_id)
  );

drop policy if exists tags_select_shared on tags;
create policy tags_select_shared on tags
  for select
  using (
    exists (
      select 1
      from docs d
      where d.id = tags.doc_id and is_campaign_owner(d.campaign_id)
    )
    or exists (
      select 1
      from docs d
      left join folders f on f.id = d.folder_id
      where d.id = tags.doc_id
        and is_campaign_member(d.campaign_id)
        and (d.shared = true or f.shared = true)
    )
  );

drop policy if exists tags_write_owner on tags;
create policy tags_write_owner on tags
  for all
  using (
    exists (
      select 1 from docs d
      where d.id = tags.doc_id and is_campaign_owner(d.campaign_id)
    )
  )
  with check (
    exists (
      select 1 from docs d
      where d.id = tags.doc_id and is_campaign_owner(d.campaign_id)
    )
  );

drop policy if exists campaign_members_select_owner on campaign_members;
create policy campaign_members_select_owner on campaign_members
  for select
  using (
    is_campaign_owner(campaign_members.campaign_id)
    or campaign_members.user_id = auth.uid()
  );

drop policy if exists campaign_members_write_owner on campaign_members;
create policy campaign_members_write_owner on campaign_members
  for all
  using (
    is_campaign_owner(campaign_members.campaign_id)
  )
  with check (
    is_campaign_owner(campaign_members.campaign_id)
  );

drop policy if exists campaign_invites_owner_only on campaign_invites;
create policy campaign_invites_owner_only on campaign_invites
  for all
  using (
    is_campaign_owner(campaign_invites.campaign_id)
  )
  with check (
    is_campaign_owner(campaign_invites.campaign_id)
  );

drop policy if exists shared_snippets_select_shared on shared_snippets;
create policy shared_snippets_select_shared on shared_snippets
  for select
  using (
    is_campaign_owner(shared_snippets.campaign_id)
    or is_campaign_member(shared_snippets.campaign_id)
  );

drop policy if exists shared_snippets_write_owner on shared_snippets;
create policy shared_snippets_write_owner on shared_snippets
  for all
  using (
    is_campaign_owner(shared_snippets.campaign_id)
  )
  with check (
    is_campaign_owner(shared_snippets.campaign_id)
  );
