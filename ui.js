'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// UI — DOM element helpers, builders, and render functions
// ═══════════════════════════════════════════════════════════════════════════

// ─── Toast ────────────────────────────────────────────────────────────────

let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ─── Element factory ──────────────────────────────────────────────────────

function el(tag, attrs, ...children) {
  const e = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('data-')) e.setAttribute(k, v);
      else if (k === 'onclick') e.onclick = v;
      else e.setAttribute(k, v);
    }
  }
  for (const c of children) {
    if (c == null) continue;
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  }
  return e;
}

// ─── Quest entry helpers ──────────────────────────────────────────────────
// A quest entry is either a plain string (name only) or an object
// { name, loc, coords, giver } carrying wiki-sourced location/giver metadata.
function qName(q) { return typeof q === 'string' ? q : (q && q.name) || ''; }
function qMetaText(q) {
  if (!q || typeof q === 'string') return '';
  const parts = [q.loc, q.coords, q.giver].filter(Boolean);
  return parts.join(' · ');
}

// ─── Cached element lookups ───────────────────────────────────────────────
let guideByName = null;
let pinnedGuideHoverHost = null;
function guideKey(name) {
  return String(name || '').toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']+/g, ' ').trim();
}
function guideForDutyName(name) {
  if (!guideByName) {
    guideByName = {};
    [
      ARR_DUNGEON_GUIDES, ARR_TRIAL_GUIDES, ARR_RAID_GUIDES,
      HW_DUNGEON_GUIDES, HW_TRIAL_GUIDES, HW_RAID_GUIDES,
      SB_DUNGEON_GUIDES, SB_TRIAL_GUIDES, SB_RAID_GUIDES,
      SHB_DUNGEON_GUIDES, SHB_TRIAL_GUIDES, SHB_RAID_GUIDES,
      EW_DUNGEON_GUIDES, EW_TRIAL_GUIDES, EW_RAID_GUIDES,
      DT_DUNGEON_GUIDES, DT_TRIAL_GUIDES, DT_RAID_GUIDES,
    ].forEach(sections => {
      if (!Array.isArray(sections)) return;
      sections.forEach(sec => (sec.dungeons || []).forEach(duty => {
        const key = guideKey(duty.name);
        if (key && !guideByName[key]) guideByName[key] = duty;
      }));
    });
  }
  return guideByName[guideKey(name)] || null;
}

function setGuideHoverPinned(host, pinned) {
  if (!host) return;
  if (pinnedGuideHoverHost && !pinnedGuideHoverHost.isConnected) pinnedGuideHoverHost = null;
  if (pinned && pinnedGuideHoverHost && pinnedGuideHoverHost !== host) {
    setGuideHoverPinned(pinnedGuideHoverHost, false);
  }
  if (pinned) pinnedGuideHoverHost = host;
  else if (pinnedGuideHoverHost === host) pinnedGuideHoverHost = null;

  host.classList.toggle('guide-hover-pinned', pinned);
  const btn = host.querySelector('.guide-hover-pin');
  if (btn) {
    btn.textContent = pinned ? 'Unpin' : 'Pin';
    btn.setAttribute('aria-pressed', pinned ? 'true' : 'false');
    btn.title = pinned ? 'Let this guide close normally' : 'Keep this guide visible';
  }
}

function buildGuideHover(dungeon, extraClass = '') {
  const hover = el('div', { class: `guide-hover-guide${extraClass ? ` ${extraClass}` : ''}`, role: 'tooltip' });
  hover.onclick = e => e.stopPropagation();
  const pin = el('button', {
    class: 'guide-hover-pin',
    type: 'button',
    'aria-pressed': 'false',
    title: 'Keep this guide visible',
    onclick: e => {
      e.preventDefault();
      e.stopPropagation();
      const host = hover.parentElement;
      if (!host) return;
      setGuideHoverPinned(host, !host.classList.contains('guide-hover-pinned'));
    },
  }, 'Pin');
  hover.appendChild(el('div', { class: 'guide-hover-head' },
    el('div', { class: 'guide-hover-title' }, dungeon.name),
    pin
  ));
  const hoverList = el('ul', { class: 'guide-hover-list' });
  dungeon.bosses.forEach(boss => {
    hoverList.appendChild(el('li', { class: 'guide-hover-row' },
      el('span', { class: 'guide-hover-boss' }, boss.name),
      el('span', { class: 'guide-hover-tip' }, boss.tip)
    ));
  });
  hover.appendChild(hoverList);
  return hover;
}
function appendTaskGuideHover(li, title, hidden = false) {
  if (hidden) return;
  const guide = guideForDutyName(title);
  if (!guide) return;
  li.classList.add('quest-with-guide');
  li.appendChild(buildGuideHover(guide, 'quest-guide-hover'));
}

function appendAchievementMarker(target, title, hidden = false) {
  if (hidden || typeof achievementMarkersForName !== 'function' || typeof buildAchievementMarker !== 'function') return;
  const achievements = achievementMarkersForName(title);
  if (achievements && achievements.length) target.appendChild(buildAchievementMarker(achievements));
}

// The render/update path repeatedly re-finds the same stable elements by
// attribute selector (counts, progress fills, percentages). These nodes are
// created once in build() and never replaced, so we memoize the lookup the
// first time each selector is hit and reuse the cached reference on every
// later render — turning per-render document scans into O(1) Map gets. The
// cache is cleared whenever build() rebuilds the DOM. Dynamic nodes such as
// date chips (added/removed by progressive reveal) must NOT go through here.
const _selCache = new Map();
function cachedSel(selector) {
  const hit = _selCache.get(selector);
  if (hit && hit.isConnected) return hit;
  const found = document.querySelector(selector);
  if (found) _selCache.set(selector, found);
  return found;
}

