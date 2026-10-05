// ═══════════════════════════════════════════════════════════════════════════
//  Health timeline — pure functions, no DOM
// ═══════════════════════════════════════════════════════════════════════════
// A plan is the profile plus dated events, { ...profile, events: [...] }.
// adjustedQ() asks stateAt(plan, x) for the person as they will be at each
// future age x, so an event changes the hazard from its age onward and the
// rest of the engine is untouched. With no events, stateAt returns the profile
// itself and every result is exactly what it was before timelines existed.
//
//   { kind:'quit',   age }                  stop smoking at age
//   { kind:'weight', age, value }           reach value kg by age (straight line from today)
//   { kind:'bp',     age, value }           systolic reading at age; the age drift continues from there
//   { kind:'set',    age, field, value }    change a habit or social circumstance from age
//   { kind:'dx',     age, field, value }    diagnosed with a condition at age
//
// An event dated before the current age counts from today. Ages stay anchored to
// today (s.age is never moved), so priced-in disease onset and blood-pressure
// drift keep measuring from the present.

const TL_MAX_EVENTS = 20;
const TL_SET = {
  activity: { label: 'Exercise', unit: 'min/week', range: [0, 2000] },
  strength: { label: 'Strength training', options: { none: 'None', '1to2': '1 – 2 sessions a week', '3plus': '3 or more a week' } },
  sitting:  { label: 'Sitting time', unit: 'h/day', range: [0, 18] },
  alcohol:  { label: 'Alcohol', unit: 'drinks/week', range: [0, 80] },
  sleep:    { label: 'Sleep', unit: 'h/night', range: [3, 12] },
  fruitveg: { label: 'Fruit & vegetables', unit: 'servings/day', range: [0, 12] },
  nuts:     { label: 'Nuts', options: { rare: 'Rarely', weekly: 'A few times a week', daily: 'A handful most days' } },
  grains:   { label: 'Whole grains', options: { rare: 'Rarely', some: 'Some days', daily: 'Most meals' } },
  meat:     { label: 'Processed meat', options: { rare: 'Rarely', weekly: 'A few times a week', daily: 'Most days' } },
  sugary:   { label: 'Sugary drinks', options: { rare: 'Rarely', weekly: 'A few a week', daily: 'About one a day', twice: 'Two or more a day' } },
  coffee:   { label: 'Coffee', options: { none: 'None', '1to2': '1 – 2 cups a day', '3to4': '3 – 4 cups a day', '5plus': '5 or more' } },
  social:   { label: 'Social connection', options: { strong: 'Strong', moderate: 'Moderate', isolated: 'Isolated' } },
  partnered:{ label: 'Partnership', options: { '1': 'Married or partnered', '0': 'Single, divorced or widowed' } },
  work:     { label: 'Work', options: { working: 'Working', notworking: 'Retired, studying or home-making', unemployed: 'Unemployed, looking for work' } },
};
// Conditions in order of severity; a diagnosis only counts if it is worse than today.
const TL_DX = {
  diabetes: { label: 'Type 2 diabetes',        levels: ['none', 'pre', 'yes'],          options: { yes: 'Diagnosed' } },
  cvd:      { label: 'Heart attack or stroke', levels: [false, true],                   options: { '1': 'Has one' } },
  af:       { label: 'Atrial fibrillation',    levels: [false, true],                   options: { '1': 'Diagnosed' } },
  copd:     { label: 'COPD',                   levels: ['none', 'moderate', 'severe'],  options: { moderate: 'Moderate', severe: 'Severe' } },
  ckd:      { label: 'Kidney disease',         levels: ['none', 'stage3', 'stage45'],   options: { stage3: 'Stage 3', stage45: 'Stage 4 – 5' } },
};
const TL_KINDS = { quit: 'Quit smoking', weight: 'Reach a weight', bp: 'Blood pressure', set: 'Change a habit', dx: 'Diagnosis' };
// Starting value when a habit is picked for a new event: the healthier answer.
const TL_SUGGEST = { activity: 300, strength: '1to2', sitting: 6, alcohol: 7, sleep: 7.5, fruitveg: 5, nuts: 'daily',
  grains: 'daily', meat: 'rare', sugary: 'rare', coffee: '3to4', social: 'strong', partnered: true, work: 'notworking' };

