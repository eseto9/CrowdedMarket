import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, playDay, shelf, home, THREE } from './helpers.mjs';

// what an AI may be refused without anything being wrong: a customer moving on mid-pitch,
// or auto-selling having already pitched them
const fine = x => x.r.ok || (x.a.type === 'pitch' && ['gone', 'busy', 'already'].includes(x.r.reason));

test('three shopkeepers trade a whole day through the same actions as a player', () => {
  const env = setup({ seed: 31, players: THREE });
  const t0 = Date.now();
  const { results } = playDay(env);
  const ms = Date.now() - t0;
  const { s, CM_TUNE: T } = env;
  assert.equal(s.phase, 'closed');
  for (const id of ['u', 'h']) {
    const r = s.recap.rows.find(r => r.id === id);
    assert.ok(r.sales >= 4, `${id}: only ${r.sales} sales`);
    assert.ok(r.coins > T.START_COINS + 10, `${id} ended with ${r.coins}`);
    assert.ok(results.some(x => x.a.player === id && x.a.type === 'buy' && x.r.ok), `${id} never restocked`);
  }
  assert.ok(!results.some(x => x.a.type === 'move' && x.r.clamped), 'moved faster than allowed');
  assert.deepEqual(results.filter(x => !fine(x)).map(x => [x.a.player, x.a.type, x.r.reason]), []);
  assert.ok(ms < 3000, `a day took ${ms} ms`);
});

test('the Hoarder fetches bigger loads than the Undercutter', () => {
  let h = [], u = [];
  for (const seed of [44, 45, 46]) {
    const env = setup({ seed, players: THREE });
    const { results } = playDay(env);
    const buys = id => results.filter(x => x.a.player === id && x.a.type === 'buy' && x.r.ok).map(x => x.r.n);
    h = h.concat(buys('h')); u = u.concat(buys('u'));
  }
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  assert.ok(h.length && u.length);
  assert.ok(avg(h) > avg(u), `Hattie ${avg(h).toFixed(1)} vs Ursula ${avg(u).toFixed(1)}`);
});

test('the AI walks round things, never through them', () => {
  const env = setup({ seed: 12, players: THREE });
  const { CMSim, CM_TUNE: T } = env;
  const where = new Set();
  playDay(env, { script: s => { for (const id of ['u', 'h']) { const p = s.players[id]; assert.ok(!CMSim.blocked(p.x, p.z, T.BEAN_R - 0.05), `${id} inside something at ${p.x},${p.z}`); where.add(id + Math.round(p.x / 4) + ',' + Math.round(p.z / 4)); } } });
  assert.ok(where.size > 12, 'they got about');
});

test('every supplier can be reached from every stall', () => {
  const { s, CMSim, CMNav, CM_TUNE: T } = setup();
  const G = CMNav.boardGrid();
  for (const st of s.stalls) for (const [g, sp] of Object.entries(T.SUPPLIERS)) {
    const b = CMSim.post(st), pts = CMNav.path(G, b.x, b.z, sp.x, sp.z);
    let x = b.x, z = b.z;
    for (const [px, pz] of pts) {
      const n = Math.ceil(Math.hypot(px - x, pz - z) / 0.2);
      for (let i = 1; i <= n; i++) assert.ok(!CMSim.blocked(x + (px - x) * i / n, z + (pz - z) * i / n, T.BEAN_R - 0.05), `stall ${st.id} → ${g}`);
      x = px; z = pz;
    }
    assert.ok(Math.hypot(x - sp.x, z - sp.z) < 0.01);
  }
});

test('the Undercutter prices just under a rival, down to her floor; the Hoarder matches but never undercuts', () => {
  const env = setup({ seed: 5, players: THREE });
  const { s, CM_TUNE: T } = env;
  for (const i of [0, 1, 2]) shelf(s, i, { bread: 6 });
  s.stalls[0].price.bread = 5;
  const run = playDay(env, { until: 20 });
  assert.equal(s.stalls[1].price.bread, 4, 'one under');
  assert.equal(s.stalls[2].price.bread, Math.max(T.GOODS.bread.cost + 1, Math.round(T.GOODS.bread.list * T.RIVALS.hoarder.hold)), 'Hattie matches down to her floor, no lower');
  s.stalls[0].price.bread = 2;
  playDay(env, { until: 40, mems: run.mems });
  assert.equal(s.stalls[1].price.bread, T.GOODS.bread.cost + T.RIVALS.undercutter.floorMargin, 'but never below her floor');
});

test('a price war with the player: the Undercutter fights back', () => {
  const env = setup({ seed: 9 });
  const { s } = env;
  shelf(s, 0, { fish: 6 }); shelf(s, 1, { fish: 6 });   // fish: room between cost and list to fight over
  home(env, 'me');
  let cuts = 0;
  playDay(env, { until: 300, script: (s, act) => {
    const mine = s.stalls[0].price.fish, hers = s.stalls[1].price.fish;
    if (s.tick % 20 === 0 && hers <= mine && hers - 1 >= 5 && s.stalls[1].stock.fish > 0) { act({ type: 'setPrice', player: 'me', item: 'fish', price: hers - 1 }); cuts++; }
  } });
  assert.ok(cuts >= 1);
  assert.ok(s.feed.some(e => e.k === 'war' && e.item === 'fish'), 'she fought back, and it became a war');
});

test('a whole week: the AI buys upgrades between days and keeps trading', () => {
  const env = setup({ seed: 21, players: THREE });
  const { CMSim, CMAI, CM_TUNE: T } = env;
  let s = env.s;
  const mems = s.order.filter(id => s.players[id].ai).map((id, i) => CMAI.newMem(id, s.players[id].ai, s.diff, 7 + i));
  const bought = [];
  for (let n = 1; n <= T.WEEK; n++) {
    const { results } = playDay({ ...env, s }, { mems });
    assert.deepEqual(results.filter(x => !fine(x)).map(x => [x.a.player, x.a.type, x.r.reason]), [], `day ${n}`);
    if (n === T.WEEK) break;
    for (const m of mems) for (const a of CMAI.betweenDays(s, m)) { const r = CMSim.applyAction(s, a); assert.ok(r.ok, a.kind + ' ' + r.reason); bought.push(a.player + ':' + a.kind); }
    s = CMSim.nextDay(s); mems.forEach(CMAI.newDay);
  }
  assert.ok(bought.length >= 2, `bought ${bought}`);
  assert.ok(s.recap.last);
  for (const id of ['u', 'h']) assert.ok(s.players[id].coins > T.START_COINS, `${id} ended the week with ${s.players[id].coins}`);
});

test('difficulty: faster and sharper on hard, never beyond a walk', () => {
  const { CM_TUNE: T } = setup();
  for (const d of ['easy', 'normal', 'hard']) assert.ok(T.AI.speed[d] <= T.WALK);
  const coins = { easy: 0, hard: 0 };
  for (const seed of [77, 78, 79, 80]) for (const diff of ['easy', 'hard']) {
    const env = setup({ seed, diff });
    playDay(env);
    coins[diff] += env.s.recap.rows.find(r => r.id === 'u').coins;
  }
  assert.ok(coins.hard > coins.easy, `hard ${coins.hard} vs easy ${coins.easy}`);
});
