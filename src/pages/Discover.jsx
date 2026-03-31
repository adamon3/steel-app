import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { COLORS, Avatar, Badge, Spinner, EmptyState, getInitials, formatVolume, convertWeight } from '../components/UI';

const SPORT_FILTERS = ['All', 'Rugby', 'Skeleton', 'CrossFit', 'Bodybuilding', 'Powerlifting', 'Sprinting', 'Boxing', 'Swimming', 'Athletics', 'MMA', 'Football'];

export default function Discover({ onViewProfile }) {
  const { user } = useStore();
  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('All');
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState(new Set());

  // Fetch athletes
  useEffect(() => {
    fetchAthletes();
    fetchFollowing();
  }, []);

  const fetchFollowing = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);
    if (data) setFollowingIds(new Set(data.map(f => f.following_id)));
  };

  const fetchAthletes = async () => {
    setLoading(true);
    // Get all profiles with their workout counts and total volume
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user?.id || '')
      .order('created_at', { ascending: false });

    if (profiles) {
      // Get workout stats for each profile
      const enriched = await Promise.all(profiles.map(async (p) => {
        const { data: workouts } = await supabase
          .from('workouts')
          .select('id, total_volume, has_pr, created_at')
          .eq('user_id', p.id)
          .eq('is_public', true);

        const { count: followerCount } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', p.id);

        const totalWorkouts = workouts?.length || 0;
        const totalVolume = workouts?.reduce((sum, w) => sum + (Number(w.total_volume) || 0), 0) || 0;
        const lastWorkout = workouts?.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

        return {
          ...p,
          totalWorkouts,
          totalVolume,
          followers: followerCount || 0,
          lastWorkout: lastWorkout?.created_at,
        };
      }));

      setAthletes(enriched);
    }
    setLoading(false);
  };

  const handleFollow = async (targetId) => {
    if (!user) return;
    const isFollowing = followingIds.has(targetId);
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
      setFollowingIds(prev => { const n = new Set(prev); n.delete(targetId); return n; });
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId });
      setFollowingIds(prev => new Set(prev).add(targetId));
    }
  };

  // Filter athletes
  const filtered = athletes.filter(a => {
    const matchesSearch = search === '' ||
      a.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.username?.toLowerCase().includes(search.toLowerCase()) ||
      a.sport?.toLowerCase().includes(search.toLowerCase()) ||
      a.gym?.toLowerCase().includes(search.toLowerCase());
    const matchesSport = sportFilter === 'All' ||
      a.sport?.toLowerCase() === sportFilter.toLowerCase();
    return matchesSearch && matchesSport;
  });

  const daysAgo = (date) => {
    if (!date) return null;
    const d = Math.floor((Date.now() - new Date(date)) / 86400000);
    if (d === 0) return 'Today';
    if (d === 1) return 'Yesterday';
    if (d < 7) return `${d}d ago`;
    if (d < 30) return `${Math.floor(d / 7)}w ago`;
    return `${Math.floor(d / 30)}mo ago`;
  };

  return (
    <div>
      {/* Search */}
      <div style={{ marginBottom: 14 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search athletes, sports, gyms..."
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 12,
            border: `1px solid ${COLORS.border}`, background: COLORS.card,
            color: COLORS.text, fontSize: 14, fontFamily: 'inherit',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Sport filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {SPORT_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setSportFilter(s)}
            style={{
              padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit',
              background: sportFilter === s ? COLORS.accent : COLORS.card,
              color: sportFilter === s ? COLORS.bg : COLORS.textDim,
              transition: 'all 0.15s',
            }}
          >{s}</button>
        ))}
      </div>

      {/* Results */}
      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title={search ? 'No athletes found' : 'No one here yet'}
          subtitle={search ? 'Try a different search or sport filter' : 'Be the first to invite your gym mates!'}
        />
      ) : (
        filtered.map(athlete => {
          const isFollowing = followingIds.has(athlete.id);
          return (
            <div
              key={athlete.id}
              style={{
                background: COLORS.card, borderRadius: 14, padding: 14,
                marginBottom: 10, border: `1px solid ${COLORS.border}`,
                transition: 'all 0.15s',
              }}
            >
              {/* Top row - avatar, name, follow button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div onClick={() => onViewProfile(athlete.id)} style={{ cursor: 'pointer' }}>
                  <Avatar initials={getInitials(athlete.display_name)} size={48} colorIndex={athlete.id?.charCodeAt(0) || 0} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }} onClick={() => onViewProfile(athlete.id)} >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, cursor: 'pointer' }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: COLORS.text }}>{athlete.display_name}</span>
                    {athlete.sport && <Badge color={COLORS.orange}>{athlete.sport}</Badge>}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textDim }}>@{athlete.username}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleFollow(athlete.id); }}
                  style={{
                    padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 12,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                    background: isFollowing ? 'transparent' : COLORS.accent,
                    color: isFollowing ? COLORS.accent : COLORS.bg,
                    border: isFollowing ? `2px solid ${COLORS.accent}` : '2px solid transparent',
                  }}
                >{isFollowing ? 'Following' : 'Follow'}</button>
              </div>

              {/* Bio */}
              {athlete.bio && (
                <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 8, lineHeight: 1.4 }}>{athlete.bio}</div>
              )}

              {/* Gym */}
              {athlete.gym && (
                <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 4 }}>{"📍"} {athlete.gym}</div>
              )}

              {/* Stats row */}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <div style={{ flex: 1, background: `${COLORS.bg}88`, borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{athlete.totalWorkouts}</div>
                  <div style={{ fontSize: 10, color: COLORS.textDim }}>Workouts</div>
                </div>
                <div style={{ flex: 1, background: `${COLORS.bg}88`, borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{athlete.followers}</div>
                  <div style={{ fontSize: 10, color: COLORS.textDim }}>Followers</div>
                </div>
                <div style={{ flex: 1, background: `${COLORS.bg}88`, borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{formatVolume(athlete.totalVolume)}</div>
                  <div style={{ fontSize: 10, color: COLORS.textDim }}>Total kg</div>
                </div>
                {athlete.lastWorkout && (
                  <div style={{ flex: 1, background: `${COLORS.bg}88`, borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.accent }}>{daysAgo(athlete.lastWorkout)}</div>
                    <div style={{ fontSize: 10, color: COLORS.textDim }}>Last active</div>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
