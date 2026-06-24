'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// APP — data loading, boot sequence, sidebar, settings, dark mode, scroll spy
// ═══════════════════════════════════════════════════════════════════════════

// ─── Data globals — populated by the JS data files on boot ────────────────
let ATLAS,
    ARR_DUNGEON_GUIDES, ARR_TRIAL_GUIDES, ARR_RAID_GUIDES,
    HW_DUNGEON_GUIDES,  HW_TRIAL_GUIDES,  HW_RAID_GUIDES,
    SB_DUNGEON_GUIDES,  SB_TRIAL_GUIDES,  SB_RAID_GUIDES,
    SHB_DUNGEON_GUIDES, SHB_TRIAL_GUIDES, SHB_RAID_GUIDES,
    EW_DUNGEON_GUIDES,  EW_TRIAL_GUIDES,  EW_RAID_GUIDES,
    DT_DUNGEON_GUIDES,  DT_TRIAL_GUIDES,  DT_RAID_GUIDES,
    TANK_QUESTS, HEALER_QUESTS, DPS_QUESTS, DOL_QUESTS, DOH_QUESTS,
    DEEP_DUNGEON_QUESTS, ROLE_QUESTS, HILDEBRAND_QUESTS, RELIC_WEAPONS,
    SIDE_QUESTS_DATA,
    DAILY_TASKS, WEEKLY_TASKS,
    AETHER_CURRENTS_DATA, AETHER_CURRENT_MSQ_QUESTS, AETHER_UNLOCK_MSQ_QUESTS,
    GC_RANKS, MSQ_UNLOCK_MARKERS, CLASS_UNLOCK_MARKERS, MSQ_FEATURE_MARKERS,
    ACHIEVEMENTS_DATA,
    ORCHESTRION_DATA, MOUNTS_DATA, MINIONS_DATA, TRIPLE_TRIAD_DATA, STARTING_CITY_CHAINS;

async function loadData() {
  const payload = window.atlas ? await window.atlas.getData() : { FFXIV_DATA };
  const d = payload.FFXIV_DATA;

  ATLAS = d.atlas;

  ARR_DUNGEON_GUIDES  = d.guides.arr.dungeons;
  ARR_TRIAL_GUIDES    = d.guides.arr.trials;
  ARR_RAID_GUIDES     = d.guides.arr.raids;
  HW_DUNGEON_GUIDES   = d.guides.hw.dungeons;
  HW_TRIAL_GUIDES     = d.guides.hw.trials;
  HW_RAID_GUIDES      = d.guides.hw.raids;
  SB_DUNGEON_GUIDES   = d.guides.sb.dungeons;
  SB_TRIAL_GUIDES     = d.guides.sb.trials;
  SB_RAID_GUIDES      = d.guides.sb.raids;
  SHB_DUNGEON_GUIDES  = d.guides.shb.dungeons;
  SHB_TRIAL_GUIDES    = d.guides.shb.trials;
  SHB_RAID_GUIDES     = d.guides.shb.raids;
  EW_DUNGEON_GUIDES   = d.guides.ew.dungeons;
  EW_TRIAL_GUIDES     = d.guides.ew.trials;
  EW_RAID_GUIDES      = d.guides.ew.raids;
  DT_DUNGEON_GUIDES   = d.guides.dt.dungeons;
  DT_TRIAL_GUIDES     = d.guides.dt.trials;
  DT_RAID_GUIDES      = d.guides.dt.raids;

  TANK_QUESTS   = d.jobs.tanks;
  HEALER_QUESTS = d.jobs.healers;
  DPS_QUESTS    = d.jobs.dps;
  DOL_QUESTS    = d.jobs.dol;
  DOH_QUESTS    = d.jobs.doh;

  DEEP_DUNGEON_QUESTS = d.deepDungeons;
  ROLE_QUESTS         = d.roleQuests;
  HILDEBRAND_QUESTS   = d.hildebrand;
  RELIC_WEAPONS       = d.relicWeapons;
  SIDE_QUESTS_DATA    = d.sideQuests;
  DAILY_TASKS         = d.dailyTasks;
  WEEKLY_TASKS        = d.weeklyTasks;

  AETHER_CURRENTS_DATA      = d.aetherCurrents;
  AETHER_CURRENT_MSQ_QUESTS = new Set(d.aetherCurrentMsqQuests);
  AETHER_UNLOCK_MSQ_QUESTS  = new Set(d.aetherUnlockMsqQuests);

  GC_RANKS             = d.gcRanks;
  MSQ_UNLOCK_MARKERS   = d.msqUnlockMarkers;
  CLASS_UNLOCK_MARKERS = d.classUnlockMarkers;
  MSQ_FEATURE_MARKERS  = d.msqFeatureMarkers;
  ACHIEVEMENTS_DATA    = d.achievements;
  ORCHESTRION_DATA     = payload.ORCHESTRION_DATA || null;
  MOUNTS_DATA          = payload.MOUNTS_DATA || null;
  MINIONS_DATA         = payload.MINIONS_DATA || null;
  TRIPLE_TRIAD_DATA    = payload.TRIPLE_TRIAD_DATA || null;
  STARTING_CITY_CHAINS = payload.STARTING_CITY_CHAINS || null;
}

async function initDesktopShell() {
  if (!window.atlas) return;

  const notice = document.getElementById('update-notice');
  const text = document.getElementById('update-notice-text');
  const open = document.getElementById('update-notice-open');
  const close = document.getElementById('update-notice-close');

  const hideUpdateNotice = () => {
    if (notice) notice.hidden = true;
  };

  const renderUpdateNotice = update => {
    if (!notice || !text || !open || !close || !update) return;

    open.hidden = false;
    open.disabled = false;
    open.onclick = null;
    close.onclick = hideUpdateNotice;

    if (update.status === 'manual-update-available') {
      text.textContent = `Update available: v${update.latestVersion}`;
      open.textContent = 'Download';
      open.onclick = () => window.atlas.openExternal(update.releaseUrl);
      notice.hidden = false;
      return;
    }

    if (update.status === 'downloading') {
      const progress = Number.isFinite(update.progress) ? ` ${update.progress}%` : '';
      text.textContent = `Downloading update${progress}`;
      open.hidden = true;
      notice.hidden = false;
      return;
    }

    if (update.status === 'ready') {
      text.textContent = `Update ready: v${update.latestVersion}`;
      open.textContent = 'Restart';
      open.onclick = () => window.atlas.installUpdate();
      notice.hidden = false;
      return;
    }

    if (update.updateAvailable && update.releaseUrl) {
      text.textContent = `Update available: v${update.latestVersion}`;
      open.textContent = 'Download';
      open.onclick = () => window.atlas.openExternal(update.releaseUrl);
      notice.hidden = false;
      return;
    }

    hideUpdateNotice();
  };

  try {
    const info = await window.atlas.getAppInfo();
    const versionEl = document.querySelector('.sidebar-version');
    if (versionEl && info.version) versionEl.textContent = `V${info.version.replace(/\.0$/, '')}`;
  } catch {}

  try {
    if (window.atlas.onUpdateStatus) window.atlas.onUpdateStatus(renderUpdateNotice);
    if (window.atlas.getUpdateState) renderUpdateNotice(await window.atlas.getUpdateState());
    const update = await window.atlas.checkForUpdates();
    renderUpdateNotice(update);
  } catch {
    // Update checks should never block the tracker.
  }
}

