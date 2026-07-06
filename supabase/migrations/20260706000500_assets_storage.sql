-- Private campaign asset Storage bucket and policies.
-- Run after supabase/app-schema.sql so the assets table exists.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'campaign-assets',
  'campaign-assets',
  false,
  52428800,
  array[
    'image/avif',
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/svg+xml',
    'image/webp',
    'application/pdf',
    'audio/mpeg',
    'audio/wav',
    'video/mp4',
    'video/webm'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create unique index if not exists assets_storage_path_idx on assets (storage_path);

drop policy if exists campaign_assets_select_owned on storage.objects;
create policy campaign_assets_select_owned on storage.objects
  for select
  using (
    bucket_id = 'campaign-assets'
    and (
      public.is_campaign_owner(split_part(storage.objects.name, '/', 1))
      or exists (
        select 1
        from public.assets a
        left join public.docs d on d.id = a.doc_id
        left join public.folders f on f.id = d.folder_id
        where a.storage_path = storage.objects.name
          and public.is_campaign_member(a.campaign_id)
          and (d.shared = true or f.shared = true)
      )
    )
  );

drop policy if exists campaign_assets_insert_owned on storage.objects;
create policy campaign_assets_insert_owned on storage.objects
  for insert
  with check (
    bucket_id = 'campaign-assets'
    and public.is_campaign_owner(split_part(storage.objects.name, '/', 1))
  );

drop policy if exists campaign_assets_update_owned on storage.objects;
create policy campaign_assets_update_owned on storage.objects
  for update
  using (
    bucket_id = 'campaign-assets'
    and public.is_campaign_owner(split_part(storage.objects.name, '/', 1))
  )
  with check (
    bucket_id = 'campaign-assets'
    and public.is_campaign_owner(split_part(storage.objects.name, '/', 1))
  );

drop policy if exists campaign_assets_delete_owned on storage.objects;
create policy campaign_assets_delete_owned on storage.objects
  for delete
  using (
    bucket_id = 'campaign-assets'
    and public.is_campaign_owner(split_part(storage.objects.name, '/', 1))
  );
