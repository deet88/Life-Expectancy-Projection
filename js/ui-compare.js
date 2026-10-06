// ═══════════════════════════════════════════════════════════════════════════
//  UI: Plan A vs Plan B, saved plans
// ═══════════════════════════════════════════════════════════════════════════
const KEY_LABELS = { country: 'Country', sex: 'Sex', age: 'Age', units: 'Units', height: 'Height', weight: 'Weight', sbp: 'Blood pressure',
  waist: 'Waist', rhr: 'Resting heart rate', vo2max: 'VO₂max', grip: 'Grip strength', crp: 'hs-CRP', srh: 'Self-rated health',
  smoke: 'Smoking', cigs: 'Cigarettes per day', quitYears: 'Years since quitting', activity: 'Exercise', strength: 'Strength training',
  sitting: 'Sitting time', alcohol: 'Alcohol', sleep: 'Sleep', fruitveg: 'Fruit & vegetables', nuts: 'Nuts', grains: 'Whole grains',
  meat: 'Processed meat', sugary: 'Sugary drinks', coffee: 'Coffee', diabetes: 'Diabetes', cvd: 'Heart attack / stroke',
  af: 'Atrial fibrillation', copd: 'COPD', ckd: 'Kidney disease', mental: 'Mental health', osa: 'Sleep apnoea', drugs: 'Drug dependence',
  education: 'Education', income: 'Household income', work: 'Work', social: 'Social connection', partnered: 'Partnered',
  mother: 'Mother', father: 'Father', pm25: 'Air pollution (PM2.5)', improve: 'Mortality keeps improving' };
const KEY_UNITS = { age: '', height: ' cm', weight: ' kg', sbp: ' mmHg', waist: ' cm', rhr: ' bpm', vo2max: ' ml/kg/min', grip: ' kg',
  crp: ' mg/L', quitYears: ' years', activity: ' min/week', sitting: ' h/day', alcohol: ' drinks/week', sleep: ' h/night',
  fruitveg: ' servings/day', education: ' years', pm25: ' µg/m³' };
// A select's own option text where the sidebar has one, so the wording matches.
function valueText(k, v) {
  if (v === null) return 'not entered';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (k === 'country') return LIFETABLES.countries[v] ? LIFETABLES.countries[v].name : v;
  if (k === 'sex') return v === 'M' ? 'Male' : 'Female';
  if (k === 'units') return v === 'metric' ? 'cm / kg' : 'ft / lb';
  const sel = document.querySelector(`select[data-key="${k}"]`);
  const opt = sel && sel.options ? [...sel.options].find(o => o.value === v) : null;
  if (opt) return opt.textContent.trim();
  return typeof v === 'number' ? (Math.round(v * 10) / 10) + (KEY_UNITS[k] || '') : String(v);
}

