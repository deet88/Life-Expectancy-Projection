// ═══════════════════════════════════════════════════════════════════════════
//  Onboarding data — example profiles, Quick Start questions, the tour. No DOM.
// ═══════════════════════════════════════════════════════════════════════════

// ── Example profiles ───────────────────────────────────────────────────────
// Illustrative people, not averages. Loading one keeps your country and units.
const ARCHETYPES = [
  { id: 'middle40', label: 'Middle-of-the-road, 40', blurb: 'A bit overweight, some exercise, a few drinks a week.',
    state: { age: 40, weight: 86, sbp: 122, activity: 90, alcohol: 5, fruitveg: 2, sleep: 7 } },
  { id: 'desk45', label: 'Desk worker, 45', blurb: 'Long hours sitting, little exercise, short sleep.',
    state: { age: 45, weight: 90, sbp: 132, activity: 30, sitting: 11, strength: 'none', alcohol: 12, sleep: 6, fruitveg: 2 } },
  { id: 'quitter45', label: 'Smoker with a plan, 45', blurb: 'Smokes today; plans to quit next year, start exercising and lose 10 kg.',
    state: { age: 45, smoke: 'current', cigs: '10to19', weight: 92, sbp: 130, activity: 40, alcohol: 14 },
    events: [{ kind: 'quit', age: 46 }, { kind: 'set', age: 46, field: 'activity', value: 150 }, { kind: 'weight', age: 48, value: 82 }] },
  { id: 'athlete35', label: 'Endurance athlete, 35', blurb: 'Seven hours of training a week, measured VO₂max.',
    state: { age: 35, weight: 68, sbp: 115, activity: 420, strength: '1to2', vo2max: 55, rhr: 50, sleep: 8, fruitveg: 6, alcohol: 3 } },
  { id: 'exsmoker58', label: 'Ex-smoker, 58', blurb: 'Quit eight years ago after a pack a day; prediabetes.',
    state: { age: 58, smoke: 'former', cigs: 'ge20', quitYears: 8, weight: 84, sbp: 138, activity: 120, alcohol: 8, diabetes: 'pre' } },
  { id: 'diabetes62', label: 'Type 2 diabetes, 62', blurb: 'Diagnosed diabetes, high blood pressure, BMI 33.',
    state: { age: 62, sex: 'F', height: 163, weight: 88, sbp: 142, diabetes: 'yes', activity: 60, fruitveg: 2, social: 'moderate' } },
  { id: 'active75', label: 'Active 75-year-old woman', blurb: 'Walks daily, strong friendships, mother reached her 90s.',
    state: { age: 75, sex: 'F', height: 162, weight: 62, sbp: 135, activity: 150, social: 'strong', partnered: false, work: 'notworking', mother: 'd_90s' } },
];
function archetypePlan(id, keep) {
  const a = ARCHETYPES.find(x => x.id === id);
  if (!a) return null;
  const s = clampState({ ...DEFAULTS, country: keep.country, units: keep.units, ...a.state });
  return { state: s, events: sortEvents((a.events || []).map(cleanEvent).filter(Boolean)) };
}

