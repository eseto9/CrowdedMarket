import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, playDay, shelf, home, going, THREE } from './helpers.mjs';

// what an AI may be refused without anything being wrong: a customer moving on, or already taken
const fine = x => x.r.ok || (['pitch', 'steal'].includes(x.a.type) && ['gone', 'busy', 'already', 'yours', 'loyal', 'nostock'].includes(x.r.reason));

test('the rivals trade a whole day: they send runners, sell, and never break a rule', () => {
  const env = setup({ seed: 31, players: THREE });
  const t0 = Date.now();
  const { results } = playDay(env);
  const ms = Date.now() - t0;
  const { s, CM_TUNE: T } = env;
  assert.equal(s.phase, 'over', 'you did nothing, so you missed the target');
  for (const id of ['u', 'h']) {
    const p = s.players[id];
    assert.ok(p.st.sales >= 3, `${id}: only ${p.st.sales} sales`);
    assert.ok(results.some(x => x.a.player === id && x.a.type === 'order' && x.r.ok), `${id} never sent a runner`);
    assert.ok(p.score > 0);
  }
  assert.equal(s.players.u.stance, 'bargain');
  assert.equal(s.players.h.stance, 'fair');
  assert.deepEqual(results.filter(x => !fine(x)).map(x => [x.a.player, x.a.type, x.r.reason]), []);
  assert.ok(ms < 3000, `a day took ${ms} ms`);
  void T;
});

test('Ursula steals customers she can reach; Hattie hardly ever does', () => {
  let u = 0, h = 0;
  for (let i = 0; i < 20; i++) {
    for (const who of ['u', 'h']) {
      const env = setup({ seed: 50 + i, players: THREE }), { s, CMSim } = env;
      const st = s.stalls[s.players[who].stall];
      shelf(s, 0, { fruit: 3 }); shelf(s, st.id, { fruit: 3 }); home(env, who);
      const pa = CMSim.payAt(st);
      going(env, 0, { x: pa.x + 1, z: pa.z < 0 ? -2 : 2 });   // on their way to your stall, right past hers
      playDay(env, { until: 40, mems: ['u', 'h'].map((id, k) => env.CMAI.newMem(id, s.players[id].ai, 'normal', (i + 1) * 7919 + k * 104729)) });   // fresh dice each time
      if (s.feed.some(e => e.k === 'steal' && e.p === who)) who === 'u' ? u++ : h++;
    }
  }
  assert.ok(u >= 12, `Ursula stole ${u}/20`);   // she tries 80% of the time
  assert.ok(h <= 7, `Hattie stole ${h}/20`);    // she tries 15% of the time
});

test('every supplier can be reached from every stall, and runners never walk through anything', () => {
  const { s, CMSim, CMNav, CM_TUNE: T } = setup();
  const G = CMNav.boardGrid();
  for (const st of s.stalls) for (const [g, sp] of Object.entries(T.SUPPLIERS)) {
    const b = CMSim.backOf(st, 0), pts = CMNav.path(G, b.x, b.z, sp.x, sp.z);
    let x = b.x, z = b.z;
    for (const [px, pz] of pts) {
      const n = Math.ceil(Math.hypot(px - x, pz - z) / 0.2);
      for (let i = 1; i <= n; i++) assert.ok(!CMSim.blocked(x + (px - x) * i / n, z + (pz - z) * i / n, T.BEAN_R - 0.05), `stall ${st.id} → ${g}`);
      x = px; z = pz;
    }
    assert.ok(Math.hypot(x - sp.x, z - sp.z) < 0.01);
  }
});

test('a stand-in player using the AI beats day one more often than not', () => {
  let passed = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const env = setup({ seed, players: THREE }), { CMAI, s } = env;
    const mems = [CMAI.newMem('me', 'undercutter', 'normal', 7), ...['u', 'h'].map((id, i) => CMAI.newMem(id, s.players[id].ai, 'normal', 8 + i))];
    playDay(env, { mems });
    if (s.result.passed) passed++;
  }
  assert.ok(passed >= 6, `passed ${passed}/12`);
});

test('difficulty: harder rivals score more', () => {
  const total = { easy: 0, hard: 0 };
  for (const seed of [77, 78, 79, 80, 81]) for (const diff of ['easy', 'hard']) {
    const env = setup({ seed, diff, players: THREE });
    playDay(env);
    total[diff] += env.s.players.u.score + env.s.players.h.score;
  }
  assert.ok(total.hard > total.easy, `hard ${total.hard} vs easy ${total.easy}`);
});
