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
  const [joinGymName, setJoinGymName] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [subTab, setSubTab] = useState('feed');
  const unit = profile?.unit_pref || 'kg';

  useEffect(() => { loadData(); }, [profile?.gym]);

  const loadData = async () => {
    setLoading(true);
    // Get all gyms with member counts
    const { data: profiles } = await supabase.from('profiles').select('gym').neq('gym', '').not('gym', 'is', null);
    if (profiles) {
      const gymCounts = {};
      profiles.forEach(p => { if (p.gym) gymCounts[p.gym] = (gymCounts[p.gym] || 0) + 1; });
      setGyms(Object.entries(gymCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })));
    }

    // If user has a gym, load gym data
    if (profile?.gym) {
      // Gym members
      const { data: members } = await supabase.from('profiles')
        .select('id, display_name, username, sport, avatar_url')
        .eq('gym', profile.gym).neq('id', user?.id || '');
      if (members) setGymMembers(members);

      // Gym feed (recent workouts from gym members)
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

  const handleJoinGym = async (gymName) => {
    await updateProfile({ gym: gymName });
    setShowJoin(false);
    setJoinGymName('');
  };

  const handleLeaveGym = async () => {
    await updateProfile({ gym: '' });
    setMyGymData(null);
    setGymFeed([]);
    setGymMembers([]);
  };

  if (loading) return <Spinner />;

  // User has no gym — show gym browser
  if (!profile?.gym) {
    return (
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.text, marginBottom: 4 }}>Gym Communities</div>
        <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 16 }}>Join your gym to see what others are lifting and compete on leaderboards</div>

        {/* Join a gym */}
        <div style={{ background: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 16, border: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>Join a Gym</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={joinGymName} onChange={e => setJoinGymName(e.target.value)}
              placeholder="Enter gym name (e.g. Nuffield Health Barbican)"
              style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.bg, color: COLORS.text, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
            <button onClick={() => handleJoinGym(joinGymName)} disabled={!joinGymName.trim()} style={{
              padding: '10px 16px', borderRadius: 8, border: 'none', background: COLORS.accent,
              color: COLORS.bg, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              opacity: joinGymName.trim() ? 1 : 0.5,
            }}>Join</button>
          </div>
        </div>

        {/* Existing gyms */}
        {gyms.length > 0 && (
          <>
            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>Popular Gyms</div>
            {gyms.map(g => (
              <div key={g.name} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: COLORS.card, borderRadius: 12, padding: '12px 14px', marginBottom: 8,
                border: `1px solid ${COLORS.border}`,
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text }}>{g.name}</div>
                  <div style={{ fontSize: 12, color: COLORS.textDim, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Icon name="users" size={12} color={COLORS.textDim} /> {g.count} member{g.count !== 1 ? 's' : ''}
                  </div>
                </div>
                <button onClick={() => handleJoinGym(g.name)} style={{
                  padding: '7px 14px', borderRadius: 8, border: 'none', background: COLORS.accent,
                  color: COLORS.bg, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                }}>Join</button>
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  // User has a gym — show gym community
  return (
    <div>
      {/* Gym header */}
      <div style={{ background: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
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
            borderBottom: subTab === t ? `2px solid ${COLORS.accent}` : '2px solid transparent', marginBottom: -1,
            textTransform: 'capitalize',
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
