-- MCP proposal workbench tables.
-- Run after supabase/campaign-sharing.sql so campaign member roles exist.

create table if not exists mcp_proposals (
  id text primary key,
  campaign_id text not null references campaigns(id) on delete cascade,
  created_by uuid not null default auth.uid(),
  kind text not null,
  title text not null,
  payload jsonb not null,
  validation jsonb,
  source_prompt text,
  status text not null default 'draft' check (
    status in ('draft', 'reviewed', 'approved', 'rejected', 'superseded')
  ),
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists mcp_proposals_campaign_idx on mcp_proposals (campaign_id);
create index if not exists mcp_proposals_created_by_idx on mcp_proposals (created_by);
create index if not exists mcp_proposals_status_idx on mcp_proposals (status);
create index if not exists mcp_proposals_updated_at_idx on mcp_proposals (updated_at);

alter table mcp_proposals enable row level security;

drop policy if exists mcp_proposals_select_dm on mcp_proposals;
create policy mcp_proposals_select_dm on mcp_proposals
  for select
  using (
    exists (
      select 1
      from campaigns c
      where c.id = mcp_proposals.campaign_id
        and c.owner_id = auth.uid()
    )
    or exists (
      select 1
      from campaign_members m
      where m.campaign_id = mcp_proposals.campaign_id
        and m.user_id = auth.uid()
        and m.role = 'dm'
    )
  );

drop policy if exists mcp_proposals_insert_dm on mcp_proposals;
create policy mcp_proposals_insert_dm on mcp_proposals
  for insert
  with check (
    created_by = auth.uid()
    and (
      exists (
        select 1
        from campaigns c
        where c.id = mcp_proposals.campaign_id
          and c.owner_id = auth.uid()
      )
      or exists (
        select 1
        from campaign_members m
        where m.campaign_id = mcp_proposals.campaign_id
          and m.user_id = auth.uid()
          and m.role = 'dm'
      )
    )
  );

drop policy if exists mcp_proposals_update_dm on mcp_proposals;
create policy mcp_proposals_update_dm on mcp_proposals
  for update
  using (
    exists (
      select 1
      from campaigns c
      where c.id = mcp_proposals.campaign_id
        and c.owner_id = auth.uid()
    )
    or exists (
      select 1
      from campaign_members m
      where m.campaign_id = mcp_proposals.campaign_id
        and m.user_id = auth.uid()
        and m.role = 'dm'
    )
  )
  with check (
    created_by = auth.uid()
    and (
      exists (
        select 1
        from campaigns c
        where c.id = mcp_proposals.campaign_id
          and c.owner_id = auth.uid()
      )
      or exists (
        select 1
        from campaign_members m
        where m.campaign_id = mcp_proposals.campaign_id
          and m.user_id = auth.uid()
          and m.role = 'dm'
      )
    )
  );

drop policy if exists mcp_proposals_delete_dm on mcp_proposals;
create policy mcp_proposals_delete_dm on mcp_proposals
  for delete
  using (
    exists (
      select 1
      from campaigns c
      where c.id = mcp_proposals.campaign_id
        and c.owner_id = auth.uid()
    )
    or exists (
      select 1
      from campaign_members m
      where m.campaign_id = mcp_proposals.campaign_id
        and m.user_id = auth.uid()
        and m.role = 'dm'
    )
  );
