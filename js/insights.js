// ═══════════════════════════════════════════════════════════════════════════
//  Insights — score, alerts, blind spots, levers, lifetimes. Pure, no DOM.
//  Everything here is read off the engine (summarize / contributions), so it
//  reconciles with the headline by construction and cannot drift from it.
// ═══════════════════════════════════════════════════════════════════════════

// ── Longevity Score ────────────────────────────────────────────────────────
// 50 is exactly the national average for your age, sex and country; each year
// of life expectancy above or below it is SCORE_PER_YEAR points, clamped to 0–100.
// Pillars are the tornado's rows summed by factor group, in the same points, so
// pillars + interaction + 50 is the score (before the clamp).
const SCORE_PER_YEAR = 5;
const PILLARS = [
  { id: 'habits',  label: 'Habits',        groups: ['Lifestyle', 'Diet'] },
  { id: 'fitness', label: 'Fitness',       groups: ['Fitness'] },
  { id: 'body',    label: 'Body',          groups: ['Body'] },
  { id: 'health',  label: 'Health',        groups: ['Health'] },
  { id: 'life',    label: 'Life & family', groups: ['Social', 'Family', 'Environment'] },
];
function longevityScore(contrib) {
  const pillars = PILLARS.map(p => {
    const rows = contrib.rows.filter(r => p.groups.includes(FACTOR_BY_ID[r.id].group));
    const years = rows.reduce((t, r) => t + r.years, 0);
    return { id: p.id, label: p.label, years, points: years * SCORE_PER_YEAR, factors: rows.map(r => r.id) };
  });
  const raw = 50 + SCORE_PER_YEAR * contrib.total;
  const interaction = contrib.interaction * SCORE_PER_YEAR;
  // Whole-point terms for display that add up exactly to the rounded score:
  // largest-remainder rounding, so the printed sum is never off by one.
  const shown = wholeParts([...pillars.map(p => p.points), interaction], Math.round(raw) - 50);
  pillars.forEach((p, i) => p.shown = shown[i]);
  return { score: Math.round(Math.min(100, Math.max(0, raw))), raw, clamped: raw < 0 || raw > 100,
    pillars, interaction, interactionShown: shown[shown.length - 1] };
}
function wholeParts(values, total) {
  const out = values.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = values.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0 && k < order.length; k++, left--) out[order[k][1]]++;
  for (let k = order.length - 1; left < 0 && k >= 0; k--, left++) out[order[k][1]]--;
  return out;
}

