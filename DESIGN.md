# Crowded Market: design

A top-down market game played as a **run**, like Balatro. You run a stall on a one-screen
market street. Every day has a **score target**; beat it to go on, miss it and the run is
over. Every sale scores **price × mult**, your mult grows with every sale in a row, and
between days you spend your coins in a **shop** on charms that make the numbers climb.

It started as a mode inside Whereabouts (the co-op I spy game on the same island) and became
its own game and repo. It keeps Whereabouts' look: the toon shading, the Wanderbean avatars,
the townsfolk and the synth sounds, copied into `src/js/01–04`. Single player for now;
multiplayer comes later (the simulation is built for it).

## The run

- **Rounds of three days:** day 1, day 2, then **the big day**, each with a score target.
  - Round 1's targets are **130 → 200 → 300**.
  - Every round's targets are **×1.6** the last. Charms have to carry you there.
  - For scale: a stall left alone scores about 35 on day 1; a busy one about 190.
- **Days are 75 seconds** (morning, midday, evening), each part busier than the last.
- **Miss a target and the run is over.** Your best run (round and day reached) is kept in
  this browser and shown on the title screen.
- **Score and coins are separate:**
  - **Score** beats the day's target. It resets each morning.
  - **Coins** are your money. They carry over and pay for stock and the shop.
- **Beating a target pays:**
  - +4 coins;
  - +1 for every 25% you beat it by (at most +4);
  - +1 interest for every 5 coins you're holding (at most +5).

## A day

