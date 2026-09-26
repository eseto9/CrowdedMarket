# Crowded Market: design

A top-down market game. The whole market is one screen, like a board: a cobbled street
across the middle, trading stalls above and below it, shops along the top, the harbour
quay along the bottom, and suppliers round the edges. You can always see your stall, every
customer's request and every rival, so the game is about reading the market and choosing
where to be.

It started as a mode inside Whereabouts (the co-op I spy game on the same island) and
became its own game and repo. It keeps Whereabouts' look: the toon shading, the Wanderbean
avatars, the townsfolk and the synth sounds, copied into `src/js/01–04`. Nothing is shared
at runtime, and there is no shared economy. Single player for now; multiplayer comes later
(the simulation is built for it).

## How a week plays

A **market week is three days**. Each day lasts **1, 2 or 3 minutes** (title screen, 2 by
default), in three equal parts: morning, midday, evening, each busier than the last. Coins
carry over from day to day; stock doesn't. Most coins after day three wins the week.

Three shopkeepers trade:

- **You**, on the top row.
- **Ursula, the Undercutter**, next door. She opens at 85% of list and goes one coin under
  anyone selling the same thing, down to two coins over cost.
- **Hattie, the Hoarder**, across the street. She never undercuts, but matches the cheapest
  price down to 80% of list, and fetches bigger loads than she needs. Her proper tricks
  (bulk orders, auctions) come in milestone 5.

The fourth stall is empty for now; the Schemer takes it in milestone 3.

### A day

1. **Opening stock.** Every stall opens with the same random mix (2–3 kinds, 2–3 of each,
   from bread, fruit, fish, flowers and cheese), drawn from the day's seed, so it's fair but
   different every day.
2. **Supply runs.** Six suppliers ring the market. Stand in a yellow ring (or click the
   supplier) to buy: **E** buys one, **Shift+E** or Shift+click buys an armful. You carry 6
   (9 with the bigger crate), in a crate everyone can see.

   | Good | Supplier | Where | Cost | List price |
   | --- | --- | --- | --- | --- |
   | 🥖 Bread | the bakery | top left, by its door | 2 | 5 |
   | 🫖 Teapots | the pottery | top right | 8 | 17 |
   | 💐 Flowers | a flower cart | left edge, top | 3 | 8 |
   | 🍎 Fruit | a fruit stand | left edge, bottom | 2 | 5 |
   | 🧀 Cheese | a dairy cart | right edge, bottom | 5 | 11 |
   | 🐟 Fish | the fish quay | bottom middle | 4 | 9 |

3. **Shelving.** At your stall, **E** or a click puts what you carry on the shelf.
4. **Customers** walk the street with a bubble showing what they want and the most they'll
   spend:
   - **Budget customers** (white bubble, all day): one thing, e.g. `🧀 ≤12`.
   - **Shopping lists** (blue bubble, from midday): 2–3 different things and a total budget,
     e.g. `🥖🍎🧀 ≤25`. They buy what they can from each stall and carry on with the rest. The
     stall that sells the **whole list** in one go gets a **25% bonus** on top.

   They stop briefly at any stall that has something they want.
5. **Selling.** The ring on the ground round your stall is your **sale range** (bubbles
   outside it are faded).
   - **Standing at your stall sells for you:** anyone in your ring who wants something you
     have within budget is pitched automatically.
   - **Away from your stall** you can still pitch someone in your ring by walking up to
     them (E, or click them).
   - After the first pitch, every stall gets 1.6 s to pitch too (auto-selling stalls join
     in). The customer takes the offer covering **the most of their list, then the
     cheapest**, and a tie goes to whoever pitched first. They walk over and pay the prices
     agreed when they chose. If the shelf is empty when they arrive, the sale is lost.
6. **Prices.** At your stall, **P** (or click your stall, or 🏷️ on a phone) opens the price
   panel.
   - Each good has −/+, never below cost. Each row shows the cost and the cheapest rival's
     price.
   - **Beat** puts you one coin under the cheapest rival.
   - Prices only change while you're at your stall.
7. **Price wars.** An undercut answered by an undercut back, on the same good within 25 s,
   starts a war between those two stalls.
   - A 🔥 marker floats between them.
   - Customers wanting that good turn up 1.8× as often, and margins shrink.
   - It ends 20 s after the last undercut.
8. **Closing bell.** Unsold stock is worthless. The day's results show everyone's coins,
   today's takings, sales, best sale, list bonuses, undercuts and unsold stock, with fun
   titles (at most two each). The titles are Top of the Day (Market Champion on the last
   day), Bargain Queen, List Ticker, Busy Bee, Big Ticket, Big Spender and Stockpiler.

### Between days: upgrades

Each can be bought once, and they carry over to the rest of the week. The rivals shop too,
and the shop shows who has what.

| Upgrade | Cost | Does |
| --- | --- | --- |
| 🧺 Bigger crate | 20 | carry 9 instead of 6 |
| 👟 Quick boots | 25 | walk (and dash) 15% faster |
| ⛱️ Bigger awning | 20 | sale range +2 m |

