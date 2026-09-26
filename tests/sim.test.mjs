import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, place, home, away, shelf, customer, going, closeNow, ticks, playDay, THREE } from './helpers.mjs';

const settle = (CMSim, s, T) => ticks(CMSim, s, Math.ceil((T.DECIDE + 6) / T.DT));

/* ---------- a run's first day ---------- */

test('a new run: day 1 of round 1 with its target, starting coins, one runner each, the same opening stock; plain JSON', () => {
  const { s, CM_TUNE: T } = setup({ players: THREE });
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
  assert.deepEqual(s.run, { round: 1, day: 1, target: T.RUN.targets[0] });
  assert.equal(s.day, T.DAY);
  assert.deepEqual(s.stalls.map(st => st.owner), ['me', 'u', 'h', null]);
  assert.equal(s.players.me.coins, T.RUN.startCoins);
  assert.equal(s.players.me.score, 0);
  assert.deepEqual(s.runners.map(r => r.owner), ['me', 'u', 'h']);
  for (const st of s.stalls.slice(0, 3)) assert.deepEqual(st.stock, s.mix);
  assert.equal(s.players.u.stance, 'bargain');
  assert.equal(s.players.h.stance, 'fair');
});

test('the opening mix: 2-3 kinds of 2-3 each from the pool, and it changes with the seed', () => {
  const { CMSim, CM_TUNE: T } = setup();
  const mixes = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const { mix } = CMSim.newState({ seed, players: [{ id: 'me' }] });
    const kinds = Object.keys(mix);
    assert.ok(kinds.length >= T.START_MIX.kinds[0] && kinds.length <= T.START_MIX.kinds[1]);
    for (const [g, n] of Object.entries(mix)) { assert.ok(T.START_MIX.pool.includes(g)); assert.ok(n >= T.START_MIX.each[0] && n <= T.START_MIX.each[1]); }
    mixes.add(JSON.stringify(mix));
  }
  assert.ok(mixes.size > 10);
});

test('the board: posts, pay spots, runner spots and supplier rings are free; stalls and props are solid', () => {
  const { s, CMSim, CM_TUNE: T } = setup();
  for (const st of s.stalls) {
    for (const q of [CMSim.post(st), CMSim.payAt(st), CMSim.backOf(st, 0), CMSim.backOf(st, 1), CMSim.backOf(st, 2)]) assert.ok(!CMSim.blocked(q.x, q.z), `stall ${st.id} spot ${q.x},${q.z}`);
    assert.ok(CMSim.blocked(st.x, st.z));
  }
  for (const [g, sp] of Object.entries(T.SUPPLIERS)) {
    assert.ok(!CMSim.blocked(sp.x, sp.z), `${g} spot`);
    const [x0, x1, z0, z1] = sp.prop;
    assert.ok(CMSim.blocked((x0 + x1) / 2, (z0 + z1) / 2), `${g} prop`);
  }
});

test('unknown actions, unknown players and bad input are refused; shop actions only between days', () => {
  const { s, CMSim } = setup();
  assert.equal(CMSim.applyAction(s, { type: 'teleport', player: 'me' }).reason, 'unknown');
  assert.equal(CMSim.applyAction(s, { type: 'move', player: 'nobody', x: 0, z: 0 }).reason, 'noplayer');
  assert.equal(CMSim.applyAction(s, { type: 'move', player: 'me', x: NaN, z: 0 }).reason, 'bad');
  assert.equal(CMSim.applyAction(s, { type: 'order', player: 'me', item: 'gold' }).reason, 'bad');
  assert.equal(CMSim.applyAction(s, { type: 'stance', player: 'me', stance: 'free' }).reason, 'bad');
  assert.equal(CMSim.applyAction(s, { type: 'shopBuy', player: 'me', i: 0 }).reason, 'closed');
});

