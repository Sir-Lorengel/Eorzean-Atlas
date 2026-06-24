'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// SEARCH  —  data-model index + ranked results dropdown (jump-to navigation)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Duty-type index (used by ui.js for unlock markers) ───────────────────
let dutyTypeByName = null;
let achievementMarkersByName = null;

function ensureDutyTypeIndex() {
  if (dutyTypeByName) return;
  dutyTypeByName = {};

  const typeForSection = sec => {
    const sid   = String(sec.id    || '').toLowerCase();
    const title = String(sec.title || '').toLowerCase();
    if (sid.includes('-tri-') || title.includes('trial')) return 'trial';
    if (sid.includes('-rai-') || title.includes('raid'))  return 'raid';
    return 'dungeon';
  };

  const addDuty = (name, type) => {
    const key = normalizeQuestKey(name);
    if (key && !dutyTypeByName[key]) dutyTypeByName[key] = type;
  };

  ATLAS.forEach(exp => {
    if (exp.patchOnly) return;
    exp.categories.forEach(cat => {
      if (cat.isMsq) return;
      cat.sections.forEach(sec => sec.quests.forEach(q => addDuty(q.name || q, typeForSection(sec))));
    });
  });

  [
    ARR_DUNGEON_GUIDES, ARR_TRIAL_GUIDES, ARR_RAID_GUIDES,
    HW_DUNGEON_GUIDES, HW_TRIAL_GUIDES, HW_RAID_GUIDES,
    SB_DUNGEON_GUIDES, SB_TRIAL_GUIDES, SB_RAID_GUIDES,
    SHB_DUNGEON_GUIDES, SHB_TRIAL_GUIDES, SHB_RAID_GUIDES,
    EW_DUNGEON_GUIDES, EW_TRIAL_GUIDES, EW_RAID_GUIDES,
    DT_DUNGEON_GUIDES, DT_TRIAL_GUIDES, DT_RAID_GUIDES,
  ].forEach(sections => {
    if (!Array.isArray(sections)) return;
    sections.forEach(sec => {
      const t = typeForSection(sec);
      (sec.dungeons || []).forEach(d => addDuty(d.name, t));
    });
  });
}

function dutyTypeForName(name) {
  ensureDutyTypeIndex();
  return dutyTypeByName[normalizeQuestKey(name)] || 'unknown';
}

// ─── Unlock lookups (used by ui.js) ───────────────────────────────────────
function classUnlocks(name) {
  const all = CLASS_UNLOCK_MARKERS[normalizeQuestKey(name)] || [];
  return all.length ? all : null;
}

function questUnlocks(name) {
  const key = normalizeQuestKey(qName(name));
  const all = [
    ...(MSQ_UNLOCK_MARKERS[key]  || []),
    ...(MSQ_FEATURE_MARKERS[key] || []),
  ];
  return all.length ? all : null;
}

function ensureAchievementMarkerIndex() {
  if (achievementMarkersByName) return achievementMarkersByName;
  achievementMarkersByName = {};
  const seen = {};
  const achievementsByName = {};

  Object.values(ACHIEVEMENTS_DATA || {}).flat().forEach(sec => {
    if (!sec || !Array.isArray(sec.quests)) return;
    sec.quests.forEach(entry => {
      const key = normalizeQuestKey(entry.name).toLowerCase();
      if (!achievementsByName[key]) achievementsByName[key] = { name: entry.name, tag: entry.tag, desc: entry.desc };
    });
  });

  const addAchievementTarget = (targetName, achievement) => {
    const key = normalizeQuestKey(targetName);
    if (!key) return;
    if (!achievementMarkersByName[key]) achievementMarkersByName[key] = [];
    if (!seen[key]) seen[key] = new Set();
    const sig = `${achievement.name}::${achievement.tag || ''}`;
    if (seen[key].has(sig)) return;
    seen[key].add(sig);
    achievementMarkersByName[key].push(achievement);
  };

  const explicitAchievementTargets = {
    ...(typeof DUTY_ACHIEVEMENTS_DATA !== 'undefined' ? DUTY_ACHIEVEMENTS_DATA : {}),
    ...(typeof MSQ_ACHIEVEMENTS_DATA !== 'undefined' ? MSQ_ACHIEVEMENTS_DATA : {}),
  };
  Object.entries(explicitAchievementTargets).forEach(([targetName, achievementNames]) => {
    (achievementNames || []).forEach(name => {
      const achievement = achievementsByName[normalizeQuestKey(name).toLowerCase()] || { name, tag: '' };
      addAchievementTarget(targetName, achievement);
    });
  });

  return achievementMarkersByName;
}

