import { openDB } from 'idb';
import { EXERCISES } from '../data/exercises';

const DB_NAME = 'liftlog-db';
const DB_VERSION = 1;

let dbInstance = null;

export async function getDB() {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
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

      // Plans
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
    },

    async blocked() {
      console.warn('DB upgrade blocked by another tab.');
    },
  });

  // Seed exercises on first run
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

// ── User helpers ────────────────────────────────────────────────────────────

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

// ── WorkoutLog helpers ───────────────────────────────────────────────────────

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

// ── Plan helpers ─────────────────────────────────────────────────────────────

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

  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    user: { ...user, passwordHash: '[redacted]' },
    workoutLogs: logs,
    plans,
  };
}

export async function importUserData(json, currentUserID) {
  const db = await getDB();

  // Import logs
  if (Array.isArray(json.workoutLogs)) {
    const tx = db.transaction('workoutLogs', 'readwrite');
    for (const log of json.workoutLogs) {
      const record = { ...log, userID: currentUserID };
      delete record.logID; // let autoIncrement assign new ID
      await tx.store.add(record);
    }
    await tx.done;
  }

  // Import plans
  if (Array.isArray(json.plans)) {
    const tx = db.transaction('plans', 'readwrite');
    for (const plan of json.plans) {
      const record = { ...plan, userID: currentUserID };
      delete record.planID;
      await tx.store.add(record);
    }
    await tx.done;
  }
}
