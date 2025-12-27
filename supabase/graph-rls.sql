-- Follow-up SQL for RLS + edge weights/types.
-- Run after supabase/graph.sql if it has already been applied.

alter table campaigns
  add column if not exists owner_id uuid not null default auth.uid();

alter table edges
  add column if not exists weight numeric not null default 1;

alter table campaigns enable row level security;
alter table docs enable row level security;
alter table edges enable row level security;

drop policy if exists campaigns_select_own on campaigns;
create policy campaigns_select_own on campaigns
  for select
  using (owner_id = auth.uid());

drop policy if exists campaigns_insert_own on campaigns;
create policy campaigns_insert_own on campaigns
  for insert
  with check (owner_id = auth.uid());

drop policy if exists campaigns_update_own on campaigns;
create policy campaigns_update_own on campaigns
  for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists campaigns_delete_own on campaigns;
create policy campaigns_delete_own on campaigns
  for delete
  using (owner_id = auth.uid());

drop policy if exists docs_select_owned_campaign on docs;
create policy docs_select_owned_campaign on docs
  for select
  using (
    exists (
      select 1 from campaigns c
      where c.id = docs.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists docs_insert_owned_campaign on docs;
create policy docs_insert_owned_campaign on docs
  for insert
  with check (
    exists (
      select 1 from campaigns c
      where c.id = docs.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists docs_update_owned_campaign on docs;
create policy docs_update_owned_campaign on docs
  for update
  using (
    exists (
      select 1 from campaigns c
      where c.id = docs.campaign_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from campaigns c
      where c.id = docs.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists docs_delete_owned_campaign on docs;
create policy docs_delete_owned_campaign on docs
  for delete
  using (
    exists (
      select 1 from campaigns c
      where c.id = docs.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists edges_select_owned_campaign on edges;
create policy edges_select_owned_campaign on edges
  for select
  using (
    exists (
      select 1 from campaigns c
      where c.id = edges.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists edges_insert_owned_campaign on edges;
create policy edges_insert_owned_campaign on edges
  for insert
  with check (
    exists (
      select 1 from campaigns c
      where c.id = edges.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists edges_update_owned_campaign on edges;
create policy edges_update_owned_campaign on edges
  for update
  using (
    exists (
      select 1 from campaigns c
      where c.id = edges.campaign_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from campaigns c
      where c.id = edges.campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists edges_delete_owned_campaign on edges;
create policy edges_delete_owned_campaign on edges
  for delete
  using (
    exists (
      select 1 from campaigns c
      where c.id = edges.campaign_id and c.owner_id = auth.uid()
    )
  );
