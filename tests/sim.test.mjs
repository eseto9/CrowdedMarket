import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, place, home, away, shelf, customer, ticks, playDay, THREE } from './helpers.mjs';

test('a new day: one stall each, starting coins, list prices, the same opening stock for everyone; plain JSON', () => {
  const { s, CM_TUNE: T } = setup({ players: THREE });
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
  assert.deepEqual(s.stalls.map(st => st.owner), ['me', 'u', 'h', null]);
  assert.equal(s.players.me.coins, T.START_COINS);
  assert.equal(s.stalls[1].price.fish, T.GOODS.fish.list);
  for (const st of s.stalls.slice(0, 3)) assert.deepEqual(st.stock, s.mix, 'everyone opens with the same mix');
  assert.deepEqual(s.stalls[3].stock, {});
  assert.equal(s.phase, 'day');
  assert.deepEqual(s.week, { n: 1, of: T.WEEK });
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
  assert.ok(mixes.size > 10, 'plenty of different openings');
});

test('the board: every post and supplier spot is free to stand on, stalls and props are not', () => {
  const { s, CMSim, CM_TUNE: T } = setup();
  for (const st of s.stalls) {
    const b = CMSim.post(st), pa = CMSim.payAt(st);
    assert.ok(!CMSim.blocked(b.x, b.z), `post of stall ${st.id}`);
    assert.ok(!CMSim.blocked(pa.x, pa.z), `pay spot of stall ${st.id}`);
    assert.ok(CMSim.blocked(st.x, st.z), `stall ${st.id} itself`);
  }
  for (const [g, sp] of Object.entries(T.SUPPLIERS)) {
    assert.ok(!CMSim.blocked(sp.x, sp.z), `${g} spot`);
    const [x0, x1, z0, z1] = sp.prop;
    assert.ok(CMSim.blocked((x0 + x1) / 2, (z0 + z1) / 2), `${g} prop`);
    assert.ok(Math.hypot(Math.max(x0 - sp.x, 0, sp.x - x1), Math.max(z0 - sp.z, 0, sp.z - z1)) < T.SUPPLIER_RANGE, `${g} prop is beside its spot`);
  }
  assert.ok(CMSim.blocked(T.BOARD.x1 + 1, 0), 'off the board');
});

test('unknown actions, unknown players and bad input are refused', () => {
  const { s, CMSim } = setup();
  assert.equal(CMSim.applyAction(s, { type: 'teleport', player: 'me' }).reason, 'unknown');
  assert.equal(CMSim.applyAction(s, { type: 'move', player: 'nobody', x: 0, z: 0 }).reason, 'noplayer');
  assert.equal(CMSim.applyAction(s, { type: 'move', player: 'me', x: NaN, z: 0 }).reason, 'bad');
  assert.equal(CMSim.applyAction(s, { type: 'buy', player: 'me', item: 'gold' }).reason, 'bad');
  assert.equal(CMSim.applyAction(s, null).reason, 'unknown');
});

test('move: nobody goes faster than a dash, off the board or through a stall', () => {
  const { s, CMSim, CM_TUNE: T } = setup();
  const p = s.players.me, x0 = p.x;
  ticks(CMSim, s, 10);   // one second since the last move
  const r = CMSim.applyAction(s, { type: 'move', player: 'me', x: x0 + 100, z: p.z });
  assert.ok(r.ok && r.clamped);
  assert.ok(p.x - x0 <= T.DASH.speed * T.MOVE_SLACK + 0.3 + 1e-9);
  ticks(CMSim, s, 100);
  CMSim.applyAction(s, { type: 'move', player: 'me', x: 999, z: 0 });
  assert.ok(p.x <= T.BOARD.x1);
  const st = s.stalls[1]; place(s, 'me', st.x, st.z + 2); ticks(CMSim, s, 5);
  CMSim.applyAction(s, { type: 'move', player: 'me', x: st.x, z: st.z });
  assert.ok(!CMSim.blocked(p.x, p.z, T.BEAN_R - 0.01));
});

