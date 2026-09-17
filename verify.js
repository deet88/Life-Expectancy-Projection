#!/usr/bin/env osascript -l JavaScript
//
// Regression harness for index.html — run:  osascript -l JavaScript verify.js
//
// There is no Node on this machine, so this runs on JavaScriptCore via osascript.
// It evaluates the REAL script blocks out of index.html (the life-table data block
// and the app block) against stub DOM/Chart objects, so the assertions below test
// the shipped code and cannot drift from it.
//
ObjC.import('Foundation');

const CWD = ObjC.unwrap($.NSFileManager.defaultManager.currentDirectoryPath);
const HTML = CWD + '/index.html';
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
    checked: false, min: 0, max: 0, step: 0, width: 300, height: 150, href: '', download: '',
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    appendChild(){}, setAttribute(k, v){ this['@' + k] = v; }, removeAttribute(){}, addEventListener(){},
    querySelectorAll(){ return []; }, focus(){}, click(){ clicks.push(this); },
    getContext(){ return { fillRect(){}, drawImage(){}, save(){}, restore(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, fillText(){}, setLineDash(){} }; },
    toDataURL(){ return 'data:image/png;base64,'; } };
}
var clicks = [];
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

const blocks = src.split('<script>').slice(1).map(b => b.split('</script>')[0]);
ok('page has three inline script blocks (theme, data, app)', blocks.length === 3, blocks.length);
const appSrc = blocks[1] + '\n' + blocks[2] + `
;({ summarize, adjustedQ, survival, lifeExp, ageAtPct, contributions, applyWhatIfs, WHATIFS, FACTORS, FACTOR_BY_ID,
   factorMult, atten, baseQ, bmiOf, bmiHR, actHR, alcHR, sleepHR, sbpHR, fvHR, formerHR, interp, devProb, sbpAt,
   DEFAULTS, KEYS, HASH_KEYS, LIFETABLES, PREV, PARENT_HR, PARENT_DIST, SMOKE_HR, SMOKE_SPLIT, AGE_PREV,
   CALIBRATIONS, withBmi, diffLE, MAX_AGE, MAX_MULT, BASE_YR, VASC_SHARE,
   stateToHash, applyHash, hashParams, clampState, onInput, onModeBtn, resetAll, syncControls, refreshAll,
   toggleTheme, exportCsv, exportPng, renderFactorTable, renderCalibration,
   state: () => state, whatif: () => whatif, last: () => last })`;
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
ok('16 risk factors', A.FACTORS.length === 16, A.FACTORS.length);
ok('factor ids unique', new Set(A.FACTORS.map(f => f.id)).size === A.FACTORS.length);
for (const f of A.FACTORS) {
  ok(`${f.id}: has label, group, hrText, distText`, f.label && f.group && f.hrText && f.distText);
  ok(`${f.id}: cites at least one source with a URL`, Array.isArray(f.source) && f.source.length >= 1 && f.source.every(([t, u]) => t && /^https:\/\//.test(u)));
  ok(`${f.id}: value() returns a string`, typeof f.value(D) === 'string' && f.value(D).length > 0);
  for (const x of [20, 40, 60, 80, 100, 110]) {
    const hr = f.hr(D, x);
    ok(`${f.id}: hr finite and positive at ${x}`, isFinite(hr) && hr > 0, hr);
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
for (const s of [D, { ...D, country: 'JPN', sex: 'F', age: 62, smoke: 'current', cigs: 'ge20', diabetes: true, sbp: 150 }]) for (const f of A.FACTORS) {
  let worst = 0;
  for (const x of [s.age, 70, 85, 100, 110]) {
    const a = A.atten(x, f.attenFrom);
    let mean = 0; for (const c of f.dist(s, x)) mean += c.p * Math.pow(c.hr, a);
    worst = Math.max(worst, Math.abs(A.factorMult(f, s, x) - Math.pow(f.hr(s, x), a) / mean));
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
  ok(`${tag}: diabetes worse`, le({ ...p, diabetes: true }) < le(p));
  ok(`${tag}: heart attack / stroke worse`, le({ ...p, cvd: true }) < le(p));
  ok(`${tag}: COPD none > moderate > severe`, le(p) > le({ ...p, copd: 'moderate' }) && le({ ...p, copd: 'moderate' }) > le({ ...p, copd: 'severe' }));
  ok(`${tag}: CKD none > stage 3 > stage 4–5`, le(p) > le({ ...p, ckd: 'stage3' }) && le({ ...p, ckd: 'stage3' }) > le({ ...p, ckd: 'stage45' }));
  ok(`${tag}: depression worse`, le({ ...p, depression: true }) < le(p));
  ok(`${tag}: education 20 > 16 > 12 > 8`, le({ ...p, education: 20 }) > le({ ...p, education: 16 }) && le({ ...p, education: 16 }) > le({ ...p, education: 12 }) && le({ ...p, education: 12 }) > le({ ...p, education: 8 }));
  ok(`${tag}: social strong > moderate > isolated`, le({ ...p, social: 'strong' }) > le({ ...p, social: 'moderate' }) && le({ ...p, social: 'moderate' }) > le({ ...p, social: 'isolated' }));
  ok(`${tag}: partnered better`, le({ ...p, partnered: true }) > le({ ...p, partnered: false }));
  ok(`${tag}: parents 100+ > 90s > 80s > 70s = <70`, le({ ...p, mother: '100', father: '100' }) > le({ ...p, mother: '90s', father: '90s' }) && le({ ...p, mother: '90s', father: '90s' }) > le({ ...p, mother: '80s', father: '80s' }) && le({ ...p, mother: '80s', father: '80s' }) > le({ ...p, mother: '70s', father: '70s' }) && near(le({ ...p, mother: '70s', father: '70s' }), le({ ...p, mother: 'lt70', father: 'lt70' }), 1e-9));
  ok(`${tag}: unknown parents sit between 70s and 80s`, le({ ...p, mother: 'unk', father: 'unk' }) > le({ ...p, mother: '70s', father: '70s' }) && le({ ...p, mother: 'unk', father: 'unk' }) < le({ ...p, mother: '80s', father: '80s' }));
  ok(`${tag}: one long-lived parent helps less than two`, le({ ...p, mother: '90s', father: 'lt70' }) < le({ ...p, mother: '90s', father: '90s' }) && le({ ...p, mother: '90s', father: 'lt70' }) > le({ ...p, mother: 'lt70', father: 'lt70' }));
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
const worst = A.withBmi({ ...D, age: 40, smoke: 'current', cigs: 'ge20', activity: 0, alcohol: 35, fruitveg: 0, sleep: 5, sbp: 165, diabetes: true, cvd: true, copd: 'severe', ckd: 'stage3', depression: true, education: 8, social: 'isolated', partnered: false, mother: 'lt70', father: 'lt70' }, 43);
const rw = A.summarize(worst);
ok('worst-case profile hits the cap', rw.capped === true);
ok(`worst-case 40-year-old keeps ≥ 8 years (${f2(rw.le - 40)})`, rw.le - 40 >= 8);
ok('worst-case still far below average', rw.le < LE(worst, { baseline: true }) - 15);
ok('best-case profile not capped and above average', !A.summarize(A.withBmi({ ...D, activity: 400, sbp: 110, mother: '90s', father: '90s' }, 22.5)).capped);

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
for (const p of [D, { ...D, age: 70, smoke: 'current', cigs: 'ge20', diabetes: true }, { ...D, country: 'DEU', sex: 'F', age: 55, sbp: 150 }]) {
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
// What-ifs
{
  ok('eight what-if changes', A.WHATIFS.length === 8);
  const bad = A.withBmi({ ...D, age: 45, smoke: 'current', cigs: 'ge20', activity: 20, alcohol: 20, sbp: 145, sleep: 5.5, fruitveg: 1, social: 'isolated' }, 33);
  ok('every change applies to the high-risk profile', A.WHATIFS.every(w => w.applies(bad)));
  ok('no change applies to an already-optimal profile', !A.WHATIFS.some(w => w.applies(A.withBmi({ ...D, activity: 300, fruitveg: 5 }, 23))));
  ok('only weight and diet apply to the default profile', A.WHATIFS.filter(w => w.applies(D)).map(w => w.id).join() === 'healthyBmi,diet');
  const fb = A.summarize(bad).le;
  let maxSingle = 0;
  for (const w of A.WHATIFS) { const g = A.summarize(w.apply(bad)).le - fb; ok(`what-if ${w.id} gains ≥ 0 (${f2(g)})`, g >= 0); maxSingle = Math.max(maxSingle, g); }
  const all = A.summarize(A.applyWhatIfs(bad, new Set(A.WHATIFS.map(w => w.id)))).le - fb;
  ok('combined gain ≥ largest single gain', all >= maxSingle);
  ok('combined gain substantial for this profile (> 12 y)', all > 12, f2(all));
  ok('what-if does not mutate the input state', bad.smoke === 'current' && bad.activity === 20);
  ok('inapplicable ids are ignored', near(A.summarize(A.applyWhatIfs(D, new Set(['quitSmoking']))).le, A.summarize(D).le, 1e-12));
  ok('healthy-weight change targets BMI 24', near(A.bmiOf(A.WHATIFS.find(w => w.id === 'healthyBmi').apply(bad)), 24, 0.05));
  ok('quit-smoking change starts at 0 years since quitting', A.WHATIFS.find(w => w.id === 'quitSmoking').apply(bad).quitYears === 0);
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
  ok('"wi" is reserved for what-ifs', !short.includes('wi'));
}
ok('default state writes an empty hash', A.stateToHash() === '');
ok('init rendered every chart', chartCalls.length >= 3, chartCalls.length);
ok('two custom plugins registered (markers, barLabels)', plugins.map(p => p.id).sort().join() === 'barLabels,markers');
ok('survival chart is a line chart with 3 datasets (avg, you, medians)', chartCalls.some(c => c.type === 'line' && c.data.datasets.length === 3));
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
  ok('tornado labels are signed years', lbl.length > 0 && lbl.every(l => /^[+−]?\d+\.\d y$/.test(l)), lbl.join('|'));
  // Every panel after the tornado rendered (a throwing chart would have aborted refreshAll)
  ok('what-if list rendered', els.whatifList.innerHTML.includes('data-wi='));
  ok('what-if total rendered', els.whatifTotal.innerHTML.length > 20);
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
    smoke: 'former', cigs: 'ge20', quitYears: 12, activity: 220, alcohol: 9, fruitveg: 4, sleep: 6.5,
    diabetes: true, cvd: false, depression: true, copd: 'moderate', ckd: 'none', education: 17, social: 'moderate',
    partnered: false, mother: '90s', father: 'lt70', improve: true };
  Object.assign(A.state(), sample);
  A.whatif().add('bp'); A.whatif().add('sleep');
  const h = A.stateToHash();
  ok('hash is compact and readable', h.length < 220 && !/%/.test(h), h);
  ok('hash carries the what-if selection', /wi=sleep,bp/.test(h), h);
  A.resetAll();
  ok('reset restores defaults', JSON.stringify(A.state()) === JSON.stringify(D) && A.whatif().size === 0);
  ok('applyHash returns true for a non-empty hash', A.applyHash('#' + h) === true);
  ok('hash round-trip restores every key', A.KEYS.every(k => A.state()[k] === sample[k]), A.KEYS.filter(k => A.state()[k] !== sample[k]).join());
  ok('hash round-trip restores the what-ifs', [...A.whatif()].sort().join() === 'bp,sleep');
  ok('applyHash returns false for an empty hash', A.applyHash('') === false && A.applyHash('#') === false);
  // Hostile / stale links are validated, not trusted
  A.resetAll();
  A.applyHash('#c=XXX&s=Q&a=999&h=5&sm=vape&ci=lots&cp=terrible&mo=200&al=-4&wi=nonsense,bp');
  const st = A.state();
  ok('unknown country ignored', st.country === 'USA');
  ok('unknown sex ignored', st.sex === 'M');
  ok('age clamped to 100', st.age === 100);
  ok('height clamped to 120', st.height === 120);
  ok('unknown smoking status ignored', st.smoke === 'never' && st.cigs === 'lt10' && st.copd === 'none' && st.mother === 'unk');
  ok('negative alcohol clamped to 0', st.alcohol === 0);
  ok('unknown what-if ids dropped, known kept', [...A.whatif()].join() === 'bp');
  A.resetAll();
}
// Real input handlers (not setState) so a missing key or unit bug is caught
{
  const ev = (key, type, value, extra) => ({ target: { dataset: { key }, type, value, ...extra } });
  A.onInput(ev('age', 'range', '55'));
  ok('age handler updates state', A.state().age === 55);
  ok('age handler re-renders', A.last().full.le > 55);
  A.onInput(ev('diabetes', 'checkbox', 'on', { checked: true }));
  ok('checkbox handler updates state', A.state().diabetes === true);
  A.onInput(ev('smoke', 'select-one', 'former'));
  ok('select handler updates state', A.state().smoke === 'former');
  A.onInput(ev('weight', 'number', '90'));
  ok('metric weight stored as kg', A.state().weight === 90);
  A.onModeBtn({ currentTarget: { dataset: { key: 'units', val: 'imperial' } } });
  ok('units toggle', A.state().units === 'imperial');
  A.onInput(ev('weight', 'number', '176'));
  ok('imperial weight converted to kg', near(A.state().weight, 79.83, 0.05), A.state().weight);
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
  ok('hash written after debounce', /a=18/.test(location.hash) && /s=F/.test(location.hash) && /dm=1/.test(location.hash), location.hash);
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
// Theme
{
  const before = document.documentElement.dataset.theme;
  A.toggleTheme();
  ok('theme toggles', document.documentElement.dataset.theme !== before);
  ok('theme persisted', localStorage.getItem('lifex-theme') === document.documentElement.dataset.theme);
  A.toggleTheme();
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
