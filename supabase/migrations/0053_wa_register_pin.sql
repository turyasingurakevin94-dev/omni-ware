-- Cloud API registration sets a two-step verification PIN on the number,
-- and that PIN is needed again for any future re-registration. Losing it
-- means a multi-day 2FA-reset wait with the number dead in the water --
-- so the PIN wa-send mints is kept beside the number it belongs to.
alter table wa_numbers add column pin text;
