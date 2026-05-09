# LiftLog 🏋️

A mobile-first Progressive Web App for tracking weightlifting workouts. All data is stored **locally on your device** — no accounts, no cloud, no subscriptions.

## Quick Start

You need **Node.js** installed (download from [nodejs.org](https://nodejs.org) if you don't have it).

Open a terminal in this folder and run:

```bash
npm install
npm run dev
```

Then open your browser to **http://localhost:5173**

## Install on Your Phone

1. Run `npm run build` then `npm run preview` (or `npx serve dist`)
2. Open http://your-computer-ip:4173 on your phone
3. Tap the browser menu → **"Add to Home Screen"**

Or for a quick phone test while on the same WiFi network:
```bash
npm run dev -- --host
```
Then open the network URL shown in the terminal on your phone.

## Features

- **Workout Planner** — pick duration (30–90 min) + body area, get a personalized machine plan
- **Split Programs** — Push/Pull/Legs, Upper/Lower, Full Body 3-Day, Bro Split
- **Exercise Swap** — don't like an exercise? Swap it for an alternative
- **Active Workout Logging** — log sets/reps/weight in real time with a timer
- **Progress Charts** — line chart of max weight per machine over time
- **Personal Records** — see your best lifts per machine
- **Workout History** — browse past sessions by date
- **Equipment Catalog** — 45 machines with instructions, filterable and searchable
- **Backup & Restore** — export all your data as JSON, import on any device

## Data Storage

Everything is stored in your browser's **IndexedDB** — a local database that persists between sessions. Your data never leaves your device.

- To back up: Settings → Export Backup (JSON)
- To restore on a new device: Settings → Import Backup

## Tech Stack

- React 18 + Vite
- React Router 6
- Chart.js + react-chartjs-2
- idb (IndexedDB wrapper)
- vite-plugin-pwa (service worker + PWA manifest)
- SHA-256 via Web Crypto API (password hashing)

## Project Structure

```
src/
├── context/       AuthContext (session management)
├── data/          exercises.js (45 machine library)
├── db/            database.js (IndexedDB schema + helpers)
├── pages/         LoginPage, Dashboard, WorkoutPlanner, ActiveWorkout,
│                  Progress, History, Catalog, Settings
├── services/      auth.js, workoutPlanner.js
└── components/    NavBar.jsx
```
