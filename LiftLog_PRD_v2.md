# LiftLog — Product Requirements Document
**Version:** 2.0  
**Status:** Draft  
**Date:** May 2026  
**Author:** Product Team  
**Platform:** Progressive Web App (PWA) — Mobile-first  
**Storage:** Local Device (IndexedDB + localStorage)  

---

## 1. Executive Summary

LiftLog is a lightweight, mobile-first Progressive Web App (PWA) designed to help individual weightlifters track their workouts, receive personalized exercise recommendations, and visualize their progress over time. The app is fully self-contained — all data is stored locally on the user's device using the browser's built-in IndexedDB database. No external accounts, cloud services, or subscriptions are required. Users retain full control of their data and can export it at any time as JSON (full backup) or CSV (progress data).

---

## 2. Problem Statement

### 2.1 Context

Casual and intermediate weightlifters often struggle to maintain consistent, progressive workout routines. They lack structured guidance for building effective gym sessions that match their available time and target muscle groups. Existing apps are either too complex, require expensive subscriptions, or store data in proprietary clouds where users have no control.

### 2.2 Pain Points

- Users do not know which machines or exercises to use for a specific body part.
- Users cannot easily plan multi-day rotating workout schedules.
- There is no simple way to track weight lifted per machine over time and visualize progress.
- Most fitness apps store data in external clouds, making it inaccessible, non-exportable, and subject to service changes.
- Gym-goers waste time planning workouts on the spot, reducing workout efficiency.

### 2.3 Target Users

- Beginner to intermediate gym-goers who use commercial gym machines.
- Users who want complete data privacy — nothing leaves their device.
- Individuals with varying amounts of available workout time (30 min to 90+ min).
- Users who want a zero-cost, zero-account solution they install once and use forever.

---

## 3. Solution Overview

LiftLog addresses these pain points by providing a guided, recommendation-driven PWA that:

- Generates personalized workout plans based on available time and target body region.
- Recommends specific gym machines and exercises with sets, reps, and weight guidance.
- Supports multi-day rotating schedules (e.g., Push/Pull/Legs splits).
- Stores all data locally on the device in IndexedDB — no internet required after install.
- Displays progress charts showing weight lifted per machine over time.
- Allows full data backup (JSON export/import) and progress export (CSV).
- Protects user data with a simple password-based login that persists across sessions.

### 3.1 Key Differentiators (v2.0)

- **100% local storage** — IndexedDB on the device; data never leaves the phone.
- **Zero accounts required** — no Google, no cloud, no subscriptions, no API keys.
- **Installable PWA** — works like a native app via Add to Home Screen on iOS and Android.
- **Offline-first** — fully functional without any internet connection after initial install.
- **Data portability** — JSON export/import for full backup; CSV export for progress charts.
- **Machine-focused** — recommendations tailored to commercial gym equipment.

---

## 4. System Architecture

### 4.1 High-Level Architecture

```
+------------------------------------------------------+
|              USER DEVICE (Mobile PWA)                |
|                                                      |
|  +------------------+   +------------------------+  |
|  |   UI Layer       |   |   Service Worker       |  |
|  |  (React + Vite)  |<->|   (Offline Cache)      |  |
|  +--------+---------+   +------------------------+  |
|           |                                          |
|  +--------v---------+   +------------------------+  |
|  | App Logic Layer  |   |  Auth Module           |  |
|  | - Workout Planner|   |  (SHA-256 hash stored  |  |
|  | - Recommender    |<->|   in IndexedDB)        |  |
|  | - Progress Calc  |   +------------------------+  |
|           |                                          |
|  +--------v---------+                                |
|  |   Data Layer     |                                |
|  |   (IndexedDB)    |                                |
|  |                  |                                |
|  | - Users store    |                                |
|  | - WorkoutLogs    |                                |
|  | - Plans          |                                |
|  | - Exercises      |                                |
|  +------------------+                                |
|                                                      |
|  Export: JSON backup / CSV download (on demand)      |
+------------------------------------------------------+
```

### 4.2 Data Flow

