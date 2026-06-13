'use strict';
// Data center region preference for recurring content whose reset time varies
// by region, currently Jumbo Cactpot.

const DATA_CENTER_REGIONS = [
  { id: 'na', label: 'North America' },
  { id: 'eu', label: 'Europe' },
  { id: 'jp', label: 'Japan' },
  { id: 'oce', label: 'Oceania' },
];

function dataCenterLabel(id) {
  const region = DATA_CENTER_REGIONS.find(dc => dc.id === id);
  return region ? region.label : '';
}

function buildDataCenterOptions(selectEl, includeBlank) {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  if (includeBlank) {
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = 'Not selected';
    selectEl.appendChild(blank);
  }
  DATA_CENTER_REGIONS.forEach(region => {
    const opt = document.createElement('option');
    opt.value = region.id;
    opt.textContent = region.label;
    selectEl.appendChild(opt);
  });
}

function syncDataCenterSelection() {
  const value = ui.dataCenter || '';
  const settingsSel = document.getElementById('settings-data-center');
  if (settingsSel) settingsSel.value = value;
  const promptSel = document.getElementById('data-center-prompt-select');
  if (promptSel) promptSel.value = value;
}

function showDataCenterPrompt() {
  const overlay = document.getElementById('data-center-overlay');
  const panel = document.getElementById('data-center-prompt');
  if (!overlay || !panel) return;
  const sel = document.getElementById('data-center-prompt-select');
  if (sel && !sel.options.length) buildDataCenterOptions(sel, true);
  syncDataCenterSelection();
  overlay.classList.add('open');
  panel.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  panel.setAttribute('aria-hidden', 'false');
}

async function closeDataCenterPrompt() {
  const overlay = document.getElementById('data-center-overlay');
  const panel = document.getElementById('data-center-prompt');
  if (overlay) { overlay.classList.remove('open'); overlay.setAttribute('aria-hidden', 'true'); }
  if (panel) { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); }
  if (!ui.dataCenterPrompted) {
    ui.dataCenterPrompted = true;
    await saveUI();
  }
}

async function setDataCenter(regionId) {
  ui.dataCenter = regionId || null;
  await saveUI();
  syncDataCenterSelection();
  checkAutoReset();
  render();
  if (ui.dataCenter) showToast(`✦ Data Center region set: ${dataCenterLabel(ui.dataCenter)}`);
  else showToast('✦ Data Center region cleared');
}

function initDataCenter() {
  const settingsSel = document.getElementById('settings-data-center');
  if (settingsSel) {
    buildDataCenterOptions(settingsSel, true);
    settingsSel.value = ui.dataCenter || '';
    settingsSel.addEventListener('change', e => setDataCenter(e.target.value || null));
  }

  const promptSel = document.getElementById('data-center-prompt-select');
  if (promptSel) {
    buildDataCenterOptions(promptSel, true);
    promptSel.value = ui.dataCenter || '';
  }

  const confirmBtn = document.getElementById('data-center-prompt-confirm');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      const val = promptSel ? (promptSel.value || null) : null;
      if (val) await setDataCenter(val);
      await closeDataCenterPrompt();
    });
  }

  const skipBtn = document.getElementById('data-center-prompt-skip');
  if (skipBtn) skipBtn.addEventListener('click', () => closeDataCenterPrompt());

  const startingPromptOpen = document.getElementById('starting-prompt')?.classList.contains('open');
  if (!ui.dataCenter && !ui.dataCenterPrompted && !startingPromptOpen) showDataCenterPrompt();
}
