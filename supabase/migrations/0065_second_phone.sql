-- A second phone number, for people who carry two.
--
-- One number per record was never quite true here: a trader with a
-- personal line and a shop line, or two networks against a bad signal,
-- is ordinary. The shop wrote the second one into the notes, where
-- nothing could dial it, match a WhatsApp message to it, or warn that
-- somebody was about to be entered twice under it.
--
-- A plain second column rather than an array: two is what people have,
-- the forms ask for exactly two, and a list would make every reader
-- handle a case the shop cannot enter.
alter table customers add column if not exists phone2 text;
alter table suppliers add column if not exists phone2 text;
