// ═══════════════════════════════════════════════════════════════════════════
//  UI: Tools tab — plan-to age, couple, life in weeks, share & save
// ═══════════════════════════════════════════════════════════════════════════
let sumFormat = 'md';
let lastTools = null;   // the inputs of the last render, for the copy buttons

function renderTools(p, full, base, sc, contrib, spots) {
  lastTools = { p, full, base, sc, contrib, spots };
  // ── Partner controls ──
  const slots = readSlots();
  if (partner.mode === 'slot' && !slots.some(x => x.name === partner.name)) partner = { ...partner, mode: 'average' };
  const opt = (v, l) => `<option value="${escapeHtml(v)}"${ptModeValue() === v ? ' selected' : ''}>${l}</option>`;
  $('ptMode').innerHTML = opt('average', 'Average for their age and sex') + opt('custom', 'Describe them…')
    + slots.map(x => opt('slot:' + x.name, `Saved plan: ${escapeHtml(x.name)}`)).join('');
  $('ptSexRow').hidden = $('ptAgeLabel').hidden = partner.mode === 'slot';
  document.querySelectorAll('[data-pt-sex]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ptSex === partner.sex)));
  $('ptAge').value = partner.age; $('ptSince').value = partner.since || ''; $('ptSince').max = BASE_YR; $('ptWidow').checked = partner.widowhood;
  $('ptForm').hidden = partner.mode !== 'custom';
  if (partner.mode === 'custom') {
    const ans = { units: p.units, ...partner.state };
    $('ptForm').innerHTML = QS_STEPS.flatMap(st => st.fields).filter(f => PARTNER_FORM_KEYS.includes(f.key)).map(f => formField(f, ans, 'pf')).join('');
  }
  const pt = partner.mode === 'slot' ? { mode: 'slot', plan: slotPlan(partner.name) } : partner;
  const m = coupleModel(p, pt, { widowhood: partner.widowhood });
  const ind = partner.widowhood ? coupleModel(p, pt, { widowhood: false }) : m;
  $('ptNote').textContent = (p.partnered ? '' : 'Your sidebar says you are not partnered; here you are, of course. ')
    + (partner.mode === 'average' ? 'An average partner is the average partnered person of that age and sex in your country.' : '');

  // ── Plan-to ages ──
  const pta = planToAge(full, p.age), year = BASE_YR, inYear = a => year + Math.round(a - p.age);
  const card = (lbl, v, sub, key) => `<div class="plan-card${key ? ' key' : ''}"><div class="lbl">${lbl}</div><div class="num">${Math.round(v)}</div>
    <div class="sub">${sub}</div><button type="button" class="btn btn-xs" data-copy="${Math.round(v)}">Copy ${Math.round(v)}</button></div>`;
  $('planTo').innerHTML = card('Life expectancy', full.le, 'the money runs out for about half of people like you', false)
    + card('Plan to (1 in 10 live longer)', pta.p90, `around ${inYear(pta.p90)}`, true)
    + card('Plan to (1 in 20 live longer)', pta.p95, `around ${inYear(pta.p95)}`, false)
    + card('Couple: last survivor, 1 in 10', p.age + m.last.p90, `your age when it happens, around ${year + Math.round(m.last.p90)}`, false);
  $('planToNote').textContent = 'The FIRE dashboard calls this “Life expectancy” (its planning horizon): enter the plan-to age there, not your life expectancy. The couple figure uses the partner set below.';

  // ── Couple: headline cards, in plain sentences ──
  const c = ink(), he = m.partnerSex === 'F' ? 'she' : 'he', him = m.partnerSex === 'F' ? 'her' : 'him', his = m.partnerSex === 'F' ? 'her' : 'his';
  const He = he[0].toUpperCase() + he.slice(1), r = v => Math.round(v);
  const months = d => { const n = Math.round(d * 12); return n < 1 ? 'under a month' : n === 1 ? '1 month' : `${n} months`; };
  const years = v => `${r(v)} year${r(v) === 1 ? '' : 's'}`;
  // Every figure is a typical (median) one, and each scenario's years alone are
  // the gap between the two ages shown, so the numbers on a card add up.
  const story = (sc, firstWho, firstAge, survivor, survAge) => {
    const then = r(sc.survivorAgeThen), dies = r(sc.survivorDiesAt), alone = dies - then;
    return { alone, line: `${firstWho} typically ${firstWho === 'You' ? 'die' : 'dies'} at about ${r(firstAge)}, when ${survivor === 'you' ? 'you are' : he + ' is'} ${then}. ${survivor === 'you' ? 'You then live' : He + ' then lives'} to about ${dies}.` };
  };
  const a1 = story(m.ifPartnerFirst, He, m.ifPartnerFirst.otherDiesAt, 'you'), a2 = story(m.ifYouFirst, 'You', m.ifYouFirst.otherDiesAt, he);
  $('coupleCards').innerHTML = `
    <div class="couple-card"><div class="lbl">Who dies first</div>
      <div class="split" role="img" aria-label="${fmtPct(m.youOutlive)} chance ${he} dies first; ${fmtPct(m.partnerOutlives)} chance you do"><span style="width:${m.youOutlive * 100}%;background:${c.you}"></span><span style="width:${m.partnerOutlives * 100}%;background:${c.planB}"></span></div>
      <b>${fmtPct(m.youOutlive)}</b> chance ${he} dies first · <b>${fmtPct(m.partnerOutlives)}</b> chance you do</div>
    <div class="couple-card"><div class="lbl">Your time together</div><div class="big">${years(m.typicalTogether)}</div>
      Typically, the first of you dies around ${BASE_YR + r(m.typicalTogether)}.</div>
    <div class="couple-card"><div class="lbl">Until neither of you is left</div><div class="big">${years(m.last.median)}</div>
      Typically around ${BASE_YR + r(m.last.median)}. For 1 couple in 10 like you, one of you is still alive in ${BASE_YR + r(m.last.p90)}.</div>
    <div class="couple-card"><div class="lbl">If ${he} dies first (${fmtPct(m.youOutlive)})</div><div class="big">${years(a1.alone)} <small>on your own</small></div>${a1.line}</div>
    <div class="couple-card"><div class="lbl">If you die first (${fmtPct(m.partnerOutlives)})</div><div class="big">${years(a2.alone)} <small>on ${his} own</small></div>${a2.line}</div>
    <div class="couple-card"><div class="lbl">The cost of grief</div>${partner.widowhood
      ? `<div class="big">${months(ind.youLE - m.youLE)} <small>for you</small></div>${months(ind.partnerLE - m.partnerLE)} for ${him}: a widowed person's risk of dying rises (the widowhood effect), averaged over every way things could go`
      : `<div class="big">Off</div>Switched off: each of you keeps your own risk, whatever happens to the other`}</div>`;
  $('coupleHint').textContent = `All figures are typical (middle-of-the-range) outcomes. Each “if” card describes that way of things going: whoever dies first usually dies younger than their own life expectancy, and the survivor lives longer than theirs — that is what makes them the survivor.`;

  // ── Couple: who is still here (stacked) ──
  const xs = m.both.map((_, t) => p.age + t);
  const area = (data, label, color, first) => ({ label, data: data.map((y, i) => ({ x: xs[i], y })), borderColor: color, backgroundColor: color + '99',
    borderWidth: 1.5, pointRadius: 0, tension: 0.2, fill: first ? 'origin' : '-1' });
  const opts = baseOptions(c);
  opts.scales.x.min = p.age; opts.scales.x.max = MAX_AGE + 1; opts.scales.x.title = { display: true, text: 'Your age', color: c.muted, font: { size: 11 } };
  opts.scales.y.min = 0; opts.scales.y.max = 1; opts.scales.y.stacked = true; opts.scales.y.ticks.callback = v => Math.round(v * 100) + '%';
  opts.plugins.tooltip.callbacks = { title: items => `You ${items[0].parsed.x}, partner ${items[0].parsed.x - p.age + m.partnerAge}`,
    label: item => ` ${item.dataset.label}: ${fmtPct([m.both, m.onlyYou, m.onlyPartner][item.datasetIndex][item.dataIndex])}` };
  drawChart('chCouple', { type: 'line', data: { datasets: [area(m.both, 'Both of you', c.third, true), area(m.onlyYou, 'Only you', c.you), area(m.onlyPartner, 'Only your partner', c.planB)] }, options: opts });
  $('legCouple').innerHTML = `<span><i class="sw" style="background:${c.third}"></i>Both of you</span><span><i class="sw" style="background:${c.you}"></i>Only you</span><span><i class="sw" style="background:${c.planB}"></i>Only your partner</span>`;
  let rows = '<tr><th>Your age</th><th>Partner</th><th class="num">Both</th><th class="num">Only you</th><th class="num">Only partner</th><th class="num">At least one</th></tr>';
  for (let t = 5; t < m.both.length; t += 5) {
    if (m.either[t] < 0.0005) break;
    rows += `<tr><td>${p.age + t}</td><td>${m.partnerAge + t}</td><td class="num">${fmtPct(m.both[t])}</td><td class="num">${fmtPct(m.onlyYou[t])}</td><td class="num">${fmtPct(m.onlyPartner[t])}</td><td class="num">${fmtPct(m.either[t])}</td></tr>`;
  }
  $('tblCouple').innerHTML = rows;

  // ── Couple: anniversaries and notes ──
  const ann = partner.since ? anniversaries(m, partner.since, BASE_YR) : [];
  $('annivTiles').innerHTML = ann.length ? ann.map(x => `<div class="tile"><div class="tile-label">${x.n}th · ${x.year}</div><div class="tile-value">${fmtPct(x.both)}</div>
      <div class="tile-sub">chance you are both there</div></div>`).join('')
    : `<div class="hint">${partner.since ? 'No anniversary from the 10th to the 70th is still ahead.' : 'Add the year you got together to see the chance you both reach your anniversaries.'}</div>`;
  $('coupleNote').innerHTML = partner.widowhood
    ? `<b>Linked, not independent.</b> After one of you dies, the survivor's death rate rises by the widowhood effect: ×${WIDOW_HR.M} for a man and ×${WIDOW_HR.F} for a woman, more in the first year (Moon et al. 2011). Your life expectancy as part of this couple is <b>${fmt1(m.youLE)}</b>, ${him === 'her' ? 'hers' : 'his'} <b>${fmt1(m.partnerLE)}</b>. The Methodology tab has the details.`
    : `<b>Independent lives.</b> With the widowhood effect off, each of you keeps your own death rate whatever happens to the other: your life expectancy as a partnered person is <b>${fmt1(m.youLE)}</b>, ${him === 'her' ? 'hers' : 'his'} <b>${fmt1(m.partnerLE)}</b>.`;

  // Life in weeks
  drawWeeks(full, p.age);
  // Share card and texts
  drawShareCard($('cvCard'), p, full, base, sc);
  $('sumText').value = shareSummary(p, full, base, sc, contrib, { markdown: sumFormat === 'md', private: $('sumPrivate').checked });
  document.querySelectorAll('[data-sum-fmt]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sumFmt === sumFormat)));
  $('aiText').value = aiPrompt(p, full, base, sc, contrib, spots);
}

// The partner menu's value: 'average', 'custom', or 'slot:<name>'.
function ptModeValue() { return partner.mode === 'slot' ? 'slot:' + partner.name : partner.mode; }

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
    const v = e.target.value;
    if (v.startsWith('slot:')) partner = { ...partner, mode: 'slot', name: v.slice(5) };
    else if (v === 'custom') partner = { ...partner, mode: 'custom', state: partner.state || partnerStarter(partner.sex, partner.age) };
    else partner = { ...partner, mode: 'average' };
    refreshAll();
  });
  $('ptAge').addEventListener('change', e => { const v = Math.round(parseFloat(e.target.value)); if (isFinite(v)) { partner = { ...partner, age: Math.min(100, Math.max(18, v)) }; refreshAll(); } });
  $('ptSince').addEventListener('change', e => {
    const v = Math.round(parseFloat(e.target.value));
    partner = { ...partner, since: isFinite(v) && v >= 1940 && v <= BASE_YR ? v : null };
    refreshAll();
  });
  $('ptWidow').addEventListener('change', e => { partner = { ...partner, widowhood: e.target.checked }; refreshAll(); });
  $('ptForm').addEventListener('change', () => {
    const ans = { units: state.units, ...partner.state };
    readForm($('ptForm'), ans, 'pf');
    const full = quickStartState({ ...ans, country: state.country, sex: partner.sex, age: partner.age });
    partner = { ...partner, state: Object.fromEntries(PARTNER_FORM_KEYS.map(k => [k, full[k]])) };
    refreshAll();
  });
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