test('buy: only at the supplier, only what you can carry and afford', () => {
  const { s, CMSim, CM_TUNE: T } = setup();
  const p = s.players.me;
  assert.equal(CMSim.applyAction(s, { type: 'buy', player: 'me', item: 'fish', n: 2 }).reason, 'far');
  place(s, 'me', T.SUPPLIERS.fish.x, T.SUPPLIERS.fish.z);
  assert.ok(CMSim.applyAction(s, { type: 'buy', player: 'me', item: 'fish', n: 2 }).ok);
  assert.equal(p.carry.fish, 2);
  assert.equal(p.coins, T.START_COINS - 2 * T.GOODS.fish.cost);
  assert.equal(CMSim.applyAction(s, { type: 'buy', player: 'me', item: 'fish', n: 10 }).n, T.CARRY - 2);
  assert.equal(CMSim.applyAction(s, { type: 'buy', player: 'me', item: 'fish' }).reason, 'full');
  p.carry = {}; p.coins = 3;
  assert.equal(CMSim.applyAction(s, { type: 'buy', player: 'me', item: 'fish' }).reason, 'broke');
  assert.equal(p.coins, 3);
});

test('shelve: only at your own stall; stock moves from your arms to the shelf', () => {
  const env = setup(), { s, CMSim } = env;
  const p = s.players.me; shelf(s, 0, {});
  p.carry = { fish: 3, cheese: 1 };
  const b = CMSim.post(s.stalls[1]); place(s, 'me', b.x, b.z);
  assert.equal(CMSim.applyAction(s, { type: 'shelve', player: 'me' }).reason, 'far');
  home(env, 'me');
  const r = CMSim.applyAction(s, { type: 'shelve', player: 'me' });
  assert.ok(r.ok); assert.equal(r.n, 4);
  assert.deepEqual(s.stalls[0].stock, { fish: 3, cheese: 1 });
  assert.equal(CMSim.applyAction(s, { type: 'shelve', player: 'me' }).reason, 'empty');
});

test('setPrice: at your stall, never below supply cost; undercuts are counted', () => {
  const env = setup(), { s, CMSim, CM_TUNE: T } = env;
  shelf(s, 0, { fruit: 3 }); shelf(s, 1, { fruit: 3 });
  assert.equal(CMSim.applyAction(s, { type: 'setPrice', player: 'me', item: 'fruit', price: T.GOODS.fruit.cost - 1 }).reason, 'belowcost');
  assert.equal(CMSim.applyAction(s, { type: 'setPrice', player: 'me', item: 'fruit', price: T.PRICE_MAX + 1 }).reason, 'toohigh');
  place(s, 'me', 20, 0);
  assert.equal(CMSim.applyAction(s, { type: 'setPrice', player: 'me', item: 'fruit', price: 4 }).reason, 'far');
  home(env, 'me');
  const r = CMSim.applyAction(s, { type: 'setPrice', player: 'me', item: 'fruit', price: 4 });
  assert.ok(r.ok && r.undercut);
  assert.equal(s.players.me.st.undercuts, 1);
  assert.deepEqual([s.feed.at(-1).k, s.feed.at(-1).vs], ['undercut', 'u']);
  assert.ok(!CMSim.applyAction(s, { type: 'setPrice', player: 'me', item: 'fruit', price: 3 }).undercut, 'already cheapest');
  assert.equal(s.players.me.st.undercuts, 1);
});

