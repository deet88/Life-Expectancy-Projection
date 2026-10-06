// ═══════════════════════════════════════════════════════════════════════════
//  State
// ═══════════════════════════════════════════════════════════════════════════
// Optional inputs default to null ("not entered" = population average) or to
// 'unk' for selects, so a fresh page scores exactly as it did before they existed.
const DEFAULTS = {
  country:'USA', sex:'M', age:40, units:'metric', height:175, weight:80, sbp:120,
  waist:null, rhr:null, vo2max:null, grip:null, crp:null, srh:'unk',
  smoke:'never', cigs:'lt10', quitYears:5, activity:150, strength:'unk', sitting:null, alcohol:3, sleep:7,
  fruitveg:3, nuts:'unk', grains:'unk', meat:'unk', sugary:'unk', coffee:'unk',
  diabetes:'none', cvd:false, af:false, copd:'none', ckd:'none', mental:'none', osa:'none', drugs:'none',
  education:14, income:'unk', work:'working', social:'strong', partnered:true, mother:'unk', father:'unk',
  pm25:null, improve:false,
};
const OPTIONAL_NUM = { waist:[50, 200], rhr:[35, 140], vo2max:[10, 90], grip:[5, 90], crp:[0.1, 50], sitting:[0, 18], pm25:[0, 150] };
let state = { ...DEFAULTS };
let events = [];               // health timeline, sorted by age
const TABS = ['overview', 'factors', 'timeline', 'compare', 'lifespan', 'method'];
let compare = null;             // while comparing: { other: the plan not being edited, editing: 'A' | 'B' } (js/compare.js)
let tab = 'overview';           // which tab is showing; part of the link so a link can open on it
const KEYS = Object.keys(DEFAULTS);
// The profile plus its timeline: what the engine is given.
function plan() { return { ...state, events }; }

// ── Hash (shareable link) ──────────────────────────────────────────────────
// Hand-rolled rather than URLSearchParams so the link stays readable. Every
// value read back is validated against DEFAULTS' type and the select options.
const HASH_KEYS = { country:'c', sex:'s', age:'a', units:'u', height:'h', weight:'w', sbp:'bp',
  waist:'wc', rhr:'rh', vo2max:'vo', grip:'gr', crp:'cr', srh:'sr',
  smoke:'sm', cigs:'ci', quitYears:'qy', activity:'ac', strength:'st', sitting:'si', alcohol:'al', sleep:'sl',
  fruitveg:'fv', nuts:'nu', grains:'wg', meat:'pm', sugary:'sd', coffee:'cf',
  diabetes:'dm', cvd:'cv', af:'af', copd:'cp', ckd:'ck', mental:'mh', osa:'os', drugs:'dr',
  education:'ed', income:'in', work:'wk', social:'so', partnered:'pa', mother:'mo', father:'fa',
  pm25:'pa2', improve:'im' };
const CHOICES = { sex:['M','F'], units:['metric','imperial'], smoke:['never','former','current','cigar'],
  cigs:['lt10','10to19','ge20'], strength:['unk','none','1to2','3plus'], srh:['unk','excellent','verygood','good','fair','poor'],
  nuts:['unk','rare','weekly','daily'], grains:['unk','rare','some','daily'], meat:['unk','rare','weekly','daily'],
  sugary:['unk','rare','weekly','daily','twice'], coffee:['unk','none','1to2','3to4','5plus'],
  diabetes:['none','pre','yes'], copd:['none','moderate','severe'], ckd:['none','stage3','stage45'],
  mental:['none','depression','smi'], osa:['none','moderate','severe'], drugs:['none','current'],
  income:['unk','low','middle','high'], work:['working','notworking','unemployed'],
  social:['strong','moderate','isolated'], mother:PARENT_CODES, father:PARENT_CODES };