// ── Blind spots: inputs left "not entered" that could move the estimate most ──
// Each is scored at a typical good and a typical poor answer for someone of your
// age and sex; the gap is how much finding out could move your estimate.
const BLIND_SPOTS = [
  { key: 'vo2max', label: 'Cardiorespiratory fitness (VO₂max)', how: 'A fitness watch’s estimate is fine.',
    unset: s => s.vo2max === null, good: s => ({ vo2max: interp(VO2_NORM[s.sex], s.age) + 7 }), bad: s => ({ vo2max: interp(VO2_NORM[s.sex], s.age) - 7 }) },
  { key: 'grip', label: 'Grip strength', how: 'Any gym, physio or a cheap hand dynamometer can measure it.',
    unset: s => s.grip === null, good: s => ({ grip: interp(GRIP_NORM[s.sex], s.age) + (s.sex === 'M' ? 8 : 5) }), bad: s => ({ grip: interp(GRIP_NORM[s.sex], s.age) - (s.sex === 'M' ? 8 : 5) }) },
  { key: 'waist', label: 'Waist circumference', how: 'A tape measure at the navel.',
    unset: s => s.waist === null, good: s => ({ waist: WAIST_REF[s.sex] - 10 }), bad: s => ({ waist: WAIST_REF[s.sex] + 15 }) },
  { key: 'rhr', label: 'Resting heart rate', how: 'Most watches and phones report it.',
    unset: s => s.rhr === null, good: () => ({ rhr: 58 }), bad: () => ({ rhr: 82 }) },
  { key: 'crp', label: 'hs-CRP (inflammation)', how: 'A routine blood test.',
    unset: s => s.crp === null, good: () => ({ crp: 0.7 }), bad: () => ({ crp: 4 }) },
  { key: 'sitting', label: 'Sitting time', how: 'Rough hours a day is enough.',
    unset: s => s.sitting === null, good: () => ({ sitting: 5 }), bad: () => ({ sitting: 11 }) },
  { key: 'srh', label: 'Self-rated health', how: 'How you would rate your own health.',
    unset: s => s.srh === 'unk', good: () => ({ srh: 'verygood' }), bad: () => ({ srh: 'fair' }) },
  { key: 'strength', label: 'Strength training', how: 'Sessions a week.',
    unset: s => s.strength === 'unk', good: () => ({ strength: '1to2' }), bad: () => ({ strength: 'none' }) },
  ...[['nuts', 'Nuts', 'daily', 'rare'], ['grains', 'Whole grains', 'daily', 'rare'], ['meat', 'Processed meat', 'rare', 'daily'],
      ['sugary', 'Sugary drinks', 'rare', 'daily'], ['coffee', 'Coffee', '3to4', 'none']].map(([key, label, good, bad]) =>
    ({ key, label, how: 'One question in the Diet group.', unset: s => s[key] === 'unk', good: () => ({ [key]: good }), bad: () => ({ [key]: bad }) })),
  { key: 'income', label: 'Household income', how: 'A rough band.',
    unset: s => s.income === 'unk', good: () => ({ income: 'high' }), bad: () => ({ income: 'low' }) },
  { key: 'parents', label: 'Parents’ longevity', how: 'The age your parents reached, or are now.',
    unset: s => s.mother === 'unk' && s.father === 'unk', good: () => ({ mother: 'd_90s', father: 'd_90s' }), bad: () => ({ mother: 'd_lt70', father: 'd_lt70' }) },
  { key: 'pm25', label: 'Local air pollution (PM2.5)', how: 'Your city’s annual average from any air-quality site.',
    unset: s => s.pm25 === null, good: s => ({ pm25: Math.max(2, PM25_COUNTRY[s.country] - 4) }), bad: s => ({ pm25: PM25_COUNTRY[s.country] + 10 }) },
];
function blindSpots(p) {
  return BLIND_SPOTS.filter(b => b.unset(p)).map(b => ({ key: b.key, label: b.label, how: b.how,
    swing: summarize({ ...p, ...b.good(p) }).le - summarize({ ...p, ...b.bad(p) }).le }))
    .sort((a, b) => b.swing - a.swing);
}

// ── Biggest levers: quick changes not yet on the timeline, ranked ──────────
// Each gain is that change alone, started today, on top of the current plan.
// `together` is the top 1, 2, 3 … combined, which shows the diminishing returns.
function levers(p, full) {
  const have = new Set((p.events || []).map(e => e.kind + (e.field || '')));
  const rows = WHATIFS.filter(w => w.applies(p)).map(w => ({ w, e: cleanEvent(w.event(p)) }))
    .filter(r => !have.has(r.e.kind + (r.e.field || '')))
    .map(r => ({ id: r.w.id, label: r.w.label, event: r.e, gain: summarize(withEvents(p, [r.e])).le - full.le }))
    .sort((a, b) => b.gain - a.gain);
  rows.forEach((r, i) => { r.together = summarize(withEvents(p, rows.slice(0, i + 1).map(x => x.event))).le - full.le; });
  return rows;
}

