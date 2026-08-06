-- Phase 3 configuration: the Meta catalog wired to the shop's WhatsApp
-- number, and the WABA id beside it.
--
-- catalog_id: the Commerce Manager catalog the products sync into.
-- Created by the user in Commerce Manager (creating one by API needs the
-- business_management permission the shop's token deliberately lacks)
-- and pasted into the connection settings, like phone_number_id was.
--
-- waba_id: learned the hard way in phase 2 -- the WABA-level app
-- subscription is the invisible link that silently dies when an account
-- is deleted and remade, and repairing it needed the id typed in from a
-- dashboard URL. Stored so wa-send's self-diagnosis can check that link
-- without archaeology.
alter table wa_numbers add column catalog_id text;
alter table wa_numbers add column waba_id text;
