import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, playDay } from './helpers.mjs';

test('the Undercutter trades a whole day through the same actions as a player', () => {
  const env = setup({ seed: 31 });
  const t0 = Date.now();
  const { results } = playDay(env);
  const ms = Date.now() - t0;
  const { s, CM_TUNE: T, CMSim } = env;
  assert.equal(s.phase, 'closed');
  const u = s.recap.rows.find(r => r.id === 'u');
  assert.ok(u.sales >= s.day / 15, `only ${u.sales} sales in ${s.day} s`);
  assert.ok(u.coins > T.START_COINS + s.day / 10, `ended with ${u.coins}`);
  assert.ok(results.some(x => x.a.type === 'buy' && x.r.ok), 'never restocked');
  assert.ok(results.some(x => x.a.type === 'shelve' && x.r.ok), 'never shelved');
  // no speeding, and (apart from customers moving on mid-pitch) nothing refused
  assert.ok(!results.some(x => x.a.type === 'move' && x.r.clamped), 'moved faster than allowed');
  const odd = results.filter(x => !x.r.ok && !(x.a.type === 'pitch' && ['gone', 'busy', 'already'].includes(x.r.reason)));
  assert.deepEqual(odd.map(x => [x.a.type, x.r.reason]), []);
  assert.ok(ms < 3000, `a day took ${ms} ms`);
  void CMSim;
});

test('the Undercutter walks round things, never through them', () => {
  const env = setup({ seed: 12 });
  const { s, CMSim, CM_TUNE: T } = env;
  const where = new Set();
  playDay(env, { script: s => { const u = s.players.u; assert.ok(!CMSim.blocked(u.x, u.z, T.BEAN_R - 0.05), `inside something at ${u.x},${u.z}`); where.add(Math.round(u.x / 4) + ',' + Math.round(u.z / 4)); } });
  assert.ok(where.size > 12, 'it got about');
});

test('every supplier can be reached from every stall', () => {
  const { s, CMSim, CMNav, CM_TUNE: T } = setup();
  const G = CMNav.boardGrid();
  for (const st of s.stalls) for (const [g, sp] of Object.entries(T.SUPPLIERS)) {
    const b = CMSim.post(st), pts = CMNav.path(G, b.x, b.z, sp.x, sp.z);
    let x = b.x, z = b.z;
    for (const [px, pz] of pts) {   // each leg stays clear of obstacles
      const n = Math.ceil(Math.hypot(px - x, pz - z) / 0.2);
      for (let i = 1; i <= n; i++) assert.ok(!CMSim.blocked(x + (px - x) * i / n, z + (pz - z) * i / n, T.BEAN_R - 0.05), `stall ${st.id} → ${g}`);
      x = px; z = pz;
    }
    assert.ok(Math.hypot(x - sp.x, z - sp.z) < 0.01);
  }
});

test('the Undercutter prices just under a rival, but never within a coin of cost', () => {
  const env = setup({ seed: 5 });
  const { s, CM_TUNE: T } = env;
  s.stalls[0].price.bread = 4;                   // the player sells bread at 4
  const run = playDay(env, { until: 30 });
  assert.equal(s.stalls[1].price.bread, 3);     // Ursula goes to 3 (cost 2 + 1)
  assert.ok(s.feed.some(e => e.k === 'undercut' && e.p === 'u'));
  s.stalls[0].price.bread = 2;                   // the player dumps at cost
  playDay(env, { until: 60, mems: run.mems });
  assert.equal(s.stalls[1].price.bread, T.GOODS.bread.cost + 1);
});

test('difficulty: faster and sharper on hard, never beyond a walk', () => {
  const { CM_TUNE: T } = setup();
  for (const d of ['easy', 'normal', 'hard']) assert.ok(T.AI.speed[d] <= T.WALK);
  const coins = { easy: 0, hard: 0 };
  for (const seed of [77, 78, 79]) for (const diff of ['easy', 'hard']) {
    const env = setup({ seed, diff });
    playDay(env);
    coins[diff] += env.s.recap.rows.find(r => r.id === 'u').coins;
  }
  assert.ok(coins.hard > coins.easy, `hard ${coins.hard} vs easy ${coins.easy}`);
});
