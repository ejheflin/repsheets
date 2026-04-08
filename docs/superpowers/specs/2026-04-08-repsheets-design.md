# RepSheets — Design Specification

A workout tracker PWA backed by Google Sheets. Users configure routines in a spreadsheet, execute workouts in the app, and track progress over time. Supports solo athletes and coach/athlete shared environments.

## Architecture

Purely client-side SPA — no custom backend. The app runs entirely in the browser and communicates directly with Google APIs.

```
┌─────────────────────────────────────────┐
│              Browser (PWA)              │
│                                         │
│  React App                              │
│  ├── Google Identity Services (auth)    │
│  ├── Google Sheets API v4 (read/write)  │
│  ├── Google Drive API v3 (copy/share)   │
│  ├── IndexedDB (offline cache)          │
│  └── Service Worker (Workbox)           │
│                                         │
└──────────────┬──────────────────────────┘
               │ HTTPS
               ▼
┌──────────────────────────────────────────┐
│         Google APIs                      │
│  ├── Sheets API v4                       │
│  ├── Drive API v3                        │
│  └── Identity Services                   │
└──────────────────────────────────────────┘
```

**Tech Stack:**
- React 18 + Vite + TypeScript
- Tailwind CSS (mobile-first, responsive — not broken on desktop but no desktop-specific design)
- Workbox (service worker / offline)
- IndexedDB (local cache via idb or Dexie)
- Recharts (progress charts)
- Google Identity Services, Sheets API v4, Drive API v3

**Hosting:** Static deployment to Vercel or Netlify. No server-side code.

**Key layers:**
- **Auth layer** — Google Identity Services handles OAuth2, requesting scopes for Sheets + Drive
- **Data layer** — service that reads/writes to Google Sheets, with an IndexedDB mirror for offline
- **Sync engine** — queues writes when offline, flushes to Sheets when back online, handles conflicts
- **UI layer** — React components organized by 3 tabs (Routines, Workout, Logs)
- **PWA shell** — service worker caches the app shell, manifest enables install

---

## Authentication & Session Persistence

**First launch:**
1. User opens the app → landing/login screen
2. Taps "Sign in with Google" → Google OAuth consent screen
3. Scopes requested: `spreadsheets` (read/write), `drive.file` (copy/create/share)
4. On success → refresh token stored in IndexedDB (encrypted), user lands on the sheet selector

**Session persistence:**
- Access tokens last ~1 hour, refreshed silently using the stored refresh token
- Users only see the OAuth screen again if they clear browser data, revoke access, or new scopes are needed
- Effectively: login once, stay logged in indefinitely

**Returning users:**
- App remembers the last active sheet in IndexedDB
- On launch, silently refreshes the access token → loads the last sheet → user goes straight to routines
- If silent refresh fails → login screen

---

## Sheet Selection

- App queries Drive API for spreadsheets the user owns or has edit access to
- Filters for sheets matching the RepSheets schema (has "Routines" and "Log" tabs with expected columns)
- Displays matching sheets in a list with sheet name and owner
- User picks one → app loads that sheet

**"Create Example Sheet" option:**
- Shown alongside the sheet list (prominently if no matching sheets found)
- Creates a new spreadsheet with "Routines" tab (headers + selected template program) and empty "Log" tab with headers
- 5 template programs available (see Templates section)

**Sheet switching:**
- Accessible from the app header (dropdown)
- Used to switch between personal sheet and coach's shared sheet
- Switching reloads the data layer and clears in-progress workout (with confirmation prompt)

---

## Data Schema

### Routines Tab (workout configuration)

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| Program | text | yes | Program name (e.g. "5x5 Strength") |
| Routine | text | yes | Routine name (e.g. "Monday:Push") |
| Exercise | text | yes | Exercise name (e.g. "Bench Press (Heavy)") |
| Sets | text | yes | Set number or count. See Set Inference Rules below. |
| Reps | integer | no | Number of reps. Blank = no starting default. |
| Value | number | no | Weight or other measurable quantity. Blank = no starting default. |
| Unit | text | no | What Value represents (lbs, kg, seconds, miles, etc.) |
| Notes | text | no | Coach/user reminder (e.g. "last set to failure") |

**Set Inference Rules:**
1. A single row with Sets=5 means 5 identical sets (1 through 5)
2. Two rows for the same exercise with Sets=5 and Sets=10 means sets 1-5 use row 1's config, sets 6-10 use row 2's config (fill-up behavior)
3. A trailing letter (e.g. "3a") marks a superset group — exercises sharing the same letter are paired and displayed together in the workout UI

