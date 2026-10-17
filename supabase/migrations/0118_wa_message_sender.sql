-- Who on the team sent each WhatsApp message.
--
-- A chat is answered by whoever is at the counter: the owner from the
-- desk, a salesperson from the Sales app. Reading a thread, the next
-- person needs to know who told the customer what -- "Grace said the
-- sheets come Friday" -- without asking around.
--
-- STAMPED BY THE SERVER, NEVER THE BROWSER. wa-send is the only road a
-- reply takes, and it already holds the caller's own JWT to check
-- membership. It writes the caller's user id and, beside it, the name
-- the team knows them by (their staff row, else "Owner"), so the name
-- reads the same in every app even after a staff row is renamed or gone.
--
-- What is NOT stamped, and is told apart without a column: a message
-- typed on the shop's own phone arrives as a webhook echo carrying
-- Meta's message object; an automatic reply carries payload.auto.
--
-- No backfill: what was sent before this column existed is not guessed.
--
-- SAFE TO RUN TWICE. wa-send writes without the columns if they are
-- missing, so deploying the function before running this loses nothing.

alter table wa_messages add column if not exists sent_by uuid references auth.users(id) on delete set null;
alter table wa_messages add column if not exists sent_by_name text;