// One plan's inputs as link parts: only keys that differ from `base`, under a
// prefix ('' for plan A against the defaults, 'b.' for plan B against plan A).
// A blank optional input is written as an empty value so B can blank what A set.
function encodeState(s, base, prefix) {
  const parts = [];
  for (const k of KEYS) {
    const v = s[k];
    if (v === base[k]) continue;
    parts.push(prefix + HASH_KEYS[k] + '=' + (v === null ? '' : typeof v === 'boolean' ? (v ? 1 : 0) : v));
  }
  return parts;
}
function decodeState(p, base, prefix) {
  const next = { ...base };
  for (const k of KEYS) {
    const raw = p[prefix + HASH_KEYS[k]];
    if (raw === undefined) continue;
    const d = DEFAULTS[k];
    if (typeof d === 'boolean') next[k] = raw === '1';
    else if (k in OPTIONAL_NUM && raw === '') next[k] = null;
    else if (typeof d === 'number' || k in OPTIONAL_NUM) { const v = parseFloat(raw); if (isFinite(v)) next[k] = v; }
    else if (k === 'country') { if (LIFETABLES.countries[raw]) next[k] = raw; }
    else if (CHOICES[k] && CHOICES[k].includes(raw)) next[k] = raw;
  }
  return clampState(next);
}
function stateToHash() {
  const ab = plansAB(), A = ab ? ab.A : { state, events };
  const parts = encodeState(A.state, DEFAULTS, '');
  if (A.events.length) parts.push('ev=' + encodeEvents(A.events));
  if (ab) {
    parts.push('cmp=' + compare.editing.toLowerCase(), ...encodeState(ab.B.state, A.state, 'b.'));
    if (ab.B.events.length) parts.push('bev=' + encodeEvents(ab.B.events));
  }
  if (tab !== 'overview') parts.push('tab=' + tab);
  return parts.join('&');
}
function hashParams(h) {
  const out = {};
  h.replace(/^#/, '').split('&').forEach(kv => {
    const i = kv.indexOf('=');
    if (i > 0) out[kv.slice(0, i)] = kv.slice(i + 1);
  });
  return out;
}
function applyHash(h) {
  if (!h.replace(/^#/, '')) return false;
  const p = hashParams(h);
  compare = null;
  state = decodeState(p, DEFAULTS, '');
  events = decodeEvents(p.ev);
  tab = TABS.includes(p.tab) ? p.tab : 'overview';
  // Links from before the timeline carried ticked what-ifs (wi=); they become changes dated today.
  const legacy = WHATIFS.filter(w => (p.wi || '').split(',').includes(w.id) && w.applies(state));
  if (legacy.length) events = sortEvents([...events, ...legacy.map(w => cleanEvent(w.event(state)))]).slice(0, TL_MAX_EVENTS);
  // A comparison: plan B is stored as its differences from plan A.
  if (p.cmp === 'a' || p.cmp === 'b') {
    compare = { other: { state: decodeState(p, state, 'b.'), events: decodeEvents(p.bev) }, editing: 'A' };
    if (p.cmp === 'b') switchPlan('B');
  }
  return true;
}
function clampState(s) {
  const c = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  s.age = Math.round(c(s.age, 18, 100)); s.height = c(s.height, 120, 230); s.weight = c(s.weight, 30, 300);
  s.sbp = c(s.sbp, 90, 220); s.quitYears = c(s.quitYears, 0, 80); s.activity = c(s.activity, 0, 2000);
  s.alcohol = c(s.alcohol, 0, 80); s.fruitveg = c(s.fruitveg, 0, 12); s.sleep = c(s.sleep, 3, 12);
  s.education = c(s.education, 0, 24);
  for (const k in OPTIONAL_NUM) s[k] = s[k] === null || !isFinite(s[k]) ? null : c(s[k], OPTIONAL_NUM[k][0], OPTIONAL_NUM[k][1]);
  return s;
}
let urlTimer = null;
function syncURL(now) {
  clearTimeout(urlTimer);
  const write = () => history.replaceState(null, '', '#' + stateToHash());
  if (now) write(); else urlTimer = setTimeout(write, 250);
}
function copyLink() {
  syncURL(true);
  const btn = document.getElementById('copyBtn'), old = 'Copy link';
  const done = t => { btn.textContent = t; setTimeout(() => btn.textContent = old, 1600); };
  if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(() => done('Copied'), () => done('⌘C to copy'));
  else done('⌘C to copy');
}

