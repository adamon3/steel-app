import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { COLORS, Avatar, Icon, Spinner, EmptyState, getInitials, formatVolume, timeAgo, convertWeight } from '../components/UI';

const FONTS = {
  sans: "'Inter Tight', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
};

// ═══════════════════════════════════════════════════════════════
// Comment section — inline below card
// ═══════════════════════════════════════════════════════════════

function CommentSection({ workoutId, initialCount, open, onToggle }) {
  const { user } = useStore();
  const [comments, setComments] = useState([]);
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

  useEffect(() => {
    if (open) fetchComments();
  }, [open]);

  const postComment = async () => {
    if (!newComment.trim() || !user) return;
    await supabase.from('comments').insert({ user_id: user.id, workout_id: workoutId, body: newComment.trim() });
    setNewComment('');
    fetchComments();
  };

  if (!open) return null;

  return (
    <div style={{ padding: '12px 16px 14px', borderTop: `0.5px solid ${COLORS.border}` }}>
      {loading ? (
        <div style={{ fontSize: 12, color: COLORS.textDim, fontFamily: FONTS.mono }}>Loading…</div>
      ) : (
        <>
          {comments.length === 0 && (
            <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 10, textAlign: 'center' }}>
              No comments yet
            </div>
          )}
          {comments.map(c => (
            <div key={c.id} style={{ marginBottom: 10, fontSize: 13, lineHeight: 1.4 }}>
              <span style={{ fontWeight: 700, color: COLORS.text, fontFamily: FONTS.sans }}>
                {c.profiles?.display_name}
              </span>
              <span style={{ color: COLORS.text, marginLeft: 8 }}>{c.body}</span>
              <div style={{
                fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
                marginTop: 2, letterSpacing: '0.04em',
              }}>
                {timeAgo(c.created_at).toUpperCase()}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <input
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Add a comment…"
              onKeyDown={e => e.key === 'Enter' && postComment()}
              style={{
                flex: 1, padding: '9px 12px', borderRadius: 999,
                border: `1px solid ${COLORS.border}`, background: COLORS.bg,
                color: COLORS.text, fontSize: 13, fontFamily: FONTS.sans, outline: 'none',
              }}
            />
            <button
              onClick={postComment}
              disabled={!newComment.trim()}
              style={{
                background: newComment.trim() ? COLORS.text : COLORS.card2,
                color: newComment.trim() ? COLORS.bg : COLORS.textDim,
                border: 'none', borderRadius: 999, padding: '9px 14px',
                fontWeight: 700, fontSize: 12, fontFamily: FONTS.sans,
                cursor: newComment.trim() ? 'pointer' : 'not-allowed',
                letterSpacing: '-0.01em',
              }}
            >Post</button>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Workout card
// ═══════════════════════════════════════════════════════════════

function WorkoutCard({ workout, onSteel, onProfile, unitPref }) {
  const { user, toggleLike } = useStore();
  const [liked, setLiked] = useState(false);
  const [steeled, setSteeled] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [likeCount, setLikeCount] = useState(workout.likes?.length || 0);
  const p = workout.profiles;

  useEffect(() => {
    if (user && workout.likes) setLiked(workout.likes.some(l => l.user_id === user.id));
  }, [workout.likes, user]);

  const handleLike = async () => {
    setLiked(!liked);
    setLikeCount(c => liked ? c - 1 : c + 1);
    await toggleLike(workout.id);
  };

  const handleSteel = () => {
    setSteeled(true);
    onSteel(workout);
    setTimeout(() => setSteeled(false), 2000);
  };

  const exercises = (workout.workout_exercises || []).sort((a, b) => a.sort_order - b.sort_order);
  const unit = unitPref || 'kg';
  const prCount = exercises.reduce((t, we) => t + (we.sets || []).filter(s => s.is_pr).length, 0);
  const totalVolume = convertWeight(workout.total_volume, unit);
  const volStr = totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : String(Math.round(totalVolume));

  return (
    <article style={{
      background: COLORS.card,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 16,
      marginBottom: 14,
      overflow: 'hidden',
    }}>
      {/* Header: avatar, name/gym, timestamp */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Avatar
            initials={getInitials(p?.display_name || '??')}
            colorIndex={p?.id?.charCodeAt(0) || 0}
            size={38}
            src={p?.avatar_url}
            onClick={() => onProfile?.(p?.id)}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              onClick={() => onProfile?.(p?.id)}
              style={{
                fontSize: 14, fontWeight: 700, color: COLORS.text,
                letterSpacing: '-0.01em', cursor: 'pointer',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >{p?.display_name}</div>
            <div style={{
              fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
              fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase',
              marginTop: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {timeAgo(workout.created_at).toUpperCase()}{p?.gym ? ` · ${p.gym}` : ''}{p?.sport ? ` · ${p.sport}` : ''}
            </div>
          </div>
        </div>

        {/* Workout title */}
        <div style={{
          fontSize: 20, fontWeight: 800, color: COLORS.text,
          letterSpacing: '-0.02em', marginBottom: 10,
        }}>
          {workout.title}
        </div>

        {/* Photo if present */}
        {workout.image_url && (
          <div style={{ marginBottom: 12, borderRadius: 12, overflow: 'hidden' }}>
            <img src={workout.image_url} alt=""
              style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }} />
          </div>
        )}

        {/* Notes if present */}
        {workout.notes && workout.notes.trim() && (
          <div style={{
            fontSize: 13, color: COLORS.text, marginBottom: 12, lineHeight: 1.45,
            paddingLeft: 10, borderLeft: `2px solid ${COLORS.border}`,
          }}>
            {workout.notes}
          </div>
        )}

        {/* Stats strip — mono, no dividers, horizontal scroll */}
        <div style={{
          display: 'flex', gap: 18, marginBottom: 14,
          paddingBottom: 12, borderBottom: `0.5px solid ${COLORS.border}`,
        }}>
          {workout.duration_mins > 0 && (
            <Stat label="DURATION" value={`${workout.duration_mins}`} suffix="m" />
          )}
          <Stat label={`VOLUME (${unit.toUpperCase()})`} value={volStr} />
          <Stat label="SETS" value={workout.total_sets || 0} />
          {prCount > 0 && <Stat label="PR" value={prCount} highlight />}
        </div>
      </div>

      {/* Exercise rows — table bones */}
      <div style={{ padding: '0 16px 12px' }}>
        {exercises.slice(0, 5).map((we) => {
          const sets = (we.sets || []).sort((a, b) => a.set_number - b.set_number);
          const topW = Math.max(...sets.map(s => s.weight), 0);
          const hasPr = sets.some(s => s.is_pr);
          return (
            <div key={we.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0', borderBottom: `0.5px solid ${COLORS.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                <span style={{
                  fontSize: 14, color: COLORS.text, fontWeight: 600,
                  letterSpacing: '-0.01em',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {we.exercises?.name}
                </span>
                {hasPr && (
                  <span style={{
                    background: '#BFE600', color: '#0A0A0A',
                    fontSize: 9, fontWeight: 700, padding: '2px 6px',
                    borderRadius: 4, letterSpacing: '0.05em', flexShrink: 0,
                  }}>PR</span>
                )}
              </div>
              <span style={{
                fontFamily: FONTS.mono, fontSize: 13, fontWeight: 600,
                color: COLORS.text, letterSpacing: '-0.02em', flexShrink: 0,
              }}>
                {sets.length} × {convertWeight(topW, unit)}<span style={{ color: COLORS.textDim, fontSize: 10, fontWeight: 500, marginLeft: 4 }}>{unit}</span>
              </span>
            </div>
          );
        })}
        {exercises.length > 5 && (
          <div style={{
            fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
            letterSpacing: '0.1em', textAlign: 'center',
            padding: '10px 0 0', textTransform: 'uppercase', fontWeight: 500,
          }}>
            + {exercises.length - 5} more
          </div>
        )}
      </div>

      {/* Actions bar */}
      <div style={{
        padding: '10px 16px', borderTop: `0.5px solid ${COLORS.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <button onClick={handleLike} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', gap: 5, fontFamily: FONTS.sans,
          }}>
            <Icon name={liked ? 'heartFill' : 'heart'} size={18}
              color={liked ? COLORS.text : COLORS.textDim} />
            <span style={{
              fontFamily: FONTS.mono, fontSize: 12, fontWeight: 600,
              color: liked ? COLORS.text : COLORS.textDim,
            }}>{likeCount}</span>
          </button>
          <button onClick={() => setShowComments(!showComments)} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <Icon name="comment" size={18} color={COLORS.textDim} />
            <span style={{
              fontFamily: FONTS.mono, fontSize: 12, fontWeight: 600, color: COLORS.textDim,
            }}>{workout.comments?.length || 0}</span>
          </button>
        </div>

        <button onClick={handleSteel} style={{
          background: steeled ? COLORS.card2 : COLORS.text,
          color: steeled ? COLORS.text : COLORS.bg,
          border: 'none', borderRadius: 999,
          padding: '7px 14px', fontWeight: 700, fontSize: 12,
          cursor: 'pointer', fontFamily: FONTS.sans, letterSpacing: '-0.01em',
          display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
        }}>
          <Icon name="copy" size={13} color={steeled ? COLORS.text : COLORS.bg} />
          {steeled ? 'Steeled' : 'Steel it'}
        </button>
      </div>

      <CommentSection
        workoutId={workout.id}
        initialCount={workout.comments?.length || 0}
        open={showComments}
      />
    </article>
  );
}

// Small stat used in the card strip
function Stat({ label, value, suffix, highlight }) {
  return (
    <div>
      <div style={{
        fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textDim,
        letterSpacing: '0.14em', fontWeight: 500,
      }}>{label}</div>
      <div style={{
        fontFamily: FONTS.mono, fontSize: 18, fontWeight: 700,
        color: highlight ? COLORS.text : COLORS.text,
        letterSpacing: '-0.03em', marginTop: 2,
        display: 'flex', alignItems: 'baseline', gap: 2,
      }}>
        {value}
        {suffix && <span style={{ color: COLORS.textDim, fontSize: 11, fontWeight: 500 }}>{suffix}</span>}
        {highlight && (
          <span style={{
            background: '#BFE600', color: '#0A0A0A',
            fontSize: 8, fontWeight: 700, padding: '1px 5px',
            borderRadius: 3, letterSpacing: '0.05em', marginLeft: 4,
            alignSelf: 'center',
          }}>PR</span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Feed
// ═══════════════════════════════════════════════════════════════

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
    } catch (e) { console.error(e); }
    setLoadingFollowing(false);
  };

  // For You sort
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
    <div style={{ fontFamily: FONTS.sans }}>
      {/* Feed tabs — mono caps, thin underline */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: `0.5px solid ${COLORS.border}`, marginBottom: 16,
      }}>
        {[
          { id: 'foryou', label: 'FOR YOU' },
          { id: 'following', label: 'FOLLOWING' },
        ].map(t => (
          <button key={t.id} onClick={() => setFeedTab(t.id)} style={{
            flex: 1, padding: '12px 4px', border: 'none', cursor: 'pointer',
            fontFamily: FONTS.mono, fontSize: 11, fontWeight: 600,
            letterSpacing: '0.14em', background: 'transparent',
            color: feedTab === t.id ? COLORS.text : COLORS.textDim,
            borderBottom: feedTab === t.id
              ? `2px solid ${COLORS.text}`
              : '2px solid transparent',
            marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {isLoading ? <Spinner /> : (
        activeFeed.length === 0 ? (
          <EmptyState
            icon={feedTab === 'following' ? 'users' : 'weight'}
            title={feedTab === 'following' ? 'No posts from who you follow' : 'No workouts yet'}
            subtitle={feedTab === 'following'
              ? 'Follow athletes to see them here'
              : 'Be the first to log a workout'}
          />
        ) : (
          activeFeed.map(w => (
            <WorkoutCard
              key={w.id}
              workout={w}
              unitPref={profile?.unit_pref}
              onSteel={onSteel}
              onProfile={onProfile}
            />
          ))
        )
      )}
    </div>
  );
}
