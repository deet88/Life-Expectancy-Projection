// ═══════════════════════════════════════════════════════════════════════════
//  Tools — couple survival, a plan-to age, life in weeks. Pure, no DOM.
// ═══════════════════════════════════════════════════════════════════════════

// ── Couple ─────────────────────────────────────────────────────────────────
// Independent lives: two survival curves combined. The linked model below must
// reproduce this exactly when the widowhood effect is switched off.
function jointSurvival(S1, age1, S2, age2) {
  const years = MAX_AGE + 1 - Math.min(age1, age2);
  const at = (S, a, t) => a + t > MAX_AGE + 1 ? 0 : S[a + t];
  const both = [], either = [], s1 = [], s2 = [];
  for (let t = 0; t <= years; t++) {
    const p = at(S1, age1, t), q = at(S2, age2, t);
    s1.push(p); s2.push(q); both.push(p * q); either.push(1 - (1 - p) * (1 - q));
  }
  return { both, either, s1, s2 };
}
// Years from today until a curve (indexed by years from today) falls to `pct`.
function yearsAtPct(curve, pct) {
  for (let t = 0; t < curve.length - 1; t++)
    if (curve[t + 1] <= pct) return t + (curve[t] - pct) / ((curve[t] - curve[t + 1]) || 1);
  return curve.length - 1;
}

// The widowhood effect: a survivor's death rate relative to someone still
// married, by the survivor's sex (Moon et al. 2011, meta-analysis of 15 cohorts:
// men 1.22, women 1.03). It is highest in the first months (1.41 within six
// months, 1.14 after, against 1.12 overall), so the first year after the loss
// carries the average of those two, relative to the overall figure.
const WIDOW_HR = { M: 1.22, F: 1.03 };
const WIDOW_FIRST_YEAR = (1.41 + 1.14) / 2 / 1.12;

// The partner. "average": the average partnered person of that age and sex in
// your country. "custom": the answers you gave about them. "slot": a saved plan.
const PARTNER_DEFAULT = { mode: 'average', sex: 'F', age: 40, widowhood: true, since: null };
const PARTNER_FORM_KEYS = ['height', 'weight', 'sbp', 'smoke', 'cigs', 'quitYears', 'activity', 'alcohol', 'sleep', 'diabetes', 'cvd', 'af'];
function partnerPlan(pt, you) {
  if (pt.mode === 'slot') return pt.plan;
  const base = { ...DEFAULTS, country: you.country, sex: pt.sex, age: pt.age, events: [] };
  if (pt.mode === 'custom') for (const k of PARTNER_FORM_KEYS) if (pt.state && k in pt.state) base[k] = pt.state[k];
  return base;
}
// A described partner starts as a plain, middle-of-the-road person of that sex and
// age (BMI 25, the typical blood pressure for the age); the form then edits it.
function partnerStarter(sex, age) {
  const height = sex === 'F' ? 163 : 177;
  return { height, weight: Math.round(25 * (height / 100) ** 2), sbp: Math.round(interp(SBP_MEDIAN, age)), smoke: 'never', cigs: 'lt10',
    quitYears: 5, activity: 150, alcohol: 3, sleep: 7, diabetes: 'none', cvd: false, af: false };
}
// In the couple both people are partnered while both are alive, so any
// partnership change on either timeline is set aside here.
const asPartnered = s => ({ ...s, partnered: true, events: (s.events || []).filter(e => e.field !== 'partnered') });
const allButPartnered = () => new Set(FACTORS.map(f => f.id).filter(id => id !== 'partnered'));

