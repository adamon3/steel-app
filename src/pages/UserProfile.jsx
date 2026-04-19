import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { COLORS, Avatar, Icon, Spinner, EmptyState, getInitials, formatVolume, timeAgo, convertWeight } from '../components/UI';

const FONTS = {
  sans: "'Inter Tight', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
};

function Stat({ label, value, suffix }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontFamily: FONTS.mono, fontSize: 20, fontWeight: 700,
        color: COLORS.text, letterSpacing: '-0.03em',
      }}>
        {value}{suffix && <span style={{ color: COLORS.textDim, fontSize: 12, fontWeight: 500 }}>{suffix}</span>}
      </div>
      <div style={{
        fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textDim,
        letterSpacing: '0.14em', fontWeight: 500, textTransform: 'uppercase', marginTop: 2,
      }}>{label}</div>
    </div>
  );
}

export default function UserProfile({ userId, onBack, onSteel }) {
  const { user, profile: myProfile } = useStore();
  const [athlete, setAthlete] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const unit = myProfile?.unit_pref || 'kg';

  useEffect(() => { if (userId) loadProfile(); }, [userId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (p) setAthlete(p);

      const { data: wks } = await supabase.from('workouts')
        .select('*, workout_exercises (id, sort_order, exercises:exercise_id (id, name), sets (id, set_number, weight, reps, is_pr))')
        .eq('user_id', userId).eq('is_public', true)
        .order('created_at', { ascending: false }).limit(10);
      if (wks) setWorkouts(wks);

      if (user) {
        const { data: f } = await supabase.from('follows').select('*')
          .eq('follower_id', user.id).eq('following_id', userId).maybeSingle();
        setIsFollowing(!!f);
      }

      const { count: fc } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId);
      const { count: fgc } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId);
      setFollowerCount(fc || 0);
      setFollowingCount(fgc || 0);
    } catch (e) { console.error(e); }
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
  const totalWorkouts = workouts.length;
  const totalVolume = workouts.reduce((sum, w) => sum + (Number(w.total_volume) || 0), 0);
  const volDisp = totalVolume >= 1000 ? (totalVolume / 1000).toFixed(1) : String(Math.round(totalVolume));
  const volSuffix = totalVolume >= 1000 ? ' k' : '';

  return (
    <div style={{ fontFamily: FONTS.sans }}>
      {/* Back */}
      <button onClick={onBack} style={{
        background: 'none', border: 'none', color: COLORS.text,
        cursor: 'pointer', padding: '4px 0', fontFamily: FONTS.sans,
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14,
        fontSize: 13, fontWeight: 600,
      }}>
        <Icon name="back" size={16} color={COLORS.text} />
        Back
      </button>

      {/* Profile card */}
      <div style={{
        background: COLORS.card, borderRadius: 16, padding: 20, marginBottom: 16,
        border: `1px solid ${COLORS.border}`, textAlign: 'center',
      }}>
        <Avatar
          initials={getInitials(athlete.display_name)}
          size={76}
          colorIndex={athlete.id?.charCodeAt(0) || 0}
          src={athlete.avatar_url || null}
        />
        <div style={{
          fontSize: 22, fontWeight: 800, color: COLORS.text,
          letterSpacing: '-0.02em', marginTop: 12,
        }}>{athlete.display_name}</div>
        <div style={{
          fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textDim,
          marginTop: 2, letterSpacing: '0.04em',
        }}>@{athlete.username}</div>

        {(athlete.sport || athlete.gym) && (
          <div style={{
            fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
            letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500,
            marginTop: 10,
          }}>
            {[athlete.sport, athlete.gym].filter(Boolean).join(' · ')}
          </div>
        )}

        {athlete.bio && (
          <div style={{
            fontSize: 13, color: COLORS.text, marginTop: 12, lineHeight: 1.45,
            maxWidth: 300, margin: '12px auto 0',
          }}>
            {athlete.bio}
          </div>
        )}

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 20,
          paddingTop: 16, borderTop: `0.5px solid ${COLORS.border}`,
        }}>
          <Stat label="Followers" value={followerCount} />
          <Stat label="Following" value={followingCount} />
          <Stat label="Workouts" value={totalWorkouts} />
          <Stat label={`Total ${unit}`} value={volDisp} suffix={volSuffix} />
        </div>

        {!isMe && (
          <button onClick={handleFollow} style={{
            marginTop: 18, padding: '11px 36px', borderRadius: 999,
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            fontFamily: FONTS.sans, letterSpacing: '-0.01em',
            background: isFollowing ? 'transparent' : COLORS.text,
            color: isFollowing ? COLORS.text : COLORS.bg,
            border: `1px solid ${COLORS.text}`,
          }}>{isFollowing ? 'Following' : 'Follow'}</button>
        )}
      </div>

      {/* Workouts */}
      <div style={{
        fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
        letterSpacing: '0.14em', fontWeight: 500, textTransform: 'uppercase',
        marginBottom: 10,
      }}>Recent workouts</div>

      {workouts.length === 0 ? (
        <EmptyState icon="weight" title="No workouts yet"
          subtitle={`${athlete.display_name} hasn't logged any workouts`} />
      ) : (
        workouts.map(w => {
          const exercises = (w.workout_exercises || []).sort((a, b) => a.sort_order - b.sort_order);
          const vol = convertWeight(w.total_volume, unit);
          const volStr = vol >= 1000 ? `${(vol / 1000).toFixed(1)}k` : String(Math.round(vol));
          return (
            <div key={w.id} style={{
              background: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 10,
              border: `1px solid ${COLORS.border}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: 16, fontWeight: 700, color: COLORS.text, letterSpacing: '-0.01em',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{w.title}</div>
                  <div style={{
                    fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
                    fontWeight: 500, letterSpacing: '0.08em', marginTop: 2, textTransform: 'uppercase',
                  }}>
                    {timeAgo(w.created_at).toUpperCase()}
                    {w.duration_mins > 0 && ` · ${w.duration_mins} MIN`}
                    {` · ${volStr} ${unit.toUpperCase()}`}
                    {` · ${w.total_sets} SETS`}
                  </div>
                </div>
                {w.has_pr && (
                  <span style={{
                    background: '#BFE600', color: '#0A0A0A',
                    fontSize: 9, fontWeight: 700, padding: '3px 7px',
                    borderRadius: 4, letterSpacing: '0.05em', flexShrink: 0, marginLeft: 8,
                  }}>PR</span>
                )}
              </div>

              <div>
                {exercises.slice(0, 4).map((we, i) => {
                  const sets = (we.sets || []).sort((a, b) => a.set_number - b.set_number);
                  const topW = Math.max(...sets.map(s => s.weight), 0);
                  const topSet = sets.find(s => s.weight === topW);
                  return (
                    <div key={we.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: i < Math.min(exercises.length, 4) - 1
                        ? `0.5px solid ${COLORS.border}` : 'none',
                    }}>
                      <span style={{
                        fontSize: 13, color: COLORS.text, fontWeight: 600, letterSpacing: '-0.01em',
                      }}>{we.exercises?.name}</span>
                      <span style={{
                        fontFamily: FONTS.mono, fontSize: 12, fontWeight: 500, color: COLORS.textDim,
                      }}>
                        {sets.length} × {convertWeight(topW, unit)}<span style={{ fontSize: 9, marginLeft: 3 }}>{unit}</span>
                      </span>
                    </div>
                  );
                })}
                {exercises.length > 4 && (
                  <div style={{
                    fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
                    textAlign: 'center', paddingTop: 8, letterSpacing: '0.1em', fontWeight: 500,
                  }}>
                    + {exercises.length - 4} MORE
                  </div>
                )}
              </div>

              {!isMe && (
                <button onClick={() => handleSteel(w.id, w.title)} style={{
                  width: '100%', marginTop: 12, padding: '10px 16px',
                  borderRadius: 999, fontWeight: 700, fontSize: 13,
                  cursor: 'pointer', fontFamily: FONTS.sans, letterSpacing: '-0.01em',
                  background: COLORS.text, color: COLORS.bg, border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  <Icon name="copy" size={14} color={COLORS.bg} />
                  Steel this workout
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