// A sensible new event of each kind for this person, five years from now.
function newEvent(kind, s) {
  const age = Math.min(100, s.age + 5);
  if (kind === 'quit') return { kind, age };
  if (kind === 'weight') { const bmi = bmiOf(s), target = bmi >= 25 ? 24 : bmi < 18.5 ? 20 : bmi;
    return cleanEvent({ kind, age, value: target * (s.height / 100) ** 2 }); }
  if (kind === 'bp') return { kind, age, value: 125 };
  if (kind === 'dx') { const field = Object.keys(TL_DX).find(f => dxRank(f, tlValue(f, Object.keys(TL_DX[f].options)[0])) > dxRank(f, s[f])) || 'diabetes';
    return cleanEvent({ kind, age, field, value: Object.keys(TL_DX[field].options)[0] }); }
  const field = Object.keys(TL_SUGGEST).find(f => s[f] !== TL_SUGGEST[f]) || 'activity';
  return { kind: 'set', age, field, value: TL_SUGGEST[field] };
}

const dxRank = (field, v) => TL_DX[field].levels.indexOf(v);
// Option keys are strings; partnered/cvd/af hold booleans.
const tlValue = (field, raw) => (field === 'partnered' || field === 'cvd' || field === 'af') ? raw === true || raw === '1' : raw;

// Validate and normalise one event (from the UI, a link or a preset). Returns null if unusable.
// Blank is missing, not zero (+'' is 0 in JavaScript, which would clamp to a real value).
const toNum = v => v === '' || v === null || v === undefined || typeof v === 'boolean' ? NaN : +v;
function cleanEvent(e) {
  if (!e || !TL_KINDS[e.kind]) return null;
  const age = Math.round(toNum(e.age));
  if (!isFinite(age)) return null;
  const out = { kind: e.kind, age: Math.min(100, Math.max(18, age)) };
  const num = (v, lo, hi) => { const n = toNum(v); return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null; };
  if (e.kind === 'weight') { out.value = num(e.value, 30, 300); if (out.value === null) return null; out.value = Math.round(out.value * 10) / 10; }
  else if (e.kind === 'bp') { out.value = num(e.value, 90, 220); if (out.value === null) return null; out.value = Math.round(out.value); }
  else if (e.kind === 'set') {
    const d = TL_SET[e.field];
    if (!d) return null;
    out.field = e.field;
    if (d.range) { out.value = num(e.value, d.range[0], d.range[1]); if (out.value === null) return null; }
    else { const key = typeof e.value === 'boolean' ? (e.value ? '1' : '0') : String(e.value);
           if (!(key in d.options)) return null; out.value = tlValue(e.field, key); }
  }
  else if (e.kind === 'dx') {
    const d = TL_DX[e.field];
    if (!d) return null;
    const key = typeof e.value === 'boolean' ? (e.value ? '1' : '0') : String(e.value);
    if (!(key in d.options)) return null;
    out.field = e.field; out.value = tlValue(e.field, key);
  }
  return out;
}
// Stable sort by age, so two changes at the same age apply in the order they were added.
function sortEvents(evs) { return evs.map((e, i) => [e, i]).sort((a, b) => a[0].age - b[0].age || a[1] - b[1]).map(p => p[0]); }

// Does this event change anything for this person? (Quitting needs a smoker; a
// diagnosis must be worse than today; a habit must differ from the current answer.)
function eventApplies(e, s) {
  if (e.kind === 'quit') return s.smoke === 'current';
  if (e.kind === 'dx') return dxRank(e.field, e.value) > dxRank(e.field, s[e.field]);
  if (e.kind === 'weight') return Math.abs(e.value - s.weight) >= 0.05;
  if (e.kind === 'bp') return e.value !== Math.round(sbpAt(s, Math.max(e.age, s.age)));
  return s[e.field] !== e.value;
}

