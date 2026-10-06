// ═══════════════════════════════════════════════════════════════════════════
//  Plan A vs Plan B, and saved plans — no DOM
// ═══════════════════════════════════════════════════════════════════════════
// The whole page always shows and edits one plan: `state` + `events`. While
// comparing, the other plan waits in `compare.other`, and switching between A
// and B swaps the two. Nothing outside this file has to know comparing exists.

function clonePlan() { return { state: { ...state }, events: events.map(e => ({ ...e })) }; }
// Both plans by name, or null when not comparing. These are live references.
function plansAB() {
  if (!compare) return null;
  const cur = { state, events };
  return compare.editing === 'A' ? { A: cur, B: compare.other } : { A: compare.other, B: cur };
}
// Plan B starts as a copy of A, and you land on B so changes don't touch A.
function startCompare() {
  if (compare) return;
  compare = { other: clonePlan(), editing: 'A' };
  switchPlan('B');
}
function switchPlan(which) {
  if (!compare || compare.editing === which || (which !== 'A' && which !== 'B')) return;
  const cur = { state, events };
  state = compare.other.state; events = compare.other.events;
  compare.other = cur; compare.editing = which;
}
// Swap the labels: what was A is now B and vice versa. Twice is the identity.
function swapPlans() { if (compare) compare.editing = compare.editing === 'A' ? 'B' : 'A'; }
// Stop comparing, keeping one plan as the page's plan.
function keepPlan(which) { if (!compare) return; switchPlan(which); compare = null; }
function resetBToA() {
  const ab = plansAB();
  if (!ab) return;
  const copy = { state: { ...ab.A.state }, events: ab.A.events.map(e => ({ ...e })) };
  if (compare.editing === 'B') { state = copy.state; events = copy.events; } else compare.other = copy;
}

// What differs between the plans: input keys, and events present in only one.
const eventKey = e => encodeEvents([e]);
function planDiff() {
  const ab = plansAB();
  if (!ab) return null;
  const keys = KEYS.filter(k => ab.A.state[k] !== ab.B.state[k]);
  const inB = new Set(ab.B.events.map(eventKey)), inA = new Set(ab.A.events.map(eventKey));
  return { keys, onlyA: ab.A.events.filter(e => !inB.has(eventKey(e))), onlyB: ab.B.events.filter(e => !inA.has(eventKey(e))) };
}
function resetKeyToA(k) { const ab = plansAB(); if (ab && KEYS.includes(k)) ab.B.state[k] = ab.A.state[k]; }
function resetEventsToA() {
  const ab = plansAB();
  if (!ab) return;
  const copy = ab.A.events.map(e => ({ ...e }));
  if (compare.editing === 'B') events = copy; else compare.other.events = copy;
}

// The headline figures for one plan, for the side-by-side scorecard.
function scorecard(plan, full) {
  full = full || summarize(plan);
  const sc = longevityScore(contributions(plan, full));
  return { le: full.le, median: full.median, p10: full.p10, p90: full.p90,
    reach80: full.reach(80), reach90: full.reach(90), reach100: full.reach(100), score: sc.score, S: full.S };
}

// ── Saved plans (this browser only) ────────────────────────────────────────
// Stored as the same compact string the link uses, so loading one goes through
// the link's validation. Storage can be missing or blocked; the page still works.
const SLOTS_KEY = 'lifex-slots', MAX_SLOTS = 20;
function readSlots() {
  try {
    const v = JSON.parse(localStorage.getItem(SLOTS_KEY) || '[]');
    return Array.isArray(v) ? v.filter(x => x && typeof x.name === 'string' && typeof x.hash === 'string').slice(0, MAX_SLOTS) : [];
  } catch (e) { return []; }
}
function writeSlots(list) { try { localStorage.setItem(SLOTS_KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }
function planHash(s, evs) { return [...encodeState(s, DEFAULTS, ''), ...(evs.length ? ['ev=' + encodeEvents(evs)] : [])].join('&'); }
function saveSlot(name) {
  name = String(name || '').trim().slice(0, 40);
  if (!name) return false;
  const list = readSlots().filter(x => x.name !== name);
  list.unshift({ name, hash: planHash(state, events), saved: new Date().toISOString().slice(0, 10) });
  return writeSlots(list.slice(0, MAX_SLOTS));
}
// Loads into the plan you are editing (A or B).
function loadSlot(name) {
  const slot = readSlots().find(x => x.name === name);
  if (!slot) return false;
  const p = hashParams(slot.hash);
  state = decodeState(p, DEFAULTS, '');
  events = decodeEvents(p.ev);
  return true;
}
function deleteSlot(name) { return writeSlots(readSlots().filter(x => x.name !== name)); }
