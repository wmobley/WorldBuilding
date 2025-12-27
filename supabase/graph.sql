-- Graph-oriented schema and traversal helpers for Supabase/Postgres.
-- Apply this in the Supabase SQL editor or via migrations.

create extension if not exists pg_graphql;

create table if not exists campaigns (
  id text primary key,
  name text not null,
  synopsis text not null default '',
  owner_id uuid not null default auth.uid(),
  created_at bigint not null,
  updated_at bigint not null,
  archived_at bigint
);

create table if not exists docs (
  id text primary key,
  campaign_id text not null references campaigns(id) on delete cascade,
  title text not null,
  body text not null default '',
  updated_at bigint not null,
  deleted_at bigint
);

create table if not exists edges (
  id bigserial primary key,
  campaign_id text not null references campaigns(id) on delete cascade,
  from_doc_id text not null references docs(id) on delete cascade,
  to_doc_id text not null references docs(id) on delete cascade,
  link_text text not null default '',
  edge_type text not null default 'link',
  weight numeric not null default 1,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create index if not exists edges_campaign_idx on edges (campaign_id);
create index if not exists edges_from_idx on edges (from_doc_id);
create index if not exists edges_to_idx on edges (to_doc_id);
create index if not exists edges_campaign_from_idx on edges (campaign_id, from_doc_id);
create index if not exists edges_campaign_to_idx on edges (campaign_id, to_doc_id);

alter table campaigns enable row level security;
alter table docs enable row level security;
alter table edges enable row level security;

create policy campaigns_select_own on campaigns
  for select
  using (owner_id = auth.uid());

create policy campaigns_insert_own on campaigns
  for insert
  with check (owner_id = auth.uid());

create policy campaigns_update_own on campaigns
  for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy campaigns_delete_own on campaigns
  for delete
  using (owner_id = auth.uid());

create policy docs_select_owned_campaign on docs
  for select
  using (
    exists (
      select 1 from campaigns c
      where c.id = docs.campaign_id and c.owner_id = auth.uid()
    )
  );

create policy docs_insert_owned_campaign on docs
  for insert
  with check (
    exists (
      select 1 from campaigns c
      where c.id = docs.campaign_id and c.owner_id = auth.uid()
    )
  );

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

create policy docs_delete_owned_campaign on docs
  for delete
  using (
    exists (
      select 1 from campaigns c
      where c.id = docs.campaign_id and c.owner_id = auth.uid()
    )
  );

create policy edges_select_owned_campaign on edges
  for select
  using (
    exists (
      select 1 from campaigns c
      where c.id = edges.campaign_id and c.owner_id = auth.uid()
    )
  );

create policy edges_insert_owned_campaign on edges
  for insert
  with check (
    exists (
      select 1 from campaigns c
      where c.id = edges.campaign_id and c.owner_id = auth.uid()
    )
  );

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

create policy edges_delete_owned_campaign on edges
  for delete
  using (
    exists (
      select 1 from campaigns c
      where c.id = edges.campaign_id and c.owner_id = auth.uid()
    )
  );

-- K-hop traversal that returns each reachable doc, hop count, and path.
create or replace function graph_k_hop_docs(
  p_campaign_id text,
  p_start_doc_id text,
  p_max_hops int,
  p_direction text default 'out'
)
returns table (doc_id text, hop int, path text[])
language sql
stable
as $$
  with recursive walk as (
    select
      p_start_doc_id as doc_id,
      0 as hop,
      array[p_start_doc_id] as path
    union all
    select
      next_doc_id,
      w.hop + 1,
      w.path || next_doc_id
    from walk w
    join edges e
      on e.campaign_id = p_campaign_id
     and (
       (p_direction = 'out' and e.from_doc_id = w.doc_id) or
       (p_direction = 'in' and e.to_doc_id = w.doc_id) or
       (p_direction = 'both' and (e.from_doc_id = w.doc_id or e.to_doc_id = w.doc_id))
     )
    cross join lateral (
      select case
        when p_direction = 'in' then e.from_doc_id
        when p_direction = 'out' then e.to_doc_id
        else case
          when e.from_doc_id = w.doc_id then e.to_doc_id
          else e.from_doc_id
        end
      end as next_doc_id
    ) n
    where w.hop < p_max_hops
      and not (n.next_doc_id = any(w.path))
  )
  select doc_id, hop, path from walk;
$$;

-- Shortest path (BFS) with a hop limit for safety.
create or replace function graph_shortest_path(
  p_campaign_id text,
  p_start_doc_id text,
  p_target_doc_id text,
  p_max_hops int default 6,
  p_direction text default 'both'
)
returns text[]
language sql
stable
as $$
  with recursive walk as (
    select
      p_start_doc_id as doc_id,
      array[p_start_doc_id] as path
    union all
    select
      next_doc_id,
      w.path || next_doc_id
    from walk w
    join edges e
      on e.campaign_id = p_campaign_id
     and (
       (p_direction = 'out' and e.from_doc_id = w.doc_id) or
       (p_direction = 'in' and e.to_doc_id = w.doc_id) or
       (p_direction = 'both' and (e.from_doc_id = w.doc_id or e.to_doc_id = w.doc_id))
     )
    cross join lateral (
      select case
        when p_direction = 'in' then e.from_doc_id
        when p_direction = 'out' then e.to_doc_id
        else case
          when e.from_doc_id = w.doc_id then e.to_doc_id
          else e.from_doc_id
        end
      end as next_doc_id
    ) n
    where array_length(w.path, 1) - 1 < p_max_hops
      and not (n.next_doc_id = any(w.path))
  )
  select path
  from walk
  where doc_id = p_target_doc_id
  order by array_length(path, 1)
  limit 1;
$$;
