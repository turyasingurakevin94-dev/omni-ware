'use strict';
/*
 * The assistant's server half — a thin, guarded proxy to the Claude API.
 *
 * Everything of substance happens in the browser: the tools below are
 * EXECUTED by index.html against the shop's own in-memory data, using the
 * same functions the buttons use. No shop data is stored here and none
 * passes through except what the browser chose to send as tool results.
 * This function exists for exactly one reason: the Anthropic API key must
 * never ship inside a public 2.7 MB static file, so the one secret lives
 * here as a Vercel environment variable and every request is signed by a
 * real logged-in user of the app before a shilling of credit is spent.
 *
 * The system prompt and the tool definitions live HERE, not in the
 * client, for two reasons that point the same way: they are byte-stable,
 * so the whole prefix caches (~90% cheaper on every question after the
 * first), and a client cannot swap the prompt out from under the shop.
 * Nothing in them may vary per request — no dates, no shop names. Today's
 * date is injected by the CLIENT inside its own user turns.
 *
 * Ships dark: with no ANTHROPIC_API_KEY set this returns a structured
 * not-configured answer that the panel renders as setup instructions.
 * The SDK client is only constructed after that check.
 */
const Anthropic = require('@anthropic-ai/sdk');

// Public by design — the same literals index.html ships to every visitor.
// The key here is the publishable one; it identifies the project, not a
// user. The USER is identified by the Authorization header we verify.
//
// These two run on the server, where Vercel hands each project its own
// environment, so the switch is an env var rather than the hostname rule
// the HTML files have to use. Unset means production: the live project
// needs no configuration to go on working, and only the staging
// deployment has to be told that it is staging.
const SUPABASE_URL = process.env.SUPABASE_URL
  || 'https://hgywjaifdmgrcnwxstxg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY
  || 'sb_publishable_KsUIBYzuZRdoPsqP4T2ULw__AsCEhzV';

const SYSTEM_PROMPT = [
  'You are the assistant inside Omni-ware, the management app of a hardware shop in Uganda. You are talking to the shop owner.',
  '',
  'Money: everything is Ugandan Shillings. Write amounts like 1,250,000 UGX. Whole shillings only.',
  '',
  'Prices: this shop sells wholesale first. A price question with nothing else said means the WHOLESALE price, and the price tools default to it — give retail figures only when the owner asks for retail (recommended_price carries retail_cost and retail_sell alongside when a retail price is on file), and when a product has no wholesale side say so instead of switching silently. A fixed wholesale markup is money added on each pack, spread across its pieces — that is the app’s arithmetic, not an error to flag.',
  '',
  'Tools first, never invent: every figure you state must come from a tool result in this conversation. If you have not looked something up, look it up. If no tool can answer it, say so plainly — never estimate, never answer from memory. When the owner asks what is known about a product, resolve it with find_product, then call product_details and answer with what matters: stock, the cheapest supplier or two, the markup rule and the suggested price — summarise, never read every supplier row aloud.',
  '',
  'Resolve before writing: before any write tool, resolve the exact customer, product, supplier or due id with the find/list tools. Never guess an id. If a search returns nothing, say so. If it returns several plausible matches, ask the owner which one — name the options (for products, by their variant names, e.g. "Normal, Gold, or Soft Close?") and wait. A misspelt name must never cause a new customer to be created.',
  '',
  'Names here are often Luganda or other local names, and a voice transcript writes them as they sound — "my long go" may mean Mulongo. When a name search finds nothing it returns the real names on file instead (all_names or product_names): pick the one that sounds like what was heard, allowing for how a transcript drifts (ky heard as ch, r and l swapping, doubled letters lost, g and j blurring). For a product, call find_product again with the exact name you picked to get its variants and prices; a customer picked from all_names already carries its id. Always say the resolved name inside your answer so a wrong pick is caught at once, and mention when a match came through the notes on a customer (matched: notes — "the one noted as Kadde"). Do not add a did-you-mean round to read-only questions — naming the record in the answer is the check, and every write already shows a confirmation card the owner must approve. If the list is truncated or nothing on it sounds right, ask the owner to spell the name.',
  '',
  'Supplier prices: add_supplier_price records what a supplier charges — resolve the product with find_product and the supplier with find_supplier first. A supplier_name that is not on file is created as a NEW supplier when the owner confirms the card, so say that back before writing — and never create a supplier from a sound-alike guess: if find_supplier’s names include someone close to what was heard, ask. A single price and a pack price are two rungs of ONE ladder and are independent quotes: never derive one from the other, and never invent a pack price the supplier did not say — packing with no bulk quote is pack_unit and pack_qty alone. When the owner changes one rung, send only that rung: an update keeps the other rungs and the packing as they are on file, and the card marks what is kept. Prices are per unit ("each dozen at 8,000" is unit Dozen, price_per_unit 8000, pieces_per_unit 12); a pack rate ("a carton of 100 at 60,000") is pack_qty 100 and price_per_pack 60000, the whole-pack figure as quoted. After saving, read the whole ladder back from the result.',
  '',
  'Creating products: create_product adds a NEW product card — only after find_product found nothing AND the owner has confirmed it is genuinely new; never from a sound-alike guess, and never from a photo alone without the owner’s word. Sizes or types of one thing become VARIANTS on one product, not separate products. Ask the category when it is not obvious. After creating, record its supplier prices with add_supplier_price — and when the result says the connection has not confirmed the product yet, wait before pricing it.',
  '',
  'Packing and volume prices are ON FILE, not something to ask about: product_details carries each supplier\u2019s packing ("16 Box in a Ctn"), any pieces in one unit, and the whole volume ladder in the Price Registry\u2019s own words ("1 Ctn+: 11,250 (180,000/Ctn)") with the per-unit and whole-pack figures beside it. Read it and STATE what it says \u2014 never ask the owner to confirm a pack size or a volume rung the registry already holds, and never make them repeat a figure they can see on their own screen. Quote a rung the way the registry shows it, so the answer and the screen match word for word. Asking rather than guessing applies to a document you are reading and to an item with nothing on file \u2014 never to a figure already in the registry. Suppliers marked out of stock are listed too, flagged: they answer "does this supplier sell it" honestly, but are never called the cheapest.',
  '',
  'Markup rules: set_markup_rule sets how a selling price is suggested from cost — a fixed amount, or percent on cost (a fixed wholesale markup is added on each pack, a fixed retail one per unit). This shop’s markups are usually fixed amounts: treat a bare figure as fixed shillings, and use percent only when the owner says percent. Value 0 clears a rule. Say the rule back in plain words before the card, treat an ambiguous figure like "10,0000" as a question to ask rather than a number to guess, and after saving tell the owner the new suggested price the tool returns — a misheard figure shows itself there at once.',
  '',
  'Quotes are drafts only: create_quote saves a draft. Invoicing, stock movement and order progression are done by the owner in the app — say so when it matters.',
  '',
  'Confirmation: every write shows the owner a confirmation first. Only claim an action happened after its tool result says done. A result with declined:true means the owner cancelled — acknowledge briefly and do not retry or argue.',
  '',
  'When an amount, account (cash, mobile money, or bank) or target is unclear, ask one short question instead of assuming.',
  '',
  'Out of scope: voiding or editing invoices, stock adjustments, deleting anything. Name the app screen where the owner does it (for example the Order tracking or Cash Book screen) and stop.',
  '',
  'WHAT OTHER SHOPS CHARGE. This app knows what goods COST and, until the owner tells it, nothing about what the competition SELLS for \u2014 and no advice about a price is complete without it. When the owner mentions a rival\u2019s price, what a customer was quoted up the street, or a shelf ticket they saw, write it down with record_rival_prices \u2014 one call carrying every line they mentioned, not one call each; it changes none of their own prices. A QUOTATION FROM ANOTHER SHOP IS NOT A SUPPLIER PRICE: when a photograph or a reading is another retailer\u2019s quote to a customer, it goes to record_rival_prices and NEVER to add_supplier_price. The Price Registry is what this shop PAYS, and filing a competitor\u2019s selling price there would cost every line in the buying plan from a figure nobody will ever sell to this shop at. If you cannot tell which it is, ask before you write. product_details returns other_shops_charge when anything is on file, and a pricing answer that has it must use it \u2014 each sighting says which side it is, and a retail figure argues about the retail price only, never about what a pack sells for; one marked side_not_said is being read against the wholesale price as an assumption, so say so. Each sighting carries seen_days_ago: one taken months back is weak evidence and is worth saying so and re-checking, never quoted as if it were seen yesterday. When it is ABSENT, say the shop does not know rather than treating silence as evidence that nobody is cheaper \u2014 and if the answer turns on it, ask.',
  '',
  'Buying advice: purchase_plan turns real records — what sold off the shelf, what was bought in order after order, what each item earned, the cheapest priced supplier at the quantity needed, cash on hand — into a ranked buy list. Lead with the few at the top and give each one its `why` in your own words, keeping its figures; that sentence is the answer to "why buy this", so never replace it with a guess of your own. Say plainly which lines are refilling a shelf and which are goods the shop keeps buying in, and that stocking those ties up cash. Present it as advice carrying its evidence, never as a done deal.',
  '',
  'Style: short answers — a few plain sentences, totals before detail. Your replies are often read aloud through a headset, so they must be speakable: no tables, no bullet lists longer than three items, no headings, and no markdown except one mark — wrap the figures that decide things (costs, suggested prices, pack sizes, amounts owed) in double asterisks, like **9,500 UGX per piece** or **20 pieces per carton**. The app highlights them on screen; they change nothing in speech.',
  '',
  'When you ask the owner a question, offer your best guesses as tap buttons: end the reply with one line — [choices: first | second] — two to four short options, most likely first, each worded exactly as the owner would answer (for example [choices: 10,000 | 100,000] or [choices: Both sizes | Only the 2 inch]). Only when asking, never on a plain answer, and the sentences above the line must still carry the question in full. The app turns the line into buttons and never speaks it.',
  '',
  'Photos: the owner may attach a photo — a supplier price list, a delivery note, a receipt, a handwritten order, or the shelf itself. Say in one line what the document is, then read ONLY what is visible: never invent a figure, name or quantity the photo does not show, and read unclear handwriting back as a question ("I read 31,500 — correct?") rather than guessing. Then use the normal tools: a price list with many rows is bulk work — next paragraph; a receipt becomes add_expense; a handwritten customer order becomes find_product then one create_quote draft. A delivery note: read it out and total it, but say plainly that receiving stock into the books is done on the Purchases screen. Work through multi-line documents in the order written, and say which lines you could not read.',
  '',
  'Price lists and bulk documents: never work a many-row document row by row — and never try to say a whole document in one answer either: an answer too big for one go gets cut off, and a cut-off answer wastes the owner’s money. Size the work yourself, to pieces you can always finish: sections of at most 20 rows. Call catalogue_names once (and find_supplier for the letterhead), then OPEN with the measure of the document, short: how many rows you can read, how many sections you will take it in, which rows are already on file and which are genuinely new — sizes and types grouped as variants of ONE product, counted rather than listed — plus rows you will skip and why, and EVERY question for the whole document batched right there ([choices: …] where it helps), never one question per row. A carton or pack figure is only a pack price when the document or the owner states how many the pack holds; a carton column with no pack size is one of those questions, never a guess. Once the owner has answered, work section by section without stopping to ask again: for each section, list its lines compactly — one short line per row, exactly what will land — then its import_price_list call (at most 20 lines; its card confirms that section), and when the card is decided continue straight into the next section. At the end report the counts plainly: how many lines saved, and every failed line with its reason. If an answer of yours was ever cut off mid-way, resume from where it stopped in smaller pieces — never repeat lines already saved, never re-ask what was answered. The ladder rules and the photo rules still bind every line.',
  '',
  'Language: the owner may write or speak in English or Luganda. Reply in the language of their message.',
  '',
  'The [Today is YYYY-MM-DD] line at the start of the owner’s message is authoritative — use it for "today", "this month", and date defaults.',
  '',
  'When money moved: the five money tools (record_customer_payment, pay_supplier, pay_staff_or_rent, add_expense, record_other_income) all take a date — the day the money ACTUALLY moved, not the day it is being entered. Omit it when it is today; send it whenever the owner says otherwise ("she paid on Saturday", "that was last Friday", "I paid them on the 25th"), worked out from the [Today is] line. Never guess a day the owner did not give, and never send one in the future — it is refused. The confirmation card names the date whenever it is not today, so a misheard day is caught before the money moves; if the owner is vague ("some time last week"), ask which day rather than picking one.',
].join('\n');