// ── Quick Start ────────────────────────────────────────────────────────────
// Four short steps; everything not asked stays "not entered" (the population
// average). Answers are metric; the dialog converts imperial entries.
const QS_STEPS = [
  { title: 'The basics', intro: 'Your country sets the baseline life table; age and sex pick the row.',
    fields: [{ key: 'country', type: 'country', label: 'Country' }, { key: 'sex', type: 'seg', label: 'Sex', options: [['M', 'Male'], ['F', 'Female']] },
             { key: 'age', type: 'number', label: 'Age', min: 18, max: 100, step: 1 }] },
  { title: 'Body', intro: 'Leave blood pressure blank if you don’t know it — the typical reading for your age is used.',
    fields: [{ key: 'units', type: 'seg', label: 'Units', options: [['metric', 'cm / kg'], ['imperial', 'ft / lb']] },
             { key: 'height', type: 'height', label: 'Height' }, { key: 'weight', type: 'weight', label: 'Weight' },
             { key: 'sbp', type: 'number', label: 'Systolic blood pressure', unit: 'mmHg', min: 90, max: 220, step: 1, optional: true }] },
  { title: 'Habits', intro: 'Rough answers are fine; you can refine everything in the sidebar afterwards.',
    fields: [{ key: 'smoke', type: 'select', label: 'Smoking', options: [['never', 'Never smoked'], ['former', 'Former smoker'], ['current', 'Current smoker'], ['cigar', 'Cigars or pipe only']] },
             { key: 'cigs', type: 'select', label: 'Cigarettes per day (now, or before quitting)', options: [['lt10', 'Under 10'], ['10to19', '10 – 19'], ['ge20', '20 or more']], show: a => a.smoke === 'former' || a.smoke === 'current' },
             { key: 'quitYears', type: 'number', label: 'Years since quitting', min: 0, max: 80, step: 1, show: a => a.smoke === 'former' },
             { key: 'activity', type: 'number', label: 'Exercise', unit: 'min/week', min: 0, max: 2000, step: 10 },
             { key: 'alcohol', type: 'number', label: 'Alcohol', unit: 'drinks/week', min: 0, max: 80, step: 1 },
             { key: 'sleep', type: 'number', label: 'Sleep', unit: 'h/night', min: 3, max: 12, step: 0.5 }] },
  { title: 'Health & people', intro: 'Conditions a doctor has diagnosed, and the people around you.',
    fields: [{ key: 'diabetes', type: 'select', label: 'Diabetes', options: [['none', 'No'], ['pre', 'Prediabetes'], ['yes', 'Type 2 diabetes']] },
             { key: 'cvd', type: 'check', label: 'Had a heart attack or stroke' },
             { key: 'af', type: 'check', label: 'Atrial fibrillation' },
             { key: 'social', type: 'select', label: 'Social connection', options: [['strong', 'Strong — regular contact'], ['moderate', 'Moderate — sometimes lonely'], ['isolated', 'Isolated — often lonely']] },
             { key: 'partnered', type: 'check', label: 'Married or living with a partner' }] },
];
const QS_KEYS = QS_STEPS.flatMap(st => st.fields.map(f => f.key));
// Answers → a full profile. Unasked inputs keep their defaults ("not entered").
function quickStartState(ans) {
  const s = { ...DEFAULTS };
  for (const k of QS_KEYS) if (ans[k] !== undefined && ans[k] !== null && ans[k] !== '') s[k] = ans[k];
  if (!LIFETABLES.countries[s.country]) s.country = DEFAULTS.country;
  for (const k of ['sex', 'units', 'smoke', 'cigs', 'diabetes', 'social']) if (!CHOICES[k].includes(s[k])) s[k] = DEFAULTS[k];
  for (const k of ['age', 'height', 'weight', 'sbp', 'quitYears', 'activity', 'alcohol', 'sleep']) { s[k] = +s[k]; if (!isFinite(s[k])) s[k] = DEFAULTS[k]; }
  for (const k of ['cvd', 'af', 'partnered']) s[k] = !!s[k];
  if (ans.sbp === undefined || ans.sbp === null || ans.sbp === '') s.sbp = Math.round(interp(SBP_MEDIAN, +s.age || DEFAULTS.age));
  return clampState(s);
}

// ── Tour ───────────────────────────────────────────────────────────────────
const TOUR = [
  { target: '.sidebar', title: 'Your details', text: 'Everything recalculates as you type. Optional inputs left blank count as exactly average for your age and sex, so they never hurt you.' },
  { target: '.header-stats', title: 'The headline numbers', text: 'Life expectancy, Longevity Score and the chance of reaching 90 stay in view on every tab.' },
  { target: '#scorePanel', tab: 'overview', title: 'Longevity score', text: '50 is exactly the national average for your age, sex and country. The pillars add up to the score, and the bottom line names your biggest drag, lever and unknown.' },
  { target: '#alertsPanel', tab: 'factors', title: 'Alerts & blind spots', text: 'What costs you most, and which unanswered questions could move your estimate the most.' },
  { target: '#leversPanel', tab: 'timeline', title: 'Levers and your timeline', text: 'Ranked changes you could make. Add one, then move it to the age you would actually do it.' },
  { target: '#comparePanel', tab: 'compare', title: 'Plan A vs Plan B', text: 'Copy your plan into B, change anything, and see both side by side. Save plans to come back to them.' },
];
