import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { COLORS, Avatar, Badge, Icon, Spinner, EmptyState, getInitials, formatVolume, timeAgo, convertWeight } from '../components/UI';

function CommentSection({ workoutId, initialCount }) {
  const { user } = useStore();
  const [comments, setComments] = useState([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchComments = async () => {
    setLoading(true);
    const { data } = await supabase.from('comments')
      .select('*, profiles:user_id (display_name, username)')
      .eq('workout_id', workoutId).order('created_at', { ascending: true });
    if (data) setComments(data);
    setLoading(false);
  };

  const postComment = async () => {
    if (!newComment.trim() || !user) return;
    await supabase.from('comments').insert({ user_id: user.id, workout_id: workoutId, body: newComment.trim() });
    setNewComment('');
    fetchComments();
  };

  return (
    <div>
      <button onClick={() => { if (!showComments) fetchComments(); setShowComments(!showComments); }} style={{
        background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
        color: COLORS.textDim, display: 'flex', alignItems: 'center', gap: 4, padding: 0,
      }}>
        <Icon name="comment" size={16} color={COLORS.textDim} />
        <span>{comments.length || initialCount || 0}</span>
      </button>
      {showComments && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${COLORS.border}` }}>
          {loading ? <div style={{ fontSize: 12, color: COLORS.textDim }}>Loading...</div> : (
            <>
              {comments.map(c => (
                <div key={c.id} style={{ marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: COLORS.text }}>{c.profiles?.display_name}</span>
                  <span style={{ fontSize: 13, color: COLORS.textDim, marginLeft: 6 }}>{c.body}</span>
                  <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>{timeAgo(c.created_at)}</div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment..."
                  onKeyDown={e => e.key === 'Enter' && postComment()}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.bg, color: COLORS.text, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                <button onClick={postComment} style={{ background: COLORS.accent, color: COLORS.isDark ? COLORS.bg : '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Post</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function WorkoutCard({ workout, onSteel, onProfile, unitPref }) {
  const { user, toggleLike } = useStore();
  const [liked, setLiked] = useState(false);
  const [steeled, setSteeled] = useState(false);
  const [likeCount, setLikeCount] = useState(workout.likes?.length || 0);
  const p = workout.profiles;

  useEffect(() => {
    if (user && workout.likes) setLiked(workout.likes.some(l => l.user_id === user.id));
  }, [workout.likes, user]);

  const handleLike = async () => {
    setLiked(!liked); setLikeCount(c => liked ? c - 1 : c + 1); await toggleLike(workout.id);
  };
  const handleSteel = () => { setSteeled(true); onSteel(workout); setTimeout(() => setSteeled(false), 2000); };

  const exercises = (workout.workout_exercises || []).sort((a, b) => a.sort_order - b.sort_order);
  const unit = unitPref || 'kg';
  const prCount = exercises.reduce((t, we) => t + (we.sets || []).filter(s => s.is_pr).length, 0);

  return (
    <div style={{ background: COLORS.card, borderRadius: 16, marginBottom: 12, border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 0' }}>
        {/* User header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Avatar initials={getInitials(p?.display_name || '??')} colorIndex={p?.id?.charCodeAt(0) || 0} size={40} onClick={() => onProfile?.(p?.id)} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span onClick={() => onProfile?.(p?.id)} style={{ fontWeight: 700, color: COLORS.text, cursor: 'pointer', fontSize: 14 }}>{p?.display_name}</span>
              {p?.sport && <Badge color={COLORS.orange}>{p.sport}</Badge>}
            </div>
            <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 1 }}>{timeAgo(workout.created_at)}{p?.gym ? ` · ${p.gym}` : ''}</div>
          </div>
        </div>

        {/* Workout title */}
        <div style={{ fontWeight: 800, fontSize: 18, color: COLORS.text, marginBottom: 10 }}>{workout.title}</div>

        {/* Photo */}
        {workout.image_url && (
          <div style={{ marginBottom: 12, borderRadius: 12, overflow: 'hidden' }}>
            <img src={workout.image_url} alt="" style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }} />
          </div>
        )}

        {/* Note */}
        {workout.notes && workout.notes.trim() && (
          <div style={{ fontSize: 13, color: COLORS.text, marginBottom: 10, lineHeight: 1.4, fontStyle: 'italic' }}>
            "{workout.notes}"
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 14 }}>
          {[
            ...(workout.duration_mins > 0 ? [{ label: 'Duration', value: `${workout.duration_mins}m` }] : []),
            { label: `Volume (${unit})`, value: formatVolume(convertWeight(workout.total_volume, unit)) },
            { label: 'Sets', value: workout.total_sets },
            ...(prCount > 0 ? [{ label: 'PRs', value: prCount, highlight: true }] : []),
          ].map((s, i, arr) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', borderRight: i < arr.length - 1 ? `1px solid ${COLORS.border}` : 'none', padding: '0 8px' }}>
              <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: s.highlight ? COLORS.pro : COLORS.text }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Exercise list — FIX #20: Redesigned with rounded cards, better hierarchy */}
      <div style={{ padding: '0 16px 12px' }}>
        <div style={{ background: `${COLORS.bg}80`, borderRadius: 12, overflow: 'hidden', border: `1px solid ${COLORS.border}44` }}>
          {exercises.slice(0, 4).map((we, i) => {
            const sets = (we.sets || []).sort((a, b) => a.set_number - b.set_number);
            const topW = Math.max(...sets.map(s => s.weight), 0);
            const hasPr = sets.some(s => s.is_pr);
            return (
              <div key={we.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 12px',
                borderBottom: i < Math.min(exercises.length, 4) - 1 ? `1px solid ${COLORS.border}33` : 'none',
                background: hasPr ? `${COLORS.pro}08` : 'transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, color: COLORS.text, fontWeight: 600 }}>{we.exercises?.name}</span>
                  {hasPr && <span style={{ background: `${COLORS.pro}20`, color: COLORS.pro, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>PR</span>}
                </div>
                <span style={{ fontSize: 13, color: COLORS.textDim, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{sets.length} x {convertWeight(topW, unit)}{unit}</span>
              </div>
            );
          })}
        </div>
        {exercises.length > 4 && <div style={{ fontSize: 12, color: COLORS.textDim, paddingTop: 8, textAlign: 'center' }}>+{exercises.length - 4} more exercises</div>}
      </div>

      {/* FIX #19: Footer with proper layout — comment and like on left, Steel It on right, no overlap */}
      <div style={{ padding: '10px 16px', borderTop: `1px solid ${COLORS.border}`, background: `${COLORS.bg}40` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          {/* Left: like + comment */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flex: 1, minWidth: 0 }}>
            <button onClick={handleLike} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
              <Icon name={liked ? 'heartFill' : 'heart'} size={18} color={liked ? COLORS.red : COLORS.textDim} />
              <span style={{ fontSize: 13, color: liked ? COLORS.red : COLORS.textDim, fontWeight: liked ? 600 : 400 }}>{likeCount}</span>
            </button>
            <CommentSection workoutId={workout.id} initialCount={workout.comments?.length || 0} />
          </div>
          {/* Right: Steel It — fixed width, no overlap */}
          <button onClick={handleSteel} style={{
            background: steeled ? `${COLORS.accent}22` : COLORS.accent,
            color: steeled ? COLORS.accent : (COLORS.isDark ? COLORS.bg : '#fff'),
            border: steeled ? `1px solid ${COLORS.accent}44` : 'none',
            borderRadius: 8, padding: '7px 14px',
            fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, whiteSpace: 'nowrap',
          }}>
            <Icon name="copy" size={14} color={steeled ? COLORS.accent : (COLORS.isDark ? COLORS.bg : '#fff')} />{steeled ? 'Steeled!' : 'Steel it'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Feed({ onSteel, onProfile }) {
  const { feed, fetchFeed, profile, user } = useStore();
  const [loading, setLoading] = useState(true);
  const [feedTab, setFeedTab] = useState('foryou');
  const [followingFeed, setFollowingFeed] = useState([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);

  useEffect(() => { fetchFeed().then(() => setLoading(false)); }, []);

  useEffect(() => {
    if (feedTab === 'following' && user) loadFollowingFeed();
  }, [feedTab, user]);

  const loadFollowingFeed = async () => {
    if (!user) return;
    setLoadingFollowing(true);
    try {
      const { data: follows } = await supabase.from('follows').select('following_id').eq('follower_id', user.id);
      const followIds = (follows || []).map(f => f.following_id);
      followIds.push(user.id);

      if (followIds.length > 1) {
        const { data } = await supabase.from('workouts')
          .select('*, profiles:user_id (id, username, display_name, sport, gym, avatar_url), workout_exercises (id, sort_order, notes, exercises:exercise_id (id, name, muscle_group), sets (id, set_number, weight, reps, is_pr, set_type)), likes (user_id), comments (id)')
          .in('user_id', followIds).eq('is_public', true)
          .order('created_at', { ascending: false }).limit(20);
        setFollowingFeed(data || []);
      } else {
        setFollowingFeed([]);
      }
    } catch (e) { console.error('Following feed error:', e); }
    setLoadingFollowing(false);
  };

  const sortedForYou = [...feed].sort((a, b) => {
    let scoreA = 0, scoreB = 0;
    if (profile?.sport && a.profiles?.sport === profile.sport) scoreA += 3;
    if (profile?.sport && b.profiles?.sport === profile.sport) scoreB += 3;
    if (profile?.gym && a.profiles?.gym === profile.gym) scoreA += 5;
    if (profile?.gym && b.profiles?.gym === profile.gym) scoreB += 5;
    if (a.has_pr) scoreA += 2;
    if (b.has_pr) scoreB += 2;
    scoreA += (a.likes?.length || 0) * 0.5;
    scoreB += (b.likes?.length || 0) * 0.5;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const activeFeed = feedTab === 'following' ? followingFeed : sortedForYou;
  const isLoading = feedTab === 'following' ? loadingFollowing : loading;

  return (
    <div>
      {/* Feed tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 14 }}>
        {[
          { id: 'foryou', label: 'For You' },
          { id: 'following', label: 'Following' },
        ].map(t => (
          <button key={t.id} onClick={() => setFeedTab(t.id)} style={{
            flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            fontFamily: 'inherit', background: 'transparent',
            color: feedTab === t.id ? COLORS.accent : COLORS.textDim,
            borderBottom: feedTab === t.id ? `2px solid ${COLORS.accent}` : '2px solid transparent',
            marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {isLoading ? <Spinner /> : (
        activeFeed.length === 0 ? (
          <EmptyState
            icon={feedTab === 'following' ? 'users' : 'weight'}
            title={feedTab === 'following' ? 'No posts from people you follow' : 'No workouts yet'}
            subtitle={feedTab === 'following' ? 'Follow athletes from the Discover tab to see their workouts here' : 'Be the first to log a workout and show up in the feed!'}
          />
        ) : (
          activeFeed.map(w => <WorkoutCard key={w.id} workout={w} unitPref={profile?.unit_pref} onSteel={onSteel} onProfile={onProfile} />)
        )
      )}
    </div>
  );
}
