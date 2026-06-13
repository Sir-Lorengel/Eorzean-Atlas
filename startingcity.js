'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// STARTING CITY — the ARR "Levels 1–15" opening (section `arr-uld`) is
// city-specific, fixed by the class chosen at character creation. The player
// picks a starting class (prompted once on first load, changeable in Options);
// only that city's opening chain is shown. Quest chains live in
// data.js (STARTING_CITY_CHAINS), sourced from the FFXIV Community
// Wiki. Mirrors the existing applyGrandCompany() approach in ui.js.
// ═══════════════════════════════════════════════════════════════════════════

// The eight ARR combat starting classes, each mapped to its home city.
const STARTING_CLASSES = [
  { id: 'gla', label: 'Gladiator',   city: 'uldah'    },
  { id: 'pgl', label: 'Pugilist',    city: 'uldah'    },
  { id: 'thm', label: 'Thaumaturge', city: 'uldah'    },
  { id: 'cnj', label: 'Conjurer',    city: 'gridania' },
  { id: 'lnc', label: 'Lancer',      city: 'gridania' },
  { id: 'arc', label: 'Archer',      city: 'gridania' },
  { id: 'mrd', label: 'Marauder',    city: 'limsa'    },
  { id: 'acn', label: 'Arcanist',    city: 'limsa'    },
];

const STARTING_CITY_LABELS    = { gridania: 'Gridania', limsa: 'Limsa Lominsa', uldah: "Ul'dah" };
const STARTING_CITY_PATH_NOTE = { gridania: 'Gridanian Path', limsa: 'Limsan Path', uldah: "Ul'dahn Path" };
const STARTING_CITY_ORDER     = ['gridania', 'limsa', 'uldah'];

function startingCityForClass(classId) {
  const c = STARTING_CLASSES.find(c => c.id === classId);
  return c ? c.city : null;
}

// Rewrite the `arr-uld` opening section's quests + note to match the chosen
// city. No-op (keeps the data.js default) when nothing is selected yet or the
// data isn't available.
function applyStartingCityData() {
  if (typeof findMsqSectionById !== 'function') return;
  if (typeof STARTING_CITY_CHAINS === 'undefined') return;
  const sec = findMsqSectionById('arr-uld');
  if (!sec) return;
  const city = startingCityForClass(ui.startingClass);
  if (!city) return;
  const chain = STARTING_CITY_CHAINS[city];
  if (!chain || !chain.length) return;
  sec.quests = chain.slice();
  sec.note = STARTING_CITY_PATH_NOTE[city];
}

// Reflect the current note on the already-rendered section header.
function syncStartingCityNote() {
  const sec = (typeof findMsqSectionById === 'function') ? findMsqSectionById('arr-uld') : null;
  if (!sec) return;
  const noteEl = document.querySelector('[data-section="arr-uld"] .section-note');
  if (noteEl && sec.note) noteEl.textContent = ` — ${sec.note}`;
}

// Apply the selection to the data and rebuild the page (the opening section
// changes length, so an in-place title swap isn't enough — the section's DOM
// must be rebuilt). Mirrors the post-build steps the boot sequence runs.
function applyStartingCityAndRebuild() {
  applyStartingCityData();
  if (typeof RENDER_INDEX !== 'undefined') RENDER_INDEX = null;
  build();
  if (typeof initSidebarSearch === 'function') initSidebarSearch();
  syncDates();
  render();
  if (typeof applyGrandCompany === 'function') applyGrandCompany(ui.grandCompany || null);
  if (typeof applyActivityHidden === 'function') applyActivityHidden(!!ui.hideActivity);
  syncStartingCityNote();
}

async function setStartingClass(classId) {
  ui.startingClass = classId || null;
  await saveUI();
  applyStartingCityAndRebuild();
  const sel = document.getElementById('settings-starting-class');
  if (sel) sel.value = ui.startingClass || '';
  if (ui.startingClass) {
    const c = STARTING_CLASSES.find(c => c.id === ui.startingClass);
    if (c) showToast(`✦ Starting class: ${c.label} — ${STARTING_CITY_LABELS[c.city]}`);
  }
}

// Populate a <select> with the eight classes grouped by city.
function buildStartingClassOptions(selectEl, includeBlank) {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  if (includeBlank) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = 'Not selected';
    selectEl.appendChild(o);
  }
  STARTING_CITY_ORDER.forEach(city => {
    const og = document.createElement('optgroup');
    og.label = STARTING_CITY_LABELS[city];
    STARTING_CLASSES.filter(c => c.city === city).forEach(c => {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.label;
      og.appendChild(o);
    });
    selectEl.appendChild(og);
  });
}

// ─── First-load prompt ──────────────────────────────────────────────────────

function showStartingClassPrompt() {
  const overlay = document.getElementById('starting-overlay');
  const panel   = document.getElementById('starting-prompt');
  if (!overlay || !panel) return;
  const sel = document.getElementById('starting-prompt-select');
  if (sel && !sel.options.length) buildStartingClassOptions(sel, true);
  if (sel) sel.value = ui.startingClass || '';
  overlay.classList.add('open');
  panel.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  panel.setAttribute('aria-hidden', 'false');
}

async function closeStartingClassPrompt() {
  const overlay = document.getElementById('starting-overlay');
  const panel   = document.getElementById('starting-prompt');
  if (overlay) { overlay.classList.remove('open'); overlay.setAttribute('aria-hidden', 'true'); }
  if (panel)   { panel.classList.remove('open');   panel.setAttribute('aria-hidden', 'true'); }
  // Remember we've asked, so a player who skips isn't nagged every load.
  if (!ui.startingClassPrompted) { ui.startingClassPrompted = true; await saveUI(); }
  if (!ui.dataCenter && !ui.dataCenterPrompted && typeof showDataCenterPrompt === 'function') {
    showDataCenterPrompt();
  }
}

function initStartingCity() {
  const sel = document.getElementById('settings-starting-class');
  if (sel) {
    buildStartingClassOptions(sel, true);
    sel.value = ui.startingClass || '';
    sel.addEventListener('change', e => setStartingClass(e.target.value || null));
  }

  const confirmBtn = document.getElementById('starting-prompt-confirm');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      const psel = document.getElementById('starting-prompt-select');
      const val = psel ? (psel.value || null) : null;
      if (val) await setStartingClass(val);
      await closeStartingClassPrompt();
    });
  }
  const skipBtn = document.getElementById('starting-prompt-skip');
  if (skipBtn) skipBtn.addEventListener('click', () => closeStartingClassPrompt());

  // Prompt once on first load when no starting class has been chosen yet.
  if (!ui.startingClass && !ui.startingClassPrompted) showStartingClassPrompt();
}
