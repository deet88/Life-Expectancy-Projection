// ── Refresh ────────────────────────────────────────────────────────────────
function refreshAll() {
  const p = plan();
  const full = summarize(p);
  const base = summarize(p, { baseline: true });
  const periodLE = p.improve ? summarize({ ...p, improve: false }).le : full.le;
  const imp = events.length ? summarize({ ...p, events: [] }) : null;   // "if nothing changes"
  const contrib = contributions(p, full);
  const sc = longevityScore(contrib), lev = levers(p, full), spots = blindSpots(p);
  last = { full, base, imp, contrib, sc, lev, spots };
  renderHero(full, base, contrib, imp, periodLE);
  renderGroupSummaries();
  renderSurvival(full, base, imp);
  renderTiles(full, base);
  renderTornado(contrib);
  renderTimeline(full, imp);
  renderScore(sc, bottomLine(p, full, base, sc, lev, spots, contrib));
  renderAlerts(alerts(p, full, contrib), spots);
  renderLevers(lev);
  renderLifetimes(full);
  renderDist(full);
  syncURL();
}

// ── Init ───────────────────────────────────────────────────────────────────
// Chart.js comes from a CDN. If it is blocked the page still renders its numbers,
// so say what happened rather than dying with a console-only ReferenceError.
if (typeof Chart === 'undefined') {
  document.querySelectorAll('.chart-wrap').forEach(w => {
    w.innerHTML = '<div class="empty-state"><p>Charts could not load — the Chart.js CDN is unreachable. Every figure and table on the page is still accurate.</p></div>';
  });
  window.Chart = function(){ return { destroy(){}, update(){} }; };
}
function init() {
  $('inCountry').innerHTML = Object.entries(LIFETABLES.countries).map(([iso, c]) => `<option value="${iso}">${c.name}</option>`).join('');
  document.querySelectorAll('.sidebar [data-key]').forEach(el => {
    if (el.classList.contains('mode-btn')) el.addEventListener('click', onModeBtn);
    else el.addEventListener('input', onInput);
  });
  syncThemeBtn();
  bindTimeline();
  document.querySelectorAll('[data-tabbtn]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tabbtn)));
  renderFactorTable();
  renderCalibration();
  applyHash(location.hash);
  syncControls();
  refreshAll();
  setTab(tab, true);
  addEventListener('hashchange', () => { if (applyHash(location.hash)) { syncControls(); refreshAll(); setTab(tab, true); } });
}
init();
