// ═══════════════════════════════════════════════════════════════════════════
//  UI
// ═══════════════════════════════════════════════════════════════════════════
const $ = id => document.getElementById(id);
const fmt1 = v => (Math.round(v * 10) / 10).toFixed(1);
const fmtPct = v => Math.round(v * 100) + '%';
// Sign follows the rounded value, so −0.03 reads "0.0", not "−0.0".
const signed = v => { const r = Math.round(v * 10) / 10; return (r > 0 ? '+' : r < 0 ? '−' : '') + fmt1(Math.abs(r)); };
const deltaClass = v => Math.abs(v) < 0.05 ? 'delta-zero' : v > 0 ? 'delta-pos' : 'delta-neg';
const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

function ink() {
  const cs = getComputedStyle(document.documentElement);
  const v = n => cs.getPropertyValue(n).trim();
  return { you: v('--chart-you'), improved: v('--chart-improved'), avg: v('--chart-avg'),
    gain: v('--chart-gain'), loss: v('--chart-loss'), grid: v('--chart-grid'),
    text: v('--text'), muted: v('--muted'), surface: v('--surface') };
}

// Imperial ↔ metric. State is always metric; the imperial inputs are a view.
const CM_PER_IN = 2.54, KG_PER_LB = 0.45359237;
function syncControls() {
  $('inCountry').value = state.country;
  document.querySelectorAll('.mode-btn[data-key]').forEach(b => b.setAttribute('aria-pressed', String(state[b.dataset.key] === b.dataset.val)));
  $('inAge').value = state.age; $('ageOut').textContent = state.age;
  const imp = state.units === 'imperial';
  $('fHeightM').hidden = imp; $('fHeightI').hidden = !imp;
  $('inHeight').value = Math.round(state.height);
  const totIn = Math.round(state.height / CM_PER_IN);
  $('inFeet').value = Math.floor(totIn / 12); $('inInches').value = totIn % 12;
  $('inWeight').value = imp ? Math.round(state.weight / KG_PER_LB) : state.weight;
  $('inWeight').min = imp ? 66 : 30; $('inWeight').max = imp ? 660 : 300; $('inWeight').step = imp ? 1 : 0.5;
  $('weightUnit').textContent = imp ? 'lb' : 'kg';
  $('inSbp').value = state.sbp;
  // Optional numerics: blank means "not entered"
  const opt = (id, v) => { $(id).value = v === null ? '' : v; };
  opt('inWaist', state.waist === null ? null : imp ? Math.round(state.waist / CM_PER_IN) : Math.round(state.waist));
  $('waistUnit').textContent = imp ? 'in' : 'cm';
  opt('inRhr', state.rhr); opt('inVo2', state.vo2max); opt('inGrip', state.grip); opt('inCrp', state.crp);
  opt('inSitting', state.sitting); opt('inPm25', state.pm25);
  $('inPm25').placeholder = `country average ≈ ${PM25_COUNTRY[state.country]}`;
  $('inSrh').value = state.srh;
  $('inSmoke').value = state.smoke; $('inCigs').value = state.cigs; $('inQuit').value = state.quitYears;
  $('fCigs').hidden = state.smoke === 'never' || state.smoke === 'cigar'; $('fQuit').hidden = state.smoke !== 'former';
  $('inActivity').value = state.activity; $('inStrength').value = state.strength; $('inAlcohol').value = state.alcohol;
  $('inFruitveg').value = state.fruitveg; $('inSleep').value = state.sleep;
  $('inNuts').value = state.nuts; $('inGrains').value = state.grains; $('inMeat').value = state.meat;
  $('inSugary').value = state.sugary; $('inCoffee').value = state.coffee;
  document.querySelectorAll('input[type=checkbox][data-key]').forEach(c => c.checked = !!state[c.dataset.key]);
  $('inDiabetes').value = state.diabetes; $('inCopd').value = state.copd; $('inCkd').value = state.ckd;
  $('inMental').value = state.mental; $('inOsa').value = state.osa; $('inDrugs').value = state.drugs;
  $('inEducation').value = state.education; $('inIncome').value = state.income; $('inWork').value = state.work;
  $('inSocial').value = state.social;
  $('inMother').value = state.mother; $('inFather').value = state.father;
}