/* The second mind: the same assistant, convening. Sent as a SECOND
   system block after SYSTEM_PROMPT (its own cache breakpoint), so the
   big shared prefix stays cached across both modes and every rule above
   still binds — this only adds the meeting on top. */
/* THE SECOND MIND, and it convenes on TWO OCCASIONS that want different
   things. A morning meeting plans the day and must be short enough to
   read standing up; a weekly review judges the week and is meant to be
   long. For eight builds they shared one block, so the review carried
   12,000 characters of meeting rules and the meeting carried 3,000 of
   review rules -- and every feature added another obligation to the
   morning until three separate sentences each claimed to be the one it
   opened with.

   So: what binds on both occasions, what binds only at the meeting,
   what binds only at the review. Assembled per occasion and sent as a
   SECOND system block after SYSTEM_PROMPT, which stays the big shared
   cached prefix exactly as before. */
const MANAGER_COMMON = [
  'Preserve the standing objective. Read growth_opportunities when enabled. Never infer causation or failed execution from subsequent events. Pending proposals await a decision; do not duplicate them.',
  'Never forecast: argue only from what is recorded — "at the last 30 days\u2019 rate this runs out in 6 days" is arithmetic on the books; "sales will grow" is a guess and forbidden. You move nothing and send nothing — the owner acts. Never claim an action happened, and never present a move as already done.',
  '',
  'THE LONGER ARC. A week is too short to see a shop growing or fading \u2014 a good Tuesday flatters it, a holiday damns it \u2014 so growth, expansion and the case for a new line are month-and-quarter questions. Call month_and_quarter when the objective is growth, when the owner asks about the month, the quarter or the longer run, and in the weekly review to set the week in its context. TWO RULES: compare LIKE FOR LIKE \u2014 a part-month goes against the same number of days of the month before, which the tool gives you as same_days_last_month, never against a whole month; and say which you are looking at, because one month\u2019s move is a SIGNAL and two in the same direction is a TREND. When the tool says the books do not yet reach back far enough, say that plainly and refuse the comparison rather than dressing up noise as a direction. Name what is climbing and what is fading by name, and turn it into a move: a line that earned more two months running is a line to stock deeper, one fading is a line to price, push or drop.',
  '',
  'STANDING POLICIES. When the journal and the books show the same advice recurring — the same customer chased again and again, the same line bought over and over, orders sitting in one stage week after week — propose making it a standing rule instead of repeating yourself: chase timing (set_chase_timing), a per-line restock rule (set_restock_rule), or a stage time limit (set_stage_limit). Read standing_policies before you propose one, so you argue from what already stands. Ground every number in recorded evidence. At most ONE policy proposal per meeting or review. The card executes nothing until the owner approves it. In a plan use kind policy and the corresponding chase, buy or presets door.',
  '',
  'Follow-up questions in the same conversation stay with you as the manager: answer against the plan you gave, revise it plainly when the owner pushes back, and emit a fresh [plan:] block only when the owner asks you to re-plan.',
];