test('move: nobody goes faster than a dash, off the board or through a stall', () => {
  const { s, CMSim, CM_TUNE: T } = setup();
  const p = s.players.me, x0 = p.x;
  ticks(CMSim, s, 10);
  const r = CMSim.applyAction(s, { type: 'move', player: 'me', x: x0 + 100, z: p.z });
  assert.ok(r.ok && r.clamped);
  assert.ok(p.x - x0 <= T.DASH.speed * T.MOVE_SLACK + 0.3 + 1e-9);
  const st = s.stalls[1]; place(s, 'me', st.x, st.z + 2); ticks(CMSim, s, 5);
  CMSim.applyAction(s, { type: 'move', player: 'me', x: st.x, z: st.z });
  assert.ok(!CMSim.blocked(p.x, p.z, T.BEAN_R - 0.01));
});

test('fetching stock yourself: buy at the supplier, shelve at your stall', () => {
  const env = setup(), { s, CMSim, CM_TUNE: T } = env;
  const p = s.players.me;
  assert.equal(CMSim.applyAction(s, { type: 'buy', player: 'me', item: 'fish' }).reason, 'far');
  place(s, 'me', T.SUPPLIERS.fish.x, T.SUPPLIERS.fish.z);
  assert.equal(CMSim.applyAction(s, { type: 'buy', player: 'me', item: 'fish', n: 2 }).n, 2);
  assert.equal(p.coins, T.RUN.startCoins - 8);
  assert.equal(CMSim.applyAction(s, { type: 'shelve', player: 'me' }).reason, 'far');
  shelf(s, 0, {}); home(env, 'me');
  assert.ok(CMSim.applyAction(s, { type: 'shelve', player: 'me' }).ok);
  assert.deepEqual(s.stalls[0].stock, { fish: 2 });
});

/* ---------- stances ---------- */

test('stance: one tap prices the whole stall; never below cost + 1', () => {
  const { s, CMSim, CM_TUNE: T } = setup();
  const st = s.stalls[0];
  for (const g in T.GOODS) assert.equal(st.price[g], T.GOODS[g].list);
  assert.ok(CMSim.applyAction(s, { type: 'stance', player: 'me', stance: 'premium' }).ok);
  for (const g in T.GOODS) assert.equal(st.price[g], T.GOODS[g].list + T.STANCES.premium.d);
  CMSim.applyAction(s, { type: 'stance', player: 'me', stance: 'bargain' });
  for (const g in T.GOODS) assert.equal(st.price[g], Math.max(T.GOODS[g].cost + 1, T.GOODS[g].list + T.STANCES.bargain.d));
  assert.equal(s.stalls[1].price.fish, T.GOODS.fish.list - 1, 'Ursula opens on bargain');
});

/* ---------- runners ---------- */

test('runners: an order sends one to the supplier, it pays there and brings a basket back to the shelf', () => {
  const { s, CMSim, CM_TUNE: T } = setup();
  shelf(s, 0, {}); away(s, 'u');
  const p = s.players.me, r = s.runners.find(r => r.owner === 'me');
  assert.ok(CMSim.applyAction(s, { type: 'order', player: 'me', item: 'cheese' }).ok);
  CMSim.tick(s);
  assert.equal(r.task, 'out');
  assert.equal(p.coins, T.RUN.startCoins, 'nothing paid until it gets there');
  let n = 0; while (r.task !== 'idle' && n++ < 400) { CMSim.tick(s); assert.ok(!CMSim.blocked(r.x, r.z, T.BEAN_R - 0.05), `runner inside something at ${r.x},${r.z}`); }
  assert.equal(r.task, 'idle');
  const basket = Math.min(T.RUNNER.basket, Math.floor(T.RUN.startCoins / T.GOODS.cheese.cost));
  assert.equal(s.stalls[0].stock.cheese, basket);
  assert.equal(p.coins, T.RUN.startCoins - basket * T.GOODS.cheese.cost);
  assert.ok(s.feed.some(e => e.k === 'delivered' && e.p === 'me' && e.n === basket));
});