function onInput(e) {
  const el = e.target, k = el.dataset.key;
  if (!k) return;
  if (el.type === 'checkbox') state[k] = el.checked;
  else if (k === 'feet' || k === 'inches') {
    const ft = parseFloat($('inFeet').value), inch = parseFloat($('inInches').value);
    if (isFinite(ft) && isFinite(inch)) state.height = (ft * 12 + inch) * CM_PER_IN;
  }
  else if (k === 'weight') { const v = parseFloat(el.value); if (isFinite(v)) state.weight = state.units === 'imperial' ? v * KG_PER_LB : v; }
  else if (k === 'waist') { const v = parseFloat(el.value); state.waist = isFinite(v) ? (state.units === 'imperial' ? v * CM_PER_IN : v) : null; }
  else if (k in OPTIONAL_NUM) { const v = parseFloat(el.value); state[k] = isFinite(v) ? v : null; }   // blank clears it
  else if (el.type === 'number' || el.type === 'range') { const v = parseFloat(el.value); if (isFinite(v)) state[k] = v; }
  else state[k] = el.value;
  clampState(state);
  if (k === 'smoke' || k === 'age' || k === 'country') syncControls();  // reveal/hide dependent fields, update readouts
  if (k === 'age') $('ageOut').textContent = state.age;
  refreshAll();
}
function onModeBtn(e) {
  const b = e.currentTarget, k = b.dataset.key;
  if (state[k] === b.dataset.val) return;
  state[k] = b.dataset.val;
  syncControls();
  refreshAll();
}
function resetAll() { state = { ...DEFAULTS }; events = []; syncControls(); refreshAll(); }
function toggleTheme() {
  const t = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
  localStorage.setItem('lifex-theme', t);
  syncThemeBtn();
  refreshAll(); // charts re-render with the new mode's inks
}
function syncThemeBtn() {
  const light = document.documentElement.dataset.theme === 'light';
  $('themeBtn').textContent = light ? '☾ Dark' : '☀ Light';
}

// ── Charts ─────────────────────────────────────────────────────────────────
// Vertical reference lines with a label, driven by options.plugins.markers.items
const markerPlugin = { id: 'markers', afterDatasetsDraw(chart) {
  const items = (chart.options.plugins.markers || {}).items || [];
  const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
  items.forEach((m, i) => {
    const px = x.getPixelForValue(m.x);
    if (!isFinite(px) || px < chart.chartArea.left || px > chart.chartArea.right) return;
    ctx.save();
    ctx.strokeStyle = m.color; ctx.lineWidth = 1; ctx.setLineDash(m.dash || []);
    ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, bottom); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = m.text; ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    // Timeline events sit at the bottom, left-aligned: survival is still near 100% at
    // those ages, so the bottom-left of the chart is the empty part.
    ctx.textAlign = m.align || 'center'; ctx.textBaseline = m.bottom ? 'bottom' : 'top';
    ctx.fillText(m.label, px + (m.align === 'left' ? 4 : 0), m.bottom ? bottom - 4 - (m.row || 0) * 13 : top + 4 + (m.row || 0) * 13);
    ctx.restore();
  });
} };
// Signed value labels at the tip of horizontal bars, in text ink (never the bar colour).
// The labels are precomputed strings: Chart.js treats any function inside plugin
// options as a scriptable option and calls it itself, so a `format` callback here
// would come back as a string and the draw would throw — taking every later
// render in refreshAll down with it.
const barLabelPlugin = { id: 'barLabels', afterDatasetsDraw(chart) {
  const o = chart.options.plugins.barLabels;
  if (!o || !o.labels) return;
  const { ctx } = chart, meta = chart.getDatasetMeta(0), zero = chart.scales.x.getPixelForValue(0);
  ctx.save();
  ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillStyle = o.color; ctx.textBaseline = 'middle';
  meta.data.forEach((bar, i) => {
    const v = chart.data.datasets[0].data[i];
    const right = v >= 0;
    ctx.textAlign = right ? 'left' : 'right';
    ctx.fillText(o.labels[i], (right ? Math.max(bar.x, zero) : Math.min(bar.x, zero)) + (right ? 6 : -6), bar.y);
  });
  ctx.restore();
} };
if (typeof Chart !== 'undefined') Chart.register(markerPlugin, barLabelPlugin);

const charts = {};
function baseOptions(c) {
  return { responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false },
      tooltip: { backgroundColor: c.surface, titleColor: c.text, bodyColor: c.text, borderColor: c.grid, borderWidth: 1,
        padding: 10, titleFont: { weight: '700' } } },
    scales: {
      x: { type: 'linear', grid: { color: c.grid, drawTicks: false }, border: { display: false },
           ticks: { color: c.muted, font: { size: 11 }, maxTicksLimit: 12 } },
      y: { grid: { color: c.grid, drawTicks: false }, border: { display: false }, ticks: { color: c.muted, font: { size: 11 } } } } };
}