// ─── Job & class level tracker config ──────────────────────────────────────
// Static reference data: every playable job/class grouped by role, with its
// level cap. Levels themselves live in the `jobLevels` state (savestate.js).
// Caps are 100 for standard jobs; Blue Mage is a limited job capped at 80.
const JOB_GROUPS = [
  { label: 'Tanks', accent: '--tank', jobs: [
    { id: 'pld', name: 'Paladin',     max: 100 },
    { id: 'war', name: 'Warrior',     max: 100 },
    { id: 'drk', name: 'Dark Knight', max: 100 },
    { id: 'gnb', name: 'Gunbreaker',  max: 100 },
  ]},
  { label: 'Healers', accent: '--healer', jobs: [
    { id: 'whm', name: 'White Mage',  max: 100 },
    { id: 'sch', name: 'Scholar',     max: 100 },
    { id: 'ast', name: 'Astrologian', max: 100 },
    { id: 'sge', name: 'Sage',        max: 100 },
  ]},
  { label: 'Melee DPS', accent: '--dps', jobs: [
    { id: 'mnk', name: 'Monk',     max: 100 },
    { id: 'drg', name: 'Dragoon',  max: 100 },
    { id: 'nin', name: 'Ninja',    max: 100 },
    { id: 'sam', name: 'Samurai',  max: 100 },
    { id: 'rpr', name: 'Reaper',   max: 100 },
    { id: 'vpr', name: 'Viper',    max: 100 },
  ]},
  { label: 'Physical Ranged DPS', accent: '--dps', jobs: [
    { id: 'brd', name: 'Bard',      max: 100 },
    { id: 'mch', name: 'Machinist', max: 100 },
    { id: 'dnc', name: 'Dancer',    max: 100 },
  ]},
  { label: 'Magical Ranged DPS', accent: '--dps', jobs: [
    { id: 'blm', name: 'Black Mage',  max: 100 },
    { id: 'smn', name: 'Summoner',    max: 100 },
    { id: 'rdm', name: 'Red Mage',    max: 100 },
    { id: 'pct', name: 'Pictomancer', max: 100 },
    { id: 'blu', name: 'Blue Mage',   max: 80  },
  ]},
  { label: 'Disciples of the Land', accent: '--dol', jobs: [
    { id: 'min', name: 'Miner',    max: 100 },
    { id: 'btn', name: 'Botanist', max: 100 },
    { id: 'fsh', name: 'Fisher',   max: 100 },
  ]},
  { label: 'Disciples of the Hand', accent: '--doh', jobs: [
    { id: 'crp', name: 'Carpenter',     max: 100 },
    { id: 'bsm', name: 'Blacksmith',    max: 100 },
    { id: 'arm', name: 'Armorer',       max: 100 },
    { id: 'gsm', name: 'Goldsmith',     max: 100 },
    { id: 'ltw', name: 'Leatherworker', max: 100 },
    { id: 'wvr', name: 'Weaver',        max: 100 },
    { id: 'alc', name: 'Alchemist',     max: 100 },
    { id: 'cul', name: 'Culinarian',    max: 100 },
  ]},
];
const ALL_JOBS = JOB_GROUPS.flatMap(g => g.jobs);

// Canvas graphs need literal colors (CSS vars can't be read by the 2D context),
// so map each role accent to a fixed hex + rgb triple, matching styles.css.
const JOB_ACCENT_HEX = {
  '--tank':   ['#4a5f7d', '74,95,125'],
  '--healer': ['#5a8a5a', '90,138,90'],
  '--dps':    ['#8a3d3d', '138,61,61'],
  '--dol':    ['#4a7c59', '74,124,89'],
  '--doh':    ['#7c5a2e', '124,90,46'],
};

const root = document.getElementById('atlas-body');

// ─── Expansion name lookup ─────────────────────────────────────────────────
const EXP_NAMES = {
  arr: 'A Realm Reborn',
  hw:  'Heavensward',
  sb:  'Stormblood',
  shb: 'Shadowbringers',
  ew:  'Endwalker',
  dt:  'Dawntrail',
};

// ─── Theme ────────────────────────────────────────────────────────────────
const DARK_MODE_KEY = 'ffxiv-atlas-dark-mode'; // legacy boolean, migrated to THEME_KEY
const THEME_KEY     = 'ffxiv-atlas-theme';
const THEMES        = ['light', 'paper', 'plain', 'azure', 'charcoal', 'black', 'dark'];
const THEME_CLASS   = {
  light: '',
  paper: 'theme-paper',
  plain: 'theme-plain',
  azure: 'theme-azure',
  charcoal: 'theme-charcoal',
  black: 'theme-black',
  dark: 'hydaelyn-night',
};

function applyTheme(theme) {
  if (!THEMES.includes(theme)) theme = 'light';
  Object.values(THEME_CLASS).forEach(c => { if (c) document.body.classList.remove(c); });
  if (THEME_CLASS[theme]) document.body.classList.add(THEME_CLASS[theme]);
  const select = document.getElementById('settings-theme');
  if (select) select.value = theme;
  localStorage.setItem(THEME_KEY, theme);
}

function currentTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved && THEMES.includes(saved)) return saved;
  // Migrate the old dark-mode boolean for returning users.
  return localStorage.getItem(DARK_MODE_KEY) === '1' ? 'dark' : 'light';
}

(function initTheme() {
  applyTheme(currentTheme());
})();

