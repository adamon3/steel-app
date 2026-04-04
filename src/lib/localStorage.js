// Local storage for guest users AND offline mode for logged-in users
const GUEST_WORKOUTS_KEY = 'steel_guest_workouts';
const GUEST_TEMPLATES_KEY = 'steel_guest_templates';
const GUEST_PREFS_KEY = 'steel_guest_prefs';
const OFFLINE_QUEUE_KEY = 'steel_offline_queue';
const CACHED_EXERCISES_KEY = 'steel_cached_exercises';

// ── Guest mode (no account) ──
export function getGuestWorkouts() {
  try { return JSON.parse(localStorage.getItem(GUEST_WORKOUTS_KEY) || '[]'); } catch { return []; }
}

export function saveGuestWorkout(workout) {
  const workouts = getGuestWorkouts();
  const w = { ...workout, id: `local_${Date.now()}`, created_at: new Date().toISOString(), is_local: true };
  workouts.unshift(w);
  localStorage.setItem(GUEST_WORKOUTS_KEY, JSON.stringify(workouts));
  return w;
}

export function getGuestTemplates() {
  try { return JSON.parse(localStorage.getItem(GUEST_TEMPLATES_KEY) || '[]'); } catch { return []; }
}

export function saveGuestTemplate(name, exercises) {
  const templates = getGuestTemplates();
  templates.push({ id: `local_tmpl_${Date.now()}`, name, exercises, created_at: new Date().toISOString() });
  localStorage.setItem(GUEST_TEMPLATES_KEY, JSON.stringify(templates));
}

export function getGuestPrefs() {
  try { return JSON.parse(localStorage.getItem(GUEST_PREFS_KEY) || '{}'); } catch { return {}; }
}

export function setGuestPrefs(prefs) {
  localStorage.setItem(GUEST_PREFS_KEY, JSON.stringify(prefs));
}

export function clearGuestData() {
  localStorage.removeItem(GUEST_WORKOUTS_KEY);
  localStorage.removeItem(GUEST_TEMPLATES_KEY);
  localStorage.removeItem(GUEST_PREFS_KEY);
}

export function getGuestPreviousSets(exerciseId) {
  const workouts = getGuestWorkouts();
  for (const w of workouts) {
    for (const ex of (w.exercises || [])) {
      if (ex.exercise_id === exerciseId && ex.sets?.length > 0) {
        return ex.sets.map((s, i) => ({ set_number: i + 1, weight: s.weight, reps: s.reps }));
      }
    }
  }
  return null;
}

// ── Offline queue (logged-in user, no internet) ──
export function getOfflineQueue() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]'); } catch { return []; }
}

export function addToOfflineQueue(workout) {
  const queue = getOfflineQueue();
  queue.push({ ...workout, queued_at: new Date().toISOString() });
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export function clearOfflineQueue() {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

// ── Cached exercises (so exercise picker works offline) ──
export function getCachedExercises() {
  try { return JSON.parse(localStorage.getItem(CACHED_EXERCISES_KEY) || '[]'); } catch { return []; }
}

export function setCachedExercises(exercises) {
  try { localStorage.setItem(CACHED_EXERCISES_KEY, JSON.stringify(exercises)); } catch {}
}

// ── Online check ──
export function isOnline() {
  return navigator.onLine;
}