test('price war: undercutting back and forth on one good starts a war, which ends after a quiet spell', () => {
  const env = setup(), { s, CMSim, CM_TUNE: T } = env;
  shelf(s, 0, { fruit: 3 }); shelf(s, 1, { fruit: 3 });
  home(env, 'me'); home(env, 'u');
  CMSim.applyAction(s, { type: 'setPrice', player: 'me', item: 'fruit', price: 4 });
  assert.deepEqual(s.wars, {}, 'one undercut is not a war');
  ticks(CMSim, s, 30);
  CMSim.applyAction(s, { type: 'setPrice', player: 'u', item: 'fruit', price: 3 });
  assert.ok(s.wars.fruit, 'undercut back: war');
  assert.ok(s.feed.some(e => e.k === 'war' && e.item === 'fruit'));
  ticks(CMSim, s, T.WAR.last / T.DT - 5);
  assert.ok(s.wars.fruit, 'still on');
  ticks(CMSim, s, 10);
  assert.ok(!s.wars.fruit, 'over');
  assert.ok(s.feed.some(e => e.k === 'peace' && e.item === 'fruit'));
  // a slow reply isn't a war
  const b = setup(), bs = b.s;
  shelf(bs, 0, { fish: 3 }); shelf(bs, 1, { fish: 3 }); home(b, 'me'); home(b, 'u');
  b.CMSim.applyAction(bs, { type: 'setPrice', player: 'me', item: 'fish', price: 8 });
  ticks(b.CMSim, bs, (T.WAR.window + 2) / T.DT);
  b.CMSim.applyAction(bs, { type: 'setPrice', player: 'u', item: 'fish', price: 7 });
  assert.deepEqual(bs.wars, {});
});

test('a price war brings in more customers wanting that good', () => {
  const count = war => { let n = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const { s, CMSim } = setup({ seed, players: [{ id: 'me' }] });
      s.stalls[0].stock = {};
      while (s.phase === 'day') { if (war) s.wars.cheese = { a: 'x', b: 'y', until: 1e9 }; CMSim.tick(s); for (const e of s.feed) if (e.t === s.t && e.k === 'arrive' && e.want.includes('cheese')) n++; }
    } return n; };
  assert.ok(count(true) > count(false) * 1.3);
});

test('pitch: needs you near the customer, the customer inside your range, stock and a price in budget', () => {
  const env = setup(), { s, CMSim } = env;
  shelf(s, 0, {}); shelf(s, 1, {});
  const pa = CMSim.payAt(s.stalls[0]);
  const c = customer(s, { x: pa.x, z: -1.5, want: ['fish'], budget: 12 });
  place(s, 'me', 15, 0);
  assert.equal(CMSim.applyAction(s, { type: 'pitch', player: 'me', cust: c.id }).reason, 'far');
  place(s, 'me', pa.x + 1.5, -2.5);
  assert.equal(CMSim.applyAction(s, { type: 'pitch', player: 'me', cust: c.id }).reason, 'nostock');
  s.stalls[0].stock.fish = 1; s.stalls[0].price.fish = 13;
  assert.equal(CMSim.applyAction(s, { type: 'pitch', player: 'me', cust: c.id }).reason, 'pricey');
  assert.equal(s.feed.at(-1).k, 'pricey');
  const far = customer(s, { x: 18, z: 0, want: ['fruit'], budget: 9 });
  place(s, 'me', 17, 0);
  assert.equal(CMSim.applyAction(s, { type: 'pitch', player: 'me', cust: far.id }).reason, 'reach');
  assert.equal(CMSim.applyAction(s, { type: 'pitch', player: 'me', cust: 'c999' }).reason, 'gone');
});

test('budget customer: buys from the cheapest pitch under budget; a tie goes to whoever pitched first', () => {
  const { s, CMSim, CM_TUNE: T } = setup();
  shelf(s, 0, { fruit: 3 }); shelf(s, 1, { fruit: 3 });
  s.stalls[1].price.fruit = 4;
  const c = customer(s, { x: 0, z: -1.5 });
  place(s, 'me', -1.5, -2.5); place(s, 'u', 1.5, -2.5);
  assert.ok(CMSim.applyAction(s, { type: 'pitch', player: 'me', cust: c.id }).ok);
  assert.ok(CMSim.applyAction(s, { type: 'pitch', player: 'u', cust: c.id }).ok);
  ticks(CMSim, s, Math.ceil((T.DECIDE + 6) / T.DT));
  assert.equal(s.players.u.coins, T.START_COINS + 4);
  assert.equal(s.stalls[1].stock.fruit, 2);
  assert.equal(s.players.me.coins, T.START_COINS);
  assert.deepEqual(s.players.u.st.best, { items: ['fruit'], price: 4 });
  for (const first of ['me', 'u']) {
    const e = setup(), t = e.s;
    shelf(t, 0, { fruit: 3 }); shelf(t, 1, { fruit: 3 });
    const d = customer(t, { x: 0, z: -1.5 });
    place(t, 'me', -1.5, -2.5); place(t, 'u', 1.5, -2.5);
    const second = first === 'me' ? 'u' : 'me';
    e.CMSim.applyAction(t, { type: 'pitch', player: first, cust: d.id }); e.CMSim.tick(t);
    e.CMSim.applyAction(t, { type: 'pitch', player: second, cust: d.id });
    ticks(e.CMSim, t, Math.ceil((T.DECIDE + 6) / T.DT));
    assert.equal(t.players[first].coins, T.START_COINS + 5, `${first} pitched first and should win`);
  }
});

