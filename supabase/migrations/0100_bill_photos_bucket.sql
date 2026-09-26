-- Photos of paper supplier bills, attached to a bill in the bill editor.
--
-- PRIVATE, unlike product-images (0005). A product photo is catalogue
-- material the shop wants seen; a supplier's bill carries its prices,
-- account numbers and the shop's own terms, and a public URL is readable by
-- anyone it ever leaks to. So the bucket is not public, nothing is fetched
-- by a public URL, and the app shows a photo through a short-lived signed
-- URL minted when the bill is opened.
--
-- Objects are stored as `{shop_id}/{uuid}.{ext}`, so the same
-- folder-scoping by shop_id that gates product images gates these: only a
-- member of the shop can read, add, replace or remove its bill photos.
insert into storage.buckets (id, name, public)
values ('bill-photos', 'bill-photos', false)
on conflict (id) do nothing;

create policy "shop members can view bill photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'bill-photos'
  and public.is_shop_member((storage.foldername(name))[1]::uuid)
);

create policy "shop members can upload bill photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'bill-photos'
  and public.is_shop_member((storage.foldername(name))[1]::uuid)
);

create policy "shop members can replace bill photos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'bill-photos'
  and public.is_shop_member((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'bill-photos'
  and public.is_shop_member((storage.foldername(name))[1]::uuid)
);

create policy "shop members can delete bill photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'bill-photos'
  and public.is_shop_member((storage.foldername(name))[1]::uuid)
);