test('runners: orders queue; a broke runner comes back empty-handed', () => {
  const { s, CMSim, CM_TUNE: T } = setup();
  for (let i = 0; i < T.RUNNER.queue; i++) assert.ok(CMSim.applyAction(s, { type: 'order', player: 'me', item: 'bread' }).ok);
  assert.equal(CMSim.applyAction(s, { type: 'order', player: 'me', item: 'bread' }).reason, 'queue');
  assert.ok(CMSim.applyAction(s, { type: 'cancel', player: 'me' }).ok);
  const e = setup(), t = e.s; t.players.me.coins = 1;
  e.CMSim.applyAction(t, { type: 'order', player: 'me', item: 'teapot' });
  ticks(e.CMSim, t, 400);
  assert.ok(t.feed.some(x => x.k === 'broke' && x.p === 'me'));
  assert.equal(t.players.me.coins, 1);
});

test('staff and upgrades: an extra runner works in parallel; bigger baskets and quick legs', () => {
  const trip = over => {
    const env = setup(), { s, CMSim } = env;
    Object.assign(s.players.me, over); s.players.me.coins = 200;
    // rebuild the morning so the extra runner turns up
    s.phase = 'closed'; s.shop = { rerolls: 0, offers: [] };
    const d = CMSim.nextDay(s); d.stalls[0].stock = {};
    CMSim.applyAction(d, { type: 'order', player: 'me', item: 'fish' });
    CMSim.applyAction(d, { type: 'order', player: 'me', item: 'fish' });
    let n = 0; while (!(d.stalls[0].stock.fish >= 2 * CMSim.basketOf(d.players.me)) && n++ < 900) CMSim.tick(d);
    return { n, runners: d.runners.filter(r => r.owner === 'me').length, fish: d.stalls[0].stock.fish };
  };
  const one = trip({}), two = trip({ staff: { runner: 1 } }), fast = trip({ ups: { legs: 2 } }), big = trip({ ups: { basket: 1 } });
  assert.equal(two.runners, 2);
  assert.ok(two.n < one.n * 0.7, `two runners ${two.n} ticks vs one ${one.n}`);
  assert.ok(fast.n < one.n, 'quick legs');
  assert.equal(big.fish, 2 * (4 + 2), 'bigger basket');
});

/* ---------- selling ---------- */

test('pitch: near the customer, the customer inside your ring, stock and a price in budget', () => {
  const env = setup(), { s, CMSim } = env;
  shelf(s, 0, {}); shelf(s, 1, {});
  const pa = CMSim.payAt(s.stalls[0]);
  const c = customer(s, { x: pa.x, z: -1.5, want: ['fish'], budget: 12 });
  place(s, 'me', 15, 0);
  assert.equal(CMSim.applyAction(s, { type: 'pitch', player: 'me', cust: c.id }).reason, 'far');
  place(s, 'me', pa.x + 1.5, -2.5);
  assert.equal(CMSim.applyAction(s, { type: 'pitch', player: 'me', cust: c.id }).reason, 'nostock');
  s.stalls[0].stock.fish = 1; CMSim.applyAction(s, { type: 'stance', player: 'me', stance: 'premium' }); c.budget = 10;
  assert.equal(CMSim.applyAction(s, { type: 'pitch', player: 'me', cust: c.id }).reason, 'pricey');
});

test('the cheapest offer wins; a tie goes to whoever pitched first', () => {
  const { s, CMSim, CM_TUNE: T } = setup();
  shelf(s, 0, { fruit: 3 }); shelf(s, 1, { fruit: 3 });   // Ursula is on bargain: 4 against your 5
  const c = customer(s, { x: 0, z: -1.5 });
  place(s, 'me', -1.5, -2.5); place(s, 'u', 1.5, -2.5);
  CMSim.applyAction(s, { type: 'pitch', player: 'me', cust: c.id });
  CMSim.applyAction(s, { type: 'pitch', player: 'u', cust: c.id });
  settle(CMSim, s, T);
  assert.equal(s.players.u.st.sales, 1);
  assert.equal(s.players.me.st.sales, 0);
  for (const first of ['me', 'u']) {
    const e = setup(), t = e.s;
    shelf(t, 0, { fruit: 3 }); shelf(t, 1, { fruit: 3 }); e.CMSim.applyAction(t, { type: 'stance', player: 'me', stance: 'bargain' });
    const d = customer(t, { x: 0, z: -1.5 });
    place(t, 'me', -1.5, -2.5); place(t, 'u', 1.5, -2.5);
    e.CMSim.applyAction(t, { type: 'pitch', player: first, cust: d.id }); e.CMSim.tick(t);
    e.CMSim.applyAction(t, { type: 'pitch', player: first === 'me' ? 'u' : 'me', cust: d.id });
    settle(e.CMSim, t, T);
    assert.equal(t.players[first].st.sales, 1, `${first} pitched first`);
  }
});