**Blank Reps/Value handling:**
- If blank in the Routine config, the workout UI shows empty fields on the first workout
- Once the user logs at least one workout, the app autofills from the most recent Log entry for that Program/Routine/Exercise/Set
- If both Routine config and Log history exist, Log history takes precedence (most recent logged value wins)

### Log Tab (append-only workout history)

Each row represents a single set. A 5-set exercise produces 5 rows.

| Column | Type | Description |
|--------|------|-------------|
| Date | date | Workout date (YYYY-MM-DD) |
| Athlete | text | User's Google email |
| Program | text | Program name |
| Routine | text | Routine name |
| Exercise | text | Exercise name |
| Set | integer | Set number (1, 2, 3...) |
| Reps | integer | Actual reps performed |
| Value | number | Actual weight/value used |
| Unit | text | Unit of Value |
| Notes | text | Per-exercise notes (e.g. "failed on rep 4") |

**Example — 5x5 bench press with a failed final set:**

| Date | Athlete | Program | Routine | Exercise | Set | Reps | Value | Unit | Notes |
|------|---------|---------|---------|----------|-----|------|-------|------|-------|
| 2026-04-08 | eric@gmail.com | 5x5 Strength | Monday:Push | Bench Press (Heavy) | 1 | 5 | 225 | lbs | |
| 2026-04-08 | eric@gmail.com | 5x5 Strength | Monday:Push | Bench Press (Heavy) | 2 | 5 | 225 | lbs | |
| 2026-04-08 | eric@gmail.com | 5x5 Strength | Monday:Push | Bench Press (Heavy) | 3 | 5 | 225 | lbs | |
| 2026-04-08 | eric@gmail.com | 5x5 Strength | Monday:Push | Bench Press (Heavy) | 4 | 5 | 225 | lbs | |
| 2026-04-08 | eric@gmail.com | 5x5 Strength | Monday:Push | Bench Press (Heavy) | 5 | 3 | 225 | lbs | failed on rep 4 |

---

## Roles & Permissions

Roles are inferred automatically — no configuration needed.

**Athlete mode:** The Log tab contains entries only from the current user (or is empty). The user sees only their own data.

**Coach mode:** The Log tab contains entries from at least one other athlete. Coach features unlock automatically. The spreadsheet owner (from Drive API) is always the coach in a shared environment.

**Athlete capabilities:**
- View routines for the active program
- Start/complete workouts, log sets
- View own logs and progress charts
- Edit only own log entries

**Coach additional capabilities:**
- Everything an athlete can do (coaches log their own workouts too)
- View all athletes' log entries and progress
- Compare metrics across athletes (side-by-side charts)
- Athlete filter/selector in the Logs tab

**Enforcement:** App-level only. The app checks the Athlete column against the current user's email before allowing edits. No row-level protection in Google Sheets itself.

---

## Sharing

### Mode 1: Share Program (copy)

For sharing routines publicly or with strangers (Reddit, gym buddy, etc.).

**Sharer flow:**
1. Taps "Share" on a program → picks "Share a Copy"
2. App sets the sheet to "anyone with the link can view" (if not already) via Drive API
3. App generates a deep link: `repsheets.app/import?sheetId=abc123&program=5x5+Strength`
4. Also generates a QR code encoding the same link
5. User shares however they want (text, Reddit, in-person)

**Recipient flow:**
1. Opens the link → app authenticates them (or prompts login)
2. App reads only the rows for the specified program from the source Routines tab
3. App appends those rows to the recipient's active sheet's Routines tab
4. If a program with the same name already exists → prompt: rename or overwrite
5. No Log data is copied — only routine configuration

### Mode 2: Add Athlete (shared access)

For coaches working with athletes on a shared sheet.

**Coach flow:**
1. Taps "Share" on a program → picks "Add Athlete"
2. App generates a deep link: `repsheets.app/join?sheetId=abc123`
3. Also generates a QR code

**Athlete flow:**
1. Opens the link → app authenticates them
2. App grants the athlete edit access to the coach's sheet via Drive API
3. Coach's sheet appears in the athlete's sheet selector
4. Athlete switches to the coach's sheet to work out

**Sheet switching for athletes:** Athletes use the header dropdown to switch between their personal sheet and the coach's sheet. Each sheet is fully independent — reads/writes go to whichever sheet is active.

