// ── Refresh ────────────────────────────────────────────────────────────────
function refreshAll() {
  const full = summarize(state);
  const base = summarize(state, { baseline: true });
  const periodLE = state.improve ? summarize({ ...state, improve: false }).le : full.le;
  const active = new Set([...whatif].filter(id => WHATIFS.find(w => w.id === id).applies(state)));
  const imp = active.size ? summarize(applyWhatIfs(state, active)) : null;
  const contrib = contributions(state, full);
  last = { full, base, imp, contrib };
  renderHero(full, base, contrib, imp, periodLE);
  renderGroupSummaries();
  renderSurvival(full, base, imp);
  renderTiles(full, base);
  renderTornado(contrib);
  renderWhatIf(full, imp);
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
  renderFactorTable();
  renderCalibration();
  applyHash(location.hash);
  syncControls();
  refreshAll();
  addEventListener('hashchange', () => { if (applyHash(location.hash)) { syncControls(); refreshAll(); } });
}
init();