```
[App Launch]
     |
[Check localStorage for session token]
     |
 [Valid?]----NO---->[Login Screen]
     |
    YES
     |
[Dashboard]
     |
[Select Duration + Body Area]
     |
[Recommendation Engine reads bundled exercise data]
     |
[Show Workout Plan]
     |
[User logs sets/reps/weight]
     |
[Write to IndexedDB WorkoutLogs store]
     |
[Progress screen reads from IndexedDB]
     |
[Chart.js renders progress]
     |
[Optional: Export JSON or CSV]
```

### 4.3 IndexedDB Schema

The app uses a single IndexedDB database (`liftlog-db`) with four object stores:

| Store | Key Fields | Purpose |
|-------|-----------|---------|
| `users` | `userID` (autoIncrement), `username` (unique index), `passwordHash`, `createdAt` | Stores login credentials with SHA-256 hashed passwords |
| `workoutLogs` | `logID` (autoIncrement), `userID`, `date`, `machineID`, `machineName`, `sets`, `reps`, `weightLbs`, `notes` | Every logged set stored as a record |
| `plans` | `planID` (autoIncrement), `userID`, `planName`, `dayNum`, `bodyPart`, `duration`, `exercises` (JSON array) | User-saved multi-day plans |
| `exercises` | `exerciseID`, `machineName`, `bodyPart`, `muscleGroup`, `instructions`, `defaultSets`, `defaultReps` | Bundled master exercise/machine reference (populated on first launch) |

---

## 5. Requirements

Priority scale: **P0** = Must Have | **P1** = Should Have | **P2** = Nice to Have

### 5.1 Authentication & Security

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| AUTH-01 | The app shall display a login screen on first launch requiring a username and password. | P0 | Login screen renders before any other content is accessible. |
| AUTH-02 | Passwords shall be hashed with SHA-256 (via the Web Crypto API) before being stored in IndexedDB; plaintext passwords are never persisted. | P0 | Inspecting IndexedDB in DevTools shows only hashed values in the passwordHash field. |
| AUTH-03 | A valid authenticated session shall persist across browser restarts using a session token stored in localStorage. | P0 | User stays logged in after closing and reopening the PWA. |
| AUTH-04 | The app shall provide a logout button that clears the session token and returns to the login screen. | P0 | Pressing logout redirects to login and clears the localStorage token. |
| AUTH-05 | New user registration shall be supported via a Sign Up flow linked from the login screen. | P1 | A new user can register and immediately log in with those credentials. |
| AUTH-06 | Incorrect login attempts shall display a generic error message without revealing which field failed. | P1 | Error message reads generically (e.g., "Invalid username or password"). |

### 5.2 Workout Configuration & Planning

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| WRK-01 | The user shall be able to select workout duration from preset options: 30, 45, 60, 75, 90 min, or a custom value. | P0 | All duration options are presented; selecting one is reflected in the generated plan. |
| WRK-02 | The user shall be able to select the target body area: Upper Body, Lower Body, Full Body, or Core. | P0 | Each body area selection generates a plan with exercises matching only that region. |
| WRK-03 | The app shall generate a single-day workout plan with machine recommendations matching the selected duration and body area. | P0 | Plan contains appropriate number of exercises for the selected time; all exercises match the body area. |
| WRK-04 | The app shall offer multi-day rotating workout schedules (Push/Pull/Legs, Upper/Lower splits) as an alternative to single-day plans. | P0 | User can select a multi-day split; each day shows a distinct set of exercises targeting different muscle groups. |
| WRK-05 | Each recommended exercise shall include machine name, target muscle, suggested sets, reps, and starting weight in lbs. | P0 | Every exercise card displays machine, muscle, sets × reps, and a default weight. |
| WRK-06 | The user shall be able to swap any recommended exercise for an alternative targeting the same muscle group. | P1 | Tapping 'Swap' shows at least 2 alternatives; selecting one replaces the original. |
| WRK-07 | The user shall be able to save a generated plan as a named favorite for reuse. | P1 | Saved plan appears in a 'My Plans' list and can be loaded on subsequent visits. |
| WRK-08 | The app shall support adding custom notes to any workout session before saving. | P2 | A free-text note field is present on the session summary screen and saved to IndexedDB. |