function renderSurvival(full, base, imp) {   // imp: the plan without its timeline, when it has one
  const c = ink(), a = state.age;
  const pts = S => { const out = []; for (let x = a; x <= MAX_AGE + 1; x++) out.push({ x, y: S[x] }); return out; };
  const datasets = [
    { label: 'National average', data: pts(base.S), borderColor: c.avg, borderWidth: 2, pointRadius: 0, tension: 0.2, order: 3 },
    { label: 'You', data: pts(full.S), borderColor: c.you, borderWidth: 2.5, pointRadius: 0, tension: 0.2, order: 2 },
  ];
  if (imp) datasets.push({ label: 'If nothing changes', data: pts(imp.S), borderColor: c.improved, borderWidth: 2, borderDash: [6, 4], pointRadius: 0, tension: 0.2, order: 1 });
  // Median markers: one filled dot per series where S crosses 50%, with a surface ring.
  const medDots = [ { x: base.median, y: 0.5, color: c.avg }, { x: full.median, y: 0.5, color: c.you } ];
  if (imp) medDots.push({ x: imp.median, y: 0.5, color: c.improved });
  datasets.push({ label: 'Median age at death', data: medDots.map(d => ({ x: d.x, y: d.y })), showLine: false,
    pointRadius: 5, pointHoverRadius: 6, pointBackgroundColor: medDots.map(d => d.color), pointBorderColor: c.surface, pointBorderWidth: 2, order: 0 });
  const opts = baseOptions(c);
  opts.scales.x.min = a; opts.scales.x.max = MAX_AGE + 1; opts.scales.x.title = { display: true, text: 'Age', color: c.muted, font: { size: 11 } };
  opts.scales.y.min = 0; opts.scales.y.max = 1; opts.scales.y.ticks.callback = v => Math.round(v * 100) + '%';
  opts.plugins.markers = { items: [80, 90, 100].filter(m => m > a).map((m, i) => ({ x: m, label: `${m}: ${fmtPct(full.reach(m))}`, color: c.grid, text: c.muted, row: 0 }))
    // Timeline events: a dashed line at each age, labels staggered so neighbours don't collide.
    .concat(events.filter(e => eventApplies(e, state)).map((e, i) => ({ x: Math.max(e.age, a), label: shortEvent(e, state.units), color: c.improved, text: c.muted, dash: [3, 3], row: i % 3, bottom: true, align: 'left' }))) };
  opts.plugins.tooltip.callbacks = { title: items => `Age ${items[0].parsed.x}`,
    label: item => item.dataset.showLine === false ? null : ` ${item.dataset.label}: ${fmtPct(item.parsed.y)} alive`,
    filter: item => item.dataset.showLine !== false };
  drawChart('chSurv', { type: 'line', data: { datasets }, options: opts });
  $('legSurv').innerHTML = `<span><i style="border-color:${c.you}"></i>You</span><span><i style="border-color:${c.avg}"></i>National average (your age &amp; sex)</span>`
    + (imp ? `<span><i class="dash" style="border-color:${c.improved}"></i>If nothing changes</span>` : '')
    + `<span><i class="sw" style="background:${c.you};border-radius:50%;width:9px;height:9px"></i>Median age at death</span>`;
  // Table twin, every 5 years
  let rows = '<tr><th>Age</th><th class="num">National average</th><th class="num">You</th>' + (imp ? '<th class="num">If nothing changes</th>' : '') + '</tr>';
  for (let x = Math.ceil(a / 5) * 5; x <= MAX_AGE; x += 5) {
    if (x <= a) continue;
    rows += `<tr><td>${x}</td><td class="num">${fmtPct(base.S[x])}</td><td class="num">${fmtPct(full.S[x])}</td>` + (imp ? `<td class="num">${fmtPct(imp.S[x])}</td>` : '') + '</tr>';
  }
  $('tblSurv').innerHTML = rows;
}

function renderTornado(contrib) {
  const c = ink();
  const rows = contrib.rows.slice().sort((p, q) => Math.abs(q.years) - Math.abs(p.years));
  const items = rows.map(r => ({ label: r.label, v: r.years, shown: r.years, color: r.years >= 0 ? c.gain : c.loss }));
  // The axis is scaled to the factors; the interaction bar, which can be large
  // when many favourable factors compound, is clipped to the edge but labelled
  // with its true value so it never squashes the bars that matter.
  const lim = Math.max(1, ...items.map(i => Math.abs(i.v))) * 1.35;
  const inter = contrib.interaction;
  items.push({ label: 'Interaction', v: inter, shown: Math.max(-lim * 0.97, Math.min(lim * 0.97, inter)), color: c.avg });
  const opts = baseOptions(c);
  opts.indexAxis = 'y';
  opts.interaction = { mode: 'nearest', axis: 'y', intersect: false };
  opts.scales.x = { grid: { color: c.grid, drawTicks: false }, border: { display: false },
    ticks: { color: c.muted, font: { size: 11 }, callback: v => signed(v) + ' y' } };
  opts.scales.y = { type: 'category', grid: { display: false }, border: { display: false }, ticks: { color: c.text, font: { size: 11 }, autoSkip: false } };
  opts.scales.x.min = -lim; opts.scales.x.max = lim;
  const labels = items.map(i => signed(i.v) + ' y' + (i.shown !== i.v ? ' (off scale)' : ''));
  opts.plugins.barLabels = { color: c.text, labels };
  opts.plugins.tooltip.callbacks = { label: item => ' ' + labels[item.dataIndex] };
  // 35 factors: let the chart grow with the row count rather than cramming them
  $('chTornado').parentElement.style.height = (items.length * 21 + 60) + 'px';
  drawChart('chTornado', { type: 'bar', data: { labels: items.map(i => i.label),
    datasets: [{ data: items.map(i => i.shown), backgroundColor: items.map(i => i.color), borderRadius: 4, borderSkipped: 'start', maxBarThickness: 14, categoryPercentage: 0.8, barPercentage: 0.9 }] },
    options: opts });
  let html = '<tr><th>Factor</th><th>You</th><th class="num">Years</th></tr>';
  const onTimeline = timelineFactors(plan());
  for (const r of rows) html += `<tr><td>${r.label}</td><td>${escapeHtml(r.value)}${onTimeline.has(r.id) ? ' <span class="tl-tag" title="The years include the changes on your health timeline">changes on timeline</span>' : ''}</td><td class="num ${Math.abs(r.years) < 0.05 ? '' : r.years > 0 ? 'pos' : 'neg'}">${signed(r.years)}</td></tr>`;
  html += `<tr><td>Interaction</td><td><span class="hint">factors multiply, so the bars don't sum exactly</span></td><td class="num">${signed(contrib.interaction)}</td></tr>`;
  html += `<tr><td><b>Total vs average</b></td><td></td><td class="num ${deltaClass(contrib.total).replace('delta-', '')}"><b>${signed(contrib.total)}</b></td></tr>`;
  $('tblTornado').innerHTML = html;
}