function achievementMarkersForName(name) {
  const key = normalizeQuestKey(qName(name));
  if (!key) return null;
  const markers = ensureAchievementMarkerIndex()[key] || [];
  return markers.length ? markers : null;
}

function findInternalPillTarget(name, preferredGroups = []) {
  const key = normalizeQuestKey(name).toLowerCase();
  if (!key) return null;
  if (!SEARCH_RECORDS) buildSearchIndex();
  const matches = (SEARCH_RECORDS || []).filter(rec =>
    normalizeQuestKey(rec.label).toLowerCase() === key
  );
  if (!matches.length) return null;

  for (const group of preferredGroups) {
    const hit = matches.find(rec => rec.group === group);
    if (hit) return hit;
  }
  return matches[0];
}

function buildInternalPill(label, targetName, className, preferredGroups = [], fallbackHref = '#atlas-body', attrs = {}) {
  return el('a', {
    ...attrs,
    class: className,
    href: fallbackHref,
    onclick: e => {
      e.stopPropagation();
      const target = findInternalPillTarget(targetName || label, preferredGroups);
      if (!target) return;
      e.preventDefault();
      gotoResult(target);
    },
  }, label);
}

// ─── Unlock marker DOM builder (used by ui.js) ────────────────────────────
function buildUnlockMarker(unlocks) {
  if (!unlocks || !unlocks.length) return null;
  const wrap = el('span', { class: 'quest-unlock' }, '↳ unlocks:');
  unlocks.forEach(entry => {
    const name = typeof entry === 'string' ? entry : entry.name;
    const t    = typeof entry === 'string' ? dutyTypeForName(name) : entry.type;
    const isDuty = ['dungeon', 'trial', 'raid'].includes(t);
    const preferredGroups = ['dungeon', 'trial', 'raid'].includes(t)
      ? ['Dungeons & Bosses', 'Quests']
      : ['Quests', 'Dungeons & Bosses', 'Jobs'];
    wrap.appendChild(buildInternalPill(
      name,
      name,
      `unlock-pill unlock-${t}`,
      preferredGroups,
      isDuty ? '#guide-dungeons' : '#atlas-body'
    ));
  });
  return wrap;
}

function buildAchievementMarker(achievements) {
  if (!achievements || !achievements.length) return null;
  const wrap = el('span', { class: 'quest-unlock quest-achievement' }, '↳ achievement:');
  achievements.forEach(entry => {
    const label = entry.tag ? `${entry.name} (${entry.tag})` : entry.name;
    const attrs = { class: 'unlock-pill unlock-achievement' };
    if (entry.desc) {
      attrs['data-ach-desc'] = entry.desc;
      attrs.title = entry.desc;
    }
    wrap.appendChild(buildInternalPill(
      label,
      entry.name,
      attrs.class,
      ['Achievements'],
      '#exp-achievements',
      attrs
    ));
  });
  return wrap;
}

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH ENGINE  —  index built from the data model, not the rendered DOM.
// This keeps search decoupled from progressive reveal, render, and highlight
// mutation. Results are shown in a dropdown that jumps to (and flashes) the
// matching element; the main body is never hidden or mutated.
// ═══════════════════════════════════════════════════════════════════════════

const MAX_RESULTS = 40;

// Each record: { label, labelLower, group, sub, extraLower, selector }
//   selector — resolves to a stable DOM anchor at click time.
let SEARCH_RECORDS = null;