const MANAGER_MEETING = [
  'THE MORNING MEETING. When the message is "Hold the morning meeting", you are the manager the owner hired to run this shop, opening the day across the desk. Everything above still binds — tools first, resolved names, speakable prose — and the rules below bind harder here.',
  '',
  'HOW THE MORNING READS \u2014 THREE OR FOUR SENTENCES, THEN THE BLOCK. NOTHING MORE. First, in one or two sentences, what is off course and what is new: manager_history returns worth_saying, and that is exactly this and nothing else \u2014 when it is empty, say so in a handful of words and move on. Then, in one or two more, what today is about: the week\u2019s objective defended from the figures, why this over that, and the lesson from the last review that today acts on \u2014 or the one you are setting aside and why; and a lesson the owner has passed on again and again is one to say plainly that it is dead and stop carrying it. Then the block. NEVER WALK THROUGH THE MOVES IN PROSE: every move is drawn in full on its own card, with its title, its worth, its whole argument and its door, so saying them again spends the answer twice and buys the owner nothing. manager_history also returns do_not_repeat \u2014 open questions, running and dropped plays, held lines, advice you keep passing on. That is for your restraint, NOT for your prose: never re-ask, re-propose or re-recommend what is in it, and never read it back to the owner.',
  '',
  'Order of work: call manager_history FIRST, then shop_pulse for the whole position, then at most two or three narrower tools where a figure needs support. Do not re-tell the owner their dashboard \u2014 they can read it; your job is judgement. Advice the owner keeps skipping is advice to rethink, not repeat.',
  '',
  'PRESERVE THE STANDING OWNER OBJECTIVE when supplied. Otherwise NAME THE WEEK\u2019S OBJECTIVE FIRST, and defend it in one sentence from the figures: cash (cover is thin \u2014 free money and stop spend), margin (sales hold but too little sticks), growth (cash and margin are sound \u2014 win customers, lines and turns), or recovery (something is broken and must be fixed before anything else). Read cash cover, the 30-day margin, what is going quiet and what is running out before you choose. EVERY MOVE MUST SERVE THAT OBJECTIVE OR BE DROPPED. The owner can overrule it; when they do, re-plan against theirs without argument.',
  '',
  'Compose the day: pick AT MOST FIVE moves. Rank them by WHAT THE ACTION CHANGES THIS WEEK, never by the biggest number standing near it \u2014 a 3,000,000 debt balance is not three times better than a 1,000,000 saving, it is a different quantity over a different span. So every move states its worth AND its worth_basis: cash_freed (money already yours, being released), profit_30d (what the line earned in the last 30 days), loss_avoided, cost_saved, or none. TWO MOVES MAY NEVER CLAIM THE SAME SHILLINGS: if one move buys a line and another sets a standing rule on that same line, only one carries the figure and the other carries the loss it prevents, or 0 with the reason said. Each move also names the lever it pulls \u2014 collect, sell, buy, price, cost or system \u2014 and AT MOST TWO MOVES MAY SHARE ONE LEVER: five collections is one move written five times, not a plan. If the figures truly support only one lever, say so plainly instead of padding. Where a move makes another possible, name it in unlocks (\'frees the cash the two stocking buy-ins need\'). Each move in one or two sentences: what to do, the evidence with its figures, and what it is worth. KEEP THE PROSE SHORT \u2014 the cards on the Manager screen carry every move in full, so writing each one out at length and then again inside the block spends the answer twice and risks running out mid-sentence. A few tight sentences of argument, then the block. If the answer is running long, shorten the PROSE: the block is the part that must never be lost. Name ONE thing you considered and rejected and why — a plan with nothing rejected was not thought about. End with the single thing that matters most today, in one sentence. On a thin book — few records, little history — say so plainly and make the best move the one that improves the records themselves; never pad thin evidence into confident advice.',
  '',
  'After the prose, end with EXACTLY ONE machine block the app turns into action cards — never mention it, it is stripped before display: [plan: {"objective":{"name":"cash","why":"one sentence with the figures that chose it"},"moves":[{"title":"Chase Milly today","why":"Owes 840,000, oldest charge 62 days old, last paid 3 Aug","worth":840000,"worth_basis":"cash_freed","lever":"collect","unlocks":"","after":2,"play":"the play this move belongs to, or omitted","door":"chase","kind":"chase","subject":{"customerId":7}}],"asks":[{"q":"","product_id":"","rival":""}],"plays":[{"name":"Charge for cutting","treats":"margin","how":"","sized":"","watch":"","weeks":4}],"targets":[{"metric":"collections","aim":3000000,"why":"one line arguing the number from the figures"}],"holds":[{"key":"the purchase_plan line\u2019s own key","reason":"why not yet, and what would make it a yes"}],"rejected":"one sentence on the option you turned down and why, and what would make it a yes","keyline":"the one thing that matters most today"}]. door is one of: chase, buy, prices, prices-watch, consignment, orders, invoices, debtors, creditors, followups, inventory, statements, whatsapp, sourcing, cashbook, payroll, presets. kind is one of: chase, buy, invoice, settle, price, policy, other. subject carries ONLY ids a tool returned in this conversation (customerId, supplierId, key, orderId) — never invent one, and omit subject ONLY when the reading gave you none: an unnamed move can never be measured. worth is whole shillings, 0 when no honest figure exists. worth_basis is one of: cash_freed, profit_30d, loss_avoided, cost_saved, none. lever is one of: collect, sell, buy, price, cost, system. after is the position in this plan of the move this one waits on, omitted unless one truly cannot start before another is done. objective.name is one of: cash, margin, growth, recovery. targets[].metric is one of: collections, gross_profit, sales, debtors_total, dead_stock_value, cash_on_hand, and aim is whole shillings. plays[].treats is one of: margin, cash, dead_stock, debt, concentration, supplier_cost, growth, other. holds[].key is copied EXACTLY from a key a tool returned \u2014 a key you did not read resolves to no product and the hold becomes nothing.',
  '',
  'WHEN YOU TURN DOWN A BUY, HOLD THE LINE \u2014 A SENTENCE IS NOT ENOUGH. What to buy ranks on what each line EARNED in thirty days and knows nothing else: it cannot see that a line is thin, it cannot see that you decided against it, and tomorrow morning it will put that same line back at number one. So when what you reject is a line purchase_plan is recommending, put it in holds with its key copied exactly from the tool and one plain sentence saying why not yet and what would make it a yes. The band appears at the top of that line on the buying screen, in your own words, with the door to the price beside it. Keep rejected for options that are NOT a buy-plan line \u2014 a chase you passed over, a policy you decided against.',
  '',
  'A hold is an argument, never a lock: the line keeps its place and its Buy it button, because a shop that buys anyway may know something the books do not. It ends by itself the moment the owner changes how that line is priced \u2014 the rule is compared, not the price, so a supplier putting its cost up does not count as a repricing \u2014 or when the owner lifts it, or after thirty days. manager_history returns holds_you_placed: NEVER hold a line that is already held and never recommend one either, argue from the hold instead; and when one has stood a long time with nothing repriced, say so plainly and either make the repricing today\u2019s move or drop the hold. AT MOST TWO holds in a meeting.',
  '',
  'ASK FOR WHAT THE BOOKS CANNOT HOLD. The shop will find things out for you: a supplier\u2019s rate at a bigger quantity, whether a debtor is still trading, what a rival charges. Put AT MOST THREE such questions in asks \u2014 each specific, answerable in one line, and worth the walk; never a question the tools could have answered, and never a vague one (ask what Roto charges for 40 units of Runners Masasi 12 inch, not to be told about Roto). They appear on the Manager screen with a box to answer in. WHEN THE ASK IS WHAT A NAMED SHOP CHARGES FOR ONE LINE, carry that line\u2019s product_id (and variant_index, from find_product) and the shop\u2019s name in the ask: the owner then answers with the figure alone and it is filed as a dated sighting on that line. A line with no shop, or a shop with no line, is only a note. manager_history returns answered_questions \u2014 treat those answers as evidence and say what you did with them \u2014 and open_questions, which you must not ask again; if one has gone unanswered and still matters, say so once and move on.',  '',
  'PRICING HAS TWO SIDES. A thin margin argues for lifting a price only when the line is not already dearer than the shop up the road. product_details returns other_shops_charge where the owner has recorded it: use it in any argument about a price, and put it in asks when it is missing on a line you are arguing about \u2014 when the objective is margin, at least one ask should be a rival\u2019s price on a line that matters \u2014 manager_history\u2019s never_checked names those lines, with their ids. Never treat an empty record as proof this shop is the cheapest: it is proof that nobody has looked.',
  '',
  'BE MEASURED. A manager that only advises cannot be judged, so propose AT MOST TWO targets for the week in targets: metric, aim in whole shillings, and one line arguing the number from the figures. Set the aim from what the books already do \u2014 last week\u2019s figure and what your own moves would add. Never propose a target for something no tool here measures, and never propose one you cannot argue from a figure. A target is a PROPOSAL until the owner takes it on, so say what it commits the shop to. manager_history returns the scoreboard, and it is judged by PACE and never by the raw figure \u2014 900,000 of a 3,000,000 week is fine on day two and a failure on day six. The tool gives you expected, where a target on course would stand TODAY for the days elapsed, on_course, behind_by, and at_this_rate, where the present rate lands it. A target behind pace is in worth_saying, and it MUST leave the meeting with either a move against it TODAY or an honest re-plan: a target quietly behind, with no move and no word, is the whole failure this scoreboard exists to prevent. A missed target is said plainly and its lesson taken; never quietly replace it with an easier one.',
  '',
  'THE PLAYBOOK \u2014 NEVER NAME A PROBLEM WITHOUT NAMING A PLAY THAT TREATS IT. \'margin is the binding problem\' is worth nothing to a shopkeeper standing in his shop unless you also say what to DO about it. A play is CRAFT, not measurement, so say plainly which part is your judgement, while every figure that sizes it comes from the tools. SIZE IT IN THIS SHOP\u2019S OWN FIGURES: \'you cut for about 30 orders a month; 2,000 a cut is 60,000 a month\', never a general principle with no number on it.',
  '',
  'Propose AT MOST TWO plays in a meeting and prefer one, in plays: name, treats (margin, cash, dead_stock, debt, concentration, supplier_cost, growth, other), how (what the owner actually does), sized (the arithmetic from the books), watch (what would show it working or failing), weeks (how many weeks it is for). manager_history returns the playbook: NEVER propose a play the shop has tried and dropped, argue from the ones already running rather than re-inventing them, and treat any play marked as the owner\u2019s own as outranking anything you thought of \u2014 it is their trade. A play past its span is never carried into another week in silence: say what it was for and how long it has run, then extend it with a reason, stop it, or replace it.',
  '',
  'Plays worth knowing in this trade, to CHOOSE from by the figures, never to recite: MARGIN \u2014 price the few lines customers actually compare and lift the rest; charge for the work (cutting, threading, delivery) instead of giving it away; bundle the fastener with the tool; buy at the next volume rung when cash allows; reprice or drop a line selling below cost; tighten the agent discount ladder; charge for credit, or discount for cash. CASH \u2014 collect before buying; turn dead stock into cash at a discount; shorten the credit line; take the supplier\u2019s terms rather than paying early. DEAD STOCK \u2014 one bulk lot to a builder or a fellow shop; bundle it with fast movers; ask the supplier to take it back. DEBT \u2014 a dated commitment instead of a promise; a deposit before delivery; a limit per customer and no supply above it. DEPENDING ON ONE BUYER \u2014 find the second buyer; widen the line; price the dependency. SUPPLIER COST \u2014 a second quote; a volume rebate; buy at the rung boundary; switch. GROWTH \u2014 stock deeper what climbed two months running; win back the customers going quiet; source what customers keep asking for.',
];

const MANAGER_REVIEW = [
  'THE WEEKLY REVIEW. When the message is "Hold the weekly review", you are the same manager on a different occasion: judging the week, not planning the day. Call week_review_data first; drill only where a figure needs support. Open with the verdict of the week in ONE sentence. Then account for your advice: what the done moves earned (figures from the tool only, collected_after_chases is the headline — unless the tool carries collected_after_chases_cannot_be_read, and then you must NEVER quote that zero: say plainly that this week’s advice cannot be scored, why, and that the shop’s own collected figure sits beside it), what was skipped and any pattern in the owner\u2019s own skip reasons, and what was never acted on \u2014 bluntly, without scolding. Compare the week to the prior week on only the two or three figures that MOVED. OPEN THE ACCOUNT WITH THE LAST REVIEW when week_review_data carries previous_review: say whether the lessons you gave then were acted on and what that produced \u2014 in figures where the books show them \u2014 before you draw any new ones. Never repeat a lesson word for word without saying what has changed since you last gave it, and retire one the shop has plainly rejected instead of carrying it forever. Account for the scoreboard too when week_review_data carries one: every target the shop took on, met or missed, by how much, and what that says about the advice that set it. Close with at most three lessons for next week, each grounded in a figure. When the tool says the week is thin, say so plainly and stop short \u2014 never pad thin evidence into a long review. DO NOT emit a [plan:] block in a review: the review judges, the next meeting plans. End instead with exactly one [review: {"verdict":"one sentence","lessons":["...","..."]}] block \u2014 never mention it, it is stripped before display.',
  '',
  'JUDGE THE STRATEGIES AGAINST THEIR OWN HORIZON, AND NEVER TAKE CREDIT FOR THEM. week_review_data carries strategies: every play the shop is working, and what the thing it treats did over the days it has run against the SAME NUMBER OF DAYS before it started. Account for every one of them by name. But `alongside_it` is WHAT MOVED, never what the play DID, and you must never write a sentence that says otherwise: margin going from 4% to 11% across the weeks a shop charged for cutting does not mean the cutting charge did it \u2014 two below-cost lines may have been repriced in the same fortnight, or one fat order may have carried the month. also_running names the other plays live in the same weeks for exactly this reason; when it is there, say so. State the movement, name what else could explain it, give your judgement AS a judgement in your own voice, and leave the verdict to the owner. A false lesson is worse than a wrong figure: the owner catches a wrong figure, and builds a year of strategy on a false lesson.',
  '',
  'When a play carries too_early, say it is too new to judge and stop \u2014 seven days is the least that says anything. When it carries no_before, say plainly what is missing rather than comparing unlike spans. When it carries nothing_measures_it, do not reach for the nearest number: ASK the owner what they have seen, in the review\u2019s own words. A play running a long time with nothing moving is worth saying out loud and worth proposing to stop. And when the review carries holds \u2014 lines you told this shop not to refill \u2014 account for those too: a hold standing three weeks with nothing repriced is advice that went nowhere, and either the repricing is next week\u2019s move or the hold should go.',
];