// ─── Date helpers ─────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '';
  const hasTime = iso.length > 10 && iso.includes('T');
  const d = hasTime ? new Date(iso) : new Date(iso + 'T00:00:00');
  const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  if (!hasTime) return dateStr;
  const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr}, ${timeStr}`;
}

function normalizeQuestKey(name) {
  return String(name || '').trim().replace(/\s+\((Quest|Duty)\)$/i, '');
}

let TASK_QUEST_ID_INDEX = null;

function addTaskQuestIndexSections(sections) {
  if (!Array.isArray(sections)) return;
  sections.forEach(sec => {
    if (!sec || !Array.isArray(sec.quests)) return;
    sec.quests.forEach((q, i) => {
      const key = normalizeQuestKey(qName(q));
      if (!key) return;
      if (!TASK_QUEST_ID_INDEX.has(key)) TASK_QUEST_ID_INDEX.set(key, []);
      TASK_QUEST_ID_INDEX.get(key).push(`${sec.id}-${i}`);
    });
  });
}

function addTaskQuestIndexGroups(groups) {
  if (!Array.isArray(groups)) return;
  groups.forEach(group => {
    if (!group || !Array.isArray(group.jobs)) return;
    group.jobs.forEach(job => addTaskQuestIndexSections([...(job.sections || []), ...(job.huntSections || [])]));
  });
}

function ensureTaskQuestIndex() {
  if (TASK_QUEST_ID_INDEX) return TASK_QUEST_ID_INDEX;
  TASK_QUEST_ID_INDEX = new Map();

  ATLAS.forEach(exp => {
    if (exp.patchOnly) {
      addTaskQuestIndexSections(exp.patches || []);
      return;
    }
    (exp.categories || []).forEach(cat => addTaskQuestIndexSections(cat.sections || []));
  });

  addTaskQuestIndexGroups(TANK_QUESTS);
  addTaskQuestIndexGroups(HEALER_QUESTS);
  addTaskQuestIndexGroups(DPS_QUESTS);
  addTaskQuestIndexGroups(DOL_QUESTS);
  addTaskQuestIndexGroups(DOH_QUESTS);
  addTaskQuestIndexGroups(ROLE_QUESTS);
  addTaskQuestIndexGroups(DEEP_DUNGEON_QUESTS);
  addTaskQuestIndexGroups(HILDEBRAND_QUESTS);
  addTaskQuestIndexGroups(RELIC_WEAPONS);

  if (SIDE_QUESTS_DATA) Object.values(SIDE_QUESTS_DATA).forEach(addTaskQuestIndexSections);
  if (ACHIEVEMENTS_DATA) Object.values(ACHIEVEMENTS_DATA).forEach(addTaskQuestIndexSections);
  if (typeof ORCHESTRION_DATA !== 'undefined' && ORCHESTRION_DATA) addTaskQuestIndexSections(ORCHESTRION_DATA);
  if (typeof MOUNTS_DATA !== 'undefined' && MOUNTS_DATA) addTaskQuestIndexSections(MOUNTS_DATA);
  if (typeof MINIONS_DATA !== 'undefined' && MINIONS_DATA) addTaskQuestIndexSections(MINIONS_DATA);
  if (typeof TRIPLE_TRIAD_DATA !== 'undefined' && TRIPLE_TRIAD_DATA) addTaskQuestIndexSections(TRIPLE_TRIAD_DATA);

  return TASK_QUEST_ID_INDEX;
}

function isTrackedQuestComplete(name) {
  const ids = ensureTaskQuestIndex().get(normalizeQuestKey(name)) || [];
  return ids.some(id => !!checked[id]);
}

function joinTaskRequirementNames(names) {
  if (!names.length) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function taskLockReason(task) {
  const req = task && task.requires;
  if (!req) return null;

  const missingQuests = (req.quests || []).filter(name => !isTrackedQuestComplete(name));
  if (!missingQuests.length) return null;
  return `Requires ${joinTaskRequirementNames(missingQuests)}.`;
}

function applyTaskRowState(li, task) {
  const reason = taskLockReason(task);
  li.dataset.locked = reason ? 'true' : 'false';
  if (li._lockNoteEl) li._lockNoteEl.textContent = reason ? ` · ${reason}` : '';
  if (reason) li.setAttribute('title', reason);
  else li.removeAttribute('title');
}

function refreshTaskLocks() {
  const byId = new Map([...DAILY_TASKS, ...WEEKLY_TASKS].map(t => [t.id, t]));
  document.querySelectorAll('li.quest[data-task-row="true"]').forEach(li => {
    const task = byId.get(li.dataset.id);
    if (task) applyTaskRowState(li, task);
  });
}

function isProgressiveRevealEnabled() {
  return !ui.showAllQuests;
}

function buildDateChip(key) {
  const chip = el('span', { class: dates[key] ? 'date-chip is-set' : 'date-chip', 'data-date-key': key });
  const label = el('span', { class: 'date-label' }, dates[key] ? formatDate(dates[key]) : '+ date');
  const inp = document.createElement('input');
  inp.type = 'date';
  inp.value = dates[key] || localDateStr();
  chip.addEventListener('click', e => e.stopPropagation());
  inp.addEventListener('click', e => e.stopPropagation());
  inp.addEventListener('change', async e => {
    e.stopPropagation();
    if (inp.value) {
      dates[key] = inp.value;
      chip.classList.add('is-set');
      label.textContent = formatDate(inp.value);
    } else {
      delete dates[key];
      chip.classList.remove('is-set');
      label.textContent = '+ date';
    }
    await saveDates();
  });
  chip.append(label, inp);
  return chip;
}

function applyDateChip(chip, key) {
  const labelEl = chip.querySelector('.date-label');
  const inp = chip.querySelector('input[type="date"]');
  if (!labelEl) return;
  if (dates[key]) {
    chip.classList.add('is-set');
    labelEl.textContent = formatDate(dates[key]);
    if (inp) inp.value = dates[key];
  } else {
    chip.classList.remove('is-set');
    labelEl.textContent = '+ date';
    if (inp) inp.value = '';
  }
}

function syncDates() {
  document.querySelectorAll('[data-date-key]').forEach(chip => applyDateChip(chip, chip.dataset.dateKey));
}

function syncDateChip(key) {
  const chip = document.querySelector(`[data-date-key="${key}"]`);
  if (chip) applyDateChip(chip, key);
}

function checkAndAutoFillExpDates() {
  let changed = false;
  for (const exp of ATLAS) {
    if (exp.patchOnly) continue;
    const msqCat = exp.categories.find(c => c.isMsq);
    if (!msqCat) continue;
    const dateKey = `date-exp-${exp.id}`;
    if (dates[dateKey]) continue;
    const allDone = msqCat.sections.every(sec =>
      sec.quests.every((_, i) => checked[`${sec.id}-${i}`])
    );
    if (allDone) {
      dates[dateKey] = localDateTimeStr();
      changed = true;
    }
  }
  return changed;
}

// ─── Expansion card ───────────────────────────────────────────────────────

function buildExpansion(exp) {
  const card = el('div', { class: 'expansion', id: 'exp-' + exp.id, 'data-exp': exp.id, style: `--accent: var(--${exp.accent});` });
  const header = el('div', { class: 'exp-header' });
  const titleWrap = el('div', { class: 'exp-title' },
    el('div', { class: 'exp-num' }, exp.num),
    el('div', { class: 'exp-name', html: exp.emName })
  );
  const counterWrap = el('div');
  const counter = el('div', { class: 'exp-count', 'data-exp-count': exp.id }, '0', el('span', { class: 'total' }, ' / 0'));
  counterWrap.appendChild(counter);
  if (!exp.patchOnly) {
    const mini = el('span', { class: 'exp-count-mini', 'data-exp-mini': exp.id }, '');
    counterWrap.appendChild(mini);
  }
  header.append(titleWrap, counterWrap);
  card.appendChild(header);

  const progRow = el('div', { class: 'exp-progress-row' },
    el('div', { class: 'exp-progress-bar' },
      el('div', { class: 'exp-progress-fill', 'data-exp-fill': exp.id })
    ),
    el('span', { class: 'exp-pct', 'data-exp-pct': exp.id }, '0%')
  );
  card.appendChild(progRow);
  card.appendChild(el('p', { class: 'exp-tagline' }, exp.tagline));
  card.appendChild(el('div', { class: 'exp-date-row' },
    el('span', { class: 'exp-date-label' }, '✦ Expansion completed'),
    buildDateChip(`date-exp-${exp.id}`)
  ));

  const content = el('div', { class: 'exp-content' });
  const leftCol  = el('div', { class: 'col-left' });
  const rightCol = el('div', { class: 'col-right' });

  if (exp.patchOnly) {
    leftCol.appendChild(buildPatchCategory(exp));
    rightCol.appendChild(buildPlaceholderCategory('Dungeons, Trials & Raids'));
  } else {
    const msqCat = exp.categories.find(c => c.isMsq);
    if (msqCat) leftCol.appendChild(buildCategory(exp.id, msqCat));
    exp.categories.filter(c => !c.isMsq).forEach(c => rightCol.appendChild(buildCategory(exp.id, c)));
  }

  content.append(leftCol, rightCol);
  card.appendChild(content);
  return card;
}

function buildPatchCategory(exp) {
  const wrap = el('div', { class: 'category', 'data-cat': exp.id + '-patches' });
  const head = el('div', { class: 'category-head' });
  head.appendChild(document.createTextNode('Patch Tracking'));
  head.appendChild(el('span', { style: 'flex: 1' }));
  head.appendChild(el('span', { class: 'cat-count', 'data-cat-count': exp.id + '-patches' }, `0 / ${exp.patches.length}`));
  wrap.appendChild(head);
  const list = el('ul', { class: 'quests patch-list' });
  exp.patches.forEach(p => list.appendChild(buildPatchLi(p.id, p.label, p.sub)));
  wrap.appendChild(list);
  wrap.appendChild(el('p', { class: 'future-note' }, 'Each box covers all MSQs in that release.'));
  return wrap;
}

function buildPatchLi(id, label, sub) {
  const li = el('li', { class: 'quest', 'data-id': id });
  li.appendChild(el('div', { class: 'check' }));
  const t = el('span', { class: 'quest-title' }, label);
  if (sub) t.appendChild(el('span', { class: 'quest-aside' }, ` · ${sub}`));
  li.appendChild(t);
  li.onclick = async () => {
    if (checked[id]) { delete checked[id]; } else { checked[id] = true; logActivity(1); }
    renderScoped(id); await saveState();
  };
  return li;
}

function buildPlaceholderCategory(label) {
  const wrap = el('div', { class: 'category' });
  wrap.appendChild(el('div', { class: 'category-head' }, label,
    el('span', { class: 'cat-count' }, 'Coming soon')));
  wrap.appendChild(el('div', { class: 'placeholder' },
    'Dungeon, trial, and raid lists for this expansion can be added later.'));
  return wrap;
}

function buildCategory(expId, cat) {
  const wrap = el('div', { class: 'category', 'data-cat': cat.id });
  const total = cat.sections.reduce((sum, s) => sum + s.quests.length, 0);
  const head = el('div', { class: 'category-head' });
  head.appendChild(document.createTextNode(cat.label));
  if (!cat.isMsq) head.appendChild(el('span', { class: 'cat-tag' }, '(not in % total)'));
  head.appendChild(el('span', { style: 'flex: 1' }));
  head.appendChild(el('span', { class: 'cat-count', 'data-cat-count': cat.id }, '0 / ' + total));
  wrap.appendChild(head);
  cat.sections.forEach(sec => wrap.appendChild(buildSection(sec, !!cat.structured, {
    showItemDates: true,
    progressiveReveal: !!cat.isMsq && isProgressiveRevealEnabled(),
    showAchievementMarkers: !!cat.isMsq || !!cat.structured
  })));
  return wrap;
}

function buildSection(sec, structured, opts = {}) {
  const showItemDates    = opts.showItemDates !== false;
  const progressiveReveal = opts.progressiveReveal === true;
  const showAchievementMarkers = opts.showAchievementMarkers === true;
  const showAchievementDescriptions = opts.showAchievementDescriptions === true;
  const wrap = el('div', { class: 'section', 'data-section': sec.id });
  const head = el('div', { class: 'section-head' });
  const chev  = el('span', { class: 'chev' }, '▶');
  const title = el('span', { class: 'section-title' }, sec.title);
  if (sec.note) title.appendChild(el('span', { class: 'section-note' }, ` — ${sec.note}`));
  const count = el('span', { class: 'section-count', 'data-section-count': sec.id },
    '0', el('span', { class: 'total' }, ` / ${sec.quests.length}`));
  head.append(chev, title, count, buildDateChip(`date-sec-${sec.id}`));
  head.onclick = () => toggleSection(sec.id, wrap);
  wrap.appendChild(head);

  const body = el('div', { class: 'section-body' });
  const massBtn = el('button', { class: 'mass-toggle', 'data-mass-btn': sec.id }, 'Mark all complete');
  massBtn.onclick = async (ev) => {
    ev.stopPropagation();
    const ids = sec.quests.map((_, i) => `${sec.id}-${i}`);
    const allDone = ids.every(id => checked[id]);
    if (allDone) {
      ids.forEach(id => { delete checked[id]; delete dates[`date-item-${id}`]; });
      render();
      // Clearing the section wiped its per-item dates — refresh those chips.
      ids.forEach(id => syncDateChip(`date-item-${id}`));
      await Promise.all([saveState(), saveDates()]);
    } else {
      const newCount = ids.filter(id => !checked[id]).length;
      ids.forEach(id => { checked[id] = true; });
      if (newCount > 0) logActivity(newCount);
      const expDateFilled = checkAndAutoFillExpDates();
      render();
      // Completing the section may have auto-filled expansion dates — refresh
      // those chips (item dates are untouched when marking complete).
      if (expDateFilled) ATLAS.forEach(exp => { if (!exp.patchOnly) syncDateChip(`date-exp-${exp.id}`); });
      const saves = [saveState()];
      if (expDateFilled) saves.push(saveDates());
      await Promise.all(saves);
    }
  };
  body.appendChild(massBtn);

  if (sec.branchSpec) {
    const bs = sec.branchSpec;
    if (bs.preCount > 0) {
      const preList = el('ul', { class: 'quests' });
      for (let i = 0; i < bs.preCount; i++) {
        const id = `${sec.id}-${i}`;
        const prevId = i > 0 ? `${sec.id}-${i - 1}` : null;
        const hideTitle = progressiveReveal && i > 0 && !checked[prevId];
        const unlocks = progressiveReveal ? questUnlocks(sec.quests[i]) : null;
        preList.appendChild(buildQuestLi(id, String(i + 1), sec.quests[i], showItemDates, hideTitle, unlocks, showAchievementMarkers));
      }
      body.appendChild(preList);
    }
    const branchWrap = el('div', { class: 'branch-layout' });
    let offset = bs.preCount;
    bs.branches.forEach(branch => {
      const col = el('div', { class: 'branch-col' });
      col.appendChild(el('div', { class: 'branch-col-head' }, branch.label));
      const brList = el('ul', { class: 'quests' });
      for (let j = 0; j < branch.count; j++) {
        const qi = offset + j;
        const id = `${sec.id}-${qi}`;
        const prevId = qi > 0 ? `${sec.id}-${qi - 1}` : null;
        const hideTitle = progressiveReveal && qi > 0 && !checked[prevId];
        const unlocks = progressiveReveal ? questUnlocks(sec.quests[qi]) : null;
        brList.appendChild(buildQuestLi(id, String(qi + 1), sec.quests[qi], showItemDates, hideTitle, unlocks, showAchievementMarkers));
      }
      col.appendChild(brList);
      branchWrap.appendChild(col);
      offset += branch.count;
    });
    body.appendChild(branchWrap);
    if (offset < sec.quests.length) {
      const postList = el('ul', { class: 'quests' });
      for (let i = offset; i < sec.quests.length; i++) {
        const id = `${sec.id}-${i}`;
        const prevId = i > 0 ? `${sec.id}-${i - 1}` : null;
        const hideTitle = progressiveReveal && i > 0 && !checked[prevId];
        const unlocks = progressiveReveal ? questUnlocks(sec.quests[i]) : null;
        postList.appendChild(buildQuestLi(id, String(i + 1), sec.quests[i], showItemDates, hideTitle, unlocks, showAchievementMarkers));
      }
      body.appendChild(postList);
    }
  } else {
    const list = el('ul', { class: 'quests' });
    sec.quests.forEach((q, i) => {
      const id = `${sec.id}-${i}`;
      const prevId = i > 0 ? `${sec.id}-${i - 1}` : null;
      const hideTitle = progressiveReveal && i > 0 && !checked[prevId];
      const unlocks = progressiveReveal ? questUnlocks(q) : null;
      list.appendChild(structured
        ? buildStructuredLi(id, q.name, q.tag, showItemDates, qMetaText(q), showAchievementMarkers, showAchievementDescriptions ? q.desc : '')
        : buildQuestLi(id, String(i + 1), q, showItemDates, hideTitle, unlocks, showAchievementMarkers));
    });
    body.appendChild(list);
  }
  wrap.appendChild(body);
  if (ui.open[sec.id]) wrap.classList.add('open');
  return wrap;
}

function buildStructuredLi(id, title, tag, showItemDate = true, meta = '', showAchievementMarkers = false, description = '') {
  const li = el('li', { class: 'quest', 'data-id': id });
  li.appendChild(el('div', { class: 'check' }));
  const t = el('span', { class: 'quest-title' }, title);
  if (tag) t.appendChild(el('span', { class: 'quest-tag' }, ` · ${tag}`));
  if (meta) t.appendChild(el('span', { class: 'quest-tag' }, ` · ${meta}`));
  const cu = classUnlocks(title);
  if (cu) t.appendChild(buildUnlockMarker(cu));
  if (showAchievementMarkers) appendAchievementMarker(t, title);
  if (description) t.appendChild(el('span', { class: 'achievement-desc' }, description));
  li.appendChild(t);
  appendTaskGuideHover(li, title);
  if (showItemDate) li.appendChild(el('span', { class: 'quest-date' }, buildDateChip(`date-item-${id}`)));
  li.onclick = async () => {
    if (checked[id]) {
      delete checked[id];
      delete dates[`date-item-${id}`];
      renderScoped(id);
      await Promise.all([saveState(), saveDates()]);
    } else {
      checked[id] = true;
      logActivity(1);
      if (showItemDate && !dates[`date-item-${id}`]) dates[`date-item-${id}`] = localDateTimeStr();
      checkAndAutoFillExpDates();
      renderScoped(id);
      await Promise.all([saveState(), saveDates()]);
    }
  };
  return li;
}

function buildQuestLi(id, num, entry, showItemDate = true, hideTitle = false, unlocks = null, showAchievementMarkers = false) {
  const title = qName(entry);
  const meta = qMetaText(entry);
  const li = el('li', { class: 'quest', 'data-id': id });
  li.appendChild(el('div', { class: 'check' }));
  if (num) li.appendChild(el('span', { class: 'quest-num' }, num));
  const titleEl = el('span', { class: hideTitle ? 'quest-title quest-title-hidden' : 'quest-title' }, hideTitle ? '?????' : title);
  if (unlocks && unlocks.length) titleEl.appendChild(buildUnlockMarker(unlocks));
  if (AETHER_CURRENT_MSQ_QUESTS.has(title)) {
    titleEl.appendChild(el('span', { class: 'unlock-pill unlock-aether', style: 'margin-left:6px;' }, 'Aether Current'));
  } else if (AETHER_UNLOCK_MSQ_QUESTS.has(title)) {
    titleEl.appendChild(el('span', { class: 'unlock-pill unlock-aether', style: 'margin-left:6px;' }, 'Unlocks AC Quests'));
  }
  if (meta && !hideTitle) titleEl.appendChild(el('span', { class: 'quest-tag' }, ` · ${meta}`));
  if (showAchievementMarkers) appendAchievementMarker(titleEl, title, hideTitle);
  li.appendChild(titleEl);
  appendTaskGuideHover(li, title, hideTitle);
  if (showItemDate && !hideTitle) li.appendChild(el('span', { class: 'quest-date' }, buildDateChip(`date-item-${id}`)));
  li.onclick = async () => {
    if (checked[id]) {
      delete checked[id];
      delete dates[`date-item-${id}`];
      renderScoped(id);
      await Promise.all([saveState(), saveDates()]);
    } else {
      checked[id] = true;
      logActivity(1);
      if (showItemDate && !dates[`date-item-${id}`]) dates[`date-item-${id}`] = localDateTimeStr();
      checkAndAutoFillExpDates();
      renderScoped(id);
      await Promise.all([saveState(), saveDates()]);
    }
  };
  return li;
}

function toggleSection(id, wrap) {
  ui.open[id] = !ui.open[id];
  wrap.classList.toggle('open', !!ui.open[id]);
  saveUI();
}

// ─── Guide builders ───────────────────────────────────────────────────────

function buildDungeonEntry(dungeon) {
  const wrap = el('div', { class: 'guide-dungeon', 'data-guide': dungeon.id });
  const head = el('div', { class: 'guide-dungeon-head', tabindex: '0' });
  const chev = el('span', { class: 'chev' }, '▶');
  const name = el('span', { class: 'guide-dungeon-name' }, dungeon.name);
  const tag  = el('span', { class: 'guide-dungeon-tag' }, dungeon.tag);
  head.append(chev, name, tag);
  appendAchievementMarker(head, dungeon.name);
  head.onclick = () => {
    setGuideHoverPinned(wrap, false);
    ui.open[dungeon.id] = !ui.open[dungeon.id];
    wrap.classList.toggle('open', !!ui.open[dungeon.id]);
    saveUI();
  };
  wrap.appendChild(head);

  wrap.appendChild(buildGuideHover(dungeon));

  const body = el('div', { class: 'guide-dungeon-body' });
  const list = el('ul', { class: 'boss-list' });
  dungeon.bosses.forEach(boss => {
    const row = el('li', { class: 'boss-row' });
    row.appendChild(el('span', { class: 'boss-name' }, boss.name));
    row.appendChild(el('span', { class: 'boss-tip' }, boss.tip));
    list.appendChild(row);
  });
  body.appendChild(list);
  wrap.appendChild(body);

  if (ui.open[dungeon.id]) wrap.classList.add('open');
  return wrap;
}

function buildGuideSectionBlock(sec) {
  const wrap = el('div', { class: 'section', 'data-section': sec.id });
  const head = el('div', { class: 'section-head' });
  const chev  = el('span', { class: 'chev' }, '▶');
  const title = el('span', { class: 'section-title' }, sec.title);
  const count = el('span', { class: 'section-count' }, `${sec.dungeons.length}`,
    el('span', { class: 'total' }, ' dungeons'));
  head.append(chev, title, count);
  head.onclick = () => toggleSection(sec.id, wrap);
  wrap.appendChild(head);

  const body = el('div', { class: 'section-body' });
  sec.dungeons.forEach(d => body.appendChild(buildDungeonEntry(d)));
  wrap.appendChild(body);

  if (ui.open[sec.id]) wrap.classList.add('open');
  return wrap;
}

function buildGuideCard(cardId, guideLabel, cardTitle, tagline, sections) {
  const card = el('div', { class: 'guide-card', id: cardId });
  const header = el('div', { class: 'guide-card-header' });
  header.appendChild(el('div', { class: 'guide-card-num' }, guideLabel));
  header.appendChild(el('div', { class: 'guide-card-title' }, cardTitle));
  card.appendChild(header);
  card.appendChild(el('p', { class: 'guide-card-tagline' }, tagline));
  sections.forEach(sec => card.appendChild(buildGuideSectionBlock(sec)));
  return card;
}

// ─── Quest group cards (jobs, deep dungeons, relic weapons, etc.) ──────────

function buildQuestGroupCard(cardId, accentVar, titleHtml, tagline, roleGroups, colSplitFn) {
  const total = roleGroups.reduce((s, rg) =>
    s + rg.jobs.reduce((s2, j) =>
      s2 + j.sections.reduce((s3, sec) => s3 + sec.quests.length, 0)
         + (j.huntSections || []).reduce((s3, sec) => s3 + sec.quests.length, 0), 0), 0);

  const card = el('div', { class: 'expansion', id: `exp-${cardId}`, 'data-exp': cardId, style: `--accent: var(--${accentVar});` });

  const header = el('div', { class: 'exp-header' });
  header.append(
    el('div', { class: 'exp-title' },
      el('div', { class: 'exp-num' }, 'Side Content'),
      el('div', { class: 'exp-name', html: titleHtml })
    ),
    el('div', {},
      el('div', { class: 'exp-count', id: `${cardId}-total-count` },
        '0', el('span', { class: 'total' }, ` / ${total}`)
      )
    )
  );
  card.appendChild(header);
  card.appendChild(el('div', { class: 'exp-progress-row' },
    el('div', { class: 'exp-progress-bar' },
      el('div', { class: 'exp-progress-fill', 'data-card-fill': cardId })
    ),
    el('span', { class: 'exp-pct', 'data-card-pct': cardId }, '0%')
  ));
  card.appendChild(el('p', { class: 'exp-tagline' }, tagline));

  const content = el('div', { class: 'exp-content' });
  const hasHuntJobs = roleGroups.some(rg => rg.jobs.some(j => j.huntSections));

  if (hasHuntJobs) {
    content.classList.add('exp-content-stack');
    roleGroups.forEach(roleGroup => {
      if (roleGroup.role) content.appendChild(el('div', { class: 'role-label' }, roleGroup.role));
      if (roleGroup.summary) content.appendChild(el('p', { class: 'future-note' }, roleGroup.summary));
      roleGroup.jobs.forEach(job => {
        const jobTotal = job.sections.reduce((s, sec) => s + sec.quests.length, 0)
                       + (job.huntSections || []).reduce((s, sec) => s + sec.quests.length, 0);
        const catEl = el('div', { class: 'category' + (job.huntSections ? ' category-with-hunt' : ''), id: `job-${job.id}` });
        catEl.appendChild(el('div', { class: 'category-head' },
          job.label,
          el('span', { style: 'flex:1' }),
          el('span', { class: 'cat-count', id: `${cardId}-${job.id}-count` }, `0 / ${jobTotal}`)
        ));
        const showItemDates = cardId !== 'deep';
        if (job.huntSections) {
          const classCol = el('div', { class: 'job-class-col' });
          const huntCol  = el('div', { class: 'job-hunt-col' });
          job.sections.forEach(sec => classCol.appendChild(buildSection(sec, true, { showItemDates })));
          huntCol.appendChild(el('div', { class: 'hunt-col-head' }, 'Hunting Log'));
          job.huntSections.forEach(sec => huntCol.appendChild(buildSection(sec, true, { showItemDates })));
          catEl.append(classCol, huntCol);
        } else {
          job.sections.forEach(sec => catEl.appendChild(buildSection(sec, true, { showItemDates })));
        }
        content.appendChild(catEl);
      });
    });
  } else {
    const leftCol  = el('div', { class: 'col-left' });
    const rightCol = el('div', { class: 'col-right' });
    roleGroups.forEach((roleGroup, idx) => {
      const col = colSplitFn(roleGroup, idx) ? leftCol : rightCol;
      if (roleGroup.role) col.appendChild(el('div', { class: 'role-label' }, roleGroup.role));
      if (roleGroup.summary) col.appendChild(el('p', { class: 'future-note' }, roleGroup.summary));
      roleGroup.jobs.forEach(job => {
        const jobTotal = job.sections.reduce((s, sec) => s + sec.quests.length, 0);
        const catEl = el('div', { class: 'category', id: `job-${job.id}` });
        catEl.appendChild(el('div', { class: 'category-head' },
          job.label,
          el('span', { style: 'flex:1' }),
          el('span', { class: 'cat-count', id: `${cardId}-${job.id}-count` }, `0 / ${jobTotal}`)
        ));
        const showItemDates = cardId !== 'deep';
        job.sections.forEach(sec => catEl.appendChild(buildSection(sec, true, { showItemDates })));
        col.appendChild(catEl);
      });
    });
    content.append(leftCol, rightCol);
  }

  card.appendChild(content);
  return card;
}

function buildTankCard() {
  return buildQuestGroupCard('tank', 'tank', 'Tank <em>Quests</em>',
    'The unyielding vanguard — those who stand between the enemy and their allies.',
    TANK_QUESTS, () => true);
}

function buildHealerCard() {
  return buildQuestGroupCard('healer', 'healer', 'Healer <em>Quests</em>',
    'Where life wanes, they restore — the healers who keep the light burning.',
    HEALER_QUESTS, () => true);
}

function buildDpsCard() {
  return buildQuestGroupCard('dps', 'dps', 'DPS <em>Quests</em>',
    'The swift and the deadly — warriors of every blade, bow, and spell.',
    DPS_QUESTS, rg => rg.role === 'Melee');
}

function buildDoLCard() {
  return buildQuestGroupCard('dol', 'dol', 'Disciple of the <em>Land</em>',
    'From mountain ore to forest bloom — the harvesters who supply the realm.',
    DOL_QUESTS, () => true);
}

function buildDoHCard() {
  return buildQuestGroupCard('doh', 'doh', 'Disciple of the <em>Hand</em>',
    'From forge to kitchen — the artisans whose craft shapes every corner of Eorzea.',
    DOH_QUESTS, (rg, idx) => idx === 0);
}

// ─── Daily / weekly task card ─────────────────────────────────────────────

function buildTaskRow(task) {
  const li = el('li', { class: 'quest', 'data-id': task.id, 'data-task-row': 'true' });
  li.appendChild(el('div', { class: 'check' }));
  const title = el('span', { class: 'quest-title' }, task.label);
  if (task.note) title.appendChild(el('span', { class: 'quest-aside' }, ` · ${task.note}`));
  const lockNote = el('span', { class: 'quest-lock-note' });
  li._lockNoteEl = lockNote;
  title.appendChild(lockNote);
  li.appendChild(title);
  applyTaskRowState(li, task);
  li.onclick = async () => {
    const lockReason = taskLockReason(task);
    if (lockReason) {
      showToast(lockReason);
      return;
    }
    if (checked[task.id]) { delete checked[task.id]; } else { checked[task.id] = true; logActivity(1); }
    renderScoped(task.id); await saveState();
  };
  return li;
}

function buildDailyWeeklyCard() {
  const card = el('div', { class: 'expansion', id: 'exp-recur', 'data-exp': 'recur', style: '--accent: var(--recur);' });

  const header = el('div', { class: 'exp-header' });
  header.append(
    el('div', { class: 'exp-title' },
      el('div', { class: 'exp-num' }, 'Recurring · Resets Daily & Weekly'),
      el('div', { class: 'exp-name', html: 'Task <em>Log</em>' })
    ),
    el('div', {},
      el('div', { class: 'exp-count', id: 'recur-total-count' },
        '0', el('span', { class: 'total' }, ' / ' + (DAILY_TASKS.length + WEEKLY_TASKS.length))
      )
    )
  );
  card.appendChild(header);
  card.appendChild(el('p', { class: 'exp-tagline' },
    'The recurring rhythm of the Warrior of Light — roulettes, hunts, and weekly obligations.'
  ));

  const content = el('div', { class: 'exp-content' });

  const leftCat = el('div', { class: 'category' });
  leftCat.appendChild(el('div', { class: 'category-head' },
    'Daily Tasks',
    el('span', { style: 'flex:1' }),
    el('span', { class: 'cat-count', id: 'daily-cat-count' }, `0 / ${DAILY_TASKS.length}`)
  ));
  const dailyReset = el('button', { class: 'mass-toggle' }, 'Reset Daily');
  dailyReset.onclick = ev => { ev.stopPropagation(); resetDailyTasks(); };
  leftCat.appendChild(dailyReset);
  const dailyList = el('ul', { class: 'quests' });
  DAILY_TASKS.forEach(t => dailyList.appendChild(buildTaskRow(t)));
  leftCat.appendChild(dailyList);
  leftCat.appendChild(el('p', { class: 'future-note' }, 'Most daily tasks auto-reset at 15:00 UTC'));

  const rightCat = el('div', { class: 'category' });
  rightCat.appendChild(el('div', { class: 'category-head' },
    'Weekly Tasks',
    el('span', { style: 'flex:1' }),
    el('span', { class: 'cat-count', id: 'weekly-cat-count' }, `0 / ${WEEKLY_TASKS.length}`)
  ));
  const weeklyReset = el('button', { class: 'mass-toggle' }, 'Reset Weekly');
  weeklyReset.onclick = ev => { ev.stopPropagation(); resetWeeklyTasks(); };
  rightCat.appendChild(weeklyReset);
  const weeklyList = el('ul', { class: 'quests' });
  WEEKLY_TASKS.forEach(t => weeklyList.appendChild(buildTaskRow(t)));
  rightCat.appendChild(weeklyList);
  rightCat.appendChild(el('p', { class: 'future-note' }, 'Most weekly tasks auto-reset Tuesday 08:00 UTC; Fashion Report resets Friday 08:00 UTC. Jumbo Cactpot auto-resets by your selected data center region.'));

  const leftCol = el('div', { class: 'col-left' }); leftCol.appendChild(leftCat);
  const rightCol = el('div', { class: 'col-right' }); rightCol.appendChild(rightCat);
  content.append(leftCol, rightCol);
  card.appendChild(content);
  return card;
}

// ─── Aether Currents card ─────────────────────────────────────────────────

function buildAcItem(id, label, showItemDate) {
  const li = el('li', { class: 'quest', 'data-id': id });
  li.appendChild(el('div', { class: 'check' }));
  li.appendChild(el('span', { class: 'quest-title' }, label));
  if (showItemDate) li.appendChild(el('span', { class: 'quest-date' }, buildDateChip(`date-item-${id}`)));
  li.onclick = async () => {
    if (checked[id]) {
      delete checked[id];
      delete dates[`date-item-${id}`];
      renderScoped(id);
      await Promise.all([saveState(), saveDates()]);
    } else {
      checked[id] = true; logActivity(1);
      if (showItemDate && !dates[`date-item-${id}`]) dates[`date-item-${id}`] = localDateTimeStr();
      renderScoped(id);
      await Promise.all([saveState(), saveDates()]);
    }
  };
  return li;
}

function buildAetherCurrentsCards() {
  return AETHER_CURRENTS_DATA.map(exp => {
    const expTotal = exp.zones.reduce((s, z) => s + z.exploration + z.quests.length, 0);
    const card = el('div', { class: 'expansion', id: `exp-aether-${exp.accent}`, 'data-exp': `aether-${exp.accent}`, style: `--accent: var(--${exp.accent});` });

    const header = el('div', { class: 'exp-header' });
    header.append(
      el('div', { class: 'exp-title' },
        el('div', { class: 'exp-num' }, 'Side Content · Flying Unlock'),
        el('div', { class: 'exp-name' }, exp.label)
      ),
      el('div', {},
        el('div', { class: 'exp-count', id: `aether-exp-${exp.id}-count` },
          '0', el('span', { class: 'total' }, ` / ${expTotal}`)
        )
      )
    );
    card.appendChild(header);
    card.appendChild(el('div', { class: 'exp-progress-row' },
      el('div', { class: 'exp-progress-bar' },
        el('div', { class: 'exp-progress-fill', 'data-card-fill': `aether-${exp.id}` })
      ),
      el('span', { class: 'exp-pct', 'data-card-pct': `aether-${exp.id}` }, '0%')
    ));
    card.appendChild(el('p', { class: 'exp-tagline' },
      'Find all aether currents in each zone to unlock flying. Exploration currents are hidden in the field; quest currents are awarded by completing side quests.'
    ));

    const content = el('div', { class: 'exp-content-stack' });

    exp.zones.forEach(zone => {
      const zoneTotal = zone.exploration + zone.quests.length;
      const zoneEl = el('div', { class: 'ac-zone' });

      const zoneHead = el('div', { class: 'ac-zone-head' });
      zoneHead.appendChild(document.createTextNode(zone.name));
      zoneHead.appendChild(el('span', { class: 'ac-zone-count', id: `aether-zone-${zone.id}-count` }, `0 / ${zoneTotal}`));
      zoneEl.appendChild(zoneHead);

      if (zone.exploration > 0) {
        zoneEl.appendChild(el('div', { class: 'ac-subsec-head' }, 'Exploration'));
        const explList = el('ul', { class: 'quests' });
        for (let i = 0; i < zone.exploration; i++) {
          explList.appendChild(buildAcItem(`${zone.id}-e-${i}`, `#${i + 1}`, true));
        }
        zoneEl.appendChild(explList);
      }

      if (zone.quests.length > 0) {
        zoneEl.appendChild(el('div', { class: 'ac-subsec-head' }, 'Quests'));
        const questList = el('ul', { class: 'quests' });
        zone.quests.forEach((qname, i) => {
          questList.appendChild(buildAcItem(`${zone.id}-q-${i}`, qname, true));
        });
        zoneEl.appendChild(questList);
      }

      content.appendChild(zoneEl);
    });

    card.appendChild(content);
    return card;
  });
}