// Display/tie-break weight per group (only breaks ties within a match tier).
const GROUP_WEIGHT = {
  'Expansions':         6,
  'Jobs':               5,
  'Sections':           4,
  'Quests':             3,
  'Dungeons & Bosses':  2,
  'Mounts':             2,
  'Minions':            2,
  'Orchestrion Rolls':  2,
  'Triple Triad Cards': 2,
  'Achievements':       1,
};

const ACH_LABELS = {
  battle: 'Battle', pvp: 'PvP', character: 'Character', items: 'Items',
  crafting: 'Crafting & Gathering', quests: 'Quests',
  exploration: 'Exploration', gc: 'Grand Company',
};

const labelOfQuest = q => typeof q === 'string' ? q : (q && q.name) || '';

// ─── Index builder (from data globals) ─────────────────────────────────────
function buildSearchIndex() {
  const records = [];

  const add = (label, group, sub, selector, extra) => {
    const clean = String(label || '').trim();
    if (!clean) return;
    records.push({
      label: clean,
      labelLower: clean.toLowerCase(),
      group,
      sub: sub || '',
      extraLower: extra ? String(extra).toLowerCase() : '',
      selector,
    });
  };

  const addSectionQuests = (sec, sub) => {
    if (!sec || !Array.isArray(sec.quests)) return;
    sec.quests.forEach((q, i) => {
      add(labelOfQuest(q), 'Quests', sub, `[data-id="${sec.id}-${i}"]`);
    });
  };

  const addQuestGroup = (roleGroups) => {
    if (!Array.isArray(roleGroups)) return;
    roleGroups.forEach(rg => {
      (rg.jobs || []).forEach(job => {
        if (job.id && job.label) add(job.label, 'Jobs', '', `#job-${job.id}`);
        [...(job.sections || []), ...(job.huntSections || [])]
          .forEach(sec => addSectionQuests(sec, job.label));
      });
    });
  };

  // 1. Expansions + their MSQ/duty sections and quests
  ATLAS.forEach(exp => {
    const expName = (typeof EXP_NAMES !== 'undefined' && EXP_NAMES[exp.id]) || exp.id;
    add(expName, 'Expansions', '', `#exp-${exp.id}`);
    if (exp.patchOnly) {
      (exp.patches || []).forEach(p =>
        add(p.label, 'Quests', `${expName} · Patches`, `[data-id="${p.id}"]`));
      return;
    }
    exp.categories.forEach(cat => {
      cat.sections.forEach(sec => {
        add(sec.title, 'Sections', expName, `.section[data-section="${sec.id}"]`);
        addSectionQuests(sec, sec.title);
      });
    });
  });

  // 2. Job / role / recurring quest cards
  addQuestGroup(TANK_QUESTS);
  addQuestGroup(HEALER_QUESTS);
  addQuestGroup(DPS_QUESTS);
  addQuestGroup(DOL_QUESTS);
  addQuestGroup(DOH_QUESTS);
  addQuestGroup(ROLE_QUESTS);
  addQuestGroup(DEEP_DUNGEON_QUESTS);
  addQuestGroup(HILDEBRAND_QUESTS);
  addQuestGroup(RELIC_WEAPONS);

  // 3. Side quests
  if (SIDE_QUESTS_DATA && typeof SQ_EXP_LABELS !== 'undefined') {
    for (const [expKey, expLabel] of Object.entries(SQ_EXP_LABELS)) {
      const secs = SIDE_QUESTS_DATA[expKey];
      if (!Array.isArray(secs)) continue;
      secs.forEach(sec => {
        add(sec.title, 'Sections', expLabel, `.section[data-section="${sec.id}"]`);
        addSectionQuests(sec, `${expLabel} · ${sec.title}`);
      });
    }
  }

  // 4. Achievements
  if (ACHIEVEMENTS_DATA) {
    for (const [dataKey, catLabel] of Object.entries(ACH_LABELS)) {
      const secs = ACHIEVEMENTS_DATA[dataKey];
      if (!Array.isArray(secs)) continue;
      secs.forEach(sec => {
        sec.quests.forEach((q, i) =>
          add(labelOfQuest(q), 'Achievements', catLabel, `[data-id="${sec.id}-${i}"]`));
      });
    }
  }

  // 5. Guides — dungeon/trial/raid names + boss names (searchable by tip too)
  if (typeof MOUNTS_DATA !== 'undefined' && MOUNTS_DATA) {
    MOUNTS_DATA.forEach(sec => {
      add(sec.title, 'Sections', 'Mounts', `.section[data-section="${sec.id}"]`);
      sec.quests.forEach((q, i) =>
        add(labelOfQuest(q), 'Mounts', sec.title, `[data-id="${sec.id}-${i}"]`, q && q.tag));
    });
  }

  if (typeof MINIONS_DATA !== 'undefined' && MINIONS_DATA) {
    MINIONS_DATA.forEach(sec => {
      add(sec.title, 'Sections', 'Minions', `.section[data-section="${sec.id}"]`);
      sec.quests.forEach((q, i) =>
        add(labelOfQuest(q), 'Minions', sec.title, `[data-id="${sec.id}-${i}"]`, q && q.tag));
    });
  }

  if (typeof ORCHESTRION_DATA !== 'undefined' && ORCHESTRION_DATA) {
    ORCHESTRION_DATA.forEach(sec => {
      add(sec.title, 'Sections', 'Orchestrion Rolls', `.section[data-section="${sec.id}"]`);
      sec.quests.forEach((q, i) =>
        add(labelOfQuest(q), 'Orchestrion Rolls', sec.title, `[data-id="${sec.id}-${i}"]`, q && q.tag));
    });
  }

  if (typeof TRIPLE_TRIAD_DATA !== 'undefined' && TRIPLE_TRIAD_DATA) {
    TRIPLE_TRIAD_DATA.forEach(sec => {
      add(sec.title, 'Sections', 'Triple Triad Cards', `.section[data-section="${sec.id}"]`);
      sec.quests.forEach((q, i) =>
        add(labelOfQuest(q), 'Triple Triad Cards', sec.title, `[data-id="${sec.id}-${i}"]`, q && q.tag));
    });
  }

  const guideSets = [
    ARR_DUNGEON_GUIDES, ARR_TRIAL_GUIDES, ARR_RAID_GUIDES,
    HW_DUNGEON_GUIDES,  HW_TRIAL_GUIDES,  HW_RAID_GUIDES,
    SB_DUNGEON_GUIDES,  SB_TRIAL_GUIDES,  SB_RAID_GUIDES,
    SHB_DUNGEON_GUIDES, SHB_TRIAL_GUIDES, SHB_RAID_GUIDES,
    EW_DUNGEON_GUIDES,  EW_TRIAL_GUIDES,  EW_RAID_GUIDES,
    DT_DUNGEON_GUIDES,  DT_TRIAL_GUIDES,  DT_RAID_GUIDES,
  ];
  guideSets.forEach(set => {
    if (!Array.isArray(set)) return;
    set.forEach(sec => {
      (sec.dungeons || []).forEach(d => {
        const sel = `.guide-dungeon[data-guide="${d.id}"]`;
        add(d.name, 'Dungeons & Bosses', d.tag || sec.title, sel);
        (d.bosses || []).forEach(boss =>
          add(boss.name, 'Dungeons & Bosses', d.name, sel, boss.tip));
      });
    });
  });

  // 6. Aether current quests
  if (Array.isArray(AETHER_CURRENTS_DATA)) {
    AETHER_CURRENTS_DATA.forEach(exp => {
      (exp.zones || []).forEach(zone => {
        (zone.quests || []).forEach((qname, i) =>
          add(qname, 'Quests', `${exp.label} · ${zone.name}`, `[data-id="${zone.id}-q-${i}"]`));
      });
    });
  }

  SEARCH_RECORDS = records;
}