test('auto-sell: standing at your stall pitches anyone in your ring, even someone already deciding', () => {
  const run = atHome => {
    const env = setup(), { s, CMSim, CM_TUNE: T } = env;
    shelf(s, 0, { fish: 2 }); shelf(s, 1, {});
    if (atHome) home(env, 'me'); else away(s, 'me');
    away(s, 'u');
    const pa = CMSim.payAt(s.stalls[0]);
    customer(s, { x: pa.x - T.STALL_REACH - 3, z: -1, dir: 1, want: ['fish'], budget: 12 });
    ticks(CMSim, s, 120);
    return s;
  };
  assert.equal(run(true).players.me.st.sales, 1);
  assert.equal(run(false).players.me.st.sales, 0);
  const env = setup(), { s, CMSim, CM_TUNE: T } = env;
  shelf(s, 0, { fish: 2 }); shelf(s, 1, { fish: 2 });
  home(env, 'u'); away(s, 'me');
  const c = customer(s, { x: 0, z: -1.5, want: ['fish'], budget: 12 });
  place(s, 'me', -1.5, -2.5); CMSim.applyAction(s, { type: 'pitch', player: 'me', cust: c.id }); away(s, 'me');
  CMSim.tick(s);
  assert.ok(c.pitches.some(p => p.p === 'u'));
  settle(CMSim, s, T);
  assert.equal(s.players.u.st.sales, 1, 'her bargain price wins');
});

test('shopping lists: the most items within budget wins; the rest is bought elsewhere', () => {
  const { s, CMSim, CM_TUNE: T } = setup();
  shelf(s, 0, { fruit: 2 }); shelf(s, 1, { fruit: 2, cheese: 2 });
  const c = customer(s, { kind: 'list', x: 0, z: -1.5, want: ['fruit', 'cheese'], budget: 20 });
  place(s, 'me', -1.5, -2.5); place(s, 'u', 1.5, -2.5);
  CMSim.applyAction(s, { type: 'pitch', player: 'me', cust: c.id });
  CMSim.applyAction(s, { type: 'pitch', player: 'u', cust: c.id });
  away(s, 'me'); away(s, 'u');
  settle(CMSim, s, T);
  assert.equal(s.players.u.st.lists, 1);
  assert.ok(c.happy);
  const e = setup(), t = e.s;
  shelf(t, 0, { fruit: 2 }); shelf(t, 1, {});
  const d = customer(t, { kind: 'list', x: 0, z: -1.5, want: ['fruit', 'teapot'], budget: 30 });
  place(t, 'me', -1.5, -2.5); e.CMSim.applyAction(t, { type: 'pitch', player: 'me', cust: d.id }); away(t, 'me');
  settle(e.CMSim, t, T);
  assert.deepEqual(d.want, ['teapot']);
  assert.equal(d.budget, 25);
  assert.equal(d.ph, 'walk');
});

/* ---------- stealing ---------- */

