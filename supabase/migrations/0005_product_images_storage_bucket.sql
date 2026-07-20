-- Product photos move from base64-in-the-products-table to Supabase
-- Storage: the `image` column now holds a public Storage URL instead of a
-- multi-hundred-KB data: URI, so it stops eating into Postgres storage as
-- more product photos get added. The column stays `text` -- a URL fits
-- fine, no schema change needed there.
--
-- Bucket is public (product photos aren't sensitive data) so the app can
-- just <img src> the stored URL directly, without minting a signed URL on
-- every render. Objects are stored as `{shop_id}/{uuid}.{ext}`, so
-- folder-scoping by shop_id lets the same is_shop_member() helper used on
-- the app tables gate access here too.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "shop members can view product images"
on storage.objects for select
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_shop_member((storage.foldername(name))[1]::uuid)
);

create policy "shop members can upload product images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and public.is_shop_member((storage.foldername(name))[1]::uuid)
);

create policy "shop members can replace product images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_shop_member((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'product-images'
  and public.is_shop_member((storage.foldername(name))[1]::uuid)
);

create policy "shop members can delete product images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_shop_member((storage.foldername(name))[1]::uuid)
);
