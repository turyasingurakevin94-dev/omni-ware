-- A photo of the thing being sourced.
--
-- Most of what walks into this shop is described by a picture rather than
-- by a name. Somebody sends a WhatsApp photo of a hinge and asks whether
-- it can be got; "makitah" typed into a box is not that photo, and the
-- person who does the research a week later is working from the word.
--
-- It is also the product's photo. A lead that graduates already knows
-- what the thing looks like, so the product it becomes should not arrive
-- blank and need the same picture found again.
--
-- A URL into the `product-images` bucket, exactly as products.image and
-- product_variants' images are -- never base64 in the row. The media
-- library's usage index counts a lead as a user of its photo, so the
-- library will not let one be deleted out from under a lead that is
-- still pointing at it.
alter table sourcing_leads
  add column if not exists image text;