function renderDist(full) {
  const c = ink(), a = state.age, S = full.S;
  const pts = [];
  for (let x = a; x <= MAX_AGE; x++) pts.push({ x, y: S[x] - S[x + 1] });
  const opts = baseOptions(c);
  opts.interaction = { mode: 'nearest', axis: 'x', intersect: false };
  opts.scales.x.min = a; opts.scales.x.max = MAX_AGE + 1; opts.scales.x.offset = false;
  opts.scales.x.title = { display: true, text: 'Age at death', color: c.muted, font: { size: 11 } };
  opts.scales.y.ticks.callback = v => (v * 100).toFixed(1) + '%';
  opts.scales.y.beginAtZero = true;
  const pctItems = [ ['P10', full.p10], ['Median', full.median], ['P90', full.p90] ];
  opts.plugins.markers = { items: pctItems.map(([l, v], i) => ({ x: v, label: `${l} ${fmt1(v)}`, color: c.muted, text: c.text, dash: [3, 3], row: 0 })) };
  opts.plugins.tooltip.callbacks = { title: items => `Dies at age ${items[0].parsed.x}`, label: item => ` ${(item.parsed.y * 100).toFixed(1)}% of people like you` };
  drawChart('chDist', { type: 'bar', data: { datasets: [{ data: pts, backgroundColor: c.you, borderRadius: 2, borderSkipped: 'bottom', barPercentage: 1, categoryPercentage: 0.8, maxBarThickness: 14 }] }, options: opts });
  $('pctTiles').innerHTML = [ ['10% die before', full.p10], ['25% die before', full.p25], ['Half die before', full.median], ['75% die before', full.p75], ['90% die before', full.p90], ['Mean (life expectancy)', full.le] ]
    .map(([l, v]) => `<div class="tile"><div class="tile-label">${l}</div><div class="tile-value">${fmt1(v)}</div></div>`).join('');
  let html = '<tr><th>Age band</th><th class="num">Chance of dying in it</th></tr>';
  for (let x = Math.floor(a / 5) * 5; x <= MAX_AGE; x += 5) {
    let p = 0; for (let k = Math.max(x, a); k < x + 5 && k <= MAX_AGE; k++) p += S[k] - S[k + 1];
    html += `<tr><td>${Math.max(x, a)}–${Math.min(x + 4, MAX_AGE)}</td><td class="num">${(p * 100).toFixed(1)}%</td></tr>`;
  }
  $('tblDist').innerHTML = html;
}

function drawChart(id, cfg) {
  const canvas = $(id);
  if (!canvas) return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(canvas.getContext('2d'), cfg);
}