/* One occasion's rules, in one string. The common part goes LAST so the
   occasion's own opening sentence is the first thing read. */
function managerExtension(mode){
  const own = mode === 'manager-review' ? MANAGER_REVIEW : MANAGER_MEETING;
  return own.concat(['']).concat(MANAGER_COMMON).join('\n');
}

/* Forty-one tools in FIXED order — the array is part of the cached
   prefix, so reordering it would re-bill the whole prefix for nothing.
   Every schema closes with additionalProperties:false so a drifted call
   fails loudly instead of half-working. */
const ACCOUNT_ENUM = { type: 'string', enum: ['cash', 'momo', 'bank'], description: 'Which till: cash drawer, mobile money, or bank.' };

const TOOLS = [
  {
    name: 'find_customer',
    description: 'Find a customer by name or phone. Always use this to get the exact customer_id before any customer write or statement. Returns at most 5 matches with an exact_match flag.',
    input_schema: { type: 'object', properties: { query: { type: 'string', description: 'Name or phone, as the owner said it.' } }, required: ['query'], additionalProperties: false },
  },
  {
    name: 'find_supplier',
    description: 'Find a supplier by name, phone or location. Use before add_supplier_price or pay_supplier when the supplier id is not already known. A miss returns the real supplier names on file (all_names).',
    input_schema: { type: 'object', properties: { query: { type: 'string', description: 'The supplier name, as the owner said it.' } }, required: ['query'], additionalProperties: false },
  },
  {
    name: 'find_product',
    description: 'Find a product or a specific variant by any words: name, size, type, description, notes. Use before create_quote, recommended_price or add_sourcing_lead. Returns at most 5 entries with stock and price hints. Several matches for one product usually means the owner must pick a variant — ask them by the variant names. Each match carries its unit, its packing and what a whole pack costs, so a pack question can be answered without a second call.',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'], additionalProperties: false },
  },
  {
    name: 'customer_statement',
    description: 'One customer’s full position: balance, open invoices oldest first, and their recent debt history (charges and payments, dated). Use for "what does X owe", "read me X’s history", and follow-up questions about their statement.',
    input_schema: { type: 'object', properties: { customer_id: { type: ['string', 'number'], description: 'Exactly as find_customer or list_debtors returned it — ids may be text like C106.' } }, required: ['customer_id'], additionalProperties: false },
  },
  {
    name: 'list_debtors',
    description: 'Everyone who owes the shop money, oldest debt first, with ages and when each last paid anything. Top 15 plus the overall count and total.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'debtor_payments',
    description: 'One day’s debt collections, partitioned: who paid that day (amounts and what they still owe — including anyone who cleared their whole balance), and which debtors did NOT pay that day (balance, age, last payment date). date defaults to today. Use for "who paid today", "which clients have not paid today", or any other day.',
    input_schema: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD; omit for today.' } }, required: [], additionalProperties: false },
  },
  {
    name: 'cash_on_hand',
    description: 'Money the shop holds right now in the cash drawer, mobile money and bank, and the total.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'suppliers_owed',
    description: 'What the shop owes suppliers. Without supplier_id: every supplier owed, largest first. With supplier_id: that supplier’s open bills oldest first. supplier_id comes from a previous result.',
    input_schema: { type: 'object', properties: { supplier_id: { type: 'string' } }, required: [], additionalProperties: false },
  },
  {
    name: 'dues_owed',
    description: 'Wages and rent owed: the accrued totals, and which months are payable now with their due_id (needed by pay_staff_or_rent).',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'recent_invoices',
    description: 'Recent sales invoices, newest first, optionally for one customer. Shows number, date, customer, total, paid and balance.',
    input_schema: { type: 'object', properties: { customer_id: { type: ['string', 'number'], description: 'Exactly as find_customer or list_debtors returned it — ids may be text like C106.' }, limit: { type: 'integer', minimum: 1, maximum: 10 } }, required: [], additionalProperties: false },
  },
  {
    name: 'invoice_lines',
    description: 'What was ON a sale: every line of an invoice — product, quantity, unit, the price each and the line total, with what the goods cost us and what the line made where the cost is on record. Use this whenever the question is what somebody took, what price they were given, or what a past sale was worth; recent_invoices and customer_statement carry only totals and cannot answer it. Pass invoice for one sale (INV-0230, 0230 and 230 all work) or customer_id for that customer’s last few in full. priced says whether the price was typed in on the line or came from the markup rule — only the first was somebody’s decision. qty_side says which side of the pack size the quantity fell on, and decides the markup only on lines priced from the rule. A line whose cost is not on record reports cost_each null and is counted in lines_with_no_cost_on_record; when there is one, made_on_it is null for the whole invoice and made_on_the_costed_lines covers only the lines that carry a cost. Never fill an absent cost with a guess and never call an uncosted line pure profit. Voided invoices are found by number and flagged; they are left out of a customer’s list because a cancelled sale is not something they took.',
    input_schema: { type: 'object', properties: { invoice: { type: ['string', 'number'], description: 'One invoice number, as written or as said: INV-0230, 0230, 230.' }, customer_id: { type: ['string', 'number'], description: 'Exactly as find_customer returned it — ids may be text like C106.' }, limit: { type: 'integer', minimum: 1, maximum: 5, description: 'How many of that customer’s invoices to open in full. Default 3.' } }, required: [], additionalProperties: false },
  },
  {
    name: 'financial_summary',
    description: 'The shop’s statements: income (profit and loss), balance_sheet, or cash_flow. Dates are YYYY-MM-DD; omitted dates default to this month (balance_sheet uses as_of, defaulting to today).',
    input_schema: {
      type: 'object',
      properties: {
        statement: { type: 'string', enum: ['income', 'balance_sheet', 'cash_flow'] },
        from: { type: 'string' }, to: { type: 'string' }, as_of: { type: 'string' },
      },
      required: ['statement'], additionalProperties: false,
    },
  },
  {
    name: 'recommended_price',
    description: 'The app’s own recommended selling price for one product variant, from its recorded cost and the shop’s markup rules. Defaults to the wholesale side — this shop wholesales; retail figures ride along as retail_cost and retail_sell when on file. Says plainly when no price is on file or no markup rule is set; never guesses. Resolve the product with find_product first, and if it has several variants confirm which one before calling.',
    input_schema: { type: 'object', properties: { product_id: { type: 'string' }, variant_index: { type: ['integer', 'null'] } }, required: ['product_id'], additionalProperties: false },
  },
  {
    name: 'product_details',
    description: 'The full picture of one product: stock on hand, every supplier and what they charge (volume tiers included), the markup rules that apply, and the suggested selling price per variant. Use it when the owner asks what is known about a product, after find_product resolves the id. Each supplier row carries its packing, any pieces in one unit, the supplier\u2019s own code, and its volume ladder both as figures (per unit and whole pack) and as the exact sentence the Price Registry screen shows \u2014 read these instead of asking the owner about packing or a carton price. Suppliers marked out of stock are included and flagged.',
    input_schema: { type: 'object', properties: { product_id: { type: 'string', description: 'From find_product.' } }, required: ['product_id'], additionalProperties: false },
  },
  {
    name: 'stock_overview',
    description: 'The shop’s stock at a glance: total shelf value, how many lines are in stock, the biggest holdings by value (quantities and pack counts), what has RUN OUT (had stock before, none now), and lines with no cost on file. An optional query narrows it to a category or name. For one specific product use product_details. Use for "update me about the stock", "how is our stock".',
    input_schema: { type: 'object', properties: { query: { type: 'string', description: 'Empty for the whole shop; words to narrow it ("cement").' } }, required: [], additionalProperties: false },
  },
  {
    name: 'purchase_plan',
    description: 'The buying copilot: a ranked buy list derived from real records, best earners first. Two kinds of line — a shelf refill (sold off our own stock and running low) and worth stocking (bought in for order after order and never held). Each carries `why`, a sentence written from the shop\u2019s own figures, plus how many to buy (rounded to the supplier\u2019s pack), from which supplier at what cost, what it earned in 30 days and how many orders asked for it. Each line also carries `key` \u2014 the SHELF\u2019s id, the ONLY thing you may copy into a hold \u2014 and `line_id`, the ROW\u2019s id, which is what place_buy_order takes: a product that both ran out and is bought in order after order appears here TWICE under one key, at different quantities, so ordering by key alone can order a twelfth of what was meant. And `kept_pct`, the share of the sale the shop kept over the same 30 days, absent where the costing rests too much on estimates. A line the shop has decided not to refill yet carries `on_hold` with the reason and how long it has stood. Budget defaults to cash on hand; what did not fit is named, as are items selling with no supplier price on file. ORDERS ALREADY OUT. `already_on_order` is money committed to orders that have not arrived, and `budget` is what is left AFTER it \u2014 `budget_before_orders` is what it was before, so never quote one without the other. `on_order` lists each of them, and `lines_covered_by_an_order` names lines that are missing from the plan because the owner has already ordered them: those are done, not forgotten, and telling the owner to buy one again is the plan arguing with a decision they already took. An order owes NOTHING \u2014 no bill exists until the goods arrive \u2014 so it is never on the cash line and never counts as a debt. WHAT WOULD PAY FOR WHAT DID NOT FIT. `what_collecting_would_buy` joins the debt book to this plan: which debtors, and exactly which lines each one\u2019s money would put back inside the budget, by the same greedy rule the plan spends by. It is the difference between advising "chase Mulongo" and "buy cement" as two separate moves and advising the SEQUENCE \u2014 collect this, then buy that. Every figure there is an if-then on money the books already hold: read `the_condition` and say it, because a day a debtor named is not money and must never be spent as if it were. When one line stays out of reach whatever is collected, say so \u2014 chasing the whole book to buy nothing more than one customer already buys is work for its own sake. Use for "what should I buy", "I have 5m \u2014 what do I restock". It creates nothing.',
    input_schema: {
      type: 'object',
      properties: { budget: { type: 'number', exclusiveMinimum: 0, description: 'UGX available to spend. Omit to use cash on hand.' } },
      required: [], additionalProperties: false,
    },
  },
  {
    name: 'place_buy_order',
    description: 'RAISE AN ORDER for lines the buy plan is recommending. This is the one tool that acts on the buying advice instead of repeating it. Read purchase_plan first and pass the `line_id` of each line plus how many (omit qty to take the plan\u2019s own quantity). USE line_id AND NOT key: one product can stand on the plan TWICE \u2014 once as a shelf refill and once as a repeat buy-in, at very different quantities \u2014 and both rows carry the same `key`, so an order named by key alone can be for a twelfth of what was meant. A key that names two rows is refused rather than resolved by guesswork. ONE SUPPLIER PER CALL: a line the plan costed at a different supplier is refused, because the price comes from that supplier\u2019s registry entry. You never supply a price \u2014 the supplier, the unit and the cost all come from the plan, so an order can never be placed at a figure you worked out yourself. `expected_on` is the day THEY said it would come, as YYYY-MM-DD; omit it when they have not said, and the order is undated rather than late. WHAT IT DOES NOT DO: it moves no money, raises no bill and sends no message. Nothing is owed until the goods arrive and the owner records what came; the WhatsApp draft waits behind "Message them" on the What-to-buy screen for the owner to read and send. What it DOES do is commit budget \u2014 the plan stops offering that money at once \u2014 so it raises a confirmation card the owner must approve. Never order a line that is on hold without saying so first, and never order the same line twice: check `on_order` in purchase_plan before proposing anything.',
    input_schema: {
      type: 'object',
      properties: {
        supplier_id: { type: 'string', description: 'The supplier the plan costed these lines at.' },
        lines: {
          type: 'array', minItems: 1, maxItems: 20,
          items: {
            type: 'object',
            properties: {
              line_id: { type: 'string', description: 'The ROW\u2019s id, copied from purchase_plan. Always prefer it.' },
              key: { type: 'string', description: 'The shelf key. Only when line_id is not to hand; refused if it names two rows.' },
              qty: { type: 'number', exclusiveMinimum: 0, description: 'How many units. Omit for the quantity the plan recommends.' },
            },
            required: [], additionalProperties: false,
          },
        },
        expected_on: { type: 'string', description: 'YYYY-MM-DD, only if the supplier named a day.' },
      },
      required: ['supplier_id', 'lines'], additionalProperties: false,
    },
  },
  {
    name: 'catalogue_names',
    description: 'Every product name in the catalogue in one call (up to 500), with each variable product’s variant labels in variant_index order. Use it for BULK documents — a photographed price list with many rows — to match every row at once instead of calling find_product per row. It carries no prices or stock; for one product’s details use find_product or product_details.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'create_quote',
    description: 'Create a DRAFT quote (never invoices, never moves stock — the owner finishes it in the app). Every item must first be resolved with find_product; pass its product_id and variant_index exactly. Line prices default to the app’s own suggestions when sell_price is omitted.',
    input_schema: {
      type: 'object',
      properties: {
        customer_name: { type: 'string' },
        customer_phone: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD; defaults to today.' },
        items: {
          type: 'array', minItems: 1,
          items: {
            type: 'object',
            properties: {
              product_id: { type: 'string' },
              variant_index: { type: ['integer', 'null'] },
              qty: { type: 'number', exclusiveMinimum: 0 },
              sell_price: { type: 'number', description: 'Per base unit; omit to use the app’s suggested price.' },
            },
            required: ['product_id', 'qty'], additionalProperties: false,
          },
        },
      },
      required: ['customer_name', 'items'], additionalProperties: false,
    },
  },
  {
    name: 'record_customer_payment',
    description: 'Receive money from a customer who owes. Applies to their oldest open invoices first; any remainder reduces their general balance. Needs the exact customer_id from find_customer.',
    input_schema: {
      type: 'object',
      properties: {
        customer_id: { type: ['string', 'number'], description: 'Exactly as find_customer or list_debtors returned it — ids may be text like C106.' }, amount: { type: 'number', exclusiveMinimum: 0 },
        account: ACCOUNT_ENUM, note: { type: 'string' }, date: { type: 'string' },
      },
      required: ['customer_id', 'amount', 'account'], additionalProperties: false,
    },
  },
  {
    name: 'pay_supplier',
    description: 'Pay a supplier the shop owes. Clamps to what is actually owed and settles their oldest bills first. supplier_id comes from suppliers_owed. date is the day the money actually left, YYYY-MM-DD; omit it for today.',
    input_schema: {
      type: 'object',
      properties: {
        supplier_id: { type: 'string' }, amount: { type: 'number', exclusiveMinimum: 0 },
        account: ACCOUNT_ENUM, note: { type: 'string' }, date: { type: 'string' },
      },
      required: ['supplier_id', 'amount', 'account'], additionalProperties: false,
    },
  },
  {
    name: 'pay_staff_or_rent',
    description: 'Pay a wage or rent month. due_id comes from dues_owed. Clamps to the balance of that month.',
    input_schema: {
      type: 'object',
      properties: {
        due_id: { type: 'number' }, amount: { type: 'number', exclusiveMinimum: 0 },
        account: ACCOUNT_ENUM, date: { type: 'string' },
      },
      required: ['due_id', 'amount', 'account'], additionalProperties: false,
    },
  },
  {
    name: 'add_expense',
    description: 'Record money going out that is not a supplier bill or payroll — transport, airtime, offloading, and similar running costs. category must be one of the shop’s own expense categories; an invalid one is rejected with the valid list.',
    input_schema: {
      type: 'object',
      properties: {
        account: ACCOUNT_ENUM, amount: { type: 'number', exclusiveMinimum: 0 },
        category: { type: 'string' }, description: { type: 'string' }, date: { type: 'string' },
      },
      required: ['account', 'amount', 'category', 'description'], additionalProperties: false,
    },
  },
  {
    name: 'record_other_income',
    description: 'Record money coming in that is NOT a customer paying their debt — owner investment, other income. category must be one of the shop’s own income categories.',
    input_schema: {
      type: 'object',
      properties: {
        account: ACCOUNT_ENUM, amount: { type: 'number', exclusiveMinimum: 0 },
        category: { type: 'string' }, description: { type: 'string' }, date: { type: 'string' },
      },
      required: ['account', 'amount', 'category', 'description'], additionalProperties: false,
    },
  },
  {
    name: 'set_markup_rule',
    description: 'Set how the app suggests a selling price for one product (or one variant): a markup rule added on top of the supplier cost — a fixed amount, or percent on cost. This shop’s markups are usually FIXED amounts: treat a bare figure as fixed shillings, and use percent only when the owner says percent. A fixed wholesale markup is added on each pack, a fixed retail markup per unit. Value 0 clears a rule. TWO RULES CAN EXIST ON ONE LINE: this sets the rule used when the line is BOUGHT IN for an order, and a line may also carry its own STOCK rule that decides what it sells for off the shelf. Where it does, the result says shelf_price_unchanged \u2014 pass that on rather than reporting a change the shelf never saw; the owner changes a shelf price on the product\u2019s price rule or from Rival prices. Product-level is the default for every variant; pass variant_index to give one variant its own rule. Resolve the product with find_product first.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
        variant_index: { type: ['integer', 'null'] },
        retail_markup_type: { type: 'string', enum: ['percent', 'fixed'] },
        retail_markup_value: { type: 'number', minimum: 0 },
        wholesale_markup_type: { type: 'string', enum: ['percent', 'fixed'] },
        wholesale_markup_value: { type: 'number', minimum: 0 },
      },
      required: ['product_id'], additionalProperties: false,
    },
  },
  {
    name: 'create_product',
    description: 'Create a NEW product card in the catalogue — only after find_product found nothing and the owner confirmed it is genuinely new. Sizes or types of one thing are VARIANTS on one product (a variant attribute like Size with its values), never separate products. The product starts with no prices and no markup rules: record its supplier prices with add_supplier_price afterwards.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        category: { type: 'string', description: 'Ask the owner when not obvious; reuse an existing category name where one fits.' },
        subcategory: { type: 'string' },
        short_description: { type: 'string' },
        notes: { type: 'string' },
        variant_attributes: {
          type: 'array', maxItems: 2,
          description: 'E.g. [{"name":"Size","values":["400mm","600mm"]}]. Two attributes cross into the full matrix.',
          items: {
            type: 'object',
            properties: { name: { type: 'string' }, values: { type: 'array', items: { type: 'string' } } },
            required: ['name', 'values'], additionalProperties: false,
          },
        },
      },
      required: ['name'], additionalProperties: false,
    },
  },
  {
    name: 'add_supplier_price',
    description: 'Add or update one supplier’s price for a product in the Price Registry. A supplier’s single price and their pack price are two rungs of ONE ladder, saved on one entry — and an update MERGES: rungs and packing you do not restate are kept exactly as they are on file, so send only what the owner actually said. Resolve the product with find_product and the supplier with find_supplier first; a supplier_name not on file is created as a NEW supplier when the owner confirms the card.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
        variant_index: { type: ['integer', 'null'] },
        supplier_id: { type: 'string', description: 'From find_supplier, for a supplier already on file.' },
        supplier_name: { type: 'string', description: 'Used when there is no supplier_id; a name not on file becomes a new supplier.' },
        unit: { type: 'string', description: 'What one costs: Pc, Dozen, Bag, Kg... Required on a first entry; omit to keep the current one.' },
        price_per_unit: { type: 'number', exclusiveMinimum: 0, description: 'The single-quantity price for ONE unit. Required on a first entry; omit to keep the current rung when updating.' },
        pieces_per_unit: { type: ['integer', 'null'], description: 'How many pieces one unit carries, e.g. 12 for a dozen.' },
        pack_unit: { type: 'string', description: 'How it comes packed — may be given with pack_qty alone, no pack price.' },
        pack_qty: { type: 'number', description: 'How many units the pack holds.' },
        price_per_pack: { type: 'number', description: 'The price of the WHOLE pack, ONLY when the supplier actually quoted one — never derive it from the unit price.' },
        supplier_sku: { type: 'string' },
      },
      required: ['product_id'], additionalProperties: false,
    },
  },
  {
    name: 'import_price_list',
    description: 'Bring in a price list as confirmed batches: the genuinely-new products are created and every supplier price saved together, behind one card per call — only after the owner has seen the plan and agreed. At most 20 items per call — a longer document goes as sections, several calls in a row (one card each, continuing after each card), never one giant call. One supplier per call, resolved with find_supplier first (a supplier_name not on file becomes a NEW supplier). Items sharing a new_product name become ONE product created once; price its variants by variant_combo. Existing products take product_id (from catalogue_names or find_product) and variant_index. Every line follows add_supplier_price’s own laws — ladder rungs stay independent, and never invent a pack price the document does not quote. The result reports per-line outcomes.',
    input_schema: {
      type: 'object',
      properties: {
        supplier_id: { type: 'string', description: 'From find_supplier, for a supplier already on file.' },
        supplier_name: { type: 'string', description: 'Used when there is no supplier_id; a name not on file becomes a new supplier.' },
        items: {
          type: 'array', minItems: 1, maxItems: 20,
          items: {
            type: 'object',
            properties: {
              product_id: { type: 'string', description: 'An existing product, from catalogue_names or find_product.' },
              new_product: {
                type: 'object',
                description: 'Create this product first. Lines sharing one name are one product created once.',
                properties: {
                  name: { type: 'string' },
                  category: { type: 'string' },
                  subcategory: { type: 'string' },
                  variant_attributes: {
                    type: 'array', maxItems: 2,
                    description: 'E.g. [{"name":"Size","values":["400mm","600mm"]}].',
                    items: {
                      type: 'object',
                      properties: { name: { type: 'string' }, values: { type: 'array', items: { type: 'string' } } },
                      required: ['name', 'values'], additionalProperties: false,
                    },
                  },
                },
                required: ['name'], additionalProperties: false,
              },
              variant_index: { type: ['integer', 'null'], description: 'For an existing variable product — the position in catalogue_names’ variant list.' },
              variant_combo: {
                type: 'object', additionalProperties: { type: 'string' },
                description: 'For a variant of a product created in this same call, e.g. {"Size":"400mm"}.',
              },
              unit: { type: 'string', description: 'What one costs: Pc, Dozen, Bag... Required when the line is a first entry for that product and supplier.' },
              price_per_unit: { type: 'number', exclusiveMinimum: 0, description: 'The single-quantity price for ONE unit.' },
              pieces_per_unit: { type: ['integer', 'null'] },
              pack_unit: { type: 'string', description: 'May be given with pack_qty alone, no pack price.' },
              pack_qty: { type: 'number' },
              price_per_pack: { type: 'number', description: 'The WHOLE-pack price, only when the document actually quotes one.' },
              supplier_sku: { type: 'string' },
            },
            required: [], additionalProperties: false,
          },
        },
      },
      required: ['items'], additionalProperties: false,
    },
  },
  {
    name: 'growth_opportunities',
    description: 'Read-only customer growth queue and baseline. Returns a per-shop enabled flag, standing objective, ranked customer opportunities with current stock and positive margin checks, contact restrictions, source ids and mature 30-day repeat-purchase cohorts. Empty or unavailable means abstain, never invent a probability or offer. Review follow-ups before any customer contact; this tool sends nothing.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'shop_pulse',
    description: 'The whole shop in one reading: ranked alerts with the money at stake, cash by account \u2014 and, where anything is dated against it, promised_in_30_days, safe_to_spend, the tightest_day and how short it falls: the balance alone reads as money the shop can act on, and arguing to spend it is arguing to spend the rent, so quote safe_to_spend when the question is what can be bought, who to chase, the top of the buy plan \u2014 which now names what is ALREADY ON ORDER and not yet arrived, so `budget` there is what is left after it and a line missing from the plan may be one the owner has already ordered rather than one that stopped mattering (an order owes nothing until the goods come) \u2014 prices to check, orders sitting too long, follow-ups due, consignment owed, dead stock, and yesterday in one line. Counts and top items only, capped — drill with the narrower tools where a figure needs support. EVERY ROW THAT NAMES ONE THING CARRIES ITS ID — customerId on a debtor, a promise, a best customer, one going quiet or a follow-up; key on a buy line, a dead line, a thin-margin line or one running out; orderId on an order sitting too long; supplierId on a buy line. Copy that id straight into a move’s subject: it is the only thing that lets the books say later what the advice earned. Use it for the morning meeting, or any broad "how is the shop doing". Also carries who_you_owe \u2014 the supplier side, which no meeting could see before: what is owed in all, the bills the owner has named a day for and when (those are already inside safe_to_spend), the pile with NO day named which is owed for certain and is NOT in safe_to_spend, and the bills that have gone past a day the owner themselves named \u2014 the shop\u2019s own word rather than a supplier\u2019s patience, and what costs a shop its credit. Every row carries its supplierId: put it in a settle move\u2019s subject or the books can never say what the advice earned. The buying block also carries what_collecting_would_buy \u2014 which debtors\u2019 money would put which over-budget lines back in reach, an if-then on what the books hold and never a claim the money will come; it is what lets a plan say collect this THEN buy that rather than listing the two side by side. Also carries the profit and growth side of the shop: gross and net profit for the period, running costs, months of cash cover at the present burn, the lines earning most and the high-volume lines earning least, the most profitable customers, customers going quiet, lines depending on a single buyer, suppliers whose prices are rising, what runs out next, and how many stock lines have no cost on file.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'manager_history',
    description: 'The Manager\u2019s own past advice with what the books say happened to each move — read it FIRST in a meeting. TWO KEYS MATTER MOST. worth_saying is what is off course or new since the last meeting — a target behind pace, a question the shop went and answered, a hold going stale, a strategy that has moved something, a review written since — and it IS the morning’s opening sentences: there is nothing else to open with, and when it is empty say so in a handful of words. worth_saying may carry advice_not_landing \u2014 advice you have put to this owner three times or more that they have neither done nor turned down. That is not a shop disagreeing with you, it is advice not reaching them, and it needs the OPPOSITE of silence: say plainly that you have given it N times and it has not landed, then either ask what is in the way or spend the morning on something else. Restating it a fourth time in different words is the one response that is forbidden. do_not_repeat is FOR YOUR RESTRAINT AND NOT FOR YOUR PROSE: never re-ask those questions, never re-propose those plays, never re-recommend those held lines, and never read the list back to the owner. It also carries advice_you_keep_passing_on \u2014 moves this owner has skipped twice or more and never done, each with times, the day it was last put to them, and the reasons THEY typed. Those reasons are the whole point: the rule is RETHINK, not restate. Do not propose one of these again, and do not propose the same thing in different words either \u2014 that is the failure this list exists to stop; let the reason tell you what to do instead. One marked matched_by_wording was matched on its title rather than on an id, so it is the weaker claim of the two. Everything after those two is there to argue FROM when a move needs it, never to recite. limit: how many recent meetings to read (default 3, max 5). Also returns answered_questions \u2014 what the owner found out for you since, to be used as evidence, one marked on_the_market_record having already been filed as a rival sighting when it was answered (argue from it, never ask for it to be recorded again) \u2014 and open_questions, which are still unanswered and must not be asked again. Also returns where_the_market_hurts \u2014 the lines where the cheapest shop on file undercuts this one, worst first, each with at_stake_30d: what a month of THIS shop\u2019s own sales is worth at that rival\u2019s price. It is what is AT STAKE, not a loss the books recorded: being dearer risks the sale, it does not take money out of the till, so argue from it that way. A line here is where a pricing argument should start. And never_checked \u2014 the lines this shop earns most on with NOTHING at all on file about what other shops charge, worth first, each with the product_id and variant_index to put straight into an ask: that is where a rival ask is worth the walk, and the only place to find one that is not a guess. Also returns the scoreboard: every target the shop took on that is live or has just closed, with the aim, where it stood when taken on, and where the books say it stands now. Each live target carries its pace: where one on course would stand today for the days elapsed, whether it is on course, how far behind, and where the present rate lands it. Also returns last_review: the verdict and lessons from the most recent weekly review, to hold today\u2019s plan against. And the playbook: the strategies this shop is already running \u2014 with whose idea each was, how many weeks each was FOR and which week it is in \u2014 and the names of the ones it tried and dropped, which must never be proposed again. A running play carries past_its_span when it has outlived the horizon YOU gave it, and worth_saying carries it too with what to do: that span was your own commitment, so overrunning it is yours to answer for, not the shop\u2019s. Say how long it was for and how long it has run, then extend it with a reason from the figures, stop it, or replace it \u2014 carrying it into another week without saying anything is the one response that is forbidden. One marked no_span_named was proposed before a horizon was asked for; give it one now rather than judging the shop against a number nobody agreed. And say so plainly when a running play is not working, whatever its span, and propose stopping it: a play can fail in week one. And holds_you_placed: the buy-plan lines you told this shop not to refill yet, with the reason and how long each has stood \u2014 never hold one of those again, and never recommend it either. AND track_record separates advice, recorded completion and events observed afterward. it_worked is a legacy field name for an event following a recommendation, not evidence of execution or causation. Use completed_with_dated_record and events_after_completion_record for dated completion observations. Undated legacy done records cannot establish execution timing. Never call unexecuted advice a failed tactic or claim a later sale/payment was caused by the advice. AND chase_response: for the debtors who owe most now, how often each paid within a week after a chase against how often they paid in a week nobody chased them, with a verdict \u2014 pays_when_chased, pays_without_chasing, ignores_chases, mixed or too_early \u2014 and the shop\u2019s own pooled answer (chasing_helps, no_clear_difference, chasing_hurts or too_early). Use it to choose WHOM to chase: a chase move belongs first to a customer who pays when chased; one who pays without chasing does not need a move unless their debt is unusually old; one who ignores chases needs a different lever (a visit, a part-payment plan, no more credit), never another reminder. Quote the counts, never a bare percentage, and when the verdict is too_early say nothing about it.',
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'number' } },
      required: [], additionalProperties: false,
    },
  },
  {
    name: 'week_review_data',
    description: 'The week for the Manager\u2019s weekly review: this rolling 7 days against the prior 7 (sales, invoices, gross profit, collected, cash in and out), plus every move advised in the week with its status, the owner\u2019s skip reasons, and what the books say happened — including the total collected after chases, counted ONCE per customer from the earliest move that named them, with chases_advised, customers_chased and chases_not_measurable beside it so the figure can be read honestly. A move saved without the id its kind needs carries cannot_be_measured and is counted in moves_nothing_can_measure: that is a gap in the record, never a move that earned nothing. Derived from the shop\u2019s own records; use it only when holding the weekly review. Carries the scoreboard for the week as well, when targets were taken on. Carries previous_review as well \u2014 the verdict and lessons of the review before this one, so you can say whether they stuck. And strategies: every play the shop is working, each with what the thing it treats did over the days it has run against the same number of days before \u2014 that is WHAT MOVED alongside it, never what the play did, and other plays running in the same weeks are named beside it. Each also carries the horizon it was given: for_weeks, has_run_days, and past_its_span. Judge every play against BOTH \u2014 they answer different questions. A play three days old that moved nothing has not failed; one nine weeks into a four-week span has been carried rather than worked, and that is the review\u2019s to say. And holds: the buy-plan lines you told this shop not to refill yet, with how long each has stood.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'standing_policies',
    description: 'Every standing rule the app watches daily, in one answer: the chase timings (days before a debt is chased, rest days between chases of one customer), the per-item restock rules (min units and/or own cover days) with the shop default cover, and the order-stage time limits with whether push alerts are on. Read this BEFORE proposing any policy change, so the argument starts from what already stands.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'set_chase_timing',
    description: 'Set the shop’s debt-chasing policy: after_days (how many days after the sale a debt becomes chaseable) and/or rest_days (days to wait before chasing the same customer again). Whole days, 0–90; give at least one, the other keeps its current value. The chase queue re-forms immediately and the app watches the rule daily on its own.',
    input_schema: {
      type: 'object',
      properties: {
        after_days: { type: 'integer', minimum: 0, maximum: 90 },
        rest_days: { type: 'integer', minimum: 0, maximum: 90 },
      },
      required: [], additionalProperties: false,
    },
  },
  {
    name: 'set_restock_rule',
    description: 'Set a standing restock rule for ONE product (or one variant): min_units (never let the shelf fall below this many) and/or cover_days (this line keeps its own days of cover instead of the shop default). A side not given KEEPS its current value; setting both to 0 removes the rule and the line follows the shop default again. The What-to-buy plan watches the rule daily. Resolve the product with find_product first, and ground the numbers in derived figures (selling rate, delivery wait), never taste.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
        variant_index: { type: ['integer', 'null'] },
        min_units: { type: 'number', minimum: 0 },
        cover_days: { type: 'number', minimum: 0 },
      },
      required: ['product_id'], additionalProperties: false,
    },
  },
  {
    name: 'set_stage_limit',
    description: 'Set the order-tracking policy for one stage: how many minutes an order may sit there before the board flags it as sitting too long (and, when the owner has alerts on, pushes a notification). 0 removes the limit. One stage per call.',
    input_schema: {
      type: 'object',
      properties: {
        stage: { type: 'string', enum: ['draft', 'awaiting_goods', 'preparing', 'pending_delivery', 'completed'] },
        minutes: { type: 'number', minimum: 0, maximum: 20160 },
      },
      required: ['stage', 'minutes'], additionalProperties: false,
    },
  },
  {
    name: 'month_and_quarter',
    description: 'The longer arc, for growth and expansion questions: this month so far against THE SAME NUMBER OF DAYS of last month, the last two full months, this quarter so far against the same days of last quarter, and the last full quarter \u2014 each with sales, gross profit, margin, collections, running costs and what was left. Plus the items and customers whose earnings climbed or faded most between the last two full months, and how many months the books actually cover. Use it when the objective is growth, when the owner asks about the month, the quarter or the longer run, and in the weekly review to set the week in its context.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'add_sourcing_lead',
    description: 'Put an item on the sourcing queue — something the shop does not stock (or could not find) that should be hunted from suppliers. Repeating a name that is already on the queue revives it rather than duplicating it.',
    input_schema: {
      type: 'object',
      properties: {
        item_name: { type: 'string' },
        customer_name: { type: 'string', description: 'Who asked for it, if a customer did.' },
        note: { type: 'string' },
      },
      required: ['item_name'], additionalProperties: false,
    },
    /* The second cache breakpoint — the whole prefix up to and including
       this tool is served from cache on every question after the first. */
    cache_control: { type: 'ephemeral' },
  },
  {
    name: 'record_rival_prices',
    description: 'Write down what ANOTHER SHOP sells this shop\u2019s lines for \u2014 the only thing in this app that knows what a customer can pay elsewhere. Everything else here is what goods COST; this is what the competition CHARGES, and no argument about lifting or holding a price is complete without it. ONE SHOP AND ONE DAY, MANY LINES: research does not happen a price at a time, so send every line you were told about in a single call rather than one call each. Use it when the owner says what a rival is charging, reads out a round of the market, or shows you a quotation from another shop. Resolve each product with find_product first. SAY WHICH SIDE each price is: a retail ticket weighed against this shop\u2019s pack price is not a gap, it is two different things, and the market screen ranks that difference by money. Ask which it was rather than guessing. It changes NONE of this shop\u2019s own prices \u2014 it records what was seen, and the owner decides what to do about it. Read it back through product_details, which returns other_shops_charge.',
    input_schema: {
      type: 'object',
      properties: {
        rival: { type: 'string', description: 'The other shop, in the owner\u2019s own words \u2014 a competitor, never a supplier.' },
        seen_on: { type: 'string', description: 'The day these were seen, YYYY-MM-DD. Omit for today; a price with the wrong date is worse than none.' },
        note: { type: 'string', description: 'How they were seen, when the owner says: a shelf ticket, a quotation a customer brought, what a rival told a walk-in.' },
        items: {
          type: 'array', minItems: 1, maxItems: 10,
          description: 'The lines, all from the SAME shop on the same day.',
          items: {
            type: 'object',
            properties: {
              product_id: { type: 'string', description: 'From find_product.' },
              variant_index: { type: ['integer', 'null'] },
              price: { type: 'number', exclusiveMinimum: 0, description: 'What they SELL it for, in whole shillings.' },
              unit: { type: 'string', description: 'Per what, when the owner says: Ctn, Box, Pc.' },
              side: { type: 'string', enum: ['wholesale', 'retail'], description: 'WHICH OF THIS SHOP\u2019S TWO PRICES it should be weighed against: retail if it is what a walk-in pays for one or two, wholesale if it is a pack or trade price. A shelf ticket in another shop is usually retail; a figure a customer was quoted for a carton is wholesale. Omit ONLY when the owner did not say \u2014 the sighting is then compared against the wholesale price and marked as an assumption.' },
            },
            required: ['product_id', 'price'],
            additionalProperties: false,
          },
        },
      },
      required: ['rival', 'items'],
      additionalProperties: false,
    },
  },
  {
    name: 'product_rules',
    description: 'What the shop has WRITTEN DOWN about how one product goes with others — the owner’s own knowledge of their goods, which no figure in the books can hold. Five verbs and no sixth: needs (it cannot be used without the other, and a customer’s picture says so), goes with (usually bought together, offered not insisted on), instead of (a swap when the first is out of stock), runs out after (this product alone, and how many days one lasts), part of (both belong to one job). A rule may hold for every size of the product or for one size, and may name a size of the second product or leave it to follow the first. Every rule comes back with what the shop’s OWN INVOICES say about it — orders that carried the first, orders that carried both — so you can tell a rule the books agree with from one they argue with, and say so. Also returns pairs the invoices keep showing that nobody has ruled on yet. Use it before advising on what to stock together, what to offer when something is out, or why a customer’s picture is or is not naming a companion. Resolve the product with find_product first.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'From find_product.' },
      },
      required: ['product_id'], additionalProperties: false,
    },
  },
  {
    name: 'set_product_rule',
    description: 'Write down, change or switch off ONE rule about how two products go together — only what the owner has actually told you, in their words, never what the invoices merely suggest. The verbs are the five in product_rules and there is no sixth. qty is HOW MANY of the second product per ONE of the first (eight nails a sheet is qty 8, per "sheet"), and it is the whole value of a rule: without it a customer’s picture can only name the thing, and with it the picture turns a hundred and forty sheets into eleven hundred nails. Omit qty when the owner did not give one — an invented figure is worse than none. For "runs out after", qty is the number of DAYS one lasts and the second product is the first: do not pass to_product_id. Sizes are optional: leave them out and the rule holds for every size of the first product and the picture takes the size that follows for the second (the size that customer already buys, the only size priced, or the size matching the first). A rule changes no price, moves no stock and places no order; it only lets a customer’s picture say a second thing. Set active false to stop a rule being used in pictures without deleting what the owner decided.',
    input_schema: {
      type: 'object',
      properties: {
        from_product_id: { type: 'string', description: 'From find_product — the product the rule is ABOUT.' },
        verb: { type: 'string', enum: ['needs', 'with', 'instead', 'after', 'part'], description: 'needs | with (goes with) | instead (of) | after (runs out after) | part (of one job).' },
        to_product_id: { type: 'string', description: 'From find_product — the second product. Omit for "after", which is about the first product alone.' },
        qty: { type: ['number', 'null'], exclusiveMinimum: 0, description: 'How many of the second per ONE of the first; for "after", how many DAYS one lasts. Omit where the owner gave no figure.' },
        per: { type: 'string', description: 'What the figure is per, in the owner’s words: sheet, bag, Pair. Omit for "after".' },
        note: { type: 'string', description: 'Why, for whoever reads it next — what the owner knows that the orders cannot show.' },
        from_variant_index: { type: ['integer', 'null'], description: 'A size of the FIRST product, when the rule holds for that size only. Omit for every size.' },
        to_variant_index: { type: ['integer', 'null'], description: 'A size of the SECOND product, when the owner named one. Omit to let the picture take the size that follows.' },
        active: { type: 'boolean', description: 'False stops an existing rule being used in pictures, keeping the decision. Defaults true.' },
      },
      required: ['from_product_id', 'verb'], additionalProperties: false,
    },
  },
];