// ─── Settings panel ───────────────────────────────────────────────────────
function applyActivityHidden(on) {
  const wrap = document.getElementById('activity-graph-wrap');
  if (wrap) wrap.style.display = on ? 'none' : '';
}

function applyCompactSidebar(on) {
  document.body.classList.toggle('sidebar-compact', !!on);
}

function formatBackupStamp(iso) {
  if (!iso) return 'Last export: never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Last export: never';
  return `Last export: ${date.toLocaleString()}`;
}

function updateLastBackupNote() {
  const note = document.getElementById('settings-last-backup');
  if (note) note.textContent = formatBackupStamp(ui.lastBackupAt);
}

function openSettingsPanel() {
  const revealToggle = document.getElementById('settings-show-all-quests');
  if (revealToggle) revealToggle.checked = !!ui.showAllQuests;
  const themeSelect = document.getElementById('settings-theme');
  if (themeSelect) themeSelect.value = currentTheme();
  const hideActivityToggle = document.getElementById('settings-hide-activity');
  if (hideActivityToggle) hideActivityToggle.checked = !!ui.hideActivity;
  const compactToggle = document.getElementById('settings-compact-sidebar');
  if (compactToggle) compactToggle.checked = !!ui.compactSidebar;
  const gcSelect = document.getElementById('settings-grand-company');
  if (gcSelect) gcSelect.value = ui.grandCompany || '';
  const dataCenterSelect = document.getElementById('settings-data-center');
  if (dataCenterSelect) dataCenterSelect.value = ui.dataCenter || '';
  const startSelect = document.getElementById('settings-starting-class');
  if (startSelect) startSelect.value = ui.startingClass || '';
  updateLastBackupNote();
  document.getElementById('settings-overlay').classList.add('open');
  document.getElementById('settings-panel').classList.add('open');
  document.getElementById('settings-overlay').setAttribute('aria-hidden', 'false');
  document.getElementById('settings-panel').setAttribute('aria-hidden', 'false');
}

function closeSettingsPanel() {
  document.getElementById('settings-overlay').classList.remove('open');
  document.getElementById('settings-panel').classList.remove('open');
  document.getElementById('settings-overlay').setAttribute('aria-hidden', 'true');
  document.getElementById('settings-panel').setAttribute('aria-hidden', 'true');
}

document.getElementById('options-btn').onclick          = () => openSettingsPanel();
document.getElementById('settings-close').onclick       = () => closeSettingsPanel();
document.getElementById('settings-overlay').onclick     = () => closeSettingsPanel();
document.getElementById('settings-save').onclick        = () => saveToFile();
document.getElementById('settings-load').onclick        = () => loadFromFile();
document.getElementById('settings-theme').addEventListener('change', e => applyTheme(e.target.value));
document.getElementById('settings-show-all-quests').addEventListener('change', async e => {
  ui.showAllQuests = !!e.target.checked;
  await saveUI();
  render();
});
document.getElementById('settings-reset').onclick = async () => {
  if (!confirm('Reset all progress? This cannot be undone — consider saving first.')) return;
  checked = {};
  render();
  await saveState();
  closeSettingsPanel();
  showToast('✦ Progress reset');
};
document.getElementById('settings-hide-activity').addEventListener('change', async e => {
  ui.hideActivity = !!e.target.checked;
  applyActivityHidden(ui.hideActivity);
  await saveUI();
});
document.getElementById('settings-compact-sidebar').addEventListener('change', async e => {
  ui.compactSidebar = !!e.target.checked;
  applyCompactSidebar(ui.compactSidebar);
  await saveUI();
});
document.getElementById('settings-grand-company').addEventListener('change', async e => {
  ui.grandCompany = e.target.value || null;
  applyGrandCompany(ui.grandCompany);
  await saveUI();
  showToast(ui.grandCompany ? `✦ Grand Company set: ${GC_LABELS[ui.grandCompany]}` : '✦ Grand Company cleared');
});
document.getElementById('settings-reset-activity').onclick = async () => {
  if (!confirm('Reset the activity tracker? This clears your logged activity history and cannot be undone.')) return;
  resetActivity();
  closeSettingsPanel();
  showToast('✦ Activity tracker reset');
};
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSettingsPanel(); });

// ─── Job level history modal ───────────────────────────────────────────────
let currentJobModal = null;      // { id, name, max, accentHex, accentRgb }
let currentJobModalRange = '30d';
let jobHistoryRangeBuilt = false;

function buildJobHistoryControls() {
  if (jobHistoryRangeBuilt) return;
  const rangeRow = document.getElementById('job-history-range-row');
  [['24h','24 Hours'],['7d','7 Days'],['30d','30 Days'],['1y','1 Year'],['all','All Time']].forEach(([r, lbl]) => {
    const btn = el('button', { type: 'button', class: 'gil-range-btn' + (r === currentJobModalRange ? ' active' : ''), 'data-range': r }, lbl);
    btn.addEventListener('click', () => {
      currentJobModalRange = r;
      rangeRow.querySelectorAll('.gil-range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderJobHistoryGraph(currentJobModalRange);
    });
    rangeRow.appendChild(btn);
  });
  document.getElementById('job-history-charttype-row')
    .appendChild(buildChartTypeToggle('job-history-graph', renderJobHistoryGraph, () => currentJobModalRange, CURRENCY_CHART_TYPES));
  document.getElementById('job-history-charttype-row')
    .appendChild(buildTrendToggle('job-history-graph', renderJobHistoryGraph, () => currentJobModalRange));
  jobHistoryRangeBuilt = true;
}

function openJobHistory(job, accentVar) {
  const [hex, rgb] = JOB_ACCENT_HEX[accentVar] || ['#b1882a', '177,136,42'];
  currentJobModal = { ...job, accentHex: hex, accentRgb: rgb };
  buildJobHistoryControls();
  document.getElementById('job-history-title').textContent = `${job.name} — Level History`;
  const cur = jobLevelCurrent(job.id);
  document.getElementById('job-history-sub').textContent =
    cur != null ? `Current: Lv ${cur} / ${job.max} · level progression over time.` : `No levels logged yet — record one on the card.`;
  document.getElementById('job-history-panel').style.borderLeftColor = hex;
  document.getElementById('job-history-overlay').classList.add('open');
  document.getElementById('job-history-panel').classList.add('open');
  document.getElementById('job-history-overlay').setAttribute('aria-hidden', 'false');
  document.getElementById('job-history-panel').setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => renderJobHistoryGraph(currentJobModalRange));
}