// ── Panels ─────────────────────────────────────────────────────────────────
function renderHero(full, base, contrib, imp, periodLE) {
  const name = LIFETABLES.countries[state.country].name, sexWord = state.sex === 'M' ? 'man' : 'woman';
  $('heroLE').textContent = fmt1(full.le);
  const d = full.le - base.le;
  const lines = [
    `<span>National average for a <b>${state.age}-year-old ${sexWord}</b> in <b>${name}</b>: <b>${fmt1(base.le)}</b> · you: <span class="${deltaClass(d)}">${signed(d)} years</span></span>`,
    `<span>Half of people like you will live past <b>${fmt1(full.median)}</b>; one in ten past <b>${fmt1(full.p90)}</b>. Chance of reaching 90: <b>${fmtPct(full.reach(90))}</b></span>`,
  ];
  if (state.improve) lines.push(`<span>Includes UN-projected mortality improvement: <span class="delta-pos">+${fmt1(full.le - periodLE)} years</span> over today's death rates.</span>`);
  else lines.push(`<span>Assumes today's death rates for the rest of your life. Tick <b>Mortality keeps improving</b> in the sidebar for the cohort figure.</span>`);
  if (imp) lines.push(`<span>Includes your health timeline (${events.length} change${events.length > 1 ? 's' : ''}): <b>${fmt1(imp.le)}</b> if nothing changes, <span class="${deltaClass(full.le - imp.le)}">${signed(full.le - imp.le)} years</span> with them.</span>`);
  $('heroSide').innerHTML = lines.join('');
  $('hsLE').textContent = fmt1(full.le);
  $('hsDelta').textContent = signed(d) + ' y'; $('hsDelta').className = 'hstat-value ' + deltaClass(d);
  $('hsMedian').textContent = fmt1(full.median);
  $('hsP90').textContent = fmtPct(full.reach(90));
}
function renderTiles(full, base) {
  $('tiles').innerHTML = [70, 80, 90, 100].filter(m => m > state.age).map(m => {
    const d = full.reach(m) - base.reach(m);
    return `<div class="tile"><div class="tile-label">Reach ${m}</div><div class="tile-value">${fmtPct(full.reach(m))}</div>
      <div class="tile-sub">average <b>${fmtPct(base.reach(m))}</b> · <span class="${deltaClass(d * 100)}">${(d >= 0 ? '+' : '−') + Math.abs(Math.round(d * 100))} pts</span></div></div>`;
  }).join('') || '<div class="hint">You have already passed every milestone this panel tracks.</div>';
}
// ── Health timeline panel ──────────────────────────────────────────────────
const optKey = v => typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
const optionsHtml = (opts, v) => Object.entries(opts).map(([k, l]) => `<option value="${k}"${k === optKey(v) ? ' selected' : ''}>${l}</option>`).join('');
function eventControls(e, i) {
  const ctl = (prop, label) => `data-ev="${i}" data-prop="${prop}" aria-label="${label}"`;
  const num = (prop, v, step, lo, hi, unit, label) => `<input type="number" ${ctl(prop, label)} value="${v}" step="${step}" min="${lo}" max="${hi}"><span>${unit}</span>`;
  const sel = (prop, opts, v, label) => `<select ${ctl(prop, label)}>${optionsHtml(opts, v)}</select>`;
  if (e.kind === 'quit') return '<span>Quit smoking</span>';
  if (e.kind === 'weight') {
    const imp = state.units === 'imperial';
    return '<span>Reach</span>' + num('value', imp ? Math.round(e.value / KG_PER_LB) : e.value, imp ? 1 : 0.5, imp ? 66 : 30, imp ? 660 : 300, imp ? 'lb' : 'kg', 'Target weight')
      + `<span class="why">BMI ${(e.value / (state.height / 100) ** 2).toFixed(1)} by this age, in a straight line from today</span>`;
  }
  if (e.kind === 'bp') return '<span>Blood pressure</span>' + num('value', e.value, 1, 90, 220, 'mmHg', 'Systolic blood pressure');
  if (e.kind === 'set') {
    const d = TL_SET[e.field], fields = Object.fromEntries(Object.entries(TL_SET).map(([k, v]) => [k, v.label]));
    return sel('field', fields, e.field, 'Habit') + (d.range ? num('value', e.value, e.field === 'sleep' ? 0.5 : 1, d.range[0], d.range[1], d.unit, d.label)
      : sel('value', d.options, e.value, d.label));
  }
  const d = TL_DX[e.field], fields = Object.fromEntries(Object.entries(TL_DX).map(([k, v]) => [k, v.label]));
  return '<span>Diagnosed with</span>' + sel('field', fields, e.field, 'Condition') + (Object.keys(d.options).length > 1 ? sel('value', d.options, e.value, 'Severity') : '');
}
function inertReason(e) {
  if (e.kind === 'quit') return "You don't currently smoke, so this changes nothing.";
  if (e.kind === 'dx') return 'You already have this (or worse), so this changes nothing.';
  return 'Same as your current answer, so this changes nothing.';
}
function renderTimeline(full, still) {
  const solo = still || full;              // no events: "if nothing changes" is you
  $('tlList').innerHTML = events.length ? events.map((e, i) => {
    const live = eventApplies(e, state);
    const alone = live ? summarize({ ...state, events: [e] }).le - solo.le : 0;
    return `<div class="tl-item${live ? '' : ' inert'}">
      <label class="tl-age">at <input type="number" data-ev="${i}" data-prop="age" aria-label="Age" value="${Math.max(e.age, state.age)}" min="${state.age}" max="100" step="1"></label>
      <div class="tl-what">${eventControls(e, i)}${live ? '' : `<span class="why">${inertReason(e)}</span>`}</div>
      <span class="tl-gain ${deltaClass(alone)}" title="Change in life expectancy from this event alone">${live ? signed(alone) + ' y' : '—'}</span>
      <button type="button" class="tl-del" data-del="${i}" aria-label="Remove this event" title="Remove">×</button></div>`;
  }).join('') : '<div class="tl-empty">No changes planned. Add one below, or use a quick change on the right; each is dated today and you can move it to any age.</div>';
  if (still) {
    const d = full.le - still.le;
    $('whatifTotal').innerHTML = `Your timeline takes your life expectancy from <b>${fmt1(still.le)}</b> if nothing changes to <b>${fmt1(full.le)}</b><span class="big ${deltaClass(d)}">${signed(d)} y</span>`;
  } else $('whatifTotal').innerHTML = 'Each change counts from the age you give it, and the survival curve gains a dashed <b>if nothing changes</b> line to compare against.';

  $('whatifNote').innerHTML = '<b>Why individual gains don\'t add up:</b> each figure is the gain from that change alone. Applied together, the factors multiply, and a later change works on a lower remaining risk, so the total is a little less than the sum.'
    + (state.smoke === 'current' ? ' Quitting smoking is modelled as it happens in life: the excess risk fades over the following years, so the earlier you quit, the more of the loss you win back.' : '')
    + (events.some(e => e.kind === 'dx') ? ' <b>A diagnosis on the timeline is a "what if"</b>, not a prediction: your estimate already prices in the average chance of developing each condition, and a dated diagnosis replaces that chance with certainty at that age.' : '')
    + (full.capped && !full.compressed ? ` <b>Your combined risk hit the model's ${MAX_MULT}× cap</b> — beyond that the evidence cannot separate one factor's effect from another, so the per-factor figures on this page are approximate.` : '')
    + (full.compressed ? ` <b>Your combined risk is below half the national average.</b> Combined low-risk profiles have been studied to about that point; beyond it the model counts each further halving of risk as half, and the per-factor bars are scaled to match.` : '');
}
// One set of listeners on the panel (its contents are re-rendered on every refresh).
function onTimelineEdit(el) {
  const i = +el.dataset.ev, prop = el.dataset.prop, e = { ...events[i] };
  if (!events[i]) return;
  if (prop === 'age') e.age = parseFloat(el.value);
  else if (prop === 'value') e.value = e.kind === 'weight' && state.units === 'imperial' ? parseFloat(el.value) * KG_PER_LB : el.value;
  else if (prop === 'field') { if (!(e.kind === 'set' ? TL_SET : e.kind === 'dx' ? TL_DX : {})[el.value]) return; e.field = el.value; e.value = e.kind === 'set' ? TL_SUGGEST[el.value] : Object.keys(TL_DX[el.value].options)[0]; }
  const c = cleanEvent(e);
  if (c) events[i] = c;
  events = sortEvents(events);
  refreshAll();
}
function addEvent(e) {
  const c = cleanEvent(e);
  if (!c || events.length >= TL_MAX_EVENTS) return;
  events = sortEvents([...events, c]);
  refreshAll();
}
function removeEvent(i) { events = events.filter((_, j) => j !== i); refreshAll(); }
function bindTimeline() {
  $('timelinePanel').addEventListener('change', ev => { if (ev.target.dataset.ev !== undefined) onTimelineEdit(ev.target); });
  $('timelinePanel').addEventListener('click', ev => {
    const t = ev.target.closest ? ev.target.closest('button') : ev.target;
    if (!t || !t.dataset) return;
    if (t.dataset.del !== undefined) removeEvent(+t.dataset.del);
    else if (t.id === 'tlAddBtn') addEvent(newEvent($('tlAddKind').value, state));
  });
  $('leversPanel').addEventListener('click', ev => {
    const t = ev.target.closest ? ev.target.closest('button') : ev.target;
    if (t && t.dataset && t.dataset.preset) addEvent(WHATIFS.find(w => w.id === t.dataset.preset).event(state));
  });
}

