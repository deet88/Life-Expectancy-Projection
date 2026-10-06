// ═══════════════════════════════════════════════════════════════════════════
//  UI: Quick Start dialog, example profiles, guided tour
// ═══════════════════════════════════════════════════════════════════════════
const seenGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const seenSet = k => { try { localStorage.setItem(k, '1'); } catch (e) { /* storage blocked: the page still works */ } };

// ── Quick Start ────────────────────────────────────────────────────────────
let qs = null;   // { step, ans, opener } while the dialog is open
function openQuickStart() {
  const ans = {};
  for (const k of QS_KEYS) ans[k] = state[k];
  qs = { step: 0, ans, opener: document.activeElement };
  $('qsModal').hidden = false;
  renderQS();
}
function closeQuickStart() {
  $('qsModal').hidden = true;
  if (qs && qs.opener && qs.opener.focus) qs.opener.focus();
  qs = null;
}
function qsField(f, a) {
  if (f.show && !f.show(a)) return '';
  const imp = a.units === 'imperial';
  const id = 'qs_' + f.key, lab = `<label for="${id}">${f.label}${f.optional ? ' <span class="hint">optional</span>' : ''}</label>`;
  const num = (key, v, min, max, step, unit, extra = '') => `<span class="row"><input type="number" id="${extra || id}" data-qs="${key}" value="${v === null || v === undefined ? '' : v}" min="${min}" max="${max}" step="${step}">${unit ? `<span class="unit">${unit}</span>` : ''}</span>`;
  const opts = (list, v) => list.map(([k, l]) => `<option value="${k}"${String(v) === k ? ' selected' : ''}>${l}</option>`).join('');
  let ctl;
  if (f.type === 'country') ctl = `<select id="${id}" data-qs="country">${opts(Object.entries(LIFETABLES.countries).map(([k, c]) => [k, c.name]), a.country)}</select>`;
  else if (f.type === 'select') ctl = `<select id="${id}" data-qs="${f.key}">${opts(f.options, a[f.key])}</select>`;
  else if (f.type === 'seg') return `<div class="field"><span class="flabel">${f.label}</span><div class="mode-row">${f.options.map(([k, l]) =>
    `<button type="button" class="mode-btn" data-qs-seg="${f.key}" data-val="${k}" aria-pressed="${a[f.key] === k}">${l}</button>`).join('')}</div></div>`;
  else if (f.type === 'check') return `<label class="chk"><input type="checkbox" data-qs="${f.key}"${a[f.key] ? ' checked' : ''}> ${f.label}</label>`;
  else if (f.type === 'height') {
    if (!imp) ctl = num('height', Math.round(a.height), 120, 230, 1, 'cm');
    else { const t = Math.round(a.height / CM_PER_IN); ctl = `<span class="row">${num('feet', Math.floor(t / 12), 3, 7, 1, 'ft', id)}${num('inches', t % 12, 0, 11, 1, 'in', id + 'i')}</span>`; }
  }
  else if (f.type === 'weight') ctl = imp ? num('weight', Math.round(a.weight / KG_PER_LB), 66, 660, 1, 'lb') : num('weight', a.weight, 30, 300, 0.5, 'kg');
  else ctl = num(f.key, a[f.key], f.min, f.max, f.step, f.unit);
  return `<div class="field">${lab}${ctl}</div>`;
}
function renderQS() {
  const st = QS_STEPS[qs.step], last = qs.step === QS_STEPS.length - 1;
  $('qsCard').innerHTML = `<div class="qs-head"><h2 id="qsTitle">Quick start</h2><button type="button" class="tl-del" data-qs-act="close" aria-label="Close">×</button></div>
    <div class="qs-steps">${QS_STEPS.map((s, i) => `<span class="${i === qs.step ? 'on' : i < qs.step ? 'done' : ''}">${i + 1}. ${s.title}</span>`).join('')}</div>
    <p class="qs-intro">${st.intro}</p>
    <div class="qs-fields">${st.fields.map(f => qsField(f, qs.ans)).join('')}</div>
    <div class="qs-nav">
      <button type="button" class="btn" data-qs-act="back"${qs.step === 0 ? ' disabled' : ''}>← Back</button>
      <span class="hint">Replaces your current answers${events.length ? ' and timeline' : ''}.</span>
      <button type="button" class="btn btn-primary" data-qs-act="${last ? 'finish' : 'next'}">${last ? 'See my results' : 'Next →'}</button>
    </div>
    ${qs.step === 0 ? `<div class="qs-examples"><div class="sub-head">Or start from an example</div>
      ${ARCHETYPES.map(a => `<button type="button" class="qs-example" data-archetype="${a.id}"><b>${a.label}</b><span>${a.blurb}</span></button>`).join('')}
      <p class="hint">Examples keep your country and units.</p></div>` : ''}`;
  const first = $('qsCard').querySelector('input, select');
  if (first && first.focus) first.focus();
}
// Read the visible step's inputs into the answers (metric).
function readQS() {
  const a = qs.ans, imp = a.units === 'imperial';
  $('qsCard').querySelectorAll('[data-qs]').forEach(el => {
    const k = el.dataset.qs;
    if (el.type === 'checkbox') a[k] = el.checked;
    else if (el.tagName === 'SELECT') a[k] = el.value;
    else if (k === 'feet' || k === 'inches') return;
    else if (k === 'weight') { const v = parseFloat(el.value); if (isFinite(v)) a.weight = imp ? v * KG_PER_LB : v; }
    else if (k === 'sbp') { const v = parseFloat(el.value); a.sbp = isFinite(v) ? v : null; }
    else { const v = parseFloat(el.value); if (isFinite(v)) a[k] = v; }
  });
  const ft = $('qsCard').querySelector('[data-qs="feet"]'), inch = $('qsCard').querySelector('[data-qs="inches"]');
  if (ft && inch) { const f = parseFloat(ft.value), i = parseFloat(inch.value); if (isFinite(f) && isFinite(i)) a.height = (f * 12 + i) * CM_PER_IN; }
}
function finishQuickStart(plan) {
  state = plan.state; events = plan.events;
  const firstVisit = !seenGet('lifex-toured');
  closeQuickStart();
  syncControls(); refreshAll(); setTab('overview');
  if (firstVisit) startTour();
}
function bindOnboarding() {
  $('qsBtn').addEventListener('click', openQuickStart);
  $('tourBtn').addEventListener('click', startTour);
  $('qsModal').addEventListener('change', () => { if (qs) { readQS(); renderQS(); } });
  $('qsModal').addEventListener('click', ev => {
    if (!qs) return;
    if (ev.target === $('qsModal')) return closeQuickStart();        // click on the backdrop
    const t = ev.target.closest ? ev.target.closest('button') : null;
    if (!t) return;
    if (t.dataset.qsSeg) { readQS(); qs.ans[t.dataset.qsSeg] = t.dataset.val; renderQS(); return; }
    if (t.dataset.archetype) return finishQuickStart(archetypePlan(t.dataset.archetype, state));
    const act = t.dataset.qsAct;
    if (act === 'close') closeQuickStart();
    else if (act === 'back') { readQS(); qs.step--; renderQS(); }
    else if (act === 'next') { readQS(); qs.step++; renderQS(); }
    else if (act === 'finish') { readQS(); finishQuickStart({ state: quickStartState(qs.ans), events: [] }); }
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') { if (qs) closeQuickStart(); else if (tour !== null) endTour(); }
    else if (tour !== null && ev.key === 'ArrowRight') showTourStep(tour + 1);
    else if (tour !== null && ev.key === 'ArrowLeft') showTourStep(tour - 1);
  });
  $('tour').addEventListener('click', ev => {
    const t = ev.target.closest ? ev.target.closest('button') : null;
    if (!t) return;
    const act = t.dataset.tourAct;
    if (act === 'next') showTourStep(tour + 1); else if (act === 'back') showTourStep(tour - 1); else if (act === 'end') endTour();
  });
  addEventListener('resize', () => { if (tour !== null) placeTour(); });
  // First visit with no link: offer the Quick Start once.
  if (!location.hash.replace(/^#/, '') && !seenGet('lifex-seen')) { seenSet('lifex-seen'); openQuickStart(); }
}

// ── Tour ───────────────────────────────────────────────────────────────────
let tour = null;   // index of the step showing, or null
function startTour() { seenSet('lifex-toured'); $('tour').hidden = false; showTourStep(0); }
function endTour() { tour = null; $('tour').hidden = true; }
function showTourStep(i) {
  if (i < 0) return;
  if (i >= TOUR.length) return endTour();
  tour = i;
  const st = TOUR[i];
  if (st.tab) setTab(st.tab);
  const el = document.querySelector(st.target);
  if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
  $('tourCard').innerHTML = `<div class="tour-count">${i + 1} of ${TOUR.length}</div><h3>${st.title}</h3><p>${st.text}</p>
    <div class="qs-nav"><button type="button" class="btn" data-tour-act="end">Skip</button>
    <span class="btn-row"><button type="button" class="btn" data-tour-act="back"${i === 0 ? ' disabled' : ''}>← Back</button>
    <button type="button" class="btn btn-primary" data-tour-act="next">${i === TOUR.length - 1 ? 'Done' : 'Next →'}</button></span></div>`;
  placeTour();
}
// Spotlight the target and put the card beside it, inside the viewport.
function placeTour() {
  const el = document.querySelector(TOUR[tour].target);
  if (!el || !el.getBoundingClientRect) return;
  const r = el.getBoundingClientRect(), pad = 6, vw = innerWidth, vh = innerHeight;
  const top = Math.max(4, r.top - pad), left = Math.max(4, r.left - pad);
  Object.assign($('tourSpot').style, { top: top + 'px', left: left + 'px',
    width: Math.min(vw - left - 4, r.width + 2 * pad) + 'px', height: Math.min(vh - top - 4, r.height + 2 * pad) + 'px' });
  const card = $('tourCard'), cw = Math.min(340, vw - 24), ch = card.offsetHeight || 160;
  let cx = r.right + 14, cy = r.top;
  if (cx + cw > vw - 12) { cx = Math.max(12, Math.min(vw - cw - 12, r.left)); cy = r.bottom + 14; }
  if (cy + ch > vh - 12) cy = Math.max(12, r.top - ch - 14);
  Object.assign(card.style, { left: cx + 'px', top: Math.max(12, Math.min(vh - ch - 12, cy)) + 'px', width: cw + 'px' });
}