### 5.3 Equipment & Machine Recommendations

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| EQP-01 | The app shall include a built-in exercise library of at least 40 common gym machines organized by body part and muscle group. | P0 | The bundled exercises data contains ≥ 40 entries spanning all four body area categories. |
| EQP-02 | Each machine entry shall include: machine name, primary muscle group, secondary muscles, usage instructions, and a suggested rep range. | P0 | Opening any exercise detail card shows all five data fields populated. |
| EQP-03 | The recommendation engine shall select machines based on target body area, available time (to determine volume), and recent user history (to avoid repeating the same machines too frequently). | P0 | Plans generated on consecutive days with the same body area do not repeat the exact same machine set if alternatives exist. |
| EQP-04 | A searchable/browsable equipment catalog shall be accessible from the main menu. | P1 | User can open 'Equipment Catalog', search by name or muscle group, and view details. |
| EQP-05 | Machines the user has never logged shall be flagged as 'Not Yet Tried' in the catalog. | P2 | 'Not Yet Tried' badge appears on machines absent from the user's WorkoutLogs. |

### 5.4 Workout Logging

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| LOG-01 | During an active workout, the user shall be able to log sets, reps, and weight (lbs) for each exercise in real time. | P0 | The active workout screen shows input fields for sets, reps, and weight per exercise; tapping 'Log Set' saves the entry to IndexedDB. |
| LOG-02 | Logged data shall be written to IndexedDB immediately (synchronously within the session). | P0 | After tapping 'Save', the record is persisted and visible in History instantly. |
| LOG-03 | The app shall not lose unsaved workout data if the user navigates away mid-session (data is saved incrementally per set). | P1 | Backgrounding the app mid-workout and returning does not lose any logged sets. |
| LOG-04 | Users shall be able to view a history of past workout sessions sorted by date. | P1 | A 'History' screen lists past sessions; tapping one shows all exercises and weights logged. |
| LOG-05 | Users shall be able to edit or delete a previously logged set within 24 hours of logging it. | P2 | An 'Edit' option appears on recent log entries; changes are reflected in IndexedDB immediately. |

### 5.5 Progress Visualization

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| VIZ-01 | The app shall display a line chart showing maximum weight lifted per machine over time. | P0 | Selecting a machine renders a line chart with date on the X-axis and max weight (lbs) on the Y-axis. |
| VIZ-02 | The user shall be able to filter the progress chart by machine, time range (1 month, 3 months, 6 months, all time), and body area. | P0 | All three filter types work independently and in combination; chart updates without full page reload. |
| VIZ-03 | A summary card shall display personal records (PRs) for each machine — highest weight ever logged. | P1 | The PR card shows the top weight and date for every machine with at least one log entry. |
| VIZ-04 | The app shall display a weekly workout frequency chart (bar chart: number of sessions per week for the past 12 weeks). | P1 | A bar chart on the dashboard shows one bar per week for the past 12 weeks. |
| VIZ-05 | Progress data shall be exportable as a CSV download directly from the charts screen. | P1 | A 'Download CSV' button generates a file containing the filtered log data. |

### 5.6 Data Portability

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| DAT-01 | The user shall be able to export a full JSON backup of all their data (logs, plans, settings) from the Settings screen. | P0 | Tapping 'Export Backup' downloads a valid JSON file containing all IndexedDB records for the authenticated user. |
| DAT-02 | The user shall be able to import a previously exported JSON backup to restore their data on a new device. | P0 | Importing a valid backup JSON file restores all workout logs and saved plans without overwriting other users' data. |
| DAT-03 | The app shall warn the user before import if records with matching IDs already exist. | P1 | A confirmation dialog explains that existing records will be merged/overwritten and asks the user to confirm. |

### 5.7 PWA & Deployment

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| PWA-01 | The app shall be installable as a PWA on iOS and Android via 'Add to Home Screen', with a manifest.json and service worker. | P0 | The app passes Chrome Lighthouse PWA audit with no critical failures. |
| PWA-02 | Core app screens (login, plan selection, active workout) shall be accessible offline using cached assets. | P0 | With network disabled, the user can navigate to the plan and active workout screens without errors. |
| PWA-03 | The app shall be deployable locally via a simple static file server (e.g., `npx serve dist`) on localhost. | P0 | Running `npx serve dist` launches the app at localhost on any OS. |
| PWA-04 | The app shall achieve a Lighthouse Performance score of ≥ 80 on a mid-range mobile device. | P1 | Lighthouse on an Android mid-range device returns Performance ≥ 80. |
| PWA-05 | The app shall be responsive and optimized for screens between 360px and 430px wide. | P0 | UI renders correctly at 360px and 430px; no horizontal scroll; tap targets ≥ 44px. |