1. **Opening stock.** Every stall opens with the same random mix (2–3 kinds, 2–3 of each,
   from the day's seed), so it's fair but different every day.
2. **Runners fetch stock.** Click a supplier and your runner goes: it pays there, carries a
   basket (4) back and shelves it. Orders queue (up to 3). Your stall stays staffed while
   they're gone. You can still fetch something yourself: Shift+click the supplier, or walk
   there and press E.

   | Good | Supplier | Where | Cost | Market price |
   | --- | --- | --- | --- | --- |
   | 🥖 Bread | the bakery | top left | 2 | 5 |
   | 🫖 Teapots | the pottery | top right | 8 | 17 |
   | 💐 Flowers | a flower cart | left edge, top | 3 | 8 |
   | 🍎 Fruit | a fruit stand | left edge, bottom | 2 | 5 |
   | 🧀 Cheese | a dairy cart | right edge, bottom | 5 | 11 |
   | 🐟 Fish | the fish quay | bottom middle | 4 | 9 |

3. **Prices are one tap: your stance** (keys 1, 2, 3), applied to everything on your stall.
   Every stall's prices float above it, so you always have a reference.
   - 🏷️ **Bargain:** a coin off (never below cost + 1). You win more customers.
   - ⚖️ **Fair:** the market price.
   - 💎 **Premium:** two coins on. Each sale scores more, but you lose more customers.
4. **Customers** walk the street with a bubble showing what they want and the most they'll
   spend.
   - One thing (white), e.g. `🧀 ≤12`, all day.
   - **Shopping lists** (blue), from midday: 2–3 things and a total budget. They buy what
     they can from each stall and carry on with the rest.
5. **Selling.** Standing at your stall, everyone inside your **ring** gets an offer
   automatically. The customer takes the offer covering the most of their list, then the
   cheapest, with ties going to whoever offered first. Away from your stall, click a
   customer to walk up and pitch them.
6. **Stealing.** A customer who has agreed a deal and is walking to someone else's stall shows
   whose deal they're on (`👉 Ursula 🐟8`).
   - If they're in your ring, or you walk up to them, and you have their things, **click them
     to steal them for a coin less** (the bubble turns orange when you can).
   - A stolen sale scores +1 mult.
   - Rivals steal from you too: Ursula often, Hattie rarely. A customer can be stolen twice
     at most.
7. **Scoring.** Every sale scores **chips × mult**.
   - **Chips** are what the sale was for, plus any charm chips.
   - **Mult** is 1, plus your **hot streak** (+0.5 for each sale in a row), plus charm and
     steal bonuses.
   - A whole shopping list in one go counts **×2**, and pays a 25% coin bonus too.
   - **Your streak ends when you lose a customer you offered to:** they chose someone else,
     your shelf ran out before they arrived, or they were stolen from you. That's what makes
     stocking well, Bargain vs Premium, and stealing matter.
8. **Closing.** Unsold stock is worthless. Then either the shop, or the end of the run.

## The shop (between days)

Four offers, rerolls (2 coins, then 1 more each time), and up to **five charm slots**. You
can sell a charm for half its price.

| Charms | |
| --- | --- |
| 🔔 Fishmonger's Bell | 🐟 sales score ×2 |
| 🥖 Baker's Dozen | +4 chips for every 🥖 sold |
| 🍎 Apple a Day | +2 mult on 🍎 sales |
| 🌸 Posy Pin | +3 mult on 💐 sales |
| 🧀 Big Cheese | +6 chips for every 🧀 sold |
| 🫖 Tea Party | 🫖 sales score ×3 |
| 👜 Shopping Bag | whole lists score ×3 (not ×2) |
| 🧤 Sticky Fingers | stolen customers score ×1.5 |
| 🐓 Early Bird | +2 mult in the morning |
| 🦉 Night Owl | +3 mult in the evening |
| ⏱️ Rush Hour | streaks build twice as fast |
| 🍀 Lucky Coin | 1 sale in 4 scores ×2 |
| 🗑️ Bargain Bin | unsold stock refunds half its cost |
| 📣 Town Crier | your ring is 2 m bigger |
| 🐷 Piggy Bank | +1 coin for every sale |

| Staff and upgrades | |
| --- | --- |
| 🏃 Extra runner (up to 2) | another runner fetching stock |
| 🤝 Haggler | stealing costs you nothing off the price |
| 👟 Quick legs (×2) | runners 25% faster |
| 🧺 Bigger basket (×2) | runners carry 2 more |
| ⛱️ Bigger awning | your ring is 2 m bigger |

## The rivals

They trade the same way you do: they stand at their stalls, send runners, steal, and read
only what you can see.

- **Ursula, the Undercutter** (next door): always on Bargain, steals 80% of the customers
  she can.
- **Hattie, the Hoarder** (across the street): Fair prices, bigger baskets, rarely steals
  (15%).

Their runners choose goods by expected profit: customers still to come who'd want it, shared
with other stalls selling it, plus customers they've had to turn away. Difficulty sets how
quickly they think and notice customers to steal.

## Controls

| Keyboard and mouse | Touch |
| --- | --- |
| **Click a supplier**: send a runner · **Shift+click**: go yourself | tap a supplier |
| **Click a customer**: pitch, or steal (walks over if needed) | tap them |
| **1 / 2 / 3**: Bargain / Fair / Premium | the buttons on your stall panel |
| **E**: act on the nearest (pitch, steal, grab stock) | ✋ Act |
| **WASD / arrows**: walk · **Space**: dash | tap the ground · 💨 Dash |
| **Backspace**: cancel the last order · **Tab** (hold): the market · **H**: hide the keys | |

## Architecture

```
src/js/10-tuning.js   CM_TUNE: every number, including the map, the run, scoring, charms, staff and upgrades
src/js/11-sim.js      CMSim: newState, nextDay, applyAction, tick, offer, stealDeal, replay (no DOM)
src/js/12-ai.js       CMNav (A* on the board grid) and CMAI (rivals), no DOM
src/js/20-board.js    builds the still scene from CM_TUNE.BOARD
src/js/21-world.js    draws the state: shelves, price boards, customers, rivals, runners, score pops, rings
src/js/22-hud.js      score / target / mult, coins and charms, your stall, prompt, feed, Tab, day's end and the shop
src/js/23-input.js    keys, pointer and touch
src/js/24-game.js     title (with a demo market behind it), the run, the authority loop, your bean
src/js/30-boot.js     main loop and boot
```

**The simulation is separate from rendering.** A day is one plain, JSON-serializable object:

```js
{ v, seed, rng, tick, t, day, run: {round, day, target}, phase: 'day'|'closed'|'over', part, diff,
  players: { [id]: { id, name, col, ai, stall, x, z, mt, coins, stance, charms: [keys], staff: {runner, haggler},
                     ups: {legs, basket, awning}, carry, orders: [goods], score, streak: {n, last},
                     st: { sales, earned, spent, best: {items, gain, chips, mult}, steals, stolen, lists, wasted, refund, streakTop, multTop } } },
  order: [ids], stalls: [ { id, owner, x, z, stock, price } ], sup: { good: {x, z} }, mix,
  runners: [ { id, owner, i, x, z, task: 'idle'|'out'|'back', item, carry, path: [[x, z]], wait } ],
  cust: [ { id, kind: 'budget'|'list', x, z, lane, dir, born, ph, until, at, want, budget, got,
            pitches, pitched, looked, deal: {p, stall, items, prices, total, full, stolen, from}, steals, look } ],
  nextCust, nid, feed, fid, result: {score, target, passed, beat, over, interest}, shop: {rerolls, offers} }
```

**Every change goes through `CMSim.applyAction(state, action)`** (players and the AI alike).
It returns `{ok, reason}`. The actions:

- `move {x,z}`: where your bean is.
- `order {item}` and `cancel`: send, or take back, a runner order.
- `buy {item,n}` and `shelve`: fetching stock yourself.
- `stance {stance}`: your stall's prices.
- `pitch {cust}`: an offer to a customer.
- `steal {cust}`: take a customer on their way to someone else.
- `say {text}`: a speech bubble.
- Between days: `shopBuy {i}`, `reroll`, `sellCharm {key}`.

**`CMSim.tick(state)`** (10 Hz) runs:

- day parts and closing;
- seeded customer spawns;
- customers walking, browsing, deciding, going to pay and buying;
- auto-selling for everyone at their stall;
- runners fetching.

Scoring happens at the sale: `score()` works out chips and mult from the streak, the list,
the steal and every charm (charms are data in `CM_TUNE.CHARMS`: `item`, `when`, `chips`,
`mult`, `xmult`, `listX`, `streakStep`, `reach`, `coin`, `refund`).

**Closing** checks your score against the target. It either pays out and opens the shop, or
ends the run. **`CMSim.nextDay(state)`** makes the next morning:

- the round and day move on, and the target is set;
- a new seed, derived from the last;
- coins, charms, staff, upgrades and stance carry over;
- scores, streaks and stats reset;
- a fresh opening mix, and runners home.

**The feed** (the last 40 events) reports what happened. The events are `sale` (with chips,
mult, gain and streak), `steal`, `streakLost`, `order`, `runner`, `fetched`, `broke`,
`delivered`, `stance`, `pitch`, `pricey`, `chose`, `pass`, `soldout`, `part`, `say`,
`bought`, `reroll`, `sold`, `arrive`, `left`, `giveup` and `close`.

**Seeded and replayable:** `CMSim.replay(start, log, tick)` rebuilds any moment of any day
from that morning's state and its `[tick, action]` log. **One authority:** in single player
the page runs `gameStep()`:

1. your move;
2. your queued actions;
3. each AI's actions;
4. `tick`.

A multiplayer host would run the same loop.

## Testing

`npm test` (33 tests, Node only; `tests/load-sim.mjs` loads the tuning, simulation and AI
into an empty closure, so any use of the DOM fails loudly). Covered:

- **The run:** the first day, the board, bad input, movement and collisions.
- **Supply:** fetching yourself; stances; runners (ordering, paying at the supplier,
  delivering, queueing, going broke, never walking through anything); extra runners, quick
  legs and bigger baskets.
- **Selling:** pitching, cheapest-offer and tie rules, auto-selling (including joining a
  customer who's already deciding), and shopping lists.
- **Stealing:** in your ring or by walking up; out of reach or stock; stealing back; the
  two-steal limit; the Haggler; the +1 mult.
- **Scoring:** chips × mult, streak growth, streaks lost to a rival, whole lists, and every
  kind of charm (item, chips, morning and evening, shopping bag, luck, piggy, refunds, reach).
- **Days and rounds:** customer kinds by day part, determinism, closing (pass with rewards
  and interest, or run over), rounds and growing targets, carry-over, the shop (slots, max
  levels, sold offers, rising rerolls, selling), and replay of any day.
- **AI:** whole days with no refused actions; Ursula steals and Hattie rarely does; every
  supplier reachable; a stand-in player using the AI passes day 1 at least half the time;
  harder rivals score more.

In the browser, `/?play` starts a run at once. In the console, `__cm` has `CMG` (state, log,
start), `CMSim`, `CMAI`, `CMNav`, `P` and `gameStep()`.

## Build order

1. ✓ The top-down board, stalls, stock, customers, the Undercutter.
2. ✓ Shopping lists, a second rival, fair opening stock.
3. **The run (step 1)** ✓:
   - score targets and rounds;
   - runners, stealing and stances (replacing the price panel);
   - score × mult with hot streaks;
   - the shop (15 charms, staff, upgrades, rerolls, selling);
   - the best-run record.
4. **The run (step 2)** next:
   - boss days (the third day of each round gets a boss with a rule);
   - market news before each day;
   - one-use tricks in the shop (Flash Sale, Supply Drop, Rumour, Cheer);
   - more charms.
5. Then: haggling and rush orders, auctions and bulk buyers (as boss rules and shop items),
   tuning, polish; multiplayer after.

## Changelog

- **2026-09-25, the run (step 1):**
  - The game becomes a Balatro-style run: 75-second days with score targets, rounds of three
    days with targets ×1.6 each round, and a run that ends when you miss one.
  - Score = chips × mult with hot streaks.
  - Runners fetch stock.
  - Stealing customers for a coin less.
  - One-tap stances replace the price panel.
  - The shop between days: 15 charms, staff, upgrades, rerolls, selling.
  - The best-run record.
  - Price wars and the 3-day week with upgrades are gone.
- **2026-09-25, milestone 2:** the price panel, price wars, shopping lists, auto-selling at
  your stall, Hattie, the opening mix, the three-day week with upgrades.
- **2026-09-25:** days of 1–3 minutes; the sale-range ring.
- **2026-09-25, milestone 1:** Crowded Market becomes its own top-down game and repo.