function closeJobHistory() {
  document.getElementById('job-history-overlay').classList.remove('open');
  document.getElementById('job-history-panel').classList.remove('open');
  document.getElementById('job-history-overlay').setAttribute('aria-hidden', 'true');
  document.getElementById('job-history-panel').setAttribute('aria-hidden', 'true');
}

document.getElementById('job-history-close').onclick   = () => closeJobHistory();
document.getElementById('job-history-overlay').onclick = () => closeJobHistory();
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeJobHistory(); });

document.getElementById('expand-all-btn').onclick = async () => {
  document.querySelectorAll('.section[data-section]').forEach(sec => {
    ui.open[sec.dataset.section] = true;
    sec.classList.add('open');
  });
  document.querySelectorAll('.guide-dungeon[data-guide]').forEach(gd => {
    ui.open[gd.dataset.guide] = true;
    gd.classList.add('open');
  });
  await saveUI();
};

document.getElementById('collapse-all-btn').onclick = async () => {
  document.querySelectorAll('.section[data-section]').forEach(sec => {
    ui.open[sec.dataset.section] = false;
    sec.classList.remove('open');
  });
  document.querySelectorAll('.guide-dungeon[data-guide]').forEach(gd => {
    ui.open[gd.dataset.guide] = false;
    gd.classList.remove('open');
  });
  await saveUI();
};