// ── Alerts ─────────────────────────────────────────────────────────────────
// The factors costing the most years versus the average, plus model notes.
const ADVICE = {
  smoking: 'The single largest avoidable risk. Quitting at any age wins back much of the loss — try it on the timeline.',
  bmi: 'Weight is measured against the lowest-risk band (BMI 20–25). A target on the timeline shows what reaching it would be worth.',
  sbp: 'The most treatable risk on this page: lifestyle and medication both move it, and the effect is fast.',
  waist: 'Abdominal fat carries risk on top of BMI.',
  activity: 'Going from little to 150 minutes a week is the biggest step on the activity curve.',
  alcohol: 'Risk rises steeply above about 14 drinks a week.',
  sleep: 'Both short and long sleep carry excess risk.',
  social: 'Loneliness and isolation carry a risk comparable to the classic lifestyle factors.',
  diabetes: 'Diagnosed diabetes is modelled as a lifelong excess risk.',
  prediabetes: 'The estimate already prices in a rising chance of progressing to diabetes. In the Diabetes Prevention Program, weight loss and activity cut progression by 58% (Knowler 2002).',
  drugs: 'Drug dependence is among the largest risks in mid-life.',
  work: 'Unemployment’s excess risk applies during working age.',
};
function adviceFor(id, p) {
  const quit = (p.events || []).find(e => e.kind === 'quit' && eventApplies(e, p));
  if (id === 'smoking' && quit) return `Your timeline has you quitting at ${Math.max(quit.age, p.age)}; the years shown already count that. Quitting sooner is worth more.`;
  if (id === 'diabetes' && p.diabetes === 'pre') return ADVICE.prediabetes;
  return ADVICE[id] || 'Costs you years versus the national average for your age and sex.';
}
function alerts(p, full, contrib) {
  const out = [];
  contrib.rows.filter(r => r.years <= -0.3).sort((a, b) => a.years - b.years).slice(0, 4).forEach(r =>
    out.push({ level: 'risk', factor: r.id, years: r.years, title: `${r.label}: ${r.value}`,
      text: adviceFor(r.id, p) }));
  // Prediabetes always gets its note; if the diabetes row is already listed, that row carries it.
  if (p.diabetes === 'pre' && !out.some(a => a.factor === 'diabetes'))
    out.push({ level: 'risk', factor: 'diabetes', title: 'Prediabetes', text: ADVICE.prediabetes });
  const inert = (p.events || []).filter(e => !eventApplies(e, p));
  if (inert.length)
    out.push({ level: 'note', title: `${inert.length} timeline change${inert.length > 1 ? 's do' : ' does'} nothing`,
      text: inert.map(e => describeEvent(e, p.units)).join('; ') + ' — already your current answer, or not applicable.' });
  if (full.capped && !full.compressed)
    out.push({ level: 'note', title: `Combined risk hit the ${MAX_MULT}× cap`,
      text: 'Beyond that the evidence cannot separate one factor’s effect from another, so per-factor figures are approximate.' });
  if (full.compressed)
    out.push({ level: 'note', title: 'Combined risk below half the national average',
      text: 'Combined low-risk profiles have been studied to about that point; beyond it each further halving of risk counts as half, and the per-factor bars are scaled to match.' });
  return out;
}

// ── 100 lifetimes like yours ───────────────────────────────────────────────
// Person i dies at the (i + ½)-th percentile of the survival curve: an exact
// reading of the distribution, not a random draw.
const LIFETIME_BANDS = [[0, 70, 'before 70'], [70, 80, 'in their 70s'], [80, 90, 'in their 80s'], [90, 100, 'in their 90s'], [100, Infinity, 'at 100 or later']];
function lifetimes(S, age) {
  const ages = Array.from({ length: 100 }, (_, i) => ageAtPct(S, age, 1 - (i + 0.5) / 100));
  const bands = LIFETIME_BANDS.map(([lo, hi, label]) => ({ lo, hi, label, n: ages.filter(a => a >= lo && a < hi).length }));
  return { ages, bands };
}

// ── Bottom line ────────────────────────────────────────────────────────────
function bottomLine(p, full, base, sc, lev, spots, contrib) {
  const d = full.le - base.le, yrs = v => (Math.round(Math.abs(v) * 10) / 10).toFixed(1);
  const lines = [`Your estimate is ${(Math.round(full.le * 10) / 10).toFixed(1)}: ${Math.abs(d) < 0.05 ? 'right at' : yrs(d) + ' years ' + (d > 0 ? 'above' : 'below')} the national average, a Longevity Score of ${sc.score}.`];
  const worst = contrib.rows.slice().sort((a, b) => a.years - b.years)[0];
  if (worst && worst.years <= -0.3) lines.push(`Your biggest drag is ${worst.label.toLowerCase()} (−${yrs(worst.years)} years).`);
  else lines.push('Nothing on your profile costs more than a few months versus the average.');
  if (lev.length && lev[0].gain >= 0.1) lines.push(`Your biggest lever is “${lev[0].label.toLowerCase()}” (+${yrs(lev[0].gain)} years).`);
  if (spots.length && spots[0].swing >= 0.5) lines.push(`Your biggest unknown is ${spots[0].label.split(' (')[0].toLowerCase()}, which could move the estimate by up to ${yrs(spots[0].swing)} years.`);
  return lines;
}