function renderCompare(full) {
  const ab = plansAB();
  $('abBar').hidden = !ab; $('planBadge').hidden = !ab; $('cmpIntro').hidden = !!ab; $('cmpActive').hidden = !ab;
  renderSlots();
  if (!ab) {
    $('cmpIntro').innerHTML = `<p class="cmp-lead">Copy your plan into <b>Plan B</b>, change anything — your inputs, your timeline — and see both side by side. Plan A stays as it is.</p>
      <button type="button" class="btn btn-primary" data-cmp="start">⚖ Start comparing</button>`;
    return;
  }
  const ed = compare.editing;
  $('planBadge').textContent = `Editing Plan ${ed}`; $('planBadge').className = 'plan-badge plan-' + ed.toLowerCase();
  document.querySelectorAll('[data-ab]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ab === ed)));
  $('cmpToolbar').innerHTML = `<span class="cmp-editing">You are editing <b>Plan ${ed}</b> — the sidebar and every tab show it.</span>
    <span class="btn-row"><button type="button" class="btn" data-cmp="swap" title="Plan A becomes Plan B and vice versa">⇄ Swap</button>
    <button type="button" class="btn" data-cmp="resetB" title="Make Plan B an exact copy of Plan A again">↺ Reset B to A</button>
    <button type="button" class="btn" data-cmp="keepA" title="Stop comparing and keep Plan A">✓ Keep A</button>
    <button type="button" class="btn" data-cmp="keepB" title="Stop comparing and keep Plan B">✓ Keep B</button></span>`;

  // Scorecard: the plan being edited reuses this refresh's numbers.
  const pA = { ...ab.A.state, events: ab.A.events }, pB = { ...ab.B.state, events: ab.B.events };
  const a = scorecard(pA, ed === 'A' ? full : null), b = scorecard(pB, ed === 'B' ? full : null);
  const yrs = v => fmt1(v), pct = v => fmtPct(v), int = v => String(Math.round(v));
  const intDiff = d => (Math.round(d) > 0 ? '+' : Math.round(d) < 0 ? '−' : '') + Math.abs(Math.round(d));
  // [label, A, B, value format, difference format, difference for the colour]
  const rows = [['Life expectancy', a.le, b.le, yrs, d => signed(d)], ['Longevity score', a.score, b.score, int, intDiff],
    ['Median age at death', a.median, b.median, yrs, d => signed(d)], ['1 in 10 live past', a.p90, b.p90, yrs, d => signed(d)],
    ['Reach 80', a.reach80, b.reach80, pct, d => intDiff(d * 100) + ' pts'], ['Reach 90', a.reach90, b.reach90, pct, d => intDiff(d * 100) + ' pts'],
    ['Reach 100', a.reach100, b.reach100, pct, d => intDiff(d * 100) + ' pts']];
  $('tblScore').innerHTML = '<tr><th></th><th class="num">Plan A</th><th class="num">Plan B</th><th class="num">B − A</th></tr>'
    + rows.map(([label, va, vb, f, fd]) => { const d = vb - va;
      return `<tr><td>${label}</td><td class="num">${f(va)}</td><td class="num">${f(vb)}</td><td class="num ${deltaClass(d).replace('delta-', '')}">${fd(d)}</td></tr>`; }).join('');

  // Both curves, plus the national average for reference
  const c = ink(), age = Math.min(ab.A.state.age, ab.B.state.age);
  const pts = (S, from) => { const out = []; for (let x = from; x <= MAX_AGE + 1; x++) out.push({ x, y: S[x] }); return out; };
  const base = summarize(pA, { baseline: true });
  const datasets = [
    { label: 'National average (Plan A)', data: pts(base.S, ab.A.state.age), borderColor: c.avg, borderWidth: 1.5, pointRadius: 0, tension: 0.2 },
    { label: 'Plan A', data: pts(a.S, ab.A.state.age), borderColor: c.you, borderWidth: 2.5, pointRadius: 0, tension: 0.2 },
    { label: 'Plan B', data: pts(b.S, ab.B.state.age), borderColor: c.planB, borderWidth: 2.5, pointRadius: 0, tension: 0.2 },
  ];
  const opts = baseOptions(c);
  opts.scales.x.min = age; opts.scales.x.max = MAX_AGE + 1; opts.scales.x.title = { display: true, text: 'Age', color: c.muted, font: { size: 11 } };
  opts.scales.y.min = 0; opts.scales.y.max = 1; opts.scales.y.ticks.callback = v => Math.round(v * 100) + '%';
  opts.plugins.tooltip.callbacks = { title: items => `Age ${items[0].parsed.x}`, label: item => ` ${item.dataset.label}: ${fmtPct(item.parsed.y)} alive` };
  drawChart('chCompare', { type: 'line', data: { datasets }, options: opts });
  $('legCompare').innerHTML = `<span><i style="border-color:${c.you}"></i>Plan A · ${fmt1(a.le)}</span><span><i style="border-color:${c.planB}"></i>Plan B · ${fmt1(b.le)}</span><span><i style="border-color:${c.avg}"></i>National average</span>`;

  // What differs
  const d = planDiff();
  let html = '<tr><th>Input</th><th>Plan A</th><th>Plan B</th><th></th></tr>';
  html += d.keys.map(k => `<tr><td>${KEY_LABELS[k]}</td><td>${escapeHtml(valueText(k, ab.A.state[k]))}</td><td>${escapeHtml(valueText(k, ab.B.state[k]))}</td>
    <td><button type="button" class="btn btn-xs" data-reset-key="${k}" title="Set Plan B's ${KEY_LABELS[k].toLowerCase()} back to Plan A's">↺ Use A</button></td></tr>`).join('');
  if (d.onlyA.length || d.onlyB.length) {
    const list = evs => evs.length ? evs.map(e => `${describeEvent(e, ab.B.state.units)} at ${e.age}`).map(escapeHtml).join('<br>') : '—';
    html += `<tr><td>Timeline</td><td>${list(d.onlyA)}</td><td>${list(d.onlyB)}</td>
      <td><button type="button" class="btn btn-xs" data-cmp="events" title="Give Plan B the same timeline as Plan A">↺ Use A</button></td></tr>`;
  }
  if (!d.keys.length && !d.onlyA.length && !d.onlyB.length) html += '<tr><td colspan="4" class="hint">The plans are identical. Switch to Plan B in the sidebar and change something.</td></tr>';
  $('tblDiff').innerHTML = html;
}

function renderSlots() {
  const slots = readSlots();
  $('slotList').innerHTML = slots.length ? slots.map(s => `<div class="slot"><span><b>${escapeHtml(s.name)}</b> <span class="hint">saved ${escapeHtml(s.saved || '')}</span></span>
      <span class="btn-row"><button type="button" class="btn btn-xs" data-slot-load="${escapeHtml(s.name)}" title="Load into the plan you are editing">Load</button>
      <button type="button" class="btn btn-xs" data-slot-del="${escapeHtml(s.name)}" aria-label="Delete ${escapeHtml(s.name)}">×</button></span></div>`).join('')
    : '<p class="hint">No saved plans yet. Saved plans stay in this browser; a copied link carries everything too.</p>';
}

function afterPlanChange() { syncControls(); refreshAll(); syncURL(true); }
function bindCompare() {
  const click = (id, fn) => $(id).addEventListener('click', ev => { const t = ev.target.closest ? ev.target.closest('button') : ev.target; if (t && t.dataset) fn(t); });
  click('comparePanel', t => {
    const op = t.dataset.cmp;
    if (op === 'start') startCompare(); else if (op === 'swap') swapPlans(); else if (op === 'resetB') resetBToA();
    else if (op === 'keepA') keepPlan('A'); else if (op === 'keepB') keepPlan('B'); else if (op === 'events') resetEventsToA();
    else if (t.dataset.resetKey) resetKeyToA(t.dataset.resetKey);
    else return;
    afterPlanChange();
  });
  click('abBar', t => { if (t.dataset.ab) { switchPlan(t.dataset.ab); afterPlanChange(); } });
  click('slotsPanel', t => {
    if (t.id === 'slotSaveBtn') { const name = $('slotName').value; if (saveSlot(name)) { $('slotName').value = ''; renderSlots(); } else $('slotMsg').textContent = name.trim() ? 'This browser is not letting the page store anything.' : 'Give the plan a name first.'; }
    else if (t.dataset.slotLoad) { if (loadSlot(t.dataset.slotLoad)) afterPlanChange(); }
    else if (t.dataset.slotDel) { deleteSlot(t.dataset.slotDel); renderSlots(); }
  });
}