// ─── Currency tracker cards ───────────────────────────────────────────────

// Per-card Line/Bar toggle for a currency graph. The choice is stored on the
// persisted `ui` object (keyed by canvas id) and defaults to Line. `getRange`
// returns the card's currently-active time range so a switch re-renders in place.
// Shared "Undo last" button for the time-series trackers. Pops the most recent
// entry from `dataArray`, persists via `storageKey`, then calls `applyLatest`
// with the new current value (or null when the series is now empty) so the card
// display, sidebar value, and graph can refresh. `accentColor` is a CSS color
// string (e.g. 'var(--ew)') used to tint the button to match its card.
function makeUndoButton(accentColor, dataArray, storageKey, applyLatest) {
  const btn = el('button', { type: 'button', class: 'gil-undo-btn', title: 'Remove the most recent entry' }, '↶ Undo');
  if (accentColor) {
    btn.style.borderColor = accentColor;
    btn.style.color = accentColor;
    btn.addEventListener('mouseover', () => { btn.style.background = accentColor; btn.style.color = 'var(--bg)'; });
    btn.addEventListener('mouseout',  () => { btn.style.background = ''; btn.style.color = accentColor; });
  }
  btn.addEventListener('click', () => {
    if (!dataArray.length) { showToast('✦ Nothing to undo'); return; }
    dataArray.pop();
    store.set(storageKey, JSON.stringify(dataArray));
    flashAutosave();
    applyLatest(dataArray.length ? dataArray[dataArray.length - 1].amount : null);
    showToast('✦ Last entry removed');
  });
  return btn;
}

function makeResetTrackerButton(accentColor, dataArray, storageKey, applyLatest, label = 'tracker') {
  const btn = el('button', { type: 'button', class: 'gil-undo-btn', title: `Clear all ${label} entries` }, 'Reset');
  if (accentColor) {
    btn.style.borderColor = accentColor;
    btn.style.color = accentColor;
    btn.addEventListener('mouseover', () => { btn.style.background = accentColor; btn.style.color = 'var(--bg)'; });
    btn.addEventListener('mouseout',  () => { btn.style.background = ''; btn.style.color = accentColor; });
  }
  btn.addEventListener('click', () => {
    if (!dataArray.length) { showToast('Nothing to reset'); return; }
    if (!confirm(`Reset ${label} history? This clears all logged entries for this tracker.`)) return;
    dataArray.length = 0;
    store.set(storageKey, JSON.stringify(dataArray));
    flashAutosave();
    applyLatest(null);
    showToast('Tracker reset');
  });
  return btn;
}