// ── Longevity score, alerts, levers, lifetimes ─────────────────────────────
function renderScore(sc, lines) {
  $('scoreNum').textContent = sc.score; $('hsScore').textContent = sc.score;
  const scale = Math.max(10, ...sc.pillars.map(p => Math.abs(p.points)));
  const bar = pts => { const w = Math.abs(pts) / scale * 50;
    return `<span class="bar ${pts < 0 ? 'neg' : ''}" style="${pts < 0 ? `right:50%` : `left:50%`};width:${w}%;background:var(${pts < 0 ? '--chart-loss' : '--chart-gain'})"></span>`; };
  const pts = v => (Math.round(v) > 0 ? '+' : Math.round(v) < 0 ? '−' : '') + Math.abs(Math.round(v));
  $('pillars').innerHTML = sc.pillars.map(p => `<div class="pillar" title="${p.label}: ${signed(p.years)} years versus the average (${p.factors.map(id => FACTOR_BY_ID[id].label).join(', ')})">
      <span>${p.label}</span><span class="track">${bar(p.points)}</span><span class="pts">${pts(p.shown)} pts</span></div>`).join('');
  const term = v => (v < 0 ? '− ' : '+ ') + Math.abs(v);
  $('scoreFormula').innerHTML = `Score = 50 + ${SCORE_PER_YEAR} × (years versus the national average) = 50 ${sc.pillars.map(p => term(p.shown)).join(' ')} ${term(sc.interactionShown)} (interaction)`
    + (sc.clamped ? ` = ${Math.round(sc.raw)}, shown as ${sc.score} (the scale stops at 0 and 100).` : ` = ${sc.score}.`)
    + ' Each pillar is the sum of its factors in <i>What each factor is worth</i>.';
  $('bottomLine').innerHTML = lines.map(l => `<span>${escapeHtml(l)}</span>`).join('');
}
function renderAlerts(al, spots) {
  $('alertList').innerHTML = al.length ? al.map(a => `<div class="alert ${a.level}">
      <div class="alert-title"><span>${escapeHtml(a.title)}</span>${a.years !== undefined ? `<span class="yrs ${deltaClass(a.years)}">${signed(a.years)} y</span>` : ''}</div>
      <p>${escapeHtml(a.text)}</p></div>`).join('')
    : '<div class="alert"><div class="alert-title">Nothing costs you more than a few months</div><p>No factor on your profile is worse than the national average by 0.3 years or more.</p></div>';
  const top = spots.slice(0, 4);
  $('blindList').innerHTML = top.length ? top.map(b => `<div class="alert unknown">
      <div class="alert-title"><span>${escapeHtml(b.label)}</span><span class="yrs" title="Life expectancy at a typical good answer minus a typical poor one">± ${fmt1(b.swing / 2)} y</span></div>
      <p>${escapeHtml(b.how)} A typical good answer versus a typical poor one moves your estimate by ${fmt1(b.swing)} years.</p></div>`).join('')
    : '<div class="alert"><div class="alert-title">You have answered everything</div><p>Every optional input is filled in.</p></div>';
}
function renderLevers(lev) {
  $('leverList').innerHTML = lev.length ? '<div class="lever-head"><span>Change</span><span>Alone</span><span>Together</span><span></span></div>'
    + lev.map(l => `<div class="lever"><span>${l.label}</span>
      <span class="gain">${l.gain < 0.05 ? '< 0.1' : '+' + fmt1(l.gain)} y</span>
      <span class="together" title="This and every change above it, together">+${fmt1(l.together)} y</span>
      <button type="button" class="btn" data-preset="${l.id}" aria-label="Add ${l.label} to the timeline">+ Add</button></div>`).join('')
    : '<div class="note-box">Every modifiable factor is already at or beyond its target, or already on your timeline.</div>';
}
function renderLifetimes(full) {
  const lt = lifetimes(full.S, state.age);
  const band = a => LIFETIME_BANDS.findIndex(([lo, hi]) => a >= lo && a < hi) + 1;
  $('dots').innerHTML = lt.ages.map((a, i) => `<span class="dot" style="background:var(--life-${band(a)})" title="Person ${i + 1} of 100: dies at ${Math.floor(a)}"></span>`).join('');
  $('dotsLegend').innerHTML = lt.bands.map((b, i) => `<div><i style="background:var(--life-${i + 1})"></i><span>Die ${b.label}</span><b>${b.n}</b></div>`).join('');
  const reach90 = lt.ages.filter(a => a >= 90).length;
  const first = Math.floor(lt.ages[0]) <= state.age ? 'within the year' : `at about ${Math.floor(lt.ages[0])}`;
  $('dotsNote').textContent = `Of 100 people with your answers, ${reach90} reach 90. The first dies ${first} and the last at about ${Math.floor(lt.ages[99])}. Each dot is a percentile of your survival curve, not a random draw, so the picture is the same every time.`;
}

