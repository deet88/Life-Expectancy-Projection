// ═══════════════════════════════════════════════════════════════════════════
//  UI: Tools tab — plan-to age, couple, life in weeks, share & save
// ═══════════════════════════════════════════════════════════════════════════
let sumFormat = 'md';
let lastTools = null;   // the inputs of the last render, for the copy buttons

function renderTools(p, full, base, sc, contrib, spots) {
  lastTools = { p, full, base, sc, contrib, spots };
  // Partner: a saved plan, or the national average for an age and sex
  const slots = readSlots();
  if (partner.mode === 'slot' && !slots.some(x => x.name === partner.name)) partner = { ...PARTNER_DEFAULT };
  $('ptMode').innerHTML = '<option value="">Average for their age and sex</option>'
    + slots.map(x => `<option value="${escapeHtml(x.name)}"${partner.mode === 'slot' && partner.name === x.name ? ' selected' : ''}>Saved plan: ${escapeHtml(x.name)}</option>`).join('');
  $('ptSexRow').hidden = $('ptAgeLabel').hidden = partner.mode === 'slot';
  document.querySelectorAll('[data-pt-sex]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ptSex === partner.sex)));
  $('ptAge').value = partner.age;
  const cs = coupleSummary(p, partner.mode === 'slot' ? { plan: slotPlan(partner.name) } : partner);

  // Plan-to ages
  const pt = planToAge(full, p.age), year = new Date().getFullYear(), inYear = a => year + Math.round(a - p.age);
  const card = (lbl, v, sub, key) => `<div class="plan-card${key ? ' key' : ''}"><div class="lbl">${lbl}</div><div class="num">${Math.round(v)}</div>
    <div class="sub">${sub}</div><button type="button" class="btn btn-xs" data-copy="${Math.round(v)}">Copy ${Math.round(v)}</button></div>`;
  const lastAge = t => p.age + t;
  $('planTo').innerHTML = card('Life expectancy', full.le, 'the money runs out for about half of people like you', false)
    + card('Plan to (1 in 10 live longer)', pt.p90, `around ${inYear(pt.p90)}`, true)
    + card('Plan to (1 in 20 live longer)', pt.p95, `around ${inYear(pt.p95)}`, false)
    + card('Couple: last survivor, 1 in 10', lastAge(cs.last.p90), `your age when it happens, around ${year + Math.round(cs.last.p90)}`, false);
  $('planToNote').textContent = 'The FIRE dashboard calls this “Life expectancy” (its planning horizon): enter the plan-to age there, not your life expectancy. The couple figure uses the partner set below.';

  // Couple chart, by your age
  const c = ink(), xs = cs.j.either.map((_, t) => p.age + t);
  const series = (data, label, color, extra) => ({ label, data: data.map((y, i) => ({ x: xs[i], y })), borderColor: color, borderWidth: 2.5, pointRadius: 0, tension: 0.2, ...extra });
  const opts = baseOptions(c);
  opts.scales.x.min = p.age; opts.scales.x.max = MAX_AGE + 1; opts.scales.x.title = { display: true, text: 'Your age', color: c.muted, font: { size: 11 } };
  opts.scales.y.min = 0; opts.scales.y.max = 1; opts.scales.y.ticks.callback = v => Math.round(v * 100) + '%';
  opts.plugins.tooltip.callbacks = { title: items => `You ${items[0].parsed.x}, partner ${items[0].parsed.x - p.age + cs.partnerAge}`, label: item => ` ${item.dataset.label}: ${fmtPct(item.parsed.y)}` };
  drawChart('chCouple', { type: 'line', data: { datasets: [series(cs.j.s1, 'You', c.you), series(cs.j.s2, 'Partner', c.planB),
    series(cs.j.either, 'At least one of you', c.third, { borderWidth: 3, borderDash: [7, 4] })] }, options: opts });
  $('legCouple').innerHTML = `<span><i style="border-color:${c.you}"></i>You</span><span><i style="border-color:${c.planB}"></i>Partner</span><span><i class="dash" style="border-color:${c.third}"></i>At least one of you</span>`;
  let rows = '<tr><th>Your age</th><th>Partner</th><th class="num">You</th><th class="num">Partner</th><th class="num">At least one</th><th class="num">Both</th></tr>';
  for (let t = 5; t < cs.j.either.length; t += 5)
    rows += `<tr><td>${p.age + t}</td><td>${cs.partnerAge + t}</td><td class="num">${fmtPct(cs.j.s1[t])}</td><td class="num">${fmtPct(cs.j.s2[t])}</td><td class="num">${fmtPct(cs.j.either[t])}</td><td class="num">${fmtPct(cs.j.both[t])}</td></tr>`;
  $('tblCouple').innerHTML = rows;
  const t90 = Math.max(0, 90 - p.age);
  $('coupleStats').innerHTML = `<span>Your partner's life expectancy: <b>${fmt1(cs.partnerLE)}</b>${partner.mode === 'slot' ? '' : ' (the national average for their age and sex)'}; yours: <b>${fmt1(cs.youLE)}</b>.</span>
    <span>When you would be 90, the chance at least one of you is alive: <b>${fmtPct(cs.eitherAt(t90))}</b>; both: <b>${fmtPct(cs.bothAt(t90))}</b>.</span>
    <span>Half of couples like you still have one partner alive <b>${fmt1(cs.last.median)} years</b> from now (you would be ${Math.round(p.age + cs.last.median)}); one in ten, after <b>${fmt1(cs.last.p90)} years</b>.</span>
    <span class="hint">Partners' deaths are somewhat linked (shared habits, the strain of bereavement), so the real “at least one” figures are a little lower than independence gives.</span>`;

  // Life in weeks
  drawWeeks(full, p.age);
  // Share card and texts
  drawShareCard($('cvCard'), p, full, base, sc);
  $('sumText').value = shareSummary(p, full, base, sc, contrib, { markdown: sumFormat === 'md', private: $('sumPrivate').checked });
  document.querySelectorAll('[data-sum-fmt]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sumFmt === sumFormat)));
  $('aiText').value = aiPrompt(p, full, base, sc, contrib, spots);
}

function drawWeeks(full, age) {
  const cv = $('cvWeeks'), lw = lifeWeeks(full.S, age), c = ink();
  const cell = 6, gap = 1, step = cell + gap, left = 26, dpr = (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1;
  const W = left + WEEKS_PER_YEAR * step, H = WEEK_YEARS * step;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.aspectRatio = `${W} / ${H}`;
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.font = '9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'; ctx.fillStyle = c.muted; ctx.textBaseline = 'middle';
  for (let y = 0; y < WEEK_YEARS; y += 10) ctx.fillText(String(y), 0, y * step + cell / 2);
  for (let w = 0; w < lw.total; w++) {
    const y = Math.floor(w / WEEKS_PER_YEAR), x = w % WEEKS_PER_YEAR;
    if (w < lw.lived) { ctx.globalAlpha = 1; ctx.fillStyle = c.muted; }
    else { ctx.globalAlpha = Math.max(0.06, lw.alive(w)); ctx.fillStyle = c.you; }
    ctx.fillRect(left + x * step, y * step, cell, cell);
  }
  ctx.globalAlpha = 1;
  const pctLived = lw.lived / (lw.lived + lw.expectedLeft);
  $('weeksNote').innerHTML = `<div><i style="background:${c.muted};border-radius:2px"></i><span>Weeks lived</span><b>${lw.lived.toLocaleString()}</b></div>
    <div><i style="background:${c.you};border-radius:2px"></i><span>Weeks you can expect ahead (before 100)</span><b>${Math.round(lw.expectedLeft).toLocaleString()}</b></div>
    <p class="hint">The stronger the colour, the more likely you are to see that week. About ${Math.round(pctLived * 100)}% of your expected weeks are behind you.</p>`;
}

// 1200 × 630, the size link previews use. Drawn in the current theme.
function drawShareCard(cv, p, full, base, sc) {
  const ctx = cv.getContext('2d'), c = ink(), cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
  const W = 1200, H = 630, font = (w, s) => `${w} ${s}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = v('--bg') || '#0b0d14'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = v('--surface') || '#13151f'; ctx.fillRect(40, 40, W - 80, H - 80);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = c.muted; ctx.font = font(600, 22);
  ctx.fillText(`Life expectancy · ${LIFETABLES.countries[p.country].name} · ${p.sex === 'M' ? 'man' : 'woman'}, ${p.age}`, 80, 100);
  ctx.fillStyle = v('--strong') || '#fff'; ctx.font = font(800, 150); ctx.fillText(fmt1(full.le), 74, 260);
  ctx.fillStyle = c.muted; ctx.font = font(500, 26); ctx.fillText('years, on average, for people like me', 80, 305);
  const d = full.le - base.le, stat = (x, label, value) => { ctx.fillStyle = c.muted; ctx.font = font(600, 18); ctx.fillText(label.toUpperCase(), x, 400);
    ctx.fillStyle = v('--strong') || '#fff'; ctx.font = font(800, 44); ctx.fillText(value, x, 450); };
  stat(80, 'vs national average', signed(d) + ' y'); stat(330, 'Longevity score', String(sc.score)); stat(560, 'Reach 90', fmtPct(full.reach(90)));
  // Mini survival curve
  const bx = 800, by = 110, bw = 320, bh = 340, x = a => bx + (a - p.age) / (MAX_AGE + 1 - p.age) * bw, y = s => by + (1 - s) * bh;
  ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
  const line = (S, color, width) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x(p.age), y(S[p.age]));
    for (let a = p.age + 1; a <= MAX_AGE + 1; a++) ctx.lineTo(x(a), y(S[a]));
    ctx.stroke();
  };
  line(base.S, c.avg, 3); line(full.S, c.you, 5);
  ctx.fillStyle = c.muted; ctx.font = font(500, 16); ctx.fillText('Chance of being alive, by age', bx, by + bh + 30);
  ctx.fillText(`${p.age}`, bx, by + bh + 52); ctx.textAlign = 'right'; ctx.fillText(`${MAX_AGE + 1}`, bx + bw, by + bh + 52); ctx.textAlign = 'left';
  ctx.fillStyle = c.muted; ctx.font = font(500, 18);
  ctx.fillText('UN life table × published hazard ratios for 35 risk factors · not medical advice', 80, H - 70);
}

function copyText(text, btn) {
  const old = btn.textContent, done = t => { btn.textContent = t; setTimeout(() => btn.textContent = old, 1600); };
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => done('Copied'), () => done('Copy failed — select the text'));
  else done('Select the text to copy');
}
function bindTools() {
  $('ptMode').addEventListener('change', e => {
    partner = e.target.value ? { ...partner, mode: 'slot', name: e.target.value } : { mode: 'average', sex: partner.sex, age: partner.age };
    refreshAll();
  });
  $('ptAge').addEventListener('change', e => { const v = Math.round(parseFloat(e.target.value)); if (isFinite(v)) { partner = { ...partner, age: Math.min(100, Math.max(18, v)) }; refreshAll(); } });
  const onClick = ev => {
    const t = ev.target.closest ? ev.target.closest('button') : null;
    if (!t) return;
    if (t.dataset.ptSex) { partner = { ...partner, sex: t.dataset.ptSex }; refreshAll(); }
    else if (t.dataset.copy) copyText(t.dataset.copy, t);
    else if (t.dataset.sumFmt) { sumFormat = t.dataset.sumFmt; refreshAll(); }
    else if (t.id === 'copySum') copyText($('sumText').value, t);
    else if (t.id === 'copyAi') copyText($('aiText').value, t);
    else if (t.id === 'dlCard') { const a = document.createElement('a'); a.href = $('cvCard').toDataURL('image/png'); a.download = 'life-expectancy-card.png'; a.click(); }
    else if (t.id === 'exportJson') download('life-expectancy-plan.json', 'application/json', JSON.stringify(exportPlan(), null, 2));
  };
  ['planToPanel', 'couplePanel', 'sharePanel'].forEach(id => $(id).addEventListener('click', onClick));
  $('sumPrivate').addEventListener('change', refreshAll);
  $('importFile').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const res = importPlan(String(r.result));
      $('jsonMsg').textContent = res.ok ? `Loaded ${f.name}.` : res.error;
      if (res.ok) { syncControls(); refreshAll(); setTab(tab, true); }
      e.target.value = '';
    };
    r.readAsText(f);
  });
}