// ─── Sidebar clock ────────────────────────────────────────────────────────
(function() {
  const dateEl = document.querySelector('#sidebar-datetime .dt-date');
  const timeEl = document.querySelector('#sidebar-datetime .dt-time');
  let timer = null;
  function tick() {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    timeEl.textContent = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  function start() {
    tick();
    if (timer === null) timer = setInterval(tick, 1000);
  }
  function stop() {
    if (timer !== null) { clearInterval(timer); timer = null; }
  }
  // Don't burn a layout every second while the tab is in the background;
  // resume (with an immediate refresh) when it becomes visible again.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });
  if (!document.hidden) start();
  else tick();
})();

// ─── Sidebar nav ──────────────────────────────────────────────────────────
const SIDEBAR_COMPACT_LABELS = {
  'A Realm Reborn': 'ARR',
  Heavensward: 'HW',
  Stormblood: 'SB',
  Shadowbringers: 'ShB',
  Endwalker: 'EW',
  Dawntrail: 'DT',
  'MSQ Progress': 'MSQ',
  Expansions: 'MSQ',
  'Side Content': 'Side',
  Guides: 'Guides',
  'Tank Quests': 'Tank',
  'Healer Quests': 'Heal',
  'DPS Quests': 'DPS',
  'Disciple of the Land': 'Land',
  'Disciple of the Hand': 'Hand',
  'Role Quests': 'Role',
  'Tank Role Quests': 'Tank',
  'Healer Role Quests': 'Heal',
  'Melee DPS Role Quests': 'Melee',
  'Ranged DPS Role Quests': 'Ranged',
  'Aether Currents': 'Aether',
  'Deep Dungeons': 'Deep',
  'Palace of the Dead': 'PotD',
  'Heaven-on-High': 'HoH',
  'Eureka Orthos': 'EO',
  'Hildebrand Quests': 'Hildi',
  'Relic Weapons': 'Relic',
  'Zodiac Weapons': 'Zodiac',
  'Anima Weapons': 'Anima',
  'Eureka Weapons': 'Eureka',
  'Resistance Weapons': 'Resist',
  'Manderville Weapons': 'Mande',
  'Phantom Weapons': 'Phantom',
  'Side Quests': 'Side',
  'Orchestrion Rolls': 'Orch',
  Achievements: 'Achv',
  'Crafting & Gathering': 'Craft',
  'Grand Company': 'GC',
  Dungeons: 'Dung',
  Trials: 'Trial',
  Raids: 'Raid',
  'Task Log': 'Tasks',
  'Currency Tracker': 'Currency',
  Ventures: 'Venture',
  'Company Seals': 'Seals',
  'Allagan Tomestones': 'Tomes',
  Mathematics: 'Math',
  'Wolf Mark': 'Wolf',
  'Trophy Crystal': 'Trophy',
  'Job Levels': 'Jobs',
  'Physical Ranged DPS': 'Ranged',
  Paladin: 'PLD',
  Warrior: 'WAR',
  'Dark Knight': 'DRK',
  Gunbreaker: 'GNB',
  'White Mage': 'WHM',
  Arcanist: 'ACN',
  Scholar: 'SCH',
  Astrologian: 'AST',
  Sage: 'SGE',
  Monk: 'MNK',
  Dragoon: 'DRG',
  Ninja: 'NIN',
  Samurai: 'SAM',
  Reaper: 'RPR',
  Viper: 'VPR',
  Bard: 'BRD',
  Machinist: 'MCH',
  Dancer: 'DNC',
  'Black Mage': 'BLM',
  Summoner: 'SMN',
  'Red Mage': 'RDM',
  'Blue Mage': 'BLU',
  Pictomancer: 'PCT',
  Miner: 'MIN',
  Botanist: 'BTN',
  Fisher: 'FSH',
  Carpenter: 'CRP',
  Blacksmith: 'BSM',
  Armorer: 'ARM',
  Goldsmith: 'GSM',
  Leatherworker: 'LTW',
  Weaver: 'WVR',
  Alchemist: 'ALC',
  Culinarian: 'CUL',
};

function compactSidebarLabel(label) {
  const text = String(label || '').trim();
  if (!text) return '';
  if (SIDEBAR_COMPACT_LABELS[text]) return SIDEBAR_COMPACT_LABELS[text];
  const words = text.split(/\s+/);
  if (words.length > 1) return words.map(word => word[0]).join('').slice(0, 6).toUpperCase();
  return text.length > 10 ? text.slice(0, 10) : text;
}

function setCompactSidebarLabel(el, label) {
  if (el) el.dataset.compactLabel = compactSidebarLabel(label);
}

function makeSidebarLink(href, accentVar, label, pctId, countId) {
  const link = document.createElement('a');
  link.className = 'sidebar-link';
  link.href = href;
  link.style.cssText = `--link-accent: var(${accentVar})`;
  const dot = document.createElement('span');
  dot.className = 'sidebar-dot';
  link.appendChild(dot);
  const labelEl = document.createElement('span');
  labelEl.className = 'sidebar-link-label';
  labelEl.textContent = label;
  setCompactSidebarLabel(labelEl, label);
  link.appendChild(labelEl);
  if (pctId) {
    if (countId) {
      const cnt = document.createElement('span');
      cnt.className = 'sidebar-link-count';
      cnt.setAttribute('data-sidebar-count', countId);
      link.appendChild(cnt);
    }
    const pct = document.createElement('span');
    pct.className = 'sidebar-link-value';
    pct.setAttribute('data-sidebar-pct', pctId);
    pct.textContent = '0%';
    link.appendChild(pct);
  }
  link.addEventListener('click', e => {
    e.preventDefault();
    const target = document.getElementById(href.slice(1));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  return link;
}

function buildSidebarNav() {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;

  const makeCollapsibleGroup = (label, accent, children, pctId) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'sidebar-guide-group';
    wrapper.style.cssText = `--guide-accent: var(${accent})`;
    const title = document.createElement('div');
    title.className = 'sidebar-guide-title';
    const chev = document.createElement('span');
    chev.className = 'guide-chev';
    chev.textContent = '▶';
    title.appendChild(chev);
    const labelSpan = document.createElement('span');
    labelSpan.className = 'sidebar-link-label';
    labelSpan.style.flex = '1';
    labelSpan.textContent = label;
    setCompactSidebarLabel(labelSpan, label);
    title.appendChild(labelSpan);
    if (pctId) {
      const pctSpan = document.createElement('span');
      pctSpan.className = 'sidebar-group-pct';
      pctSpan.setAttribute('data-sidebar-pct', pctId);
      pctSpan.textContent = '0%';
      title.appendChild(pctSpan);
    }
    title.addEventListener('click', () => wrapper.classList.toggle('open'));
    const childWrap = document.createElement('div');
    childWrap.className = 'sidebar-guide-children';
    children.forEach(c => childWrap.appendChild(c));
    wrapper.appendChild(title);
    wrapper.appendChild(childWrap);
    return wrapper;
  };

  // Expansion links
  ATLAS.forEach(exp => {
    nav.appendChild(makeSidebarLink('#exp-' + exp.id, `--${exp.accent}`, EXP_NAMES[exp.id] || exp.id, exp.id));
  });

  const sep = document.createElement('div');
  sep.className = 'sidebar-section-label';
  sep.style.marginTop = '10px';
  sep.textContent = 'Side Content';
  setCompactSidebarLabel(sep, sep.textContent);
  nav.appendChild(sep);

  // Role/class groups
  const roleGroups = [
    { label: 'Tank Quests', accent: '--tank', cardId: 'tank', jobs: [
      { href: '#job-pld', text: 'Paladin' },
      { href: '#job-war', text: 'Warrior' },
      { href: '#job-drk', text: 'Dark Knight' },
      { href: '#job-gnb', text: 'Gunbreaker' },
    ]},
    { label: 'Healer Quests', accent: '--healer', cardId: 'healer', jobs: [
      { href: '#job-whm', text: 'White Mage' },
      { href: '#job-acn', text: 'Arcanist' },
      { href: '#job-sch', text: 'Scholar' },
      { href: '#job-ast', text: 'Astrologian' },
      { href: '#job-sge', text: 'Sage' },
    ]},
    { label: 'DPS Quests', accent: '--dps', cardId: 'dps', jobs: [
      { href: '#job-mnk', text: 'Monk' },
      { href: '#job-drg', text: 'Dragoon' },
      { href: '#job-nin', text: 'Ninja' },
      { href: '#job-sam', text: 'Samurai' },
      { href: '#job-rpr', text: 'Reaper' },
      { href: '#job-vpr', text: 'Viper' },
      { href: '#job-brd', text: 'Bard' },
      { href: '#job-mch', text: 'Machinist' },
      { href: '#job-dnc', text: 'Dancer' },
      { href: '#job-blm', text: 'Black Mage' },
      { href: '#job-smn', text: 'Summoner' },
      { href: '#job-rdm', text: 'Red Mage' },
      { href: '#job-blu', text: 'Blue Mage' },
      { href: '#job-pct', text: 'Pictomancer' },
    ]},
  ];

  roleGroups.forEach(group => {
    nav.appendChild(makeCollapsibleGroup(
      group.label, group.accent,
      group.jobs.map(j => makeSidebarLink(j.href, group.accent, j.text, j.href.replace('#job-', ''))),
      group.cardId
    ));
  });

  const discipleGroups = [
    { label: 'Disciple of the Land', accent: '--dol', cardId: 'dol', jobs: [
      { href: '#job-min', text: 'Miner' },
      { href: '#job-btn', text: 'Botanist' },
      { href: '#job-fsh', text: 'Fisher' },
    ]},
    { label: 'Disciple of the Hand', accent: '--doh', cardId: 'doh', jobs: [
      { href: '#job-crp', text: 'Carpenter' },
      { href: '#job-bsm', text: 'Blacksmith' },
      { href: '#job-arm', text: 'Armorer' },
      { href: '#job-gsm', text: 'Goldsmith' },
      { href: '#job-ltw', text: 'Leatherworker' },
      { href: '#job-wvr', text: 'Weaver' },
      { href: '#job-alc', text: 'Alchemist' },
      { href: '#job-cul', text: 'Culinarian' },
    ]},
  ];

  discipleGroups.forEach(group => {
    nav.appendChild(makeCollapsibleGroup(
      group.label, group.accent,
      group.jobs.map(j => makeSidebarLink(j.href, group.accent, j.text, j.href.replace('#job-', ''))),
      group.cardId
    ));
  });

  // Role Quests group
  nav.appendChild(makeCollapsibleGroup('Role Quests', '--dps', [
    makeSidebarLink('#exp-role-tank',   '--tank',   'Tank Role Quests',      'role-tank'),
    makeSidebarLink('#exp-role-healer', '--healer', 'Healer Role Quests',    'role-healer'),
    makeSidebarLink('#exp-role-melee',  '--dps',    'Melee DPS Role Quests', 'role-melee'),
    makeSidebarLink('#exp-role-ranged', '--dps',    'Ranged DPS Role Quests','role-ranged'),
  ], 'role'));

  // Aether Currents group — built after data is loaded so AETHER_CURRENTS_DATA is available
  nav.appendChild(makeCollapsibleGroup(
    'Aether Currents', '--dt',
    AETHER_CURRENTS_DATA.map(exp => makeSidebarLink(`#exp-aether-${exp.accent}`, `--${exp.accent}`, exp.label, `aether-${exp.id}`)),
    'aether'
  ));

  nav.appendChild(makeCollapsibleGroup('Deep Dungeons', '--recur', [
    makeSidebarLink('#job-deep-potd', '--recur', 'Palace of the Dead', 'deep-potd'),
    makeSidebarLink('#job-deep-hoh',  '--recur', 'Heaven-on-High',     'deep-hoh'),
    makeSidebarLink('#job-deep-eo',   '--recur', 'Eureka Orthos',      'deep-eo'),
  ], 'deep'));
  nav.appendChild(makeCollapsibleGroup('Hildebrand Quests', '--recur', [
    makeSidebarLink('#job-hildi-arr', '--recur', 'A Realm Reborn', 'hildi-arr'),
    makeSidebarLink('#job-hildi-hw',  '--recur', 'Heavensward',    'hildi-hw'),
    makeSidebarLink('#job-hildi-sb',  '--recur', 'Stormblood',     'hildi-sb'),
    makeSidebarLink('#job-hildi-ew',  '--recur', 'Endwalker',      'hildi-ew'),
    makeSidebarLink('#job-hildi-dt',  '--recur', 'Dawntrail',      'hildi-dt'),
  ], 'hildi'));
  nav.appendChild(makeCollapsibleGroup('Relic Weapons', '--recur', [
    makeSidebarLink('#job-relic-arr', '--recur', 'Zodiac Weapons',      'relic-arr'),
    makeSidebarLink('#job-relic-hw',  '--recur', 'Anima Weapons',       'relic-hw'),
    makeSidebarLink('#job-relic-sb',  '--recur', 'Eureka Weapons',      'relic-sb'),
    makeSidebarLink('#job-relic-shb', '--recur', 'Resistance Weapons',  'relic-shb'),
    makeSidebarLink('#job-relic-ew',  '--recur', 'Manderville Weapons', 'relic-ew'),
    makeSidebarLink('#job-relic-dt',  '--recur', 'Phantom Weapons',     'relic-dt'),
  ], 'relic'));
  nav.appendChild(makeCollapsibleGroup('Side Quests', '--recur', [
    makeSidebarLink('#exp-sidequests', '--recur', 'A Realm Reborn',  'sq-exp-arr'),
    makeSidebarLink('#exp-sidequests', '--recur', 'Heavensward',     'sq-exp-hw'),
    makeSidebarLink('#exp-sidequests', '--recur', 'Stormblood',      'sq-exp-sb'),
    makeSidebarLink('#exp-sidequests', '--recur', 'Shadowbringers',  'sq-exp-shb'),
    makeSidebarLink('#exp-sidequests', '--recur', 'Endwalker',       'sq-exp-ew'),
    makeSidebarLink('#exp-sidequests', '--recur', 'Dawntrail',       'sq-exp-dt'),
  ], 'sidequests'));
  if (typeof ORCHESTRION_DATA !== 'undefined' && ORCHESTRION_DATA) {
    nav.appendChild(makeCollapsibleGroup('Orchestrion Rolls', '--recur',
      ORCHESTRION_DATA.map(sec => makeSidebarLink('#exp-orchestrion', '--recur', sec.title, sec.id)),
      'orchestrion'
    ));
  }
  if (typeof MOUNTS_DATA !== 'undefined' && MOUNTS_DATA) {
    nav.appendChild(makeCollapsibleGroup('Mounts', '--recur',
      MOUNTS_DATA.map(sec => makeSidebarLink('#exp-mounts', '--recur', sec.title, sec.id)),
      'mounts'
    ));
  }
  if (typeof MINIONS_DATA !== 'undefined' && MINIONS_DATA) {
    nav.appendChild(makeCollapsibleGroup('Minions', '--recur',
      MINIONS_DATA.map(sec => makeSidebarLink('#exp-minions', '--recur', sec.title, sec.id)),
      'minions'
    ));
  }
  if (typeof TRIPLE_TRIAD_DATA !== 'undefined' && TRIPLE_TRIAD_DATA) {
    nav.appendChild(makeCollapsibleGroup('Triple Triad Cards', '--recur',
      TRIPLE_TRIAD_DATA.map(sec => makeSidebarLink('#exp-triple-triad', '--recur', sec.title, sec.id)),
      'triple-triad'
    ));
  }
  nav.appendChild(makeCollapsibleGroup('Achievements', '--recur', [
    makeSidebarLink('#ach-battle',      '--recur', 'Battle',              'ach-battle',      'ach-battle'),
    makeSidebarLink('#ach-pvp',         '--recur', 'PvP',                 'ach-pvp',         'ach-pvp'),
    makeSidebarLink('#ach-character',   '--recur', 'Character',           'ach-character',   'ach-character'),
    makeSidebarLink('#ach-items',       '--recur', 'Items',               'ach-items',       'ach-items'),
    makeSidebarLink('#ach-crafting',    '--recur', 'Crafting & Gathering', 'ach-crafting',    'ach-crafting'),
    makeSidebarLink('#ach-quests',      '--recur', 'Quests',               'ach-quests',      'ach-quests'),
    makeSidebarLink('#ach-exploration', '--recur', 'Exploration',          'ach-exploration', 'ach-exploration'),
    makeSidebarLink('#ach-gc',          '--recur', 'Grand Company',        'ach-gc',          'ach-gc'),
  ], 'ach'));

  const sep2 = document.createElement('div');
  sep2.className = 'sidebar-section-label';
  sep2.style.marginTop = '10px';
  sep2.textContent = 'Guides';
  setCompactSidebarLabel(sep2, sep2.textContent);
  nav.appendChild(sep2);

  const guideGroups = [
    { label: 'A Realm Reborn', accent: '--arr', entries: [
      { href: '#guide-dungeons',    text: 'Dungeons' },
      { href: '#guide-trials',      text: 'Trials'   },
      { href: '#guide-raids',       text: 'Raids'    },
    ]},
    { label: 'Heavensward', accent: '--hw', entries: [
      { href: '#guide-hw-dungeons', text: 'Dungeons' },
      { href: '#guide-hw-trials',   text: 'Trials'   },
      { href: '#guide-hw-raids',    text: 'Raids'    },
    ]},
    { label: 'Stormblood', accent: '--sb', entries: [
      { href: '#guide-sb-dungeons', text: 'Dungeons' },
      { href: '#guide-sb-trials',   text: 'Trials'   },
      { href: '#guide-sb-raids',    text: 'Raids'    },
    ]},
    { label: 'Shadowbringers', accent: '--shb', entries: [
      { href: '#guide-shb-dungeons', text: 'Dungeons' },
      { href: '#guide-shb-trials',   text: 'Trials'   },
      { href: '#guide-shb-raids',    text: 'Raids'    },
    ]},
    { label: 'Endwalker', accent: '--ew', entries: [
      { href: '#guide-ew-dungeons', text: 'Dungeons' },
      { href: '#guide-ew-trials',   text: 'Trials'   },
      { href: '#guide-ew-raids',    text: 'Raids'    },
    ]},
    { label: 'Dawntrail', accent: '--dt', entries: [
      { href: '#guide-dt-dungeons', text: 'Dungeons' },
      { href: '#guide-dt-trials',   text: 'Trials'   },
      { href: '#guide-dt-raids',    text: 'Raids'    },
    ]},
  ];

  guideGroups.forEach(group => {
    nav.appendChild(makeCollapsibleGroup(
      group.label, group.accent,
      group.entries.map(e => makeSidebarLink(e.href, group.accent, e.text))
    ));
  });

}

function buildRightSidebarCurrency() {
  const wrap = document.getElementById('right-sidebar-currency');
  if (!wrap) return;

  const taskLabel = document.createElement('div');
  taskLabel.className = 'sidebar-section-label right-sidebar-section-label';
  taskLabel.textContent = 'Task Log';
  setCompactSidebarLabel(taskLabel, taskLabel.textContent);
  wrap.appendChild(taskLabel);
  wrap.appendChild(makeSidebarLink('#exp-recur', '--recur', 'Task Log'));

  const label = document.createElement('div');
  label.className = 'sidebar-section-label right-sidebar-section-label';
  label.style.marginTop = '8px';
  label.textContent = 'Currency Tracker';
  setCompactSidebarLabel(label, label.textContent);
  wrap.appendChild(label);

  const gilLink = makeSidebarLink('#exp-gil', '--ew', 'Gil');
  const gilAmt = document.createElement('span');
  gilAmt.id = 'sidebar-gil-amount';
  gilAmt.className = 'sidebar-link-value';
  gilAmt.textContent = gilData.length ? formatGil(gilData[gilData.length - 1].amount) : '';
  gilLink.appendChild(gilAmt);
  wrap.appendChild(gilLink);

  const ventureLink = makeSidebarLink('#exp-venture', '--dt', 'Ventures');
  const ventureAmt = document.createElement('span');
  ventureAmt.id = 'sidebar-venture-amount';
  ventureAmt.className = 'sidebar-link-value';
  ventureAmt.textContent = ventureData.length ? `${ventureData[ventureData.length - 1].amount.toLocaleString()} / 65,535` : '';
  ventureLink.appendChild(ventureAmt);
  wrap.appendChild(ventureLink);

  const mgpLink = makeSidebarLink('#exp-mgp', '--shb', 'MGP');
  const mgpAmt = document.createElement('span');
  mgpAmt.id = 'sidebar-mgp-amount';
  mgpAmt.className = 'sidebar-link-value';
  mgpAmt.textContent = mgpData.length ? `${formatGil(mgpData[mgpData.length - 1].amount)} / 9.99M` : '';
  mgpLink.appendChild(mgpAmt);
  wrap.appendChild(mgpLink);

  const sealLink = makeSidebarLink('#exp-seals', '--sb', 'Company Seals');
  const sealAmt = document.createElement('span');
  sealAmt.id = 'sidebar-seal-amount';
  sealAmt.className = 'sidebar-link-value';
  const sealCap  = GC_RANKS.find(r => r.name === sealRank)?.cap || 90000;
  const sealLast = sealEntries.length ? sealEntries[sealEntries.length - 1].amount : null;
  sealAmt.textContent = sealLast !== null ? `${sealLast.toLocaleString()} / ${sealCap.toLocaleString()}` : '';
  sealLink.appendChild(sealAmt);
  wrap.appendChild(sealLink);

  const tomesLabel = document.createElement('div');
  tomesLabel.className = 'sidebar-section-label right-sidebar-section-label';
  tomesLabel.style.marginTop = '8px';
  tomesLabel.textContent = 'Allagan Tomestones';
  setCompactSidebarLabel(tomesLabel, tomesLabel.textContent);
  wrap.appendChild(tomesLabel);

  [
    { id: 'sidebar-poetics-amount',     data: poeticsData,     label: 'Poetics'     },
    { id: 'sidebar-mathematics-amount', data: mathematicsData, label: 'Mathematics' },
    { id: 'sidebar-mnomics-amount',     data: mnomicsData,     label: 'Mnomics'     },
  ].forEach(({ id, data, label }) => {
    const link = makeSidebarLink('#exp-tomestones', '--hw', label);
    const amt = document.createElement('span');
    amt.id = id;
    amt.className = 'sidebar-link-value';
    const last = data.length ? data[data.length - 1].amount : null;
    amt.textContent = last !== null ? `${last.toLocaleString()} / 2,000` : '';
    link.appendChild(amt);
    wrap.appendChild(link);
  });

  const pvpLabel = document.createElement('div');
  pvpLabel.className = 'sidebar-section-label right-sidebar-section-label';
  pvpLabel.style.marginTop = '8px';
  pvpLabel.textContent = 'PvP';
  setCompactSidebarLabel(pvpLabel, pvpLabel.textContent);
  wrap.appendChild(pvpLabel);

  [
    { id: 'sidebar-wolf-mark-amount',      data: wolfMarkData,      label: 'Wolf Mark'      },
    { id: 'sidebar-trophy-crystal-amount', data: trophyCrystalData, label: 'Trophy Crystal' },
  ].forEach(({ id, data, label }) => {
    const link = makeSidebarLink('#exp-pvp', '--crimson', label);
    const amt = document.createElement('span');
    amt.id = id;
    amt.className = 'sidebar-link-value';
    const last = data.length ? data[data.length - 1].amount : null;
    amt.textContent = last !== null ? `${last.toLocaleString()} / 20,000` : '';
    link.appendChild(amt);
    wrap.appendChild(link);
  });

  // Job & class levels — one collapsible block per role (collapsed by default),
  // each job linking to the Job Levels tracker card.
  const jobLabel = document.createElement('div');
  jobLabel.className = 'sidebar-section-label right-sidebar-section-label';
  jobLabel.style.marginTop = '8px';
  jobLabel.textContent = 'Job Levels';
  setCompactSidebarLabel(jobLabel, jobLabel.textContent);
  wrap.appendChild(jobLabel);

  JOB_GROUPS.forEach(group => {
    const groupEl = document.createElement('div');
    groupEl.className = 'sidebar-guide-group';
    groupEl.style.cssText = `--guide-accent: var(${group.accent})`;

    const title = document.createElement('div');
    title.className = 'sidebar-guide-title';
    const chev = document.createElement('span');
    chev.className = 'guide-chev';
    chev.textContent = '▶';
    title.appendChild(chev);
    const labelSpan = document.createElement('span');
    labelSpan.className = 'sidebar-link-label';
    labelSpan.style.flex = '1';
    labelSpan.textContent = group.label;
    setCompactSidebarLabel(labelSpan, group.label);
    title.appendChild(labelSpan);
    title.addEventListener('click', () => groupEl.classList.toggle('open'));
    groupEl.appendChild(title);

    const childWrap = document.createElement('div');
    childWrap.className = 'sidebar-guide-children';
    group.jobs.forEach(job => {
      const link = makeSidebarLink('#exp-jobs', group.accent, job.name);
      const amt = document.createElement('span');
      amt.id = `sidebar-joblvl-${job.id}-amount`;
      amt.className = 'sidebar-link-value';
      amt.textContent = jobLevelText(job);
      link.appendChild(amt);
      childWrap.appendChild(link);
    });
    groupEl.appendChild(childWrap);
    wrap.appendChild(groupEl);
  });
}

// Current level for a job = the amount of its most recent time-series entry,
// or null if nothing has been logged yet.
function jobLevelCurrent(jobId) {
  const series = jobLevels[jobId];
  return (Array.isArray(series) && series.length) ? series[series.length - 1].amount : null;
}

// "Lv NN / MAX" for a tracked job, or "— / MAX" when no level is recorded yet.
function jobLevelText(job) {
  const lvl = jobLevelCurrent(job.id);
  return lvl != null ? `Lv ${lvl} / ${job.max}` : `— / ${job.max}`;
}

// Repaint every job's sidebar value and card input/display from `jobLevels`.
// Used after a save file is loaded.
function refreshJobLevels() {
  ALL_JOBS.forEach(job => {
    const sb = document.getElementById(`sidebar-joblvl-${job.id}-amount`);
    if (sb) sb.textContent = jobLevelText(job);
    const disp = document.getElementById(`joblvl-${job.id}-display`);
    if (disp) disp.textContent = jobLevelText(job);
    const input = document.getElementById(`joblvl-${job.id}-input`);
    if (input) input.value = String(jobLevelCurrent(job.id) ?? 0);
    const graphCurrent = document.getElementById(`joblvl-${job.id}-graph-current`);
    if (graphCurrent) graphCurrent.textContent = jobLevelText(job);
  });
  // If the history modal is open, re-render it against the refreshed data.
  if (typeof currentJobModal !== 'undefined' && currentJobModal &&
      document.getElementById('job-history-panel')?.classList.contains('open')) {
    renderJobHistoryGraph(currentJobModalRange);
  }
}

// ─── Activity tracker collapse ─────────────────────────────────────────────
function initActivityTracker() {
  const header = document.getElementById('activity-graph-header');
  const body   = document.getElementById('activity-graph-body');
  const chev   = document.getElementById('activity-chev');
  if (!header || !body || !chev) return;

  const applyState = expanded => {
    body.classList.toggle('collapsed', !expanded);
    chev.classList.toggle('open', expanded);
    ui.activityExpanded = expanded;
  };

  applyState(ui.activityExpanded !== false);
  header.addEventListener('click', () => {
    applyState(body.classList.contains('collapsed'));
    saveUI();
  });
}

// ─── Scroll spy ───────────────────────────────────────────────────────────
function initScrollSpy() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const link = document.querySelector(`.sidebar-link[href="#${entry.target.id}"]`);
      if (link) link.classList.toggle('active', entry.isIntersecting);
    });
  }, { rootMargin: '-8% 0px -80% 0px' });

  const ids = [
    ...ATLAS.map(exp => 'exp-' + exp.id),
    'exp-deep', 'exp-hildi', 'exp-relic', 'exp-recur',
    ...AETHER_CURRENTS_DATA.map(exp => `exp-aether-${exp.accent}`),
    'job-pld', 'job-war', 'job-drk', 'job-gnb',
    'job-whm', 'job-acn', 'job-sch', 'job-ast', 'job-sge',
    'job-mnk', 'job-drg', 'job-nin', 'job-sam', 'job-rpr', 'job-vpr',
    'job-brd', 'job-mch', 'job-dnc', 'job-blm', 'job-smn', 'job-rdm', 'job-blu', 'job-pct',
    'job-min', 'job-btn', 'job-fsh',
    'job-crp', 'job-bsm', 'job-arm', 'job-gsm', 'job-ltw', 'job-wvr', 'job-alc', 'job-cul',
    'guide-dungeons',    'guide-trials',    'guide-raids',
    'guide-hw-dungeons', 'guide-hw-trials', 'guide-hw-raids',
    'guide-sb-dungeons', 'guide-sb-trials', 'guide-sb-raids',
    'guide-shb-dungeons','guide-shb-trials','guide-shb-raids',
    'guide-ew-dungeons', 'guide-ew-trials', 'guide-ew-raids',
    'guide-dt-dungeons', 'guide-dt-trials', 'guide-dt-raids',
    'exp-gil', 'exp-mgp', 'exp-venture', 'exp-seals', 'exp-tomestones', 'exp-pvp', 'exp-jobs',
  ];

  ids.forEach(id => {
    const card = document.getElementById(id);
    if (card) observer.observe(card);
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────────
(async () => {
  await loadData();
  await loadState();
  loadActivity();
  checkAutoReset();
  scheduleRecurringResetCheck();
  applyStartingCityData();
  build();
  buildSidebarNav();
  buildRightSidebarCurrency();
  initSidebarSearch();
  syncDates();
  render();
  applyGrandCompany(ui.grandCompany || null);
  applyActivityHidden(!!ui.hideActivity);
  applyCompactSidebar(!!ui.compactSidebar);
  renderActivityGraph();
  initActivityTracker();
  initScrollSpy();
  initStartingCity();
  initDataCenter();
  initDesktopShell();
})();
