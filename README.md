# Grade Tracker

A native macOS desktop app for BISZ (Bayside International School of Zhuhai) Grade 7 students to track academic performance across 9 subjects using a Major (60%) / Minor (40%) weighted grading system.

## Features

- **Dashboard** — Overview of all 9 subjects with current averages and trends
- **Add Score** — Log individual scores with earned/possible points, type (Major/Minor), date, and notes
- **Stats** — Per-subject breakdown: total %, GPA, Major average, Minor average, with inline editing
- **Goals** — Set target score per subject and track progress
- **Report** — Full subject rankings, strongest/weakest performance, and overall GPA

## Subjects

| Subject |
|---|
| Speech & Debate |
| English 7 |
| Chemistry |
| East Asian History |
| Chinese 7 |
| Computer Science 7 |
| Algebra & Geometry I |
| Physics 7 |
| Biology 7 New |

## Grading System

- **Major** assignments count **60%** of the weighted average
- **Minor** assignments count **40%** of the weighted average
- Score = `earned / possible × 100%`
- GPA = weighted average × 4.0

## Tech Stack

- **Tauri v2** — Native macOS app (Rust backend + WebView frontend)
- **Rust** — SQLite database, all backend logic
- **Vanilla JS/HTML/CSS** — No frameworks, fast and lightweight
- **SQLite** — Local data stored at `~/Library/Application Support/grade-tracker/grades.db`

## Install

```bash
# Build from source
cd grade-tracker-mac
npm install
npm run tauri build -- -b app

# Then open the .app from:
src-tauri/target/release/bundle/macos/Grade Tracker.app
```

## Development

```bash
npm run tauri dev    # Run in development mode
```

## Data

All data is stored locally on your Mac at:
```
~/Library/Application Support/grade-tracker/grades.db
```

Data is never sent to any server.
