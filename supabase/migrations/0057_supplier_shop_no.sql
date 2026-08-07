-- Shop / stall number, separate from location: "Ntinda" says which part
-- of town the pickup run goes to; "B12" says which door inside the
-- arcade the worker actually knocks on. One clusters the run, the other
-- finds the supplier -- storing them in one field broke both jobs.
alter table suppliers add column if not exists shop_no text;
