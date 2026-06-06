import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { COLORS, Avatar, Badge, Button, Icon, Spinner, EmptyState, getInitials, formatVolume, timeAgo, convertWeight } from '../components/UI';

export default function UserProfile({ userId, onBack, onSteel, onWorkout }) {
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
    try {
      // Fetch profile
      const { data: p } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
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
          .eq('follower_id', user.id).eq('following_id', userId).maybeSingle();
        setIsFollowing(!!f);
      }

      // Counts
      const { count: fc } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId);
      const { count: fgc } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId);
      setFollowerCount(fc || 0);
      setFollowingCount(fgc || 0);
    } catch (e) { console.error('UserProfile load error:', e); }
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
  if (!athlete) return <EmptyState icon="search" title="User not found" subtitle="This profile doesn't exist" />;

  const isMe = user?.id === userId;
  const isPrivate = !isMe && (athlete.privacy_mode === 'private' || athlete.privacy_mode === 'solo');
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
        <Avatar initials={getInitials(athlete.display_name)} size={72} colorIndex={athlete.id?.charCodeAt(0) || 0} src={athlete.avatar_url || null} />
        <div style={{ fontWeight: 800, fontSize: 20, color: COLORS.text, marginTop: 10 }}>{athlete.display_name}</div>
        <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 2 }}>@{athlete.username}</div>

        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          {athlete.sport && <Badge color={COLORS.text}>{athlete.sport}</Badge>}
          {athlete.gym && <Badge color={COLORS.textDim}>{athlete.gym}</Badge>}
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
            <div style={{ fontWeight: 700, fontSize: 18, color: COLORS.accentDim }}>{formatVolume(convertWeight(totalVolume, unit))}</div>
            <div style={{ fontSize: 11, color: COLORS.textDim }}>Total {unit}</div>
          </div>
        </div>

        {/* Follow button */}
        {!isMe && (
          <button onClick={handleFollow} style={{
            marginTop: 16, padding: '10px 32px', borderRadius: 10, fontWeight: 700,
            fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
            background: isFollowing ? 'transparent' : COLORS.accent,
            color: isFollowing ? COLORS.accentDim : COLORS.accentText,
            border: isFollowing ? `2px solid ${COLORS.accentDim}` : '2px solid transparent',
          }}>{isFollowing ? 'Following ✓' : 'Follow'}</button>
        )}
      </div>

      {/* Workouts */}
      <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>Recent Workouts</div>

      {isPrivate ? (
        <EmptyState
          icon="lock"
          title="This athlete trains in private"
          subtitle="Their workouts aren't visible. Send a follow request later if we add private follows."
        />
      ) : workouts.length === 0 ? (
        <EmptyState icon="weight" title="No workouts yet" subtitle={`${athlete.display_name} hasn't logged any workouts`} />
      ) : (
        workouts.map(w => {
          const exercises = (w.workout_exercises || []).sort((a, b) => a.sort_order - b.sort_order);
          return (
            <div
              key={w.id}
              onClick={() => onWorkout?.(w.id)}
              style={{
                background: COLORS.card, borderRadius: 14, marginBottom: 12,
                border: `1px solid ${COLORS.border}`, cursor: 'pointer', overflow: 'hidden',
              }}
            >
              <div style={{ padding: 16 }}>
                {/* Workout header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.text, letterSpacing: '-0.01em' }}>{w.title}</div>
                    <div style={{ fontSize: 10, color: COLORS.textSubtle, marginTop: 3, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase' }}>{timeAgo(w.created_at)}</div>
                  </div>
                  {w.has_pr && <Badge color={COLORS.pro}>PR</Badge>}
                </div>

                {/* Stat strip */}
                <div style={{ display: 'flex', marginBottom: 14 }}>
                  {[
                    ...(w.duration_mins > 0 ? [{ label: 'Duration', value: `${w.duration_mins}m` }] : []),
                    { label: `Volume (${unit})`, value: formatVolume(convertWeight(w.total_volume, unit)) },
                    { label: 'Sets', value: w.total_sets },
                  ].map((s, i, arr) => (
                    <div key={i} style={{ flex: 1, textAlign: 'center', borderRight: i < arr.length - 1 ? `1px solid ${COLORS.border}` : 'none' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{s.value}</div>
                      <div style={{ fontSize: 9, color: COLORS.textDim, marginTop: 3, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.12em', textTransform: 'uppercase' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Exercise list */}
                {exercises.slice(0, 4).map((we) => {
                  const sets = (we.sets || []).sort((a, b) => a.set_number - b.set_number);
                  const topWeight = Math.max(...sets.map(s => s.weight || 0), 0);
                  const hasPr = sets.some(s => s.is_pr);
                  return (
                    <div key={we.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '9px 11px', marginBottom: 4, background: COLORS.card2, borderRadius: 8,
                      border: hasPr ? `1px solid ${COLORS.pro}33` : '1px solid transparent',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ fontSize: 14, color: COLORS.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{we.exercises?.name}</span>
                        {hasPr && <span style={{ background: `${COLORS.pro}20`, color: COLORS.accentDim, padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 800, letterSpacing: 0.5, flexShrink: 0 }}>PR</span>}
                      </div>
                      <span style={{ fontSize: 13, color: COLORS.textDim, fontWeight: 500, fontVariantNumeric: 'tabular-nums', flexShrink: 0, marginLeft: 8 }}>
                        {sets.length}×{convertWeight(topWeight, unit)}{unit}
                      </span>
                    </div>
                  );
                })}
                {exercises.length > 4 && (
                  <div style={{ fontSize: 12, color: COLORS.textDim, paddingTop: 6, textAlign: 'center' }}>+{exercises.length - 4} more exercises</div>
                )}
              </div>

              {/* Steel it — full-width footer bar */}
              {!isMe && (
                <button onClick={(e) => { e.stopPropagation(); handleSteel(w.id, w.title); }} style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '15px 16px', background: COLORS.accent, color: COLORS.accentText,
                  border: 'none', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                  fontFamily: 'inherit', letterSpacing: '-0.01em',
                }}>
                  <Icon name="copy" size={17} color={COLORS.accentText} /> Steel this workout
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
