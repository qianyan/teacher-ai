-- Public bucket for report photo URLs in exported HTML.
-- Uploads use signed URLs issued by the service role (see /api/blob/report-upload).

insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', true)
on conflict (id) do update
set public = excluded.public;

create policy "Public read report photos"
on storage.objects
for select
to public
using (bucket_id = 'report-photos');