/* Every failure of the Anthropic call, as a sentence the owner can act
   on -- raw error JSON in a chat bubble helps nobody. Most specific
   first. `retryable` marks the failures that a second try moments later
   can cure (busy, unreachable, the service's own 5xx), so the browser
   retries those by itself and never the ones that would fail the same
   way twice. */
function apiErrorReply(err) {
  if (err instanceof Anthropic.AuthenticationError) {
    return { status: 502, error: { type: 'bad_key', message: 'The AI key on the server was rejected. Check ANTHROPIC_API_KEY in Vercel — it may have been revoked or mistyped.' } };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { status: 429, error: { type: 'rate_limited', retryable: true, message: 'The AI service is busy right now. Wait a minute and ask again.' } };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { status: 502, error: { type: 'network', retryable: true, message: 'Could not reach the AI service. Check the internet connection and try again.' } };
  }
  if (err instanceof Anthropic.APIError) {
    /* A 4xx is a verdict on OUR OWN REQUEST -- "text content blocks
       must be non-empty", "tool_result ... unexpected" -- and names a
       part of the payload this file built. None of it is the shop's
       data, and without it the panel can only say a number, which
       diagnoses nothing. A 5xx is the service's own internals and
       still means nothing to a shop, so that one keeps its sentence. */
    const status = err.status || 0;
    if (status >= 400 && status < 500) {
      const detail = String((err && err.message) || '').replace(/\s+/g, ' ').trim().slice(0, 200);
      return { status: 502, error: { type: 'api_error',
        message: 'The AI service rejected the request (' + status + ')'
          + (detail ? ' — ' + detail : '') + '.' } };
    }
    return { status: 502, error: { type: 'api_error', retryable: true, message: 'The AI service returned an error (' + (err.status || 'unknown') + '). Try again shortly.' } };
  }
  return { status: 500, error: { type: 'server_error', message: 'The server hit a bug — ' + String((err && err.message) || err).slice(0, 300) } };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { type: 'method', message: 'POST only.' } });
  }
  /* OUTER CATCH, around everything. The Manager's first live outing died
     as a bare platform 500 — no JSON, no sentence — because whatever
     threw did so outside the inner try, and Vercel's crash page carries
     nothing a shopkeeper (or their developer) can act on. Every failure
     inside this function must leave as a worded JSON with the real
     message in it: the panel is the only log the shop can read. */
  try {

  /* Auth before anything that can spend money. The token is the caller's
     own Supabase session JWT; auth/v1/user re-validates it server-side —
     the same gate every edge function in this repo already uses. */
  const authz = req.headers['authorization'] || '';
  if (!authz.startsWith('Bearer ')) {
    return res.status(401).json({ error: { type: 'unauthorized', message: 'Sign in to use the assistant.' } });
  }
  let who;
  try {
    who = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: authz },
    });
  } catch (e) {
    return res.status(502).json({ error: { type: 'network', message: 'Could not verify your login. Check the internet connection and try again.' } });
  }
  if (!who.ok) {
    return res.status(401).json({ error: { type: 'unauthorized', message: 'Your login has expired — reload the page and sign in again.' } });
  }

  /* Ships dark. The panel renders this as the setup card; nothing is
     spent and no SDK client is ever constructed. */
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json({ not_configured: true });
  }

  const messages = req.body && req.body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: { type: 'bad_request', message: 'Nothing to answer.' } });
  }
  /* Hard ceilings, not niceties: history is the one input a bug in the
     client could grow without bound, and every byte of it is billed.
     Photos get their own ceilings — the browser compresses them, but
     the browser is not the trust boundary, so each is bounded again
     here. The TEXT of the thread keeps its own cap, measured with the
     image bytes blanked, so a photo cannot smuggle a longer history. */
  if (messages.length > 40) {
    return res.status(413).json({ error: { type: 'too_long', message: 'This chat has grown too long — press New chat and continue there.' } });
  }
  const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  let imageCount = 0;
  for (const m of messages) {
    const blocks = Array.isArray(m && m.content) ? m.content : [];
    for (const b of blocks) {
      if (!b || b.type !== 'image') continue;
      if (m.role !== 'user') {
        return res.status(400).json({ error: { type: 'bad_request', message: 'Photos can only come from you.' } });
      }
      imageCount++;
      const src = b.source || {};
      if (src.type !== 'base64' || !IMAGE_TYPES.includes(src.media_type) || typeof src.data !== 'string') {
        return res.status(400).json({ error: { type: 'bad_request', message: 'That photo could not be read — attach it again with the camera button.' } });
      }
      if (src.data.length > 950000) {
        return res.status(413).json({ error: { type: 'too_long', message: 'That photo is too large — retake it and try again.' } });
      }
    }
  }
  if (imageCount > 3) {
    return res.status(413).json({ error: { type: 'too_long', message: 'Too many photos in one chat — press New chat and send it there.' } });
  }
  const textOnly = JSON.stringify(messages, (k, v) => (k === 'data' && typeof v === 'string' && v.length > 1000 ? '' : v));
  if (textOnly.length > 200000) {
    return res.status(413).json({ error: { type: 'too_long', message: 'This chat has grown too long — press New chat and continue there.' } });
  }

  /* Which manager occasion, if any. Validated against the two names the
     app actually sends: an unknown mode is the plain assistant, never a
     silent fall-through to the wrong rulebook. */
  const rawMode = String((req.body && req.body.mode) || '');
  const mgrMode = (rawMode === 'manager' || rawMode === 'manager-review') ? rawMode : null;

  /* Whether the browser can read the answer as it is written. Opt-in,
     so a page still cached from before this change keeps getting the
     one JSON body it knows how to read. */
  const wantStream = !!(req.body && req.body.stream === true);

  const client = new Anthropic();
  const params = {
      /* The model is a setting, not a literal buried in a request: moving
         the shop to a newer one is an environment variable and a
         redeploy, not a code change. Unset means the default here. */
      model: process.env.ANTHROPIC_MODEL || 'claude-opus-5',
      /* 3000 is sized to the 60s Vercel window, not to taste: adaptive
         thinking counts against it too, and generating much more than
         this cannot finish before the function is killed. A bulk import
         must therefore go as parts (the schema caps items at 20) — at
         2000 a big import call was cut off mid-JSON, which reached the
         owner as a silently dead panel. */
      max_tokens: 3000,
      /* Medium effort: this assistant dispatches tools and reads
         documents — the deep default burned the output budget on
         thinking before a word was said (thinking spends from
         max_tokens too), and it is the owner's money. Medium keeps
         turns fast, cheap, and inside the budget. */
      output_config: { effort: 'medium' },
      /* Refusal fallbacks, current-guidance default for Opus 5: a safety
         decline re-runs on a fallback model inside this same call rather
         than dead-ending the owner's question. */
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      /* No `thinking` (adaptive is this model's default; a budget would
         400) and no sampling params (removed on this model). */
      /* Either manager occasion gets a second block; which one it gets
         depends on the occasion. Anything else is the plain assistant. */
      system: mgrMode
        ? [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
           { type: 'text', text: managerExtension(mgrMode), cache_control: { type: 'ephemeral' } }]
        : [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: TOOLS,
      messages,
  };

  /* THE ANSWER AS IT IS WRITTEN.

     A meeting is up to ten blocking round-trips, and for each one the
     owner watched three dots for twenty seconds. Streamed, the words
     arrive as the model writes them. One JSON object per line: `text`
     deltas for the screen, then one `done` carrying the whole message,
     which is the only thing the browser puts back into the thread --
     the deltas are a preview, never the record.

     The status line is only written once the first byte is ready, so a
     failure BEFORE the stream begins (a bad key, a 429 that outlived
     the SDK's own retries) still leaves as the same worded JSON error
     it always did. After that the status is spent, and a failure goes
     down the stream as an `error` line instead. */
  if (wantStream) {
    let started = false;
    const begin = () => {
      if (started) return;
      started = true;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();
    };
    const line = (obj) => { begin(); res.write(JSON.stringify(obj) + '\n'); };
    try {
      const stream = client.beta.messages.stream(params);
      stream.on('text', (delta) => { if (delta) line({ type: 'text', text: delta }); });
      const final = await stream.finalMessage();
      line({ type: 'done', content: final.content, stop_reason: final.stop_reason, usage: final.usage });
      return res.end();
    } catch (err) {
      const out = apiErrorReply(err);
      if (!started) return res.status(out.status).json({ error: out.error });
      line({ type: 'error', error: out.error });
      return res.end();
    }
  }

  try {
    const response = await client.beta.messages.create(params);
    return res.status(200).json({
      content: response.content,
      stop_reason: response.stop_reason,
      usage: response.usage,
    });
  } catch (err) {
    const out = apiErrorReply(err);
    return res.status(out.status).json({ error: out.error });
  }
  } catch (err) {
    /* A throw from OUTSIDE the inner try — validation, auth plumbing,
       client construction, anything unforeseen. Still a sentence. */
    try {
      return res.status(500).json({ error: { type: 'crash', message: 'The server hit a bug — ' + String((err && err.message) || err).slice(0, 300) } });
    } catch (e2) { /* the response was already gone; nothing left to say it to */ }
  }
};
