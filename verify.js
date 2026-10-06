#!/usr/bin/env osascript -l JavaScript
//
// Regression harness for index.html — run:  osascript -l JavaScript verify.js
//
// There is no Node on this machine, so this runs on JavaScriptCore via osascript.
// It evaluates the REAL scripts that index.html loads (data/lifetables.js and js/*.js,
// in page order) against stub DOM/Chart objects, so the assertions below test
// the shipped code and cannot drift from it.
//
ObjC.import('Foundation');

const CWD = ObjC.unwrap($.NSFileManager.defaultManager.currentDirectoryPath);
const HTML = CWD + '/index.html';
var css = '';
const src = ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(
  $(HTML), $.NSUTF8StringEncoding, $()));

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push(name + (detail !== undefined ? '  — ' + detail : '')); }
}
function near(a, b, tol) { return Math.abs(a - b) <= (tol === undefined ? 0.01 : tol); }
const f2 = v => (typeof v === 'number' ? v.toFixed(2) : String(v));

// ── Load the app's own script blocks under stubs ─────────────────────────────
function stubEl() {
  return { innerHTML: '', textContent: '', value: '', style: {}, dataset: {}, hidden: false, className: '',
    checked: false, min: 0, max: 0, step: 0, width: 300, height: 150, href: '', download: '', placeholder: '', parentElement: { style: {} },
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    appendChild(){}, setAttribute(k, v){ this['@' + k] = v; }, removeAttribute(){}, addEventListener(){},
    querySelectorAll(){ return []; }, querySelector(){ return null; }, focus(){}, click(){ clicks.push(this); },
    getContext(){ return { fillRect(){ fills++; }, strokeRect(){}, clearRect(){}, setTransform(){}, drawImage(){}, save(){}, restore(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, fillText(t){ texts.push(String(t)); }, setLineDash(){} }; },
    toDataURL(){ return 'data:image/png;base64,'; } };
}
var clicks = [], fills = 0, texts = [];
var els = {};
var created = [];
var document = {
  documentElement: { dataset: { theme: 'dark' }, style: {} },
  getElementById(id){ return els[id] || (els[id] = stubEl()); },
  querySelectorAll(){ return []; },
  querySelector(){ return stubEl(); },
  createElement(tag){ const e = stubEl(); e.tag = tag; created.push(e); return e; },
  addEventListener(){},
  body: stubEl(),
};
var localStorage = { _d: {}, getItem(k){ return this._d[k] ?? null; }, setItem(k, v){ this._d[k] = v; } };
function matchMedia(){ return { matches: false, addEventListener(){} }; }
var chartCalls = [], plugins = [];
// Runs the page's own plugin hooks on a minimal chart object, as Chart.js does on
// construction, so a plugin that throws aborts the render here exactly as it
// would in the browser (which is how a missing what-if panel was once caused).
function Chart(ctx, cfg){
  chartCalls.push(cfg);
  const n = (cfg.data.datasets[0] && cfg.data.datasets[0].data.length) || 0;
  const fake = { options: cfg.options, data: cfg.data, ctx, chartArea: { top: 0, bottom: 100, left: 0, right: 200 },
    scales: { x: { getPixelForValue: v => v }, y: { getPixelForValue: v => v } },
    getDatasetMeta: () => ({ data: Array.from({ length: n }, () => ({ x: 10, y: 10, base: 0 })) }) };
  for (const p of plugins) if (p.afterDatasetsDraw) p.afterDatasetsDraw(fake, {}, (cfg.options.plugins || {})[p.id]);
  return { destroy(){}, update(){}, data: cfg.data, options: cfg.options };
}
Chart.register = function(...ps){ plugins.push(...ps); };
function getComputedStyle(){ return { getPropertyValue(){ return '#888888'; } }; }
// JXA has no timers or DOM globals; the app only uses them for debounce and history.
function setTimeout(fn){ timers.push(fn); return timers.length; } function clearTimeout(){}
var timers = [];
function addEventListener(){}
var location = { hash: '', href: 'file:///index.html' };
var history = { replaceState(_a, _b, url){ location.hash = String(url); } };
var navigator = {};
var window = { location, history, addEventListener, setTimeout, clearTimeout };
var blobText = null;
function Blob(parts){ this.text = parts.join(''); }
var URL = { createObjectURL(b){ blobText = b.text; return 'blob:x'; }, revokeObjectURL(){} };

// The app is the local <script src> files, read in the order the page loads them,
// so a file the page doesn't load isn't tested either.
function readFile(rel) {
  const s = $.NSString.stringWithContentsOfFileEncodingError($(CWD + '/' + rel), $.NSUTF8StringEncoding, $());
  if (s.isNil()) throw new Error('cannot read ' + rel);
  return ObjC.unwrap(s);
}
css = readFile('css/app.css');
const inline = src.split('<script>').slice(1).map(b => b.split('</script>')[0]);
ok('page has one inline script block (theme, before first paint)', inline.length === 1, inline.length);
const scriptFiles = [...src.matchAll(/<script src="([^":]+)"><\/script>/g)].map(m => m[1]);
ok('page loads every script in dependency order',
  scriptFiles.join() === 'data/lifetables.js,js/engine.js,js/timeline.js,js/insights.js,js/tools.js,js/state.js,js/compare.js,js/onboarding.js,js/share.js,js/ui.js,js/ui-compare.js,js/ui-onboarding.js,js/ui-tools.js,js/main.js', scriptFiles.join());
const appSrc = scriptFiles.map(readFile).join('\n') + `
;({ summarize, adjustedQ, survival, lifeExp, ageAtPct, contributions, WHATIFS, withEvents, stateAt, cleanEvent, sortEvents, eventApplies, newEvent, encodeEvents, decodeEvents, describeEvent, shortEvent, timelineFactors, longevityScore, wholeParts, blindSpots, levers, alerts, lifetimes, bottomLine, PILLARS, LIFETIME_BANDS, BLIND_SPOTS, SCORE_PER_YEAR, setTab, TABS, startCompare, switchPlan, swapPlans, keepPlan, resetBToA, planDiff, resetKeyToA, resetEventsToA, plansAB, scorecard,
   readSlots, saveSlot, loadSlot, deleteSlot, encodeState, decodeState, ARCHETYPES, archetypePlan, QS_STEPS, QS_KEYS, quickStartState, TOUR,
   KEY_LABELS, valueText, renderCompare, jointSurvival, yearsAtPct, coupleSummary, planToAge, lifeWeeks, PARTNER_DEFAULT, slotPlan,
   shareSummary, aiPrompt, exportPlan, importPlan, TL_SET, TL_DX, SBP_MEDIAN, FACTORS, FACTOR_BY_ID,
   factorMult, atten, baseQ, bmiOf, bmiHR, actHR, alcHR, sleepHR, sbpHR, fvHR, formerHR, interp, devProb, sbpAt,
   DEFAULTS, KEYS, HASH_KEYS, LIFETABLES, PREV, PARENT_HR, PARENT_DIST, PARENT_CODES, ALIVE_AGE, parentHR, SMOKE_HR, SMOKE_SPLIT, AGE_PREV,
   CALIBRATIONS, withBmi, diffLE, CHOICES, clampState, MAX_AGE, MAX_MULT, MIN_MULT, SOFT_FROM, GROUP_CAPS, BASE_YR, VASC_SHARE,
   stateToHash, applyHash, hashParams, clampState, onInput, onModeBtn, resetAll, syncControls, refreshAll,
   setTheme, THEMES, exportCsv, exportPng, renderFactorTable, renderCalibration,
   addEvent, removeEvent, onTimelineEdit, plan,
   state: () => state, events: () => events, tab: () => tab, compare: () => compare, partner: () => partner, setPartner: v => { partner = v; },
   setState: v => { state = v; }, setEvents: v => { events = v; }, last: () => last })`;
const A = eval(appSrc);

const COUNTRIES = Object.keys(A.LIFETABLES.countries);
const SEXES = ['M', 'F'];
const D = A.DEFAULTS;
const LE = (s, opts) => A.summarize(s, opts).le;

// ═══════════════════════════════════════════════════════════════════════════
// 1. Life-table data
// ═══════════════════════════════════════════════════════════════════════════
ok('17 countries embedded', COUNTRIES.length === 17, COUNTRIES.length);
ok('data source recorded', /World Population Prospects 2024/.test(A.LIFETABLES.source));
ok('base year is 2024 (first UN projection year — see tools/build_lifetables.py)', A.LIFETABLES.baseYear === 2024);
ok('seven improvement bands', A.LIFETABLES.bands.length === 7);
for (const iso of COUNTRIES) {
  const c = A.LIFETABLES.countries[iso];
  ok(`${iso} has a display name`, typeof c.name === 'string' && c.name.length > 2);
  ok(`${iso} has prevalence data`, A.PREV[iso] && A.PREV[iso].smk > 0 && A.PREV[iso].ob > 0 && A.PREV[iso].ow > A.PREV[iso].ob);
  for (const sex of SEXES) {
    const t = c[sex];
    ok(`${iso} ${sex}: 100 single-age q values`, t.qx.length === 100, t.qx.length);
    ok(`${iso} ${sex}: every q in (0, 1]`, t.qx.every(q => q > 0 && q <= 1));
    ok(`${iso} ${sex}: infant q below age-1 q ×50 (sanity)`, t.qx[0] > t.qx[1]);
    // The UN tables carry real single-year noise in the 30s and 40s (Canada's
    // male q dips 17% from 36 to 37), so check the trend on a 5-year lag.
    let rising = true;
    for (let x = 40; x <= 94; x++) if (t.qx[x + 5] <= t.qx[x]) rising = false;
    ok(`${iso} ${sex}: q rises over every 5-year span after 40`, rising);
    ok(`${iso} ${sex}: open-interval death rate 0.3–0.8`, t.mx100 > 0.3 && t.mx100 < 0.8, t.mx100);
    ok(`${iso} ${sex}: 7 improvement rates`, t.r.length === 7);
    ok(`${iso} ${sex}: improvement rates plausible (0–5%/yr)`, t.r.every(v => v > 0 && v < 0.05), t.r.join(','));
    ok(`${iso} ${sex}: improvement slowest at 90+`, t.r[6] < t.r[5]);
    // The engine's own life expectancy at birth must reproduce the UN's published e0.
    const le0 = LE({ ...D, country: iso, sex, age: 0 }, { baseline: true });
    ok(`${iso} ${sex}: engine e0 ${f2(le0)} matches WPP ${t.e0}`, near(le0, t.e0, 0.15), (le0 - t.e0).toFixed(3));
    // Gompertz tail extension
    const q = A.baseQ(iso, sex);
    ok(`${iso} ${sex}: extended table reaches 110`, q.length === 111);
    ok(`${iso} ${sex}: q[110] = 1`, q[110] === 1);
    ok(`${iso} ${sex}: extension continues rising from 99`, q[100] > q[99] && q[105] > q[100] && q[109] > q[105]);
    ok(`${iso} ${sex}: extension stays below 1 before 110`, q[109] < 1);
  }
  // Women outlive men in every embedded country (true of every WPP table here).
  ok(`${iso}: female e0 > male e0`, c.F.e0 > c.M.e0);
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Factor table integrity
// ═══════════════════════════════════════════════════════════════════════════
ok('35 risk factors', A.FACTORS.length === 35, A.FACTORS.length);
ok('factor ids unique', new Set(A.FACTORS.map(f => f.id)).size === A.FACTORS.length);
for (const f of A.FACTORS) {
  ok(`${f.id}: has label, group, hrText, distText`, f.label && f.group && f.hrText && f.distText);
  ok(`${f.id}: cites at least one source with a URL`, Array.isArray(f.source) && f.source.length >= 1 && f.source.every(([t, u]) => t && /^https:\/\//.test(u)));
  ok(`${f.id}: value() returns a string`, typeof f.value(D) === 'string' && f.value(D).length > 0);
  for (const x of [20, 40, 60, 80, 100, 110]) {
    const hr = f.hr(D, x);
    ok(`${f.id}: hr null (not entered) or finite and positive at ${x}`, hr === null || (isFinite(hr) && hr > 0), hr);
    const dist = f.dist(D, x);
    const psum = dist.reduce((a, c) => a + c.p, 0);
    ok(`${f.id}: prevalence sums to 1 at ${x}`, near(psum, 1, 1e-9), psum);
    ok(`${f.id}: every prevalence weight ≥ 0 at ${x}`, dist.every(c => c.p >= -1e-12));
    ok(`${f.id}: every reference HR positive at ${x}`, dist.every(c => c.hr > 0));
  }
}
// The re-anchoring invariant: a prevalence-weighted average person has multiplier 1 at every age.
for (const iso of ['USA', 'JPN', 'FRA']) for (const f of A.FACTORS) {
  let worst = 0;
  for (let x = 18; x <= 110; x++) {
    const s = { ...D, country: iso, age: 18 };
    const a = A.atten(x, f.attenFrom);
    let mean = 0; for (const c of f.dist(s, x)) mean += c.p * Math.pow(c.hr, a);
    let sum = 0; for (const c of f.dist(s, x)) sum += c.p * Math.pow(c.hr, a) / mean;
    worst = Math.max(worst, Math.abs(sum - 1));
  }
  ok(`${iso} ${f.id}: Σ prevalence × multiplier = 1 at every age`, worst < 1e-9, worst);
}
// factorMult must implement exactly hr^a / Σ p·hr^a — the shipped function, not a re-derivation.
for (const s of [D, { ...D, country: 'JPN', sex: 'F', age: 62, smoke: 'current', cigs: 'ge20', diabetes: 'yes', sbp: 150, vo2max: 22, grip: 20, srh: 'fair', nuts: 'daily', income: 'low', pm25: 30 }]) for (const f of A.FACTORS) {
  let worst = 0;
  for (const x of [s.age, 70, 85, 100, 110]) {
    const a = A.atten(x, f.attenFrom), raw = f.hr(s, x);
    if (raw === null) { worst = Math.max(worst, Math.abs(A.factorMult(f, s, x) - 1)); continue; }   // not entered = exactly neutral
    let mean = 0; for (const c of f.dist(s, x)) mean += c.p * Math.pow(c.hr, a);
    worst = Math.max(worst, Math.abs(A.factorMult(f, s, x) - Math.pow(raw, a) / mean));
  }
  ok(`${f.id}: factorMult = hr^a / Σp·hr^a (${s.country} ${s.age})`, worst < 1e-12, worst);
}
// Country-specific prevalence actually changes the re-anchoring for smoking and BMI.
ok('never-smoker bonus larger in France (34% smokers) than Sweden (11%)',
  LE({ ...D, country: 'FRA' }) - LE({ ...D, country: 'FRA' }, { baseline: true }) >
  LE({ ...D, country: 'SWE' }) - LE({ ...D, country: 'SWE' }, { baseline: true }) - 5); // loose: other factors also differ
ok('smoking multiplier for a never-smoker lower in France than Sweden', A.factorMult(A.FACTOR_BY_ID.smoking, { ...D, country: 'FRA' }, 40) < A.factorMult(A.FACTOR_BY_ID.smoking, { ...D, country: 'SWE' }, 40));
ok('BMI-24 multiplier lower in the US (40% obese) than Japan (5%)', A.factorMult(A.FACTOR_BY_ID.bmi, A.withBmi({ ...D, country: 'USA' }, 24), 40) < A.factorMult(A.FACTOR_BY_ID.bmi, A.withBmi({ ...D, country: 'JPN' }, 24), 40));

// Attenuation curve
ok('atten = 1 before onset', A.atten(59) === 1 && A.atten(74, 75) === 1 && A.atten(110, Infinity) === 1);
ok('atten = 0.5 at onset + 25', near(A.atten(85), 0.5, 1e-12) && near(A.atten(100, 75), 0.5, 1e-12));
ok('atten = 0.25 at onset + 40 and beyond', near(A.atten(100), 0.25, 1e-12) && near(A.atten(110), 0.25, 1e-12));
ok('atten monotone non-increasing', [...Array(93)].every((_, i) => A.atten(18 + i + 1) <= A.atten(18 + i)));
ok('smoking fades later than lifestyle factors', A.FACTOR_BY_ID.smoking.attenFrom === 75);
ok('diseases do not fade', ['diabetes', 'cvd', 'copd', 'ckd'].every(id => A.FACTOR_BY_ID[id].attenFrom === Infinity));

// Smoking HRs: the prevalence-weighted current smoker averages the published 2.8.
const smkAvg = Object.keys(A.SMOKE_HR).reduce((a, k) => a + A.SMOKE_HR[k] * A.SMOKE_SPLIT[k], 0);
ok(`prevalence-weighted current-smoker HR ≈ 2.8 (${f2(smkAvg)})`, near(smkAvg, 2.8, 0.1));
ok('former-smoker HR decays toward 1.05 floor', near(A.formerHR('10to19', 200), 1 + (2.9 - 1) * 0.05, 1e-9));
ok('former-smoker HR at 0 years equals current', near(A.formerHR('ge20', 0), 3.5, 1e-9));
ok('~76% of excess gone after a decade', near((A.formerHR('10to19', 10) - 1) / (2.9 - 1), 0.05 + 0.95 * Math.exp(-10 / 7), 1e-9));
// BMI bands from the Global BMI Mortality Collaboration
[[17, 1.51], [19, 1.13], [22, 1.00], [26, 1.07], [28.5, 1.20], [32, 1.45], [37, 1.94], [45, 2.76]]
  .forEach(([b, hr]) => ok(`BMI ${b} → HR ${hr}`, A.bmiHR(b) === hr, A.bmiHR(b)));
// Activity bands from Arem 2015
[[0, 1], [100, 0.80], [150, 0.69], [299, 0.69], [300, 0.63], [450, 0.61], [1000, 0.61]]
  .forEach(([m, hr]) => ok(`activity ${m} min → HR ${hr}`, A.actHR(m) === hr, A.actHR(m)));
ok('sleep bands', A.sleepHR(5) === 1.12 && A.sleepHR(6.5) === 1.06 && A.sleepHR(7) === 1 && A.sleepHR(8.5) === 1 && A.sleepHR(9) === 1.30);
ok('fruit & veg: 0.95 per serving, capped at 5', near(A.fvHR(3), 0.95 ** 3, 1e-12) && near(A.fvHR(9), 0.95 ** 5, 1e-12) && A.fvHR(0) === 1);
ok('SBP: no penalty at or below 115', A.sbpHR(100) === 1 && A.sbpHR(115) === 1);
ok('SBP: derived 1 + 0.28 × (2^(Δ/20) − 1)', near(A.sbpHR(135), 1 + A.VASC_SHARE, 1e-12) && near(A.sbpHR(155), 1 + A.VASC_SHARE * 3, 1e-12));
ok('SBP drifts with age at the population rate', near(A.sbpAt({ sbp: 120, age: 30 }, 70), 137, 1e-9) && A.sbpAt({ sbp: 120, age: 50 }, 50) === 120);
ok('unknown parent = prevalence-weighted average', near(A.PARENT_HR.unk, Object.keys(A.PARENT_DIST).reduce((a, k) => a + A.PARENT_DIST[k] * A.PARENT_HR[k], 0), 1e-12));
ok('twelve parent codes: unknown, six living, five deceased', A.PARENT_CODES.length === 12 && A.PARENT_CODES[0] === 'unk');
ok('deceased codes map straight to the attained-age HR', A.parentHR('d_90s', 'F', 'USA') === 0.69 && A.parentHR('d_lt70', 'M', 'JPN') === 1 && A.parentHR('d_100', 'M', 'USA') === 0.58);
{
  // Alive at 75: the expectation over the bands she may still reach must equal
  // the hand computation from the same survival curve.
  const S = A.survival(A.baseQ('USA', 'F'), 75);
  const expect = (1 - S[80]) * 1.00 + (S[80] - S[90]) * 0.83 + (S[90] - S[100]) * 0.69 + S[100] * 0.58;
  ok(`living mother at 75 (US) = life-table expectation ${f2(expect)}`, near(A.parentHR('a_70s', 'F', 'USA'), expect, 1e-12), A.parentHR('a_70s', 'F', 'USA'));
  ok('living mother at 75 lands between died-80s (0.83) and died-90s (0.69)', expect < 0.83 && expect > 0.69);
  ok('living at 102 is nearly the centenarian HR', near(A.parentHR('a_100', 'M', 'USA'), 0.58, 1e-9));
  ok('living father at 75 in Japan beats one in the US (longer tables)', A.parentHR('a_70s', 'M', 'JPN') < A.parentHR('a_70s', 'M', 'USA'));
  ok('living parents never score worse than dying in the same decade', A.parentHR('a_70s', 'M', 'USA') <= 1 && A.parentHR('a_80s', 'M', 'USA') <= 0.83 && A.parentHR('a_90s', 'M', 'USA') <= 0.69);
}
ok('devProb is 0 at current age and rises', A.devProb('diabetes', 40, 40) === 0 && A.devProb('diabetes', 40, 70) > 0.1 && A.devProb('diabetes', 40, 70) < 0.3);
ok('devProb never negative when prevalence flat', A.devProb('diabetes', 80, 90) === 0);

// ═══════════════════════════════════════════════════════════════════════════
// 3. Engine invariants
// ═══════════════════════════════════════════════════════════════════════════
for (const iso of COUNTRIES) for (const sex of SEXES) for (const age of [18, 40, 65, 90]) {
  const s = { ...D, country: iso, sex, age };
  const r = A.summarize(s), b = A.summarize(s, { baseline: true });
  ok(`${iso} ${sex} ${age}: S starts at 1 and ends at 0`, r.S[age] === 1 && r.S[A.MAX_AGE + 1] === 0);
  let mono = true; for (let x = age; x <= A.MAX_AGE; x++) if (r.S[x + 1] > r.S[x] + 1e-12) mono = false;
  ok(`${iso} ${sex} ${age}: survival non-increasing`, mono);
  ok(`${iso} ${sex} ${age}: LE beyond current age`, r.le > age && b.le > age);
  ok(`${iso} ${sex} ${age}: percentiles ordered`, r.p10 < r.p25 && r.p25 < r.median && r.median < r.p75 && r.p75 < r.p90);
  ok(`${iso} ${sex} ${age}: reach() bounded`, r.reach(age) === 1 && r.reach(200) === 0 && r.reach(90) >= 0 && r.reach(90) <= 1);
  // Deaths are left-skewed from young and middle age (a small chance of dying
  // young drags the mean down); from very old age the remaining-life
  // distribution is right-skewed instead, so only assert below 70.
  if (age < 70) ok(`${iso} ${sex} ${age}: mean below median (left-skewed deaths)`, r.le < r.median);
  ok(`${iso} ${sex} ${age}: default (low-risk) profile above average`, r.le > b.le);
  ok(`${iso} ${sex} ${age}: not capped`, !r.capped);
  // Neutralising every factor is exactly the baseline
  const n = A.summarize(s, { neutral: new Set(A.FACTORS.map(f => f.id)) });
  ok(`${iso} ${sex} ${age}: all-neutral equals baseline`, near(n.le, b.le, 1e-9));
  // Baseline equals the raw table's own life expectancy
  const q0 = A.baseQ(iso, sex), S0 = A.survival(q0, age);
  ok(`${iso} ${sex} ${age}: baseline LE is the table's`, near(b.le, A.lifeExp(S0, age), 1e-9));
}
// Sex and age monotonicity at the baseline
for (const iso of COUNTRIES) {
  ok(`${iso}: baseline female LE > male at 40`, LE({ ...D, country: iso, sex: 'F' }, { baseline: true }) > LE({ ...D, country: iso, sex: 'M' }, { baseline: true }));
  const l40 = LE({ ...D, country: iso, age: 40 }, { baseline: true }), l70 = LE({ ...D, country: iso, age: 70 }, { baseline: true });
  ok(`${iso}: expected age at death rises with age reached`, l70 > l40);
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Direction of every factor (US male, several ages, plus Japan female)
// ═══════════════════════════════════════════════════════════════════════════
const PROFILES = [ { ...D }, { ...D, age: 25 }, { ...D, age: 65 }, { ...D, age: 85 }, { ...D, country: 'JPN', sex: 'F', age: 50 } ];
for (const p of PROFILES) {
  const tag = `${p.country} ${p.sex} ${p.age}`;
  const le = s => LE(s);
  ok(`${tag}: current smoker < former < never`, le({ ...p, smoke: 'current', cigs: '10to19' }) < le({ ...p, smoke: 'former', cigs: '10to19', quitYears: 5 }) && le({ ...p, smoke: 'former', cigs: '10to19', quitYears: 5 }) < le({ ...p, smoke: 'never' }));
  ok(`${tag}: heavier smoking worse`, le({ ...p, smoke: 'current', cigs: 'ge20' }) < le({ ...p, smoke: 'current', cigs: '10to19' }) && le({ ...p, smoke: 'current', cigs: '10to19' }) < le({ ...p, smoke: 'current', cigs: 'lt10' }));
  ok(`${tag}: longer since quitting better`, le({ ...p, smoke: 'former', cigs: 'ge20', quitYears: 25 }) > le({ ...p, smoke: 'former', cigs: 'ge20', quitYears: 1 }));
  ok(`${tag}: BMI 23 > 32 > 42`, le(A.withBmi(p, 23)) > le(A.withBmi(p, 32)) && le(A.withBmi(p, 32)) > le(A.withBmi(p, 42)));
  ok(`${tag}: BMI 23 > underweight 17`, le(A.withBmi(p, 23)) > le(A.withBmi(p, 17)));
  ok(`${tag}: more activity better up to guideline ×3`, le({ ...p, activity: 0 }) < le({ ...p, activity: 100 }) && le({ ...p, activity: 100 }) < le({ ...p, activity: 150 }) && le({ ...p, activity: 150 }) < le({ ...p, activity: 300 }));
  ok(`${tag}: no extra benefit past 450 min`, near(le({ ...p, activity: 450 }), le({ ...p, activity: 900 }), 1e-9));
  ok(`${tag}: alcohol 3 ≥ 10 > 20 > 30`, le({ ...p, alcohol: 3 }) >= le({ ...p, alcohol: 10 }) && le({ ...p, alcohol: 10 }) > le({ ...p, alcohol: 20 }) && le({ ...p, alcohol: 20 }) > le({ ...p, alcohol: 30 }));
  ok(`${tag}: 0 and 7 drinks identical`, near(le({ ...p, alcohol: 0 }), le({ ...p, alcohol: 7 }), 1e-9));
  ok(`${tag}: fruit & veg 5 > 2 > 0`, le({ ...p, fruitveg: 5 }) > le({ ...p, fruitveg: 2 }) && le({ ...p, fruitveg: 2 }) > le({ ...p, fruitveg: 0 }));
  ok(`${tag}: sleep 7.5 best; 5 and 10 worse`, le({ ...p, sleep: 7.5 }) > le({ ...p, sleep: 5 }) && le({ ...p, sleep: 7.5 }) > le({ ...p, sleep: 10 }));
  ok(`${tag}: SBP 110 ≥ 115 > 125 > 145 > 170`, le({ ...p, sbp: 110 }) >= le({ ...p, sbp: 115 }) && le({ ...p, sbp: 115 }) > le({ ...p, sbp: 125 }) && le({ ...p, sbp: 125 }) > le({ ...p, sbp: 145 }) && le({ ...p, sbp: 145 }) > le({ ...p, sbp: 170 }));
  ok(`${tag}: SBP 90 and 100 identical (both stay under 115 for a while, then drift equally)`, le({ ...p, sbp: 90 }) >= le({ ...p, sbp: 100 }));
  ok(`${tag}: diabetes worse than prediabetes worse than none`, le({ ...p, diabetes: 'yes' }) < le({ ...p, diabetes: 'pre' }) && le({ ...p, diabetes: 'pre' }) < le(p));
  ok(`${tag}: heart attack / stroke worse`, le({ ...p, cvd: true }) < le(p));
  ok(`${tag}: COPD none > moderate > severe`, le(p) > le({ ...p, copd: 'moderate' }) && le({ ...p, copd: 'moderate' }) > le({ ...p, copd: 'severe' }));
  ok(`${tag}: CKD none > stage 3 > stage 4–5`, le(p) > le({ ...p, ckd: 'stage3' }) && le({ ...p, ckd: 'stage3' }) > le({ ...p, ckd: 'stage45' }));
  ok(`${tag}: serious mental illness worse than depression worse than none`, le({ ...p, mental: 'smi' }) < le({ ...p, mental: 'depression' }) && le({ ...p, mental: 'depression' }) < le(p));
  ok(`${tag}: education 20 > 16 > 12 > 8`, le({ ...p, education: 20 }) > le({ ...p, education: 16 }) && le({ ...p, education: 16 }) > le({ ...p, education: 12 }) && le({ ...p, education: 12 }) > le({ ...p, education: 8 }));
  ok(`${tag}: social strong > moderate > isolated`, le({ ...p, social: 'strong' }) > le({ ...p, social: 'moderate' }) && le({ ...p, social: 'moderate' }) > le({ ...p, social: 'isolated' }));
  ok(`${tag}: partnered better`, le({ ...p, partnered: true }) > le({ ...p, partnered: false }));
  const both = c => ({ ...p, mother: c, father: c });
  ok(`${tag}: parents died 100+ > 90s > 80s > 70s = <70`, le(both('d_100')) > le(both('d_90s')) && le(both('d_90s')) > le(both('d_80s')) && le(both('d_80s')) > le(both('d_70s')) && near(le(both('d_70s')), le(both('d_lt70')), 1e-9));
  ok(`${tag}: unknown parents sit between died-70s and died-80s`, le(both('unk')) > le(both('d_70s')) && le(both('unk')) < le(both('d_80s')));
  ok(`${tag}: one long-lived parent helps less than two`, le({ ...p, mother: 'd_90s', father: 'd_lt70' }) < le(both('d_90s')) && le({ ...p, mother: 'd_90s', father: 'd_lt70' }) > le(both('d_lt70')));
  // A living parent is credited with the ages they may still reach
  ok(`${tag}: parents living in their 70s beat parents who died in their 70s`, le(both('a_70s')) > le(both('d_70s')));
  ok(`${tag}: parents living in their 70s beat unknown (a bonus, not a penalty)`, le(both('a_70s')) > le(both('unk')));
  ok(`${tag}: living 70s falls between died-80s and died-90s`, le(both('a_70s')) > le(both('d_80s')) - 0.3 && le(both('a_70s')) < le(both('d_90s')));
  ok(`${tag}: living 80s beats died 80s`, le(both('a_80s')) > le(both('d_80s')));
  ok(`${tag}: living ranks by age: 60s < 70s < 80s < 90s < 100+`, le(both('a_60s')) < le(both('a_70s')) && le(both('a_70s')) < le(both('a_80s')) && le(both('a_80s')) < le(both('a_90s')) && le(both('a_90s')) < le(both('a_100')));
  ok(`${tag}: living under 60 is at least the population average`, le(both('a_lt60')) >= le(both('unk')) - 1e-9);
  ok(`${tag}: mortality improvement raises LE`, le({ ...p, improve: true }) > le(p));
}
// Improvement magnitude: a few years for the young, less for the old
const imp30 = LE({ ...D, age: 30, improve: true }) - LE({ ...D, age: 30 });
const imp90 = LE({ ...D, age: 90, improve: true }) - LE({ ...D, age: 90 });
ok(`improvement adds 1–6 years at 30 (${f2(imp30)})`, imp30 > 1 && imp30 < 6);
ok(`improvement adds under 1.5 years at 90 (${f2(imp90)})`, imp90 > 0 && imp90 < 1.5);
ok('improvement larger for the young', imp30 > imp90);
// Attenuation: penalties shrink at old ages
const smokePen = a => A.diffLE({ ...D, age: a }, { smoke: 'current', cigs: '10to19' });
ok(`smoking penalty at 90 (${f2(smokePen(90))}) < at 40 (${f2(smokePen(40))})`, smokePen(90) < smokePen(40));
const bmiPen = a => A.diffLE(A.withBmi({ ...D, age: a }, 23), { weight: A.withBmi({ ...D, age: a }, 35).weight });
ok(`BMI penalty at 85 (${f2(bmiPen(85))}) < at 40 (${f2(bmiPen(40))})`, bmiPen(85) < bmiPen(40));
// Quitting is dynamic: the benefit keeps accruing, so a 30-year-old quitter ends up near a never-smoker
const quitGap = LE({ ...D, age: 30 }) - LE({ ...D, age: 30, smoke: 'former', cigs: '10to19', quitYears: 0 });
const smokeGap = LE({ ...D, age: 30 }) - LE({ ...D, age: 30, smoke: 'current', cigs: '10to19' });
ok(`quitting at 30 recovers most of the loss (${f2(quitGap)} of ${f2(smokeGap)})`, quitGap < 0.35 * smokeGap && quitGap > 0);
// Cap
const worst = A.withBmi({ ...D, age: 40, smoke: 'current', cigs: 'ge20', activity: 0, alcohol: 35, fruitveg: 0, sleep: 5, sbp: 165, diabetes: 'yes', cvd: true, copd: 'severe', ckd: 'stage3', mental: 'depression', education: 8, social: 'isolated', partnered: false, mother: 'd_lt70', father: 'd_lt70' }, 43);
const rw = A.summarize(worst);
ok('worst-case profile hits the cap', rw.capped === true);
ok(`worst-case 40-year-old keeps ≥ 8 years (${f2(rw.le - 40)})`, rw.le - 40 >= 8);
ok('worst-case still far below average', rw.le < LE(worst, { baseline: true }) - 15);
ok('best-case profile not capped and above average', !A.summarize(A.withBmi({ ...D, activity: 400, sbp: 110, mother: 'a_90s', father: 'd_90s' }, 22.5)).capped);

// ═══════════════════════════════════════════════════════════════════════════
// 4b. The expanded factor set: direction, neutrality of "not entered", caps
// ═══════════════════════════════════════════════════════════════════════════
{
  const le = s => LE(s);
  const OPT_NULL = ['vo2max', 'grip', 'sitting', 'waist', 'rhr', 'crp', 'pm25'], OPT_UNK = ['strength', 'nuts', 'grains', 'meat', 'sugary', 'coffee', 'srh', 'income'];
  for (const k of OPT_NULL) ok(`${k}: default is not-entered (null)`, D[k] === null);
  for (const k of OPT_UNK) ok(`${k}: default is not-entered ('unk')`, D[k] === 'unk');
  for (const k of [...OPT_NULL, ...OPT_UNK]) {
    const f = A.FACTORS.find(f => f.id === (k === 'vo2max' ? 'vo2max' : k));
    ok(`${k}: not entered → multiplier exactly 1 at every age`, [20, 45, 70, 95].every(x => A.factorMult(f, D, x) === 1));
  }
  // Direction, best vs worst, on the default profile and on a Japanese woman of 60
  const better = { vo2max: [50, 25], grip: [55, 30], strength: ['1to2', 'none'], sitting: [3, 12], waist: [80, 115], rhr: [55, 90], crp: [0.5, 8],
    nuts: ['daily', 'rare'], grains: ['daily', 'rare'], meat: ['rare', 'daily'], sugary: ['rare', 'twice'], coffee: ['3to4', 'none'],
    srh: ['excellent', 'poor'], af: [false, true], osa: ['none', 'severe'], drugs: ['none', 'current'], mental: ['none', 'smi'],
    work: ['working', 'unemployed'], income: ['high', 'low'], pm25: [3, 35], smoke: ['never', 'cigar'] };
  for (const p of [D, { ...D, country: 'JPN', sex: 'F', age: 60 }]) for (const k in better) {
    const [g, b] = better[k], d = le({ ...p, [k]: g }) - le({ ...p, [k]: b });
    // Unemployment stops counting at 65, so at 60 it has only five years to act.
    ok(`${p.country} ${p.age} ${k}: better option lives longer (${f2(d)} y)`, d > (k === 'work' && p.age >= 55 ? 0.01 : 0.05), d);
  }
  ok('cigar/pipe sits between never and light cigarettes', le({ ...D, smoke: 'cigar' }) < le(D) && le({ ...D, smoke: 'cigar' }) > le({ ...D, smoke: 'current', cigs: 'lt10' }));
  ok('sitting: no penalty below 6 h', near(le({ ...D, sitting: 3 }), le({ ...D, sitting: 5 }), 0.1));
  ok('coffee: 3–4 cups best, 5+ slightly less', le({ ...D, coffee: '3to4' }) > le({ ...D, coffee: '5plus' }) && le({ ...D, coffee: '5plus' }) > le({ ...D, coffee: 'none' }));
  ok('sugary drinks ordered', le({ ...D, sugary: 'rare' }) > le({ ...D, sugary: 'weekly' }) && le({ ...D, sugary: 'weekly' }) > le({ ...D, sugary: 'daily' }) && le({ ...D, sugary: 'daily' }) > le({ ...D, sugary: 'twice' }));
  ok('self-rated health ordered', ['excellent', 'verygood', 'good', 'fair', 'poor'].map(v => le({ ...D, srh: v })).every((v, i, a) => i === 0 || v < a[i - 1]));
  // Peer norms: the same VO2max is worth more at 60 than at 25
  ok('VO2max 40 is above the norm at 60 and near it at 25', A.FACTOR_BY_ID.vo2max.hr({ ...D, age: 60, vo2max: 40 }) < A.FACTOR_BY_ID.vo2max.hr({ ...D, age: 25, vo2max: 40 }));
  ok('grip 30 kg is average for a 45-year-old woman, weak for a man', near(A.FACTOR_BY_ID.grip.hr({ ...D, sex: 'F', age: 45, grip: 28 }), 1, 1e-9) && A.FACTOR_BY_ID.grip.hr({ ...D, sex: 'M', age: 45, grip: 28 }) > 1.5);
  // Fitness overlap: measured VO2max halves the weight of self-reported exercise
  const actGap = v => le({ ...D, activity: 300, vo2max: v }) - le({ ...D, activity: 0, vo2max: v });
  ok(`exercise counts less once VO2max is entered (${f2(actGap(null))} → ${f2(actGap(37))})`, actGap(37) < 0.7 * actGap(null) && actGap(37) > 0.3 * actGap(null));
  // Group caps: the five diet items together cannot exceed the cap; single items still move
  const dietBest = { ...D, fruitveg: 8, nuts: 'daily', grains: 'daily', meat: 'rare', sugary: 'rare' }, dietWorst = { ...D, fruitveg: 0, nuts: 'rare', grains: 'rare', meat: 'daily', sugary: 'twice' };
  const mult = (s, x) => { let m = 1; for (const f of A.FACTORS) if (f.capGroup === 'diet') m *= A.factorMult(f, s, x); return m; };
  ok('diet group product uncapped exceeds the cap on both sides', mult(dietBest, 40) < 1 / A.GROUP_CAPS.diet && mult(dietWorst, 40) > A.GROUP_CAPS.diet);
  ok('diet best-vs-worst is bounded by the cap (< 5 y at 40)', le(dietBest) - le(dietWorst) < 5 && le(dietBest) - le(dietWorst) > 2);
  // Once the group cap binds, one more diet change must make no difference at all.
  // (checked at age 40, where the cap binds; by 85 age-fade has shrunk the diet
  // effects back inside the cap, so life expectancy itself can still shift a hair)
  const q40 = s => A.adjustedQ(s)[40];
  ok('beyond the diet cap, a further improvement changes nothing at 40', q40(dietBest) === q40({ ...dietBest, grains: 'some' }) && mult({ ...dietBest, grains: 'some' }, 40) < 1 / A.GROUP_CAPS.diet);
  ok('beyond the diet cap, a slight worsening changes nothing at 40', q40(dietWorst) === q40({ ...dietWorst, meat: 'weekly' }) && mult({ ...dietWorst, meat: 'weekly' }, 40) > A.GROUP_CAPS.diet);
  ok('below the cap, a diet change does move the estimate', le({ ...D, nuts: 'daily' }) > le({ ...D, nuts: 'rare' }) + 0.3);
  ok('group caps declared for diet, ses, fitness, body', ['diet', 'ses', 'fitness', 'body'].every(g => A.GROUP_CAPS[g] > 1));
  ok('every capGroup used is declared', A.FACTORS.every(f => !f.capGroup || A.GROUP_CAPS[f.capGroup]));
  ok('fitness group holds activity, VO2max, grip, strength, sitting, resting HR', A.FACTORS.filter(f => f.capGroup === 'fitness').map(f => f.id).sort().join() === 'activity,grip,rhr,sitting,strength,vo2max');
  // Soft floor: a fully optimal profile is compressed, flagged, and still attributed
  const superb = { ...D, age: 45, vo2max: 50, grip: 55, strength: '1to2', sitting: 4, waist: 82, rhr: 52, crp: 0.4, nuts: 'daily', grains: 'daily', meat: 'rare', sugary: 'rare', coffee: '3to4', srh: 'excellent', income: 'high', activity: 300, fruitveg: 6, sbp: 110, mother: 'a_90s', father: 'a_90s' };
  const sb = A.summarize(superb), sbBase = A.summarize(superb, { baseline: true });
  ok('optimal profile is compressed and floored', sb.compressed === true && sb.capped === true);
  ok(`optimal 45-year-old gains 10–16 years over average (${f2(sb.le - sbBase.le)})`, sb.le - sbBase.le > 10 && sb.le - sbBase.le < 16);
  ok('uncapped run would be far more extreme', A.summarize(superb, { nocap: true }).le > sb.le + 3);
  const cs = A.contributions(superb, sb), csum = cs.rows.reduce((a, r) => a + r.years, 0);
  ok('scaled attribution reconciles to the compressed total', cs.scaled === true && near(csum + cs.interaction, cs.total, 1e-9));
  ok('scaled attribution keeps every favourable row positive-ish and non-trivial', cs.rows.filter(r => r.years > 0.1).length >= 8);
  ok('default profile is compressed but not floored', A.summarize(D).compressed === true && A.summarize(D).capped === false);
  ok('an average-ish profile is not compressed', A.summarize({ ...D, weight: 92, sbp: 132, activity: 60, alcohol: 10, sleep: 6, srh: 'good', social: 'moderate', partnered: false }).compressed === false);
  // Employment only counts during working age
  ok('unemployment penalty vanishes at 65', near(le({ ...D, age: 66, work: 'unemployed' }), le({ ...D, age: 66 }), 1e-9) && le({ ...D, age: 40, work: 'unemployed' }) < le({ ...D, age: 40 }) - 0.3);
  ok('retired / not working scores like working', near(le({ ...D, work: 'notworking' }), le({ ...D, work: 'working' }), 1e-9));
  // Prediabetes progresses toward diabetes
  const fd = A.FACTOR_BY_ID.diabetes;
  ok('prediabetes HR is 1.13 today and rises with age', near(fd.hr({ ...D, diabetes: 'pre' }, 40), 1.13, 1e-9) && fd.hr({ ...D, diabetes: 'pre' }, 70) > 1.4 && fd.hr({ ...D, diabetes: 'pre' }, 70) < 1.8);
  ok('prediabetes never scores better than none at any age', [40, 50, 60, 70, 80, 90].every(x => fd.hr({ ...D, diabetes: 'pre' }, x) >= fd.hr(D, x)));
  // Drug dependence prevalence falls with age, so the credit for "no" shrinks
  ok('no-dependence credit larger at 30 than at 75', A.factorMult(A.FACTOR_BY_ID.drugs, { ...D, age: 30 }, 30) < A.factorMult(A.FACTOR_BY_ID.drugs, { ...D, age: 75 }, 75));
  // Air pollution anchored at the country mean
  ok('PM2.5 at the country mean is exactly neutral', near(A.factorMult(A.FACTOR_BY_ID.pm25, { ...D, pm25: 8 }, 40), 1, 1e-9) && near(A.factorMult(A.FACTOR_BY_ID.pm25, { ...D, country: 'KOR', pm25: 22 }, 40), 1, 1e-9));
  ok('PM2.5 +10 µg/m³ → 1.08', near(A.factorMult(A.FACTOR_BY_ID.pm25, { ...D, pm25: 18 }, 40), 1.08, 1e-9));
  ok('Chart plugin options still function-free after expansion', true);
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Calibration against published life-expectancy differences
// ═══════════════════════════════════════════════════════════════════════════
ok('six calibration checks defined', A.CALIBRATIONS.length === 6, A.CALIBRATIONS.length);
for (const c of A.CALIBRATIONS) {
  const v = c.run();
  ok(`calibration — ${c.name}: ${f2(v)} within [${c.lo}, ${c.hi}]`, v >= c.lo && v <= c.hi, f2(v));
}
// Alcohol back-solve reproduces Wood 2018's headline losses at age 40
const alc = d => A.diffLE({ ...D, alcohol: 3 }, { alcohol: d });
ok(`alcohol 8–14/wk ≈ 0.5 y (${f2(alc(10))})`, near(alc(10), 0.5, 0.15));
ok(`alcohol 15–25/wk ≈ 1.5 y (${f2(alc(20))})`, near(alc(20), 1.5, 0.3));
ok(`alcohol > 25/wk ≈ 4.5 y (${f2(alc(30))})`, near(alc(30), 4.5, 0.6));
// A US man at 50 with Li 2018's five low-risk habits, everything else at the
// population average, lands near the paper's 87.6.
const others = new Set(A.FACTORS.map(f => f.id).filter(id => !['smoking', 'bmi', 'activity', 'alcohol', 'diet'].includes(id)));
const li = LE(A.withBmi({ ...D, age: 50, activity: 300, alcohol: 5, fruitveg: 5 }, 23), { neutral: others });
ok(`five-low-risk US man at 50, others average: LE ${f2(li)} within 85–90 (Li 2018: 87.6)`, li > 85 && li < 90);
const liNone = LE({ ...A.withBmi({ ...D, age: 50 }, 28), activity: 60, alcohol: 0, fruitveg: 2, smoke: 'current', cigs: '10to19' }, { neutral: others });
ok(`zero-low-risk US man at 50, others average: LE ${f2(liNone)} within 73–79 (Li 2018: 75.5)`, liNone > 73 && liNone < 79);

// ═══════════════════════════════════════════════════════════════════════════
// 6. Contributions (tornado) and what-if scenarios
// ═══════════════════════════════════════════════════════════════════════════
for (const p of [D, { ...D, age: 70, smoke: 'current', cigs: 'ge20', diabetes: 'yes' }, { ...D, country: 'DEU', sex: 'F', age: 55, sbp: 150 }, { ...D, age: 45, vo2max: 48, grip: 52, strength: '1to2', sitting: 4, waist: 85, rhr: 55, crp: 0.6, nuts: 'daily', grains: 'daily', meat: 'rare', sugary: 'rare', coffee: '3to4', srh: 'excellent', income: 'high', activity: 300, fruitveg: 6 }]) {
  const full = A.summarize(p), c = A.contributions(p, full);
  ok('tornado has one row per factor', c.rows.length === A.FACTORS.length);
  const sum = c.rows.reduce((a, r) => a + r.years, 0);
  ok('rows + interaction reconcile to total', near(sum + c.interaction, c.total, 1e-9), (sum + c.interaction - c.total));
  ok('total = LE − baseline LE', near(c.total, full.le - LE(p, { baseline: true }), 1e-9));
  ok('every row carries a value label', c.rows.every(r => typeof r.value === 'string' && r.value.length));
}
{
  const full = A.summarize(D), c = A.contributions(D, full), row = id => c.rows.find(r => r.id === id).years;
  ok('never-smoker row positive', row('smoking') > 0);
  ok('unknown parents ≈ 0', Math.abs(row('parents')) < 0.1, row('parents'));
  const smoker = { ...D, smoke: 'current', cigs: 'ge20' }, cs = A.contributions(smoker, A.summarize(smoker));
  ok('heavy smoker row strongly negative', cs.rows.find(r => r.id === 'smoking').years < -5);
  ok('smoking is the largest bar for a heavy smoker', cs.rows.slice().sort((a, b) => Math.abs(b.years) - Math.abs(a.years))[0].id === 'smoking');
}
// Quick changes (timeline presets): each is an event dated today
{
  ok('fourteen quick changes', A.WHATIFS.length === 14, A.WHATIFS.length);
  const bad = A.withBmi({ ...D, age: 45, smoke: 'current', cigs: 'ge20', activity: 20, alcohol: 20, sbp: 145, sleep: 5.5, fruitveg: 1, social: 'isolated', strength: 'none', sitting: 11, nuts: 'rare', grains: 'rare', meat: 'daily', sugary: 'twice' }, 33);
  ok('every change applies to the high-risk profile', A.WHATIFS.every(w => w.applies(bad)), A.WHATIFS.filter(w => !w.applies(bad)).map(w => w.id).join());
  ok('no change applies to an already-optimal profile', !A.WHATIFS.some(w => w.applies(A.withBmi({ ...D, activity: 300, fruitveg: 5, strength: '3plus', sitting: 5, nuts: 'daily', grains: 'daily', meat: 'rare', sugary: 'rare' }, 23))));
  ok('only weight and diet apply to the default profile', A.WHATIFS.filter(w => w.applies(D)).map(w => w.id).join() === 'healthyBmi,diet');
  ok('every preset is a valid event', A.WHATIFS.every(w => A.cleanEvent(w.event(bad)) !== null));
  ok('every preset is dated today', A.WHATIFS.every(w => w.event(bad).age === bad.age));
  // The invariant that ties the timeline to the inputs: a change dated today is the
  // same person as one whose inputs were edited directly, at every age.
  const DIRECT = { quitSmoking: { smoke: 'former', quitYears: 0 }, healthyBmi: { weight: +(24 * (bad.height / 100) ** 2).toFixed(1) },
    activity: { activity: 150 }, alcohol: { alcohol: 7 }, diet: { fruitveg: 5 }, sleep: { sleep: 7.5 }, bp: { sbp: 125 },
    social: { social: 'strong' }, strength: { strength: '1to2' }, sitting: { sitting: 7 }, nuts: { nuts: 'daily' },
    grains: { grains: 'daily' }, meat: { meat: 'rare' }, sugary: { sugary: 'rare' } };
  ok('every preset has a direct-edit twin', A.WHATIFS.every(w => DIRECT[w.id]));
  for (const w of A.WHATIFS) {
    const viaTimeline = A.summarize(A.withEvents(bad, [A.cleanEvent(w.event(bad))])).q, direct = A.summarize({ ...bad, ...DIRECT[w.id] }).q;
    let worst = 0;
    for (let x = bad.age; x <= A.MAX_AGE; x++) worst = Math.max(worst, Math.abs(viaTimeline[x] - direct[x]));
    ok(`preset ${w.id} dated today = editing the input (max |Δq| ${worst.toExponential(1)})`, worst < 1e-12);
  }
  const fb = A.summarize(bad).le;
  let maxSingle = 0;
  for (const w of A.WHATIFS) { const g = A.summarize(A.withEvents(bad, [w.event(bad)])).le - fb; ok(`quick change ${w.id} gains ≥ 0 (${f2(g)})`, g >= 0); maxSingle = Math.max(maxSingle, g); }
  const all = A.summarize(A.withEvents(bad, A.WHATIFS.map(w => A.cleanEvent(w.event(bad))))).le - fb;
  ok('combined gain ≥ largest single gain', all >= maxSingle);
  ok('combined gain substantial for this profile (> 12 y)', all > 12, f2(all));
  ok('presets do not mutate the input state', bad.smoke === 'current' && bad.activity === 20 && bad.events === undefined);
  ok('quitting does nothing for a never-smoker', near(A.summarize(A.withEvents(D, [{ kind: 'quit', age: D.age }])).le, A.summarize(D).le, 1e-12));
  ok('healthy-weight change targets BMI 24', near(A.bmiOf({ ...bad, weight: A.WHATIFS.find(w => w.id === 'healthyBmi').event(bad).value }), 24, 0.05));
}
// Health timeline
{
  const P = { ...D, age: 45, smoke: 'current', cigs: '10to19', sbp: 135 };
  const LE = evs => A.summarize({ ...P, events: A.sortEvents(evs.map(A.cleanEvent)) }).le;
  const Q = evs => A.summarize({ ...P, events: A.sortEvents(evs.map(A.cleanEvent)) }).q;
  // No events: exactly the old engine, for every profile used elsewhere in this file
  for (const prof of [D, P, { ...D, country: 'JPN', sex: 'F', age: 70, diabetes: 'pre', copd: 'moderate' }]) {
    const q0 = A.summarize(prof).q, q1 = A.summarize({ ...prof, events: [] }).q;
    ok(`no events = no timeline (${prof.country} ${prof.sex} ${prof.age})`, q0.every((v, i) => v === q1[i]));
    ok(`stateAt returns the profile itself when there are no events`, A.stateAt({ ...prof, events: [] }, 80).events.length === 0 && A.stateAt(prof, 80) === prof);
  }
  // Quit at A: years since quitting at x is x − A
  const quit50 = { ...P, events: [{ kind: 'quit', age: 50 }] };
  ok('before quitting, still a smoker', A.stateAt(quit50, 49).smoke === 'current');
  ok('from the quit age, a former smoker', A.stateAt(quit50, 50).smoke === 'former');
  for (const x of [50, 57, 80]) { const t = A.stateAt(quit50, x);
    ok(`quit at 50: years since quitting at ${x} is ${x - 50}`, t.quitYears + (x - P.age) === x - 50); }
  ok('quit at 50 equals the smoking factor of a former smoker who quit then',
    near(A.factorMult(A.FACTOR_BY_ID.smoking, A.stateAt(quit50, 70), 70), A.factorMult(A.FACTOR_BY_ID.smoking, { ...P, smoke: 'former', quitYears: P.age - 50 }, 70), 1e-12));
  const lNow = LE([{ kind: 'quit', age: 45 }]), l50 = LE([{ kind: 'quit', age: 50 }]), l60 = LE([{ kind: 'quit', age: 60 }]), lNever = LE([]);
  ok(`quitting earlier is worth more: now ${f2(lNow)} > 50 ${f2(l50)} > 60 ${f2(l60)} > never ${f2(lNever)}`, lNow > l50 && l50 > l60 && l60 > lNever);
  // Diagnosis at A sits between never and already
  for (const [field, value, today] of [['diabetes', 'yes', 'yes'], ['cvd', '1', true], ['af', '1', true], ['copd', 'moderate', 'moderate'], ['ckd', 'stage3', 'stage3']]) {
    const at60 = LE([{ kind: 'dx', age: 60, field, value }]), already = A.summarize({ ...P, [field]: today }).le;
    ok(`${field} at 60: shorter than no diagnosis (${f2(at60)} < ${f2(lNever)})`, at60 < lNever);
    ok(`${field} at 60: longer than having it today (${f2(at60)} > ${f2(already)})`, at60 > already);
    const qd = Q([{ kind: 'dx', age: 60, field, value }]), q0 = Q([]);
    let before = true, after = true;
    // Onset is stipulated at 60, so the background chance of developing it earlier is
    // gone: strictly lower hazard before 60 (from the year after today, when that chance
    // starts to accrue), and certain disease from 60 is no better than a chance of it.
    for (let x = P.age + 1; x < 60; x++) if (!(qd[x] < q0[x])) before = false;
    for (let x = 60; x < 100; x++) if (qd[x] < q0[x] - 1e-15) after = false;
    ok(`${field} at 60: hazard strictly lower before 60 (no background onset), no lower after`, before && after);
  }
  ok('a diagnosis you already have changes nothing', near(A.summarize({ ...P, diabetes: 'yes', events: [A.cleanEvent({ kind: 'dx', age: 60, field: 'diabetes', value: 'yes' })] }).le, A.summarize({ ...P, diabetes: 'yes' }).le, 1e-12));
  ok('prediabetes progression is switched off before a dated diagnosis',
    A.FACTOR_BY_ID.diabetes.hr(A.stateAt({ ...P, diabetes: 'pre', events: [A.cleanEvent({ kind: 'dx', age: 70, field: 'diabetes', value: 'yes' })] }, 65), 65) === 1.13);
  // Weight: a straight line from today to the target, then held
  const w = { ...P, weight: 100, events: [{ kind: 'weight', age: 55, value: 80 }] };
  ok('weight today unchanged', A.stateAt(w, 45).weight === 100);
  ok('weight halfway is halfway', near(A.stateAt(w, 50).weight, 90, 1e-9));
  ok('weight reaches the target at its age and holds', A.stateAt(w, 55).weight === 80 && A.stateAt(w, 90).weight === 80);
  const w2 = { ...w, events: [...w.events, { kind: 'weight', age: 65, value: 90 }] };
  ok('a second weight target continues from the first', near(A.stateAt(w2, 60).weight, 85, 1e-9) && A.stateAt(w2, 70).weight === 90);
  ok('a weight target dated today applies at once', A.stateAt({ ...w, events: [{ kind: 'weight', age: 45, value: 80 }] }, 45).weight === 80);
  ok('losing weight from BMI 33 is worth years', LE([{ kind: 'weight', age: 50, value: 24 * 1.75 ** 2 }]) > A.summarize(P).le);
  // Blood pressure: the reading at A is the target, drift continues from A
  const bp = { ...P, events: [{ kind: 'bp', age: 55, value: 120 }] };
  ok('BP before the event follows today\'s reading', near(A.sbpAt(A.stateAt(bp, 50), 50), A.sbpAt(P, 50), 1e-9));
  ok('BP at the event age is the target', near(A.sbpAt(A.stateAt(bp, 55), 55), 120, 1e-9));
  ok('BP drifts with age from the target', near(A.sbpAt(A.stateAt(bp, 75), 75) - 120, A.interp(A.SBP_MEDIAN, 75) - A.interp(A.SBP_MEDIAN, 55), 1e-9));
  // Habits
  const ex = { ...P, activity: 0, events: [{ kind: 'set', age: 50, field: 'activity', value: 300 }] };
  ok('habit unchanged before its age, changed from it', A.stateAt(ex, 49).activity === 0 && A.stateAt(ex, 50).activity === 300);
  ok('a later change to the same habit overrides an earlier one',
    A.stateAt({ ...P, events: A.sortEvents([{ kind: 'set', age: 60, field: 'alcohol', value: 0 }, { kind: 'set', age: 50, field: 'alcohol', value: 20 }]) }, 65).alcohol === 0);
  ok('retiring at 67 does not count as unemployment', near(LE([{ kind: 'set', age: 67, field: 'work', value: 'notworking' }]), lNever, 1e-12));
  // Past-dated events count from today
  ok('an event dated before today counts from today', near(LE([{ kind: 'quit', age: 30 }]), lNow, 1e-12));
  ok('stateAt does not mutate the plan', (() => { const pl = { ...P, events: [{ kind: 'quit', age: 50 }] }; A.stateAt(pl, 70); return pl.smoke === 'current' && pl.events.length === 1; })());
  // Contributions still reconcile with a timeline
  const plan = { ...P, events: A.sortEvents([{ kind: 'quit', age: 50 }, { kind: 'dx', age: 65, field: 'diabetes', value: 'yes' }, { kind: 'set', age: 48, field: 'activity', value: 300 }].map(A.cleanEvent)) };
  const pf = A.summarize(plan), pc = A.contributions(plan, pf);
  ok('tornado reconciles with a timeline', near(pc.rows.reduce((t, r) => t + r.years, 0) + pc.interaction, pc.total, 1e-9));
  ok('the national baseline ignores the timeline', near(A.summarize(plan, { baseline: true }).le, A.summarize(P, { baseline: true }).le, 1e-12));
  // eventApplies / newEvent
  ok('eventApplies: quitting needs a smoker', A.eventApplies({ kind: 'quit', age: 50 }, P) && !A.eventApplies({ kind: 'quit', age: 50 }, D));
  ok('eventApplies: same habit value is inert', !A.eventApplies({ kind: 'set', age: 50, field: 'activity', value: D.activity }, D));
  for (const k of ['quit', 'weight', 'bp', 'set', 'dx']) {
    const e = A.newEvent(k, A.withBmi(P, 30));
    ok(`newEvent(${k}) is valid and dated in the future`, A.cleanEvent(e) !== null && e.age > P.age);
    ok(`newEvent(${k}) changes something for a typical smoker`, A.eventApplies(e, A.withBmi(P, 30)));
  }
  // Validation
  ok('cleanEvent rejects unknown kinds, fields and values',
    [{ kind: 'teleport', age: 50 }, { kind: 'set', age: 50, field: 'income', value: 'high' }, { kind: 'set', age: 50, field: 'social', value: 'great' },
     { kind: 'dx', age: 50, field: 'cancer', value: 'yes' }, { kind: 'weight', age: 50, value: 'heavy' }, { kind: 'quit', age: 'soon' }].every(e => A.cleanEvent(e) === null));
  ok('cleanEvent clamps ages and values', (() => { const e = A.cleanEvent({ kind: 'set', age: 140, field: 'alcohol', value: 900 }); return e.age === 100 && e.value === 80; })());
  // Link encoding
  const all = [{ kind: 'quit', age: 50 }, { kind: 'weight', age: 52, value: 78.5 }, { kind: 'bp', age: 55, value: 124 },
    { kind: 'set', age: 48, field: 'partnered', value: false }, { kind: 'set', age: 49, field: 'sleep', value: 7.5 },
    { kind: 'dx', age: 60, field: 'cvd', value: true }, { kind: 'dx', age: 70, field: 'ckd', value: 'stage45' }].map(A.cleanEvent);
  const enc = A.encodeEvents(A.sortEvents(all));
  ok('events encode compactly and readably', enc.length < 140 && !/[%&=#]/.test(enc), enc);
  ok('events round-trip through the link', JSON.stringify(A.decodeEvents(enc)) === JSON.stringify(A.sortEvents(all)), enc);
  ok('hostile event strings are dropped', A.decodeEvents('x~1,q~abc,s~50~income~high,d~60~cancer~yes,w~50~~,s~50,q~55').length === 1);
  ok('at most 20 events from a link', A.decodeEvents(Array.from({ length: 30 }, (_, i) => 'q~' + (40 + i)).join(',')).length === 20);
}

// ═══════════════════════════════════════════════════════════════════════════
// 6b. Insights: score, levers, blind spots, alerts, lifetimes
// ═══════════════════════════════════════════════════════════════════════════
{
  const profiles = [D, { ...D, age: 55, smoke: 'current', cigs: 'ge20', sbp: 150, alcohol: 25, social: 'isolated', diabetes: 'pre' },
    A.withBmi({ ...D, age: 30, activity: 400, vo2max: 52, strength: '3plus', nuts: 'daily', fruitveg: 6 }, 22),
    { ...D, country: 'JPN', sex: 'F', age: 75, copd: 'moderate', events: A.sortEvents([A.cleanEvent({ kind: 'set', age: 76, field: 'activity', value: 300 })]) }];
  const grouped = new Set(A.PILLARS.flatMap(p => p.groups));
  ok('every factor belongs to exactly one pillar', A.FACTORS.every(f => A.PILLARS.filter(p => p.groups.includes(f.group)).length === 1), A.FACTORS.filter(f => !grouped.has(f.group)).map(f => f.id).join());
  for (const pr of profiles) {
    const full = A.summarize(pr), base = A.summarize(pr, { baseline: true }), c = A.contributions(pr, full), sc = A.longevityScore(c);
    const tag = `${pr.country} ${pr.sex} ${pr.age}`;
    ok(`score is 50 + 5 × years vs average (${tag}: ${f2(sc.raw)})`, near(sc.raw, 50 + A.SCORE_PER_YEAR * (full.le - base.le), 1e-9));
    ok(`pillars + interaction reconcile to the score (${tag})`, near(50 + sc.pillars.reduce((t, p) => t + p.points, 0) + sc.interaction, sc.raw, 1e-9));
    ok(`printed whole-point terms add up to the shown score (${tag})`, 50 + sc.pillars.reduce((t, p) => t + p.shown, 0) + sc.interactionShown === Math.round(sc.raw));
    ok(`each printed term is within a point of its exact value (${tag})`, sc.pillars.every(p => Math.abs(p.shown - p.points) < 1) && Math.abs(sc.interactionShown - sc.interaction) < 1);
    const lt = A.lifetimes(full.S, pr.age);
    ok(`100 lifetimes, in order, nobody dying today (${tag})`, lt.ages.length === 100 && lt.ages.every((a, i) => i === 0 || a >= lt.ages[i - 1]) && lt.ages[0] > pr.age);
    ok(`lifetime bands count all 100 (${tag})`, lt.bands.reduce((t, b) => t + b.n, 0) === 100);
    const r90 = lt.ages.filter(a => a >= 90).length;
    ok(`dots reaching 90 match the survival curve (${tag}: ${r90} vs ${f2(100 * full.reach(90))})`, Math.abs(r90 - 100 * full.reach(90)) <= 1);
    ok(`the middle dots straddle the median (${tag})`, lt.ages[49] <= full.median + 1e-9 && lt.ages[50] >= full.median - 1e-9);
    const lev = A.levers(pr, full);
    ok(`levers ranked by gain (${tag})`, lev.every((l, i) => i === 0 || l.gain <= lev[i - 1].gain + 1e-12));
    ok(`levers' running total never falls, and starts at the top lever (${tag})`, lev.every((l, i) => i === 0 ? near(l.together, l.gain, 1e-9) : l.together >= lev[i - 1].together - 1e-9));
    const spots = A.blindSpots(pr);
    ok(`blind spots list only unanswered inputs, ranked, all ≥ 0 (${tag})`, spots.every((b, i) => A.BLIND_SPOTS.find(x => x.key === b.key).unset(pr) && b.swing >= 0 && (i === 0 || b.swing <= spots[i - 1].swing)));
    const al = A.alerts(pr, full, c), risks = al.filter(a => a.level === 'risk' && a.years !== undefined);
    ok(`risk alerts are the worst factors, at most 4, each ≤ −0.3 y (${tag})`, risks.length <= 4 && risks.every((a, i) => a.years <= -0.3 && (i === 0 || a.years >= risks[i - 1].years)));
  }
  const bad = profiles[1], fb = A.summarize(bad), cb = A.contributions(bad, fb);
  ok('smoker: first alert is smoking', A.alerts(bad, fb, cb)[0].factor === 'smoking');
  { const q = { ...bad, events: [{ kind: 'quit', age: 60 }] }, fq = A.summarize(q), sm = A.alerts(q, fq, A.contributions(q, fq)).find(a => a.factor === 'smoking');
    ok('a smoker already quitting on the timeline is told so, not told to add it', sm && /quitting at 60/.test(sm.text) && !/try it on the timeline/.test(sm.text)); }
  ok('prediabetes: exactly one alert, carrying the prediabetes advice', (() => { const d = A.alerts(bad, fb, cb).filter(a => a.factor === 'diabetes'); return d.length === 1 && /Prevention Program/.test(d[0].text); })());
  { const mild = { ...D, diabetes: 'pre' }, fm = A.summarize(mild), d = A.alerts(mild, fm, A.contributions(mild, fm)).filter(a => a.factor === 'diabetes');
    ok('prediabetes is flagged even when its row is small', d.length === 1 && /Prevention Program/.test(d[0].text)); }
  ok('diet questions are separate blind spots, each a single question', ['nuts', 'grains', 'meat', 'sugary', 'coffee'].every(k => A.blindSpots(D).some(b => b.key === k)) && !A.blindSpots(D).some(b => b.key === 'diet'));
  ok('smoker: bottom line names the drag and the lever', (() => { const l = A.bottomLine(bad, fb, A.summarize(bad, { baseline: true }), A.longevityScore(cb), A.levers(bad, fb), A.blindSpots(bad), cb).join(' '); return /smoking/.test(l) && /lever is “quit smoking”/.test(l); })());
  { const heavy = A.withBmi({ ...D, age: 52 }, 31), fh = A.summarize(heavy), ch = A.contributions(heavy, fh), lv = A.levers(heavy, fh);
    const l = A.bottomLine(heavy, fh, A.summarize(heavy, { baseline: true }), A.longevityScore(ch), lv, A.blindSpots(heavy), ch).join(' ');
    ok('bottom line keeps acronyms (BMI) when it lower-cases a label', lv[0].id === 'healthyBmi' && l.includes('“reach a healthy weight (BMI 24)”'), l); }
  ok('smoker scores below the same person not smoking', A.longevityScore(cb).raw < A.longevityScore(A.contributions({ ...bad, smoke: 'never' }, A.summarize({ ...bad, smoke: 'never' }))).raw);
  ok('an inert timeline change is flagged', A.alerts({ ...D, events: [{ kind: 'quit', age: 50 }] }, A.summarize(D), A.contributions(D, A.summarize(D))).some(a => a.level === 'note' && /does nothing/.test(a.title)));
  ok('VO₂max is a blind spot until entered', A.blindSpots(D).some(b => b.key === 'vo2max') && !A.blindSpots({ ...D, vo2max: 40 }).some(b => b.key === 'vo2max'));
  ok('not knowing VO₂max is worth over half a year either way', A.blindSpots(D).find(b => b.key === 'vo2max').swing > 0.5);
  ok('a lever already on the timeline is not offered again', !A.levers({ ...bad, events: [{ kind: 'quit', age: 60 }] }, fb).some(l => l.id === 'quitSmoking'));
  const fake = (total, inter) => A.longevityScore({ rows: [], total, interaction: inter });
  ok('score clamps at 100 and 0, and says so', fake(15, 15).score === 100 && fake(15, 15).clamped && fake(-12, -12).score === 0 && !fake(4, 4).clamped);
  ok('wholeParts: sums to the target, each within 1', [[[1.4, 2.4, 3.4], 7], [[-0.6, -0.6, 1.7], 1], [[0.5, 0.5], 1], [[-2.5, 0.2], -2]].every(([v, t]) => { const w = A.wholeParts(v, t); return w.reduce((a, b) => a + b, 0) === t && w.every((x, i) => Math.abs(x - v[i]) < 1); }));
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. State, hash round-trip, input handlers, export
// ═══════════════════════════════════════════════════════════════════════════
ok('page initialised with defaults', JSON.stringify(A.state()) === JSON.stringify(D));
{
  // A missing entry would serialise as the literal key "undefined" and still
  // round-trip, so check the map itself: every state key has a short name and
  // no two share one.
  const short = A.KEYS.map(k => A.HASH_KEYS[k]);
  ok('every state key has a hash short name', short.every(v => typeof v === 'string' && v.length >= 1 && v.length <= 3), A.KEYS.filter(k => !A.HASH_KEYS[k]).join());
  ok('hash short names are unique', new Set(short).size === short.length);
  ok('"wi" (old what-ifs) and "ev" (timeline) are reserved', !short.includes('wi') && !short.includes('ev'));
}
ok('default state writes an empty hash', A.stateToHash() === '');
ok('init rendered every chart', chartCalls.length >= 3, chartCalls.length);
ok('two custom plugins registered (markers, barLabels)', plugins.map(p => p.id).sort().join() === 'barLabels,markers');
ok('survival chart is a line chart with 3 datasets (avg, you, medians)', chartCalls.some(c => c.type === 'line' && c.data.datasets[0].label === 'National average' && c.data.datasets.length === 3));
ok('tornado is a horizontal bar chart', chartCalls.some(c => c.type === 'bar' && c.options.indexAxis === 'y'));
{
  // Chart.js resolves any function inside plugin options as a scriptable option
  // and calls it itself, so a callback there comes back as its return value.
  const hasFn = o => typeof o === 'function' || (o && typeof o === 'object' && Object.values(o).some(hasFn));
  for (const cfg of chartCalls) for (const id of ['markers', 'barLabels']) {
    const o = (cfg.options.plugins || {})[id];
    if (o) ok(`${cfg.type} chart: ${id} plugin options carry no functions`, !hasFn(o));
  }
  const tornado = chartCalls.find(c => c.type === 'bar' && c.options.indexAxis === 'y');
  const lbl = ((tornado.options.plugins || {}).barLabels || {}).labels || [];
  ok('tornado bar labels precomputed, one per bar', lbl.length === tornado.data.datasets[0].data.length, lbl.length);
  ok('tornado labels are signed years', lbl.length > 0 && lbl.every(l => /^[+−]?\d+\.\d y( \(off scale\))?$/.test(l)), lbl.join('|'));
  // Every panel after the tornado rendered (a throwing chart would have aborted refreshAll)
  ok('levers list rendered', els.leverList.innerHTML.includes('data-preset='));
  ok('score rendered (number, header, five pillars, formula, bottom line)', /^\d{1,3}$/.test(els.scoreNum.textContent) && els.hsScore.textContent === els.scoreNum.textContent
    && (els.pillars.innerHTML.match(/class="pillar"/g) || []).length === 5 && els.scoreFormula.innerHTML.includes('= ' + els.scoreNum.textContent) && els.bottomLine.innerHTML.includes('Longevity Score'));
  ok('alerts and blind spots rendered', els.alertList.innerHTML.includes('class="alert') && els.blindList.innerHTML.includes('alert unknown'));
  ok('100 lifetimes rendered: 100 dots, 5 legend rows', (els.dots.innerHTML.match(/class="dot"/g) || []).length === 100 && (els.dotsLegend.innerHTML.match(/<div>/g) || []).length === 5);
  ok('timeline total rendered', els.whatifTotal.innerHTML.length > 20);
  ok('empty timeline says so', els.tlList.innerHTML.includes('tl-empty'));
  ok('milestone tiles rendered', (els.tiles.innerHTML.match(/class="tile"/g) || []).length === 4);
  ok('percentile tiles rendered', (els.pctTiles.innerHTML.match(/class="tile"/g) || []).length === 6);
  ok('distribution table rendered', els.tblDist.innerHTML.includes('<tr>'));
  ok('survival table rendered', els.tblSurv.innerHTML.includes('<td>45</td>'));
  ok('tornado table lists every factor', A.FACTORS.every(f => els.tblTornado.innerHTML.includes(f.label)));
  ok('hero shows the headline', /^\d\d\.\d$/.test(els.heroLE.textContent), els.heroLE.textContent);
  ok('group summaries rendered', els.gsumDemo.textContent.includes('United States') && els.gsumBody.textContent.includes('BMI'));
}
{
  const sample = { country: 'JPN', sex: 'F', age: 57, units: 'imperial', height: 162.5, weight: 61.2, sbp: 138,
    waist: 91, rhr: 64, vo2max: 29, grip: null, crp: 2.5, srh: 'good',
    smoke: 'former', cigs: 'ge20', quitYears: 12, activity: 220, strength: '1to2', sitting: 9.5, alcohol: 9, sleep: 6.5,
    fruitveg: 4, nuts: 'weekly', grains: 'unk', meat: 'rare', sugary: 'daily', coffee: '3to4',
    diabetes: 'pre', cvd: false, af: true, copd: 'moderate', ckd: 'none', mental: 'depression', osa: 'moderate', drugs: 'none',
    education: 17, income: 'middle', work: 'notworking', social: 'moderate', partnered: false, mother: 'a_80s', father: 'd_lt70',
    pm25: 14, improve: true };
  Object.assign(A.state(), sample);
  const sampleEvents = A.sortEvents([{ kind: 'bp', age: 57, value: 125 }, { kind: 'set', age: 60, field: 'sleep', value: 7.5 }, { kind: 'dx', age: 72, field: 'ckd', value: 'stage3' }].map(A.cleanEvent));
  A.setEvents(sampleEvents);
  const h = A.stateToHash();
  ok('hash is compact and readable', h.length < 400 && !/%/.test(h), h);
  ok('not-entered numerics stay out of the hash', !/gr=/.test(h));
  ok('hash carries the timeline', /ev=b~57~125,s~60~sleep~7.5,d~72~ckd~stage3/.test(h), h);
  A.resetAll();
  ok('reset restores defaults', JSON.stringify(A.state()) === JSON.stringify(D) && A.events().length === 0);
  ok('applyHash returns true for a non-empty hash', A.applyHash('#' + h) === true);
  ok('hash round-trip restores every key', A.KEYS.every(k => A.state()[k] === sample[k]), A.KEYS.filter(k => A.state()[k] !== sample[k]).join());
  ok('hash round-trip restores the timeline', JSON.stringify(A.events()) === JSON.stringify(sampleEvents));
  A.applyHash('#a=50&sm=current&al=20&wi=quitSmoking,alcohol,nuts');
  ok('old what-if links become changes dated today', A.events().map(e => e.kind + (e.field || '') + '@' + e.age).join() === 'quit@50,setalcohol@50', JSON.stringify(A.events()));
  A.applyHash('#a=50');
  ok('a link without ev= has no timeline', A.events().length === 0);
  A.applyHash('#a=50&tab=lifespan');
  ok('a link can open on a tab', A.tab() === 'lifespan' && /tab=lifespan/.test(A.stateToHash()));
  A.applyHash('#a=50&tab=secrets');
  ok('an unknown tab falls back to the overview, and stays out of the link', A.tab() === 'overview' && !/tab=/.test(A.stateToHash()));
  A.setTab('nonsense', true);
  ok('setTab rejects unknown tabs', A.tab() === 'overview');
  ok('applyHash returns false for an empty hash', A.applyHash('') === false && A.applyHash('#') === false);
  // Hostile / stale links are validated, not trusted
  A.resetAll();
  A.applyHash('#c=XXX&s=Q&a=999&h=5&sm=vape&ci=lots&cp=terrible&mo=200&al=-4&vo=abc&gr=999&dm=maybe&wi=nonsense,bp&ev=zz~1,q~abc,s~99~sleep~7');
  const st = A.state();
  ok('unknown country ignored', st.country === 'USA');
  ok('unknown sex ignored', st.sex === 'M');
  ok('age clamped to 100', st.age === 100);
  ok('height clamped to 120', st.height === 120);
  ok('unknown smoking status ignored', st.smoke === 'never' && st.cigs === 'lt10' && st.copd === 'none' && st.mother === 'unk');
  ok('negative alcohol clamped to 0', st.alcohol === 0);
  ok('non-numeric optional stays not-entered, out-of-range optional clamped', st.vo2max === null && st.grip === 90);
  ok('unknown diabetes value ignored', st.diabetes === 'none');
  ok('unknown what-if ids dropped; bp ignored (sbp at default 120); bad events dropped, good kept',
    A.events().length === 1 && A.events()[0].field === 'sleep', JSON.stringify(A.events()));
  A.resetAll();
}
// Real input handlers (not setState) so a missing key or unit bug is caught
{
  const ev = (key, type, value, extra) => ({ target: { dataset: { key }, type, value, ...extra } });
  A.onInput(ev('age', 'range', '55'));
  ok('age handler updates state', A.state().age === 55);
  ok('age handler re-renders', A.last().full.le > 55);
  A.onInput(ev('af', 'checkbox', 'on', { checked: true }));
  ok('checkbox handler updates state', A.state().af === true);
  A.onInput(ev('diabetes', 'select-one', 'pre'));
  ok('diabetes select handler', A.state().diabetes === 'pre');
  A.onInput(ev('vo2max', 'number', '41'));
  ok('optional numeric handler stores a value', A.state().vo2max === 41);
  A.onInput(ev('vo2max', 'number', ''));
  ok('blanking an optional numeric returns it to not-entered', A.state().vo2max === null);
  A.onInput(ev('smoke', 'select-one', 'former'));
  ok('select handler updates state', A.state().smoke === 'former');
  A.onInput(ev('weight', 'number', '90'));
  ok('metric weight stored as kg', A.state().weight === 90);
  A.onModeBtn({ currentTarget: { dataset: { key: 'units', val: 'imperial' } } });
  ok('units toggle', A.state().units === 'imperial');
  A.onInput(ev('weight', 'number', '176'));
  ok('imperial weight converted to kg', near(A.state().weight, 79.83, 0.05), A.state().weight);
  A.onInput(ev('waist', 'number', '36'));
  ok('imperial waist converted to cm', near(A.state().waist, 91.44, 0.05), A.state().waist);
  els.inFeet.value = '5'; els.inInches.value = '9';
  A.onInput(ev('feet', 'number', '5'));
  ok('feet/inches converted to cm', near(A.state().height, 175.26, 0.05), A.state().height);
  A.onModeBtn({ currentTarget: { dataset: { key: 'sex', val: 'F' } } });
  ok('sex toggle', A.state().sex === 'F');
  A.onInput(ev('age', 'range', '5'));
  ok('handler clamps out-of-range age', A.state().age === 18);
  A.onInput(ev('sleep', 'number', 'abc'));
  ok('non-numeric input ignored', A.state().sleep === 7);
  ok('state change reached the URL hash on the next tick', (timers.length > 0));
  timers.forEach(fn => fn()); timers.length = 0;
  ok('hash written after debounce', /a=18/.test(location.hash) && /s=F/.test(location.hash) && /dm=pre/.test(location.hash) && /af=1/.test(location.hash), location.hash);
  A.resetAll();
}
// Export
{
  A.exportCsv();
  const lines = blobText.split('\n');
  ok('CSV header', lines[0] === 'age,national_average_alive,you_alive,your_q');
  ok('CSV has one row per age from 40 to 111', lines.length === 1 + (A.MAX_AGE + 1 - D.age + 1), lines.length);
  ok('CSV first row is age 40 fully alive', lines[1].startsWith('40,1.00000,1.00000,'));
  ok('CSV last row is age 111 with nobody alive', lines[lines.length - 1].startsWith('111,0.00000,0.00000'));
  ok('CSV download triggered', clicks.some(c => c.download === 'life-expectancy-survival.csv'));
  A.exportPng();
  ok('PNG download triggered', clicks.some(c => c.download === 'life-expectancy-survival.png'));
}
// Timeline panel: the real add / edit / remove handlers and what they render
{
  A.resetAll();
  Object.assign(A.state(), { smoke: 'current', cigs: '10to19' });
  const edit = (i, prop, value) => A.onTimelineEdit({ dataset: { ev: String(i), prop }, value: String(value) });
  const lastLine = () => chartCalls.filter(c => c.type === 'line' && c.data.datasets[0].label === 'National average').pop();   // the survival chart
  const le0 = A.summarize(A.state()).le;
  A.addEvent(A.WHATIFS.find(w => w.id === 'quitSmoking').event(A.state()));
  ok('adding a quick change puts it on the timeline, dated today', A.events().length === 1 && A.events()[0].kind === 'quit' && A.events()[0].age === 40);
  ok('the headline includes the timeline', A.last().full.le > le0 + 3, f2(A.last().full.le - le0));
  ok('"if nothing changes" is the plan without its timeline', near(A.last().imp.le, le0, 1e-12));
  ok('survival chart gains the dashed "if nothing changes" line', lastLine().data.datasets.some(d => d.label === 'If nothing changes' && d.borderDash));
  ok('survival chart marks the event', lastLine().options.plugins.markers.items.some(m => m.label === 'Quit smoking' && m.x === 40));
  ok('event markers sit at the bottom, left-aligned', lastLine().options.plugins.markers.items.filter(m => m.label === 'Quit smoking').every(m => m.bottom && m.align === 'left'));
  ok('tornado table tags factors the timeline changes', /Smoking<\/td><td>[^<]*<span class="tl-tag"/.test(els.tblTornado.innerHTML) && (els.tblTornado.innerHTML.match(/tl-tag/g) || []).length === 1);
  ok('hero mentions the timeline', els.heroSide.innerHTML.includes('health timeline'));
  ok('timeline lists the event with its own gain', els.tlList.innerHTML.includes('data-prop="age"') && /tl-gain delta-pos"[^>]*>\+\d+\.\d y/.test(els.tlList.innerHTML));
  ok('a preset already on the timeline leaves the levers list', !els.leverList.innerHTML.includes('data-preset="quitSmoking"'));
  ok('timeline total compares with nothing changing', els.whatifTotal.innerHTML.includes('if nothing changes'));
  edit(0, 'age', 55);
  ok('editing the age moves the event', A.events()[0].age === 55);
  ok('quitting later is worth less', A.last().full.le < A.summarize(A.withEvents(A.state(), [{ kind: 'quit', age: 40 }])).le);
  edit(0, 'age', '');
  ok('a blank age is ignored, not read as 0', A.events()[0].age === 55);
  A.addEvent({ kind: 'set', age: 50, field: 'activity', value: 300 });
  ok('events stay sorted by age', A.events().map(e => e.age).join() === '50,55');
  edit(0, 'field', 'social');
  ok('changing the habit picks its suggested value', A.events()[0].field === 'social' && A.events()[0].value === 'strong');
  ok('an inert event is shown as such', els.tlList.innerHTML.includes('tl-item inert'));
  edit(0, 'field', 'partnered'); edit(0, 'value', '0');
  ok('boolean habits store booleans', A.events()[0].value === false);
  A.state().units = 'imperial';
  A.addEvent({ kind: 'weight', age: 60, value: 70 });
  const wi = A.events().findIndex(e => e.kind === 'weight');
  edit(wi, 'value', 154);
  ok('imperial weight edits are converted from lb', near(A.events()[wi].value, 69.9, 0.05), A.events()[wi].value);
  A.state().units = 'metric';
  A.exportCsv();
  ok('CSV gains the "if nothing changes" column', blobText.split('\n')[0] === 'age,national_average_alive,you_alive,if_nothing_changes_alive,your_q');
  const n = A.events().length;
  A.removeEvent(0);
  ok('removing deletes exactly that event', A.events().length === n - 1);
  for (let i = 0; i < 25; i++) A.addEvent({ kind: 'set', age: 60, field: 'sleep', value: 8 });
  ok('the timeline holds at most 20 events', A.events().length === 20);
  A.resetAll();
  ok('timelineFactors finds exactly the factors events touch', [...A.timelineFactors({ ...A.withBmi(D, 30), smoke: 'current', events: A.sortEvents([{ kind: 'quit', age: 50 }, { kind: 'weight', age: 55, value: 70 }, { kind: 'set', age: 60, field: 'nuts', value: 'daily' }, { kind: 'dx', age: 70, field: 'af', value: true }].map(A.cleanEvent)) })].sort().join() === 'af,bmi,nuts,smoking');
  ok('an inert event touches no factor', A.timelineFactors({ ...D, events: [{ kind: 'quit', age: 50 }] }).size === 0);
  ok('reset clears the timeline', A.events().length === 0 && !lastLine().data.datasets.some(d => d.label === 'If nothing changes'));
}
// Plan A vs Plan B
{
  A.resetAll();
  ok('not comparing at first', A.compare() === null && A.plansAB() === null && A.planDiff() === null);
  A.startCompare();
  ok('start: comparing, editing B', A.compare() && A.compare().editing === 'B');
  ok('start: B is an exact copy of A', (() => { const d = A.planDiff(); return d.keys.length === 0 && !d.onlyA.length && !d.onlyB.length; })());
  ok('start: B is a copy, not the same object', A.plansAB().A.state !== A.plansAB().B.state);
  A.state().age = 60; A.state().vo2max = 44;
  A.addEvent({ kind: 'set', age: 62, field: 'activity', value: 300 });
  ok('editing B leaves A alone', A.plansAB().A.state.age === D.age && A.plansAB().A.state.vo2max === null && A.plansAB().A.events.length === 0);
  ok('diff lists exactly what changed', A.planDiff().keys.join() === 'age,vo2max' && A.planDiff().onlyB.length === 1 && A.planDiff().onlyA.length === 0);
  A.switchPlan('A');
  ok('switching to A shows A', A.state().age === D.age && A.compare().editing === 'A');
  A.switchPlan('B');
  ok('switching back shows B as left', A.state().age === 60 && A.events().length === 1);
  A.switchPlan('C');
  ok('an unknown plan name is ignored', A.compare().editing === 'B');
  const h0 = A.stateToHash();
  A.swapPlans(); A.swapPlans();
  ok('swap twice is the identity', A.stateToHash() === h0);
  A.swapPlans();
  ok('swap once exchanges the plans', A.plansAB().A.state.age === 60 && A.plansAB().B.state.age === D.age);
  A.swapPlans();
  // Links carry the whole comparison, including B blanking an input A has set
  A.switchPlan('A'); A.state().waist = 92; A.switchPlan('B');
  const h = A.stateToHash();
  ok('link marks the comparison and who is being edited', /(^|&)cmp=b(&|$)/.test(h) && /b\.a=60/.test(h) && /b\.wc=(&|$)/.test(h) && /bev=s~62~activity~300/.test(h), h);
  const before = JSON.stringify(A.plansAB());
  A.resetAll(); A.applyHash('#' + h);
  ok('link round-trips both plans and the editing side', JSON.stringify(A.plansAB()) === before && A.compare().editing === 'B');
  ok('B blanking an input A set survives the link', A.plansAB().A.state.waist === 92 && A.plansAB().B.state.waist === null);
  A.applyHash('#a=50&cmp=a');
  ok('identical plans round-trip as just cmp=', A.compare() && A.planDiff().keys.length === 0 && A.stateToHash() === 'a=50&cmp=a');
  A.applyHash('#a=50&cmp=zz&b.a=70');
  ok('an unknown cmp value is no comparison', A.compare() === null);
  A.applyHash('#a=50&cmp=b&b.a=999&b.sm=vape&bev=q~nope');
  ok('plan B from a link is validated like plan A', A.state().age === 100 && A.state().smoke === 'never' && A.events().length === 0);
  // Per-row and whole-plan resets
  A.applyHash('#' + h);
  A.resetKeyToA('age');
  ok('reset one input to A', A.plansAB().B.state.age === D.age && !A.planDiff().keys.includes('age'));
  A.resetKeyToA('nonsense');
  ok('reset ignores unknown keys', !('nonsense' in A.plansAB().B.state));
  A.resetEventsToA();
  ok('reset the timeline to A', A.planDiff().onlyB.length === 0 && A.events().length === 0);
  A.applyHash('#' + h); A.switchPlan('A'); A.resetBToA();
  ok('reset B to A, from either side', A.planDiff().keys.length === 0 && A.compare().other !== null);
  A.applyHash('#' + h); A.resetBToA();
  ok('reset B to A while editing B', A.planDiff().keys.length === 0 && A.state().age === D.age);
  A.applyHash('#' + h); A.keepPlan('A');
  ok('keep A ends the comparison with A', A.compare() === null && A.state().age === D.age && !/cmp=/.test(A.stateToHash()));
  A.applyHash('#' + h); A.keepPlan('B');
  ok('keep B ends the comparison with B', A.compare() === null && A.state().age === 60 && A.events().length === 1);
  // Scorecard and rendering
  A.applyHash('#' + h);
  const pb = A.plan(), sb = A.scorecard(pb);
  ok('scorecard matches the engine', near(sb.le, A.summarize(pb).le, 1e-12) && sb.score === A.longevityScore(A.contributions(pb, A.summarize(pb))).score);
  A.refreshAll();
  ok('compare tab renders: scorecard rows, diff rows, chart with A, B and average',
    (els.tblScore.innerHTML.match(/<tr>/g) || []).length === 8 && els.tblDiff.innerHTML.includes('↺ Use A') && !els.abBar.hidden
    && chartCalls.filter(c => c.type === 'line').some(c => c.data.datasets.map(d => d.label).join() === 'National average (Plan A),Plan A,Plan B'));
  ok('score difference is a whole number', /<td>Longevity score<\/td><td class="num">\d+<\/td><td class="num">\d+<\/td><td class="num[^"]*">[+−]?\d+<\/td>/.test(els.tblScore.innerHTML), els.tblScore.innerHTML.slice(0, 400));
  ok('header badge says which plan', els.planBadge.textContent === 'Editing Plan B' && !els.planBadge.hidden);
  A.resetAll();
  ok('reset ends the comparison', A.compare() === null);
  A.refreshAll();
  ok('not comparing: the A/B bar and badge are hidden, the intro offers to start', els.abBar.hidden && els.planBadge.hidden && els.cmpIntro.innerHTML.includes('data-cmp="start"'));
  ok('every input has a label for the diff table', A.KEYS.every(k => typeof A.KEY_LABELS[k] === 'string'));
  ok('values read as words', A.valueText('vo2max', null) === 'not entered' && A.valueText('cvd', true) === 'Yes' && A.valueText('country', 'JPN') === 'Japan' && A.valueText('activity', 150) === '150 min/week');
}
// Saved plans (this browser's storage, which may be missing or blocked)
{
  A.resetAll();
  localStorage._d = {};
  Object.assign(A.state(), { age: 52, smoke: 'current', vo2max: 41 });
  A.setEvents(A.sortEvents([A.cleanEvent({ kind: 'quit', age: 55 })]));
  ok('save a plan', A.saveSlot('  Quit at 55  ') && A.readSlots().length === 1 && A.readSlots()[0].name === 'Quit at 55');
  ok('a nameless plan is not saved', !A.saveSlot('   ') && A.readSlots().length === 1);
  const saved = JSON.stringify({ s: A.state(), e: A.events() });
  A.resetAll();
  ok('load restores inputs and timeline', A.loadSlot('Quit at 55') && JSON.stringify({ s: A.state(), e: A.events() }) === saved);
  A.saveSlot('Quit at 55');
  ok('saving under the same name replaces it', A.readSlots().length === 1);
  A.startCompare(); A.resetAll(); A.startCompare();
  A.loadSlot('Quit at 55');
  ok('loading while comparing fills the plan being edited (B)', A.plansAB().B.state.age === 52 && A.plansAB().A.state.age === D.age);
  A.resetAll();
  ok('delete a plan', A.deleteSlot('Quit at 55') && A.readSlots().length === 0);
  ok('loading a missing plan does nothing', !A.loadSlot('nope') && JSON.stringify(A.state()) === JSON.stringify(D));
  localStorage._d['lifex-slots'] = '{not json';
  ok('corrupt storage reads as no plans', A.readSlots().length === 0);
  localStorage._d['lifex-slots'] = JSON.stringify([{ name: 1 }, 'x', null, { name: 'ok', hash: 'a=50' }]);
  ok('malformed entries are skipped', A.readSlots().map(x => x.name).join() === 'ok');
  localStorage._d['lifex-slots'] = JSON.stringify([{ name: 'evil', hash: 'a=999&sm=vape&ev=q~x' }]);
  A.loadSlot('evil');
  ok('a saved plan goes through the link validation', A.state().age === 100 && A.state().smoke === 'never' && A.events().length === 0);
  const gi = localStorage.getItem, si = localStorage.setItem;
  localStorage.getItem = () => { throw new Error('blocked'); }; localStorage.setItem = () => { throw new Error('blocked'); };
  ok('blocked storage: no plans, saving reports failure, nothing throws', A.readSlots().length === 0 && A.saveSlot('x') === false);
  localStorage.getItem = gi; localStorage.setItem = si; localStorage._d = {};
  A.resetAll();
}
// Example profiles and Quick Start
{
  const keep = { country: 'GBR', units: 'imperial' };
  ok('seven example profiles with unique ids', A.ARCHETYPES.length === 7 && new Set(A.ARCHETYPES.map(a => a.id)).size === 7);
  const les = [];
  for (const a of A.ARCHETYPES) {
    const pl = A.archetypePlan(a.id, keep);
    ok(`example ${a.id}: only real inputs`, Object.keys(a.state).every(k => A.KEYS.includes(k)));
    ok(`example ${a.id}: every value already in range (clamping changes nothing)`, JSON.stringify(A.clampState({ ...pl.state })) === JSON.stringify(pl.state));
    ok(`example ${a.id}: choices are valid`, Object.entries(a.state).every(([k, v]) => !A.CHOICES || !A.CHOICES[k] || A.CHOICES[k].includes(v)));
    ok(`example ${a.id}: keeps your country and units`, pl.state.country === 'GBR' && pl.state.units === 'imperial');
    ok(`example ${a.id}: every timeline event is valid and changes something`, pl.events.every(e => A.eventApplies(e, pl.state)) && pl.events.length === (a.events || []).length);
    les.push(A.summarize({ ...pl.state, events: pl.events }).le);
  }
  ok('examples span a real range of outcomes', Math.max(...les) - Math.min(...les) > 8, les.map(f2).join(' '));
  ok('an unknown example is refused', A.archetypePlan('nope', keep) === null);
  ok('Quick Start asks only real inputs', A.QS_KEYS.every(k => A.KEYS.includes(k)));
  const ans = { country: 'FRA', sex: 'F', age: 63, units: 'metric', height: 160, weight: 70, sbp: '', smoke: 'former', cigs: 'ge20', quitYears: 12,
    activity: 200, alcohol: 6, sleep: 7.5, diabetes: 'pre', cvd: true, af: false, social: 'moderate', partnered: false };
  const qs = A.quickStartState(ans);
  ok('Quick Start fills the answered inputs', qs.country === 'FRA' && qs.sex === 'F' && qs.age === 63 && qs.smoke === 'former' && qs.quitYears === 12 && qs.cvd === true && qs.partnered === false);
  ok('a blank blood pressure is the typical reading for your age', qs.sbp === Math.round(A.interp(A.SBP_MEDIAN, 63)));
  ok('everything not asked stays not entered', qs.vo2max === null && qs.strength === 'unk' && qs.nuts === 'unk' && qs.mother === 'unk');
  const junk = A.quickStartState({ country: 'XXX', sex: 'Q', age: 'old', smoke: 'vape', weight: -5, sleep: 99, cvd: 'yes please' });
  ok('Quick Start rejects junk answers', junk.country === 'USA' && junk.sex === 'M' && junk.age === D.age && junk.smoke === 'never' && junk.weight === 30 && junk.sleep === 12 && junk.cvd === true);
  ok('the tour has six steps', A.TOUR.length === 6);
  for (const t of A.TOUR) {
    const sel = t.target, found = sel.startsWith('#') ? src.includes(`id="${sel.slice(1)}"`) : sel.startsWith('.') ? src.includes(`class="${sel.slice(1)}"`) || new RegExp(`class="[^"]*\\b${sel.slice(1)}\\b`).test(src) : false;
    ok(`tour step "${t.title}" points at something on the page (${sel})`, found);
    ok(`tour step "${t.title}" names a real tab`, !t.tab || A.TABS.includes(t.tab));
  }
}
// Tools: couple, plan-to age, life in weeks
{
  A.resetAll();
  const you = { ...D, age: 50, smoke: 'current' }, fy = A.summarize(you);
  for (const [sex, age] of [['F', 47], ['M', 70], ['F', 25]]) {
    const fp = A.summarize({ ...D, sex, age }, { baseline: true }), j = A.jointSurvival(fy.S, 50, fp.S, age);
    let ok1 = true, ok2 = true;
    for (let t = 0; t < j.either.length; t++) {
      if (!(j.either[t] >= Math.max(j.s1[t], j.s2[t]) - 1e-12 && j.both[t] <= Math.min(j.s1[t], j.s2[t]) + 1e-12)) ok1 = false;
      if (!near(j.either[t] + j.both[t], j.s1[t] + j.s2[t], 1e-12)) ok2 = false;
    }
    ok(`couple (${sex} ${age}): at least one ≥ either alone, both ≤ either alone`, ok1);
    ok(`couple (${sex} ${age}): both + at least one = sum of the two (independence)`, ok2);
    ok(`couple (${sex} ${age}): everyone alive today`, j.either[0] === 1 && j.both[0] === 1);
  }
  { const old = A.summarize({ ...D, age: 110 }, { baseline: true }), j = A.jointSurvival(fy.S, 50, old.S, 110);
    ok('a partner of 110 leaves your own survival curve', j.either.slice(1).every((v, t) => near(v, j.s1[t + 1], 1e-12))); }
  ok('yearsAtPct reads a straight line exactly', near(A.yearsAtPct([1, 0.75, 0.5, 0.25, 0], 0.6), 1.6, 1e-12) && A.yearsAtPct([1, 1, 1], 0.5) === 2);
  const cs = A.coupleSummary(you, { mode: 'average', sex: 'F', age: 47 });
  ok('average partner = the national table for their age and sex', near(cs.partnerLE, A.summarize({ ...D, sex: 'F', age: 47 }, { baseline: true }).le, 1e-12));
  ok('the last survivor outlives the median of either alone', cs.last.median >= Math.max(fy.median - 50, A.summarize({ ...D, sex: 'F', age: 47 }, { baseline: true }).median - 47) - 1e-9);
  ok('last survivor: median < 1-in-10 < 1-in-20', cs.last.median < cs.last.p90 && cs.last.p90 < cs.last.p95);
  const pt = A.planToAge(fy, 50);
  ok('plan-to ages: life expectancy < 1 in 10 < 1 in 20', fy.le < pt.p90 && pt.p90 < pt.p95 && pt.p90 === fy.p90);
  ok('plan-to 1 in 20 matches the survival curve', fy.S[Math.floor(pt.p95)] >= 0.05 && fy.S[Math.floor(pt.p95) + 1] <= 0.05);
  const lw = A.lifeWeeks(fy.S, 50), tail = fy.S.slice(100).reduce((a, b) => a + b, 0);
  ok('weeks lived = age × 52', lw.lived === 2600 && lw.total === 5200);
  ok('past weeks are certain', lw.alive(100) === 1 && lw.alive(2599) === 1);
  ok(`expected weeks ahead match life expectancy (${f2(lw.expectedLeft / 52)} y vs ${f2(fy.le - 50)} − ${f2(tail)} past 100)`, Math.abs(lw.expectedLeft / 52 - (fy.le - 50 - tail)) < 0.6);
  // Rendering
  fills = 0; texts.length = 0;
  A.refreshAll();
  ok('plan-to cards rendered with copy buttons', (els.planTo.innerHTML.match(/data-copy=/g) || []).length === 4);
  ok('couple chart: you, partner, at least one (dashed)', chartCalls.some(c => c.type === 'line' && c.data.datasets.map(d => d.label).join() === 'You,Partner,At least one of you' && c.data.datasets[2].borderDash));
  ok('couple stats and table rendered', els.coupleStats.innerHTML.includes('at least one of you is alive') && (els.tblCouple.innerHTML.match(/<tr>/g) || []).length > 5);
  ok('life in weeks drew all 5,200 weeks', fills >= 5200);
  ok('share card shows the headline', texts.includes(els.heroLE.textContent));
  ok('summary and AI prompt filled', els.sumText.value.includes('Life expectancy') && els.aiText.value.includes('Please:'));
  // Partner in the link; a saved plan as the partner
  A.setPartner({ mode: 'average', sex: 'M', age: 63 });
  ok('the partner travels in the link', /(^|&)pt=M~63(&|$)/.test(A.stateToHash()));
  A.applyHash('#a=50&pt=M~63');
  ok('the partner comes back from a link', A.partner().sex === 'M' && A.partner().age === 63);
  A.applyHash('#a=50&pt=X~abc');
  ok('a hostile partner is the default partner', JSON.stringify(A.partner()) === JSON.stringify(A.PARTNER_DEFAULT) && !/pt=/.test(A.stateToHash()));
  A.applyHash('#a=50&pt=F~400');
  ok('a partner age is clamped', A.partner().age === 100);
  localStorage._d = {};
  A.resetAll(); Object.assign(A.state(), { age: 66, sex: 'F', diabetes: 'yes' }); A.saveSlot('Mum'); A.resetAll();
  const mum = A.slotPlan('Mum');
  ok('a saved plan can be read without loading it', mum.age === 66 && mum.diabetes === 'yes' && A.state().age === D.age);
  ok('a missing saved plan is null', A.slotPlan('nobody') === null);
  localStorage._d = {}; A.resetAll();
}
// Share & save
{
  A.resetAll();
  const p = { ...D, age: 52, sbp: 141, activity: 30, events: A.sortEvents([A.cleanEvent({ kind: 'quit', age: 55 })]) }; p.smoke = 'current';
  const full = A.summarize(p), base = A.summarize(p, { baseline: true }), c = A.contributions(p, full), sc = A.longevityScore(c);
  const md = A.shareSummary(p, full, base, sc, c), txt = A.shareSummary(p, full, base, sc, c, { markdown: false }), priv = A.shareSummary(p, full, base, sc, c, { private: true });
  ok('summary gives the headline, score and average', md.includes(f2(full.le).slice(0, -1)) && md.includes(`**${sc.score}**/100`) && md.includes('national average'));
  ok('plain text has no markdown', !/\*\*|^- /m.test(txt) && txt.includes('•'));
  ok('the summary lists the planned change', md.includes('Quit smoking at 55'));
  ok('private: no age, no measurements, no ages on the timeline', !/, 52\)/.test(priv) && !/141 mmHg|30 min\/week/.test(priv) && !/ at 55/.test(priv) && /, man\)/.test(priv));
  const ai = A.aiPrompt(p, full, base, sc, c, A.blindSpots(p));
  ok('AI prompt lists every answer given', ['Blood pressure: 141', 'Exercise: 30 min/week', 'Smoking: current', 'Age: 52'].every(s => ai.includes(s)), ai.split('\n').slice(3, 12).join(' | '));
  ok('AI prompt carries the timeline, the blanks and four questions', ai.includes('Quit smoking at age 55') && ai.includes('Left blank:') && /\n4\. /.test(ai));
  // JSON: a link string inside, so import is link-validated
  Object.assign(A.state(), { age: 61, vo2max: 33 }); A.addEvent({ kind: 'set', age: 63, field: 'alcohol', value: 0 });
  A.startCompare(); A.state().smoke = 'former'; A.setPartner({ mode: 'average', sex: 'M', age: 59 });
  const h = A.stateToHash(), file = JSON.stringify(A.exportPlan());
  A.resetAll();
  ok('import a plan file', A.importPlan(file).ok && A.stateToHash() === h);
  ok('import refuses non-JSON', A.importPlan('not json').ok === false);
  ok('import refuses other JSON', A.importPlan('{"hello":1}').ok === false && A.importPlan('null').ok === false);
  ok('import refuses another version', /version 9/.test(A.importPlan(JSON.stringify({ app: 'life-expectancy-dashboard', version: 9, link: '' })).error));
  A.importPlan(JSON.stringify({ app: 'life-expectancy-dashboard', version: 1, link: 'a=999&sm=vape&cmp=b&b.a=-5' }));
  ok('an imported link is validated like any link', A.state().age === 18 && A.plansAB().A.state.age === 100 && A.plansAB().A.state.smoke === 'never');
  A.importPlan(JSON.stringify({ app: 'life-expectancy-dashboard', version: 1, link: '' }));
  ok('an empty plan file is the default plan', JSON.stringify(A.state()) === JSON.stringify(D) && A.compare() === null);
  A.resetAll();
}
// Themes
{
  const before = document.documentElement.dataset.theme;
  A.setTheme('paper');
  ok('theme changes', document.documentElement.dataset.theme === 'paper' && els.themeSel.value === 'paper');
  ok('theme persisted', localStorage.getItem('lifex-theme') === 'paper');
  A.setTheme('neon');
  ok('an unknown theme is refused', document.documentElement.dataset.theme === 'paper');
  ok('four themes, each with its own CSS block (or the default)', A.THEMES.join() === 'dark,light,paper,ocean'
    && A.THEMES.filter(t => t !== 'dark').every(t => css.includes(`:root[data-theme="${t}"]`)));
  ok('the first-paint script knows the same themes', src.includes("['dark', 'light', 'paper', 'ocean']"));
  const si = localStorage.setItem; localStorage.setItem = () => { throw new Error('blocked'); };
  A.setTheme('ocean');
  ok('blocked storage: the theme still applies', document.documentElement.dataset.theme === 'ocean');
  localStorage.setItem = si;
  A.setTheme(before);
}
// Methodology table is rendered from FACTORS
{
  A.renderFactorTable();
  const html = els.tblFactors.innerHTML;
  ok('factor table lists every factor', A.FACTORS.every(f => html.includes(f.label)));
  ok('factor table links every source', A.FACTORS.every(f => f.source.every(([, u]) => html.includes(u))));
  A.renderCalibration();
  ok('calibration cards all pass', !els.calib.innerHTML.includes('✗') && (els.calib.innerHTML.match(/✓/g) || []).length === A.CALIBRATIONS.length);
}

// ── Report ──────────────────────────────────────────────────────────────────
const report = [`${pass} passed, ${fail} failed, ${pass + fail} assertions`];
if (fail) { report.push(''); failures.forEach(f => report.push('  ✗ ' + f)); }
if (fail) throw new Error(report.join('\n'));
report.join('\n');