test('the price is agreed when they choose; an empty shelf by the time they arrive loses the sale', () => {
  const env = setup(), { s, CMSim, CM_TUNE: T } = env;
  shelf(s, 0, { fruit: 3 });
  const b = home(env, 'me');
  const c = customer(s, { x: b.x, z: -1 });
  CMSim.applyAction(s, { type: 'pitch', player: 'me', cust: c.id });
  ticks(CMSim, s, Math.ceil(T.DECIDE / T.DT) + 1);
  assert.equal(c.ph, 'go');
  assert.deepEqual(c.deal.prices, { fruit: 5 });
  s.stalls[0].stock.fruit = 0;
  away(s, 'me');
  ticks(CMSim, s, 60);
  assert.equal(s.players.me.coins, T.START_COINS);
  assert.ok(s.feed.some(e => e.k === 'soldout'));
});

test('auto-sell: standing at your stall pitches customers who walk into your range; away, nothing happens', () => {
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
  const yes = run(true), no = run(false);
  assert.ok(yes.feed.some(e => e.k === 'pitch' && e.auto && e.p === 'me'));
  assert.equal(yes.players.me.st.sales, 1);
  assert.ok(!no.feed.some(e => e.k === 'pitch'));
  assert.equal(no.players.me.st.sales, 0);
});

test('auto-sell joins a customer who is already deciding, so the first stall to reach them does not lock others out', () => {
  const env = setup(), { s, CMSim, CM_TUNE: T } = env;
  shelf(s, 0, { fish: 2 }); shelf(s, 1, { fish: 2 });
  s.stalls[1].price.fish = 7;   // Ursula is cheaper
  home(env, 'u'); away(s, 'me');
  const c = customer(s, { x: 0, z: -1.5, want: ['fish'], budget: 12 });
  place(s, 'me', -1.5, -2.5);
  CMSim.applyAction(s, { type: 'pitch', player: 'me', cust: c.id });   // you pitch first, by hand
  away(s, 'me');
  CMSim.tick(s);
  assert.ok(c.pitches.some(p => p.p === 'u'), 'her stall pitched them while they were deciding');
  ticks(CMSim, s, Math.ceil((T.DECIDE + 6) / T.DT));
  assert.equal(s.players.u.st.sales, 1, 'the cheaper stall wins');
});

