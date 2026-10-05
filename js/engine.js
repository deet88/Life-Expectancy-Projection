// ═══════════════════════════════════════════════════════════════════════════
//  Data: per-country prevalence (WHO GHO 2022, age-standardised, both sexes)
// ═══════════════════════════════════════════════════════════════════════════
// smk = current tobacco smoking %, ob = BMI ≥ 30 %, ow = BMI ≥ 25 %, uw = BMI < 18.5 %
const PREV = {
  USA:{smk:15.6, ob:40.4, ow:71.1, uw:2.0}, GBR:{smk:14.0, ob:27.0, ow:61.6, uw:2.0},
  CAN:{smk:12.1, ob:25.8, ow:58.5, uw:2.3}, AUS:{smk:12.4, ob:29.8, ow:63.6, uw:1.8},
  NZL:{smk:10.3, ob:33.3, ow:67.2, uw:1.4}, IRL:{smk:19.2, ob:27.4, ow:64.5, uw:1.4},
  DEU:{smk:22.8, ob:20.6, ow:53.8, uw:1.9}, FRA:{smk:33.7, ob:11.5, ow:38.7, uw:3.9},
  ITA:{smk:22.7, ob:14.4, ow:46.3, uw:2.5}, ESP:{smk:28.1, ob:16.1, ow:51.2, uw:2.2},
  NLD:{smk:21.4, ob:14.5, ow:46.3, uw:1.8}, CHE:{smk:23.6, ob:11.0, ow:37.7, uw:4.1},
  SWE:{smk:11.3, ob:17.0, ow:52.7, uw:1.7}, NOR:{smk:14.4, ob:19.5, ow:57.8, uw:1.4},
  JPN:{smk:18.5, ob:5.5,  ow:23.9, uw:10.9}, SGP:{smk:14.1, ob:15.2, ow:45.5, uw:6.4},
  KOR:{smk:19.6, ob:7.4,  ow:35.6, uw:5.3},
};
const FORMER_SHARE = 0.22;      // former smokers as a share of adults; OECD-typical, applied to all countries
const VASC_SHARE = 0.28;        // share of deaths from vascular causes (WHO, high-income countries)
const MAX_AGE = 110;            // everyone is assumed dead by MAX_AGE + 1
const MAX_MULT = 12;            // cap on the combined hazard multiplier — see methodology
// The favourable side is soft: combined low-risk profiles are studied to about
// half the average hazard (Li 2018; Loef & Walach 2012); below that each further
// halving counts half, with a hard floor at 0.2 (raw 0.08).
const SOFT_FROM = 0.5, MIN_MULT = 0.2;
const BASE_YR = new Date().getFullYear();

// Piecewise-linear interpolation through [age, value] anchors, flat beyond the ends.
function interp(anchors, x) {
  if (x <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i++) {
    const [x0, y0] = anchors[i - 1], [x1, y1] = anchors[i];
    if (x <= x1) return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
  }
  return anchors[anchors.length - 1][1];
}
// Chronic-condition prevalence rises steeply with age, so the "average person"
// a 40-year-old is compared with is far healthier than the one an 80-year-old
// is. Adult anchors, approximate, from CDC/NHANES and OECD survey figures.
const AGE_PREV = {
  diabetes: [[25, .04], [50, .15], [70, .27], [90, .27]],
  cvd:      [[30, .01], [50, .05], [65, .12], [80, .25], [95, .30]],
  copd:     [[30, .01], [50, .05], [65, .10], [80, .14]],
  ckd:      [[30, .01], [50, .05], [65, .15], [80, .35]],
};
// Systolic blood pressure drifts upward with age: share of adults in each band
// (<120, 120s, 130s, 140–159, ≥160) at anchor ages.
const SBP_PREV = [ [30, [.55, .25, .12, .06, .02]], [50, [.35, .22, .18, .18, .07]],
                   [70, [.18, .17, .20, .30, .15]], [90, [.15, .15, .20, .32, .18]] ];
function sbpDist(x) {
  const shares = [0, 1, 2, 3, 4].map(i => interp(SBP_PREV.map(([a, v]) => [a, v[i]]), x));
  const tot = shares.reduce((a, b) => a + b, 0);
  return [112, 125, 135, 150, 170].map((v, i) => ({ hr: sbpHR(v), p: shares[i] / tot }));
}
// Median systolic pressure by age; a person's reading is assumed to drift with it.
const SBP_MEDIAN = [[30, 118], [50, 125], [70, 135], [90, 140]];
function sbpAt(s, x) { return s.sbp + interp(SBP_MEDIAN, x) - interp(SBP_MEDIAN, s.age); }

// Someone free of a condition today may still develop it. Given the population
// prevalence P(x), the chance of having it by age x for a person without it at
// age a is (P(x) − P(a)) / (1 − P(a)); their expected hazard is the mix. This
// is what keeps "no diabetes at 40" from being credited as "never diabetes".
function devProb(key, age, x) {
  const P = interp(AGE_PREV[key], x), P0 = interp(AGE_PREV[key], age);
  return Math.max(0, (P - P0) / (1 - P0));
}
// s.noOnset[key] is set by a timeline diagnosis dated after x: onset is stipulated
// for later, so there is no background chance of it before then.
function expectHR(has, hrIfHas, key, s, x) {
  if (has) return hrIfHas;
  return s.noOnset && s.noOnset[key] ? 1 : 1 + devProb(key, s.age, x) * (hrIfHas - 1);
}
const COPD_MEAN_HR = .7 * 1.6 + .3 * 2.7, CKD_MEAN_HR = .9 * 1.5 + .1 * 3.1;

// ═══════════════════════════════════════════════════════════════════════════
//  Risk factors — the single source of truth for the engine, the tornado,
//  the what-if list and the methodology table.
//    hr(s, x)   raw hazard ratio for state s at future age x
//    dist(s)    reference distribution [{hr, p}] used to re-anchor to the average
//    value(s)   label of the person's current category
// ═══════════════════════════════════════════════════════════════════════════
// Prevalence-weighted (.35/.40/.25) these average 2.8 — the all-cause HR of the
// average current smoker in Thun 2013 and Jha 2013. The light-smoker anchor is
// Inoue-Choi's 1.87 for 1–10/day (in 59–82-year-olds, so slightly attenuated).
const SMOKE_HR = { lt10: 2.0, '10to19': 2.9, ge20: 3.5 };
const SMOKE_SPLIT = { lt10: .35, '10to19': .40, ge20: .25 };
// Excess risk after quitting decays with a 7-year time constant to a 5% floor.
function formerHR(cigs, yrs) { return 1 + (SMOKE_HR[cigs] - 1) * (0.05 + 0.95 * Math.exp(-Math.max(0, yrs) / 7)); }

const BMI_BANDS = [ // [upper bound, HR] — Global BMI Mortality Collaboration 2016, ref 20–25
  [18.5, 1.51], [20, 1.13], [25, 1.00], [27.5, 1.07], [30, 1.20], [35, 1.45], [40, 1.94], [Infinity, 2.76] ];
