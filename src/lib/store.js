import { create } from 'zustand';
import { supabase } from './supabase';
import { getGuestWorkouts, saveGuestWorkout, getGuestTemplates, saveGuestTemplate, deleteGuestTemplate, updateGuestTemplate, getGuestPreviousSets, clearGuestData, getOfflineQueue, addToOfflineQueue, removeFromOfflineQueue, clearOfflineQueue, getCachedExercises, setCachedExercises, isOnline } from './localStorage';

// Race a promise against a timeout. Reject with the named error after `ms`.
function withTimeout(promise, ms, label = 'timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms)),
  ]);
}

export const useStore = create((set, get) => ({
  user: null,
  profile: null,
  exercises: [],
  feed: [],
  templates: [],
  loading: true,
  isGuest: true,
  offline: false,
  _syncing: false,

  setUser: (user) => set({ user, isGuest: !user }),
  setProfile: (profile) => set({ profile }),

  init: async () => {
    // Check online status
    const online = isOnline();
    set({ offline: !online });

    // Listen for online/offline changes
    window.addEventListener('online', () => {
      set({ offline: false });
      get().syncOfflineQueue();
    });
    window.addEventListener('offline', () => set({ offline: true }));

    // Fetch exercises (try network, fall back to cache)
    await get().fetchExercises();

    // getSession() reads from localStorage — works offline too. The sync
    // functions inside the if(online) block are guarded separately.
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        set({ user: session.user, isGuest: false });
        // fetchProfile uses NetworkFirst via SW so it serves cached when offline.
        await get().fetchProfile(session.user.id);
        if (online) {
          await get().syncGuestWorkouts();
          await get().syncOfflineQueue();
        }
      }
    } catch (e) {
      console.log('Auth check failed:', e);
    }
    set({ loading: false });

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        set({ user: session.user, isGuest: false });
        await get().fetchProfile(session.user.id);
        await get().syncGuestWorkouts();
        await get().syncOfflineQueue();
        await get().fetchTemplates();
        await get().fetchFeed();
      } else {
        set({ user: null, profile: null, isGuest: true });
      }
    });
  },

  // Sync offline queue. Each item is removed individually on success — if one
  // fails (timeout / 5xx), the rest still get processed and the failed item
  // stays in the queue for the next attempt. Mutex prevents two concurrent
  // syncs from double-inserting the same workout when triggers overlap.
  syncOfflineQueue: async () => {
    const { user } = get();
    if (!user || !isOnline()) return;
    if (get()._syncing) return; // already running
    set({ _syncing: true });
    try {
      const queue = getOfflineQueue();
      if (queue.length === 0) return;
      let succeeded = 0;
      for (const workout of queue) {
        try {
          const saved = await get()._saveWorkoutToSupabase(workout);
          if (saved && workout.queue_id) {
            removeFromOfflineQueue(workout.queue_id);
            succeeded++;
          }
        } catch (e) {
          console.error('Failed to sync queued workout:', e);
          // Leave in queue for next attempt.
        }
      }
      if (succeeded > 0) {
        await get().fetchFeed();
      }
    } finally {
      set({ _syncing: false });
    }
  },

  syncGuestWorkouts: async () => {
    const { user } = get();
    if (!user || !isOnline()) return;
    const localWorkouts = getGuestWorkouts();
    if (localWorkouts.length === 0) return;
    for (const lw of localWorkouts) {
      try { await get()._saveWorkoutToSupabase(lw); } catch (e) { console.error('Sync guest workout fail:', e); }
    }
    clearGuestData();
  },

  fetchProfile: async (userId) => {
    // No isOnline() guard — the SW NetworkFirst strategy serves cached profile
    // when offline. The try/catch keeps a failed request from clobbering state.
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (data) set({ profile: data });
    } catch (e) { console.error('fetchProfile error:', e); }
  },

  updateProfile: async (updates) => {
    const { user } = get();
    if (!user || !isOnline()) return;
    try {
      const { data } = await supabase.from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id).select().single();
      if (data) set({ profile: data });
    } catch (e) { console.error('updateProfile error:', e); }
  },

  fetchExercises: async () => {
    if (isOnline()) {
      try {
        const { data } = await supabase.from('exercises').select('*').order('name');
        if (data && data.length > 0) {
          set({ exercises: data });
          setCachedExercises(data); // cache for offline
          return;
        }
      } catch (e) { console.log('Exercise fetch failed, using cache'); }
    }
    // Fallback to cached exercises
    const cached = getCachedExercises();
    if (cached.length > 0) set({ exercises: cached });
  },

  fetchTemplates: async () => {
    const { user, isGuest } = get();
    if (isGuest) { set({ templates: getGuestTemplates() }); return; }
    if (!user) return;
    // SW NetworkFirst serves cached templates when offline.
    try {
      const { data } = await supabase
        .from('templates')
        .select('*, template_exercises (id, sort_order, exercise_id, default_sets, default_reps, default_weight, exercises:exercise_id (id, name, muscle_group))')
        .eq('user_id', user.id)
        .order('last_used', { ascending: false, nullsFirst: false });
      if (data) set({ templates: data });
    } catch (e) { console.error('fetchTemplates error:', e); }
  },

  saveTemplate: async (name, exercises, opts = {}) => {
    const { user, isGuest, templates } = get();
    const trimmed = (name || '').trim();
    if (!trimmed) throw new Error('Template name required');
    const existing = (templates || []).find(
      t => (t.name || '').trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (existing && !opts.overwrite) {
      return { conflict: true, existingId: existing.id, name: existing.name };
    }

    if (isGuest) { saveGuestTemplate(trimmed, exercises); set({ templates: getGuestTemplates() }); return { id: 'local', name: trimmed }; }
    if (!user) throw new Error('Not logged in');
    const TIMEOUT_MS = 15000;

    let templateId;
    if (existing && opts.overwrite) {
      templateId = existing.id;
      const { error: wErr } = await withTimeout(
        supabase.from('template_exercises').delete().eq('template_id', templateId),
        TIMEOUT_MS, 'template_exercises wipe timeout'
      );
      if (wErr) throw new Error(wErr.message);
    } else {
      const { data: tmpl, error: tErr } = await withTimeout(
        supabase.from('templates').insert({ user_id: user.id, name: trimmed }).select().single(),
        TIMEOUT_MS, 'template insert timeout'
      );
      if (tErr || !tmpl) throw new Error(tErr?.message || 'Template insert returned no row');
      templateId = tmpl.id;
    }

    const rows = (exercises || []).map((ex, i) => ({
      template_id: templateId, exercise_id: ex.exercise_id, sort_order: i,
      default_sets: ex.sets?.length || 3, default_reps: ex.sets?.[0]?.reps || 10, default_weight: ex.sets?.[0]?.weight || 0,
    })).filter(r => r.exercise_id);
    if (rows.length > 0) {
      const { error: rErr } = await withTimeout(
        supabase.from('template_exercises').insert(rows),
        TIMEOUT_MS, 'template_exercises insert timeout'
      );
      if (rErr) throw new Error(rErr.message);
    }
    await get().fetchTemplates();
    return { id: templateId, name: trimmed };
  },

  deleteTemplate: async (templateId) => {
    const { isGuest } = get();
    if (isGuest) { deleteGuestTemplate(templateId); set({ templates: getGuestTemplates() }); return; }
    if (!isOnline()) return;
    await supabase.from('template_exercises').delete().eq('template_id', templateId);
    await supabase.from('templates').delete().eq('id', templateId);
    await get().fetchTemplates();
  },

  updateTemplate: async (templateId, name, exercises) => {
    const { user, isGuest } = get();
    const trimmed = (name || '').trim();
    if (!trimmed) throw new Error('Template name required');
    if (isGuest) {
      updateGuestTemplate(templateId, trimmed, exercises);
      set({ templates: getGuestTemplates() });
      return;
    }
    if (!user || !isOnline()) throw new Error('Not signed in or offline');
    const TIMEOUT_MS = 15000;
    const { error: nErr } = await withTimeout(
      supabase.from('templates').update({ name: trimmed }).eq('id', templateId),
      TIMEOUT_MS, 'template rename timeout'
    );
    if (nErr) throw new Error(nErr.message);
    await withTimeout(
      supabase.from('template_exercises').delete().eq('template_id', templateId),
      TIMEOUT_MS, 'template_exercises wipe timeout'
    );
    const rows = (exercises || []).map((ex, i) => ({
      template_id: templateId, exercise_id: ex.exercise_id, sort_order: i,
      default_sets: ex.default_sets || 3, default_reps: ex.default_reps || 10, default_weight: ex.default_weight || 0,
    })).filter(r => r.exercise_id);
    if (rows.length > 0) {
      const { error: rErr } = await withTimeout(
        supabase.from('template_exercises').insert(rows),
        TIMEOUT_MS, 'template_exercises insert timeout'
      );
      if (rErr) throw new Error(rErr.message);
    }
    await get().fetchTemplates();
  },

  getPreviousSets: async (exerciseId) => {
    const { user, isGuest } = get();
    if (isGuest) return getGuestPreviousSets(exerciseId);
    if (!user || !isOnline()) return getGuestPreviousSets(exerciseId); // fallback to local
    const { data: workouts } = await supabase
      .from('workouts').select('id').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(20);
    if (!workouts) return null;
    for (const w of workouts) {
      const { data: we } = await supabase
        .from('workout_exercises')
        .select('sets (set_number, weight, reps)')
        .eq('workout_id', w.id).eq('exercise_id', exerciseId).limit(1);
      if (we && we.length > 0 && we[0].sets?.length > 0) {
        return we[0].sets.sort((a, b) => a.set_number - b.set_number);
      }
    }
    return null;
  },

  fetchFeed: async () => {
    // SW NetworkFirst serves cached feed when offline.
    try {
      const { data, error } = await supabase
        .from('workouts')
        .select('*, profiles:user_id (id, username, display_name, sport, gym, avatar_url, privacy_mode), workout_exercises (id, sort_order, notes, exercises:exercise_id (id, name, muscle_group), sets (id, set_number, weight, reps, is_pr, set_type)), likes (user_id), comments (id)')
        .eq('is_public', true)
        .order('created_at', { ascending: false }).limit(40);
      if (error) console.error('fetchFeed query error:', error);
      if (data) {
        const filtered = data.filter(w => (w.profiles?.privacy_mode || 'normal') === 'normal').slice(0, 20);
        set({ feed: filtered });
      }
    } catch (e) { console.error('fetchFeed error:', e); }
  },

  // Queue-first save: persist to localStorage immediately, then attempt the
  // network save in the background. Returns instantly so the UI never hangs.
  // - Online + fast network: workout syncs within seconds, queue clears.
  // - Online + slow / flaky: workout stays queued; sync retries on each
  //   subsequent online event or app reload.
  // - Offline: same as above; sync will fire when online event fires.
  // - The save will never be lost as long as localStorage isn't wiped.
  saveWorkout: async (workout) => {
    const { user, isGuest } = get();

    if (isGuest || !user) {
      return saveGuestWorkout(workout);
    }

    // Always queue first for resilience.
    const queued = addToOfflineQueue(workout);

    // Fire-and-forget background sync. Don't await — UI must not block.
    if (isOnline()) {
      setTimeout(() => { get().syncOfflineQueue(); }, 0);
    }

    return { id: queued.queue_id, pending: true };
  },

  // Internal: save workout to Supabase. Each Supabase call is wrapped in a
  // 15s timeout via withTimeout so a stuck connection can't lock the queue.
  // On any failure the function throws and the caller (syncOfflineQueue)
  // leaves the workout in the queue for retry.
  _saveWorkoutToSupabase: async (workout) => {
    const { user } = get();
    if (!user) return null;
    const TIMEOUT_MS = 15000;
    let totalVolume = 0, totalSets = 0, hasPr = false;
    (workout.exercises || []).forEach(ex => {
      (ex.sets || []).forEach(s => {
        if (s.completed !== false) {
          totalSets += 1;
          if (s.set_type !== 'warmup') totalVolume += (s.weight || 0) * (s.reps || 0);
          if (s.is_pr) hasPr = true;
        }
      });
    });
    const { data: w, error } = await withTimeout(
      supabase.from('workouts').insert({
        user_id: user.id, title: workout.title || 'Workout', notes: workout.notes || '',
        duration_mins: workout.duration_mins || 0, total_volume: totalVolume,
        total_sets: totalSets, has_pr: hasPr, steeled_from: workout.steeled_from || null,
        is_public: workout.is_public !== false,
        created_at: workout.created_at || new Date().toISOString(),
      }).select().single(),
      TIMEOUT_MS, 'workout insert timeout'
    );
    if (error || !w) {
      throw new Error(`Save workout error: ${error?.message || 'no row'}`);
    }

    for (let i = 0; i < (workout.exercises || []).length; i++) {
      const ex = workout.exercises[i];
      const done = (ex.sets || []).filter(s => s.completed !== false);
      if (done.length === 0) continue;
      const { data: we } = await withTimeout(
        supabase.from('workout_exercises').insert({
          workout_id: w.id, exercise_id: ex.exercise_id, sort_order: i, notes: ex.notes || '',
        }).select().single(),
        TIMEOUT_MS, 'workout_exercises insert timeout'
      );
      if (we) {
        await withTimeout(
          supabase.from('sets').insert(done.map((s, j) => ({
            workout_exercise_id: we.id, set_number: j + 1,
            weight: s.weight || 0, reps: s.reps || 0,
            is_pr: s.is_pr || false, set_type: s.set_type || 'normal',
          }))),
          TIMEOUT_MS, 'sets insert timeout'
        );
      }
    }
    if (workout.template_id) {
      try {
        await withTimeout(
          supabase.from('templates').update({ last_used: new Date().toISOString() }).eq('id', workout.template_id),
          TIMEOUT_MS, 'template touch timeout'
        );
      } catch (e) { /* non-critical, don't fail save */ }
    }
    return w;
  },

  steelWorkout: async (workoutId) => {
    if (!isOnline()) return null;
    try {
      const { data: original } = await supabase.from('workouts')
        .select('*, workout_exercises (sort_order, notes, exercises:exercise_id (id, name), sets (set_number, weight, reps, set_type))')
        .eq('id', workoutId).maybeSingle();
      if (!original) return null;
      return {
        title: original.title, notes: '', steeled_from: original.id,
        exercises: (original.workout_exercises || []).sort((a, b) => a.sort_order - b.sort_order).map(we => ({
          exercise_id: we.exercises?.id, name: we.exercises?.name, notes: we.notes || '',
          sets: (we.sets || []).sort((a, b) => a.set_number - b.set_number).map(s => ({
            weight: 0, reps: s.reps, set_type: s.set_type, is_pr: false,
          })),
        })),
      };
    } catch (e) { console.error('steelWorkout error:', e); return null; }
  },

  fetchWorkout: async (workoutId) => {
    // SW NetworkFirst serves cached workout detail when offline.
    try {
      const { data, error } = await supabase.from('workouts')
        .select('*, profiles:user_id (id, username, display_name, sport, gym, avatar_url), workout_exercises (id, sort_order, notes, exercises:exercise_id (id, name, muscle_group), sets (id, set_number, weight, reps, is_pr, set_type)), likes (user_id), comments (id, body, user_id, created_at, profiles:user_id (id, username, display_name, avatar_url))')
        .eq('id', workoutId).maybeSingle();
      if (error) { console.error('fetchWorkout error:', error); return null; }
      return data;
    } catch (e) { console.error('fetchWorkout error:', e); return null; }
  },

  // Full edit: replaces title, notes, duration, is_public, exercises, sets.
  // SAFE for likes/comments — both FK to workout_id (not workout_exercise_id),
  // so wiping+re-inserting workout_exercises+sets leaves them untouched.
  updateWorkoutFull: async (workoutId, payload) => {
    const { user } = get();
    if (!user || !isOnline()) return false;
    try {
      // 1. Update workout-level fields and recompute totals
      let totalVolume = 0, totalSets = 0, hasPr = false;
      (payload.exercises || []).forEach(ex => {
        (ex.sets || []).forEach(s => {
          totalSets += 1;
          if (s.set_type !== 'warmup') totalVolume += (s.weight || 0) * (s.reps || 0);
          if (s.is_pr) hasPr = true;
        });
      });

      const updates = {
        title: payload.title || 'Workout',
        notes: payload.notes || '',
        duration_mins: payload.duration_mins || 0,
        is_public: payload.is_public !== false,
        total_volume: totalVolume,
        total_sets: totalSets,
        has_pr: hasPr,
      };
      const { error: upErr } = await supabase.from('workouts').update(updates).eq('id', workoutId).eq('user_id', user.id);
      if (upErr) { console.error('updateWorkoutFull workout error:', upErr); return false; }

      // 2. Wipe existing workout_exercises (cascade deletes sets) and re-insert from payload
      const { data: existingWE } = await supabase.from('workout_exercises').select('id').eq('workout_id', workoutId);
      if (existingWE?.length) {
        const ids = existingWE.map(we => we.id);
        await supabase.from('sets').delete().in('workout_exercise_id', ids);
        await supabase.from('workout_exercises').delete().in('id', ids);
      }

      // 3. Re-insert exercises and sets
      for (let i = 0; i < (payload.exercises || []).length; i++) {
        const ex = payload.exercises[i];
        if (!ex.exercise_id) continue;
        const validSets = (ex.sets || []).filter(s => (s.weight !== undefined && s.weight !== null) || (s.reps !== undefined && s.reps !== null));
        if (validSets.length === 0) continue;
        const { data: we } = await supabase.from('workout_exercises').insert({
          workout_id: workoutId, exercise_id: ex.exercise_id, sort_order: i, notes: ex.notes || '',
        }).select().single();
        if (we) {
          await supabase.from('sets').insert(validSets.map((s, j) => ({
            workout_exercise_id: we.id, set_number: j + 1,
            weight: s.weight || 0, reps: s.reps || 0,
            is_pr: s.is_pr || false, set_type: s.set_type || 'normal',
          })));
        }
      }

      await get().fetchFeed();
      return true;
    } catch (e) { console.error('updateWorkoutFull error:', e); return false; }
  },

  deleteWorkout: async (workoutId) => {
    const { user } = get();
    if (!user || !isOnline()) return false;
    try {
      // Delete sets and workout_exercises first (FK cascade should handle, but explicit is safer)
      const { data: existingWE } = await supabase.from('workout_exercises').select('id').eq('workout_id', workoutId);
      if (existingWE?.length) {
        const ids = existingWE.map(we => we.id);
        await supabase.from('sets').delete().in('workout_exercise_id', ids);
        await supabase.from('workout_exercises').delete().in('id', ids);
      }
      // Likes and comments
      await supabase.from('likes').delete().eq('workout_id', workoutId);
      await supabase.from('comments').delete().eq('workout_id', workoutId);
      // The workout itself
      const { error } = await supabase.from('workouts').delete().eq('id', workoutId).eq('user_id', user.id);
      if (error) { console.error('deleteWorkout error:', error); return false; }
      await get().fetchFeed();
      return true;
    } catch (e) { console.error('deleteWorkout error:', e); return false; }
  },

  toggleLike: async (workoutId) => {
    const { user } = get();
    if (!user || !isOnline()) return;
    try {
      const { data: existing } = await supabase.from('likes').select()
        .eq('user_id', user.id).eq('workout_id', workoutId).maybeSingle();
      if (existing) {
        await supabase.from('likes').delete().eq('user_id', user.id).eq('workout_id', workoutId);
      } else {
        await supabase.from('likes').insert({ user_id: user.id, workout_id: workoutId });
      }
      await get().fetchFeed();
    } catch (e) { console.error('toggleLike error:', e); }
  },

  toggleFollow: async (targetId) => {
    const { user } = get();
    if (!user || !isOnline()) return;
    try {
      const { data: existing } = await supabase.from('follows').select()
        .eq('follower_id', user.id).eq('following_id', targetId).maybeSingle();
      if (existing) {
        await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
      } else {
        await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId });
      }
    } catch (e) { console.error('toggleFollow error:', e); }
  },

  addComment: async (workoutId, body) => {
    const { user } = get();
    if (!user || !isOnline()) return null;
    try {
      const { data } = await supabase.from('comments')
        .insert({ workout_id: workoutId, user_id: user.id, body })
        .select('id, body, user_id, created_at, profiles:user_id (id, username, display_name, avatar_url)')
        .single();
      return data;
    } catch (e) { console.error('addComment error:', e); return null; }
  },
}));
