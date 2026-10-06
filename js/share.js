// ═══════════════════════════════════════════════════════════════════════════
//  Share & save — text summary, an AI-review prompt, JSON export/import. No DOM
//  apart from valueText's option lookup (js/ui-compare.js).
// ═══════════════════════════════════════════════════════════════════════════
const r1 = v => (Math.round(v * 10) / 10).toFixed(1);
const sgn = v => (Math.round(v * 10) / 10 > 0 ? '+' : Math.round(v * 10) / 10 < 0 ? '−' : '') + r1(Math.abs(v));
const pctOf = v => Math.round(v * 100) + '%';

// Rows of the tornado worth mentioning, biggest first.
function notableRows(contrib, n) {
  return contrib.rows.filter(r => Math.abs(r.years) >= 0.1).sort((a, b) => Math.abs(b.years) - Math.abs(a.years)).slice(0, n);
}

// A short summary for a forum post or a message. `private` leaves out age and
// measurements; `markdown` adds bold and bullets.
function shareSummary(p, full, base, sc, contrib, { markdown = true, private: priv = false } = {}) {
  const b = t => markdown ? `**${t}**` : t, li = markdown ? '- ' : '• ';
  const who = `${LIFETABLES.countries[p.country].name}, ${p.sex === 'M' ? 'man' : 'woman'}` + (priv ? '' : `, ${p.age}`);
  const gains = notableRows(contrib, 12).filter(r => r.years > 0).slice(0, 3), costs = notableRows(contrib, 12).filter(r => r.years < 0).slice(0, 3);
  const row = r => `${r.label} ${sgn(r.years)} y` + (priv ? '' : ` (${r.value})`);
  const lines = [
    `${b('My life-expectancy estimate')} (${who})`,
    `${li}Life expectancy: ${b(r1(full.le))} — national average ${r1(base.le)}, ${sgn(full.le - base.le)} years`,
    `${li}Longevity Score: ${b(String(sc.score))}/100 (50 = national average)`,
    `${li}Half of people like me live past ${r1(full.median)}; chance of reaching 90: ${pctOf(full.reach(90))}, 100: ${pctOf(full.reach(100))}`,
  ];
  if (gains.length) lines.push(`${li}Biggest gains: ${gains.map(row).join(', ')}`);
  if (costs.length) lines.push(`${li}Biggest costs: ${costs.map(row).join(', ')}`);
  if (p.events && p.events.length) lines.push(`${li}Planned changes: ${p.events.map(e => describeEvent(e, p.units) + (priv ? '' : ` at ${Math.max(e.age, p.age)}`)).join('; ')}`);
  lines.push('', (markdown ? '_' : '') + 'A life-table model: UN World Population Prospects 2024 × published hazard ratios for 35 risk factors. Not medical advice.' + (markdown ? '_' : ''));
  return lines.join('\n');
}

// A prompt to paste into an AI assistant for a second opinion on the inputs.
function aiPrompt(p, full, base, sc, contrib, spots) {
  const answered = KEYS.filter(k => p[k] !== DEFAULTS[k] || ['country', 'sex', 'age', 'height', 'weight', 'sbp'].includes(k)).filter(k => p[k] !== null && p[k] !== 'unk' && k !== 'units');
  return [
    'I used a life-expectancy calculator. It starts from the UN World Population Prospects 2024 life table for my country and sex, and multiplies the death rate at each future age by published hazard ratios for 35 risk factors. The ratios are re-anchored so that an average person reproduces the national table, lifestyle effects fade after 60, and the combined effect is capped. Inputs I left blank count as average.',
    '', 'My inputs:',
    ...answered.map(k => `- ${KEY_LABELS[k]}: ${valueText(k, p[k])}`),
    ...(p.events && p.events.length ? ['', 'Changes I am planning (or testing) on a timeline:', ...p.events.map(e => `- ${describeEvent(e, p.units)} at age ${Math.max(e.age, p.age)}`)] : []),
    ...(spots.length ? ['', `Left blank: ${spots.map(s => s.label).join(', ')}.`] : []),
    '', 'Results:',
    `- Life expectancy ${r1(full.le)} (national average for my age and sex: ${r1(base.le)}).`,
    `- Age at death: 10% before ${r1(full.p10)}, median ${r1(full.median)}, 10% after ${r1(full.p90)}.`,
    `- Longevity Score ${sc.score}/100, where 50 is the national average and each year is 5 points.`,
    `- Years each factor adds or costs versus average: ${notableRows(contrib, 8).map(r => `${r.label} ${sgn(r.years)}`).join('; ')}.`,
    '', 'Please:',
    '1. Point out anything in my inputs or results that looks inconsistent or implausible.',
    '2. Tell me which of my blank inputs would be most worth measuring, and how to measure them cheaply.',
    '3. Name important risks this kind of model leaves out for someone like me.',
    '4. Suggest the changes most likely to add healthy years, with how strong the evidence is for each.',
    'This is for general education; I understand it is not a diagnosis.',
  ].join('\n');
}

// ── JSON: the same compact string as the link, so import is link-validated ──
const EXPORT_APP = 'life-expectancy-dashboard', EXPORT_VERSION = 1;
function exportPlan() {
  return { app: EXPORT_APP, version: EXPORT_VERSION, exported: new Date().toISOString().slice(0, 10),
    link: stateToHash(), readable: { ...state, events } };   // `readable` is for people; import ignores it
}
function importPlan(text) {
  let o;
  try { o = JSON.parse(text); } catch (e) { return { ok: false, error: 'That file isn’t JSON.' }; }
  if (!o || o.app !== EXPORT_APP || typeof o.link !== 'string') return { ok: false, error: 'That isn’t a plan exported from this dashboard.' };
  if (o.version !== EXPORT_VERSION) return { ok: false, error: `That file is from version ${o.version}; this page reads version ${EXPORT_VERSION}.` };
  if (!applyHash('#' + o.link)) { state = { ...DEFAULTS }; events = []; compare = null; }   // an empty link is the default plan
  return { ok: true };
}