// ─── Scoring ────────────────────────────────────────────────────────────────
// AND-all-words. Title (label) matches outrank extra-text (boss tip) matches.
function scoreRecord(rec, words) {
  const t = rec.labelLower;
  const w = GROUP_WEIGHT[rec.group] || 0;
  if (words.every(word => t.includes(word))) {
    const joined = words.join(' ');
    if (t === joined)         return 1000 + w;
    if (t.startsWith(joined)) return 500 + w;
    return 100 + w;
  }
  if (rec.extraLower && words.every(word => rec.extraLower.includes(word))) {
    return 10 + w;
  }
  return 0;
}

function runQuery(words) {
  if (!SEARCH_RECORDS) buildSearchIndex();
  const scored = [];
  const seen = new Set();
  for (const rec of SEARCH_RECORDS) {
    const s = scoreRecord(rec, words);
    if (s <= 0) continue;
    const key = rec.selector + '|' + rec.label;
    if (seen.has(key)) continue;
    seen.add(key);
    scored.push({ rec, s });
  }
  scored.sort((a, b) => b.s - a.s || a.rec.label.length - b.rec.label.length);
  return scored.slice(0, MAX_RESULTS).map(x => x.rec);
}

// ─── Highlight matched words inside a dropdown row (safe — plain text only) ──
function highlightInto(node, label, words) {
  const lo = label.toLowerCase();
  const marks = [];
  words.forEach(w => {
    let from = 0, idx;
    while ((idx = lo.indexOf(w, from)) !== -1) {
      marks.push([idx, idx + w.length]);
      from = idx + w.length;
    }
  });
  if (!marks.length) { node.appendChild(document.createTextNode(label)); return; }
  marks.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [s, e] of marks) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  let pos = 0;
  for (const [s, e] of merged) {
    if (s > pos) node.appendChild(document.createTextNode(label.slice(pos, s)));
    const m = document.createElement('mark');
    m.textContent = label.slice(s, e);
    node.appendChild(m);
    pos = e;
  }
  if (pos < label.length) node.appendChild(document.createTextNode(label.slice(pos)));
}