test('steal: a customer on their way to a rival switches to you for a coin less, if you have their things', () => {
  const env = setup(), { s, CMSim } = env;
  shelf(s, 0, { fruit: 3 }); shelf(s, 1, { fruit: 3 });
  home(env, 'me');
  const c = going(env, 1, { x: -0.5 });   // on their way to Ursula, between the two stalls: inside both rings
  const was = c.deal.total;
  const r = CMSim.applyAction(s, { type: 'steal', player: 'me', cust: c.id });
  assert.ok(r.ok, r.reason);
  assert.equal(c.deal.p, 'me');
  assert.equal(c.deal.total, was - 1);
  assert.ok(c.deal.stolen);
  assert.equal(s.players.me.st.steals, 1);
  assert.equal(s.players.u.st.stolen, 1);
  assert.equal(CMSim.applyAction(s, { type: 'steal', player: 'me', cust: c.id }).reason, 'yours');
  // she can steal them back, then nobody can
  home(env, 'u');
  assert.ok(CMSim.applyAction(s, { type: 'steal', player: 'u', cust: c.id }).ok);
  assert.equal(CMSim.applyAction(s, { type: 'steal', player: 'me', cust: c.id }).reason, 'loyal');
});

test('steal: out of reach, out of stock, or not yet agreed is refused; walking up to them works anywhere', () => {
  const env = setup(), { s, CMSim, CM_TUNE: T } = env;
  shelf(s, 0, { fruit: 3 }); shelf(s, 1, { fruit: 3 });
  away(s, 'me');
  const c = going(env, 1, { x: 16 });
  assert.equal(CMSim.applyAction(s, { type: 'steal', player: 'me', cust: c.id }).reason, 'reach');
  place(s, 'me', 15, 0);
  assert.ok(CMSim.applyAction(s, { type: 'steal', player: 'me', cust: c.id }).ok, 'walked up to them');
  const d = going(env, 1, { x: 15.5 }); shelf(s, 0, {});
  assert.equal(CMSim.applyAction(s, { type: 'steal', player: 'me', cust: d.id }).reason, 'nostock');
  const w = customer(s, { x: 15, z: 0 });
  assert.equal(CMSim.applyAction(s, { type: 'steal', player: 'me', cust: w.id }).reason, 'busy');
  void T;
});

test('steal: with a Haggler it costs you nothing off; a stolen sale adds mult', () => {
  const env = setup(), { s, CMSim, CM_TUNE: T } = env;
  shelf(s, 0, { fruit: 3 }); shelf(s, 1, { fruit: 3 });
  s.players.me.staff.haggler = 1; home(env, 'me'); away(s, 'u');
  const c = going(env, 1, { x: CMSim.payAt(s.stalls[0]).x + 2 });
  const was = c.deal.total;
  CMSim.applyAction(s, { type: 'steal', player: 'me', cust: c.id });
  assert.equal(c.deal.total, was, 'no coin off');
  ticks(CMSim, s, 60);
  const sale = s.feed.find(e => e.k === 'sale' && e.p === 'me');
  assert.ok(sale && sale.stolen);
  assert.equal(sale.mult, 1 + T.SCORE.stealMult);
});

/* ---------- scoring ---------- */

test('scoring: every sale scores chips × mult; the hot streak grows with each sale', () => {
  const env = setup(), { s, CMSim, CM_TUNE: T } = env;
  shelf(s, 0, { fish: 10 }); shelf(s, 1, {}); home(env, 'me'); away(s, 'u');
  const pa = CMSim.payAt(s.stalls[0]);
  for (let i = 0; i < 3; i++) { customer(s, { x: pa.x - 2 - i * 0.3, z: -1, want: ['fish'], budget: 12 }); ticks(CMSim, s, 70); }
  const sales = s.feed.filter(e => e.k === 'sale' && e.p === 'me');
  assert.equal(sales.length, 3);
  assert.deepEqual(sales.map(e => e.mult), [1, 1 + T.SCORE.streakStep, 1 + 2 * T.SCORE.streakStep]);
  assert.deepEqual(sales.map(e => e.chips), [9, 9, 9]);
  assert.equal(s.players.me.score, sales.reduce((a, e) => a + e.gain, 0));
  assert.equal(sales[2].gain, Math.round(9 * (1 + 2 * T.SCORE.streakStep)));
});

