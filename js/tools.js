// ═══════════════════════════════════════════════════════════════════════════
//  Tools — couple survival, a plan-to age, life in weeks. Pure, no DOM.
// ═══════════════════════════════════════════════════════════════════════════

// ── Couple ─────────────────────────────────────────────────────────────────
// Two survival curves, read in years from today. The two lives are treated as
// independent. Real couples' deaths are somewhat correlated (shared habits,
// grief), which makes "at least one alive" a little lower than shown.
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
// The partner: "average" is the national life table for their age and sex;
// otherwise a full plan (a saved plan, or plan B).
const PARTNER_DEFAULT = { mode: 'average', sex: 'F', age: 40 };
function partnerPlan(pt, you) {
  if (pt.plan) return pt.plan;
  return { ...DEFAULTS, country: you.country, sex: pt.sex, age: pt.age, events: [] };
}
function coupleSummary(you, pt) {
  const pp = partnerPlan(pt, you);
  const fy = summarize(you), fp = pt.plan ? summarize(pp) : summarize(pp, { baseline: true });
  const j = jointSurvival(fy.S, you.age, fp.S, pp.age);
  const last = { median: yearsAtPct(j.either, 0.5), p90: yearsAtPct(j.either, 0.1), p95: yearsAtPct(j.either, 0.05) };
  return { j, partnerAge: pp.age, partnerLE: fp.le, youLE: fy.le, last,
    eitherAt: t => t < j.either.length ? j.either[t] : 0, bothAt: t => t < j.both.length ? j.both[t] : 0 };
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
