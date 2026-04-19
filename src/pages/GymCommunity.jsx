import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { COLORS, Avatar, Icon, Spinner, EmptyState, getInitials, formatVolume, timeAgo, convertWeight } from '../components/UI';

const FONTS = {
  sans: "'Inter Tight', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
};

export default function GymCommunity({ onViewProfile }) {
  const { user, profile, updateProfile } = useStore();
  const [gyms, setGyms] = useState([]);
  const [myGymData, setMyGymData] = useState(null);
  const [gymFeed, setGymFeed] = useState([]);
  const [gymMembers, setGymMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [subTab, setSubTab] = useState('feed');
  const unit = profile?.unit_pref || 'kg';

  useEffect(() => { loadData(); }, [profile?.gym]);

  const loadData = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from('profiles').select('gym').neq('gym', '').not('gym', 'is', null);
    if (profiles) {
      const gymCounts = {};
      profiles.forEach(p => { if (p.gym) gymCounts[p.gym] = (gymCounts[p.gym] || 0) + 1; });
      setGyms(Object.entries(gymCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })));
    }

    if (profile?.gym) {
      const { data: members } = await supabase.from('profiles')
        .select('id, display_name, username, sport, avatar_url')
        .eq('gym', profile.gym).neq('id', user?.id || '');
      if (members) setGymMembers(members);

      const { data: memberProfiles } = await supabase.from('profiles').select('id').eq('gym', profile.gym);
      if (memberProfiles) {
        const memberIds = memberProfiles.map(m => m.id);
        const { data: workouts } = await supabase.from('workouts')
          .select('*, profiles:user_id (id, display_name, username, sport, avatar_url), workout_exercises (id, sort_order, exercises:exercise_id (id, name), sets (id, weight, reps, is_pr))')
          .in('user_id', memberIds).eq('is_public', true)
          .order('created_at', { ascending: false }).limit(15);
        if (workouts) setGymFeed(workouts);
      }
      setMyGymData({ name: profile.gym, members: (members?.length || 0) + 1 });
    }
    setLoading(false);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }
    const matching = gyms.filter(g => g.name.toLowerCase().includes(query.toLowerCase()));
    const exactMatch = gyms.find(g => g.name.toLowerCase() === query.toLowerCase());
    const results = matching.map(g => ({ name: g.name, members: g.count, source: 'steel' }));
    if (!exactMatch && query.length >= 3) {
      results.push({ name: query, members: 0, source: 'new' });
    }
    setSearchResults(results);
  };

  const handleJoinGym = async (gymName) => {
    await updateProfile({ gym: gymName });
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleLeaveGym = async () => {
    await updateProfile({ gym: '' });
    setMyGymData(null);
    setGymFeed([]);
    setGymMembers([]);
  };

  if (loading) return <Spinner />;

  // ── No gym: gym finder ──
  if (!profile?.gym) {
    return (
      <div style={{ fontFamily: FONTS.sans }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: COLORS.text, letterSpacing: '-0.02em', margin: '0 0 4px' }}>
          Gym community
        </h1>
        <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 18, lineHeight: 1.5 }}>
          Join your gym to see what others are lifting and compete on leaderboards.
        </div>

        <div style={{ position: 'relative', marginBottom: 16 }}>
          <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}>
            <Icon name="search" size={16} color={COLORS.textDim} />
          </div>
          <input
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search for your gym…"
            style={{
              width: '100%', padding: '12px 14px 12px 40px', borderRadius: 12,
              border: `1px solid ${COLORS.border}`, background: COLORS.card,
              color: COLORS.text, fontSize: 14, fontFamily: FONTS.sans,
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {searchResults.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {searchResults.map((r, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: COLORS.card, borderRadius: 12, padding: '12px 14px', marginBottom: 6,
                border: `1px solid ${r.source === 'new' ? '#BFE60044' : COLORS.border}`,
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, letterSpacing: '-0.01em' }}>
                    {r.name}
                  </div>
                  <div style={{
                    fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim, marginTop: 3,
                    letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500,
                  }}>
                    {r.source === 'new'
                      ? <span style={{ color: '#BFE600' }}>CREATE NEW GYM</span>
                      : <>{r.members} MEMBER{r.members !== 1 ? 'S' : ''}</>}
                  </div>
                </div>
                <button onClick={() => handleJoinGym(r.name)} style={{
                  padding: '8px 16px', borderRadius: 999, border: 'none',
                  background: COLORS.text, color: COLORS.bg,
                  fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  fontFamily: FONTS.sans, letterSpacing: '-0.01em',
                }}>{r.source === 'new' ? 'Create' : 'Join'}</button>
              </div>
            ))}
          </div>
        )}

        {!searchQuery && gyms.length > 0 && (
          <>
            <div style={{
              fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
              letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500,
              marginBottom: 10,
            }}>Popular gyms</div>
            {gyms.slice(0, 10).map(g => (
              <div key={g.name} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: COLORS.card, borderRadius: 12, padding: '12px 14px', marginBottom: 6,
                border: `1px solid ${COLORS.border}`,
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, letterSpacing: '-0.01em' }}>
                    {g.name}
                  </div>
                  <div style={{
                    fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim, marginTop: 3,
                    letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500,
                  }}>
                    {g.count} MEMBER{g.count !== 1 ? 'S' : ''}
                  </div>
                </div>
                <button onClick={() => handleJoinGym(g.name)} style={{
                  padding: '8px 16px', borderRadius: 999, border: 'none',
                  background: COLORS.text, color: COLORS.bg,
                  fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  fontFamily: FONTS.sans, letterSpacing: '-0.01em',
                }}>Join</button>
              </div>
            ))}
          </>
        )}

        {!searchQuery && gyms.length === 0 && (
          <EmptyState
            icon="pin"
            title="Be the first"
            subtitle="Type your gym name above to create the first community"
          />
        )}
      </div>
    );
  }

  // ── Has gym: show community ──
  return (
    <div style={{ fontFamily: FONTS.sans }}>
      {/* Gym header */}
      <div style={{
        background: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 14,
        border: `1px solid ${COLORS.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div>
          <div style={{
            fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
            letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500,
            marginBottom: 4,
          }}>Gym</div>
          <div style={{
            fontSize: 22, fontWeight: 800, color: COLORS.text, letterSpacing: '-0.02em',
          }}>{profile.gym}</div>
          <div style={{
            fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textDim, marginTop: 4,
            letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500,
          }}>
            {myGymData?.members || 1} MEMBER{(myGymData?.members || 1) !== 1 ? 'S' : ''}
          </div>
        </div>
        <button onClick={handleLeaveGym} style={{
          background: 'none', border: `1px solid ${COLORS.border}`, borderRadius: 999,
          padding: '6px 12px', cursor: 'pointer',
          fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
          letterSpacing: '0.1em', fontWeight: 500, textTransform: 'uppercase',
        }}>Leave</button>
      </div>

      {/* Sub tabs */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: `0.5px solid ${COLORS.border}`,
        marginBottom: 14,
      }}>
        {['feed', 'members'].map(t => (
          <button key={t} onClick={() => setSubTab(t)} style={{
            flex: 1, padding: '12px 4px', border: 'none', cursor: 'pointer',
            fontFamily: FONTS.mono, fontSize: 11, fontWeight: 600,
            letterSpacing: '0.14em', background: 'transparent',
            color: subTab === t ? COLORS.text : COLORS.textDim,
            borderBottom: subTab === t
              ? `2px solid ${COLORS.text}`
              : '2px solid transparent',
            marginBottom: -1,
          }}>
            {t === 'feed' ? `FEED · ${gymFeed.length}` : `MEMBERS · ${gymMembers.length}`}
          </button>
        ))}
      </div>

      {subTab === 'feed' && (
        gymFeed.length === 0 ? (
          <EmptyState icon="weight" title="No gym activity yet" subtitle="Be the first to log a workout here" />
        ) : (
          gymFeed.map(w => {
            const exercises = (w.workout_exercises || []).sort((a, b) => a.sort_order - b.sort_order);
            const p = w.profiles;
            const vol = convertWeight(w.total_volume, unit);
            const volStr = vol >= 1000 ? `${(vol / 1000).toFixed(1)}k` : String(Math.round(vol));
            return (
              <div key={w.id} style={{
                background: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10,
                border: `1px solid ${COLORS.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <Avatar
                    initials={getInitials(p?.display_name || '??')}
                    size={36}
                    colorIndex={p?.id?.charCodeAt(0) || 0}
                    src={p?.avatar_url}
                    onClick={() => onViewProfile?.(p?.id)}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      onClick={() => onViewProfile?.(p?.id)}
                      style={{
                        fontSize: 14, fontWeight: 700, color: COLORS.text, cursor: 'pointer',
                        letterSpacing: '-0.01em',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >{p?.display_name}</div>
                    <div style={{
                      fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
                      letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500, marginTop: 2,
                    }}>{timeAgo(w.created_at).toUpperCase()}</div>
                  </div>
                  {w.has_pr && (
                    <span style={{
                      background: '#BFE600', color: '#0A0A0A',
                      fontSize: 9, fontWeight: 700, padding: '2px 6px',
                      borderRadius: 4, letterSpacing: '0.05em',
                    }}>PR</span>
                  )}
                </div>

                <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, letterSpacing: '-0.01em', marginBottom: 6 }}>
                  {w.title}
                </div>

                <div style={{
                  fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textDim,
                  letterSpacing: '0.06em', marginBottom: 8,
                }}>
                  {w.duration_mins > 0 && `${w.duration_mins}M · `}
                  {volStr} {unit.toUpperCase()} · {w.total_sets} SETS
                </div>

                <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.5 }}>
                  {exercises.map(we => we.exercises?.name).filter(Boolean).join(' · ')}
                </div>
              </div>
            );
          })
        )
      )}

      {subTab === 'members' && (
        gymMembers.length === 0 ? (
          <EmptyState icon="users" title="Just you so far" subtitle="Invite your gym mates to join" />
        ) : (
          gymMembers.map(m => (
            <div key={m.id} onClick={() => onViewProfile?.(m.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 4px',
              borderBottom: `0.5px solid ${COLORS.border}`,
              cursor: 'pointer',
            }}>
              <Avatar
                initials={getInitials(m.display_name)}
                size={40}
                colorIndex={m.id?.charCodeAt(0) || 0}
                src={m.avatar_url}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 700, color: COLORS.text, letterSpacing: '-0.01em',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{m.display_name}</div>
                <div style={{
                  fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
                  letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500, marginTop: 2,
                }}>
                  @{m.username}{m.sport ? ` · ${m.sport}` : ''}
                </div>
              </div>
              <Icon name="back" size={14} color={COLORS.textDim} />
            </div>
          ))
        )
      )}
    </div>
  );
}
