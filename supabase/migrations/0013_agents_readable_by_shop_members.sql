-- Extends 0012: shop members (not just admins) need read access to
-- `agents`, not just write access for admins. autoAssignNextOrder() and
-- stepSavedQuoteStatus() (shared-worker.js and index.html, running in the
-- admin app, the admin's worker tab, and the standalone worker app) need
-- to check an agent's payment_term before letting a draft order be picked
-- up for preparing ("pay before we prepare" only means something if
-- something actually checks it) -- a plain worker session doesn't match
-- either existing policy on this table (admin-only write, or "this row's
-- user_id is literally me" for an agent reading their own row).
--
-- Read-only, and not a new information exposure: an agent's name is
-- already shown on every order card they originate (client_name /
-- payload.client, see 0012) to any shop member, so seeing that same name
-- plus phone/email/payment_term via this table isn't a new leak -- it's
-- the same trust boundary as suppliers/customers/staff, which are already
-- blanket-visible to shop members.
create policy "shop members view agents" on agents
  for select using (is_shop_member(shop_id));