test('shopping list: the most items within budget wins; a full list earns a bonus; the rest is bought elsewhere', () => {
  const { s, CMSim, CM_TUNE: T } = setup();
  shelf(s, 0, { fruit: 2 }); shelf(s, 1, { fruit: 2, cheese: 2 });
  s.stalls[0].price.fruit = 3;   // cheaper, but only one of the two things
  const c = customer(s, { kind: 'list', x: 0, z: -1.5, want: ['fruit', 'cheese'], budget: 20 });
  assert.deepEqual(CMSim.offer(s, c, s.stalls[0]), { ok: true, items: ['fruit'], total: 3, full: false });
  assert.deepEqual(CMSim.offer(s, c, s.stalls[1]), { ok: true, items: ['fruit', 'cheese'], total: 16, full: true });
  place(s, 'me', -1.5, -2.5); place(s, 'u', 1.5, -2.5);
  CMSim.applyAction(s, { type: 'pitch', player: 'me', cust: c.id });
  CMSim.applyAction(s, { type: 'pitch', player: 'u', cust: c.id });
  away(s, 'me'); away(s, 'u');
  ticks(CMSim, s, Math.ceil((T.DECIDE + 6) / T.DT));
  const bonus = Math.round(16 * T.LIST.bonus);
  assert.equal(s.players.u.coins, T.START_COINS + 16 + bonus);
  assert.equal(s.players.u.st.bonus, bonus);
  assert.ok(c.happy && c.ph === 'leave');
  // a list only one stall can half-fill: buys that half, then goes on looking
  const e = setup(), t = e.s;
  shelf(t, 0, { fruit: 2 }); shelf(t, 1, {});
  const d = customer(t, { kind: 'list', x: 0, z: -1.5, want: ['fruit', 'teapot'], budget: 30 });
  place(t, 'me', -1.5, -2.5);
  e.CMSim.applyAction(t, { type: 'pitch', player: 'me', cust: d.id });
  away(t, 'me');
  ticks(e.CMSim, t, Math.ceil((T.DECIDE + 6) / T.DT));
  assert.equal(t.players.me.coins, T.START_COINS + 5);
  assert.equal(t.players.me.st.bonus, 0);
  assert.deepEqual(d.want, ['teapot']);
  assert.equal(d.budget, 25);
  assert.equal(d.ph, 'walk');
});

test('offer: the cheapest things first, as many as the budget allows', () => {
  const { s, CMSim } = setup();
  shelf(s, 0, { fruit: 1, cheese: 1, teapot: 1 });
  const c = customer(s, { kind: 'list', want: ['teapot', 'cheese', 'fruit'], budget: 17 });
  assert.deepEqual(CMSim.offer(s, c, s.stalls[0]), { ok: true, items: ['fruit', 'cheese'], total: 16, full: false });
  c.budget = 4;
  assert.equal(CMSim.offer(s, c, s.stalls[0]).reason, 'pricey');
  shelf(s, 0, {});
  assert.equal(CMSim.offer(s, c, s.stalls[0]).reason, 'nostock');
});

test('customers stop for a look at stalls that have something they want, once each', () => {
  const { s, CMSim } = setup();
  shelf(s, 0, { bread: 3 }); shelf(s, 1, { bread: 3 }); away(s, 'me'); away(s, 'u');
  const c = customer(s, { x: s.stalls[0].x - 6, z: -1, lane: -1, dir: 1, want: ['bread'], budget: 9 });
  let browsed = 0, prev = c.ph;
  for (let i = 0; i < 120; i++) { CMSim.tick(s); if (c.ph === 'browse' && prev !== 'browse') browsed++; prev = c.ph; }
  assert.equal(browsed, 2);
  assert.deepEqual(c.looked, [0, 1]);
});

test('customers spawn from the seed: single wants in the morning, shopping lists later, never past the cap', () => {
  const { s, CMSim, CM_TUNE: T } = setup({ players: [{ id: 'me' }] });
  let most = 0; const kinds = { morning: {}, midday: {}, evening: {} };
  while (s.phase === 'day') {
    CMSim.tick(s); most = Math.max(most, s.cust.length);
    for (const e of s.feed) if (e.t === s.t && e.k === 'arrive') {
      kinds[s.part][e.kind] = (kinds[s.part][e.kind] || 0) + 1;
      assert.equal(new Set(e.want).size, e.want.length, 'no repeats on a list');
      if (e.kind === 'list') assert.ok(e.want.length >= T.LIST.items[0] && e.want.length <= T.LIST.items[1]);
      else assert.ok(e.budget >= Math.round(T.GOODS[e.want[0]].list * T.BUDGET_MULT[0]));
    }
    for (const c of s.cust) assert.ok(Math.abs(c.z) <= T.BOARD.street.z1 + 0.5);
  }
  assert.ok(most <= T.CUST_MAX);
  assert.ok(!kinds.morning.list, 'no lists in the morning');
  assert.ok((kinds.midday.list || 0) + (kinds.evening.list || 0) > 0, 'lists later on');
});