test('scoring: losing a customer you pitched to ends your streak', () => {
  const env = setup(), { s, CMSim, CM_TUNE: T } = env;
  shelf(s, 0, { fruit: 5 }); shelf(s, 1, { fruit: 5 });
  s.players.me.streak.n = 4;
  const c = customer(s, { x: 0, z: -1.5 });
  place(s, 'me', -1.5, -2.5); place(s, 'u', 1.5, -2.5);
  CMSim.applyAction(s, { type: 'pitch', player: 'me', cust: c.id });   // your 5 loses to her 4
  CMSim.applyAction(s, { type: 'pitch', player: 'u', cust: c.id });
  settle(CMSim, s, T);
  assert.equal(s.players.me.streak.n, 0);
  assert.ok(s.feed.some(e => e.k === 'streakLost' && e.p === 'me' && e.n === 4));
});

test('scoring: a whole shopping list scores ×2 and pays a coin bonus', () => {
  const env = setup(), { s, CMSim, CM_TUNE: T } = env;
  shelf(s, 0, { fruit: 2, cheese: 2 }); home(env, 'me'); away(s, 'u'); shelf(s, 1, {});
  const pa = CMSim.payAt(s.stalls[0]);
  customer(s, { kind: 'list', x: pa.x - 2, z: -1, want: ['fruit', 'cheese'], budget: 20 });
  ticks(CMSim, s, 70);
  const sale = s.feed.find(e => e.k === 'sale');
  assert.ok(sale.full);
  assert.equal(sale.mult, T.SCORE.listX);
  assert.equal(sale.bonus, Math.round(16 * T.LIST_BONUS));
});

test('charms change the score: an item charm, chips, a time-of-day charm, the shopping bag, luck, coins and refunds', () => {
  const sale = (charms, over = {}) => {
    const env = setup(), { s, CMSim } = env;
    s.players.me.charms = charms;
    shelf(s, 0, over.stock || { fish: 3, bread: 3, fruit: 3, cheese: 3 }); home(env, 'me'); away(s, 'u'); shelf(s, 1, {});
    if (over.t) { s.tick = over.t * 10; s.t = over.t; s.part = CMSim.partAt(s.t, s.day); }
    const pa = CMSim.payAt(s.stalls[0]);
    customer(s, { x: pa.x - 2, z: -1, want: over.want || ['fish'], budget: 40, kind: over.kind || 'budget' });
    ticks(CMSim, s, 70);
    return { e: s.feed.find(e => e.k === 'sale' && e.p === 'me'), s };
  };
  assert.equal(sale(['bell']).e.mult, 2, 'bell: fish ×2');
  assert.equal(sale(['bell'], { want: ['bread'] }).e.mult, 1, 'bell does nothing for bread');
  assert.equal(sale(['dozen'], { want: ['bread'] }).e.chips, 5 + 4, 'dozen: +4 chips per bread');
  assert.equal(sale(['early']).e.mult, 3, 'early bird in the morning');
  assert.equal(sale(['early'], { t: 60 }).e.mult, 1, '...not in the evening');
  assert.equal(sale(['owl'], { t: 60 }).e.mult, 4, 'night owl in the evening');
  assert.equal(sale(['bag'], { kind: 'list', want: ['fruit', 'cheese'] }).e.mult, 3, 'shopping bag: ×3 for a whole list');
  assert.equal(sale(['piggy']).e.coin, 1, 'piggy bank');
  let lucky = 0; for (let i = 0; i < 40; i++) { const { e } = (() => { const env = setup({ seed: 100 + i }), { s, CMSim } = env; s.players.me.charms = ['lucky']; shelf(s, 0, { fish: 3 }); home(env, 'me'); away(s, 'u'); shelf(s, 1, {});
    const pa = CMSim.payAt(s.stalls[0]); customer(s, { x: pa.x - 2, z: -1, want: ['fish'], budget: 40 }); ticks(CMSim, s, 70); return { e: s.feed.find(e => e.k === 'sale') }; })(); if (e.lucky) { lucky++; assert.equal(e.mult, 2); } }
  assert.ok(lucky > 3 && lucky < 20, `lucky ${lucky} of 40`);
  const bin = setup(); bin.s.players.me.charms = ['bin']; shelf(bin.s, 0, { cheese: 4 }); away(bin.s, 'me'); closeNow(bin);
  assert.equal(bin.s.players.me.st.refund, 10, 'bargain bin: half of 4 cheese (20)');
});

