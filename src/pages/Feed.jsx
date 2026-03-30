import React, { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { COLORS, Avatar, Badge, Button, EmptyState, Spinner, getInitials, formatVolume, timeAgo, convertWeight } from '../components/UI';

function WorkoutCard({ workout, onSteel, onProfile, unitPref }) {
  const { user, toggleLike } = useStore();
  const [liked, setLiked] = useState(false);
  const [steeled, setSteeled] = useState(false);
  const p = workout.profiles;

  useEffect(() => {
    if (user && workout.likes) {
      setLiked(workout.likes.some(l => l.user_id === user.id));
    }
  }, [workout.likes, user]);

  const handleLike = async () => {
    setLiked(!liked);
    await toggleLike(workout.id);
  };

  const handleSteel = () => {
    setSteeled(true);
    onSteel(workout);
    setTimeout(() => setSteeled(false), 2000);
  };

  const exercises = (workout.workout_exercises || []).sort((a, b) => a.sort_order - b.sort_order);
  const unit = unitPref || 'kg';

  return (
    <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 12, border: `1px solid ${COLORS.border}` }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Avatar initials={getInitials(p?.display_name || '??')} colorIndex={p?.id?.charCodeAt(0) || 0} size={40} onClick={() => onProfile?.(p?.id)} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span onClick={() => onProfile?.(p?.id)} style={{ fontWeight: 700, color: COLORS.text, cursor: 'pointer', fontSize: 14 }}>{p?.display_name}</span>
            {p?.sport && <Badge color={COLORS.orange}>{p.sport}</Badge>}
          </div>
          <div style={{ fontSize: 12, color: COLORS.textDim }}>{p?.gym || 'Unknown gym'} · {timeAgo(workout.created_at)}</div>
        </div>
      </div>

      {/* Title */}
      <div style={{ fontWeight: 700, fontSize: 16, color: COLORS.text, marginBottom: 8 }}>{workout.title}</div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        {workout.duration_mins > 0 && <span style={{ fontSize: 12, color: COLORS.textDim }}>{"⏱"} {workout.duration_mins} min</span>}
        <span style={{ fontSize: 12, color: COLORS.textDim }}>{"🏋️"} {formatVolume(convertWeight(workout.total_volume, unit))} {unit}</span>
        {workout.has_pr && <span style={{ fontSize: 12, color: COLORS.pro }}>{"🏆"} New PR!</span>}
        {workout.steeled_from && <span style={{ fontSize: 12, color: COLORS.accent }}>{"📋"} Steeled</span>}
      </div>

      {/* Exercises */}
      <div style={{ background: `${COLORS.bg}88`, borderRadius: 10, padding: 10, marginBottom: 12 }}>
        {exercises.slice(0, 4).map((we, i) => {
          const sets = (we.sets || []).sort((a, b) => a.set_number - b.set_number);
          const topWeight = Math.max(...sets.map(s => s.weight), 0);
          const topSet = sets.find(s => s.weight === topWeight);
          const hasPr = sets.some(s => s.is_pr);
          return (
            <div key={we.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0',
              borderBottom: i < Math.min(exercises.length, 4) - 1 ? `1px solid ${COLORS.border}` : 'none' }}>
              <span style={{ fontSize: 13, color: COLORS.text, fontWeight: 500 }}>{we.exercises?.name}</span>
              <span style={{ fontSize: 12, color: COLORS.textDim }}>
                {sets.length} sets · top {convertWeight(topWeight, unit)}{unit} x{topSet?.reps || 0}
                {hasPr && <span style={{ color: COLORS.pro, marginLeft: 4 }}>PR!</span>}
              </span>
            </div>
          );
        })}
        {exercises.length > 4 && <div style={{ fontSize: 12, color: COLORS.textDim, paddingTop: 4 }}>+{exercises.length - 4} more exercises</div>}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <button onClick={handleLike} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
            color: liked ? COLORS.red : COLORS.textDim, fontWeight: liked ? 600 : 400,
          }}>{liked ? "❤️" : "🤍"} {(workout.likes?.length || 0)}</button>
          <span style={{ fontSize: 13, color: COLORS.textDim }}>{"💬"} {workout.comments?.length || 0}</span>
        </div>
        <button onClick={handleSteel} style={{
          background: steeled ? `${COLORS.accent}33` : COLORS.accent, color: steeled ? COLORS.accent : COLORS.bg,
          border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          fontFamily: 'inherit', transition: 'all 0.2s',
        }}>{steeled ? "✓ Steeled!" : "📋 Steel it"}</button>
      </div>
    </div>
  );
}

export default function Feed({ onSteel, onProfile }) {
  const { feed, fetchFeed, profile } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeed().then(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!feed.length) return <EmptyState emoji="🏋️" title="No workouts yet" subtitle="Be the first to log a workout and show up in the feed!" />;

  return (
    <div>
      {feed.map(w => (
        <WorkoutCard key={w.id} workout={w} unitPref={profile?.unit_pref} onSteel={onSteel} onProfile={onProfile} />
      ))}
    </div>
  );
}