// ─── Dropdown rendering ─────────────────────────────────────────────────────
let _activeIndex = -1;
let _currentResults = [];

function renderResults(results, words, listEl, emptyEl) {
  listEl.innerHTML = '';
  _currentResults = results;
  _activeIndex = -1;

  if (!results.length) {
    listEl.hidden = true;
    if (emptyEl) emptyEl.classList.add('visible');
    return;
  }
  if (emptyEl) emptyEl.classList.remove('visible');

  // Bucket by group, preserving each group's first-appearance (relevance) order.
  const order = [];
  const buckets = new Map();
  results.forEach(rec => {
    if (!buckets.has(rec.group)) { buckets.set(rec.group, []); order.push(rec.group); }
    buckets.get(rec.group).push(rec);
  });

  // Flatten back into the grouped visual order so keyboard indices stay aligned.
  const ordered = [];
  order.forEach(group => {
    listEl.appendChild(el('li', { class: 'search-result-group', role: 'presentation' }, group));
    buckets.get(group).forEach(rec => {
      const i = ordered.length;
      ordered.push(rec);
      const li = el('li', { class: 'search-result-item', role: 'option', 'data-index': String(i) });
      const labelSpan = el('span', { class: 'search-result-label' });
      highlightInto(labelSpan, rec.label, words);
      li.appendChild(labelSpan);
      if (rec.sub) li.appendChild(el('span', { class: 'search-result-sub' }, rec.sub));
      li.addEventListener('mousedown', e => { e.preventDefault(); gotoResult(rec); });
      listEl.appendChild(li);
    });
  });
  _currentResults = ordered;
  listEl.hidden = false;
}

function setActive(idx, listEl) {
  const items = listEl.querySelectorAll('.search-result-item');
  if (!items.length) return;
  _activeIndex = (idx + items.length) % items.length;
  items.forEach((it, i) => it.classList.toggle('active', i === _activeIndex));
  items[_activeIndex].scrollIntoView({ block: 'nearest' });
}