### Controls

| Keyboard and mouse | Touch |
| --- | --- |
| **WASD / arrows**: walk (screen directions) | tap the ground: walk there |
| **Space**: dash (a short burst, 1.6 s cooldown) | 💨 Dash |
| **Click** a customer, supplier or your stall: walk there and act | tap it |
| **E**: act on the nearest thing · **Shift+E**: buy an armful | ✋ Act · 🧺 Armful |
| **P**: prices (at your stall) · **Esc**: close them | 🏷️ Prices |
| **Tab** (hold): the market at a glance · **H**: hide the keys · **1–5**: emotes | |

A white ring shows what the pointer is on, a yellow ring shows what **E** would act on, and
the line at the bottom says what will happen.

## Architecture

```
src/js/10-tuning.js   CM_TUNE: every number, including the map, upgrades, customer mix, lists and wars
src/js/11-sim.js      CMSim: newState, nextDay, applyAction, tick, offer, replay, blocked/collide (no DOM)
src/js/12-ai.js       CMNav (A* on the board grid) and CMAI (rivals: step, betweenDays, newDay), no DOM
src/js/20-board.js    builds the still scene from CM_TUNE.BOARD
src/js/21-world.js    draws the state: shelves, price boards, customers, rivals, crates, rings, war markers
src/js/22-hud.js      clock, coins, your stall, prompt, feed, price panel, Tab summary, day results and upgrade shop
src/js/23-input.js    keys, pointer and touch
src/js/24-game.js     title (with a demo market behind it), the week, the authority loop, your bean
src/js/30-boot.js     main loop and boot
```

**The simulation is separate from rendering.** A day is one plain, JSON-serializable object:

```js
{ v, seed, rng, tick, t, len, day, week: {n, of, before}, phase: 'day'|'closed', part, diff,
  players: { [id]: { id, name, col, ai, x, z, mt, coins, stall, carry: {good: n}, ups: {upgrade: true},
                     st: { sales, earned, spent, best: {items, price}, undercuts, sabotage, haggle, wasted, bonus } } },
  order: [ids],
  stalls: [ { id, owner, x, z, stock: {good: n}, price: {good: n} } ],
  sup: { good: { x, z } }, mix: {good: n},
  cust: [ { id, kind: 'budget'|'list', x, z, lane, dir, born, ph, until, at, want: [goods], budget, got: [goods],
            pitches: [{p, at}], pitched: {player: t}, looked: [stall], deal: {p, stall, items, prices, total, full}, look } ],
  wars: { good: {a, b, until} }, cuts: [ {item, by, vs, t} ],
  nextCust, nid, feed: [ {id, t, k, ...} ], fid, recap: {rows, titles, last} }
```

**Every change goes through one of two functions:**

- `CMSim.applyAction(state, action)` validates and applies one action and returns
  `{ok, reason}`. Players and the AI use exactly this path.
  - `move {x,z}`: capped at dash speed (with boots) × time since the last move, and pushed
    out of stalls and props.
  - `buy {item,n}`: at that supplier, as much as fits (`capOf`) and is affordable.
  - `shelve`: at your own stall.
  - `setPrice {item,price}`: at your own stall, never below cost. An undercut (strictly
    under the cheapest rival with stock) is counted and can start a price war.
  - `pitch {cust}`: within pitch range of the customer, the customer inside your ring
    (`reachOf`), and `offer()` finds something to sell them within budget.
  - `upgrade {kind}`: only between days (not after the last), once each, paid for.
  - `say {text}`: a speech bubble (cosmetic, in the feed).
- `CMSim.tick(state)` is the authority's clock at 10 Hz. Each tick it handles, in order:
  - day parts and closing;
  - price wars ending;
  - spawning customers (seeded; the kind by day part, their wants weighted towards goods
    in a war);
  - customers walking, browsing, deciding, buying and moving on;
  - **auto-selling** for everyone standing at their stall (the stall order rotates each
    tick, so ties are shared).
- `CMSim.nextDay(state)` makes the next morning: same players, stalls and upgrades, coins
  carried, stats reset, a new seed derived from the last, and a new opening mix.

**The feed** (`state.feed`, the last 40 events) reports what happened: `sale` (items, price,
bonus), `undercut`, `price`, `buy`, `shelve`, `pitch` (auto or not), `pricey`, `chose`, `pass`,
`soldout`, `part`, `war`, `peace`, `upgrade`, `say`, `arrive`, `left`, `giveup`, `close`.

**Seeded and replayable.** All randomness comes from `state.rng` (mulberry32).
`CMSim.replay(start, log, tick)` rebuilds any moment of a day from its start state (or the
day-one options) and its `[tick, action]` log. The page keeps these as `CMG.start` and
`CMG.log`. The AI's decisions are in the log as ordinary actions.

**One authority.** In single player the page runs `gameStep()`: your `move`, then the actions
you queued since the last step (judged from where you actually are), then each AI's actions,
then `tick`. For multiplayer, a host runs the same loop and broadcasts; clients send actions.

