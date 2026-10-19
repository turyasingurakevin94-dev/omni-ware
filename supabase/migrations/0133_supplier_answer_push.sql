-- 0133 — a supplier's answer from the supplier app pushes the Buyer.
--
-- A supplier answers an order in supplier.html; supplier-portal writes the
-- row into supplier_answers (0132). Until now nobody was told: the answer
-- sat there until someone opened the console. docs/decision-rights.md
-- gives recording a supplier's yes or out to the Buyer (supplier.confirm)
-- and says every handoff that waits on someone sends that person a push.
-- The Buyer app folds the answer into the order on its next read; this
-- push is what makes it read now.
--
-- Safe to run again. Needs 0120 (ow_push) and 0132 (supplier_answers).
--
-- Rollback:
--   drop trigger if exists supplier_answers_ow_push on supplier_answers;
--   drop function if exists ow_push_supplier_answer();

create or replace function ow_push_supplier_answer()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  sup text;
  said text;
begin
  begin
    select s.name into sup from suppliers s where s.shop_id = new.shop_id and s.id = new.supplier_id;
    said := case new.state
      when 'confirmed' then 'has everything'
      when 'short' then 'is short on some lines'
      when 'none' then 'has none of it'
      else 'answered' end;
    perform ow_push(new.shop_id, 'supplier.answered',
      coalesce(sup, 'A supplier') || ' answered',
      'Order #' || new.order_id || ' — ' || said
        || coalesce(': “' || nullif(left(new.note, 120), '') || '”', ''),
      null, 'supplier.confirm', null,
      jsonb_build_object('table', 'saved_quotes', 'id', new.order_id, 'supplier', new.supplier_id),
      'supanswer:' || new.id);
  exception when others then
    raise notice 'push (supplier answer %): % (%)', new.id, sqlerrm, sqlstate;
  end;
  return null;
end $$;

drop trigger if exists supplier_answers_ow_push on supplier_answers;
create trigger supplier_answers_ow_push
  after insert on supplier_answers
  for each row execute function ow_push_supplier_answer();