// The person as they will be at age x. Events are assumed sorted by age.
function stateAt(s, x) {
  const evs = s.events;
  if (!evs || !evs.length) return s;
  const t = { ...s };
  let wPts = null;
  for (const e of evs) {
    const A = Math.max(e.age, s.age);
    if (e.kind === 'weight') {           // a straight line from the previous point (today, or the last target)
      wPts = wPts || [[s.age, s.weight]];
      if (wPts[wPts.length - 1][0] === A) wPts[wPts.length - 1] = [A, e.value]; else wPts.push([A, e.value]);
      continue;
    }
    if (e.kind === 'dx' && dxRank(e.field, e.value) > dxRank(e.field, s[e.field])) {
      // Onset is stipulated at A, so the background chance of developing it
      // before then is switched off rather than counted twice.
      if (x < A) { t.noOnset = { ...t.noOnset, [e.field]: true }; continue; }
      if (dxRank(e.field, e.value) > dxRank(e.field, t[e.field])) t[e.field] = e.value;
      continue;
    }
    if (x < A) continue;
    if (e.kind === 'quit') { if (s.smoke === 'current') { t.smoke = 'former'; t.quitYears = s.age - A; } }   // years since quitting at x = x − A
    else if (e.kind === 'bp') t.sbp = e.value - interp(SBP_MEDIAN, A) + interp(SBP_MEDIAN, s.age);   // reading at A; drift continues from A
    else if (e.kind === 'set') t[e.field] = e.value;
  }
  if (wPts) t.weight = interp(wPts, x);
  return t;
}

// ── Link encoding: ev=q~50,w~48~78.5,b~55~125,s~46~activity~300,d~60~diabetes~yes ──
const TL_CODE = { quit: 'q', weight: 'w', bp: 'b', set: 's', dx: 'd' };
function encodeEvents(evs) {
  return evs.map(e => {
    const v = typeof e.value === 'boolean' ? (e.value ? 1 : 0) : e.value;
    return [TL_CODE[e.kind], e.age, ...(e.field ? [e.field] : []), ...(e.value !== undefined ? [v] : [])].join('~');
  }).join(',');
}
function decodeEvents(str) {
  const kindOf = Object.fromEntries(Object.entries(TL_CODE).map(([k, c]) => [c, k]));
  const out = [];
  for (const part of String(str || '').split(',')) {
    const [c, age, a, b] = part.split('~');
    const kind = kindOf[c];
    if (!kind) continue;
    const e = cleanEvent(kind === 'set' || kind === 'dx' ? { kind, age, field: a, value: b } : { kind, age, value: a });
    if (e && out.length < TL_MAX_EVENTS) out.push(e);
  }
  return sortEvents(out);
}

// Plain-English description, used by the timeline list and the chart markers.
function describeEvent(e, units) {
  if (e.kind === 'quit') return 'Quit smoking';
  if (e.kind === 'weight') return units === 'imperial' ? `Reach ${Math.round(e.value / 0.45359237)} lb` : `Reach ${e.value} kg`;
  if (e.kind === 'bp') return `Blood pressure ${e.value} mmHg`;
  if (e.kind === 'dx') return `${TL_DX[e.field].label}` + (Object.keys(TL_DX[e.field].options).length > 1 ? ` (${TL_DX[e.field].options[e.value].toLowerCase()})` : '');
  const d = TL_SET[e.field];
  if (d.range) return `${d.label}: ${e.value} ${d.unit}`;
  return `${d.label}: ${d.options[typeof e.value === 'boolean' ? (e.value ? '1' : '0') : e.value].toLowerCase()}`;
}

// Short label for chart markers.
function shortEvent(e, units) {
  if (e.kind === 'quit') return 'Quit smoking';
  if (e.kind === 'weight') return units === 'imperial' ? `${Math.round(e.value / 0.45359237)} lb` : `${e.value} kg`;
  if (e.kind === 'bp') return `BP ${e.value}`;
  return e.kind === 'dx' ? TL_DX[e.field].label : TL_SET[e.field].label;
}

// Factors whose multiplier the timeline changes at some future age: computed from
// the engine itself, so it cannot drift from what the events actually do.
function timelineFactors(s) {
  const out = new Set();
  if (!s.events || !s.events.length) return out;
  const ages = new Set(s.events.map(e => Math.max(e.age, s.age)));
  for (let x = s.age; x <= 100; x += 5) ages.add(x);
  const still = { ...s, events: [] };
  for (const x of ages) {
    const sx = stateAt(s, x);
    for (const f of FACTORS) if (!out.has(f.id) && Math.abs(factorMult(f, sx, x) - factorMult(f, still, x)) > 1e-12) out.add(f.id);
  }
  return out;
}