function bmiOf(s) { const h = s.height / 100; return s.weight / (h * h); }
function bmiHR(b) { for (const [ub, hr] of BMI_BANDS) if (b < ub) return hr; return 2.76; }
function bmiDist(c) {
  const p = PREV[c], uw = p.uw / 100, ow = (p.ow - p.ob) / 100, ob = p.ob / 100;
  const under20 = 0.04, normal = Math.max(0, 1 - uw - under20 - ow - ob);
  return [ {hr:1.51, p:uw}, {hr:1.13, p:under20}, {hr:1.00, p:normal},
           {hr:1.07, p:ow*.55}, {hr:1.20, p:ow*.45},
           {hr:1.45, p:ob*.62}, {hr:1.94, p:ob*.24}, {hr:2.76, p:ob*.14} ];
}

const ACT_BANDS = [ [0, 1.00], [150, 0.80], [300, 0.69], [450, 0.63], [Infinity, 0.61] ]; // Arem 2015, ref none
function actHR(m) { if (m <= 0) return 1; for (const [ub, hr] of ACT_BANDS.slice(1)) if (m < ub) return hr; return 0.61; }

// Alcohol: back-solved so a 40-year-old loses ≈ 0.5 / 1.5 / 4.5 years (Wood 2018).
const ALC_BANDS = [ [7, 1.00], [14, 1.07], [25, 1.21], [Infinity, 1.68] ];
function alcHR(d) { for (const [ub, hr] of ALC_BANDS) if (d <= ub) return hr; return ALC_BANDS[3][1]; }

function fvHR(s) { return Math.pow(0.95, Math.min(5, Math.max(0, s))); }     // Wang 2014, per serving to 5

function sleepHR(h) { return h < 6 ? 1.12 : h < 7 ? 1.06 : h < 9 ? 1.00 : 1.30; } // Cappuccio 2010

function sbpHR(v) { const d = Math.max(0, v - 115); return 1 + VASC_SHARE * (Math.pow(2, d / 20) - 1); }

// HR by the age a parent attained. Atkins 2016: ×0.83 per decade beyond 70;
// 100+: centenarian-offspring meta-analysis. Under 70 is held at the 70s
// reference (conservative — the source did not quantify below it).
const PARENT_HR = { lt70: 1.00, '70s': 1.00, '80s': 0.83, '90s': 0.69, '100': 0.58 };
const PARENT_DIST = { lt70: .30, '70s': .27, '80s': .28, '90s': .13, '100': .02 };
const PARENT_BANDS = [ ['lt70', 0, 70], ['70s', 70, 80], ['80s', 80, 90], ['90s', 90, 100], ['100', 100, Infinity] ];
// "Unknown" is the population average, so it neither rewards nor penalises.
PARENT_HR.unk = Object.keys(PARENT_DIST).reduce((a, k) => a + PARENT_DIST[k] * PARENT_HR[k], 0);
// Input codes: unk · d_<band> (passed away, age reached) · a_<band> (still living, age now)
const ALIVE_AGE = { a_lt60: 55, a_60s: 65, a_70s: 75, a_80s: 85, a_90s: 95, a_100: 102 };
const PARENT_CODES = ['unk', ...Object.keys(ALIVE_AGE), ...PARENT_BANDS.map(b => 'd_' + b[0])];
// A living parent is censored data: what matters is the age they will reach.
// Credit the expectation over the attained-age bands, weighted by the chance
// of reaching each one from their current age, taken from the life table.
function parentHR(code, sex, country) {
  if (code === 'unk') return PARENT_HR.unk;
  if (code.startsWith('d_')) return PARENT_HR[code.slice(2)];
  const a = ALIVE_AGE[code], S = survival(baseQ(country, sex), a);   // S[x] = P(alive at x | alive at a)
  const alive = x => x <= a ? 1 : x > MAX_AGE + 1 ? 0 : S[x];
  let hr = 0;
  for (const [band, lo, hi] of PARENT_BANDS) hr += (alive(lo) - alive(hi)) * PARENT_HR[band];
  return hr;
}

// ── Optional measurements ──────────────────────────────────────────────────
// Each is judged against age/sex peers, so leaving it blank (= population
// average) is exactly neutral and entering it moves the estimate only by
// how far you sit from the norm. Norms are approximate population means.
const VO2_NORM = { M: [[25, 43], [35, 40], [45, 37], [55, 33], [65, 30], [75, 26]],     // ml/kg/min (ACSM / FRIEND registry)
                   F: [[25, 37], [35, 34], [45, 31], [55, 28], [65, 25], [75, 22]] };
const GRIP_NORM = { M: [[25, 47], [35, 47], [45, 45], [55, 42], [65, 38], [75, 33], [85, 27]],   // kg (Dodds 2014)
                    F: [[25, 29], [35, 29], [45, 28], [55, 26], [65, 24], [75, 21], [85, 17]] };
const WAIST_REF = { M: 95, F: 85 };            // cm, population median
const RHR_REF = 70, CRP_REF = 1.5;             // bpm; mg/L (median)
// Annual-mean PM2.5 by country, µg/m³ (WHO / IQAir, approximate). Blank input = this value.
const PM25_COUNTRY = { USA: 8, GBR: 9, CAN: 7, AUS: 7, NZL: 6, IRL: 8, DEU: 11, FRA: 10, ITA: 15, ESP: 10,
                       NLD: 11, CHE: 9, SWE: 5, NOR: 6, JPN: 11, SGP: 18, KOR: 22 };
AGE_PREV.af = [[40, .005], [60, .02], [70, .06], [80, .10], [90, .12]];
AGE_PREV.drugs = [[20, .015], [40, .012], [60, .005], [75, .001]];   // opioid/stimulant dependence is concentrated in the young
// A continuous measure's reference distribution: five points of a normal, ±2 SD.
const Z5 = [-2, -1, 0, 1, 2], W5 = Z5.map(z => Math.exp(-z * z / 2)), W5S = W5.reduce((a, b) => a + b, 0);
function normalDist(mean, sd, hrOf) { return Z5.map((z, i) => ({ hr: hrOf(mean + z * sd), p: W5[i] / W5S })); }
function vo2HR(v, s) { return Math.pow(0.87, (v - interp(VO2_NORM[s.sex], s.age)) / 3.5); }     // Kodama: 13% per MET (3.5 ml/kg/min)
function gripHR(g, s) { return Math.pow(1.16, (interp(GRIP_NORM[s.sex], s.age) - g) / 5); }     // Leong: 1.16 per 5 kg lower
function waistHR(w, s) { return Math.pow(1.11, (w - WAIST_REF[s.sex]) / 10); }                 // Jayedi: 1.11 per 10 cm
function rhrHR(r) { return Math.pow(1.09, (r - RHR_REF) / 10); }                                // Zhang: 1.09 per 10 bpm
function crpHR(c) { return Math.pow(1.34, Math.log(c / CRP_REF) / Math.log(3)); }              // ERFC: 1.34 per 3-fold
function sitHR(h) { return Math.pow(1.04, Math.max(0, h - 8)) * Math.pow(1.01, Math.min(h, 8)); } // Patterson: threshold ~8 h
// Correlated items are capped as a group so they cannot stack past what
// whole-pattern studies find: diet patterns top-vs-bottom ≈ 0.75–0.8
// (Sotos-Prieto 2017); socioeconomic position low-vs-high ≈ 1.3–1.6;
// fitness (aerobic, strength, grip, heart rate, sitting) low-vs-high ≈ 2.5
// (Kodama's low-vs-high CRF alone is 1.70); adiposity (BMI + waist) ≈ 3.
const GROUP_CAPS = { diet: 1.35, ses: 1.6, fitness: 2.5, body: 3.0 };

