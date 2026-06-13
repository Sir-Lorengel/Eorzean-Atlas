# Eorzean Atlas

Eorzean Atlas is a desktop progress tracker for Final Fantasy XIV. Version 2.0 is the first public release of the consolidated tracker: Main Scenario progress, side content, collectibles, currencies, recurring activities, job levels, guide notes, and exportable save data now live in one Windows Electron app.

It is built for players who want one persistent checklist for a whole character journey, from the opening city-state quests through Dawntrail and the long tail of optional content.

## v2.0 First Release

This release brings the existing tracker features together under the Eorzean Atlas name:

- Main Scenario tracking for A Realm Reborn through Dawntrail, including patch-era checkpoints.
- Starting-class selection for the Gridania, Limsa Lominsa, or Ul'dah ARR opening.
- Grand Company selection for company-specific ARR quest variants.
- Progressive MSQ reveal, with an option to show every quest.
- Quest metadata for MSQ and side quests, including location, coordinates, and quest giver where available.
- Completion dates for expansions, sections, and individual checklist entries.
- Expansion and sidebar progress summaries with live percentages.
- Global search across quests, sections, achievements, collectibles, duties, bosses, guides, and side content.
- Internal navigation from search results, unlock pills, and achievement markers.
- Duty guide cards for dungeons, trials, and raids, with boss notes and pinnable hover summaries.
- Daily and weekly task log with region-aware reset support.
- Activity heatmap and streak display, with reset and hide controls.
- File-based save and load, plus local autosave.
- Theme selector with light, plain, Crystal Blue, dark, and Hydaelyn Night variants.
- Desktop update notice linked to GitHub releases.

## Tracker Coverage

The v2.0 data set includes:

- 991 Main Scenario and patch checkpoints.
- 313 dungeon, trial, raid, and related duty checklist items.
- 1,648 side quests grouped by expansion and location.
- 3,514 achievements across Battle, PvP, Character, Items, Crafting & Gathering, Quests, Exploration, and Grand Company categories.
- 932 orchestrion rolls.
- 348 mounts.
- 579 minions.
- 301 aether current objectives across 30 zones.
- 1,158 class, job, crafter, and gatherer quest checklist items.
- 84 role quest checklist items.
- 400 deep dungeon floor-block objectives.
- 55 Hildibrand quest objectives.
- 92 relic weapon progression objectives.
- 20 daily tasks and 17 weekly tasks.
- 328 dungeon, trial, and raid guide entries.

## Major Sections

### Main Scenario

Track each expansion separately with MSQ-only completion percentages, section progress, automatic expansion completion dates, progressive reveal, and side-by-side duty or feature unlock tags.

### Side Content

Eorzean Atlas includes dedicated trackers for side quests, aether currents, deep dungeons, Hildibrand quests, relic weapons, job and role quests, achievements, orchestrion rolls, mounts, and minions.

### Currency and Level History

The app records dated history for gil, MGP, Ventures, Company Seals, Allagan Tomestones, Wolf Marks, Trophy Crystals, and job/class levels. Graphs support range filters and line/bar display modes, and every time-series tracker has an undo action for the latest entry.

### Recurring Tasks

The task log tracks daily and weekly activities, supports task prerequisites, and stores reset timestamps. Jumbo Cactpot timing can be adjusted through the selected data center region.

### Search and Navigation

The search dropdown is built from the data model rather than the rendered page, so hidden MSQ entries, bosses, guide notes, collectibles, achievements, and section names remain discoverable. Selecting a result expands the target section and highlights the matching item.

## Install and Run

Install dependencies:

```powershell
npm install
```

Run the desktop app in development:

```powershell
npm run dev
```

Build a Windows installer and portable package:

```powershell
npm run dist
```

Create an unpacked Windows build for local inspection:

```powershell
npm run package
```

Run the Electron smoke check:

```powershell
npm run verify:smoke
```

## Project Layout

- `FFXIV - Atlas.html` is the app shell loaded by Electron.
- `app.js` handles data loading, boot, settings, sidebar behavior, themes, and desktop shell integration.
- `ui.js` builds and updates the tracker interface.
- `savestate.js` manages local storage, export/import, activity history, recurring resets, and save compatibility.
- `search.js` builds the global search index and result navigation.
- `charts.js` renders currency and job history graphs.
- `startingcity.js` and `datacenter.js` manage first-run and settings selectors.
- `data.js` contains the tracker data set and wiki-sourced content tables.
- `electron/` contains the Electron main process, preload bridge, and smoke verification script.
- `build/` contains app icon assets used by Electron Builder.

## Data and Saves

Progress is stored locally by default. Use **Options -> Save Data** to export a JSON backup, and **Options -> Load Data** to restore one later or move progress between machines.

The save format is intended to remain stable across releases. Existing local progress, completion dates, UI state, activity history, currencies, and job level histories are included in exported save files.

## Legal

Eorzean Atlas is an unofficial community project and is not affiliated with Square Enix. Final Fantasy XIV content and materials are trademarks and copyrights of Square Enix Holdings Co., Ltd.

This project is licensed under GPL-3.0-or-later. See `LICENSE` for details.
