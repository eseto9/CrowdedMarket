# Crowded Market: design

A top-down market game. The whole market is one screen, like a board: a cobbled street
across the middle, trading stalls above and below it, shops along the top, the harbour
quay along the bottom, and suppliers round the edges. You can always see your stall, every
customer's request and every rival, so the game is about reading the market and choosing
where to be.

It started as a mode inside Whereabouts (the co-op I spy game on the same island) and
became its own game and repo. It keeps Whereabouts' look: the toon shading, the Wanderbean
avatars, the townsfolk and the synth sounds, copied into `src/js/01–04`. Nothing is shared
at runtime, and there is no shared economy.

## Milestone 1: how a day plays

A day lasts **1, 2 or 3 minutes** (chosen on the title screen, 2 by default), in three equal
parts (morning, midday, evening), each busier than the last. A closing warning comes with a
fifth of the day left (30 s at most). You and **Ursula, the Undercutter** each run a stall on the top row. The bottom row and
the far stalls are shut for now (more rivals arrive in later milestones).

1. **Supply runs.** Six suppliers ring the market. Stand in a yellow ring (or click the
   supplier) to buy: **E** buys one, **Shift+E** or Shift+click buys an armful. You carry 6
   at most, in a crate the others can see.

   | Good | Supplier | Where | Cost | List price |
   | --- | --- | --- | --- | --- |
   | 🥖 Bread | the bakery | top left, by its door | 2 | 5 |
   | 🫖 Teapots | the pottery | top right | 8 | 17 |
   | 💐 Flowers | a flower cart | left edge, top | 3 | 8 |
   | 🍎 Fruit | a fruit stand | left edge, bottom | 2 | 5 |
   | 🧀 Cheese | a dairy cart | right edge, bottom | 5 | 11 |
   | 🐟 Fish | the fish quay | bottom middle | 4 | 9 |

   Near and cheap (bread) against far and dear (teapots, cheese): a round trip takes about
   3–9 seconds, and your stall is unguarded while you're gone.
2. **Shelving.** At your own stall, **E** or a click puts what you carry on the shelf. Your
   goods show on the counter and a price board floats above the stall.
3. **Customers** walk the street from one end to the other with a bubble like `🧀 ≤12`: one
   thing and the most they'll pay. They stop briefly at any stall that has what they want.