test('the town crier and the bigger awning make your ring bigger', () => {
  const { s, CMSim, CM_TUNE: T } = setup();
  const p = s.players.me;
  assert.equal(CMSim.reachOf(p), T.STALL_REACH);
  p.charms = ['crier']; p.ups.awning = 1;
  assert.equal(CMSim.reachOf(p), T.STALL_REACH + 4);
});

/* ---------- the day, the run ---------- */

test('customers: single wants in the morning, shopping lists later; the day ends on time', () => {
  const { s, CMSim, CM_TUNE: T } = setup({ players: [{ id: 'me' }] });
  const kinds = { morning: {}, midday: {}, evening: {} }, at = {};
  while (s.phase === 'day') {
    CMSim.tick(s); at[s.part] ??= s.t;
    for (const e of s.feed) if (e.t === s.t && e.k === 'arrive') kinds[s.part][e.kind] = (kinds[s.part][e.kind] || 0) + 1;
  }
  assert.ok(!kinds.morning.list);
  assert.ok((kinds.midday.list || 0) + (kinds.evening.list || 0) > 0);
  assert.equal(at.midday, T.DAY / 3);
  assert.equal(at.evening, T.DAY * 2 / 3);
  assert.ok(Object.values(kinds).reduce((a, k) => a + (k.budget || 0) + (k.list || 0), 0) > 20, 'plenty of customers');
});

test('same seed, same day; a different seed, a different day', () => {
  const a = setup({ seed: 7 }), b = setup({ seed: 7 }), c = setup({ seed: 8 });
  for (const x of [a, b, c]) for (let i = 0; i < 600; i++) x.CMSim.tick(x.s);
  assert.deepEqual(a.s, b.s);
  assert.notDeepEqual(a.s.cust, c.s.cust);
});

test('closing: beat the target and you get coins (with interest) and a shop; miss it and the run is over', () => {
  const win = setup(), goal = win.s.run.target; win.s.players.me.score = goal * 2.5; win.s.players.me.coins = 12; closeNow(win);
  const W = win.CM_TUNE.RUN, r = win.s.result;
  assert.equal(win.s.phase, 'closed');
  assert.ok(r.passed);
  assert.equal(r.beat, W.beat);
  assert.equal(r.over, Math.min(W.over.max, Math.floor((2.5 - 1) / W.over.per)));
  assert.equal(r.interest, 2, '12 coins: 2 interest');
  assert.equal(win.s.players.me.coins, 12 + r.beat + r.over + r.interest);
  assert.equal(win.s.shop.offers.length, win.CM_TUNE.SHOP.offers);
  assert.equal(win.CMSim.applyAction(win.s, { type: 'move', player: 'me', x: 0, z: 0 }).reason, 'closed');
  const lose = setup(); lose.s.players.me.score = lose.s.run.target - 1; closeNow(lose);
  assert.equal(lose.s.phase, 'over');
  assert.ok(!lose.s.result.passed);
  assert.equal(lose.CMSim.nextDay(lose.s), null, 'no tomorrow');
  assert.equal(lose.CMSim.applyAction(lose.s, { type: 'reroll', player: 'me' }).reason, 'closed');
});