---

## 6. User Experience Flows

### 6.1 Onboarding & Login

```
[Launch PWA]
      |
[Session token in localStorage?]
      |              |
     YES             NO
      |              |
      v              v
[Dashboard]    [Login Screen]
                    |
            [Enter credentials]
                    |
             [Valid?]---NO--->[Generic error, stay on Login]
                    |
                   YES
                    |
            [Store session token in localStorage]
                    |
            [Dashboard]
```

### 6.2 Workout Planning

```
[Dashboard → 'New Workout']
      |
[Select Duration: 30/45/60/75/90 min or Custom]
      |
[Select Body Area: Upper / Lower / Full Body / Core]
      |
[Single Day?]---YES--->[Generate plan from bundled exercise library]
      |                         |
      NO                 [Show machine cards]
      |                         |
[Choose Split]          [Swap / Adjust / Accept]
[Push/Pull/Legs, etc.]          |
      |                  [Start Workout → log sets live]
[Multi-day calendar view]
```

### 6.3 Progress Visualization

```
[Dashboard → 'My Progress']
      |
[Read WorkoutLogs from IndexedDB]
      |
+----------------------------------+
|  Progress Dashboard              |
|  - PR Summary Cards              |
|  - Weekly Frequency Bar Chart    |
|  - Machine Progress Line Chart   |
+----------------------------------+
      |
[Filter: Machine | Time Range | Body Area]
      |
[Chart updates in place]
      |
[Optional: Export CSV]
```

### 6.4 Data Backup & Restore

```
[Settings → 'Export Backup']
      |
[Read all user data from IndexedDB]
      |
[Download liftlog-backup-YYYY-MM-DD.json]

[Settings → 'Import Backup']
      |
[Select JSON file]
      |
[Validate format]---INVALID--->[Show error]
      |
   VALID
      |
[Confirm overwrite dialog]
      |
[Merge records into IndexedDB]
      |
[Success confirmation]
```

---

## 7. Non-Functional Requirements

### 7.1 Performance

- Initial app load (cached by service worker): < 2 seconds.
- IndexedDB read/write operations: < 100ms under normal conditions.
- Chart rendering after data fetch: < 1 second.

### 7.2 Security

- Passwords are hashed with SHA-256 via the Web Crypto API before being stored in IndexedDB.
- Session tokens are random UUIDs stored in localStorage; they expire after 30 days of inactivity.
- No data is ever transmitted to any external server.

### 7.3 Reliability

- Data is written to IndexedDB on a per-set basis during active workouts, so a crash or navigation mid-session loses at most the current in-progress set.
- The app must not lose unsaved workout data if the user backgrounds or navigates away.

### 7.4 Accessibility

- All interactive elements must meet WCAG 2.1 AA contrast requirements.
- Touch targets must be at least 44×44 CSS pixels.
- The app must be navigable without relying solely on color.

---

## 8. Out of Scope (v1.0)

- Cloud sync or cross-device sync (data is device-local only).
- Social features (sharing workouts, leaderboards).
- Integration with wearable devices.
- AI/ML-based adaptive progression (static rule-based recommendations only).
- Video demonstrations of exercises.
- Free-weight or barbell tracking (machine-only for v1).
- Multi-user admin dashboard.
- Push notifications or reminders.
- Metric (kg) units — lbs only in v1.

---

## 9. Open Questions

| # | Question |
|---|----------|
| 1 | Should multiple user accounts be supported on a single device (family sharing)? Current design supports it via the Users store. |
| 2 | What is the minimum set of machines to include in the v1 exercise library (target: 40+)? |
| 3 | How should the recommendation engine handle new users with zero workout history? (Planned: random selection within the target body area.) |
| 4 | Should we support iCloud/Google Drive as optional backup destinations in a future version? |

---

## 10. Revision History

| Version | Date | Summary |
|---------|------|---------|
| 1.0 | May 2026 | Initial draft — Google Sheets as data store |
| 2.0 | May 2026 | Revised — all storage moved to local IndexedDB; removed all Google Cloud dependencies; added JSON backup/restore and CSV export |
