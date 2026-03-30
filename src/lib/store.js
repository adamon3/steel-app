import { create } from 'zustand';
import { supabase } from './supabase';

export const useStore = create((set, get) => ({
  user: null,
  profile: null,
  exercises: [],
  feed: [],
  loading: true,

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),

  init: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      set({ user: session.user });
      await get().fetchProfile(session.user.id);
    }
    set({ loading: false });

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        set({ user: session.user });
        await get().fetchProfile(session.user.id);
      } else {
        set({ user: null, profile: null });
      }
    });
  },

  fetchProfile: async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) set({ profile: data });
  },

  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();
    if (data) set({ profile: data });
  },

  fetchExercises: async () => {
    const { data } = await supabase
      .from('exercises')
      .select('*')
      .order('name');
    if (data) set({ exercises: data });
  },

  fetchFeed: async () => {
    const { data } = await supabase
      .from('workouts')
      .select(`
        *,
        profiles:user_id (id, username, display_name, sport, gym, avatar_url),
        workout_exercises (
          id, sort_order, notes,
          exercises:exercise_id (id, name, muscle_group),
          sets (id, set_number, weight, reps, is_pr, set_type)
        ),
        likes (user_id),
        comments (id)
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) set({ feed: data });
  },

  saveWorkout: async (workout) => {
    const { user } = get();
    if (!user) return null;

    // Calculate totals
    let totalVolume = 0;
    let totalSets = 0;
    let hasPr = false;
    workout.exercises.forEach(ex => {
      ex.sets.forEach(s => {
        totalVolume += s.weight * s.reps;
        totalSets += 1;
        if (s.is_pr) hasPr = true;
      });
    });

    // Insert workout
    const { data: w, error } = await supabase
      .from('workouts')
      .insert({
        user_id: user.id,
        title: workout.title,
        notes: workout.notes || '',
        duration_mins: workout.duration_mins || 0,
        total_volume: totalVolume,
        total_sets: totalSets,
        has_pr: hasPr,
        steeled_from: workout.steeled_from || null,
      })
      .select()
      .single();

    if (error || !w) return null;

    // Insert exercises and sets
    for (let i = 0; i < workout.exercises.length; i++) {
      const ex = workout.exercises[i];
      const { data: we } = await supabase
        .from('workout_exercises')
        .insert({
          workout_id: w.id,
          exercise_id: ex.exercise_id,
          sort_order: i,
          notes: ex.notes || '',
        })
        .select()
        .single();

      if (we) {
        const setsToInsert = ex.sets.map((s, j) => ({
          workout_exercise_id: we.id,
          set_number: j + 1,
          weight: s.weight,
          reps: s.reps,
          is_pr: s.is_pr || false,
          set_type: s.set_type || 'normal',
        }));
        await supabase.from('sets').insert(setsToInsert);
      }
    }

    await get().fetchFeed();
    return w;
  },

  steelWorkout: async (workoutId) => {
    // Fetch the full workout to copy
    const { data: original } = await supabase
      .from('workouts')
      .select(`
        *,
        workout_exercises (
          sort_order, notes,
          exercises:exercise_id (id, name),
          sets (set_number, weight, reps, set_type)
        )
      `)
      .eq('id', workoutId)
      .single();

    if (!original) return null;

    const workout = {
      title: original.title,
      notes: '',
      steeled_from: original.id,
      exercises: original.workout_exercises
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(we => ({
          exercise_id: we.exercises.id,
          notes: we.notes,
          sets: we.sets
            .sort((a, b) => a.set_number - b.set_number)
            .map(s => ({
              weight: s.weight,
              reps: s.reps,
              set_type: s.set_type,
              is_pr: false,
            })),
        })),
    };

    return workout; // Return template, don't auto-save
  },

  toggleLike: async (workoutId) => {
    const { user } = get();
    if (!user) return;

    const { data: existing } = await supabase
      .from('likes')
      .select()
      .eq('user_id', user.id)
      .eq('workout_id', workoutId)
      .single();

    if (existing) {
      await supabase.from('likes').delete().eq('user_id', user.id).eq('workout_id', workoutId);
    } else {
      await supabase.from('likes').insert({ user_id: user.id, workout_id: workoutId });
    }
    await get().fetchFeed();
  },

  toggleFollow: async (targetId) => {
    const { user } = get();
    if (!user) return;

    const { data: existing } = await supabase
      .from('follows')
      .select()
      .eq('follower_id', user.id)
      .eq('following_id', targetId)
      .single();

    if (existing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId });
    }
  },
}));
