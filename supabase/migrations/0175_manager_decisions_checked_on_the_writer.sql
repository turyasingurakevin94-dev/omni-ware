-- 0175 The rebuild's fifth backend fix (docs/rebuild.md, "Backend fixes
-- decided"; docs/spec/01-order-journey.md §5 Q5 and Q12, Kevin 28 Oct
-- 2026): the Manager's decisions on an order are written only by whoever
-- holds the task, whichever app writes.
--
-- Four answers live in an order's payload. The Manager app writes them; the
-- database read them (the gate, the money hold, invoicing) but did not ask
-- who wrote them, except a changed priceReview object (0119's gate, step
-- 4a), which let anyone clear one (buyer.html:2912 does). Now, on every
-- write by a person:
--
--   creditCheck                  the answer to a credit hold (Release, Cash
--                                first, Hold): any change needs credit.release
--   pickSettle,                  a short pick settled (bill what went, or the
--   pickShortfallAckAt           full quantity): setting either needs
--                                pick.settle; clearing pickShortfallAckAt
--                                (a pick handed on starts again,
--                                manager.html resetPickingProgress) does not
--   creditNotes                  returns credited: any change needs
--                                credit_note.raise
--   items[].priceReview          the price decision: any change, clearing
--                                included, needs price.approve
--
-- One exception, as Kevin decided (Q12): a new cost that leaves the line
-- selling under its cost flags it for the Manager. When a write raises a
-- line's cost past the price the Manager decided, the database clears that
-- decision itself, whoever wrote, so the line waits for the Manager again
-- (0153 pushes them; 0171 keeps it off a bill). The Buyer app's own
-- clearing in that write is the same thing and passes.
--
-- Lines are matched by lineId, else by place, as 0119's step 4a matches
-- them. A new order may not carry any of these. Writes with no login are
-- not judged; the owner and admin hold every task (has_task).
--
-- Applied by hand, after 0174. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select tgname from pg_trigger where tgname = 'saved_quotes_ow_a_decisions';
--   select role, task from role_tasks where task in ('credit.release','pick.settle','credit_note.raise','price.approve') order by 2;
--
-- ROLLBACK:
--   drop trigger if exists saved_quotes_ow_a_decisions on saved_quotes;
--   drop function if exists saved_quotes_decisions();
-- ---------------------------------------------------------------------

create or replace function saved_quotes_decisions() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  np jsonb := coalesce(new.payload, '{}'::jsonb);
  op jsonb := '{}'::jsonb;
  oldi jsonb := '[]'::jsonb;
  it jsonb;
  ot jsonb;
  n int;
  nr jsonb;
  orv jsonb;
  presets jsonb;
begin
  if auth.uid() is null then return new; end if;
  -- An upsert of an order already here is judged by the update it becomes.
  if tg_op = 'INSERT' and exists (select 1 from saved_quotes x where x.shop_id = new.shop_id and x.id = new.id) then return new; end if;
  if tg_op = 'UPDATE' then
    op := coalesce(old.payload, '{}'::jsonb);
    if jsonb_typeof(op -> 'items') = 'array' then oldi := op -> 'items'; end if;
  end if;

  -- Q5: the credit answer, the short-pick settle, the credit notes.
  if nullif(np -> 'creditCheck', 'null'::jsonb) is distinct from nullif(op -> 'creditCheck', 'null'::jsonb)
     and not has_task(new.shop_id, 'credit.release') then
    raise exception 'Releasing an order held for credit is the Manager''s (credit.release).' using errcode = '42501';
  end if;
  if (nullif(np -> 'pickSettle', 'null'::jsonb) is distinct from nullif(op -> 'pickSettle', 'null'::jsonb)
      or (nullif(np -> 'pickShortfallAckAt', 'null'::jsonb) is not null
          and np -> 'pickShortfallAckAt' is distinct from op -> 'pickShortfallAckAt'))
     and not has_task(new.shop_id, 'pick.settle') then
    raise exception 'Settling a short pick is the Manager''s (pick.settle).' using errcode = '42501';
  end if;
  if coalesce(nullif(np -> 'creditNotes', 'null'::jsonb), '[]'::jsonb) is distinct from coalesce(nullif(op -> 'creditNotes', 'null'::jsonb), '[]'::jsonb)
     and not has_task(new.shop_id, 'credit_note.raise') then
    raise exception 'A credit note is the Manager''s to raise (credit_note.raise).' using errcode = '42501';
  end if;

  -- Q12: the price decision on each line.
  if jsonb_typeof(np -> 'items') = 'array' then
    presets := coalesce((select a.presets from app_settings a where a.shop_id = new.shop_id), '{}'::jsonb);
    n := 0;
    for it in select e from jsonb_array_elements(np -> 'items') e loop
      n := n + 1;
      continue when jsonb_typeof(it) <> 'object';
      select e into ot from jsonb_array_elements(oldi) with ordinality as x(e, k)
       where (it ? 'lineId' and e ->> 'lineId' = it ->> 'lineId') or (not it ? 'lineId' and k = n)
       limit 1;
      nr := nullif(it -> 'priceReview', 'null'::jsonb);
      orv := case when jsonb_typeof(ot) = 'object' then nullif(ot -> 'priceReview', 'null'::jsonb) end;
      -- A cost raised past the price decided: the decision falls away, and the line waits for the Manager.
      if orv is not null and coalesce(ow_num(it ->> 'price'), 0) > coalesce(ow_num(ot ->> 'price'), 0)
         and ow_line_sells_under_cost(new.shop_id, it, presets) then
        if nr is not null then new.payload := jsonb_set(new.payload, array['items', (n - 1)::text, 'priceReview'], 'null'::jsonb); end if;
        continue;
      end if;
      continue when nr is not distinct from orv;
      if not has_task(new.shop_id, 'price.approve') then
        raise exception 'A price decision is the Manager''s (price.approve).' using errcode = '42501';
      end if;
    end loop;
  end if;
  return new;
end $$;
-- Named to run before saved_quotes_ow_checking_gate (BEFORE triggers fire by name).
drop trigger if exists saved_quotes_ow_a_decisions on saved_quotes;
create trigger saved_quotes_ow_a_decisions before insert or update on saved_quotes
  for each row execute function saved_quotes_decisions();