4. **Pitching.** A ring in your colour on the ground round your stall shows your **sale range**:
   customers inside it can be pitched, and bubbles outside it are faded. Get within 3.2 m of a
   customer inside the ring (7 m from your till) and press
   **E** (or click them; you'll walk over first if needed). Other stalls get 1.6 s to pitch
   too. The customer takes the **cheapest pitch within budget**, with ties going to whoever
   pitched first, walks to that stall and pays the price agreed when they chose. If the
   shelf is empty by the time they arrive, the sale is lost.
5. **Closing bell.** Unsold stock is worthless. The recap ranks everyone by coins, with
   sales, best sale, undercuts and unsold stock, and hands out titles (at most two each):
   Market Champion, Bargain Queen, Busy Bee, Big Ticket, Big Spender, Stockpiler.

In milestone 1 you sell at list prices; the price panel is milestone 2. Ursula undercuts
anything you both stock, so you win by carrying what she doesn't, or by catching customers
while she's off restocking.

### Controls

| Keyboard and mouse | Touch |
| --- | --- |
| **WASD / arrows**: walk (screen directions) | tap the ground: walk there |
| **Space**: dash (a short burst, 1.6 s cooldown) | 💨 Dash |
| **Click** a customer, supplier or your stall: walk there and act | tap it |
| **E**: act on the nearest thing · **Shift+E**: buy an armful | ✋ Act · 🧺 Armful |
| **Tab** (hold): the market at a glance · **H**: hide the keys · **1–5**: emotes | |

A white ring shows what the pointer is on, a yellow ring shows what **E** would act on, and
the line at the bottom says what will happen.

## Architecture

```
src/js/10-tuning.js   CM_TUNE: every number, including the map (stalls, suppliers, obstacles, bounds)
src/js/11-sim.js      CMSim: newState, applyAction, tick, replay, blocked/collide (no DOM, no THREE)
src/js/12-ai.js       CMNav (A* on the board grid) and CMAI (rivals), also no DOM
src/js/20-board.js    builds the still scene from CM_TUNE.BOARD
src/js/21-world.js    draws the state: shelves, price boards, customers, rivals, crates, rings
src/js/22-hud.js      clock, coins, your stall, prompt, feed, Tab summary, recap
src/js/23-input.js    keys, pointer and touch
src/js/24-game.js     title (with a demo market behind it), start/exit, the authority loop, your bean
src/js/30-boot.js     main loop and boot
```

**The simulation is separate from rendering.** Everything the game is lives in one plain,
JSON-serializable object:

```js
{ v, seed, rng, tick, t, len, day, phase: 'day'|'closed', part, diff,
  players: { [id]: { id, name, col, ai, x, z, mt, coins, stall, carry: {good: n},
                     st: { sales, earned, spent, best, undercuts, sabotage, haggle, wasted } } },
  order: [ids],
  stalls: [ { id, owner, x, z, stock: {good: n}, price: {good: n} } ],
  sup: { good: { x, z } },
  cust: [ { id, kind, x, z, lane, dir, born, ph, until, at, want: [{item, max}],
            pitches: [{p, at}], pitched: {player: t}, looked: [stall], deal, look } ],
  nextCust, nid, feed: [ {id, t, k, ...} ], fid, recap }
```

**Every change goes through one of two functions:**

- `CMSim.applyAction(state, action)` validates and applies one action and returns
  `{ok, reason}`. Players and the AI use exactly this path.
  - `move {x,z}`: where your bean is. Capped at dash speed × time since your last move,
    and pushed out of stalls and props and kept on the board (the same `collide` your
    bean uses on screen).
  - `buy {item,n}`: at that supplier; you get what fits in your arms and what you can afford.
  - `shelve`: at your own stall.
  - `setPrice {item,price}`: at your own stall, never below cost. Going strictly under the
    cheapest rival that has the good counts as an undercut.
  - `pitch {cust}`: needs range, stock and a price within budget (`pricey` otherwise).
  - `say {text}`: a speech bubble; cosmetic, but it goes in the feed so every viewer sees it.
- `CMSim.tick(state)` is the authority's clock at 10 Hz: day parts, seeded customer spawns,
  walking, browsing, deciding, buying and closing.

**The feed** (`state.feed`, the last 40 events) is how the simulation reports what happened:
`sale`, `undercut`, `price`, `buy`, `shelve`, `pitch`, `pricey`, `chose`, `pass`, `soldout`,
`part`, `say`, `arrive`, `left`, `giveup`, `close`. The HUD turns new entries into feed lines,
toasts, sounds, confetti and bubbles.

**Seeded and replayable.** All randomness comes from `state.rng` (mulberry32).
`CMSim.replay(init, log, tick)` rebuilds any moment of a day from its start options and the
`[tick, action]` log (`CMG.log` in the page). The AI's decisions are in the log as ordinary
actions, so a replay never runs the AI.

**One authority.** In single player the page runs the loop in `gameStep()`: your `move`, then
the actions you took since the last step (queued, so they're judged from where you actually
are), then each AI's actions, then `tick`. For multiplayer, a host runs the same loop and
broadcasts the state; clients send actions.

**AI rivals are clients.** `CMAI.step(state, mem)` reads only what a player could see (stalls,
prices, request bubbles, positions) and returns actions. Its memory (task, path, timers, its
own dice) stays outside the game state. It walks A* paths on a half-metre grid built from the
same map the simulation uses (so its routes are tested too), never faster than a player walks.
The Undercutter:

- opens at 85% of list and goes one coin under any rival selling the same good, never
  within a coin of cost;
- steps out to pitch customers near its stall, dropping to their budget if still worth it;
- restocks when its shelf is low or has too few kinds of goods. It picks the good by expected
  profit per second of the trip, from how many it can still sell before closing, and buys
  only that many.

The AI plans for the length of the day it's in: nothing is bought that it can't sell before
closing. Difficulty (Easy/Normal/Hard on the title screen) sets how often it thinks, how fast it walks
(4.6 / 5.4 / 6 m/s against your 6), how quickly it notices customers and when it restocks.

## Look

- A fixed camera tilted 57° frames the whole board and backs off to fit any window.
- Beans and customers are drawn 1.3× life size so they read from up there.
- The bottom row's awnings are see-through, because we look at those stalls from behind.
- Names, price boards, bubbles and supplier markers are camera-facing sprites.
- A demo market (two AI shopkeepers) trades behind the title screen.
- On short screens (a phone held sideways) the HUD shrinks into the corners, the feed hides,
  and the touch buttons sit at the street's right end, so no supplier is covered.

## Testing

`npm test` runs `node --test` over `tests/**/*.test.mjs`. `tests/load-sim.mjs` loads the tuning,
simulation and AI into an empty closure, so any use of the DOM or THREE fails loudly. Covered:

- the map: posts, pay spots and supplier rings are free, stalls and props are solid;
- every action's rules, including speed caps and collisions;
- cheapest pitch and the tie rule, agreed prices and empty shelves, browsing;
- spawning within caps and budgets, day parts, seeded determinism;
- closing and titles, and exact replay from a log;
- whole AI days: no refused actions, no speeding, never inside an obstacle, every supplier
  reachable from every stall, profit, the undercut floor, and hard beating easy.

In the browser, `/?play` starts a day at once. In the console, `__cm` has `CMG` (state and
log), `CMSim`, `CMAI`, `CMNav`, `P` (your bean) and `gameStep()`.

## Build order

1. **Board, stalls, stock, supply runs, budget customers, coins, the Undercutter, recap.** ← now
2. Price panel (P), undercutting and price wars, shopping-list customers.
3. Sabotage and the Schemer.
4. Haggling and rush orders.
5. Bulk buyers, occasions, auctions (at the pier) and the Hoarder.
6. Difficulty tuning, polish.

## Changelog

- **2026-09-25:** days of 1, 2 or 3 minutes (was 5), with customers arriving more often; the
  sale-range ring round your stall, and faded bubbles for customers out of reach.
- **2026-09-25, milestone 1 (top-down):** the game moves out of Whereabouts into its own repo
  and becomes a one-screen board. Click-to-walk-and-act, a dash, touch controls, customers
  who stop to look at stalls, a 5-minute day, a demo market behind the title, and a phone layout.
