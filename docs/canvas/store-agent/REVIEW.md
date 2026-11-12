# The independent review (for reviewers, not designers)

You did not draw these boards. Your job is to score them honestly against the agent app, the bar Kevin set. Be harsh: a board passes only if it is as good as the matching agent screen or better.

`SX` = `/tmp/claude-0/-home-user-omni-ware/11b18423-d239-564a-81b7-c16ec0e211d4/scratchpad/stx`

Read `SX/BRIEF.md` (the designers' rules), `SX/FACTS.md`, `/home/user/omni-ware/docs/audit/store/FLOW.md`, `/home/user/omni-ware/docs/audit/GLOSSARY.md`, `SX/LANGUAGE.md` (the agent parts) and `SX/root/project/IB01Handovers.dc.html` (the handover words both apps must use).

For each board of your area (`SX/root/project/<PREFIX>*.dc.html`):

1. Render it: `cd SX && NODE_PATH=/opt/node-tools/node_modules node tools/shot.cjs SX/review/shots/<area> <file>`. Look at the PNG at full size.
2. Pick the matching agent screen (the manifest's `agent_match`, or the closest one in `/home/user/omni-ware/docs/canvas/agent-ref/` or the approved Sales boards `/home/user/omni-ware/docs/canvas/sales-agent/boards/`). Render it too and look at both side by side.
3. Score **both** the Store board and the agent screen, 0–10, on:
   - **Consistency**: shared parts identical to the agent's (heads, sheets, rows, chips, tab bar, buttons, slide, empty states); Store-only parts in the same language;
   - **Steps**: fewest taps for the job; nothing to confirm that Undo could cover; prefilled;
   - **Glance**: what matters reads in a second; shows, doesn't tell; filled to the bottom; no wall of text;
   - **Polish**: premium, aligned, calm; no clipping, overlap, text under 11px, contrast under 4.5:1, a link in a link, a tap target under 44px;
   - **In step**: the same words, states and pushes as the app it hands work to or takes it from (IB01, GLOSSARY, decision rights, FACTS); no money on the yard's phone; trip not round; Cancelled; Check-in.
4. A board **passes** when every Store score is ≥ 8.5 **and** its total is ≥ the agent screen's total. Otherwise list exact fixes (what, where, why), each one small enough to apply.

Also check the area as a whole: the same part drawn the same way on every board (the sheet head, the rail, the handover strip), links pointing at real files in `SX/root/project/`, every state the BRIEF asks for present (default, pressed, disabled, sending, success, error, offline, empty).

Write `SX/review/<area>.json`:

```json
{"area": "...", "reviewer": "independent", "round": 1,
 "boards": [{"file": "PK01ToPack.dc.html", "agent_match": "…", "store": {"consistency": 0, "steps": 0, "glance": 0, "polish": 0, "in_step": 0, "total": 0},
   "agent": {"consistency": 0, "steps": 0, "glance": 0, "polish": 0, "in_step": 0, "total": 0}, "pass": true, "fixes": ["…"]}],
 "area_fixes": ["…"], "missing_states": ["…"]}
```

Do not edit any board. Reply with: how many pass, the worst three boards and why, and the area-wide fixes.
