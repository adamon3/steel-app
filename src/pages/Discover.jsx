import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { COLORS, Avatar, Icon, Spinner, EmptyState, SPORTS, getInitials, formatVolume } from '../components/UI';

const FONTS = {
  sans: "'Inter Tight', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
};

function daysAgo(date) {
  if (!date) return null;
  const d = Math.floor((Date.now() - new Date(date)) / 86400000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d`;
  if (d < 30) return `${Math.floor(d / 7)}w`;
  return `${Math.floor(d / 30)}mo`;
}

export default function Discover({ onViewProfile }) {
  const { user } = useStore();
  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('All');
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState(new Set());

  useEffect(() => { fetchAthletes(); fetchFollowing(); }, []);

  const fetchFollowing = async () => {
    if (!user) return;
    const { data } = await supabase.from('follows').select('following_id').eq('follower_id', user.id);
    if (data) setFollowingIds(new Set(data.map(f => f.following_id)));
  };

  const fetchAthletes = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from('profiles').select('*')
      .neq('id', user?.id || '').order('created_at', { ascending: false });
    if (profiles) {
      const enriched = await Promise.all(profiles.map(async (p) => {
        const { data: workouts } = await supabase.from('workouts')
          .select('id, total_volume, created_at').eq('user_id', p.id).eq('is_public', true);
        const { count: followerCount } = await supabase.from('follows')
          .select('*', { count: 'exact', head: true }).eq('following_id', p.id);
        const totalWorkouts = workouts?.length || 0;
        const totalVolume = workouts?.reduce((s, w) => s + (Number(w.total_volume) || 0), 0) || 0;
        const lastWorkout = workouts?.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
        return { ...p, totalWorkouts, totalVolume, followers: followerCount || 0, lastWorkout: lastWorkout?.created_at };
      }));
      setAthletes(enriched);
    }
    setLoading(false);
  };

  const handleFollow = async (targetId) => {
    if (!user) return;
    if (followingIds.has(targetId)) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
      setFollowingIds(prev => { const n = new Set(prev); n.delete(targetId); return n; });
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId });
      setFollowingIds(prev => new Set(prev).add(targetId));
    }
  };

  const filtered = athletes.filter(a => {
    const matchesSearch = search === '' ||
      a.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.username?.toLowerCase().includes(search.toLowerCase()) ||
      a.sport?.toLowerCase().includes(search.toLowerCase()) ||
      a.gym?.toLowerCase().includes(search.toLowerCase());
    const matchesSport = sportFilter === 'All' || a.sport?.toLowerCase() === sportFilter.toLowerCase();
    return matchesSearch && matchesSport;
  });

  return (
    <div style={{ fontFamily: FONTS.sans }}>
      <h1 style={{
        fontSize: 22, fontWeight: 800, color: COLORS.text,
        letterSpacing: '-0.02em', margin: '0 0 14px',
      }}>Discover</h1>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}>
          <Icon name="search" size={16} color={COLORS.textDim} />
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search athletes, sports, gyms…"
          style={{
            width: '100%', padding: '12px 14px 12px 40px', borderRadius: 12,
            border: `1px solid ${COLORS.border}`, background: COLORS.card,
            color: COLORS.text, fontSize: 14, fontFamily: FONTS.sans,
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Sport filters */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 16,
        overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none',
      }}>
        {['All', ...SPORTS].map(s => (
          <button key={s} onClick={() => setSportFilter(s)} style={{
            padding: '7px 14px', borderRadius: 999,
            border: `1px solid ${sportFilter === s ? COLORS.text : COLORS.border}`,
            cursor: 'pointer', whiteSpace: 'nowrap',
            fontSize: 12, fontWeight: 600, fontFamily: FONTS.sans, letterSpacing: '-0.01em',
            background: sportFilter === s ? COLORS.text : 'transparent',
            color: sportFilter === s ? COLORS.bg : COLORS.text,
          }}>{s}</button>
        ))}
      </div>

      {/* Results */}
      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon="search"
          title={search ? 'No athletes found' : 'No one here yet'}
          subtitle={search ? 'Try a different search' : 'Invite your gym mates to join'} />
      ) : (
        filtered.map(athlete => {
          const isFollowing = followingIds.has(athlete.id);
          const vol = athlete.totalVolume;
          const volStr = vol >= 1000 ? `${(vol / 1000).toFixed(1)}k` : String(Math.round(vol));
          return (
            <div key={athlete.id} style={{
              background: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 10,
              border: `1px solid ${COLORS.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div onClick={() => onViewProfile(athlete.id)} style={{ cursor: 'pointer' }}>
                  <Avatar
                    initials={getInitials(athlete.display_name)}
                    size={48}
                    colorIndex={athlete.id?.charCodeAt(0) || 0}
                    src={athlete.avatar_url}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onViewProfile(athlete.id)}>
                  <div style={{
                    fontSize: 15, fontWeight: 700, color: COLORS.text, letterSpacing: '-0.01em',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{athlete.display_name}</div>
                  <div style={{
                    fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
                    marginTop: 2, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    @{athlete.username}
                    {athlete.sport && ` · ${athlete.sport}`}
                    {athlete.gym && ` · ${athlete.gym}`}
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleFollow(athlete.id); }} style={{
                  padding: '7px 14px', borderRadius: 999,
                  fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  fontFamily: FONTS.sans, letterSpacing: '-0.01em', flexShrink: 0,
                  background: isFollowing ? 'transparent' : COLORS.text,
                  color: isFollowing ? COLORS.text : COLORS.bg,
                  border: `1px solid ${COLORS.text}`,
                }}>{isFollowing ? 'Following' : 'Follow'}</button>
              </div>

              {athlete.bio && (
                <div style={{
                  fontSize: 13, color: COLORS.text, marginTop: 10, lineHeight: 1.4,
                }}>{athlete.bio}</div>
              )}

              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
                marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${COLORS.border}`,
              }}>
                {[
                  { v: athlete.totalWorkouts, l: 'Workouts' },
                  { v: athlete.followers, l: 'Followers' },
                  { v: volStr, l: 'Volume kg' },
                  ...(athlete.lastWorkout ? [{ v: daysAgo(athlete.lastWorkout), l: 'Last' }] : []),
                ].map((s, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{
                      fontFamily: FONTS.mono, fontSize: 15, fontWeight: 700,
                      color: COLORS.text, letterSpacing: '-0.02em',
                    }}>{s.v}</div>
                    <div style={{
                      fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textDim,
                      letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500,
                      marginTop: 2,
                    }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
