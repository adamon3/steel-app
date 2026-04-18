import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { COLORS, Avatar, Badge, Icon, Spinner, EmptyState, getInitials, formatVolume, timeAgo, convertWeight } from '../components/UI';

export default function GymCommunity({ onViewProfile }) {
  const { user, profile, updateProfile } = useStore();
  const [gyms, setGyms] = useState([]);
  const [myGymData, setMyGymData] = useState(null);
  const [gymFeed, setGymFeed] = useState([]);
  const [gymMembers, setGymMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [subTab, setSubTab] = useState('feed');
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const unit = profile?.unit_pref || 'kg';

  useEffect(() => { loadData(); }, [profile?.gym]);

  const loadData = async () => {
    setLoading(true);
    // Get all gyms with their location + member counts
    const { data: profiles } = await supabase
      .from('profiles')
      .select('gym, country, region, city')
      .neq('gym', '')
      .not('gym', 'is', null);
    if (profiles) {
      const gymMap = {};
      profiles.forEach(p => {
        if (!p.gym) return;
        if (!gymMap[p.gym]) {
          gymMap[p.gym] = { name: p.gym, count: 0, country: p.country || 'Unknown', region: p.region || 'Unknown', city: p.city || '' };
        }
        gymMap[p.gym].count++;
      });
      setGyms(Object.values(gymMap).sort((a, b) => b.count - a.count));
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

  // Derived: unique countries & regions for filter dropdowns
  const countries = React.useMemo(() => {
    const s = new Set(gyms.map(g => g.country).filter(c => c && c !== 'Unknown'));
    return ['all', ...Array.from(s).sort()];
  }, [gyms]);

  const regions = React.useMemo(() => {
    if (selectedCountry === 'all') return ['all'];
    const s = new Set(gyms.filter(g => g.country === selectedCountry).map(g => g.region).filter(r => r && r !== 'Unknown'));
    return ['all', ...Array.from(s).sort()];
  }, [gyms, selectedCountry]);

  // Filtered gym list
  const filteredGyms = React.useMemo(() => {
    return gyms.filter(g => {
      if (selectedCountry !== 'all' && g.country !== selectedCountry) return false;
      if (selectedRegion !== 'all' && g.region !== selectedRegion) return false;
      return true;
    });
  }, [gyms, selectedCountry, selectedRegion]);

  // Search for gyms — searches both existing Steel gyms and uses the input as a direct name
  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }
    setSearching(true);

    // Search within currently filtered gyms
    const matchingGyms = filteredGyms.filter(g =>
      g.name.toLowerCase().includes(query.toLowerCase())
    );

    const exactMatch = filteredGyms.find(g => g.name.toLowerCase() === query.toLowerCase());
    const results = [
      ...matchingGyms.map(g => ({ name: g.name, members: g.count, country: g.country, region: g.region, city: g.city, source: 'steel' })),
    ];

    if (!exactMatch && query.length >= 3) {
      results.push({ name: query, members: 0, source: 'new' });
    }

    setSearchResults(results);
    setSearching(false);
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

  // ── NO GYM — Show gym finder ──
  if (!profile?.gym) {
    return (
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text, marginBottom: 4 }}>Gym Communities</div>
        <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 16, lineHeight: 1.5 }}>
          Join your gym to see what others are lifting and compete on leaderboards
        </div>

        {/* Country / Region filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <select
            value={selectedCountry}
            onChange={e => { setSelectedCountry(e.target.value); setSelectedRegion('all'); }}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 10,
              border: `1px solid ${COLORS.border}`, background: COLORS.card,
              color: COLORS.text, fontSize: 13, fontFamily: 'inherit', outline: 'none',
              appearance: 'none', cursor: 'pointer',
            }}
          >
            {countries.map(c => (
              <option key={c} value={c}>{c === 'all' ? 'All countries' : c}</option>
            ))}
          </select>
          <select
            value={selectedRegion}
            onChange={e => setSelectedRegion(e.target.value)}
            disabled={selectedCountry === 'all'}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 10,
              border: `1px solid ${COLORS.border}`, background: COLORS.card,
              color: selectedCountry === 'all' ? COLORS.textDim : COLORS.text,
              fontSize: 13, fontFamily: 'inherit', outline: 'none',
              appearance: 'none', cursor: selectedCountry === 'all' ? 'not-allowed' : 'pointer',
              opacity: selectedCountry === 'all' ? 0.5 : 1,
            }}
          >
            {regions.map(r => (
              <option key={r} value={r}>{r === 'all' ? 'All regions' : r}</option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <div style={{ position: 'absolute', left: 12, top: 12 }}>
            <Icon name="search" size={18} color={COLORS.textDim} />
          </div>
          <input value={searchQuery} onChange={e => handleSearch(e.target.value)}
            placeholder="Search for your gym..."
            style={{
              width: '100%', padding: '12px 14px 12px 38px', borderRadius: 12,
              border: `1px solid ${COLORS.border}`, background: COLORS.card,
              color: COLORS.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
            }} />
        </div>

        {/* Search results */}
        {searchResults.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {searchResults.map((r, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: COLORS.card, borderRadius: 12, padding: '12px 14px', marginBottom: 6,
                border: `1px solid ${r.source === 'new' ? `${COLORS.accent}33` : COLORS.border}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 2 }}>
                    {r.source === 'new' ? (
                      <span style={{ color: COLORS.accent }}>Create new gym community</span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Icon name="users" size={11} color={COLORS.textDim} /> {r.members} member{r.members !== 1 ? 's' : ''}
                        </span>
                        {r.city && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Icon name="pin" size={11} color={COLORS.textDim} /> {r.city}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => handleJoinGym(r.name)} style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none',
                  background: r.source === 'new' ? `${COLORS.accent}20` : COLORS.accent,
                  color: r.source === 'new' ? COLORS.accent : (COLORS.isDark ? COLORS.bg : '#fff'),
                  fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                }}>{r.source === 'new' ? 'Create & Join' : 'Join'}</button>
              </div>
            ))}
          </div>
        )}

        {/* Popular gyms */}
        {!searchQuery && filteredGyms.length > 0 && (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>
              {selectedCountry === 'all' ? 'Popular Gyms on Steel' : `Gyms in ${selectedRegion === 'all' ? selectedCountry : selectedRegion}`}
            </div>
            {filteredGyms.slice(0, 20).map(g => (
              <div key={g.name} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: COLORS.card, borderRadius: 12, padding: '12px 14px', marginBottom: 6,
                border: `1px solid ${COLORS.border}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
                  <div style={{ fontSize: 12, color: COLORS.textDim, display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Icon name="users" size={11} color={COLORS.textDim} /> {g.count} member{g.count !== 1 ? 's' : ''}
                    </span>
                    {g.city && g.country && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Icon name="pin" size={11} color={COLORS.textDim} /> {g.city}, {g.country}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => handleJoinGym(g.name)} style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none', background: COLORS.accent,
                  color: COLORS.isDark ? COLORS.bg : '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  marginLeft: 8, flexShrink: 0,
                }}>Join</button>
              </div>
            ))}
          </>
        )}

        {/* No gyms in selected filter */}
        {!searchQuery && filteredGyms.length === 0 && gyms.length > 0 && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Icon name="pin" size={32} color={COLORS.textDim} />
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginTop: 8 }}>No gyms in this area yet</div>
            <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 4 }}>Try a different filter or search for your gym</div>
          </div>
        )}

        {/* Tip */}
        {!searchQuery && gyms.length === 0 && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Icon name="pin" size={32} color={COLORS.textDim} />
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginTop: 8 }}>Be the first!</div>
            <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 4 }}>Type your gym name above to create the first community</div>
          </div>
        )}
      </div>
    );
  }

  // ── HAS GYM — Show gym community ──
  return (
    <div>
      {/* Gym header */}
      <div style={{
        background: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 14,
        border: `1px solid ${COLORS.border}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Icon name="pin" size={18} color={COLORS.accent} />
              <span style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>{profile.gym}</span>
            </div>
            <div style={{ fontSize: 13, color: COLORS.textDim, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon name="users" size={14} color={COLORS.textDim} /> {myGymData?.members || 1} member{(myGymData?.members || 1) !== 1 ? 's' : ''}
            </div>
          </div>
          <button onClick={handleLeaveGym} style={{
            background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8,
            padding: '6px 10px', cursor: 'pointer', fontSize: 11, color: COLORS.textDim, fontFamily: 'inherit',
          }}>Leave</button>
        </div>
      </div>

      {/* Sub tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 14 }}>
        {['feed', 'members'].map(t => (
          <button key={t} onClick={() => setSubTab(t)} style={{
            flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            fontFamily: 'inherit', background: 'transparent',
            color: subTab === t ? COLORS.accent : COLORS.textDim,
            borderBottom: subTab === t ? `2px solid ${COLORS.accent}` : '2px solid transparent',
            marginBottom: -1, textTransform: 'capitalize',
          }}>{t === 'feed' ? `Gym Feed (${gymFeed.length})` : `Members (${gymMembers.length})`}</button>
        ))}
      </div>

      {/* Gym Feed */}
      {subTab === 'feed' && (
        gymFeed.length === 0 ? (
          <EmptyState icon="weight" title="No gym activity yet" subtitle="Be the first to log a workout at your gym!" />
        ) : (
          gymFeed.map(w => {
            const exercises = (w.workout_exercises || []).sort((a, b) => a.sort_order - b.sort_order);
            const p = w.profiles;
            return (
              <div key={w.id} style={{ background: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, border: `1px solid ${COLORS.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Avatar initials={getInitials(p?.display_name || '??')} size={36} colorIndex={p?.id?.charCodeAt(0) || 0} onClick={() => onViewProfile?.(p?.id)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.text, cursor: 'pointer' }} onClick={() => onViewProfile?.(p?.id)}>{p?.display_name}</div>
                    <div style={{ fontSize: 12, color: COLORS.textDim }}>{timeAgo(w.created_at)}</div>
                  </div>
                  {w.has_pr && <Badge color={COLORS.pro}>PR</Badge>}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.text, marginBottom: 6 }}>{w.title}</div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
                  {w.duration_mins > 0 && <span style={{ fontSize: 12, color: COLORS.textDim }}><Icon name="clock" size={12} color={COLORS.textDim} /> {w.duration_mins}m</span>}
                  <span style={{ fontSize: 12, color: COLORS.textDim }}>{formatVolume(convertWeight(w.total_volume, unit))} {unit}</span>
                  <span style={{ fontSize: 12, color: COLORS.textDim }}>{w.total_sets} sets</span>
                </div>
                <div style={{ fontSize: 12, color: COLORS.textDim }}>{exercises.map(we => we.exercises?.name).filter(Boolean).join(', ')}</div>
              </div>
            );
          })
        )
      )}

      {/* Members */}
      {subTab === 'members' && (
        gymMembers.length === 0 ? (
          <EmptyState icon="users" title="Just you so far" subtitle="Invite your gym mates to join!" />
        ) : (
          gymMembers.map(m => (
            <div key={m.id} onClick={() => onViewProfile?.(m.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
              borderBottom: `1px solid ${COLORS.border}`, cursor: 'pointer',
            }}>
              <Avatar initials={getInitials(m.display_name)} size={40} colorIndex={m.id?.charCodeAt(0) || 0} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text }}>{m.display_name}</div>
                <div style={{ fontSize: 12, color: COLORS.textDim }}>@{m.username}{m.sport ? ` · ${m.sport}` : ''}</div>
              </div>
            </div>
          ))
        )
      )}
    </div>
  );
}