test('a day lasts 1, 2 or 3 minutes, in three equal parts', () => {
  const { CMSim, CM_TUNE: T } = setup();
  assert.deepEqual(Object.values(T.DAYS), [60, 120, 180]);
  for (const [len, day] of Object.entries(T.DAYS)) {
    const s = CMSim.newState({ seed: 3, len, players: [{ id: 'me' }] });
    const at = {};
    while (s.phase === 'day') { CMSim.tick(s); at[s.part] ??= s.t; }
    assert.equal(s.t, day);
    assert.equal(at.midday, day / 3);
    assert.equal(at.evening, day * 2 / 3);
  }
});

test('same seed, same day; a different seed, a different day', () => {
  const a = setup({ seed: 7 }), b = setup({ seed: 7 }), c = setup({ seed: 8 });
  for (const x of [a, b, c]) for (let i = 0; i < 900; i++) x.CMSim.tick(x.s);
  assert.deepEqual(a.s, b.s);
  assert.notDeepEqual(a.s.cust, c.s.cust);
});

test('closing: stock is worthless, actions stop, the recap ranks everyone and hands out titles', () => {
  const { s, CMSim } = setup();
  shelf(s, 0, { bread: 3, fruit: 3 }); away(s, 'me');
  s.players.me.carry = { fish: 2 };
  while (s.phase === 'day') CMSim.tick(s);
  assert.equal(s.t, s.day);
  assert.deepEqual(s.cust, []);
  assert.equal(CMSim.applyAction(s, { type: 'move', player: 'me', x: 0, z: 0 }).reason, 'closed');
  const me = s.recap.rows.find(r => r.id === 'me');
  assert.equal(me.wasted, 8);
  assert.equal(s.recap.titles[0].title, 'Top of the Day');
  assert.equal(s.recap.last, false);
  const per = {}; for (const t of s.recap.titles) per[t.p] = (per[t.p] || 0) + 1;
  assert.ok(Object.values(per).every(n => n <= 2));
});

test('a market week: three days, coins and upgrades carry over, a fresh shelf and mix each morning', () => {
  const { s, CMSim, CM_TUNE: T } = setup({ players: THREE });
  let day = s;
  for (let n = 1; n <= T.WEEK; n++) {
    assert.equal(day.week.n, n);
    while (day.phase === 'day') CMSim.tick(day);
    if (n < T.WEEK) {
      day.players.me.coins += 50;   // pretend it was a good day
      assert.ok(CMSim.applyAction(day, { type: 'upgrade', player: 'me', kind: 'crate' }).ok || n > 1);
      const next = CMSim.nextDay(day);
      assert.equal(next.players.me.coins, day.players.me.coins, 'coins carry over');
      assert.ok(next.players.me.ups.crate, 'upgrades carry over');
      assert.equal(next.players.me.st.sales, 0, 'stats start fresh');
      assert.deepEqual(next.stalls[0].stock, next.mix);
      assert.equal(next.week.before.length, n);
      assert.equal(JSON.stringify(CMSim.nextDay(day)), JSON.stringify(next), 'the next day comes from the seed');
      day = next;
    }
  }
  assert.equal(day.recap.last, true);
  assert.equal(day.recap.titles[0].title, 'Market Champion');
  assert.equal(CMSim.nextDay(day), null, 'the week is over');
  assert.equal(CMSim.applyAction(day, { type: 'upgrade', player: 'me', kind: 'boots' }).reason, 'closed', 'no shopping after the last day');
});

