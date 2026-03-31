import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { COLORS, Avatar, Badge, Button, Spinner, EmptyState, getInitials, formatVolume, timeAgo, convertWeight } from '../components/UI';

export default function UserProfile({ userId, onBack, onSteel }) {
  const { user, profile: myProfile } = useStore();
  const [athlete, setAthlete] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const unit = myProfile?.unit_pref || 'kg';

  useEffect(() => {
    if (userId) loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    setLoading(true);

    // Fetch profile
    const { data: p } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (p) setAthlete(p);

    // Fetch workouts with exercises and sets
    const { data: wks } = await supabase
      .from('workouts')
      .select('*, workout_exercises (id, sort_order, exercises:exercise_id (id, name), sets (id, set_number, weight, reps, is_pr))')
      .eq('user_id', userId)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(10);
    if (wks) setWorkouts(wks);

    // Check if following
    if (user) {
      const { data: f } = await supabase.from('follows').select('*')
        .eq('follower_id', user.id).eq('following_id', userId).single();
      setIsFollowing(!!f);
    }

    // Counts
    const { count: fc } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId);
    const { count: fgc } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId);
    setFollowerCount(fc || 0);
    setFollowingCount(fgc || 0);

    setLoading(false);
  };

  const handleFollow = async () => {
    if (!user) return;
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', userId);
      setIsFollowing(false);
      setFollowerCount(c => c - 1);
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: userId });
      setIsFollowing(true);
      setFollowerCount(c => c + 1);
    }
  };

  const handleSteel = async (workoutId, title) => {
    const template = await useStore.getState().steelWorkout(workoutId);
    if (template) {
      template.steeled_from = workoutId;
      onSteel(template, title, athlete?.display_name);
    }
  };

  if (loading) return <Spinner />;
  if (!athlete) return <EmptyState emoji="😕" title="User not found" subtitle="This profile doesn't exist" />;

  const isMe = user?.id === userId;
  const totalWorkouts = workouts.length;
  const totalVolume = workouts.reduce((sum, w) => sum + (Number(w.total_volume) || 0), 0);

  return (
    <div>
      {/* Back button */}
      <button onClick={onBack} style={{
        background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.textDim,
        cursor: 'pointer', fontSize: 13, padding: '7px 14px', borderRadius: 8,
        fontFamily: 'inherit', fontWeight: 600, marginBottom: 12,
      }}>{"<"} Back</button>

      {/* Profile card */}
      <div style={{
        background: COLORS.card, borderRadius: 16, padding: 20, marginBottom: 16,
        border: `1px solid ${COLORS.border}`, textAlign: 'center',
      }}>
        <Avatar initials={getInitials(athlete.display_name)} size={72} colorIndex={athlete.id?.charCodeAt(0) || 0} />
        <div style={{ fontWeight: 800, fontSize: 20, color: COLORS.text, marginTop: 10 }}>{athlete.display_name}</div>
        <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 2 }}>@{athlete.username}</div>

        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          {athlete.sport && <Badge color={COLORS.orange}>{athlete.sport}</Badge>}
          {athlete.gym && <Badge>{"📍"} {athlete.gym}</Badge>}
        </div>

        {athlete.bio && <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 10, lineHeight: 1.4 }}>{athlete.bio}</div>}

        {/* Stats */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: COLORS.text }}>{followerCount}</div>
            <div style={{ fontSize: 11, color: COLORS.textDim }}>Followers</div>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: COLORS.text }}>{followingCount}</div>
            <div style={{ fontSize: 11, color: COLORS.textDim }}>Following</div>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: COLORS.text }}>{totalWorkouts}</div>
            <div style={{ fontSize: 11, color: COLORS.textDim }}>Workouts</div>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: COLORS.accent }}>{formatVolume(totalVolume)}</div>
            <div style={{ fontSize: 11, color: COLORS.textDim }}>Total kg</div>
          </div>
        </div>

        {/* Follow button */}
        {!isMe && (
          <button onClick={handleFollow} style={{
            marginTop: 16, padding: '10px 32px', borderRadius: 10, fontWeight: 700,
            fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
            background: isFollowing ? 'transparent' : COLORS.accent,
            color: isFollowing ? COLORS.accent : COLORS.bg,
            border: isFollowing ? `2px solid ${COLORS.accent}` : '2px solid transparent',
          }}>{isFollowing ? 'Following ✓' : 'Follow'}</button>
        )}
      </div>

      {/* Workouts */}
      <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>Recent Workouts</div>

      {workouts.length === 0 ? (
        <EmptyState emoji="🏋️" title="No workouts yet" subtitle={`${athlete.display_name} hasn't logged any workouts`} />
      ) : (
        workouts.map(w => {
          const exercises = (w.workout_exercises || []).sort((a, b) => a.sort_order - b.sort_order);
          return (
            <div key={w.id} style={{
              background: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 10,
              border: `1px solid ${COLORS.border}`,
            }}>
              {/* Workout header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.text }}>{w.title}</div>
                  <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 2 }}>{timeAgo(w.created_at)}</div>
                </div>
                {w.has_pr && <Badge color={COLORS.pro}>{"🏆"} PR</Badge>}
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                {w.duration_mins > 0 && <span style={{ fontSize: 12, color: COLORS.textDim }}>{"⏱"} {w.duration_mins} min</span>}
                <span style={{ fontSize: 12, color: COLORS.textDim }}>{"🏋️"} {formatVolume(convertWeight(w.total_volume, unit))} {unit}</span>
                <span style={{ fontSize: 12, color: COLORS.textDim }}>{"💪"} {w.total_sets} sets</span>
              </div>

              {/* Exercise list */}
              <div style={{ background: `${COLORS.bg}88`, borderRadius: 8, padding: 8, marginBottom: 10 }}>
                {exercises.slice(0, 4).map((we, i) => {
                  const sets = (we.sets || []).sort((a, b) => a.set_number - b.set_number);
                  const topWeight = Math.max(...sets.map(s => s.weight), 0);
                  const topSet = sets.find(s => s.weight === topWeight);
                  return (
                    <div key={we.id} style={{
                      display: 'flex', justifyContent: 'space-between', padding: '4px 4px',
                      borderBottom: i < Math.min(exercises.length, 4) - 1 ? `1px solid ${COLORS.border}` : 'none',
                    }}>
                      <span style={{ fontSize: 13, color: COLORS.text, fontWeight: 500 }}>{we.exercises?.name}</span>
                      <span style={{ fontSize: 12, color: COLORS.textDim }}>
                        {sets.length}s · {convertWeight(topWeight, unit)}{unit} x{topSet?.reps || 0}
                      </span>
                    </div>
                  );
                })}
                {exercises.length > 4 && (
                  <div style={{ fontSize: 12, color: COLORS.textDim, paddingTop: 4 }}>+{exercises.length - 4} more</div>
                )}
              </div>

              {/* Steel it button */}
              {!isMe && (
                <button onClick={() => handleSteel(w.id, w.title)} style={{
                  width: '100%', padding: '9px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13,
                  cursor: 'pointer', fontFamily: 'inherit', background: COLORS.accent,
                  color: COLORS.bg, border: 'none', transition: 'all 0.15s',
                }}>{"📋"} Steel this workout</button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
