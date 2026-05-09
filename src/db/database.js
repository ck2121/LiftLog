import { openDB } from 'idb';
import { EXERCISES } from '../data/exercises';

const DB_NAME = 'liftlog-db';
const DB_VERSION = 2; // bumped for activePlans store

let dbInstance = null;

export async function getDB() {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Users
      if (!db.objectStoreNames.contains('users')) {
        const usersStore = db.createObjectStore('users', {
          keyPath: 'userID',
          autoIncrement: true,
        });
        usersStore.createIndex('username', 'username', { unique: true });
      }

      // WorkoutLogs
      if (!db.objectStoreNames.contains('workoutLogs')) {
        const logsStore = db.createObjectStore('workoutLogs', {
          keyPath: 'logID',
          autoIncrement: true,
        });
        logsStore.createIndex('userID', 'userID');
        logsStore.createIndex('date', 'date');
        logsStore.createIndex('userID_date', ['userID', 'date']);
      }

      // Plans (saved favorites)
      if (!db.objectStoreNames.contains('plans')) {
        const plansStore = db.createObjectStore('plans', {
          keyPath: 'planID',
          autoIncrement: true,
        });
        plansStore.createIndex('userID', 'userID');
      }

      // Exercises (seeded from bundled data)
      if (!db.objectStoreNames.contains('exercises')) {
        db.createObjectStore('exercises', { keyPath: 'exerciseID' });
      }

      // Active split plans — tracks current plan + progress through days
      // Added in DB_VERSION 2
      if (!db.objectStoreNames.contains('activePlans')) {
        const activePlansStore = db.createObjectStore('activePlans', {
          keyPath: 'id',
          autoIncrement: true,
        });
        activePlansStore.createIndex('userID', 'userID', { unique: true });
      }
    },

    async blocked() {
      console.warn('DB upgrade blocked by another tab.');
    },
  });

  await seedExercises(dbInstance);
  return dbInstance;
}

async function seedExercises(db) {
  const count = await db.count('exercises');
  if (count === 0) {
    const tx = db.transaction('exercises', 'readwrite');
    await Promise.all(EXERCISES.map((ex) => tx.store.put(ex)));
    await tx.done;
  }
}

// ── User helpers ─────────────────────────────────────────────────────────────

export async function getUserByUsername(username) {
  const db = await getDB();
  return db.getFromIndex('users', 'username', username.toLowerCase().trim());
}

export async function addUser(userData) {
  const db = await getDB();
  return db.add('users', userData);
}

export async function getUser(userID) {
  const db = await getDB();
  return db.get('users', userID);
}

// ── WorkoutLog helpers ────────────────────────────────────────────────────────

export async function addLog(logData) {
  const db = await getDB();
  return db.add('workoutLogs', logData);
}

export async function getLogsByUser(userID) {
  const db = await getDB();
  const all = await db.getAllFromIndex('workoutLogs', 'userID', userID);
  return all.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export async function getRecentLogsByUser(userID, days = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const all = await getLogsByUser(userID);
  return all.filter((l) => new Date(l.date) >= cutoff);
}

export async function updateLog(logData) {
  const db = await getDB();
  return db.put('workoutLogs', logData);
}

export async function deleteLog(logID) {
  const db = await getDB();
  return db.delete('workoutLogs', logID);
}

// ── Plan helpers ──────────────────────────────────────────────────────────────

export async function addPlan(planData) {
  const db = await getDB();
  return db.add('plans', planData);
}

export async function getPlansByUser(userID) {
  const db = await getDB();
  return db.getAllFromIndex('plans', 'userID', userID);
}

export async function deletePlan(planID) {
  const db = await getDB();
  return db.delete('plans', planID);
}

// ── Active Plan helpers ───────────────────────────────────────────────────────
// Stores the user's active split plan and tracks which day is next.
//
// Shape: {
//   id: number (autoIncrement),
//   userID: number,
//   splitName: string,           // e.g. 'Push/Pull/Legs'
//   days: [{ dayLabel, exercises, bodyArea }],
//   currentDayIndex: number,     // 0-based index of the NEXT day to do
//   completedDates: [{ dayIndex, date }],
//   startedAt: ISO string,
// }

export async function getActivePlan(userID) {
  const db = await getDB();
  return db.getFromIndex('activePlans', 'userID', userID);
}

export async function setActivePlan(planData) {
  const db = await getDB();
  // Upsert: remove existing first, then add fresh
  const existing = await db.getFromIndex('activePlans', 'userID', planData.userID);
  if (existing) await db.delete('activePlans', existing.id);
  return db.add('activePlans', planData);
}

export async function advanceActivePlan(userID, completedDayIndex) {
  const db = await getDB();
  const plan = await db.getFromIndex('activePlans', 'userID', userID);
  if (!plan) return;

  const totalDays = plan.days.length;
  const nextIndex = (completedDayIndex + 1) % totalDays;

  const updated = {
    ...plan,
    currentDayIndex: nextIndex,
    completedDates: [
      ...plan.completedDates,
      { dayIndex: completedDayIndex, date: new Date().toISOString().split('T')[0] },
    ],
  };
  await db.put('activePlans', updated);
  return updated;
}

export async function clearActivePlan(userID) {
  const db = await getDB();
  const existing = await db.getFromIndex('activePlans', 'userID', userID);
  if (existing) await db.delete('activePlans', existing.id);
}

// ── Exercise helpers ──────────────────────────────────────────────────────────

export async function getAllExercises() {
  const db = await getDB();
  return db.getAll('exercises');
}

export async function getExercisesByBodyPart(bodyPart) {
  const db = await getDB();
  const all = await db.getAll('exercises');
  if (bodyPart === 'Full Body') return all;
  return all.filter((e) => e.bodyPart === bodyPart || e.bodyPart === 'Full Body');
}

// ── Backup / Restore ──────────────────────────────────────────────────────────

export async function exportUserData(userID) {
  const db = await getDB();
  const user = await db.get('users', userID);
  const logs = await db.getAllFromIndex('workoutLogs', 'userID', userID);
  const plans = await db.getAllFromIndex('plans', 'userID', userID);
  const activePlan = await db.getFromIndex('activePlans', 'userID', userID);

  return {
    exportedAt: new Date().toISOString(),
    version: 2,
    user: { ...user, passwordHash: '[redacted]' },
    workoutLogs: logs,
    plans,
    activePlan: activePlan || null,
  };
}

export async function importUserData(json, currentUserID) {
  const db = await getDB();

  if (Array.isArray(json.workoutLogs)) {
    const tx = db.transaction('workoutLogs', 'readwrite');
    for (const log of json.workoutLogs) {
      const record = { ...log, userID: currentUserID };
      delete record.logID;
      await tx.store.add(record);
    }
    await tx.done;
  }

  if (Array.isArray(json.plans)) {
    const tx = db.transaction('plans', 'readwrite');
    for (const plan of json.plans) {
      const record = { ...plan, userID: currentUserID };
      delete record.planID;
      await tx.store.add(record);
    }
    await tx.done;
  }

  if (json.activePlan) {
    const record = { ...json.activePlan, userID: currentUserID };
    delete record.id;
    await setActivePlan(record);
  }
}