test('upgrades: only between days, once each, paid for; and they do what they say', () => {
  const env = setup(), { s, CMSim, CM_TUNE: T } = env;
  const p = s.players.me;
  assert.equal(CMSim.applyAction(s, { type: 'upgrade', player: 'me', kind: 'crate' }).reason, 'closed', 'not during the day');
  while (s.phase === 'day') CMSim.tick(s);
  p.coins = 100;
  assert.equal(CMSim.applyAction(s, { type: 'upgrade', player: 'me', kind: 'wings' }).reason, 'bad');
  for (const k of Object.keys(T.UPGRADES)) assert.ok(CMSim.applyAction(s, { type: 'upgrade', player: 'me', kind: k }).ok);
  assert.equal(p.coins, 100 - Object.values(T.UPGRADES).reduce((a, u) => a + u.cost, 0));
  assert.equal(CMSim.applyAction(s, { type: 'upgrade', player: 'me', kind: 'crate' }).reason, 'owned');
  const e = setup(); while (e.s.phase === 'day') e.CMSim.tick(e.s); e.s.players.me.coins = 1;
  assert.equal(e.CMSim.applyAction(e.s, { type: 'upgrade', player: 'me', kind: 'boots' }).reason, 'broke');
  const d = CMSim.nextDay(s);
  const q = d.players.me;
  assert.equal(CMSim.capOf(q), T.CARRY + T.UPGRADES.crate.carry);
  assert.equal(CMSim.reachOf(q), T.STALL_REACH + T.UPGRADES.awning.reach);
  assert.equal(CMSim.speedOf(q), T.UPGRADES.boots.speed);
  place(d, 'me', T.SUPPLIERS.bread.x, T.SUPPLIERS.bread.z);
  assert.equal(CMSim.applyAction(d, { type: 'buy', player: 'me', item: 'bread', n: 20 }).n, T.CARRY + T.UPGRADES.crate.carry);
  // the bigger awning: a customer just past the normal range can be pitched
  const pa = CMSim.payAt(d.stalls[0]); shelf(d, 0, { fish: 1 });
  const c = customer(d, { x: pa.x + T.STALL_REACH + 1, z: -1, want: ['fish'], budget: 12 });
  place(d, 'me', c.x - 1.5, -2);
  assert.ok(CMSim.applyAction(d, { type: 'pitch', player: 'me', cust: c.id }).ok);
});

test('replay: a start state plus the action log rebuilds the exact same day, on any day of the week', () => {
  const env = setup({ seed: 4242 });
  const { CMSim, CM_TUNE: T, s } = env;
  const sup = T.SUPPLIERS.bread, homeAt = CMSim.post(s.stalls[0]);
  const route = [[homeAt.x, homeAt.z], [-8, -3.4], [-8, -7.5], [sup.x, sup.z]];
  let leg = 0;
  const walk = (s, act, pts) => { const p = s.players.me; while (leg < pts.length - 1 && Math.hypot(pts[leg][0] - p.x, pts[leg][1] - p.z) < 0.05) leg++;
    const [x, z] = pts[leg], d = Math.hypot(x - p.x, z - p.z), k = Math.min(1, T.WALK * T.DT / (d || 1)); act({ type: 'move', player: 'me', x: p.x + (x - p.x) * k, z: p.z + (z - p.z) * k }); };
  let phase = 'out';
  const { log, results } = playDay(env, {
    until: 900,
    script: (s, act) => {
      const p = s.players.me;
      if (phase === 'out') { walk(s, act, route); if (Math.hypot(p.x - sup.x, p.z - sup.z) < 0.3) { act({ type: 'buy', player: 'me', item: 'bread', n: 4 }); phase = 'back'; leg = 0; } }
      else if (phase === 'back') { walk(s, act, route.slice().reverse()); if (Math.hypot(p.x - homeAt.x, p.z - homeAt.z) < 0.3) { act({ type: 'shelve', player: 'me' }); phase = 'done'; } }
    },
  });
  assert.equal(phase, 'done');
  assert.ok(results.find(x => x.a.type === 'shelve' && x.a.player === 'me').r.ok);
  assert.deepEqual(CMSim.replay(env.init, JSON.parse(JSON.stringify(log)), s.tick), s);
  // day two, from the state it started with
  while (s.phase === 'day') CMSim.tick(s);
  const d2 = CMSim.nextDay(s), start = CMSim.clone(d2), e2 = { ...env, s: d2 };
  const run2 = playDay(e2, { until: 600 });
  assert.deepEqual(CMSim.replay(start, run2.log, d2.tick), d2);
});
