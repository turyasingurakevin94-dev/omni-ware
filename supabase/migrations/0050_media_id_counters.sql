-- Counters for the media library's client-assigned ids.
--
-- Same reasoning as 0046: every kind ROW_ID_KINDS allocates has to have
-- its counter seeded by the migration that created its table -- a kind
-- with no counter row would be created on first use starting from 0 and
-- hand out ids that already exist on another device. (The row-id test
-- sweeps the migrations for exactly this, and this file is what it
-- found missing from 0049.)
--
-- Seeded at 0, not max(id): both tables are created empty by 0049, and
-- next_row_id_blocks takes the client's floor anyway, so a shop that
-- somehow already has rows can never be rewound below them.

insert into entity_id_counters (shop_id, kind, last_issued)
select id, 'row:media', 0 from shops
on conflict (shop_id, kind) do nothing;

insert into entity_id_counters (shop_id, kind, last_issued)
select id, 'row:media_folder', 0 from shops
on conflict (shop_id, kind) do nothing;
