import { loadSim } from './load-sim.mjs';

export const TWO = [{ id: 'me', name: 'Pip' }, { id: 'u', name: 'Ursula', ai: 'undercutter' }];
export const THREE = TWO.concat([{ id: 'h', name: 'Hattie', ai: 'hoarder' }]);

export function setup(opts = {}) {
  const lib = loadSim();
  const init = { seed: opts.seed ?? 1234, diff: opts.diff || 'normal', players: opts.players || TWO };
  const s = lib.CMSim.newState(init);
  return { ...lib, s, init };
}
// test setup only: put a bean somewhere without walking there
export function place(s, id, x, z) { const p = s.players[id]; p.x = x; p.z = z; }
// a bean at its own stall's post
export function home(env, id) { const { s, CMSim } = env; const b = CMSim.post(s.stalls[s.players[id].stall]); place(s, id, b.x, b.z); return b; }
// a bean somewhere out of the way, so standing at its stall doesn't sell for it
export function away(s, id) { place(s, id, 0, -10); }
export function shelf(s, i, stock) { s.stalls[i].stock = { ...stock }; }
export function customer(s, over = {}) {
  const c = { id: 'c' + s.nid++, kind: 'budget', x: 0, z: -1, lane: -1, dir: 1, born: s.t, ph: 'walk', until: 0,
    want: ['fruit'], budget: 6, got: [], pitches: [], pitched: {}, looked: [], deal: null, steals: 0, look: 1, ...over };
  s.cust.push(c); return c;
}
export function ticks(CMSim, s, n) { for (let i = 0; i < n; i++) CMSim.tick(s); }
// a customer on their way to pay at stall i, having agreed a deal
export function going(env, i, over = {}) {
  const { s, CMSim } = env, st = s.stalls[i];
  const items = over.items || ['fruit'], prices = Object.fromEntries(items.map(g => [g, st.price[g]]));
  const pa = CMSim.payAt(st);
  return customer(s, { ph: 'go', x: pa.x + 3, z: 0, want: items.slice(), budget: 30,
    deal: { p: st.owner, stall: i, items, prices, total: items.reduce((a, g) => a + prices[g], 0), full: true }, ...over });
}
// close today's market right now (tests of the between-days shop)
export function closeNow({ CMSim, s }) { s.tick = Math.round(s.day / 0.1) - 1; s.t = s.tick * 0.1; CMSim.tick(s); return s; }

/** Play on: AIs step every tick, `script(s, act)` can add player actions. Returns the action log. */
export function playDay({ CMSim, CMAI, s }, { until, script, mems } = {}) {
  const log = [], results = [];
  mems = mems || s.order.filter(id => s.players[id].ai).map((id, i) => CMAI.newMem(id, s.players[id].ai, s.diff, 99 + i));
  const act = a => { log.push([s.tick, a]); const r = CMSim.applyAction(s, a); results.push({ a, r }); return r; };
  const end = until ?? 1e9;
  while (s.phase === 'day' && s.tick < end) {
    if (script) script(s, act);
    for (const m of mems) for (const a of CMAI.step(s, m)) act(a);
    CMSim.tick(s);
  }
  return { log, results, mems };
}