// ─── Navigation: expand ancestors, scroll to, and flash the target ──────────
function gotoResult(rec) {
  const target = document.querySelector(rec.selector);
  if (!target) return;

  // Open every collapsible ancestor (and the target itself if collapsible).
  let node = target;
  while (node && node.nodeType === 1 && node.id !== 'atlas-body') {
    if (node.classList.contains('section') && node.dataset.section) {
      ui.open[node.dataset.section] = true;
      node.classList.add('open');
    }
    if (node.classList.contains('guide-dungeon') && node.dataset.guide) {
      ui.open[node.dataset.guide] = true;
      node.classList.add('open');
    }
    node = node.parentElement;
  }
  if (typeof saveUI === 'function') saveUI();

  const headSel =
    target.matches('.section')       ? ':scope > .section-head' :
    target.matches('.guide-dungeon') ? ':scope > .guide-dungeon-head' :
    target.matches('.category')      ? ':scope > .category-head' :
    target.matches('.expansion')     ? ':scope > .exp-header' : null;
  const flashEl = (headSel && target.querySelector(headSel)) || target;

  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  flashEl.classList.remove('search-flash');
  void flashEl.offsetWidth; // restart animation
  flashEl.classList.add('search-flash');
  setTimeout(() => flashEl.classList.remove('search-flash'), 1500);

  hideDropdown();
}

// ─── Result count badge ─────────────────────────────────────────────────────
function setResultCount(count, active) {
  const badge = document.getElementById('search-result-count');
  if (!badge) return;
  if (!active) { badge.textContent = ''; badge.hidden = true; return; }
  badge.textContent = count === 0 ? 'No matches' : `${count.toLocaleString()} result${count === 1 ? '' : 's'}`;
  badge.hidden = false;
}

// ─── Dropdown show/hide helpers ─────────────────────────────────────────────
let _listEl = null, _inputEl = null;
function hideDropdown() {
  if (_listEl) { _listEl.hidden = true; _listEl.innerHTML = ''; }
  if (_inputEl) _inputEl.setAttribute('aria-expanded', 'false');
  _currentResults = [];
  _activeIndex = -1;
}

// ─── Wire-up ──────────────────────────────────────────────────────────────
function initSidebarSearch() {
  const input = document.getElementById('sidebar-search');
  const list  = document.getElementById('search-results');
  const empty = document.getElementById('sidebar-search-empty');
  if (!input || !list) return;

  _inputEl = input;
  _listEl  = list;

  let debounceTimer = null;

  const clear = () => {
    clearTimeout(debounceTimer);
    if (empty) empty.classList.remove('visible');
    setResultCount(0, false);
    hideDropdown();
  };

  const runSearch = () => {
    const q     = input.value.trim().toLowerCase();
    const words = q.length >= 2 ? q.split(/\s+/).filter(Boolean) : [];
    if (!words.length) { clear(); return; }

    const results = runQuery(words);
    renderResults(results, words, list, empty);
    setResultCount(results.length, true);
    input.setAttribute('aria-expanded', results.length ? 'true' : 'false');
  };

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, 150);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (_currentResults.length) setActive(_activeIndex + 1, list);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (_currentResults.length) setActive(_activeIndex - 1, list);
    } else if (e.key === 'Enter') {
      if (_activeIndex >= 0 && _currentResults[_activeIndex]) {
        e.preventDefault();
        gotoResult(_currentResults[_activeIndex]);
      } else if (_currentResults.length) {
        e.preventDefault();
        gotoResult(_currentResults[0]);
      }
    } else if (e.key === 'Escape') {
      clearTimeout(debounceTimer);
      input.value = '';
      clear();
      input.blur();
    }
  });

  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 2 && !_currentResults.length) runSearch();
    else if (_currentResults.length) { list.hidden = false; }
  });

  // Native clear button on type="search"
  input.addEventListener('search', () => { if (!input.value) clear(); });

  // Click outside closes the dropdown
  document.addEventListener('mousedown', e => {
    if (!input.contains(e.target) && !list.contains(e.target)) {
      list.hidden = true;
    }
  });
}