**AI rivals are clients.** `CMAI.step(state, mem)` reads only what a player could see and
returns actions; `CMAI.betweenDays` returns its upgrade purchases. Memory (task, path, timers,
what customers asked for, its own dice) stays outside the game state. It walks A* paths on a
half-metre grid built from the same map as the simulation, never faster than a player walks
(boots included).

- **Pricing.** At its stall it sets prices by personality, and drops to a lone customer's
  budget when that still pays.
- **Selling.** At its stall it sells by itself, like you. Away from it, it pitches.
- **Restocking.** It restocks when the shelf is low, has too few kinds, or nothing has sold
  for 12 s while customers keep asking for things it doesn't have. It picks the good by
  expected profit per second of the trip:
  - customers still to come, weighted by how often the good is wanted;
  - divided among the stalls that already sell it;
  - plus the customers it has turned away;
  - less what's already on its shelf.
- **Upgrades.** Between days it buys upgrades in its personality's order, if it can keep 15
  coins for stock.

Difficulty (Easy/Normal/Hard) sets how often it thinks, how fast it walks, how quickly it
notices customers and when it restocks.

Balance check (16 seeded days each, the player standing still at their stall): at 2 minutes
Ursula averages about 69 coins, Hattie 79 and an idle player 64; at 3 minutes 88, 105 and 75.
A 1-minute day is mostly about selling the opening stock, so everyone ends close.

## Look

- A fixed camera tilted 57° frames the whole board and backs off to fit any window.
- Beans and customers are drawn 1.3× life size.
- The bottom row's awnings are see-through, because we see those stalls from behind.
- Names, price boards, bubbles, war markers and supplier markers are camera-facing sprites.
  Shopping-list bubbles are blue.
- A demo market (three AI shopkeepers) trades behind the title screen.
- On short screens (a phone held sideways):
  - the HUD shrinks into the corners and the feed hides;
  - the touch buttons sit at the street's right end;
  - the price panel scrolls, and every row fits on screen.

## Testing

`npm test` runs `node --test` over `tests/**/*.test.mjs` (33 tests). `tests/load-sim.mjs`
loads the tuning, simulation and AI into an empty closure, so any use of the DOM or THREE
fails loudly. Covered:

- **The map:** posts, pay spots and supplier rings are free to stand on; stalls and props
  are solid; every supplier is reachable from every stall.
- **Actions:** every action's rules, speed caps and collisions.
- **Selling:**
  - the opening mix is fair and varies with the seed;
  - cheapest-offer and tie rules;
  - agreed prices and empty shelves;
  - auto-selling at your stall, including joining a customer who is already deciding.
- **Shopping lists:** the offer rules, the full-list bonus, and partial buys across stalls.
- **Price wars:** they start, end, and draw extra customers.
- **Days and weeks:**
  - customer kinds by day part, and day lengths;
  - seeded determinism, closing and titles;
  - the three-day week (coins, upgrades, fresh stock) and what each upgrade does;
  - exact replay of day one and of later days.
- **Whole AI days and weeks:**
  - nothing refused, no speeding, never inside an obstacle;
  - the Hoarder's bigger loads, the Undercutter's floor, the Hoarder's matching;
  - a price war with the player, and upgrades bought between days;
  - hard beating easy.

In the browser, `/?play` starts a week at once. In the console, `__cm` has `CMG` (state, log,
start), `CMSim`, `CMAI`, `CMNav`, `P` (your bean) and `gameStep()`.

## Build order

1. Board, stalls, stock, supply runs, budget customers, coins, the Undercutter, recap. ✓
2. **Price panel, undercutting and price wars, shopping lists** ✓, plus from the design
   review: auto-selling at your stall, Hattie as a second rival, a fair random opening mix,
   the three-day week with upgrades, and tap-friendly panels.
3. Sabotage and the Schemer (the fourth stall).
4. Haggling and rush orders.
5. Bulk buyers, occasions, auctions (at the pier) and the Hoarder's tricks.
6. Difficulty tuning, polish. Multiplayer after that.

## Changelog

- **2026-09-25, milestone 2:**
  - the price panel and Beat;
  - price wars with a 🔥 marker and more customers for the good being fought over;
  - shopping-list customers with partial buys and a full-list bonus;
  - auto-selling while you stand at your stall;
  - Hattie the Hoarder;
  - a fair random opening mix;
  - the three-day market week with coins carried over and three upgrades;
  - the AI now spreads across goods, notices what customers ask for, and shops for
    upgrades.
- **2026-09-25:** days of 1, 2 or 3 minutes; the sale-range ring; faded bubbles for
  customers out of reach.
- **2026-09-25, milestone 1 (top-down):**
  - the game moves out of Whereabouts into its own repo and becomes a one-screen board;
  - click-to-walk-and-act, a dash and touch controls;
  - customers who stop to look at stalls;
  - a demo market behind the title, and a phone layout.