// ── Tabs ───────────────────────────────────────────────────────────────────
function setTab(t, quiet) {
  if (!TABS.includes(t)) t = 'overview';
  tab = t;
  document.querySelectorAll('[data-tab]').forEach(el => el.hidden = el.dataset.tab !== t);
  document.querySelectorAll('[data-tabbtn]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tabbtn === t)));
  // Charts drawn while their tab was hidden have no size yet.
  Object.values(charts).forEach(c => c && c.resize && c.resize());
  if (!quiet) syncURL(true);
}
function renderGroupSummaries() {
  $('gsumDemo').textContent = `${state.sex === 'M' ? 'Male' : 'Female'}, ${state.age}, ${LIFETABLES.countries[state.country].name}`;
  $('gsumBody').textContent = `BMI ${bmiOf(state).toFixed(1)} · ${state.sbp} mmHg`;
  $('gsumLife').textContent = `${FACTOR_BY_ID.smoking.value(state).split(',')[0]} · ${state.activity} min · ${state.alcohol}/wk`;
  const conds = ['diabetes', 'cvd', 'af', 'copd', 'ckd', 'mental', 'osa', 'drugs'].filter(k => state[k] && state[k] !== 'none').length;
  $('gsumClin').textContent = (conds ? `${conds} condition${conds > 1 ? 's' : ''}` : 'none') + (state.srh !== 'unk' ? ` · ${FACTOR_BY_ID.srh.value(state).toLowerCase()}` : '');
  $('gsumSocial').textContent = `${state.education} yrs · ${FACTOR_BY_ID.social.value(state).toLowerCase()}`;
  const fit = ['vo2max', 'grip', 'sitting'].filter(k => state[k] !== null).length + (state.strength !== 'unk' ? 1 : 0);
  $('gsumFit').textContent = fit ? `${fit} entered` : 'optional';
  const diet = ['nuts', 'grains', 'meat', 'sugary', 'coffee'].filter(k => state[k] !== 'unk').length;
  $('gsumDiet').textContent = `${state.fruitveg} F&V/day` + (diet ? ` · ${diet} more` : '');
  $('bmiOut').textContent = `BMI ${bmiOf(state).toFixed(1)}`;
}

// Factor table in the methodology panel — rendered from FACTORS so it cannot drift.
function renderFactorTable() {
  let html = '<tr><th>Factor</th><th>Hazard ratios</th><th>Reference distribution</th><th>Source</th></tr>';
  for (const f of FACTORS) {
    html += `<tr><td>${f.label}</td><td>${escapeHtml(f.hrText)}</td><td>${escapeHtml(f.distText)}</td><td class="src">${
      f.source.map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${escapeHtml(t)}</a>`).join('<br>')}</td></tr>`;
  }
  $('tblFactors').innerHTML = html;
}

// Live calibration against life-expectancy differences the source papers report.
const CALIBRATIONS = [
  { name: 'Smoking, US man aged 35', ref: 'Jha 2013: ≈ 10 years lost (range 7–12)', lo: 7, hi: 12,
    run: () => diffLE({ ...DEFAULTS, age:35 }, { smoke:'current', cigs:'10to19' }) },
  { name: 'Obesity (BMI 32 vs 23), US man aged 40', ref: 'Prospective Studies Collaboration 2009: 2–4 years lost for BMI 30–35 (accept 1.8–5)', lo: 1.8, hi: 5,
    run: () => diffLE(withBmi({ ...DEFAULTS }, 23), { weight: withBmi({ ...DEFAULTS }, 32).weight }) },
  { name: 'Severe obesity (BMI 42 vs 23), US man aged 40', ref: 'PSC 2009: ≈ 8–10 years lost (accept 6–11)', lo: 6, hi: 11,
    run: () => diffLE(withBmi({ ...DEFAULTS }, 23), { weight: withBmi({ ...DEFAULTS }, 42).weight }) },
  { name: 'Heavy drinking (> 25 drinks/wk vs ≤ 7), aged 40', ref: 'Wood 2018: ≈ 4–5 years lost', lo: 3.5, hi: 5.5,
    run: () => diffLE({ ...DEFAULTS, alcohol:3 }, { alcohol:30 }) },
  // Li's definitions: never smoker, BMI 18.5–25, ≥ 30 min/day activity, moderate
  // alcohol, top-40% diet — versus none of those (so: a smoker who is merely
  // overweight, does under 30 min/day, and eats an average diet).
  { name: 'Five low-risk habits vs none, US man aged 50', ref: 'Li 2018 Circulation: 12.2 years for men, 14.0 for women (accept 10–16)', lo: 10, hi: 16,
    run: () => diffLE(withBmi({ ...DEFAULTS, age:50, activity:300, alcohol:5, fruitveg:5, smoke:'never' }, 23),
                       { ...withBmi({ ...DEFAULTS, age:50 }, 28), activity:60, alcohol:0, fruitveg:2, smoke:'current', cigs:'10to19' }) },
  { name: 'Diabetes + heart attack, US man aged 60', ref: 'Di Angelantonio 2015: 12 years lost with two conditions, on a cohort with a lower death rate than the US table (a constant 3.7× on the US table gives 10; accept 8–15)', lo: 8, hi: 15,
    run: () => diffLE({ ...DEFAULTS, age:60 }, { diabetes:'yes', cvd:true }) },
];
function withBmi(s, bmi) { return { ...s, weight: bmi * (s.height / 100) ** 2 }; }
// The papers compare groups that differ in the named factor(s) and are otherwise
// alike, so every other factor is held at the population average.
const KEY_FACTOR = { smoke:'smoking', cigs:'smoking', weight:'bmi', alcohol:'alcohol', diabetes:'diabetes', cvd:'cvd', activity:'activity', fruitveg:'diet' };
function diffLE(good, badPatch) {
  const vary = new Set(Object.keys(badPatch).map(k => KEY_FACTOR[k]).filter(Boolean));
  const neutral = new Set(FACTORS.map(f => f.id).filter(id => !vary.has(id)));
  return summarize(good, { neutral }).le - summarize({ ...good, ...badPatch }, { neutral }).le;
}
function renderCalibration() {
  $('calib').innerHTML = CALIBRATIONS.map(c => {
    const v = c.run(), ok = v >= c.lo && v <= c.hi;
    return `<div class="calib-card"><div class="cname">${c.name}</div><div class="cval">${fmt1(v)} years <span class="${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✗'}</span></div><div class="cref">${c.ref}</div></div>`;
  }).join('');
}

// ── Export ─────────────────────────────────────────────────────────────────
let last = null;
function exportCsv() {
  if (!last) return;
  const { full, base, imp } = last;
  const lines = ['age,national_average_alive,you_alive' + (imp ? ',if_nothing_changes_alive' : '') + ',your_q'];
  for (let x = state.age; x <= MAX_AGE + 1; x++)
    lines.push([x, base.S[x].toFixed(5), full.S[x].toFixed(5), ...(imp ? [imp.S[x].toFixed(5)] : []), x <= MAX_AGE ? full.q[x].toFixed(6) : ''].join(','));
  download('life-expectancy-survival.csv', 'text/csv', lines.join('\n'));
}
function exportPng() {
  const src = $('chSurv');
  if (!src || !charts.chSurv) return;
  const out = document.createElement('canvas');
  out.width = src.width; out.height = src.height;
  const ctx = out.getContext('2d');
  ctx.fillStyle = ink().surface; ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(src, 0, 0);
  const a = document.createElement('a');
  a.href = out.toDataURL('image/png'); a.download = 'life-expectancy-survival.png'; a.click();
}
function download(name, type, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

