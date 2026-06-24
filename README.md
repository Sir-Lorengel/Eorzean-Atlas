# Eorzean Atlas

Eorzean Atlas is a desktop progress tracker for Final Fantasy XIV. Version 2.2 builds on the first public release of the consolidated tracker: Main Scenario progress, side content, collectibles, currencies, recurring activities, job levels, guide notes, and exportable save data now live in one Windows Electron app.

It is built for players who want one persistent checklist for a whole character journey, from the opening city-state quests through Dawntrail and the long tail of optional content.

## v2.2 Patch Notes - 24 June 2026

This patch adds another Gold Saucer collection tracker:

- Added a Triple Triad card tracker sourced from the FFXIV Community Wiki, grouped by acquisition type.
- Rebuilt the Windows desktop artifacts for version 2.2.

## v2.1.1 Patch Notes - 19 June 2026

This patch adds automatic desktop update handling for Windows release builds:

- Added automatic update checks through GitHub releases for packaged desktop builds.
- Updates now download in the background and show a restart prompt once ready to install.
- Reused the existing update notice for download progress, ready-to-restart state, and manual release links.
- Added safe preload APIs for update status events and install/restart actions.
- Added Electron Builder publish metadata so release builds can generate updater metadata.
- Kept the manual GitHub release link fallback for development builds.

## v2.1 Patch Notes - 16 June 2026

This patch focuses on usability, charting, and desktop packaging polish:

- Added compact side menu mode with readable abbreviated labels instead of dots-only navigation.
- Compact mode now applies to both the left and right side menus.
- Moved the sidebar MSQ progress summary above the Expansions heading.
- Added expansion-colored segments to the sidebar total MSQ progress bar.
- Updated the sidebar version display to `V2.1`.
- Added richer currency tracker views: 24-hour range, step charts, delta charts, rolling average trend, and high-water/low-water charts.
- Reduced graph crowding in 7-day, 30-day, 1-year, and all-time currency views by showing only the latest entry for each day.
- Added tracker reset buttons and last-export backup status in Options.
- Fixed Options menu button hover styling so hover colors no longer obscure button text.
- Improved the Job Level tracker with larger retained level inputs that start at `0` and keep the latest logged value.
- Moved job level history graphs into hover/focus cards with range, graph type, and rolling average controls.
- Corrected Stormblood branch labels for M'naago in The Fringes and Meffrid in The Peaks.
- Rebuilt the Windows desktop artifacts for version 2.1 and refreshed app metadata/icon handling.

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
- Desktop auto-updates from GitHub releases, with a manual release link fallback in development.

## Tracker Coverage

The v2.0 data set includes:

- 991 Main Scenario and patch checkpoints.
- 313 dungeon, trial, raid, and related duty checklist items.
- 1,648 side quests grouped by expansion and location.
- 3,514 achievements across Battle, PvP, Character, Items, Crafting & Gathering, Quests, Exploration, and Grand Company categories.
- 932 orchestrion rolls.
- 348 mounts.
- 579 minions.
- 475 Triple Triad cards.
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

Eorzean Atlas includes dedicated trackers for side quests, aether currents, deep dungeons, Hildibrand quests, relic weapons, job and role quests, achievements, orchestrion rolls, mounts, minions, and Triple Triad cards.

### Currency and Level History

The app records dated history for gil, MGP, Ventures, Company Seals, Allagan Tomestones, Wolf Marks, Trophy Crystals, and job/class levels. Graphs support range filters, line/bar/step/delta/high-low display modes, rolling averages, daily latest-entry views, and undo/reset actions for time-series trackers.

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