function buildChartTypeToggle(graphId, renderFn, getRange, types = [['line', 'Line'], ['bar', 'Bar']]) {
  const row = el('div', { class: 'gil-range-row gil-charttype-row' });
  row.appendChild(el('span', { class: 'gil-charttype-label' }, 'Graph'));
  const current = () => {
    const saved = ui.chartTypes && ui.chartTypes[graphId];
    return types.some(([type]) => type === saved) ? saved : 'line';
  };
  types.forEach(([type, label]) => {
    const btn = el('button', {
      type: 'button',
      class: 'gil-range-btn gil-charttype-btn' + (current() === type ? ' active' : ''),
      'data-charttype': type,
    }, label);
    btn.addEventListener('click', () => {
      if (!ui.chartTypes) ui.chartTypes = {};
      ui.chartTypes[graphId] = type;
      row.querySelectorAll('.gil-charttype-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      saveUI();
      renderFn(getRange());
    });
    row.appendChild(btn);
  });
  return row;
}

const CURRENCY_CHART_TYPES = [['line', 'Line'], ['bar', 'Bar'], ['step', 'Step'], ['delta', 'Delta'], ['highlow', 'High/Low']];

function buildTrendToggle(graphId, renderFn, getRange) {
  const row = el('div', { class: 'gil-range-row gil-charttype-row' });
  row.appendChild(el('span', { class: 'gil-charttype-label' }, 'Trend'));
  const btn = el('button', {
    type: 'button',
    class: 'gil-range-btn gil-charttype-btn' + (ui.chartTrends && ui.chartTrends[graphId] ? ' active' : ''),
    'data-charttrend': 'rolling',
  }, 'Rolling Avg');
  btn.addEventListener('click', () => {
    if (!ui.chartTrends) ui.chartTrends = {};
    ui.chartTrends[graphId] = !ui.chartTrends[graphId];
    btn.classList.toggle('active', ui.chartTrends[graphId]);
    saveUI();
    renderFn(getRange());
  });
  row.appendChild(btn);
  return row;
}

function buildGilCard() {
  const card = el('div', { class: 'expansion', id: 'exp-gil', 'data-exp': 'gil', style: '--accent: var(--ew)' });
  const latestGil = gilData.length ? gilData[gilData.length - 1].amount : null;

  const header = el('div', { class: 'exp-header' });
  header.append(
    el('div', { class: 'exp-title' },
      el('div', { class: 'exp-num' }, 'Currency Tracker'),
      el('div', { class: 'exp-name', html: 'Gil <em>History</em>' })
    ),
    el('div', {},
      el('div', { class: 'exp-count', id: 'gil-current-display' },
        latestGil !== null ? formatGil(latestGil) : '—'
      ),
      el('span', { class: 'exp-count-mini' }, latestGil !== null ? 'current balance' : 'no entries yet')
    )
  );
  card.appendChild(header);
  card.appendChild(el('p', { class: 'exp-tagline' }, 'Log your gil balance to track wealth over time.'));

  const inputRow = el('div', { class: 'gil-input-row' });
  const input    = el('input', { type: 'number', id: 'gil-amount-input', class: 'gil-input', placeholder: 'Enter current gil…', min: '0', max: '999999999' });
  const logBtn   = el('button', { type: 'button', class: 'gil-log-btn' }, 'Log Entry');
  inputRow.append(input, logBtn);
  card.appendChild(inputRow);

  const rangeRow = el('div', { class: 'gil-range-row' });
  let activeRange = '30d';
  [['24h','24 Hours'],['7d','7 Days'],['30d','30 Days'],['1y','1 Year'],['all','All Time']].forEach(([r, label]) => {
    const btn = el('button', { type: 'button', class: 'gil-range-btn' + (r === activeRange ? ' active' : ''), 'data-range': r }, label);
    btn.addEventListener('click', () => {
      activeRange = r;
      rangeRow.querySelectorAll('.gil-range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderGilGraph(r);
    });
    rangeRow.appendChild(btn);
  });
  card.appendChild(rangeRow);
  card.appendChild(buildChartTypeToggle('gil-graph', renderGilGraph, () => activeRange, CURRENCY_CHART_TYPES));
  card.appendChild(buildTrendToggle('gil-graph', renderGilGraph, () => activeRange));
  card.appendChild(el('canvas', { id: 'gil-graph', class: 'gil-graph' }));

  const applyGil = val => {
    const display = document.getElementById('gil-current-display');
    if (display) display.firstChild.nodeValue = val !== null ? formatGil(val) : '—';
    const mini = card.querySelector('.exp-count-mini');
    if (mini) mini.textContent = val !== null ? 'current balance' : 'no entries yet';
    const sidebarAmt = document.getElementById('sidebar-gil-amount');
    if (sidebarAmt) sidebarAmt.textContent = val !== null ? formatGil(val) : '';
    renderGilGraph(activeRange);
  };
  logBtn.addEventListener('click', () => {
    const val = parseInt(input.value, 10);
    if (isNaN(val) || val < 0) { input.focus(); return; }
    gilData.push({ date: new Date().toISOString(), amount: val });
    store.set(GIL_KEY, JSON.stringify(gilData));
    flashAutosave();
    input.value = '';
    applyGil(val);
  });
  inputRow.appendChild(makeUndoButton('var(--ew)', gilData, GIL_KEY, applyGil));
  inputRow.appendChild(makeResetTrackerButton('var(--ew)', gilData, GIL_KEY, applyGil, 'Gil'));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') logBtn.click(); });
  requestAnimationFrame(() => renderGilGraph(activeRange));
  return card;
}

function buildMgpCard() {
  const card = el('div', { class: 'expansion', id: 'exp-mgp', 'data-exp': 'mgp', style: '--accent: var(--shb)' });
  const latestMgp = mgpData.length ? mgpData[mgpData.length - 1].amount : null;

  const header = el('div', { class: 'exp-header' });
  header.append(
    el('div', { class: 'exp-title' },
      el('div', { class: 'exp-num' }, 'Currency Tracker'),
      el('div', { class: 'exp-name', html: 'MGP <em>History</em>' })
    ),
    el('div', {},
      el('div', { class: 'exp-count', id: 'mgp-current-display' },
        latestMgp !== null ? formatGil(latestMgp) : '—'
      ),
      el('span', { class: 'exp-count-mini' }, latestMgp !== null ? 'current balance' : 'no entries yet')
    )
  );
  card.appendChild(header);
  card.appendChild(el('p', { class: 'exp-tagline' }, 'Log your Manderville Gold Saucer Points to track earnings over time.'));

  const inputRow = el('div', { class: 'gil-input-row' });
  const input    = el('input', { type: 'number', id: 'mgp-amount-input', class: 'gil-input', placeholder: 'Enter current MGP…', min: '0', max: '9999999' });
  const logBtn   = el('button', { type: 'button', class: 'gil-log-btn', style: 'border-color: var(--shb); color: var(--shb)' }, 'Log Entry');
  logBtn.addEventListener('mouseover', () => { logBtn.style.background = 'var(--shb)'; logBtn.style.color = 'var(--bg)'; });
  logBtn.addEventListener('mouseout',  () => { logBtn.style.background = ''; logBtn.style.color = 'var(--shb)'; });
  inputRow.append(input, logBtn);
  card.appendChild(inputRow);

  const rangeRow = el('div', { class: 'gil-range-row' });
  let activeRange = '30d';
  [['24h','24 Hours'],['7d','7 Days'],['30d','30 Days'],['1y','1 Year'],['all','All Time']].forEach(([r, label]) => {
    const btn = el('button', { type: 'button', class: 'gil-range-btn' + (r === activeRange ? ' active' : ''), 'data-range': r }, label);
    btn.addEventListener('click', () => {
      activeRange = r;
      rangeRow.querySelectorAll('.gil-range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderMgpGraph(r);
    });
    rangeRow.appendChild(btn);
  });
  card.appendChild(rangeRow);
  card.appendChild(buildChartTypeToggle('mgp-graph', renderMgpGraph, () => activeRange, CURRENCY_CHART_TYPES));
  card.appendChild(buildTrendToggle('mgp-graph', renderMgpGraph, () => activeRange));
  card.appendChild(el('canvas', { id: 'mgp-graph', class: 'gil-graph' }));

  const applyMgp = val => {
    const display = document.getElementById('mgp-current-display');
    if (display) display.firstChild.nodeValue = val !== null ? formatGil(val) : '—';
    const mini = card.querySelector('.exp-count-mini');
    if (mini) mini.textContent = val !== null ? 'current balance' : 'no entries yet';
    const sidebarAmt = document.getElementById('sidebar-mgp-amount');
    if (sidebarAmt) sidebarAmt.textContent = val !== null ? `${formatGil(val)} / 9.99M` : '';
    renderMgpGraph(activeRange);
  };
  logBtn.addEventListener('click', () => {
    const val = parseInt(input.value, 10);
    if (isNaN(val) || val < 0) { input.focus(); return; }
    mgpData.push({ date: new Date().toISOString(), amount: val });
    store.set(MGP_KEY, JSON.stringify(mgpData));
    flashAutosave();
    input.value = '';
    applyMgp(val);
  });
  inputRow.appendChild(makeUndoButton('var(--shb)', mgpData, MGP_KEY, applyMgp));
  inputRow.appendChild(makeResetTrackerButton('var(--shb)', mgpData, MGP_KEY, applyMgp, 'MGP'));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') logBtn.click(); });
  requestAnimationFrame(() => renderMgpGraph(activeRange));
  return card;
}

function buildVentureCard() {
  const card = el('div', { class: 'expansion', id: 'exp-venture', 'data-exp': 'venture', style: '--accent: var(--dt)' });
  const latest = ventureData.length ? ventureData[ventureData.length - 1].amount : null;

  const header = el('div', { class: 'exp-header' });
  header.append(
    el('div', { class: 'exp-title' },
      el('div', { class: 'exp-num' }, 'Currency Tracker'),
      el('div', { class: 'exp-name', html: 'Venture <em>History</em>' })
    ),
    el('div', {},
      el('div', { class: 'exp-count', id: 'venture-current-display' },
        latest !== null ? latest.toLocaleString() : '—'
      ),
      el('span', { class: 'exp-count-mini' }, latest !== null ? 'current balance' : 'no entries yet')
    )
  );
  card.appendChild(header);
  card.appendChild(el('p', { class: 'exp-tagline' }, 'Log your Venture count to track retainer currency over time.'));

  const inputRow = el('div', { class: 'gil-input-row' });
  const input    = el('input', { type: 'number', id: 'venture-amount-input', class: 'gil-input', placeholder: 'Enter current Ventures…', min: '0', max: '65535' });
  const logBtn   = el('button', { type: 'button', class: 'gil-log-btn', style: 'border-color: var(--dt); color: var(--dt)' }, 'Log Entry');
  logBtn.addEventListener('mouseover', () => { logBtn.style.background = 'var(--dt)'; logBtn.style.color = 'var(--bg)'; });
  logBtn.addEventListener('mouseout',  () => { logBtn.style.background = ''; logBtn.style.color = 'var(--dt)'; });
  inputRow.append(input, logBtn);
  card.appendChild(inputRow);

  const rangeRow = el('div', { class: 'gil-range-row' });
  let activeRange = '30d';
  [['24h','24 Hours'],['7d','7 Days'],['30d','30 Days'],['1y','1 Year'],['all','All Time']].forEach(([r, label]) => {
    const btn = el('button', { type: 'button', class: 'gil-range-btn' + (r === activeRange ? ' active' : ''), 'data-range': r }, label);
    btn.addEventListener('click', () => {
      activeRange = r;
      rangeRow.querySelectorAll('.gil-range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderVentureGraph(r);
    });
    rangeRow.appendChild(btn);
  });
  card.appendChild(rangeRow);
  card.appendChild(buildChartTypeToggle('venture-graph', renderVentureGraph, () => activeRange, CURRENCY_CHART_TYPES));
  card.appendChild(buildTrendToggle('venture-graph', renderVentureGraph, () => activeRange));
  card.appendChild(el('canvas', { id: 'venture-graph', class: 'gil-graph' }));

  const applyVenture = val => {
    const display = document.getElementById('venture-current-display');
    if (display) display.firstChild.nodeValue = val !== null ? val.toLocaleString() : '—';
    const mini = card.querySelector('.exp-count-mini');
    if (mini) mini.textContent = val !== null ? 'current balance' : 'no entries yet';
    const sidebarAmt = document.getElementById('sidebar-venture-amount');
    if (sidebarAmt) sidebarAmt.textContent = val !== null ? `${val.toLocaleString()} / 65,535` : '';
    renderVentureGraph(activeRange);
  };
  logBtn.addEventListener('click', () => {
    const val = parseInt(input.value, 10);
    if (isNaN(val) || val < 0) { input.focus(); return; }
    ventureData.push({ date: new Date().toISOString(), amount: val });
    store.set(VENTURE_KEY, JSON.stringify(ventureData));
    flashAutosave();
    input.value = '';
    applyVenture(val);
  });
  inputRow.appendChild(makeUndoButton('var(--dt)', ventureData, VENTURE_KEY, applyVenture));
  inputRow.appendChild(makeResetTrackerButton('var(--dt)', ventureData, VENTURE_KEY, applyVenture, 'Venture'));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') logBtn.click(); });
  requestAnimationFrame(() => renderVentureGraph(activeRange));
  return card;
}

function buildSealCard() {
  const card = el('div', { class: 'expansion', id: 'exp-seals', 'data-exp': 'seals', style: '--accent: var(--sb)' });
  const latest = sealEntries.length ? sealEntries[sealEntries.length - 1].amount : null;
  const currentCap = GC_RANKS.find(r => r.name === sealRank)?.cap || 90000;

  const header = el('div', { class: 'exp-header' });
  header.append(
    el('div', { class: 'exp-title' },
      el('div', { class: 'exp-num' }, 'Currency Tracker'),
      el('div', { class: 'exp-name', html: 'Company Seals <em>History</em>' })
    ),
    el('div', {},
      el('div', { class: 'exp-count', id: 'seal-current-display' },
        latest !== null ? latest.toLocaleString() : '—'
      ),
      el('span', { class: 'exp-count-mini' }, latest !== null ? `of ${currentCap.toLocaleString()} cap` : 'no entries yet')
    )
  );
  card.appendChild(header);
  card.appendChild(el('p', { class: 'exp-tagline' }, 'Log your Company Seals balance to track Grand Company currency over time.'));

  const rankRow = el('div', { class: 'seal-rank-row' });
  rankRow.appendChild(el('span', { class: 'seal-rank-label' }, 'GC Rank'));
  const select = document.createElement('select');
  select.id = 'seal-rank-select';
  select.className = 'seal-rank-select';
  GC_RANKS.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.name;
    opt.textContent = `${r.name}  —  ${r.cap.toLocaleString()} seals`;
    opt.selected = r.name === sealRank;
    select.appendChild(opt);
  });
  const capBadge = el('span', { class: 'seal-cap-badge', id: 'seal-cap-badge' }, `Cap: ${currentCap.toLocaleString()}`);
  select.addEventListener('change', () => {
    sealRank = select.value;
    store.set(SEAL_RANK_KEY, sealRank);
    const newCap = GC_RANKS.find(r => r.name === sealRank)?.cap || 90000;
    capBadge.textContent = `Cap: ${newCap.toLocaleString()}`;
    const mini = document.querySelector('#exp-seals .exp-count-mini');
    if (mini && sealEntries.length) mini.textContent = `of ${newCap.toLocaleString()} cap`;
    const sidebarAmt = document.getElementById('sidebar-seal-amount');
    if (sidebarAmt) {
      const last = sealEntries.length ? sealEntries[sealEntries.length - 1].amount : null;
      sidebarAmt.textContent = last !== null ? `${last.toLocaleString()} / ${newCap.toLocaleString()}` : `— / ${newCap.toLocaleString()}`;
    }
    renderSealGraph(activeRange);
  });
  rankRow.append(select, capBadge);
  card.appendChild(rankRow);

  const inputRow = el('div', { class: 'gil-input-row' });
  const input    = el('input', { type: 'number', id: 'seal-amount-input', class: 'gil-input', placeholder: 'Enter current seals…', min: '0', max: '90000' });
  const logBtn   = el('button', { type: 'button', class: 'gil-log-btn', style: 'border-color: var(--sb); color: var(--sb)' }, 'Log Entry');
  logBtn.addEventListener('mouseover', () => { logBtn.style.background = 'var(--sb)'; logBtn.style.color = 'var(--bg)'; });
  logBtn.addEventListener('mouseout',  () => { logBtn.style.background = ''; logBtn.style.color = 'var(--sb)'; });
  inputRow.append(input, logBtn);
  card.appendChild(inputRow);

  const rangeRow = el('div', { class: 'gil-range-row' });
  let activeRange = '30d';
  [['24h','24 Hours'],['7d','7 Days'],['30d','30 Days'],['1y','1 Year'],['all','All Time']].forEach(([r, label]) => {
    const btn = el('button', { type: 'button', class: 'gil-range-btn' + (r === activeRange ? ' active' : ''), 'data-range': r }, label);
    btn.addEventListener('click', () => {
      activeRange = r;
      rangeRow.querySelectorAll('.gil-range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderSealGraph(r);
    });
    rangeRow.appendChild(btn);
  });
  card.appendChild(rangeRow);
  card.appendChild(buildChartTypeToggle('seal-graph', renderSealGraph, () => activeRange, CURRENCY_CHART_TYPES));
  card.appendChild(buildTrendToggle('seal-graph', renderSealGraph, () => activeRange));
  card.appendChild(el('canvas', { id: 'seal-graph', class: 'gil-graph' }));

  const applySeal = val => {
    const cap = GC_RANKS.find(r => r.name === sealRank)?.cap || 90000;
    const display = document.getElementById('seal-current-display');
    if (display) display.firstChild.nodeValue = val !== null ? val.toLocaleString() : '—';
    const mini = document.querySelector('#exp-seals .exp-count-mini');
    if (mini) mini.textContent = val !== null ? `of ${cap.toLocaleString()} cap` : 'no entries yet';
    const sidebarAmt = document.getElementById('sidebar-seal-amount');
    if (sidebarAmt) sidebarAmt.textContent = val !== null ? `${val.toLocaleString()} / ${cap.toLocaleString()}` : `— / ${cap.toLocaleString()}`;
    renderSealGraph(activeRange);
  };
  logBtn.addEventListener('click', () => {
    const val = parseInt(input.value, 10);
    if (isNaN(val) || val < 0) { input.focus(); return; }
    sealEntries.push({ date: new Date().toISOString(), amount: val });
    store.set(SEAL_KEY, JSON.stringify(sealEntries));
    flashAutosave();
    input.value = '';
    applySeal(val);
  });
  inputRow.appendChild(makeUndoButton('var(--sb)', sealEntries, SEAL_KEY, applySeal));
  inputRow.appendChild(makeResetTrackerButton('var(--sb)', sealEntries, SEAL_KEY, applySeal, 'Company Seals'));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') logBtn.click(); });
  requestAnimationFrame(() => renderSealGraph(activeRange));
  return card;
}

// ─── Shared currency sub-tracker builder ─────────────────────────────────

function buildCurrencySubSection({ label, dataArray, storageKey, cap, graphId, rangeRowClass, renderFn, cardDisplayId, sidebarId, accent }) {
  const latest = dataArray.length ? dataArray[dataArray.length - 1].amount : null;
  const wrap = el('div', { class: 'currency-sub-section' });

  const subHead = el('div', { class: 'currency-sub-head' });
  subHead.appendChild(el('span', { class: 'currency-sub-name' }, label));
  const amtDisplay = el('span', { class: 'currency-sub-amount', id: cardDisplayId },
    latest !== null ? `${latest.toLocaleString()} / ${cap.toLocaleString()}` : `— / ${cap.toLocaleString()}`
  );
  subHead.appendChild(amtDisplay);
  wrap.appendChild(subHead);

  const inputRow = el('div', { class: 'gil-input-row' });
  const input = el('input', { type: 'number', class: 'gil-input', placeholder: `Enter current ${label}…`, min: '0', max: String(cap) });
  const logBtn = el('button', { type: 'button', class: 'gil-log-btn', style: `border-color: ${accent}; color: ${accent}` }, 'Log Entry');
  logBtn.addEventListener('mouseover', () => { logBtn.style.background = accent; logBtn.style.color = 'var(--bg)'; });
  logBtn.addEventListener('mouseout',  () => { logBtn.style.background = ''; logBtn.style.color = accent; });
  inputRow.append(input, logBtn);
  wrap.appendChild(inputRow);

  const rangeRow = el('div', { class: `gil-range-row ${rangeRowClass}` });
  let activeRange = '30d';
  [['24h','24 Hours'],['7d','7 Days'],['30d','30 Days'],['1y','1 Year'],['all','All Time']].forEach(([r, lbl]) => {
    const btn = el('button', { type: 'button', class: 'gil-range-btn' + (r === activeRange ? ' active' : ''), 'data-range': r }, lbl);
    btn.addEventListener('click', () => {
      activeRange = r;
      rangeRow.querySelectorAll('.gil-range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderFn(r);
    });
    rangeRow.appendChild(btn);
  });
  wrap.appendChild(rangeRow);
  wrap.appendChild(buildChartTypeToggle(graphId, renderFn, () => activeRange, CURRENCY_CHART_TYPES));
  wrap.appendChild(buildTrendToggle(graphId, renderFn, () => activeRange));
  wrap.appendChild(el('canvas', { id: graphId, class: 'gil-graph' }));

  const applyLatest = val => {
    amtDisplay.textContent = val !== null ? `${val.toLocaleString()} / ${cap.toLocaleString()}` : `— / ${cap.toLocaleString()}`;
    const sidebarAmt = document.getElementById(sidebarId);
    if (sidebarAmt) sidebarAmt.textContent = val !== null ? `${val.toLocaleString()} / ${cap.toLocaleString()}` : '';
    renderFn(activeRange);
  };
  logBtn.addEventListener('click', () => {
    const val = parseInt(input.value, 10);
    if (isNaN(val) || val < 0) { input.focus(); return; }
    dataArray.push({ date: new Date().toISOString(), amount: val });
    store.set(storageKey, JSON.stringify(dataArray));
    flashAutosave();
    input.value = '';
    applyLatest(val);
  });
  inputRow.appendChild(makeUndoButton(accent, dataArray, storageKey, applyLatest));
  inputRow.appendChild(makeResetTrackerButton(accent, dataArray, storageKey, applyLatest, label));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') logBtn.click(); });
  requestAnimationFrame(() => renderFn(activeRange));
  return wrap;
}

function buildTomestonesCard() {
  const card = el('div', { class: 'expansion', id: 'exp-tomestones', 'data-exp': 'tomestones', style: '--accent: var(--hw)' });

  const header = el('div', { class: 'exp-header' });
  header.append(
    el('div', { class: 'exp-title' },
      el('div', { class: 'exp-num' }, 'Currency Tracker'),
      el('div', { class: 'exp-name', html: 'Allagan <em>Tomestones</em>' })
    )
  );
  card.appendChild(header);
  card.appendChild(el('p', { class: 'exp-tagline' }, 'Track your weekly Allagan Tomestone balances. Cap is 2,000 per type.'));

  card.appendChild(buildCurrencySubSection({
    label: 'Poetics', dataArray: poeticsData, storageKey: POETICS_KEY,
    cap: 2000, graphId: 'poetics-graph', rangeRowClass: 'poetics-range-row',
    renderFn: renderPoeticsGraph, cardDisplayId: 'poetics-current-display',
    sidebarId: 'sidebar-poetics-amount', accent: 'var(--hw)',
  }));
  card.appendChild(buildCurrencySubSection({
    label: 'Mathematics', dataArray: mathematicsData, storageKey: MATHEMATICS_KEY,
    cap: 2000, graphId: 'mathematics-graph', rangeRowClass: 'mathematics-range-row',
    renderFn: renderMathematicsGraph, cardDisplayId: 'mathematics-current-display',
    sidebarId: 'sidebar-mathematics-amount', accent: 'var(--hw)',
  }));
  card.appendChild(buildCurrencySubSection({
    label: 'Mnomics', dataArray: mnomicsData, storageKey: MNOMICS_KEY,
    cap: 2000, graphId: 'mnomics-graph', rangeRowClass: 'mnomics-range-row',
    renderFn: renderMnomicsGraph, cardDisplayId: 'mnomics-current-display',
    sidebarId: 'sidebar-mnomics-amount', accent: 'var(--hw)',
  }));

  return card;
}

function buildPvpCard() {
  const card = el('div', { class: 'expansion', id: 'exp-pvp', 'data-exp': 'pvp', style: '--accent: var(--crimson)' });

  const header = el('div', { class: 'exp-header' });
  header.append(
    el('div', { class: 'exp-title' },
      el('div', { class: 'exp-num' }, 'Currency Tracker'),
      el('div', { class: 'exp-name', html: 'PvP <em>Currency</em>' })
    )
  );
  card.appendChild(header);
  card.appendChild(el('p', { class: 'exp-tagline' }, 'Track your PvP currency balances. Cap is 20,000 for both types.'));

  card.appendChild(buildCurrencySubSection({
    label: 'Wolf Mark', dataArray: wolfMarkData, storageKey: WOLF_MARK_KEY,
    cap: 20000, graphId: 'wolf-mark-graph', rangeRowClass: 'wolf-mark-range-row',
    renderFn: renderWolfMarkGraph, cardDisplayId: 'wolf-mark-current-display',
    sidebarId: 'sidebar-wolf-mark-amount', accent: 'var(--crimson)',
  }));
  card.appendChild(buildCurrencySubSection({
    label: 'Trophy Crystal', dataArray: trophyCrystalData, storageKey: TROPHY_CRYSTAL_KEY,
    cap: 20000, graphId: 'trophy-crystal-graph', rangeRowClass: 'trophy-crystal-range-row',
    renderFn: renderTrophyCrystalGraph, cardDisplayId: 'trophy-crystal-current-display',
    sidebarId: 'sidebar-trophy-crystal-amount', accent: 'var(--crimson)',
  }));

  return card;
}

// ─── Job & class level tracker card ────────────────────────────────────────

function buildJobLevelsCard() {
  const card = el('div', { class: 'expansion', id: 'exp-jobs', 'data-exp': 'jobs', style: '--accent: var(--ew)' });

  const header = el('div', { class: 'exp-header' });
  header.append(
    el('div', { class: 'exp-title' },
      el('div', { class: 'exp-num' }, 'Job Tracker'),
      el('div', { class: 'exp-name', html: 'Job &amp; Class <em>Levels</em>' })
    )
  );
  card.appendChild(header);
  card.appendChild(el('p', { class: 'exp-tagline' }, 'Log the level of every combat job, Disciple of the Land, and Disciple of the Hand. Each entry is dated — open the history graph to see progression over time. Levels appear in the side menu.'));

  JOB_GROUPS.forEach(group => {
    const section = el('div', { class: 'job-level-group' });
    section.appendChild(el('div', { class: 'job-level-group-head', style: `color: var(${group.accent})` }, group.label));

    const grid = el('div', { class: 'job-level-grid' });
    group.jobs.forEach(job => {
      const row = el('div', { class: 'job-level-row', style: `--accent: var(${group.accent})` });
      row.appendChild(el('span', { class: 'job-level-name' }, job.name));
      const currentLevel = jobLevelCurrent(job.id);

      const input = el('input', {
        type: 'number', class: 'job-level-input', id: `joblvl-${job.id}-input`,
        min: '0', max: String(job.max), value: String(currentLevel ?? 0),
        'aria-label': `${job.name} current level`,
      });

      const display = el('span', { class: 'job-level-display', id: `joblvl-${job.id}-display` }, jobLevelText(job));
      const graphId = `joblvl-${job.id}-graph`;
      let activeRange = '30d';
      const renderHoverGraph = () => renderJobLevelGraph(job, group.accent, graphId, activeRange);
      const graphWrap = el('div', { class: 'job-level-graph-wrap' });
      const popover = el('div', { class: 'job-level-graph-card', style: `--accent: var(${group.accent})` });
      popover.appendChild(el('div', { class: 'job-level-graph-head' },
        el('span', {}, `${job.name} History`),
        el('span', { class: 'job-level-graph-current', id: `joblvl-${job.id}-graph-current` }, jobLevelText(job))
      ));
      const rangeRow = el('div', { class: 'gil-range-row job-level-graph-ranges' });
      [['24h','24 Hours'],['7d','7 Days'],['30d','30 Days'],['1y','1 Year'],['all','All Time']].forEach(([r, lbl]) => {
        const btn = el('button', { type: 'button', class: 'gil-range-btn' + (r === activeRange ? ' active' : ''), 'data-range': r }, lbl);
        btn.addEventListener('click', () => {
          activeRange = r;
          rangeRow.querySelectorAll('.gil-range-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          renderHoverGraph();
        });
        rangeRow.appendChild(btn);
      });
      popover.appendChild(rangeRow);
      popover.appendChild(buildChartTypeToggle(graphId, renderHoverGraph, () => activeRange, CURRENCY_CHART_TYPES));
      popover.appendChild(buildTrendToggle(graphId, renderHoverGraph, () => activeRange));
      popover.appendChild(el('canvas', { id: graphId, class: 'gil-graph job-level-graph' }));
      const primeGraph = () => requestAnimationFrame(renderHoverGraph);
      graphWrap.addEventListener('mouseenter', primeGraph);
      graphWrap.addEventListener('focusin', primeGraph);

      const histBtn = el('button', {
        type: 'button', class: 'job-level-hist-btn job-level-graph-btn',
        title: `View ${job.name} level history`, 'aria-label': `View ${job.name} level history`,
      }, '📈');
      histBtn.addEventListener('click', e => {
        e.preventDefault();
        graphWrap.classList.toggle('open');
        primeGraph();
      });
      graphWrap.append(histBtn, popover);

      const undoBtn = el('button', {
        type: 'button', class: 'job-level-hist-btn',
        title: `Undo last ${job.name} level entry`, 'aria-label': `Undo last ${job.name} level entry`,
      }, '↶');

      // Repaint this job's card display, sidebar value, and (if open) modal.
      const refreshJob = () => {
        display.textContent = jobLevelText(job);
        input.value = String(jobLevelCurrent(job.id) ?? 0);
        const graphCurrent = document.getElementById(`joblvl-${job.id}-graph-current`);
        if (graphCurrent) graphCurrent.textContent = jobLevelText(job);
        const sb = document.getElementById(`sidebar-joblvl-${job.id}-amount`);
        if (sb) sb.textContent = jobLevelText(job);
        if (currentJobModal && currentJobModal.id === job.id) renderJobHistoryGraph(currentJobModalRange);
        renderHoverGraph();
      };

      // Logging a level appends a dated entry to the job's time series.
      const commit = () => {
        const raw = input.value.trim();
        if (raw === '') { input.value = String(jobLevelCurrent(job.id) ?? 0); return; }
        let val = parseInt(raw, 10);
        if (isNaN(val)) { input.value = String(jobLevelCurrent(job.id) ?? 0); return; }
        val = Math.max(0, Math.min(job.max, val));
        if (!Array.isArray(jobLevels[job.id])) jobLevels[job.id] = [];
        jobLevels[job.id].push({ date: new Date().toISOString(), amount: val });
        saveJobLevels();
        flashAutosave();
        input.value = String(val);
        refreshJob();
      };
      input.addEventListener('change', commit);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { commit(); } });

      undoBtn.addEventListener('click', () => {
        const series = jobLevels[job.id];
        if (!Array.isArray(series) || !series.length) { showToast('✦ Nothing to undo'); return; }
        series.pop();
        if (!series.length) delete jobLevels[job.id];
        saveJobLevels();
        flashAutosave();
        refreshJob();
        showToast('✦ Last entry removed');
      });

      row.append(input, display, graphWrap, undoBtn);
      grid.appendChild(row);
    });
    section.appendChild(grid);
    card.appendChild(section);
  });

  return card;
}

// ─── Side Quests card ─────────────────────────────────────────────────────

const SQ_EXP_LABELS = {
  arr: 'A Realm Reborn',
  hw:  'Heavensward',
  sb:  'Stormblood',
  shb: 'Shadowbringers',
  ew:  'Endwalker',
  dt:  'Dawntrail',
};

function buildSideQuestsCard() {
  const card = el('div', { class: 'expansion', id: 'exp-sidequests', 'data-exp': 'sidequests', style: '--accent: var(--recur);' });
  card.appendChild(
    el('div', { class: 'exp-header' },
      el('div', { class: 'exp-title' },
        el('div', { class: 'exp-num' }, 'Side Content'),
        el('div', { class: 'exp-name', html: 'Side <em>Quests</em>' })
      )
    )
  );
  card.appendChild(el('div', { class: 'exp-progress-row' },
    el('div', { class: 'exp-progress-bar' },
      el('div', { class: 'exp-progress-fill', 'data-card-fill': 'sidequests' })
    ),
    el('span', { class: 'exp-pct', 'data-card-pct': 'sidequests' }, '0%')
  ));
  card.appendChild(el('p', { class: 'exp-tagline' },
    'Side quest chains from across the realm, organized by expansion, region, and sub-area.'
  ));

  const content = el('div', { class: 'exp-content exp-content-stack' });

  for (const [expKey, expLabel] of Object.entries(SQ_EXP_LABELS)) {
    const secs = SIDE_QUESTS_DATA ? SIDE_QUESTS_DATA[expKey] : null;
    const total = secs ? secs.reduce((s, sec) => s + sec.quests.length, 0) : 0;
    const id = `sq-exp-${expKey}`;

    const wrap = el('div', { class: 'section', id, 'data-section': id });
    const head = el('div', { class: 'section-head' });
    const chev  = el('span', { class: 'chev' }, '▶');
    const title = el('span', { class: 'section-title' }, expLabel);
    const count = el('span', { class: 'section-count', 'data-sq-exp-count': expKey },
      '0', el('span', { class: 'total' }, ` / ${total}`));
    head.append(chev, title, count);
    head.onclick = () => toggleSection(id, wrap);
    wrap.appendChild(head);

    const body = el('div', { class: 'section-body' });
    if (secs) {
      // Side quests render as a numbered list (buildQuestLi); object entries carry
      // location/coords/giver meta, which buildQuestLi shows under each title.
      secs.forEach(sec => {
        body.appendChild(buildSection(sec, false));
      });
    } else {
      body.appendChild(el('p', { class: 'future-note' }, `${expLabel} side quest tracking coming soon.`));
    }
    wrap.appendChild(body);
    content.appendChild(wrap);
    if (ui.open[id]) wrap.classList.add('open');
  }

  card.appendChild(content);
  return card;
}

function renderSideQuestCounts() {
  if (!SIDE_QUESTS_DATA) return;
  let grandDone = 0, grandTotal = 0;

  for (const expKey of Object.keys(SQ_EXP_LABELS)) {
    const secs = SIDE_QUESTS_DATA[expKey];
    if (!secs) continue;
    let expDone = 0, expTotal = 0;
    secs.forEach(sec => {
      const n = sec.quests.length;
      let done = 0;
      for (let i = 0; i < n; i++) if (checked[`${sec.id}-${i}`]) done++;
      expDone += done; expTotal += n;
      const sc = cachedSel(`[data-section-count="${sec.id}"]`);
      if (sc) sc.firstChild.nodeValue = `${done}`;
      const mb = cachedSel(`[data-mass-btn="${sec.id}"]`);
      if (mb) mb.textContent = (done === n && n) ? 'Clear section' : 'Mark all complete';
    });
    const cc = cachedSel(`[data-sq-exp-count="${expKey}"]`);
    if (cc) { cc.firstChild.nodeValue = `${expDone}`; }
    const sbPct = cachedSel(`[data-sidebar-pct="sq-exp-${expKey}"]`);
    if (sbPct) sbPct.textContent = expTotal ? `${Math.round((expDone / expTotal) * 100)}%` : '0%';
    grandDone += expDone; grandTotal += expTotal;
  }

  const pct = grandTotal ? Math.round((grandDone / grandTotal) * 100) : 0;
  const fill = document.querySelector('[data-card-fill="sidequests"]');
  if (fill) fill.style.width = `${pct}%`;
  const pctEl = document.querySelector('[data-card-pct="sidequests"]');
  if (pctEl) pctEl.textContent = `${pct}%`;
  const sbPct = document.querySelector('[data-sidebar-pct="sidequests"]');
  if (sbPct) sbPct.textContent = `${pct}%`;
}

// ─── Orchestrion Rolls card ───────────────────────────────────────────────

function buildOrchestrionCard() {
  const card = el('div', { class: 'expansion', id: 'exp-orchestrion', 'data-exp': 'orchestrion', style: '--accent: var(--recur);' });
  card.appendChild(
    el('div', { class: 'exp-header' },
      el('div', { class: 'exp-title' },
        el('div', { class: 'exp-num' }, 'Side Content'),
        el('div', { class: 'exp-name', html: 'Orchestrion <em>Rolls</em>' })
      )
    )
  );
  card.appendChild(el('div', { class: 'exp-progress-row' },
    el('div', { class: 'exp-progress-bar' },
      el('div', { class: 'exp-progress-fill', 'data-card-fill': 'orchestrion' })
    ),
    el('span', { class: 'exp-pct', 'data-card-pct': 'orchestrion' }, '0%')
  ));
  card.appendChild(el('p', { class: 'exp-tagline' },
    'Collect orchestrion rolls from across Eorzea, grouped by how they are obtained. Data sourced from the FFXIV Community Wiki.'
  ));

  const content = el('div', { class: 'exp-content exp-content-stack' });
  if (typeof ORCHESTRION_DATA !== 'undefined' && ORCHESTRION_DATA) {
    ORCHESTRION_DATA.forEach(sec => content.appendChild(buildSection(sec, true)));
  } else {
    content.appendChild(el('p', { class: 'future-note' }, 'Orchestrion roll data unavailable.'));
  }
  card.appendChild(content);
  return card;
}

function renderOrchestrionCounts() {
  if (typeof ORCHESTRION_DATA === 'undefined' || !ORCHESTRION_DATA) return;
  let grandDone = 0, grandTotal = 0;
  ORCHESTRION_DATA.forEach(sec => {
    const n = sec.quests.length;
    let done = 0;
    for (let i = 0; i < n; i++) if (checked[`${sec.id}-${i}`]) done++;
    grandDone += done; grandTotal += n;
    const sc = cachedSel(`[data-section-count="${sec.id}"]`);
    if (sc) sc.firstChild.nodeValue = `${done}`;
    const mb = cachedSel(`[data-mass-btn="${sec.id}"]`);
    if (mb) mb.textContent = (done === n && n) ? 'Clear section' : 'Mark all complete';
    const sbCat = cachedSel(`[data-sidebar-pct="${sec.id}"]`);
    if (sbCat) sbCat.textContent = n ? `${Math.round((done / n) * 100)}%` : '0%';
  });
  const pct = grandTotal ? Math.round((grandDone / grandTotal) * 100) : 0;
  const fill = document.querySelector('[data-card-fill="orchestrion"]');
  if (fill) fill.style.width = `${pct}%`;
  const pctEl = document.querySelector('[data-card-pct="orchestrion"]');
  if (pctEl) pctEl.textContent = `${pct}%`;
  const sbPct = document.querySelector('[data-sidebar-pct="orchestrion"]');
  if (sbPct) sbPct.textContent = `${pct}%`;
}

// ─── Achievements card ────────────────────────────────────────────────────

function buildMountsCard() {
  const card = el('div', { class: 'expansion', id: 'exp-mounts', 'data-exp': 'mounts', style: '--accent: var(--recur);' });
  card.appendChild(
    el('div', { class: 'exp-header' },
      el('div', { class: 'exp-title' },
        el('div', { class: 'exp-num' }, 'Side Content'),
        el('div', { class: 'exp-name', html: '<em>Mounts</em>' })
      )
    )
  );
  card.appendChild(el('div', { class: 'exp-progress-row' },
    el('div', { class: 'exp-progress-bar' },
      el('div', { class: 'exp-progress-fill', 'data-card-fill': 'mounts' })
    ),
    el('span', { class: 'exp-pct', 'data-card-pct': 'mounts' }, '0%')
  ));
  card.appendChild(el('p', { class: 'exp-tagline' },
    'Collect mounts from quests, duties, achievements, vendors, events, PvP, and other side content. Data sourced from the FFXIV Community Wiki.'
  ));

  const content = el('div', { class: 'exp-content exp-content-stack' });
  if (typeof MOUNTS_DATA !== 'undefined' && MOUNTS_DATA) {
    MOUNTS_DATA.forEach(sec => content.appendChild(buildSection(sec, true)));
  } else {
    content.appendChild(el('p', { class: 'future-note' }, 'Mount data unavailable.'));
  }
  card.appendChild(content);
  return card;
}

function renderMountsCounts() {
  if (typeof MOUNTS_DATA === 'undefined' || !MOUNTS_DATA) return;
  let grandDone = 0, grandTotal = 0;
  MOUNTS_DATA.forEach(sec => {
    const n = sec.quests.length;
    let done = 0;
    for (let i = 0; i < n; i++) if (checked[`${sec.id}-${i}`]) done++;
    grandDone += done; grandTotal += n;
    const sc = cachedSel(`[data-section-count="${sec.id}"]`);
    if (sc) sc.firstChild.nodeValue = `${done}`;
    const mb = cachedSel(`[data-mass-btn="${sec.id}"]`);
    if (mb) mb.textContent = (done === n && n) ? 'Clear section' : 'Mark all complete';
    const sbCat = cachedSel(`[data-sidebar-pct="${sec.id}"]`);
    if (sbCat) sbCat.textContent = n ? `${Math.round((done / n) * 100)}%` : '0%';
  });
  const pct = grandTotal ? Math.round((grandDone / grandTotal) * 100) : 0;
  const fill = document.querySelector('[data-card-fill="mounts"]');
  if (fill) fill.style.width = `${pct}%`;
  const pctEl = document.querySelector('[data-card-pct="mounts"]');
  if (pctEl) pctEl.textContent = `${pct}%`;
  const sbPct = document.querySelector('[data-sidebar-pct="mounts"]');
  if (sbPct) sbPct.textContent = `${pct}%`;
}

function buildMinionsCard() {
  const card = el('div', { class: 'expansion', id: 'exp-minions', 'data-exp': 'minions', style: '--accent: var(--recur);' });
  card.appendChild(
    el('div', { class: 'exp-header' },
      el('div', { class: 'exp-title' },
        el('div', { class: 'exp-num' }, 'Side Content'),
        el('div', { class: 'exp-name', html: '<em>Minions</em>' })
      )
    )
  );
  card.appendChild(el('div', { class: 'exp-progress-row' },
    el('div', { class: 'exp-progress-bar' },
      el('div', { class: 'exp-progress-fill', 'data-card-fill': 'minions' })
    ),
    el('span', { class: 'exp-pct', 'data-card-pct': 'minions' }, '0%')
  ));
  card.appendChild(el('p', { class: 'exp-tagline' },
    'Collect minions from duties, quests, vendors, events, crafting, ventures, PvP, and other side content. Data sourced from the FFXIV Community Wiki.'
  ));

  const content = el('div', { class: 'exp-content exp-content-stack' });
  if (typeof MINIONS_DATA !== 'undefined' && MINIONS_DATA) {
    MINIONS_DATA.forEach(sec => content.appendChild(buildSection(sec, true)));
  } else {
    content.appendChild(el('p', { class: 'future-note' }, 'Minion data unavailable.'));
  }
  card.appendChild(content);
  return card;
}

function renderMinionsCounts() {
  if (typeof MINIONS_DATA === 'undefined' || !MINIONS_DATA) return;
  let grandDone = 0, grandTotal = 0;
  MINIONS_DATA.forEach(sec => {
    const n = sec.quests.length;
    let done = 0;
    for (let i = 0; i < n; i++) if (checked[`${sec.id}-${i}`]) done++;
    grandDone += done; grandTotal += n;
    const sc = cachedSel(`[data-section-count="${sec.id}"]`);
    if (sc) sc.firstChild.nodeValue = `${done}`;
    const mb = cachedSel(`[data-mass-btn="${sec.id}"]`);
    if (mb) mb.textContent = (done === n && n) ? 'Clear section' : 'Mark all complete';
    const sbCat = cachedSel(`[data-sidebar-pct="${sec.id}"]`);
    if (sbCat) sbCat.textContent = n ? `${Math.round((done / n) * 100)}%` : '0%';
  });
  const pct = grandTotal ? Math.round((grandDone / grandTotal) * 100) : 0;
  const fill = document.querySelector('[data-card-fill="minions"]');
  if (fill) fill.style.width = `${pct}%`;
  const pctEl = document.querySelector('[data-card-pct="minions"]');
  if (pctEl) pctEl.textContent = `${pct}%`;
  const sbPct = document.querySelector('[data-sidebar-pct="minions"]');
  if (sbPct) sbPct.textContent = `${pct}%`;
}

function buildTripleTriadCard() {
  const card = el('div', { class: 'expansion', id: 'exp-triple-triad', 'data-exp': 'triple-triad', style: '--accent: var(--recur);' });
  card.appendChild(
    el('div', { class: 'exp-header' },
      el('div', { class: 'exp-title' },
        el('div', { class: 'exp-num' }, 'Side Content'),
        el('div', { class: 'exp-name', html: 'Triple Triad <em>Cards</em>' })
      )
    )
  );
  card.appendChild(el('div', { class: 'exp-progress-row' },
    el('div', { class: 'exp-progress-bar' },
      el('div', { class: 'exp-progress-fill', 'data-card-fill': 'triple-triad' })
    ),
    el('span', { class: 'exp-pct', 'data-card-pct': 'triple-triad' }, '0%')
  ));
  card.appendChild(el('p', { class: 'exp-tagline' },
    'Collect Triple Triad cards from NPCs, the Gold Saucer, duties, achievements, and other side content. Data sourced from the FFXIV Community Wiki.'
  ));

  const content = el('div', { class: 'exp-content exp-content-stack' });
  if (typeof TRIPLE_TRIAD_DATA !== 'undefined' && TRIPLE_TRIAD_DATA) {
    TRIPLE_TRIAD_DATA.forEach(sec => content.appendChild(buildSection(sec, true)));
  } else {
    content.appendChild(el('p', { class: 'future-note' }, 'Triple Triad card data unavailable.'));
  }
  card.appendChild(content);
  return card;
}

function renderTripleTriadCounts() {
  if (typeof TRIPLE_TRIAD_DATA === 'undefined' || !TRIPLE_TRIAD_DATA) return;
  let grandDone = 0, grandTotal = 0;
  TRIPLE_TRIAD_DATA.forEach(sec => {
    const n = sec.quests.length;
    let done = 0;
    for (let i = 0; i < n; i++) if (checked[`${sec.id}-${i}`]) done++;
    grandDone += done; grandTotal += n;
    const sc = cachedSel(`[data-section-count="${sec.id}"]`);
    if (sc) sc.firstChild.nodeValue = `${done}`;
    const mb = cachedSel(`[data-mass-btn="${sec.id}"]`);
    if (mb) mb.textContent = (done === n && n) ? 'Clear section' : 'Mark all complete';
    const sbCat = cachedSel(`[data-sidebar-pct="${sec.id}"]`);
    if (sbCat) sbCat.textContent = n ? `${Math.round((done / n) * 100)}%` : '0%';
  });
  const pct = grandTotal ? Math.round((grandDone / grandTotal) * 100) : 0;
  const fill = document.querySelector('[data-card-fill="triple-triad"]');
  if (fill) fill.style.width = `${pct}%`;
  const pctEl = document.querySelector('[data-card-pct="triple-triad"]');
  if (pctEl) pctEl.textContent = `${pct}%`;
  const sbPct = document.querySelector('[data-sidebar-pct="triple-triad"]');
  if (sbPct) sbPct.textContent = `${pct}%`;
}

// Achievement sections excluded from percentage maths (still shown/tickable).
// Seasonal Events are time-limited and missable, so counting them would make
// 100% effectively unreachable for most players.
const ACH_PCT_EXCLUDED = new Set(['ach-q-seasonal']);

function buildAchievementsCard() {
  const card = el('div', { class: 'expansion', id: 'exp-achievements', 'data-exp': 'achievements', style: '--accent: var(--recur);' });
  card.appendChild(
    el('div', { class: 'exp-header' },
      el('div', { class: 'exp-title' },
        el('div', { class: 'exp-num' }, 'Side Content'),
        el('div', { class: 'exp-name', html: '<em>Achievements</em>' })
      )
    )
  );
  card.appendChild(el('div', { class: 'exp-progress-row' },
    el('div', { class: 'exp-progress-bar' },
      el('div', { class: 'exp-progress-fill', 'data-card-fill': 'achievements' })
    ),
    el('span', { class: 'exp-pct', 'data-card-pct': 'achievements' }, '0%')
  ));
  card.appendChild(el('p', { class: 'exp-tagline' },
    'Track your progress across all achievement categories.'
  ));

  const content = el('div', { class: 'exp-content exp-content-stack' });

  const achCategories = [
    { id: 'ach-battle',      label: 'Battle',              dataKey: 'battle' },
    { id: 'ach-pvp',         label: 'PvP',                 dataKey: 'pvp' },
    { id: 'ach-character',   label: 'Character',           dataKey: 'character' },
    { id: 'ach-items',       label: 'Items',               dataKey: 'items' },
    { id: 'ach-crafting',    label: 'Crafting & Gathering', dataKey: 'crafting' },
    { id: 'ach-quests',      label: 'Quests',               dataKey: 'quests' },
    { id: 'ach-exploration', label: 'Exploration',          dataKey: 'exploration' },
    { id: 'ach-gc',          label: 'Grand Company',        dataKey: 'gc' },
  ];

  achCategories.forEach(({ id, label, dataKey }) => {
    const subs = dataKey && ACHIEVEMENTS_DATA ? ACHIEVEMENTS_DATA[dataKey] : null;
    const total = subs ? subs.reduce((s, sec) => s + sec.quests.length, 0) : 0;

    const wrap = el('div', { class: 'section', id, 'data-section': id });
    const head = el('div', { class: 'section-head' });
    const chev  = el('span', { class: 'chev' }, '▶');
    const title = el('span', { class: 'section-title' }, label);
    const count = subs
      ? el('span', { class: 'section-count', 'data-ach-cat-count': id }, `0 / ${total}`)
      : el('span', { class: 'section-count' }, 'Coming soon');
    head.append(chev, title, count);
    head.onclick = () => toggleSection(id, wrap);
    wrap.appendChild(head);

    const body = el('div', { class: 'section-body' });
    if (subs) {
      subs.forEach(sec => body.appendChild(buildSection(sec, true, { showAchievementDescriptions: true })));
    } else {
      body.appendChild(el('p', { class: 'future-note' }, `${label} achievement tracking coming soon.`));
    }
    wrap.appendChild(body);
    content.appendChild(wrap);
    if (ui.open[id]) wrap.classList.add('open');
  });

  card.appendChild(content);
  return card;
}

function renderAchievementCounts() {
  if (!ACHIEVEMENTS_DATA) return;
  let grandDone = 0, grandTotal = 0;
  for (const [dataKey, catId] of [
    ['battle', 'ach-battle'],
    ['pvp', 'ach-pvp'],
    ['character', 'ach-character'],
    ['items', 'ach-items'],
    ['crafting', 'ach-crafting'],
    ['quests', 'ach-quests'],
    ['exploration', 'ach-exploration'],
    ['gc', 'ach-gc'],
  ]) {
    const subs = ACHIEVEMENTS_DATA[dataKey];
    if (!subs) continue;
    let catDone = 0, catTotal = 0;
    subs.forEach(sec => {
      const n = sec.quests.length;
      let done = 0;
      for (let i = 0; i < n; i++) if (checked[`${sec.id}-${i}`]) done++;
      // Seasonal Events are time-limited/missable, so they're tracked but kept
      // out of the percentage maths (category count and the overall total).
      if (!ACH_PCT_EXCLUDED.has(sec.id)) { catDone += done; catTotal += n; }
      const sc = cachedSel(`[data-section-count="${sec.id}"]`);
      if (sc) sc.firstChild.nodeValue = `${done}`;
      const mb = cachedSel(`[data-mass-btn="${sec.id}"]`);
      if (mb) mb.textContent = (done === n && n) ? 'Clear section' : 'Mark all complete';
    });
    const cc = cachedSel(`[data-ach-cat-count="${catId}"]`);
    if (cc) cc.textContent = `${catDone} / ${catTotal}`;
    const catPct = catTotal ? Math.round((catDone / catTotal) * 100) : 0;
    const sbCatPct = cachedSel(`[data-sidebar-pct="${catId}"]`);
    if (sbCatPct) sbCatPct.textContent = `${catPct}%`;
    const sbCatCount = cachedSel(`[data-sidebar-count="${catId}"]`);
    if (sbCatCount) sbCatCount.textContent = `${catDone}/${catTotal}`;
    grandDone += catDone; grandTotal += catTotal;
  }
  const pct = grandTotal ? Math.round((grandDone / grandTotal) * 100) : 0;
  const fill = document.querySelector('[data-card-fill="achievements"]');
  if (fill) fill.style.width = `${pct}%`;
  const pctEl = document.querySelector('[data-card-pct="achievements"]');
  if (pctEl) pctEl.textContent = `${pct}%`;
  const sbPct = document.querySelector('[data-sidebar-pct="ach"]');
  if (sbPct) sbPct.textContent = `${pct}%`;
}

// ─── Main build ───────────────────────────────────────────────────────────

function build() {
  _selCache.clear();
  // Build the ~40 cards into a detached fragment and append once at the end so
  // the browser performs a single layout pass instead of reflowing per card.
  // `root` is shadowed here so every `root.appendChild(...)` below targets the
  // fragment; the live #atlas-body is flushed in one operation afterwards.
  const frag = document.createDocumentFragment();
  const root = frag;
  ATLAS.forEach(exp => root.appendChild(buildExpansion(exp)));
  root.appendChild(buildQuestGroupCard(
    'deep', 'recur',
    'Deep <em>Dungeons</em>',
    'A floor-by-floor tracker for each Deep Dungeon. Expand a 10-floor block, then tick each cleared level.',
    DEEP_DUNGEON_QUESTS,
    (rg, idx) => idx !== 1
  ));
  root.appendChild(buildQuestGroupCard(
    'hildi', 'recur',
    'Hildibrand <em>Quests</em>',
    'Inspector extraordinaire questline progression from ARR through Dawntrail.',
    HILDEBRAND_QUESTS,
    (rg, idx) => idx % 2 === 0
  ));
  root.appendChild(buildQuestGroupCard(
    'relic', 'recur',
    'Relic <em>Weapons</em>',
    'Long-form weapon progression across every expansion relic series.',
    RELIC_WEAPONS,
    (rg, idx) => idx % 2 === 0
  ));
  root.appendChild(buildSideQuestsCard());
  root.appendChild(buildOrchestrionCard());
  root.appendChild(buildMountsCard());
  root.appendChild(buildMinionsCard());
  root.appendChild(buildTripleTriadCard());
  root.appendChild(buildAchievementsCard());
  root.appendChild(buildTankCard());
  root.appendChild(buildHealerCard());
  root.appendChild(buildDpsCard());
  root.appendChild(buildDoLCard());
  root.appendChild(buildDoHCard());

  root.appendChild(buildQuestGroupCard(
    'role-tank', 'tank',
    'Tank <em>Role Quests</em>',
    'Role-specific quests for all tank jobs (PLD, WAR, DRK, GNB).',
    ROLE_QUESTS.filter(rg => rg.role === 'Tank'),
    () => true
  ));
  root.appendChild(buildQuestGroupCard(
    'role-healer', 'healer',
    'Healer <em>Role Quests</em>',
    'Role-specific quests for all healer jobs (WHM, SCH, AST, SGE).',
    ROLE_QUESTS.filter(rg => rg.role === 'Healer'),
    () => true
  ));
  root.appendChild(buildQuestGroupCard(
    'role-melee', 'dps',
    'Melee DPS <em>Role Quests</em>',
    'Role-specific quests for all melee DPS jobs (MNK, DRG, NIN, SAM, RPR, VPR).',
    ROLE_QUESTS.filter(rg => rg.role === 'Melee DPS'),
    () => true
  ));
  root.appendChild(buildQuestGroupCard(
    'role-ranged', 'dps',
    'Ranged DPS <em>Role Quests</em>',
    'Role-specific quests for all ranged DPS jobs (BRD, MCH, DNC, BLM, SMN, RDM, PCT).',
    ROLE_QUESTS.filter(rg => rg.role === 'Ranged DPS'),
    () => true
  ));

  root.appendChild(buildDailyWeeklyCard());
  buildAetherCurrentsCards().forEach(c => root.appendChild(c));
  root.appendChild(buildGuideCard('guide-dungeons',    'Guides — A Realm Reborn', 'Dungeons', 'Boss mechanics and key tips for every ARR dungeon.', ARR_DUNGEON_GUIDES));
  root.appendChild(buildGuideCard('guide-trials',      'Guides — A Realm Reborn', 'Trials',   'Boss mechanics and key tips for every ARR trial.',   ARR_TRIAL_GUIDES));
  root.appendChild(buildGuideCard('guide-raids',       'Guides — A Realm Reborn', 'Raids',    'Boss mechanics and key tips for every ARR raid.',    ARR_RAID_GUIDES));
  root.appendChild(buildGuideCard('guide-hw-dungeons', 'Guides — Heavensward',    'Dungeons', 'Boss mechanics and key tips for every HW dungeon.',  HW_DUNGEON_GUIDES));
  root.appendChild(buildGuideCard('guide-hw-trials',   'Guides — Heavensward',    'Trials',   'Boss mechanics and key tips for every HW trial.',    HW_TRIAL_GUIDES));
  root.appendChild(buildGuideCard('guide-hw-raids',    'Guides — Heavensward',    'Raids',    'Boss mechanics and key tips for every HW raid.',     HW_RAID_GUIDES));
  root.appendChild(buildGuideCard('guide-sb-dungeons', 'Guides — Stormblood',     'Dungeons', 'Boss mechanics and key tips for every SB dungeon.',  SB_DUNGEON_GUIDES));
  root.appendChild(buildGuideCard('guide-sb-trials',   'Guides — Stormblood',     'Trials',   'Boss mechanics and key tips for every SB trial.',    SB_TRIAL_GUIDES));
  root.appendChild(buildGuideCard('guide-sb-raids',    'Guides — Stormblood',     'Raids',    'Boss mechanics and key tips for every SB raid.',     SB_RAID_GUIDES));
  root.appendChild(buildGuideCard('guide-shb-dungeons','Guides — Shadowbringers', 'Dungeons', 'Boss mechanics and key tips for every ShB dungeon.', SHB_DUNGEON_GUIDES));
  root.appendChild(buildGuideCard('guide-shb-trials',  'Guides — Shadowbringers', 'Trials',   'Boss mechanics and key tips for every ShB trial.',   SHB_TRIAL_GUIDES));
  root.appendChild(buildGuideCard('guide-shb-raids',   'Guides — Shadowbringers', 'Raids',    'Boss mechanics and key tips for every ShB raid.',    SHB_RAID_GUIDES));
  root.appendChild(buildGuideCard('guide-ew-dungeons', 'Guides — Endwalker',      'Dungeons', 'Boss mechanics and key tips for every EW dungeon.',  EW_DUNGEON_GUIDES));
  root.appendChild(buildGuideCard('guide-ew-trials',   'Guides — Endwalker',      'Trials',   'Boss mechanics and key tips for every EW trial.',    EW_TRIAL_GUIDES));
  root.appendChild(buildGuideCard('guide-ew-raids',    'Guides — Endwalker',      'Raids',    'Boss mechanics and key tips for every EW raid.',     EW_RAID_GUIDES));
  root.appendChild(buildGuideCard('guide-dt-dungeons', 'Guides — Dawntrail',      'Dungeons', 'Boss mechanics and key tips for every DT dungeon.',  DT_DUNGEON_GUIDES));
  root.appendChild(buildGuideCard('guide-dt-trials',   'Guides — Dawntrail',      'Trials',   'Boss mechanics and key tips for every DT trial.',    DT_TRIAL_GUIDES));
  root.appendChild(buildGuideCard('guide-dt-raids',    'Guides — Dawntrail',      'Raids',    'Boss mechanics and key tips for every DT raid.',     DT_RAID_GUIDES));
  root.appendChild(buildGilCard());
  root.appendChild(buildMgpCard());
  root.appendChild(buildVentureCard());
  root.appendChild(buildSealCard());
  root.appendChild(buildTomestonesCard());
  root.appendChild(buildPvpCard());
  root.appendChild(buildJobLevelsCard());

  const atlasBody = document.getElementById('atlas-body');
  atlasBody.innerHTML = '';
  atlasBody.appendChild(frag);
}

// ─── Render (update counts, progress bars, checked states) ────────────────

function renderQuestGroupCounts(cardId, roleGroups) {
  let totalDone = 0, totalItems = 0;
  roleGroups.forEach(rg => {
    rg.jobs.forEach(job => {
      let jobDone = 0, jobTotal = 0;
      const allSections = [...job.sections, ...(job.huntSections || [])];
      allSections.forEach(sec => {
        const n = sec.quests.length;
        let done = 0;
        for (let i = 0; i < n; i++) if (checked[`${sec.id}-${i}`]) done++;
        jobDone += done; jobTotal += n;
        const sc = cachedSel(`[data-section-count="${sec.id}"]`);
        if (sc) sc.firstChild.nodeValue = `${done}`;
        const mb = cachedSel(`[data-mass-btn="${sec.id}"]`);
        if (mb) mb.textContent = (done === n && n) ? 'Clear section' : 'Mark all complete';
      });
      totalDone += jobDone; totalItems += jobTotal;
      const jc = document.getElementById(`${cardId}-${job.id}-count`);
      if (jc) jc.textContent = `${jobDone} / ${jobTotal}`;
      const jobPct = jobTotal ? Math.round((jobDone / jobTotal) * 100) : 0;
      const sbJobPct = cachedSel(`[data-sidebar-pct="${job.id}"]`);
      if (sbJobPct) sbJobPct.textContent = `${jobPct}%`;
    });
  });
  const tc = document.getElementById(`${cardId}-total-count`);
  if (tc) tc.firstChild.nodeValue = `${totalDone}`;
  const pct = totalItems ? Math.round((totalDone / totalItems) * 100) : 0;
  const fill = cachedSel(`[data-card-fill="${cardId}"]`);
  if (fill) fill.style.width = `${pct}%`;
  const pctEl = cachedSel(`[data-card-pct="${cardId}"]`);
  if (pctEl) pctEl.textContent = `${pct}%`;
  const sbPct = cachedSel(`[data-sidebar-pct="${cardId}"]`);
  if (sbPct) sbPct.textContent = `${pct}%`;
  return { done: totalDone, total: totalItems };
}

// Update the progressive-reveal state of a single MSQ quest. Only mutates the DOM
// when the quest's hidden state actually flips, so unchanged quests are untouched.
function updateQuestRevealAt(sec, i) {
  const id = `${sec.id}-${i}`;
  const li = document.querySelector(`li.quest[data-id="${id}"]`);
  if (!li) return;
  const titleEl = li.querySelector('.quest-title');
  if (!titleEl) return;

  const q = sec.quests[i];
  const name = qName(q);
  const prevId = i > 0 ? `${sec.id}-${i - 1}` : null;
  const hideTitle = isProgressiveRevealEnabled() && i > 0 && !checked[prevId];
  if (titleEl.classList.contains('quest-title-hidden') === hideTitle) return;

  const unlocks = questUnlocks(name);
  const meta = qMetaText(q);
  titleEl.classList.toggle('quest-title-hidden', hideTitle);
  titleEl.textContent = hideTitle ? '?????' : name;
  // Meta (location/coords/giver) is a spoiler too — only show it when revealed.
  if (meta && !hideTitle) titleEl.appendChild(el('span', { class: 'quest-tag' }, ` · ${meta}`));
  if (unlocks && unlocks.length) titleEl.appendChild(buildUnlockMarker(unlocks));
  if (AETHER_CURRENT_MSQ_QUESTS.has(name)) {
    titleEl.appendChild(el('span', { class: 'unlock-pill unlock-aether', style: 'margin-left:6px;' }, 'Aether Current'));
  } else if (AETHER_UNLOCK_MSQ_QUESTS.has(name)) {
    titleEl.appendChild(el('span', { class: 'unlock-pill unlock-aether', style: 'margin-left:6px;' }, 'Unlocks AC Quests'));
  }
  appendAchievementMarker(titleEl, name, hideTitle);
  const dateWrap = li.querySelector('.quest-date');
  if (hideTitle && dateWrap) {
    dateWrap.remove();
  } else if (!hideTitle && !dateWrap) {
    li.appendChild(el('span', { class: 'quest-date' }, buildDateChip(`date-item-${id}`)));
  }
}

// Toggling quest `idx` only changes whether quest `idx + 1` is revealed.
function revealNextQuest(sec, idx) {
  const next = idx + 1;
  if (next < sec.quests.length) updateQuestRevealAt(sec, next);
}

// ─── Grand Company ────────────────────────────────────────────────────────
// After "The Company You Keep" (ARR, level 20) the MSQ briefly branches by the
// Grand Company you join, then reconverges at "Sylph-management". Two quest
// slots differ: the join quest itself, and the single follow-up. Source:
// FFXIV Community Wiki "The Company You Keep (<GC>)" quest pages.
const GC_LABELS = { maelstrom: 'Maelstrom', twinadder: 'Order of the Twin Adder', flames: 'Immortal Flames' };
const GC_FOLLOWUP = { maelstrom: 'Till Sea Swallows All', twinadder: "Wood's Will Be Done", flames: 'For Coin and Country' };

function findMsqSectionById(id) {
  for (const exp of ATLAS) {
    if (exp.patchOnly || !exp.categories) continue;
    for (const cat of exp.categories) {
      if (!cat.sections) continue;
      const hit = cat.sections.find(s => s.id === id);
      if (hit) return hit;
    }
  }
  return null;
}

// Set an MSQ quest's display title from `name`, keeping the data array in sync
// (so progressive reveal and search use it too). Skips DOM text for quests
// currently hidden by progressive reveal — their data is updated and the new
// title shows when they're revealed.
function setMsqQuestTitle(sec, i, name) {
  sec.quests[i] = name;
  const li = document.querySelector(`li.quest[data-id="${sec.id}-${i}"]`);
  if (!li) return;
  const titleEl = li.querySelector('.quest-title');
  if (!titleEl || titleEl.classList.contains('quest-title-hidden')) return;
  // Resetting textContent also drops the GC-variant quest's stale location/coords/
  // giver tag (it differs per company and isn't tracked) rather than show a wrong one.
  titleEl.textContent = name;
  const unlocks = questUnlocks(name);
  if (unlocks && unlocks.length) titleEl.appendChild(buildUnlockMarker(unlocks));
  if (AETHER_CURRENT_MSQ_QUESTS.has(name)) {
    titleEl.appendChild(el('span', { class: 'unlock-pill unlock-aether', style: 'margin-left:6px;' }, 'Aether Current'));
  } else if (AETHER_UNLOCK_MSQ_QUESTS.has(name)) {
    titleEl.appendChild(el('span', { class: 'unlock-pill unlock-aether', style: 'margin-left:6px;' }, 'Unlocks AC Quests'));
  }
  appendAchievementMarker(titleEl, name);
}

// Swap the GC-divergent ARR MSQ quests to the chosen company's variants.
// `gc` is 'maelstrom' | 'twinadder' | 'flames' | null (null = unset/default).
function applyGrandCompany(gc) {
  const sec = findMsqSectionById('arr-l15');
  if (!sec) return;
  const tcykIdx = sec.quests.findIndex(q => /^The Company You Keep/.test(qName(q)));
  if (tcykIdx < 0) return;
  const join = gc ? `The Company You Keep (${GC_LABELS[gc]})` : 'The Company You Keep';
  const follow = GC_FOLLOWUP[gc] || GC_FOLLOWUP.twinadder;
  setMsqQuestTitle(sec, tcykIdx, join);
  setMsqQuestTitle(sec, tcykIdx + 1, follow);
  const noteText = gc ? GC_LABELS[gc] : 'Order of the Twin Adder';
  sec.note = noteText;
  const noteEl = document.querySelector('[data-section="arr-l15"] .section-note');
  if (noteEl) noteEl.textContent = ` — ${noteText}`;
}

function updateMsqProgressiveReveal() {
  ATLAS.forEach(exp => {
    if (exp.patchOnly) return;
    exp.categories.forEach(cat => {
      if (!cat.isMsq) return;
      cat.sections.forEach(sec => {
        sec.quests.forEach((_, i) => updateQuestRevealAt(sec, i));
      });
    });
  });
}

// Recompute MSQ/duty counts, expansion bars, sidebar %s and the overall
// segmented bar from `checked`. Pure data loops + targeted DOM writes — no
// full-document li scan.
function renderAtlasCounts() {
  let totalMsq = 0, doneMsq = 0;
  const expSegData = [];

  ATLAS.forEach(exp => {
    let eMsqDone = 0, eMsqTotal = 0;
    let eOtherDone = 0, eOtherTotal = 0;

    if (exp.patchOnly) {
      let cDone = 0;
      exp.patches.forEach(p => {
        eMsqTotal++; totalMsq++;
        if (checked[p.id]) { eMsqDone++; doneMsq++; cDone++; }
      });
      const cc = cachedSel(`[data-cat-count="${exp.id}-patches"]`);
      if (cc) cc.textContent = `${cDone} / ${exp.patches.length}`;
    } else {
      exp.categories.forEach(cat => {
        let cDone = 0, cTotal = 0;
        cat.sections.forEach(sec => {
          let sDone = 0;
          const n = sec.quests.length;
          for (let i = 0; i < n; i++) {
            const id = `${sec.id}-${i}`;
            cTotal++;
            if (cat.isMsq) {
              eMsqTotal++; totalMsq++;
              if (checked[id]) { eMsqDone++; doneMsq++; cDone++; sDone++; }
            } else {
              eOtherTotal++;
              if (checked[id]) { eOtherDone++; cDone++; sDone++; }
            }
          }
          const sc = cachedSel(`[data-section-count="${sec.id}"]`);
          if (sc) sc.firstChild.nodeValue = `${sDone}`;
          const mb = cachedSel(`[data-mass-btn="${sec.id}"]`);
          if (mb) mb.textContent = (sDone === n && n) ? 'Clear section' : 'Mark all complete';
        });
        const cc = cachedSel(`[data-cat-count="${cat.id}"]`);
        if (cc) cc.textContent = `${cDone} / ${cTotal}`;
      });
    }

    const ec = cachedSel(`[data-exp-count="${exp.id}"]`);
    if (ec) {
      ec.firstChild.nodeValue = `${eMsqDone}`;
      ec.querySelector('.total').textContent = ` / ${eMsqTotal} MSQ`;
    }
    const em = cachedSel(`[data-exp-mini="${exp.id}"]`);
    if (em && eOtherTotal > 0) em.textContent = `+ ${eOtherDone} / ${eOtherTotal} duties`;

    const ePct = eMsqTotal ? Math.round((eMsqDone / eMsqTotal) * 100) : 0;
    const ef = cachedSel(`[data-exp-fill="${exp.id}"]`);
    if (ef) ef.style.width = `${ePct}%`;
    const ep = cachedSel(`[data-exp-pct="${exp.id}"]`);
    if (ep) ep.textContent = `${ePct}%`;
    const eSb = cachedSel(`[data-sidebar-pct="${exp.id}"]`);
    if (eSb) eSb.textContent = `${ePct}%`;
    if (eMsqTotal > 0) expSegData.push({ exp, eMsqDone, eMsqTotal });
  });

  const pct = totalMsq ? Math.round((doneMsq / totalMsq) * 100) : 0;
  document.getElementById('overall-count').firstChild.nodeValue = `${doneMsq} / ${totalMsq} `;
  document.getElementById('overall-pct').textContent = `${pct}%`;
  const sidebarOverallCount = document.getElementById('sidebar-overall-count');
  if (sidebarOverallCount) sidebarOverallCount.textContent = `${doneMsq} / ${totalMsq} ${pct}%`;

  const renderOverallSegments = fillEl => {
    if (!fillEl) return;
    fillEl.innerHTML = '';
    expSegData.forEach(({ exp, eMsqDone, eMsqTotal }) => {
      const segPct = Math.round((eMsqDone / eMsqTotal) * 100);
      const seg = document.createElement('div');
      seg.className = 'progress-seg';
      seg.style.flex = String(eMsqTotal);
      const segFill = document.createElement('div');
      segFill.className = 'progress-seg-fill';
      segFill.style.width = `${segPct}%`;
      segFill.style.background = `var(--${exp.accent})`;
      seg.appendChild(segFill);
      fillEl.appendChild(seg);
    });
  };

  const overallFill = document.getElementById('overall-fill');
  renderOverallSegments(overallFill);
  const sidebarOverallFill = document.getElementById('sidebar-overall-fill');
  renderOverallSegments(sidebarOverallFill);
}

// Recompute the four role-quest cards plus their combined sidebar percentage.
function renderRoleCards() {
  let roleDone = 0, roleTotal = 0;
  for (const [id, filter] of [
    ['role-tank',   'Tank'],
    ['role-healer', 'Healer'],
    ['role-melee',  'Melee DPS'],
    ['role-ranged', 'Ranged DPS'],
  ]) {
    const r = renderQuestGroupCounts(id, ROLE_QUESTS.filter(rg => rg.role === filter));
    roleDone += r.done; roleTotal += r.total;
  }
  const rolePct = roleTotal ? Math.round((roleDone / roleTotal) * 100) : 0;
  const roleSb = cachedSel('[data-sidebar-pct="role"]');
  if (roleSb) roleSb.textContent = `${rolePct}%`;
}

function renderRecurCounts() {
  const dailyUnlocked = DAILY_TASKS.filter(t => !taskLockReason(t));
  const weeklyUnlocked = WEEKLY_TASKS.filter(t => !taskLockReason(t));
  const dailyDone  = dailyUnlocked.filter(t => checked[t.id]).length;
  const weeklyDone = weeklyUnlocked.filter(t => checked[t.id]).length;
  const dc = document.getElementById('daily-cat-count');
  if (dc) dc.textContent = `${dailyDone} / ${dailyUnlocked.length}`;
  const wc = document.getElementById('weekly-cat-count');
  if (wc) wc.textContent = `${weeklyDone} / ${weeklyUnlocked.length}`;
  const rc = document.getElementById('recur-total-count');
  if (rc) {
    rc.firstChild.nodeValue = `${dailyDone + weeklyDone}`;
    const total = rc.querySelector('.total');
    if (total) total.textContent = ` / ${dailyUnlocked.length + weeklyUnlocked.length}`;
  }
}

function renderAetherCounts() {
  let acTotalDone = 0, acGrandTotal = 0;
  AETHER_CURRENTS_DATA.forEach(exp => {
    let expDone = 0;
    const expTotal = exp.zones.reduce((s, z) => s + z.exploration + z.quests.length, 0);
    exp.zones.forEach(zone => {
      let zoneDone = 0, zoneTotal = zone.exploration + zone.quests.length;
      for (let i = 0; i < zone.exploration; i++) {
        const id = `${zone.id}-e-${i}`;
        if (checked[id]) { zoneDone++; expDone++; acTotalDone++; }
      }
      zone.quests.forEach((_, i) => {
        const id = `${zone.id}-q-${i}`;
        if (checked[id]) { zoneDone++; expDone++; acTotalDone++; }
      });
      const zc = document.getElementById(`aether-zone-${zone.id}-count`);
      if (zc) zc.textContent = `${zoneDone} / ${zoneTotal}`;
    });
    const ec = document.getElementById(`aether-exp-${exp.id}-count`);
    if (ec) ec.firstChild.nodeValue = `${expDone}`;
    acGrandTotal += expTotal;
    const expPct = expTotal ? Math.round((expDone / expTotal) * 100) : 0;
    const expFill = cachedSel(`[data-card-fill="aether-${exp.id}"]`);
    if (expFill) expFill.style.width = `${expPct}%`;
    const expPctEl = cachedSel(`[data-card-pct="aether-${exp.id}"]`);
    if (expPctEl) expPctEl.textContent = `${expPct}%`;
    const expSbPct = cachedSel(`[data-sidebar-pct="aether-${exp.id}"]`);
    if (expSbPct) expSbPct.textContent = `${expPct}%`;
  });
  const acPct = acGrandTotal ? Math.round((acTotalDone / acGrandTotal) * 100) : 0;
  const acSbPct = cachedSel('[data-sidebar-pct="aether"]');
  if (acSbPct) acSbPct.textContent = `${acPct}%`;
}

// Full render — used for bulk actions (mass-toggle, expand/collapse, reset,
// file load, progressive-reveal toggle). Walks every quest node once.
function render() {
  document.querySelectorAll('li.quest').forEach(li => {
    li.dataset.checked = checked[li.dataset.id] ? 'true' : 'false';
  });
  refreshTaskLocks();
  updateMsqProgressiveReveal();
  renderAtlasCounts();
  renderQuestGroupCounts('tank',   TANK_QUESTS);
  renderQuestGroupCounts('healer', HEALER_QUESTS);
  renderQuestGroupCounts('dps',    DPS_QUESTS);
  renderQuestGroupCounts('dol',    DOL_QUESTS);
  renderQuestGroupCounts('doh',    DOH_QUESTS);
  renderQuestGroupCounts('deep',   DEEP_DUNGEON_QUESTS);
  renderQuestGroupCounts('hildi',  HILDEBRAND_QUESTS);
  renderQuestGroupCounts('relic',  RELIC_WEAPONS);
  renderRoleCards();
  renderSideQuestCounts();
  renderOrchestrionCounts();
  renderMountsCounts();
  renderMinionsCounts();
  renderTripleTriadCounts();
  renderAchievementCounts();
  renderRecurCounts();
  renderAetherCounts();
  // Date chips are NOT synced here: a full document scan of every chip is
  // wasteful for the common bulk callers that touch no dates (daily/weekly
  // reset, progressive-reveal toggle, progress reset). Callers that DO change
  // dates sync the affected chip(s) themselves — file load and boot call
  // syncDates() explicitly before render(); the mass-toggle handler syncs the
  // specific section/expansion chips it changed.
}

// ─── Scoped render (single-toggle fast path) ──────────────────────────────
// Maps every checkbox id to the one display group its toggle can affect, so a
// click updates only that group's counts/bars instead of the whole document.
let RENDER_INDEX = null;

function buildRenderIndex() {
  RENDER_INDEX = new Map();

  ATLAS.forEach(exp => {
    if (exp.patchOnly) {
      exp.patches.forEach(p => RENDER_INDEX.set(p.id, { group: 'atlas' }));
    } else {
      exp.categories.forEach(cat => {
        cat.sections.forEach(sec => {
          sec.quests.forEach((_, i) => RENDER_INDEX.set(`${sec.id}-${i}`, {
            group: 'atlas', msq: !!cat.isMsq, sec, idx: i
          }));
        });
      });
    }
  });

  const groupCards = [
    ['tank',   TANK_QUESTS],   ['healer', HEALER_QUESTS], ['dps', DPS_QUESTS],
    ['dol',    DOL_QUESTS],    ['doh',    DOH_QUESTS],     ['deep', DEEP_DUNGEON_QUESTS],
    ['hildi',  HILDEBRAND_QUESTS], ['relic', RELIC_WEAPONS],
  ];
  groupCards.forEach(([cardId, groups]) => {
    groups.forEach(rg => rg.jobs.forEach(job => {
      [...job.sections, ...(job.huntSections || [])].forEach(sec => {
        sec.quests.forEach((_, i) => RENDER_INDEX.set(`${sec.id}-${i}`, { group: 'questcard', cardId, groups }));
      });
    }));
  });

  ROLE_QUESTS.forEach(rg => rg.jobs.forEach(job => {
    job.sections.forEach(sec => {
      sec.quests.forEach((_, i) => RENDER_INDEX.set(`${sec.id}-${i}`, { group: 'role' }));
    });
  }));

  if (SIDE_QUESTS_DATA) {
    Object.values(SIDE_QUESTS_DATA).forEach(secs => {
      if (!secs) return;
      secs.forEach(sec => sec.quests.forEach((_, i) => RENDER_INDEX.set(`${sec.id}-${i}`, { group: 'sidequests' })));
    });
  }

  if (ACHIEVEMENTS_DATA) {
    Object.values(ACHIEVEMENTS_DATA).forEach(subs => {
      if (!subs) return;
      subs.forEach(sec => sec.quests.forEach((_, i) => RENDER_INDEX.set(`${sec.id}-${i}`, { group: 'achievements' })));
    });
  }

  if (typeof ORCHESTRION_DATA !== 'undefined' && ORCHESTRION_DATA) {
    ORCHESTRION_DATA.forEach(sec => sec.quests.forEach((_, i) => RENDER_INDEX.set(`${sec.id}-${i}`, { group: 'orchestrion' })));
  }

  if (typeof MOUNTS_DATA !== 'undefined' && MOUNTS_DATA) {
    MOUNTS_DATA.forEach(sec => sec.quests.forEach((_, i) => RENDER_INDEX.set(`${sec.id}-${i}`, { group: 'mounts' })));
  }

  if (typeof MINIONS_DATA !== 'undefined' && MINIONS_DATA) {
    MINIONS_DATA.forEach(sec => sec.quests.forEach((_, i) => RENDER_INDEX.set(`${sec.id}-${i}`, { group: 'minions' })));
  }

  if (typeof TRIPLE_TRIAD_DATA !== 'undefined' && TRIPLE_TRIAD_DATA) {
    TRIPLE_TRIAD_DATA.forEach(sec => sec.quests.forEach((_, i) => RENDER_INDEX.set(`${sec.id}-${i}`, { group: 'triple-triad' })));
  }

  AETHER_CURRENTS_DATA.forEach(exp => exp.zones.forEach(zone => {
    for (let i = 0; i < zone.exploration; i++) RENDER_INDEX.set(`${zone.id}-e-${i}`, { group: 'aether' });
    zone.quests.forEach((_, i) => RENDER_INDEX.set(`${zone.id}-q-${i}`, { group: 'aether' }));
  }));

  DAILY_TASKS.forEach(t => RENDER_INDEX.set(t.id, { group: 'recur' }));
  WEEKLY_TASKS.forEach(t => RENDER_INDEX.set(t.id, { group: 'recur' }));
}

// Update only what a single toggle of `id` can affect. Falls back to a full
// render() for any id not present in the index.
function renderScoped(id) {
  if (!RENDER_INDEX) buildRenderIndex();
  const info = RENDER_INDEX.get(id);
  if (!info) { render(); return; }

  const li = document.querySelector(`li.quest[data-id="${id}"]`);
  if (li) li.dataset.checked = checked[id] ? 'true' : 'false';
  refreshTaskLocks();

  switch (info.group) {
    case 'atlas':
      if (info.msq && isProgressiveRevealEnabled()) revealNextQuest(info.sec, info.idx);
      renderAtlasCounts();
      ATLAS.forEach(exp => { if (!exp.patchOnly) syncDateChip(`date-exp-${exp.id}`); });
      break;
    case 'questcard':
      renderQuestGroupCounts(info.cardId, info.groups);
      break;
    case 'role':
      renderRoleCards();
      break;
    case 'sidequests':
      renderSideQuestCounts();
      break;
    case 'achievements':
      renderAchievementCounts();
      break;
    case 'orchestrion':
      renderOrchestrionCounts();
      break;
    case 'mounts':
      renderMountsCounts();
      break;
    case 'minions':
      renderMinionsCounts();
      break;
    case 'triple-triad':
      renderTripleTriadCounts();
      break;
    case 'aether':
      renderAetherCounts();
      break;
    case 'recur':
      renderRecurCounts();
      break;
  }

  syncDateChip(`date-item-${id}`);
}