test('the run: three days a round, targets growing each round; coins, charms, staff and upgrades carry over', () => {
  const env = setup({ players: THREE }), { CMSim, CM_TUNE: T } = env;
  let s = env.s;
  const targets = [];
  for (let n = 0; n < 5; n++) {
    targets.push([s.run.round, s.run.day, s.run.target]);
    s.players.me.score = 1e6; closeNow({ CMSim, s });
    if (n === 0) { s.players.me.charms.push('bell'); s.players.me.staff.runner = 1; s.players.me.ups.legs = 1; }
    const next = CMSim.nextDay(s);
    assert.equal(next.players.me.coins, s.players.me.coins);
    assert.deepEqual(next.players.me.charms, ['bell']);
    assert.equal(next.players.me.score, 0);
    assert.equal(next.runners.filter(r => r.owner === 'me').length, 2);
    assert.deepEqual(next.stalls[0].stock, next.mix);
    assert.equal(JSON.stringify(CMSim.nextDay(s)), JSON.stringify(next), 'tomorrow comes from the seed');
    s = next;
  }
  const t = T.RUN.targets, g = T.RUN.grow, r10 = v => Math.round(v / 10) * 10;
  assert.deepEqual(targets, [[1, 1, t[0]], [1, 2, t[1]], [1, 3, t[2]], [2, 1, r10(t[0] * g)], [2, 2, r10(t[1] * g)]]);
});

test('the shop: charms up to five slots, staff and upgrades up to their max, rerolls that cost more each time, selling charms', () => {
  const env = setup(), { s, CMSim, CM_TUNE: T } = env;
  s.players.me.score = 1e6; closeNow(env);
  const p = s.players.me; p.coins = 500;
  const buy = o => { s.shop.offers = [o]; return CMSim.applyAction(s, { type: 'shopBuy', player: 'me', i: 0 }); };
  const keys = Object.keys(T.CHARMS);
  for (let i = 0; i < T.SHOP.slots; i++) assert.ok(buy({ kind: 'charm', key: keys[i], cost: 5 }).ok);
  assert.equal(buy({ kind: 'charm', key: keys[6], cost: 5 }).reason, 'slots');
  assert.ok(buy({ kind: 'staff', key: 'runner', cost: 8 }).ok);
  assert.ok(buy({ kind: 'staff', key: 'runner', cost: 8 }).ok);
  assert.equal(buy({ kind: 'staff', key: 'runner', cost: 8 }).reason, 'owned', 'max 2 extra runners');
  s.shop.offers = [{ kind: 'upgrade', key: 'awning', cost: 6, sold: false }];
  assert.ok(CMSim.applyAction(s, { type: 'shopBuy', player: 'me', i: 0 }).ok);
  assert.equal(CMSim.applyAction(s, { type: 'shopBuy', player: 'me', i: 0 }).reason, 'bad', 'sold already');
  const before = p.coins;
  assert.ok(CMSim.applyAction(s, { type: 'reroll', player: 'me' }).ok);
  assert.ok(CMSim.applyAction(s, { type: 'reroll', player: 'me' }).ok);
  assert.equal(before - p.coins, T.SHOP.reroll * 2 + T.SHOP.rerollUp);
  assert.ok(s.shop.offers.every(o => !(o.kind === 'charm' && p.charms.includes(o.key))), 'never offers what you own');
  const r = CMSim.applyAction(s, { type: 'sellCharm', player: 'me', key: keys[0] });
  assert.equal(r.coins, Math.floor(T.CHARMS[keys[0]].cost * T.SHOP.sell));
  assert.equal(p.charms.length, T.SHOP.slots - 1);
  p.coins = 0;
  assert.equal(CMSim.applyAction(s, { type: 'reroll', player: 'me' }).reason, 'broke');
});

test('replay: a start state plus the action log rebuilds the exact same day, on any day of the run', () => {
  const env = setup({ seed: 4242, players: THREE });
  const { CMSim, s } = env;
  const { log } = playDay(env, { until: 500, script: (s, act) => {
    if (s.tick === 5) act({ type: 'order', player: 'me', item: 'fish' });
    if (s.tick === 40) act({ type: 'stance', player: 'me', stance: 'bargain' });
  } });
  assert.deepEqual(CMSim.replay(env.init, JSON.parse(JSON.stringify(log)), s.tick), s);
  s.players.me.score = 1e6; while (s.phase === 'day') CMSim.tick(s);
  const d2 = CMSim.nextDay(s), start = CMSim.clone(d2);
  const run2 = playDay({ ...env, s: d2 }, { until: 400 });
  assert.deepEqual(CMSim.replay(start, run2.log, d2.tick), d2);
});