const FACTORS = [
  { id:'smoking', group:'Lifestyle', label:'Smoking',
    hr: (s, x) => s.smoke === 'never' ? 1 : s.smoke === 'cigar' ? 1.20 : s.smoke === 'current' ? SMOKE_HR[s.cigs]
                 : formerHR(s.cigs, s.quitYears + (x - s.age)),
    dist: s => { const cur = PREV[s.country].smk / 100, never = 1 - cur - FORMER_SHARE;
      return [ {hr:1, p:never}, {hr:formerHR('10to19', 15), p:FORMER_SHARE},
               ...Object.keys(SMOKE_HR).map(k => ({hr:SMOKE_HR[k], p:cur * SMOKE_SPLIT[k]})) ]; },
    value: s => s.smoke === 'never' ? 'Never' : s.smoke === 'cigar' ? 'Cigar / pipe only' : s.smoke === 'current' ? `Current, ${cigLabel(s.cigs)}/day`
                 : `Quit ${s.quitYears} yr ago (${cigLabel(s.cigs)}/day)`,
    attenFrom: 75,   // Thun 2013: smokers' all-cause RR is still ≥ 3 at 55–74, fading only after
    hrText: 'never 1.0 · current <10/day 2.0, 10–19 2.9, ≥20 3.5 (prevalence-weighted 2.8) · cigar or pipe only 1.20 · former: excess decays, 7-yr time constant, 5% floor · vaping: no mortality data yet, not modelled',
    distText: 'country smoking rate (WHO); 22% former; current split 35/40/25 by intensity',
    source: [ ['Thun 2013 NEJM', 'https://pubmed.ncbi.nlm.nih.gov/23343064/'],
              ['Jha 2013 NEJM', 'https://pubmed.ncbi.nlm.nih.gov/23343063/'],
              ['Inoue-Choi 2017 JAMA IM', 'https://pubmed.ncbi.nlm.nih.gov/27918784/'],
              ['Christensen 2018 JAMA IM (cigars)', 'https://pubmed.ncbi.nlm.nih.gov/29459935/'] ] },
  { id:'bmi', group:'Body', label:'Body-mass index', capGroup:'body',
    hr: s => bmiHR(bmiOf(s)), dist: s => bmiDist(s.country),
    value: s => `BMI ${bmiOf(s).toFixed(1)}`,
    hrText: '<18.5 1.51 · 18.5–20 1.13 · 20–25 1.00 · 25–27.5 1.07 · 27.5–30 1.20 · 30–35 1.45 · 35–40 1.94 · ≥40 2.76',
    distText: 'country underweight / overweight / obesity rates (WHO); fixed split within bands',
    source: [ ['Global BMI Mortality Collaboration 2016 Lancet', 'https://pubmed.ncbi.nlm.nih.gov/27423262/'] ] },
  { id:'activity', group:'Fitness', label:'Physical activity', capGroup:'fitness',
    hr: s => actHR(s.activity),
    dist: () => [ {hr:1.00, p:.25}, {hr:0.80, p:.30}, {hr:0.69, p:.22}, {hr:0.63, p:.12}, {hr:0.61, p:.11} ],
    value: s => `${s.activity} min/week`,
    hrText: 'none 1.00 · <150 min 0.80 · 150–299 0.69 · 300–449 0.63 · ≥450 0.61',
    distText: '25% none, 30% below guideline, 22% / 12% / 11% above',
    source: [ ['Arem 2015 JAMA Intern Med', 'https://pubmed.ncbi.nlm.nih.gov/25844730/'] ] },
  { id:'alcohol', group:'Lifestyle', label:'Alcohol',
    hr: s => alcHR(s.alcohol),
    dist: () => ALC_BANDS.map(([, hr], i) => ({ hr, p: [.70, .17, .09, .04][i] })),
    value: s => `${s.alcohol} drinks/week`,
    hrText: '0–7 drinks/wk 1.00 · 8–14 1.07 · 15–25 1.21 · >25 1.68 (back-solved from the reported life-expectancy losses)',
    distText: '70% ≤ 7/wk, 17% 8–14, 9% 15–25, 4% > 25',
    source: [ ['Wood 2018 Lancet', 'https://pubmed.ncbi.nlm.nih.gov/29676281/'] ] },
  { id:'diet', group:'Diet', label:'Fruit & vegetables', capGroup:'diet',
    hr: s => fvHR(s.fruitveg),
    dist: () => [ {hr:fvHR(1), p:.15}, {hr:fvHR(2), p:.25}, {hr:fvHR(3), p:.25}, {hr:fvHR(4), p:.17}, {hr:fvHR(5), p:.18} ],
    value: s => `${s.fruitveg} servings/day`,
    hrText: '0.95 per daily serving, no further benefit past 5 (0 → 5 servings: 0.77)',
    distText: '15% ≤ 1 serving, 25% 2, 25% 3, 17% 4, 18% ≥ 5',
    source: [ ['Wang 2014 BMJ', 'https://pubmed.ncbi.nlm.nih.gov/25073782/'] ] },
  { id:'sleep', group:'Lifestyle', label:'Sleep',
    hr: s => sleepHR(s.sleep),
    dist: () => [ {hr:1.12, p:.12}, {hr:1.06, p:.25}, {hr:1.00, p:.53}, {hr:1.30, p:.10} ],
    value: s => `${s.sleep} h/night`,
    hrText: '<6 h 1.12 · 6–7 h 1.06 (interpolated) · 7–9 h 1.00 · ≥9 h 1.30',
    distText: '12% < 6 h, 25% 6–7, 53% 7–9, 10% ≥ 9',
    source: [ ['Cappuccio 2010 Sleep', 'https://pubmed.ncbi.nlm.nih.gov/20469800/'] ] },
  { id:'sbp', group:'Body', label:'Blood pressure',
    hr: (s, x) => sbpHR(sbpAt(s, x)),
    dist: (s, x) => sbpDist(x),
    value: s => `${s.sbp} mmHg`,
    hrText: 'derived: 1 + 0.28 × (2^(ΔSBP/20) − 1) above 115 mmHg → 125: 1.12 · 135: 1.28 · 150: 1.66 · 170: 2.60; your reading drifts with age at the population rate (+17 mmHg from 30 to 70)',
    distText: 'age-dependent: at 30, 55% < 120 and 8% ≥ 140; at 70, 18% < 120 and 45% ≥ 140',
    source: [ ['Lewington 2002 Lancet (PSC)', 'https://pubmed.ncbi.nlm.nih.gov/12493255/'] ] },
  { id:'diabetes', group:'Health', label:'Diabetes',
    // Prediabetes: 1.13 today, converging on the diabetes HR as onset accrues at
    // roughly three times the population rate (ADA: 5–10% of prediabetics a year).
    hr: (s, x) => s.diabetes === 'yes' ? 1.80 : s.diabetes === 'pre' ? 1.13 + (s.noOnset && s.noOnset.diabetes ? 0 : Math.min(1, 3 * devProb('diabetes', s.age, x))) * (1.80 - 1.13)
                 : expectHR(false, 1.80, 'diabetes', s, x),
    dist: (s, x) => { const p = interp(AGE_PREV.diabetes, x), pre = Math.min(0.25, 1 - p); return [ {hr:1, p:1 - p - pre}, {hr:1.13, p:pre}, {hr:1.80, p} ]; },
    attenFrom: Infinity,   // established disease: the source's life-expectancy figures imply a sustained HR
    value: s => s.diabetes === 'yes' ? 'Yes' : s.diabetes === 'pre' ? 'Prediabetes' : 'No',
    hrText: 'prediabetes 1.13, rising toward 1.80 as progression accrues at three times the population onset rate · diabetes 1.80; if absent, the chance of developing it later is priced in', distText: 'age-dependent prevalence: 4% at 25, 15% at 50, 27% at 70+; 25% prediabetes',
    source: [ ['Emerging Risk Factors Collaboration 2011 NEJM', 'https://pubmed.ncbi.nlm.nih.gov/21366474/'],
              ['Cai 2020 BMJ (prediabetes)', 'https://pubmed.ncbi.nlm.nih.gov/32669282/'] ] },
  { id:'cvd', group:'Health', label:'Heart attack / stroke',
    hr: (s, x) => expectHR(s.cvd, 2.0, 'cvd', s, x), dist: (s, x) => yesNo(2.0, interp(AGE_PREV.cvd, x)),
    attenFrom: Infinity,
    value: s => s.cvd ? 'Yes' : 'No',
    hrText: '2.0 (history of myocardial infarction or stroke); if absent, the chance of a future event is priced in', distText: 'age-dependent prevalence: 1% at 30, 5% at 50, 12% at 65, 25% at 80',
    source: [ ['Di Angelantonio 2015 JAMA (ERFC)', 'https://pubmed.ncbi.nlm.nih.gov/26151266/'] ] },
  { id:'copd', group:'Health', label:'COPD',
    hr: (s, x) => s.copd === 'severe' ? 2.7 : s.copd === 'moderate' ? 1.6 : expectHR(false, COPD_MEAN_HR, 'copd', s, x),
    dist: (s, x) => { const p = interp(AGE_PREV.copd, x); return [ {hr:1, p:1 - p}, {hr:1.6, p:p * .7}, {hr:2.7, p:p * .3} ]; },
    attenFrom: Infinity,
    value: s => s.copd === 'none' ? 'No' : s.copd === 'severe' ? 'Severe' : 'Mild / moderate',
    hrText: 'mild–moderate 1.6 · severe 2.7 (adjusted for smoking)', distText: 'age-dependent prevalence: 1% at 30, 5% at 50, 10% at 65, 14% at 80; 30% of cases severe',
    source: [ ['Mannino 2003 Thorax (NHANES I)', 'https://pubmed.ncbi.nlm.nih.gov/12728157/'] ] },
  { id:'ckd', group:'Health', label:'Kidney disease',
    hr: (s, x) => s.ckd === 'stage45' ? 3.1 : s.ckd === 'stage3' ? 1.5 : expectHR(false, CKD_MEAN_HR, 'ckd', s, x),
    dist: (s, x) => { const p = interp(AGE_PREV.ckd, x); return [ {hr:1, p:1 - p}, {hr:1.5, p:p * .9}, {hr:3.1, p:p * .1} ]; },
    attenFrom: Infinity,
    value: s => s.ckd === 'none' ? 'No' : s.ckd === 'stage45' ? 'Stage 4–5' : 'Stage 3',
    hrText: 'stage 3 (eGFR 30–59) 1.5 · stage 4–5 (eGFR < 30) 3.1', distText: 'age-dependent prevalence: 1% at 30, 5% at 50, 15% at 65, 35% at 80; 10% of cases stage 4–5',
    source: [ ['CKD Prognosis Consortium 2010 Lancet', 'https://pubmed.ncbi.nlm.nih.gov/20483451/'] ] },
  { id:'mental', group:'Health', label:'Mental health',
    hr: s => s.mental === 'smi' ? 2.22 : s.mental === 'depression' ? 1.52 : 1, dist: () => [ {hr:1, p:.90}, {hr:1.52, p:.08}, {hr:2.22, p:.02} ],
    value: s => s.mental === 'smi' ? 'Serious mental illness' : s.mental === 'depression' ? 'Depression' : 'No diagnosis',
    hrText: 'depression 1.52 · serious mental illness (bipolar, schizophrenia) 2.22', distText: '8% depression, 2% serious mental illness',
    source: [ ['Cuijpers 2014 Am J Psychiatry', 'https://pubmed.ncbi.nlm.nih.gov/24434956/'],
              ['Walker 2015 JAMA Psychiatry', 'https://pubmed.ncbi.nlm.nih.gov/25671328/'] ] },
  { id:'af', group:'Health', label:'Atrial fibrillation',
    hr: (s, x) => expectHR(s.af, 1.46, 'af', s, x), dist: (s, x) => yesNo(1.46, interp(AGE_PREV.af, x)),
    attenFrom: Infinity,
    value: s => s.af ? 'Yes' : 'No',
    hrText: '1.46; if absent, the chance of developing it later is priced in', distText: 'age-dependent prevalence: 0.5% at 40, 2% at 60, 6% at 70, 10% at 80',
    source: [ ['Odutayo 2016 BMJ', 'https://pubmed.ncbi.nlm.nih.gov/27599725/'] ] },
  { id:'osa', group:'Health', label:'Sleep apnoea',
    hr: s => s.osa === 'severe' ? 1.92 : s.osa === 'moderate' ? 1.15 : 1, dist: () => [ {hr:1, p:.88}, {hr:1.15, p:.08}, {hr:1.92, p:.04} ],
    value: s => s.osa === 'severe' ? 'Severe' : s.osa === 'moderate' ? 'Mild / moderate' : 'No',
    hrText: 'mild–moderate 1.15 (interpolated; not significant alone) · severe 1.92 — untreated; effective CPAP likely lowers it', distText: '8% mild–moderate, 4% severe',
    source: [ ['Wang 2013 Int J Cardiol (meta-analysis)', 'https://pubmed.ncbi.nlm.nih.gov/24161531/'] ] },
  { id:'drugs', group:'Health', label:'Opioid / stimulant dependence',
    hr: s => s.drugs === 'current' ? 8 : 1, dist: (s, x) => yesNo(8, interp(AGE_PREV.drugs, x)),
    attenFrom: Infinity,
    value: s => s.drugs === 'current' ? 'Current' : 'No',
    hrText: '8 (the pooled standardised mortality ratio is 10; 8 is used because an SMR against the whole population overstates a hazard ratio for young adults)', distText: 'age-dependent prevalence: 1.5% at 20, 1.2% at 40, 0.5% at 60, 0.1% at 75',
    source: [ ['Larney 2020 JAMA Psychiatry', 'https://pubmed.ncbi.nlm.nih.gov/31876906/'] ] },
  { id:'srh', group:'Health', label:'Self-rated health',
    hr: s => ({ unk: null, excellent: 1, verygood: 1.10, good: 1.23, fair: 1.44, poor: 1.92 })[s.srh],
    dist: () => [ {hr:1, p:.18}, {hr:1.10, p:.32}, {hr:1.23, p:.30}, {hr:1.44, p:.14}, {hr:1.92, p:.06} ],
    value: s => s.srh === 'unk' ? 'not entered' : { excellent:'Excellent', verygood:'Very good', good:'Good', fair:'Fair', poor:'Poor' }[s.srh],
    hrText: 'excellent 1.00 · very good 1.10 (interpolated) · good 1.23 · fair 1.44 · poor 1.92 — holds after adjustment for diagnosed illness, so it captures what the other questions miss', distText: '18% excellent, 32% very good, 30% good, 14% fair, 6% poor',
    source: [ ['DeSalvo 2006 J Gen Intern Med (meta-analysis)', 'https://pubmed.ncbi.nlm.nih.gov/16336622/'] ] },
  { id:'education', group:'Social', label:'Education', capGroup:'ses',
    hr: s => Math.pow(0.981, Math.min(22, Math.max(0, s.education)) - 12),
    dist: () => [ {hr:Math.pow(0.981,-2), p:.12}, {hr:1, p:.35}, {hr:Math.pow(0.981,2), p:.20}, {hr:Math.pow(0.981,4), p:.23}, {hr:Math.pow(0.981,6), p:.10} ],
    value: s => `${s.education} years`,
    hrText: '0.981 per year of schooling (1.9% per year), relative to 12 years', distText: '12% 10 yrs, 35% 12, 20% 14, 23% 16, 10% 18',
    source: [ ['Balaj 2024 Lancet Public Health', 'https://pubmed.ncbi.nlm.nih.gov/38278172/'] ] },
  { id:'social', group:'Social', label:'Social connection',
    hr: s => s.social === 'isolated' ? 1.29 : s.social === 'moderate' ? 1.13 : 1,
    dist: () => [ {hr:1, p:.60}, {hr:1.13, p:.25}, {hr:1.29, p:.15} ],
    value: s => s.social === 'strong' ? 'Strong' : s.social === 'moderate' ? 'Moderate' : 'Isolated',
    hrText: 'strong 1.00 · moderate 1.13 (interpolated) · isolated / lonely 1.29', distText: '60% strong, 25% moderate, 15% isolated',
    source: [ ['Holt-Lunstad 2015 Perspect Psychol Sci', 'https://pubmed.ncbi.nlm.nih.gov/25910392/'] ] },
  { id:'partnered', group:'Social', label:'Partnered',
    hr: s => s.partnered ? 1 : 1.24, dist: () => [ {hr:1, p:.60}, {hr:1.24, p:.40} ],
    value: s => s.partnered ? 'Yes' : 'No',
    hrText: 'not married / partnered 1.24', distText: '60% partnered',
    source: [ ['Roelfs 2011 Am J Epidemiol', 'https://pubmed.ncbi.nlm.nih.gov/21715646/'] ] },
  { id:'parents', group:'Family', label:"Parents' longevity",
    // Geometric mean of the two parents' HRs: Atkins found the combined effect
    // well short of the product of two per-parent effects.
    hr: s => Math.sqrt(parentHR(s.mother, 'F', s.country) * parentHR(s.father, 'M', s.country)),
    dist: () => { const out = []; for (const m in PARENT_DIST) for (const f in PARENT_DIST)
      out.push({ hr: Math.sqrt(PARENT_HR[m] * PARENT_HR[f]), p: PARENT_DIST[m] * PARENT_DIST[f] }); return out; },
    value: s => `Mother ${parentLabel(s.mother)}, father ${parentLabel(s.father)}`,
    hrText: 'per parent, by age reached: <70 or 70s 1.00 · 80s 0.83 · 90s 0.69 · 100+ 0.58 · a living parent gets the life-table expectation over the ages they may still reach (alive at 75 ≈ 0.80) · unknown = population average; the two combine as the geometric mean',
    distText: 'per parent 30% < 70, 27% 70s, 28% 80s, 13% 90s, 2% 100+ (age reached)',
    source: [ ['Atkins 2016 JACC (UK Biobank)', 'https://pubmed.ncbi.nlm.nih.gov/27539176/'],
              ['Centenarian-offspring meta-analysis 2026', 'https://pubmed.ncbi.nlm.nih.gov/42646838/'] ] },
  // ── Fitness & measurements (optional) ──
  { id:'vo2max', group:'Fitness', label:'Cardiorespiratory fitness', capGroup:'fitness',
    hr: s => s.vo2max === null ? null : vo2HR(s.vo2max, s),
    dist: s => normalDist(interp(VO2_NORM[s.sex], s.age), 7, v => vo2HR(v, s)),
    value: s => s.vo2max === null ? 'not entered' : `VO₂max ${s.vo2max} ml/kg/min`,
    hrText: '0.87 per MET (3.5 ml/kg/min) above or below the age- and sex-specific norm; when entered, self-reported exercise counts at half weight', distText: 'normal around the age/sex norm (e.g. men 45: 37 ml/kg/min), SD 7',
    source: [ ['Kodama 2009 JAMA (meta-analysis)', 'https://pubmed.ncbi.nlm.nih.gov/19454641/'] ] },
  { id:'grip', group:'Fitness', label:'Grip strength', capGroup:'fitness',
    hr: s => s.grip === null ? null : gripHR(s.grip, s),
    dist: s => normalDist(interp(GRIP_NORM[s.sex], s.age), s.sex === 'M' ? 8 : 5, g => gripHR(g, s)),
    value: s => s.grip === null ? 'not entered' : `${s.grip} kg`,
    hrText: '1.16 per 5 kg below the age- and sex-specific norm (0.86 per 5 kg above)', distText: 'normal around the norm (e.g. men 45: 45 kg, women 45: 28 kg), SD 8 / 5',
    source: [ ['Leong 2015 Lancet (PURE)', 'https://pubmed.ncbi.nlm.nih.gov/25982160/'] ] },
  { id:'strength', group:'Fitness', label:'Strength training', capGroup:'fitness',
    hr: s => ({ unk: null, none: 1, '1to2': 0.85, '3plus': 0.90 })[s.strength],
    dist: () => [ {hr:1, p:.70}, {hr:0.85, p:.20}, {hr:0.90, p:.10} ],
    value: s => ({ unk:'not entered', none:'None', '1to2':'1–2 sessions/week', '3plus':'3+ sessions/week' })[s.strength],
    hrText: 'none 1.00 · 1–2 sessions (≈ 30–60 min) per week 0.85 · 3+ sessions 0.90 (J-shaped; independent of aerobic activity)', distText: '70% none, 20% 1–2, 10% 3+',
    source: [ ['Momma 2022 Br J Sports Med (meta-analysis)', 'https://pubmed.ncbi.nlm.nih.gov/35228201/'] ] },
  { id:'sitting', group:'Fitness', label:'Sitting time', capGroup:'fitness',
    hr: s => s.sitting === null ? null : sitHR(s.sitting),
    dist: () => [ {hr:sitHR(3), p:.15}, {hr:sitHR(5), p:.30}, {hr:sitHR(7), p:.30}, {hr:sitHR(9), p:.17}, {hr:sitHR(11), p:.08} ],
    value: s => s.sitting === null ? 'not entered' : `${s.sitting} h/day`,
    hrText: '1.01 per hour up to 8 h/day, then 1.04 per additional hour (independent of exercise)', distText: '15% ≈ 3 h, 30% ≈ 5 h, 30% ≈ 7 h, 17% ≈ 9 h, 8% ≈ 11 h',
    source: [ ['Patterson 2018 Eur J Epidemiol (meta-analysis)', 'https://pubmed.ncbi.nlm.nih.gov/29589226/'] ] },
  // ── Body measurements (optional) ──
  { id:'waist', group:'Body', label:'Waist circumference', capGroup:'body',
    hr: s => s.waist === null ? null : waistHR(s.waist, s),
    dist: s => normalDist(WAIST_REF[s.sex], 12, w => waistHR(w, s)),
    value: s => s.waist === null ? 'not entered' : `${Math.round(s.waist)} cm`,
    hrText: '1.11 per 10 cm above the sex-specific median (men 95 cm, women 85 cm); independent of BMI', distText: 'normal around the median, SD 12 cm',
    source: [ ['Jayedi 2020 BMJ (meta-analysis)', 'https://pubmed.ncbi.nlm.nih.gov/32967840/'] ] },
  { id:'rhr', group:'Fitness', label:'Resting heart rate', capGroup:'fitness',
    hr: s => s.rhr === null ? null : rhrHR(s.rhr),
    dist: () => normalDist(RHR_REF, 11, r => rhrHR(r)),
    value: s => s.rhr === null ? 'not entered' : `${s.rhr} bpm`,
    hrText: '1.09 per 10 bpm (> 80 bpm ≈ 1.45 vs < 60)', distText: 'normal around 70 bpm, SD 11',
    source: [ ['Zhang 2016 CMAJ (meta-analysis)', 'https://pubmed.ncbi.nlm.nih.gov/26598376/'] ] },
  { id:'crp', group:'Body', label:'hs-CRP',
    hr: s => s.crp === null ? null : crpHR(Math.min(20, Math.max(0.2, s.crp))),
    dist: () => [0.5, 0.9, 1.5, 3, 6].map((c, i) => ({ hr: crpHR(c), p: [.2, .2, .2, .2, .2][i] })),
    value: s => s.crp === null ? 'not entered' : `${s.crp} mg/L`,
    hrText: '1.34 per 3-fold higher CRP (after adjustment for conventional risk factors), relative to a 1.5 mg/L median; clamped to 0.2–20', distText: 'log-normal around 1.5 mg/L',
    source: [ ['Emerging Risk Factors Collaboration 2010 Lancet', 'https://pubmed.ncbi.nlm.nih.gov/20031199/'] ] },
  // ── Diet (capped as a group) ──
  { id:'nuts', group:'Diet', label:'Nuts', capGroup:'diet',
    hr: s => ({ unk: null, rare: 1, weekly: 0.90, daily: 0.78 })[s.nuts],
    dist: () => [ {hr:1, p:.55}, {hr:0.90, p:.30}, {hr:0.78, p:.15} ],
    value: s => ({ unk:'not entered', rare:'Rarely', weekly:'A few times a week', daily:'Daily handful' })[s.nuts],
    hrText: 'rarely 1.00 · a few times a week 0.90 · a daily handful (28 g) 0.78', distText: '55% rarely, 30% weekly, 15% daily',
    source: [ ['Aune 2016 BMC Med (meta-analysis)', 'https://pubmed.ncbi.nlm.nih.gov/27916000/'] ] },
  { id:'grains', group:'Diet', label:'Whole grains', capGroup:'diet',
    hr: s => ({ unk: null, rare: 1, some: 0.92, daily: 0.83 })[s.grains],
    dist: () => [ {hr:1, p:.40}, {hr:0.92, p:.35}, {hr:0.83, p:.25} ],
    value: s => ({ unk:'not entered', rare:'Rarely', some:'Some days', daily:'Most meals' })[s.grains],
    hrText: 'rarely 1.00 · some days 0.92 · three servings a day (90 g) 0.83', distText: '40% rarely, 35% some days, 25% daily',
    source: [ ['Aune 2016 BMJ (meta-analysis)', 'https://pubmed.ncbi.nlm.nih.gov/27301975/'] ] },
  { id:'meat', group:'Diet', label:'Processed meat', capGroup:'diet',
    hr: s => ({ unk: null, rare: 1, weekly: 1.10, daily: 1.23 })[s.meat],
    dist: () => [ {hr:1, p:.40}, {hr:1.10, p:.40}, {hr:1.23, p:.20} ],
    value: s => ({ unk:'not entered', rare:'Rarely', weekly:'A few times a week', daily:'Most days' })[s.meat],
    hrText: 'rarely 1.00 · a few times a week 1.10 (interpolated) · most days 1.23 (highest vs lowest intake)', distText: '40% rarely, 40% weekly, 20% daily',
    source: [ ['Larsson 2014 Am J Epidemiol (meta-analysis)', 'https://pubmed.ncbi.nlm.nih.gov/24148709/'] ] },
  { id:'sugary', group:'Diet', label:'Sugary drinks', capGroup:'diet',
    hr: s => ({ unk: null, rare: 1, weekly: 1.06, daily: 1.14, twice: 1.21 })[s.sugary],
    dist: () => [ {hr:1, p:.45}, {hr:1.06, p:.25}, {hr:1.14, p:.20}, {hr:1.21, p:.10} ],
    value: s => ({ unk:'not entered', rare:'Rarely', weekly:'A few a week', daily:'One a day', twice:'Two or more a day' })[s.sugary],
    hrText: 'rarely 1.00 · a few a week 1.06 · one a day 1.14 · two or more a day 1.21', distText: '45% rarely, 25% weekly, 20% daily, 10% twice daily',
    source: [ ['Malik 2019 Circulation', 'https://pubmed.ncbi.nlm.nih.gov/30882235/'] ] },
  { id:'coffee', group:'Diet', label:'Coffee',
    hr: s => ({ unk: null, none: 1, '1to2': 0.92, '3to4': 0.83, '5plus': 0.88 })[s.coffee],
    dist: () => [ {hr:1, p:.30}, {hr:0.92, p:.35}, {hr:0.83, p:.25}, {hr:0.88, p:.10} ],
    value: s => ({ unk:'not entered', none:'None', '1to2':'1–2 cups/day', '3to4':'3–4 cups/day', '5plus':'5+ cups/day' })[s.coffee],
    hrText: 'none 1.00 · 1–2 cups 0.92 · 3–4 cups 0.83 · 5+ 0.88 (observational; umbrella review of meta-analyses)', distText: '30% none, 35% 1–2, 25% 3–4, 10% 5+',
    source: [ ['Poole 2017 BMJ (umbrella review)', 'https://pubmed.ncbi.nlm.nih.gov/29167102/'] ] },
  // ── Work, income, environment ──
  { id:'work', group:'Social', label:'Employment',
    // Unemployment's excess applies during working age; from 65 everyone is scored alike.
    hr: (s, x) => x >= 65 ? 1 : s.work === 'unemployed' ? 1.63 : 1,
    dist: (s, x) => x >= 65 ? [ {hr:1, p:1} ] : [ {hr:1, p:.94}, {hr:1.63, p:.06} ],
    value: s => ({ working:'Working', notworking:'Not in the workforce', unemployed:'Unemployed, seeking work' })[s.work],
    hrText: 'unemployed and seeking work 1.63, under 65 only; retired, studying or home-making 1.00', distText: '6% unemployed (working age)',
    source: [ ['Roelfs 2011 Soc Sci Med (meta-analysis)', 'https://pubmed.ncbi.nlm.nih.gov/21330027/'] ] },
  { id:'income', group:'Social', label:'Household income', capGroup:'ses',
    hr: s => ({ unk: null, low: 1.26, middle: 1.12, high: 1 })[s.income],
    dist: () => [ {hr:1.26, p:.25}, {hr:1.12, p:.45}, {hr:1, p:.30} ],
    value: s => ({ unk:'not entered', low:'Below half the national median', middle:'Around the median', high:'Well above the median' })[s.income],
    hrText: 'low 1.26 · middle 1.12 (interpolated) · high 1.00 — the low-vs-high estimate after adjusting for smoking, alcohol, inactivity, obesity, blood pressure and diabetes, which are modelled separately here', distText: '25% low, 45% middle, 30% high',
    source: [ ['Stringhini 2017 Lancet (LIFEPATH)', 'https://pubmed.ncbi.nlm.nih.gov/28159391/'] ] },
  { id:'pm25', group:'Environment', label:'Air pollution',
    hr: s => s.pm25 === null ? null : Math.pow(1.08, (s.pm25 - PM25_COUNTRY[s.country]) / 10),
    dist: () => [ {hr:1, p:1} ],
    value: s => s.pm25 === null ? 'country average' : `PM2.5 ${s.pm25} µg/m³`,
    hrText: '1.08 per 10 µg/m³ of annual-mean PM2.5 above your country\'s average (blank = the average)', distText: 'anchored at the country mean (e.g. US 8, Korea 22 µg/m³)',
    source: [ ['Chen & Hoek 2020 Environ Int (WHO systematic review)', 'https://pubmed.ncbi.nlm.nih.gov/32703584/'] ] },
];
const FACTOR_BY_ID = Object.fromEntries(FACTORS.map(f => [f.id, f]));
function yesNo(hr, p) { return [ {hr:1, p:1 - p}, {hr, p} ]; }
function cigLabel(c) { return c === 'lt10' ? '<10' : c === 'ge20' ? '20+' : '10–19'; }
function parentLabel(p) {
  if (p === 'unk') return 'unknown';
  const band = p.slice(2), age = band === 'lt60' ? 'under 60' : band === 'lt70' ? 'under 70' : band === '100' ? '100+' : band;
  return (p.startsWith('a_') ? 'living, ' : 'died ') + age;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Engine — pure functions, no DOM
// ═══════════════════════════════════════════════════════════════════════════
// Relative risks shrink with age in every source that stratifies (see methodology):
// full strength until `from` (60 by default), halving over the next 25 years,
// then easing to a quarter over the 15 after that.
function atten(x, from = 60) {
  if (x < from) return 1;
  if (x < from + 25) return 1 - 0.5 * (x - from) / 25;
  if (x < from + 40) return 0.5 - 0.25 * (x - from - 25) / 15;
  return 0.25;
}

// Baseline q[0..MAX_AGE] for a country and sex. WPP gives single ages 0–99 (100+
// is an open interval), so 100–110 come from a Gompertz line fitted to 85–99.
const qCache = {};
function baseQ(country, sex) {
  const key = country + sex;
  if (qCache[key]) return qCache[key];
  const qx = LIFETABLES.countries[country][sex].qx;
  const q = qx.slice(0, 100);
  const xs = [], ys = [];
  for (let x = 85; x <= 99; x++) { xs.push(x); ys.push(Math.log(-Math.log(1 - qx[x]))); }
  const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const b = sxy / sxx, a = my - b * mx;
  for (let x = 100; x <= MAX_AGE; x++) q[x] = Math.min(1, 1 - Math.exp(-Math.exp(a + b * x)));
  q[MAX_AGE] = 1;
  return (qCache[key] = q);
}

function bandIndex(x) {
  const bands = LIFETABLES.bands;
  for (let i = 0; i < bands.length; i++) if (x >= bands[i][0] && x <= bands[i][1]) return i;
  return bands.length - 1;
}

// The multiplier a factor contributes at age x: the person's attenuated HR over
// the prevalence-weighted mean attenuated HR of the reference population.
function factorMult(f, s, x) {
  const raw = f.hr(s, x);
  if (raw === null) return 1;            // not entered = population average
  const a = atten(x, f.attenFrom);
  const own = Math.pow(raw, a);
  let mean = 0;
  for (const c of f.dist(s, x)) mean += c.p * Math.pow(c.hr, a);
  return own / mean;
}

// Adjusted q[] from the person's current age. opts.neutral: Set of factor ids
// forced to the population average (multiplier 1); opts.baseline: all of them.
// The combined multiplier is capped at MAX_MULT: the proportional-hazards
// assumption has been tested up to about 8× (three cardiometabolic diseases,
// Di Angelantonio 2015) and nothing supports stacking beyond that.
// Returns the array with a `capped` property when the cap bound at any age.
function adjustedQ(s, opts = {}) {
  const q0 = baseQ(s.country, s.sex);
  const r = LIFETABLES.countries[s.country][s.sex].r;
  const q = new Array(MAX_AGE + 1).fill(0);
  q.capped = false; q.compressed = false;
  for (let x = s.age; x <= MAX_AGE; x++) {
    if (q0[x] >= 1) { q[x] = 1; continue; }
    let mu = -Math.log(1 - q0[x]);
    if (s.improve) mu *= Math.exp(-r[bandIndex(x)] * (BASE_YR - LIFETABLES.baseYear + (x - s.age)));
    if (!opts.baseline) {
      let m = 1;
      const groups = {};
      const sx = stateAt(s, x);           // the person as they will be at x (health timeline)
      for (const f of FACTORS) {
        if (opts.neutral && opts.neutral.has(f.id)) continue;
        let fm = factorMult(f, sx, x);
        // Measured fitness is what self-reported exercise was standing in for:
        // when VO2max is entered, the exercise answer counts at half weight.
        if (f.id === 'activity' && sx.vo2max !== null) fm = Math.sqrt(fm);
        if (f.capGroup) groups[f.capGroup] = (groups[f.capGroup] || 1) * fm;
        else m *= fm;
      }
      for (const g in groups) m *= opts.nocap ? groups[g] : Math.min(GROUP_CAPS[g], Math.max(1 / GROUP_CAPS[g], groups[g]));
      if (!opts.nocap && m > MAX_MULT) { m = MAX_MULT; q.capped = true; }
      if (!opts.nocap && m < SOFT_FROM) { m = SOFT_FROM * Math.sqrt(m / SOFT_FROM); q.compressed = true; }
      if (!opts.nocap && m < MIN_MULT) { m = MIN_MULT; q.capped = true; }
      mu *= m;
    }
    q[x] = 1 - Math.exp(-mu);
  }
  return q;
}

// Survival S[x] = P(alive at exact age x | alive at s.age), x = age..MAX_AGE+1
function survival(q, age) {
  const S = new Array(MAX_AGE + 2).fill(0);
  S[age] = 1;
  for (let x = age; x <= MAX_AGE; x++) S[x + 1] = S[x] * (1 - q[x]);
  return S;
}
function lifeExp(S, age) { let t = 0; for (let x = age + 1; x <= MAX_AGE + 1; x++) t += S[x]; return age + t + 0.5; }
function ageAtPct(S, age, pct) {   // age by which (1 - pct) have died, i.e. S = pct
  for (let x = age; x <= MAX_AGE; x++) {
    if (S[x + 1] <= pct) { const f = (S[x] - pct) / (S[x] - S[x + 1] || 1); return x + f; }
  }
  return MAX_AGE + 1;
}

function summarize(s, opts) {
  const q = adjustedQ(s, opts), S = survival(q, s.age);
  return { q, S, capped: q.capped, compressed: q.compressed, le: lifeExp(S, s.age), median: ageAtPct(S, s.age, 0.5),
    p10: ageAtPct(S, s.age, 0.9), p25: ageAtPct(S, s.age, 0.75), p75: ageAtPct(S, s.age, 0.25), p90: ageAtPct(S, s.age, 0.1),
    reach: n => n <= s.age ? 1 : n > MAX_AGE + 1 ? 0 : S[n] };
}

// One-at-a-time contributions vs the national average, plus the interaction residual.
// When a cap or group cap is binding, resetting a single factor may not move the
// capped total at all, so the attribution is done with the caps off and then
// scaled to the capped total: bars keep their relative sizes and still reconcile.
function contributions(s, full) {
  const base = summarize(s, { baseline: true }).le;
  const uncapped = summarize(s, { nocap: true });
  const altered = full.capped || full.compressed;
  const ref = altered ? uncapped.le : full.le, opt = altered ? { nocap: true } : {};
  const rows = FACTORS.map(f => ({ id: f.id, label: f.label, value: f.value(s),
    years: ref - summarize(s, { ...opt, neutral: new Set([f.id]) }).le }));
  const sum = rows.reduce((a, r) => a + r.years, 0);
  let interaction = ref - base - sum;
  if (altered) {
    const scale = (ref - base) ? (full.le - base) / (ref - base) : 1;
    rows.forEach(r => r.years *= scale); interaction *= scale;
  }
  return { rows, base, total: full.le - base, interaction, scaled: altered };
}

// ── Quick changes: one-click timeline presets, each an event dated today ────
const SET_NOW = (field, value) => s => ({ kind:'set', age:s.age, field, value });
const WHATIFS = [
  { id:'quitSmoking', label:'Quit smoking', applies: s => s.smoke === 'current', event: s => ({ kind:'quit', age:s.age }) },
  { id:'healthyBmi', label:'Reach a healthy weight (BMI 24)', applies: s => bmiOf(s) >= 25 || bmiOf(s) < 18.5,
    event: s => ({ kind:'weight', age:s.age, value: +(24 * (s.height / 100) ** 2).toFixed(1) }) },
  { id:'activity', label:'Exercise 150 min/week', applies: s => s.activity < 150, event: SET_NOW('activity', 150) },
  { id:'alcohol', label:'Cut alcohol to 7 drinks/week', applies: s => s.alcohol > 7, event: SET_NOW('alcohol', 7) },
  { id:'diet', label:'Eat 5 servings of fruit & veg a day', applies: s => s.fruitveg < 5, event: SET_NOW('fruitveg', 5) },
  { id:'sleep', label:'Sleep 7–8 hours', applies: s => s.sleep < 7 || s.sleep >= 9, event: SET_NOW('sleep', 7.5) },
  { id:'bp', label:'Bring blood pressure under 130', applies: s => s.sbp >= 130, event: s => ({ kind:'bp', age:s.age, value:125 }) },
  { id:'social', label:'Build stronger social ties', applies: s => s.social !== 'strong', event: SET_NOW('social', 'strong') },
  { id:'strength', label:'Add 1–2 strength sessions a week', applies: s => s.strength === 'none', event: SET_NOW('strength', '1to2') },
  { id:'sitting', label:'Sit less than 8 hours a day', applies: s => s.sitting !== null && s.sitting > 8, event: SET_NOW('sitting', 7) },
  { id:'nuts', label:'Eat a handful of nuts most days', applies: s => s.nuts === 'rare' || s.nuts === 'weekly', event: SET_NOW('nuts', 'daily') },
  { id:'grains', label:'Switch to whole grains', applies: s => s.grains === 'rare' || s.grains === 'some', event: SET_NOW('grains', 'daily') },
  { id:'meat', label:'Cut processed meat to rarely', applies: s => s.meat === 'weekly' || s.meat === 'daily', event: SET_NOW('meat', 'rare') },
  { id:'sugary', label:'Cut sugary drinks to rarely', applies: s => ['weekly', 'daily', 'twice'].includes(s.sugary), event: SET_NOW('sugary', 'rare') },
];
// A plan with extra events merged in, in date order.
function withEvents(s, extra) { return { ...s, events: sortEvents([...(s.events || []), ...extra]) }; }

