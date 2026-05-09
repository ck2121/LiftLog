import { EXERCISES } from '../data/exercises';

// How many exercises to recommend based on duration
const DURATION_TO_EXERCISE_COUNT = {
  30: 4,
  45: 5,
  60: 7,
  75: 9,
  90: 11,
};

function getExerciseCount(durationMinutes) {
  const durations = Object.keys(DURATION_TO_EXERCISE_COUNT).map(Number).sort((a, b) => a - b);
  for (const d of durations) {
    if (durationMinutes <= d) return DURATION_TO_EXERCISE_COUNT[d];
  }
  return DURATION_TO_EXERCISE_COUNT[90];
}

// Filter exercises by body area
function filterByBodyArea(exercises, bodyArea) {
  if (bodyArea === 'Full Body') return exercises;
  return exercises.filter(
    (e) => e.bodyPart === bodyArea || e.bodyPart === 'Full Body'
  );
}

// Shuffle array (Fisher-Yates)
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Avoid recently used exercises from the last N days of logs
function deWeightRecent(exercises, recentLogs) {
  const recentIds = new Set(recentLogs.map((l) => l.machineID));
  const fresh = exercises.filter((e) => !recentIds.has(e.exerciseID));
  const used = exercises.filter((e) => recentIds.has(e.exerciseID));
  return [...shuffle(fresh), ...shuffle(used)]; // fresh first, then used
}

// Balance muscle groups within a body area
function balanceMuscleGroups(exercises, count, bodyArea) {
  if (bodyArea === 'Full Body') {
    // Mix upper and lower
    const upper = shuffle(exercises.filter((e) => e.bodyPart === 'Upper Body'));
    const lower = shuffle(exercises.filter((e) => e.bodyPart === 'Lower Body'));
    const core = shuffle(exercises.filter((e) => e.bodyPart === 'Core'));
    const result = [];
    const upperCount = Math.ceil(count * 0.4);
    const lowerCount = Math.ceil(count * 0.4);
    const coreCount = count - upperCount - lowerCount;
    result.push(...upper.slice(0, upperCount));
    result.push(...lower.slice(0, lowerCount));
    result.push(...core.slice(0, Math.max(0, coreCount)));
    return shuffle(result).slice(0, count);
  }
  if (bodyArea === 'Upper Body') {
    const byMuscle = {};
    for (const e of exercises) {
      if (!byMuscle[e.muscleGroup]) byMuscle[e.muscleGroup] = [];
      byMuscle[e.muscleGroup].push(e);
    }
    const groups = Object.keys(byMuscle);
    const result = [];
    let g = 0;
    while (result.length < count) {
      const group = groups[g % groups.length];
      const candidates = byMuscle[group].filter((e) => !result.includes(e));
      if (candidates.length > 0) result.push(candidates[0]);
      g++;
      if (g > count * 4) break; // safety
    }
    return result.slice(0, count);
  }
  return exercises.slice(0, count);
}

/**
 * Generate a single-day workout plan.
 * @param {Object} options
 * @param {number} options.durationMinutes - workout duration in minutes
 * @param {string} options.bodyArea - 'Upper Body' | 'Lower Body' | 'Full Body' | 'Core'
 * @param {Array}  options.recentLogs - recent workout log entries (to avoid repeats)
 * @returns {Array} array of exercise objects with sets/reps/weight
 */
export function generateSingleDayPlan({ durationMinutes, bodyArea, recentLogs = [] }) {
  const count = getExerciseCount(durationMinutes);
  let pool = filterByBodyArea(EXERCISES, bodyArea);
  pool = deWeightRecent(pool, recentLogs);
  const selected = balanceMuscleGroups(pool, count, bodyArea);

  return selected.map((ex) => ({
    ...ex,
    plannedSets: ex.defaultSets,
    plannedReps: ex.defaultReps,
    plannedWeightLbs: ex.defaultWeightLbs,
  }));
}

// Multi-day split templates
export const SPLIT_TEMPLATES = {
  'Push/Pull/Legs': [
    { dayLabel: 'Day 1 – Push', bodyArea: 'Upper Body', muscleFilter: ['Chest', 'Shoulders', 'Arms'] },
    { dayLabel: 'Day 2 – Pull', bodyArea: 'Upper Body', muscleFilter: ['Back', 'Arms'] },
    { dayLabel: 'Day 3 – Legs', bodyArea: 'Lower Body', muscleFilter: ['Legs'] },
  ],
  'Upper/Lower': [
    { dayLabel: 'Day 1 – Upper', bodyArea: 'Upper Body', muscleFilter: null },
    { dayLabel: 'Day 2 – Lower', bodyArea: 'Lower Body', muscleFilter: null },
  ],
  'Full Body 3-Day': [
    { dayLabel: 'Day 1 – Full Body A', bodyArea: 'Full Body', muscleFilter: null },
    { dayLabel: 'Day 2 – Full Body B', bodyArea: 'Full Body', muscleFilter: null },
    { dayLabel: 'Day 3 – Full Body C', bodyArea: 'Full Body', muscleFilter: null },
  ],
  'Bro Split (5-Day)': [
    { dayLabel: 'Day 1 – Chest', bodyArea: 'Upper Body', muscleFilter: ['Chest'] },
    { dayLabel: 'Day 2 – Back', bodyArea: 'Upper Body', muscleFilter: ['Back'] },
    { dayLabel: 'Day 3 – Shoulders', bodyArea: 'Upper Body', muscleFilter: ['Shoulders'] },
    { dayLabel: 'Day 4 – Arms', bodyArea: 'Upper Body', muscleFilter: ['Arms'] },
    { dayLabel: 'Day 5 – Legs', bodyArea: 'Lower Body', muscleFilter: ['Legs'] },
  ],
};

/**
 * Generate a multi-day split plan.
 */
export function generateSplitPlan({ splitName, durationMinutes, recentLogs = [] }) {
  const template = SPLIT_TEMPLATES[splitName];
  if (!template) return [];

  return template.map((day) => {
    let pool = filterByBodyArea(EXERCISES, day.bodyArea);
    if (day.muscleFilter) {
      pool = pool.filter((e) => day.muscleFilter.includes(e.muscleGroup));
    }
    pool = deWeightRecent(pool, recentLogs);
    const count = getExerciseCount(durationMinutes);
    const selected = shuffle(pool).slice(0, count);

    return {
      dayLabel: day.dayLabel,
      bodyArea: day.bodyArea,
      exercises: selected.map((ex) => ({
        ...ex,
        plannedSets: ex.defaultSets,
        plannedReps: ex.defaultReps,
        plannedWeightLbs: ex.defaultWeightLbs,
      })),
    };
  });
}

// Get alternative exercises for the same muscle group
export function getAlternatives(exercise, currentPlanIds = []) {
  return EXERCISES.filter(
    (e) =>
      e.muscleGroup === exercise.muscleGroup &&
      e.exerciseID !== exercise.exerciseID &&
      !currentPlanIds.includes(e.exerciseID)
  ).slice(0, 4);
}
