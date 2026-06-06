// Local storage for guest users AND offline mode for logged-in users
const GUEST_WORKOUTS_KEY = 'steel_guest_workouts';
const GUEST_TEMPLATES_KEY = 'steel_guest_templates';
const GUEST_PREFS_KEY = 'steel_guest_prefs';
const OFFLINE_QUEUE_KEY = 'steel_offline_queue';
const CACHED_EXERCISES_KEY = 'steel_cached_exercises';
const WIP_WORKOUT_KEY = 'steel_wip_workout';
const WIP_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

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
  const norm = (name || '').trim().toLowerCase();
  const templates = getGuestTemplates().filter(t => (t.name || '').trim().toLowerCase() !== norm);
  templates.push({ id: `local_tmpl_${Date.now()}`, name, exercises, created_at: new Date().toISOString() });
  localStorage.setItem(GUEST_TEMPLATES_KEY, JSON.stringify(templates));
}

export function deleteGuestTemplate(id) {
  const templates = getGuestTemplates().filter(t => t.id !== id);
  localStorage.setItem(GUEST_TEMPLATES_KEY, JSON.stringify(templates));
}

export function updateGuestTemplate(id, name, exercises) {
  const template_exercises = (exercises || []).map((e, i) => ({
    exercise_id: e.exercise_id, sort_order: i,
    default_sets: e.default_sets, default_reps: e.default_reps, default_weight: e.default_weight,
    exercises: { name: e.name },
  }));
  const templates = getGuestTemplates().map(t => t.id === id ? { ...t, name, template_exercises } : t);
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

// ── Offline queue (any pending save — even if online, queued for resilience) ──
// Each item has a queue_id so we can remove successful syncs individually
// without losing concurrent pending items.
export function getOfflineQueue() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]'); } catch { return []; }
}

export function addToOfflineQueue(workout) {
  const queue = getOfflineQueue();
  const queue_id = `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const item = { ...workout, queue_id, queued_at: new Date().toISOString() };
  queue.push(item);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  return item;
}

export function removeFromOfflineQueue(queue_id) {
  try {
    const queue = getOfflineQueue();
    const filtered = queue.filter(w => w.queue_id !== queue_id);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
  } catch {}
}

export function clearOfflineQueue() {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

// ── Work-in-progress workout (active logger state) ──
// Persists every state change so a crash / close / refresh doesn't lose work.
// Cleared after successful save or explicit discard.
export function getWIPWorkout() {
  try {
    const raw = localStorage.getItem(WIP_WORKOUT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.savedAt) return null;
    if (Date.now() - data.savedAt > WIP_MAX_AGE_MS) {
      localStorage.removeItem(WIP_WORKOUT_KEY);
      return null;
    }
    return data;
  } catch { return null; }
}

export function setWIPWorkout(state) {
  try {
    localStorage.setItem(WIP_WORKOUT_KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
  } catch {}
}

export function clearWIPWorkout() {
  localStorage.removeItem(WIP_WORKOUT_KEY);
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
