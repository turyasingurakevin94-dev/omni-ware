# Buyer audit log

The Buyer app (`buyer.html`, built from `src/apps/buyer`) improved in rounds, one aspect per round
(.claude/skills/omni-ware-round). Design: the canvas "Buyer — Agent language"; plans and results in `ROUND-<N>.md`.

## Round 1 · Core workflows (brief 12 Nov 2026) · BUY-01 … BUY-15

- Tested build: the new app, `buyer.html` LM 11 Nov 18:35 GMT. Plan and six boards approved ("now implement and push to main").
- Done: all 15. The two criticals: Save no longer leaves the app (one history entry per screen and per open sheet, a guard under
  Today); the Buyer never touched the client's price — its screens added up the cost and showed it as the order; now
  **Client pays** and **Cost** side by side.
- Decided for Kevin (he asked to proceed): no database change for BUY-02 (labels only; `round-1-check.sql` still to run);
  "Far from the list" at ±50%; "Take back the ask" built with no migration (0125 already lets the creator withdraw an open ask).
- Deferred: a push to Esther when an ask is taken back (one migration); the dimmed Today body under "Opening…" (not drawn);
  one rule for a moment not today across apps (glossary, "Not the same across apps yet").
- Shared-code change to watch: a toast's body no longer catches taps (only its Undo does), in Sales too.
- Re-check first: BUY-01 (the 5× Save loop), BUY-02 (Client pays unchanged after a new price), BUY-03 (each count on every screen).
