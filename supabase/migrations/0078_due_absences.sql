-- Days a person missed, and what they cost them.
--
-- A month of wages was raised at the full rate whether or not the person
-- turned up. A monthly-salaried worker who missed three days was paid
-- exactly as much as one who missed none, and the shop's only recourse
-- was to hand over a different figure from the one the screen said and
-- leave the difference explained nowhere -- so the payroll, the cash
-- book and what the worker actually received all disagreed, and nothing
-- recorded why.
--
-- AN ABSENCE IS A DATED ROW, NOT A COUNT. "Four days" cannot be shown to
-- somebody who queries their pay, cannot tell paid sick leave from
-- unpaid absence, and cannot stop the same day being entered twice by
-- two people going through the book on payday. {date, reason, paid}
-- does all three, and the date is the key that makes the third work.
--
-- NO NEW TABLE AND NO NEW COLUMN. An absence has no life of its own: it
-- exists inside exactly one month of exactly one person's wages, is only
-- ever read with that due, and dies with it. That is the same shape as
-- `payments`, which has lived in this payload since 0046, and it keeps
-- the rule that raising a month is one row -- which is what makes
-- generation idempotent.
--
-- THIS MIGRATION CHANGES NO DATA AND NO CONSTRAINT. jsonb needs no
-- altering to hold two more keys. It exists so the payload's shape is
-- written down where the next person reads the schema, rather than only
-- in the client that happens to write it. Dues raised before today come
-- back with neither key; the app reads a missing `absences` as none, and
-- resolves a missing `basis` from the staff member.

comment on column dues.payload is
$$Sidecar data for one due. Keys:

  payments   [{date, amount, account, cashTxnId}]
             Each payment made against this due, carrying the cash-book
             entry it was written as, so a payment can be reconciled and
             a reversal can find and remove its entry. Since 0046.

  absences   [{date, reason, paid}]  -- wages only
             Days the person missed in this month. `date` is YYYY-MM-DD
             and must fall inside `period`; it is unique within the list,
             so the same day cannot be docked twice by two people.
             `paid` true records the day but deducts nothing -- paid sick
             leave is still a day the shop wants on record.

             ONLY A MONTHLY DUE DEDUCTS. A daily-paid month is costed
             from `days`, the days somebody COUNTED, so the days not
             worked were never in the figure -- charging them again here
             would take the money off twice. Their absences are kept as
             the record of why the month was short, and cost nothing.

             A monthly deduction is rate / 26 per unpaid day, capped at
             the whole salary. 26 is a constant -- six days a week -- and
             deliberately not the length of the calendar month: dividing
             by the real number would make one missed day in February
             cost more than the same day in July.

  basis      'monthly' | 'daily'  -- wages only
             How this month is worked out, SNAPSHOT when the due was
             raised, for the same reason `rate` is: moving somebody off a
             day rate and onto a salary in September must not change what
             August cost or how August's absences were priced. Absent on
             dues raised before this existed; the app falls back to the
             staff member's current basis, then to monthly.

`amount` stays the NET cost of the month -- what the shop owes after any
deduction -- so `paid`, the balance, the reminders and the balance sheet
all keep reading one figure and cannot disagree about what is owed. The
gross is still on the row as `rate`, so the screen can show what the
month started as.$$;
