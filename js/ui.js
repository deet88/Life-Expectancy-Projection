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
function resetAll() { state = { ...DEFAULTS }; whatif = new Set(); syncControls(); refreshAll(); }
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
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(m.label, px, top + 4 + (m.row || 0) * 13);
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

function renderSurvival(full, base, imp) {
  const c = ink(), a = state.age;
  const pts = S => { const out = []; for (let x = a; x <= MAX_AGE + 1; x++) out.push({ x, y: S[x] }); return out; };
  const datasets = [
    { label: 'National average', data: pts(base.S), borderColor: c.avg, borderWidth: 2, pointRadius: 0, tension: 0.2, order: 3 },
    { label: 'You', data: pts(full.S), borderColor: c.you, borderWidth: 2.5, pointRadius: 0, tension: 0.2, order: 2 },
  ];
  if (imp) datasets.push({ label: 'What-if scenario', data: pts(imp.S), borderColor: c.improved, borderWidth: 2, borderDash: [6, 4], pointRadius: 0, tension: 0.2, order: 1 });
  // Median markers: one filled dot per series where S crosses 50%, with a surface ring.
  const medDots = [ { x: base.median, y: 0.5, color: c.avg }, { x: full.median, y: 0.5, color: c.you } ];
  if (imp) medDots.push({ x: imp.median, y: 0.5, color: c.improved });
  datasets.push({ label: 'Median age at death', data: medDots.map(d => ({ x: d.x, y: d.y })), showLine: false,
    pointRadius: 5, pointHoverRadius: 6, pointBackgroundColor: medDots.map(d => d.color), pointBorderColor: c.surface, pointBorderWidth: 2, order: 0 });
  const opts = baseOptions(c);
  opts.scales.x.min = a; opts.scales.x.max = MAX_AGE + 1; opts.scales.x.title = { display: true, text: 'Age', color: c.muted, font: { size: 11 } };
  opts.scales.y.min = 0; opts.scales.y.max = 1; opts.scales.y.ticks.callback = v => Math.round(v * 100) + '%';
  opts.plugins.markers = { items: [80, 90, 100].filter(m => m > a).map((m, i) => ({ x: m, label: `${m}: ${fmtPct(full.reach(m))}`, color: c.grid, text: c.muted, row: 0 })) };
  opts.plugins.tooltip.callbacks = { title: items => `Age ${items[0].parsed.x}`,
    label: item => item.dataset.showLine === false ? null : ` ${item.dataset.label}: ${fmtPct(item.parsed.y)} alive`,
    filter: item => item.dataset.showLine !== false };
  drawChart('chSurv', { type: 'line', data: { datasets }, options: opts });
  $('legSurv').innerHTML = `<span><i style="border-color:${c.you}"></i>You</span><span><i style="border-color:${c.avg}"></i>National average (your age &amp; sex)</span>`
    + (imp ? `<span><i class="dash" style="border-color:${c.improved}"></i>What-if scenario</span>` : '')
    + `<span><i class="sw" style="background:${c.you};border-radius:50%;width:9px;height:9px"></i>Median age at death</span>`;
  // Table twin, every 5 years
  let rows = '<tr><th>Age</th><th class="num">National average</th><th class="num">You</th>' + (imp ? '<th class="num">What-if</th>' : '') + '</tr>';
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
  for (const r of rows) html += `<tr><td>${r.label}</td><td>${escapeHtml(r.value)}</td><td class="num ${Math.abs(r.years) < 0.05 ? '' : r.years > 0 ? 'pos' : 'neg'}">${signed(r.years)}</td></tr>`;
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
  if (imp) lines.push(`<span>With the ticked changes: <b>${fmt1(imp.le)}</b> <span class="delta-pos">(+${fmt1(imp.le - full.le)})</span></span>`);
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
function renderWhatIf(full, imp) {
  const applicable = WHATIFS.filter(w => w.applies(state));
  if (!applicable.length) {
    $('whatifList').innerHTML = '<div class="note-box">Every modifiable factor is already at or beyond its target — there is no single change left to test here.</div>';
    $('whatifTotal').innerHTML = ''; $('whatifNote').innerHTML = '';
    return;
  }
  $('whatifList').innerHTML = applicable.map(w => {
    const alone = summarize(w.apply(state)).le - full.le;
    return `<div class="whatif-item"><label><input type="checkbox" data-wi="${w.id}" ${whatif.has(w.id) ? 'checked' : ''}> ${w.label}</label>
      <span class="gain ${alone < 0.05 ? 'zero' : ''}">${alone < 0.05 ? '< 0.1' : '+' + fmt1(alone)} y</span></div>`;
  }).join('');
  document.querySelectorAll('input[data-wi]').forEach(el => el.addEventListener('change', e => {
    if (e.target.checked) whatif.add(e.target.dataset.wi); else whatif.delete(e.target.dataset.wi);
    refreshAll();
  }));
  if (imp) {
    $('whatifTotal').innerHTML = `Together, the ticked changes take your life expectancy from <b>${fmt1(full.le)}</b> to <b>${fmt1(imp.le)}</b><span class="big">+${fmt1(imp.le - full.le)} y</span>`;
  } else $('whatifTotal').innerHTML = 'Tick one or more changes to see their combined effect and the dashed scenario line on the survival curve.';
  $('whatifNote').innerHTML = '<b>Why individual gains don\'t add up:</b> each line is the gain from that change alone. Applied together, the factors multiply, and a later change works on a lower remaining risk, so the total is a little less than the sum.'
    + (state.smoke === 'current' ? ' Quitting smoking is modelled as it happens in life: the excess risk fades over the following years, so the benefit keeps growing after you quit.' : '')
    + (full.capped && !full.compressed ? ` <b>Your combined risk hit the model's ${MAX_MULT}× cap</b> — beyond that the evidence cannot separate one factor's effect from another, so the per-factor figures on this page are approximate.` : '')
    + (full.compressed ? ` <b>Your combined risk is below half the national average.</b> Combined low-risk profiles have been studied to about that point; beyond it the model counts each further halving of risk as half, and the per-factor bars are scaled to match.` : '');
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
  const lines = ['age,national_average_alive,you_alive' + (imp ? ',whatif_alive' : '') + ',your_q'];
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