// Both lives year by year from today, linked by the widowhood effect: while both
// are alive each has their own (partnered) death rate; after one dies, the
// survivor's rate is raised by WIDOW_HR for their sex (more in the first year).
function coupleModel(you, pt, { widowhood = true } = {}) {
  const yy = asPartnered(you), pp = asPartnered(partnerPlan(pt, you));
  const q1 = adjustedQ(yy), q2 = adjustedQ(pp, pt.mode === 'average' ? { neutral: allButPartnered() } : {});
  const qAt = (q, a) => a > MAX_AGE ? 1 : q[a];
  const raise = (q, m) => 1 - Math.pow(1 - q, m);               // the death rate × m, as a yearly probability
  const W1 = widowhood ? WIDOW_HR[yy.sex] : 1, W2 = widowhood ? WIDOW_HR[pp.sex] : 1, F = widowhood ? WIDOW_FIRST_YEAR : 1;
  const T = MAX_AGE + 2 - Math.min(yy.age, pp.age);
  const both = [1], onlyYou = [0], onlyPartner = [0], youWidowed = [], partnerWidowed = [];
  let newY = 0, oldY = 0, newP = 0, oldP = 0, tie = 0;           // survivors in their first year of widowhood, and later
  for (let t = 0; t < T; t++) {
    const a = qAt(q1, yy.age + t), b = qAt(q2, pp.age + t), bt = both[t];
    const wy = bt * (1 - a) * b, wp = bt * a * (1 - b);         // widowed during this year
    tie += bt * a * b;
    youWidowed.push(wy); partnerWidowed.push(wp);
    const oy = newY * (1 - raise(a, W1 * F)) + oldY * (1 - raise(a, W1));
    const op = newP * (1 - raise(b, W2 * F)) + oldP * (1 - raise(b, W2));
    newY = wy; oldY = oy; newP = wp; oldP = op;
    both.push(bt * (1 - a) * (1 - b)); onlyYou.push(newY + oldY); onlyPartner.push(newP + oldP);
  }
  const youAlive = both.map((v, t) => v + onlyYou[t]), partnerAlive = both.map((v, t) => v + onlyPartner[t]);
  const either = both.map((v, t) => v + onlyYou[t] + onlyPartner[t]);
  const sumFrom1 = arr => arr.slice(1).reduce((x, y) => x + y, 0);
  // The age you would most likely be if you are the one left: the median of
  // "widowed during year t", given that it happens at all (deaths mid-year).
  const medianAge = (w, age) => { const tot = w.reduce((x, y) => x + y, 0); let c = 0;
    for (let t = 0; t < w.length; t++) { if (c + w[t] >= tot / 2) return age + t + (tot / 2 - c) / (w[t] || 1); c += w[t]; } return age + w.length; };
  return {
    youAge: yy.age, partnerAge: pp.age, partnerSex: pp.sex, both, onlyYou, onlyPartner, youAlive, partnerAlive, either,
    youLE: yy.age + sumFrom1(youAlive) + 0.5, partnerLE: pp.age + sumFrom1(partnerAlive) + 0.5,
    youOutlive: youWidowed.reduce((x, y) => x + y, 0) + tie / 2, partnerOutlives: partnerWidowed.reduce((x, y) => x + y, 0) + tie / 2,
    yearsTogether: sumFrom1(both) + 0.5, yearsAloneYou: sumFrom1(onlyYou), yearsAlonePartner: sumFrom1(onlyPartner),
    // Years alone *if* that person is the one left: the averages above include
    // the cases where they die first (and are alone for no years at all).
    youLeft: youWidowed.reduce((x, y) => x + y, 0), partnerLeft: partnerWidowed.reduce((x, y) => x + y, 0),
    aloneIfYouOutlive: sumFrom1(onlyYou) / (youWidowed.reduce((x, y) => x + y, 0) || 1),
    aloneIfPartnerOutlives: sumFrom1(onlyPartner) / (partnerWidowed.reduce((x, y) => x + y, 0) || 1),
    widowedAgeYou: medianAge(youWidowed, yy.age), widowedAgePartner: medianAge(partnerWidowed, pp.age),
    last: { median: yearsAtPct(either, 0.5), p90: yearsAtPct(either, 0.1), p95: yearsAtPct(either, 0.05) },
    at: (arr, t) => t < arr.length ? arr[t] : 0,
  };
}
// Chance you are both alive for each upcoming anniversary.
const ANNIVERSARIES = [10, 20, 25, 30, 40, 50, 60, 70];
function anniversaries(m, since, thisYear) {
  return ANNIVERSARIES.map(n => ({ n, year: since + n, t: since + n - thisYear }))
    .filter(x => x.t >= 0 && x.t < m.both.length).map(x => ({ ...x, both: m.both[x.t] })).slice(0, 4);
}

// ── Plan-to age (for retirement money) ─────────────────────────────────────
// Planning to your life expectancy means a coin-flip chance of outliving the
// money. The usual advice is to plan to an age you have only a 1-in-10 or
// 1-in-20 chance of passing: the 90th or 95th percentile of age at death.
function planToAge(full, age) {
  return { p75: full.p75, p90: full.p90, p95: ageAtPct(full.S, age, 0.05) };
}

// ── Life in weeks ──────────────────────────────────────────────────────────
// One cell per week from birth to 100: lived, or the chance you are alive then.
const WEEKS_PER_YEAR = 52, WEEK_YEARS = 100;
function lifeWeeks(S, age) {
  const lived = age * WEEKS_PER_YEAR;
  const alive = w => {           // P(alive at week w), interpolating between whole years
    const x = w / WEEKS_PER_YEAR;
    if (x <= age) return 1;
    const i = Math.floor(x), f = x - i;
    if (i + 1 > MAX_AGE + 1) return 0;
    return S[i] + (S[i + 1] - S[i]) * f;
  };
  let expected = 0;
  for (let w = lived; w < WEEKS_PER_YEAR * WEEK_YEARS; w++) expected += alive(w);
  return { lived, total: WEEKS_PER_YEAR * WEEK_YEARS, alive, expectedLeft: expected };
}
