-- The auto-quote switch. Off by default: a shop OPTS IN to the system
-- answering price questions in its name -- and even opted in, the
-- webhook only ever auto-answers an EXACT product match against the
-- published catalog. Partial matches and ties stay human work.
alter table wa_numbers add column auto_quote boolean not null default false;
