import { loadSim } from './load-sim.mjs';

export const TWO = [{ id: 'me', name: 'Pip' }, { id: 'u', name: 'Ursula', ai: 'undercutter' }];
export const THREE = TWO.concat([{ id: 'h', name: 'Hattie', ai: 'hoarder' }]);

export function setup(opts = {}) {
  const lib = loadSim();
  const init = { seed: opts.seed ?? 1234, diff: opts.diff || 'normal', len: opts.len, players: opts.players || TWO };
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
    want: ['fruit'], budget: 6, got: [], pitches: [], pitched: {}, looked: [], deal: null, look: 1, ...over };
  s.cust.push(c); return c;
}
export function ticks(CMSim, s, n) { for (let i = 0; i < n; i++) CMSim.tick(s); }

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