**Automatic backup for athletes:** Deferred to a future version. (Nice-to-have: athletes auto-maintain a backup copy of the shared sheet in their own Drive.)

---

## Mobile UI

Dark theme (#1a1a2e background). Inspired by Hevy/Strong. Three-tab bottom navigation.

### Icon Style

Monochromatic SVG icons, filled when active (purple #6c63ff), outlined when inactive (gray #555):
- **Routines:** Document/list icon
- **Workout:** Double-plate dumbbell icon
- **Logs:** Trend line chart icon

### Tab 1: Routines

- **Program selector** — dropdown at top to switch programs
- **Routine list** — sorted in spreadsheet order, each card shows routine name + exercise summary subtitle
- **Share button** — in header area (link icon)
- **Settings button** — in header area (gear icon)
- Tapping a routine checks for an in-progress workout. If one exists → prompt to discard before continuing. If none → start the workout and navigate to Workout tab.
- Routines refresh from the sheet on pull-to-refresh (no real-time sync).

### Tab 2: Workout

**Header area:**
- Routine name as subtitle, "Workout" as title
- Red "✕ Discard" button in top right (with confirmation prompt)

**Collapsed view (default):**
- Each exercise is a row: ▶ caret on left, exercise name + summary (e.g. "5×5 @ 225 lbs"), checkbox on right
- Supersets: purple vertical bar on the left grouping paired exercises (no text label — the bar is sufficient)
- Coach notes: yellow hint text below exercise name (from Routine "Notes" column)
- Tapping the checkbox marks all sets for that exercise as complete
- Goal: fit a full workout summary on one iPhone screen

**Expanded view (tap the caret or exercise name):**
- Caret flips to ▼
- Individual set rows: Set number | Reps (editable) | Value (editable) | per-set checkbox
- Tapping Reps or Value brings up the number pad with current value highlighted for overwrite (not append)
- Per-exercise Notes text input at bottom
- "**+ Add Set**" button at bottom of set list — adds a new set pre-filled with previous set's reps/value. Does not modify the Routine config.

**Autofill logic:**
- Each editable field (Reps, Value) pre-populates with the most recent Log entry for that specific Program/Routine/Exercise/Set
- If no log history exists, falls back to the Routine config values
- If both are blank, the field is empty

**Finish workout flow:**
- "Finish Workout" button at the bottom
- If all exercises checked → logs everything with brief confirmation
- If some exercises unchecked → bottom sheet appears:
  - "Log Completed Only" — saves only checked exercises
  - "Complete All & Log" — checks everything, saves all
  - "Cancel" — go back

**Routine update prompt:**
- After finishing a workout where sets were added or removed (not minor rep/value changes), prompt:
  - "You logged 4 sets of Bench Press but your routine has 3. Update your routine to match?"
  - "Update routine" — writes change to Routine config in the sheet
  - "Keep as-is" — log it as a one-off
- Non-blocking — workout is already saved regardless of choice

### Tab 3: Logs

Scrollable layout, top to bottom:

**1. Calendar View (top)**
- Compact monthly grid
- Days with logged workouts are filled with color
- Color toggle modes:
  - **By Routine** — each routine gets a distinct color; days with multiple routines show a split/dot for each
  - **By Athlete** (coach mode) — each athlete gets a color

**2. Attendance & Frequency Insights**
- **Routine balance breakdown** — horizontal bar chart showing how often each routine was performed over the last 4/8/12 weeks
- Highlights imbalances with a warning color (e.g. "Legs: 2x in 4 weeks — below average")
- **Coach mode — athlete stats cards:**
  - Each athlete: average workouts/week, current streak, mini sparkline of recent frequency
  - Sortable by frequency

**3. Exercise Progress Bar Chart**
- **Chip filters** — horizontal scrollable row of exercise name chips. Tap to toggle visibility. Multiple can be active.
- **Bar chart** — X axis: last 10 workout dates, Y axis: max weight logged for that exercise on that date
- Each active exercise gets its own colored bars, grouped by date
- Uses max weight per exercise per day (heaviest set)

**4. Personal Records**
- PR callouts per exercise — all-time bests for max weight, max reps, max volume
- Highlighted with badges

**Coach mode additions:**
- Athlete filter dropdown — switch between athletes or "All"
- Comparison view — overlay multiple athletes' progress on the same chart

**Charting library:** Recharts

---

## PWA & Offline

**Service Worker (Workbox):**
- Precache app shell (HTML, CSS, JS, icons) on install
- Update in the background

**Offline data flow:**
- **On load/refresh:** Fetch Routines tab + recent Log entries from Sheets API → store in IndexedDB
- **In-progress workout:** Every interaction saves to IndexedDB immediately
- **Completed workout:** Queued in IndexedDB with "pending sync" flag
- **When back online:** Flush pending log entries → append rows to Log sheet
- **Routines changed remotely while offline:** Remote wins on next sync, user notified ("Your routines were updated")

**Sync indicator:**
- Small status dot in header area
- States: synced (green), pending upload (yellow), offline (gray)

**Install:**
- Standard PWA manifest with app name, icons, theme color (#1a1a2e)
- "Add to Home Screen" prompt on supported browsers

---

## Template Programs

When creating an example sheet, users choose from 5 pre-built programs sourced from Reddit's most recommended routines. All exercises include sets and reps. Value/Unit columns are populated with reasonable starting weights where the program prescribes specific loads; left blank for programs where the user should choose their own weight.

For percentage-based programs (5/3/1, nSuns), each percentage tier is encoded as a separate exercise name (e.g. "Bench Press @ 75%", "Bench Press @ 85%") so that log tracking compares like-for-like intensities.

### 1. Reddit PPL (Metallicadpa) — 6 days/week

**Pull A (Deadlift focus):**

| Exercise | Sets | Reps | Value | Unit | Note |
|----------|------|------|-------|------|------|
| Deadlift | 1 | 5 | | lbs | AMRAP |
| Lat Pulldown | 3 | 8 | | lbs | |
| Seated Cable Row | 3 | 8 | | lbs | |
| Face Pull | 5 | 15 | | lbs | |
| Hammer Curl | 4 | 8 | | lbs | |
| Dumbbell Curl | 4 | 8 | | lbs | |

**Push A (Bench focus):**

| Exercise | Sets | Reps | Value | Unit | Note |
|----------|------|------|-------|------|------|
| Bench Press | 5 | 5 | | lbs | last set AMRAP |
| Overhead Press | 3 | 8 | | lbs | |
| Incline Dumbbell Press | 3 | 8 | | lbs | |
| Tricep Pushdown | 3 | 8 | | lbs | |
| Overhead Tricep Extension | 3 | 8 | | lbs | |
| Lateral Raise | 6 | 15 | | lbs | |

**Legs A:**

| Exercise | Sets | Reps | Value | Unit | Note |
|----------|------|------|-------|------|------|
| Squat | 3 | 5 | | lbs | last set AMRAP |
| Romanian Deadlift | 3 | 8 | | lbs | |
| Leg Press | 3 | 8 | | lbs | |
| Seated Leg Curl | 3 | 8 | | lbs | |
| Standing Calf Raise | 5 | 8 | | lbs | |

**Pull B (Row focus):**

| Exercise | Sets | Reps | Value | Unit | Note |
|----------|------|------|-------|------|------|
| Barbell Row | 5 | 5 | | lbs | last set AMRAP |
| Lat Pulldown | 3 | 8 | | lbs | |
| Seated Cable Row | 3 | 8 | | lbs | |
| Face Pull | 5 | 15 | | lbs | |
| Hammer Curl | 4 | 8 | | lbs | |
| Dumbbell Curl | 4 | 8 | | lbs | |

**Push B (OHP focus):**

| Exercise | Sets | Reps | Value | Unit | Note |
|----------|------|------|-------|------|------|
| Overhead Press | 5 | 5 | | lbs | last set AMRAP |
| Bench Press | 3 | 8 | | lbs | |
| Incline Dumbbell Press | 3 | 8 | | lbs | |
| Tricep Pushdown | 3 | 8 | | lbs | |
| Overhead Tricep Extension | 3 | 8 | | lbs | |
| Lateral Raise | 6 | 15 | | lbs | |

**Legs B:** Same as Legs A.

**Progression:** +5 lbs/session for bench, OHP, row, squat. +10 lbs/session for deadlift.

### 2. GZCLP — 4 days/week (rotating A1/A2/B1/B2)

**Day A1:**

| Exercise | Sets | Reps | Value | Unit | Note |
|----------|------|------|-------|------|------|
| Squat (T1) | 5 | 3 | | lbs | last set AMRAP |
| Bench Press (T2) | 3 | 10 | | lbs | |
| Lat Pulldown (T3) | 3 | 15 | | lbs | last set AMRAP |

**Day A2:**

| Exercise | Sets | Reps | Value | Unit | Note |
|----------|------|------|-------|------|------|
| Overhead Press (T1) | 5 | 3 | | lbs | last set AMRAP |
| Deadlift (T2) | 3 | 10 | | lbs | |
| Dumbbell Row (T3) | 3 | 15 | | lbs | last set AMRAP |

**Day B1:**

| Exercise | Sets | Reps | Value | Unit | Note |
|----------|------|------|-------|------|------|
| Bench Press (T1) | 5 | 3 | | lbs | last set AMRAP |
| Squat (T2) | 3 | 10 | | lbs | |
| Lat Pulldown (T3) | 3 | 15 | | lbs | last set AMRAP |

**Day B2:**

| Exercise | Sets | Reps | Value | Unit | Note |
|----------|------|------|-------|------|------|
| Deadlift (T1) | 5 | 3 | | lbs | last set AMRAP |
| Overhead Press (T2) | 3 | 10 | | lbs | |
| Dumbbell Row (T3) | 3 | 15 | | lbs | last set AMRAP |

**Progression:** +5 lbs for pressing, +10 lbs for lower body per session. On failure: 5×3 → 6×2 → 10×1 (same weight each stage).

### 3. 5/3/1 for Beginners — 3 days/week

**Day 1:**

| Exercise | Sets | Reps | Value | Unit | Note |
|----------|------|------|-------|------|------|
| Squat @ 65% | 1 | 5 | | lbs | week 1 |
| Squat @ 75% | 1 | 5 | | lbs | week 1 |
| Squat @ 85% | 1 | 5 | | lbs | AMRAP |
| Squat @ 65% (FSL) | 5 | 5 | | lbs | first set last |
| Bench Press @ 65% | 1 | 5 | | lbs | week 1 |
| Bench Press @ 75% | 1 | 5 | | lbs | week 1 |
| Bench Press @ 85% | 1 | 5 | | lbs | AMRAP |
| Bench Press @ 65% (FSL) | 5 | 5 | | lbs | first set last |
| Push Assistance | 5 | 15 | | | 50-100 total reps |
| Pull Assistance | 5 | 15 | | | 50-100 total reps |
| Single Leg/Core Assistance | 5 | 15 | | | 50-100 total reps |

**Day 2:**

| Exercise | Sets | Reps | Value | Unit | Note |
|----------|------|------|-------|------|------|
| Deadlift @ 65% | 1 | 5 | | lbs | week 1 |
| Deadlift @ 75% | 1 | 5 | | lbs | week 1 |
| Deadlift @ 85% | 1 | 5 | | lbs | AMRAP |
| Deadlift @ 65% (FSL) | 5 | 5 | | lbs | first set last |
| Overhead Press @ 65% | 1 | 5 | | lbs | week 1 |
| Overhead Press @ 75% | 1 | 5 | | lbs | week 1 |
| Overhead Press @ 85% | 1 | 5 | | lbs | AMRAP |
| Overhead Press @ 65% (FSL) | 5 | 5 | | lbs | first set last |
| Push Assistance | 5 | 15 | | | 50-100 total reps |
| Pull Assistance | 5 | 15 | | | 50-100 total reps |
| Single Leg/Core Assistance | 5 | 15 | | | 50-100 total reps |

**Day 3:**

| Exercise | Sets | Reps | Value | Unit | Note |
|----------|------|------|-------|------|------|
| Bench Press @ 65% | 1 | 5 | | lbs | week 1 |
| Bench Press @ 75% | 1 | 5 | | lbs | week 1 |
| Bench Press @ 85% | 1 | 5 | | lbs | AMRAP |
| Bench Press @ 65% (FSL) | 5 | 5 | | lbs | first set last |
| Squat @ 65% | 1 | 5 | | lbs | week 1 |
| Squat @ 75% | 1 | 5 | | lbs | week 1 |
| Squat @ 85% | 1 | 5 | | lbs | AMRAP |
| Squat @ 65% (FSL) | 5 | 5 | | lbs | first set last |
| Push Assistance | 5 | 15 | | | 50-100 total reps |
| Pull Assistance | 5 | 15 | | | 50-100 total reps |
| Single Leg/Core Assistance | 5 | 15 | | | 50-100 total reps |

**Progression:** After each 3-week cycle, +5 lbs upper body, +10 lbs lower body training max.

### 4. nSuns 5/3/1 LP — 5 days/week

**Day 1: Bench Volume**

| Exercise | Sets | Reps | Value | Unit | Note |
|----------|------|------|-------|------|------|
| Bench Press @ 75% | 1 | 5 | | lbs | |
| Bench Press @ 85% | 1 | 3 | | lbs | |
| Bench Press @ 95% | 1 | 1 | | lbs | AMRAP |
| Bench Press @ 90% | 1 | 3 | | lbs | backoff |
| Bench Press @ 85% | 1 | 3 | | lbs | backoff |
| Bench Press @ 80% | 1 | 3 | | lbs | backoff |
| Bench Press @ 75% | 1 | 5 | | lbs | backoff |
| Bench Press @ 70% | 1 | 5 | | lbs | backoff |
| Bench Press @ 65% | 1 | 5 | | lbs | AMRAP backoff |
| OHP @ 50% | 8 | 6 | | lbs | secondary lift, 8 sets |
| Lat Pulldown | 3 | 8 | | lbs | |
| Bicep Curl | 4 | 8 | | lbs | |

**Day 2: Squat**

| Exercise | Sets | Reps | Value | Unit | Note |
|----------|------|------|-------|------|------|
| Squat @ 75% | 1 | 5 | | lbs | |
| Squat @ 85% | 1 | 3 | | lbs | |
| Squat @ 95% | 1 | 1 | | lbs | AMRAP |
| Squat @ 90% | 1 | 3 | | lbs | backoff |
| Squat @ 85% | 1 | 3 | | lbs | backoff |
| Squat @ 80% | 1 | 3 | | lbs | backoff |
| Squat @ 75% | 1 | 5 | | lbs | backoff |
| Squat @ 70% | 1 | 5 | | lbs | backoff |
| Squat @ 65% | 1 | 5 | | lbs | AMRAP backoff |
| Sumo Deadlift @ 50% | 8 | 6 | | lbs | secondary lift |
| Hanging Leg Raise | 3 | 12 | | reps | |
| Leg Extension | 3 | 8 | | lbs | |

**Day 3: OHP**

| Exercise | Sets | Reps | Value | Unit | Note |
|----------|------|------|-------|------|------|
| OHP @ 75% | 1 | 5 | | lbs | |
| OHP @ 85% | 1 | 3 | | lbs | |
| OHP @ 95% | 1 | 1 | | lbs | AMRAP |
| OHP @ 90% | 1 | 3 | | lbs | backoff |
| OHP @ 85% | 1 | 3 | | lbs | backoff |
| OHP @ 80% | 1 | 3 | | lbs | backoff |
| OHP @ 75% | 1 | 5 | | lbs | backoff |
| OHP @ 70% | 1 | 5 | | lbs | backoff |
| OHP @ 65% | 1 | 5 | | lbs | AMRAP backoff |
| Incline Bench Press @ 50% | 8 | 6 | | lbs | secondary lift |
| Lateral Raise | 4 | 12 | | lbs | |
| Face Pull | 3 | 12 | | lbs | |

**Day 4: Deadlift**

| Exercise | Sets | Reps | Value | Unit | Note |
|----------|------|------|-------|------|------|
| Deadlift @ 75% | 1 | 5 | | lbs | |
| Deadlift @ 85% | 1 | 3 | | lbs | |
| Deadlift @ 95% | 1 | 1 | | lbs | AMRAP |
| Deadlift @ 90% | 1 | 3 | | lbs | backoff |
| Deadlift @ 85% | 1 | 3 | | lbs | backoff |
| Deadlift @ 80% | 1 | 3 | | lbs | backoff |
| Deadlift @ 75% | 1 | 3 | | lbs | backoff |
| Deadlift @ 70% | 1 | 3 | | lbs | backoff |
| Deadlift @ 65% | 1 | 3 | | lbs | AMRAP backoff |
| Front Squat @ 50% | 8 | 6 | | lbs | secondary lift |
| Ab Wheel | 3 | 12 | | reps | |
| Chin Up | 3 | 8 | | reps | |

**Day 5: Bench 5/3/1**

| Exercise | Sets | Reps | Value | Unit | Note |
|----------|------|------|-------|------|------|
| Bench Press @ 75% | 1 | 5 | | lbs | |
| Bench Press @ 85% | 1 | 3 | | lbs | |
| Bench Press @ 95% | 1 | 1 | | lbs | AMRAP |
| Bench Press @ 90% | 1 | 3 | | lbs | backoff |
| Bench Press @ 85% | 1 | 5 | | lbs | backoff |
| Bench Press @ 80% | 1 | 3 | | lbs | backoff |
| Bench Press @ 75% | 1 | 5 | | lbs | backoff |
| Bench Press @ 70% | 1 | 3 | | lbs | backoff |
| Bench Press @ 65% | 1 | 5 | | lbs | AMRAP backoff |
| Close Grip Bench @ 50% | 8 | 6 | | lbs | secondary lift |
| Tricep Pushdown | 3 | 8 | | lbs | |
| Hammer Curl | 4 | 8 | | lbs | |

**Progression:** Based on AMRAP set: 0-1 reps = no increase, 2-3 = +5 lbs, 4-5 = +5-10 lbs, 6+ = +10-15 lbs.

### 5. PHUL — 4 days/week

**Day 1: Upper Power**

| Exercise | Sets | Reps | Value | Unit | Note |
|----------|------|------|-------|------|------|
| Barbell Bench Press | 4 | 4 | | lbs | 3-5 rep range |
| Incline Dumbbell Press | 4 | 8 | | lbs | 6-10 rep range |
| Barbell Bent-Over Row | 4 | 4 | | lbs | 3-5 rep range |
| Lat Pulldown | 4 | 8 | | lbs | 6-10 rep range |
| Overhead Press | 3 | 8 | | lbs | 6-10 rep range |
| Skullcrusher | 3 | 8 | | lbs | 6-10 rep range |
| Barbell Curl | 3 | 8 | | lbs | 6-10 rep range |

**Day 2: Lower Power**

| Exercise | Sets | Reps | Value | Unit | Note |
|----------|------|------|-------|------|------|
| Barbell Back Squat | 4 | 4 | | lbs | 3-5 rep range |
| Barbell Deadlift | 4 | 4 | | lbs | 3-5 rep range |
| Leg Press | 4 | 8 | | lbs | |
| Leg Curl | 3 | 8 | | lbs | 6-10 rep range |
| Standing Calf Raise | 4 | 8 | | lbs | 6-10 rep range |

**Day 3: Upper Hypertrophy**

| Exercise | Sets | Reps | Value | Unit | Note |
|----------|------|------|-------|------|------|
| Incline Barbell Bench Press | 4 | 10 | | lbs | 8-12 rep range |
| Dumbbell Flat Bench Fly | 4 | 10 | | lbs | 8-12 rep range |
| Seated Cable Row | 4 | 10 | | lbs | 8-12 rep range |
| Dumbbell One Arm Row | 4 | 10 | | lbs | 8-12 rep range |
| Dumbbell Lateral Raise | 4 | 12 | | lbs | 10-15 rep range |
| Incline Dumbbell Curl | 4 | 10 | | lbs | 8-12 rep range |
| Tricep Rope Pushdown | 4 | 10 | | lbs | 8-12 rep range |

**Day 4: Lower Hypertrophy**

| Exercise | Sets | Reps | Value | Unit | Note |
|----------|------|------|-------|------|------|
| Front Squat | 4 | 10 | | lbs | 8-12 rep range |
| Barbell Lunge | 4 | 10 | | lbs | 8-12 rep range |
| Leg Extension | 4 | 12 | | lbs | 10-15 rep range |
| Leg Curl | 4 | 12 | | lbs | 10-15 rep range |
| Seated Calf Raise | 4 | 10 | | lbs | 8-12 rep range |
| Calf Press | 4 | 10 | | lbs | 8-12 rep range |

---

## Sources

Template programs sourced from:
- [Metallicadpa PPL — Liftosaur](https://www.liftosaur.com/programs/metallicadpappl)
- [GZCLP — The Fitness Wiki](https://thefitness.wiki/routines/gzclp/)
- [5/3/1 for Beginners — The Fitness Wiki](https://thefitness.wiki/routines/5-3-1-for-beginners/)
- [nSuns LP — Liftosaur](https://www.liftosaur.com/programs/nsuns)
- [PHUL — Muscle & Strength](https://www.muscleandstrength.com/workouts/phul-workout)
- [Reddit Fitness Programs — Boostcamp](https://www.boostcamp.app/blogs/most-popular-free-workout-routines-from-reddit)
