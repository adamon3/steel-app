import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { COLORS, Avatar, Badge, Button, Input, Select, Spinner, EmptyState, getInitials, formatVolume, timeAgo, convertWeight } from '../components/UI';

// ── Sub-tabs within profile ──
const TABS = ['Stats', 'Workouts', 'PRs', 'Following'];

function SubTab({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 14 }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)} style={{
          flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: 'transparent',
          color: active === t ? COLORS.accent : COLORS.textDim,
          borderBottom: active === t ? `2px solid ${COLORS.accent}` : '2px solid transparent',
          marginBottom: -1, transition: 'all 0.15s',
        }}>{t}</button>
      ))}
    </div>
  );
}

// ── Stats Tab ──
function StatsView({ workouts, unit }) {
  const totalWorkouts = workouts.length;
  const totalVolume = workouts.reduce((s, w) => s + (Number(w.total_volume) || 0), 0);
  const totalSets = workouts.reduce((s, w) => s + (Number(w.total_sets) || 0), 0);
  const totalMins = workouts.reduce((s, w) => s + (Number(w.duration_mins) || 0), 0);
  const prWorkouts = workouts.filter(w => w.has_pr).length;

  // Calculate streak
  const dates = workouts.map(w => new Date(w.created_at).toDateString());
  const uniqueDates = [...new Set(dates)].sort((a, b) => new Date(b) - new Date(a));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (uniqueDates.includes(d.toDateString())) {
      streak++;
    } else if (i > 0) break; // allow today to be missed
  }

  // This week
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const thisWeek = workouts.filter(w => new Date(w.created_at) > weekAgo);
  const weekVolume = thisWeek.reduce((s, w) => s + (Number(w.total_volume) || 0), 0);

  const stats = [
    { e: '💪', v: totalWorkouts, l: 'Workouts' },
    { e: '🏋️', v: formatVolume(convertWeight(totalVolume, unit)), l: `Total ${unit}` },
    { e: '🔥', v: streak, l: 'Day Streak' },
    { e: '⏱', v: `${Math.round(totalMins / 60)}h`, l: 'Total Time' },
    { e: '📊', v: totalSets, l: 'Total Sets' },
    { e: '🏆', v: prWorkouts, l: 'PR Sessions' },
  ];

  return (
    <div>
      {/* Main stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {stats.map((s, i) => (
          <div key={i} style={{
            background: COLORS.card, borderRadius: 12, padding: '14px 10px', textAlign: 'center',
            border: `1px solid ${COLORS.border}`,
          }}>
            <div style={{ fontSize: 16, marginBottom: 4 }}>{s.e}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.text }}>{s.v}</div>
            <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* This week summary */}
      <div style={{
        background: `${COLORS.accent}10`, borderRadius: 12, padding: 16,
        border: `1px solid ${COLORS.accent}25`, marginBottom: 16,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.accent, marginBottom: 8 }}>This Week</div>
        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text }}>{thisWeek.length}</div>
            <div style={{ fontSize: 11, color: COLORS.textDim }}>Workouts</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text }}>{formatVolume(convertWeight(weekVolume, unit))}</div>
            <div style={{ fontSize: 11, color: COLORS.textDim }}>{unit} lifted</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text }}>{thisWeek.reduce((s, w) => s + (w.total_sets || 0), 0)}</div>
            <div style={{ fontSize: 11, color: COLORS.textDim }}>Sets</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Workouts History Tab ──
function WorkoutsView({ workouts, unit }) {
  if (workouts.length === 0) return <EmptyState emoji="🏋️" title="No workouts yet" subtitle="Log your first workout to see it here" />;

  return (
    <div>
      {workouts.map(w => {
        const exercises = (w.workout_exercises || []).sort((a, b) => a.sort_order - b.sort_order);
        return (
          <div key={w.id} style={{
            background: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10,
            border: `1px solid ${COLORS.border}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.text }}>{w.title}</div>
                <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 2 }}>{timeAgo(w.created_at)}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {w.has_pr && <Badge color={COLORS.pro}>{"🏆"} PR</Badge>}
                {w.steeled_from && <Badge color={COLORS.accent}>{"📋"}</Badge>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              {w.duration_mins > 0 && <span style={{ fontSize: 12, color: COLORS.textDim }}>{"⏱"} {w.duration_mins}m</span>}
              <span style={{ fontSize: 12, color: COLORS.textDim }}>{"🏋️"} {formatVolume(convertWeight(w.total_volume, unit))} {unit}</span>
              <span style={{ fontSize: 12, color: COLORS.textDim }}>{"💪"} {w.total_sets} sets</span>
            </div>
            <div style={{ fontSize: 13, color: COLORS.textDim, lineHeight: 1.5 }}>
              {exercises.map(we => we.exercises?.name).filter(Boolean).join(', ')}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Personal Records Tab ──
function PRsView({ workouts, unit }) {
  // Calculate best set (highest weight) for each exercise across all workouts
  const prs = {};
  workouts.forEach(w => {
    (w.workout_exercises || []).forEach(we => {
      const name = we.exercises?.name;
      if (!name) return;
      (we.sets || []).forEach(s => {
        const key = name;
        if (!prs[key] || s.weight > prs[key].weight || (s.weight === prs[key].weight && s.reps > prs[key].reps)) {
          prs[key] = { weight: s.weight, reps: s.reps, date: w.created_at, exerciseName: name };
        }
      });
    });
  });

  const sorted = Object.values(prs).sort((a, b) => b.weight - a.weight);

  if (sorted.length === 0) return <EmptyState emoji="🏆" title="No PRs yet" subtitle="Complete workouts to track your personal records" />;

  return (
    <div>
      <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 12 }}>Best set (heaviest weight) for each exercise</div>
      {sorted.map((pr, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
          background: COLORS.card, borderRadius: 10, marginBottom: 6,
          border: `1px solid ${i < 3 ? `${COLORS.pro}33` : COLORS.border}`,
        }}>
          <span style={{ width: 28, textAlign: 'center', fontSize: i < 3 ? 18 : 14, fontWeight: 700, color: i >= 3 ? COLORS.textDim : undefined }}>
            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text }}>{pr.exerciseName}</div>
            <div style={{ fontSize: 11, color: COLORS.textDim }}>{timeAgo(pr.date)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.text }}>
              {convertWeight(pr.weight, unit)} {unit}
            </div>
            <div style={{ fontSize: 11, color: COLORS.textDim }}>x {pr.reps} reps</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Following / Followers Tab ──
function FollowingView({ userId, onViewProfile }) {
  const [tab, setTab] = useState('followers');
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [userId]);

  const load = async () => {
    setLoading(true);
    // Followers
    const { data: fData } = await supabase
      .from('follows')
      .select('follower_id, profiles:follower_id (id, display_name, username, sport, avatar_url)')
      .eq('following_id', userId);
    if (fData) setFollowers(fData.map(f => f.profiles).filter(Boolean));

    // Following
    const { data: gData } = await supabase
      .from('follows')
      .select('following_id, profiles:following_id (id, display_name, username, sport, avatar_url)')
      .eq('follower_id', userId);
    if (gData) setFollowing(gData.map(f => f.profiles).filter(Boolean));
    setLoading(false);
  };

  if (loading) return <Spinner />;

  const list = tab === 'followers' ? followers : following;

  return (
    <div>
      <div style={{ display: 'flex', gap: 0, marginBottom: 14 }}>
        {['followers', 'following'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px 8px', border: 'none', cursor: 'pointer', fontSize: 13,
            fontWeight: 600, fontFamily: 'inherit', background: 'transparent',
            color: tab === t ? COLORS.text : COLORS.textDim,
            borderBottom: tab === t ? `2px solid ${COLORS.accent}` : `1px solid ${COLORS.border}`,
          }}>{t === 'followers' ? `Followers (${followers.length})` : `Following (${following.length})`}</button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState emoji={tab === 'followers' ? '👥' : '🔍'}
          title={tab === 'followers' ? 'No followers yet' : 'Not following anyone'}
          subtitle={tab === 'followers' ? 'Share your profile to get followers' : 'Discover athletes to follow'} />
      ) : (
        list.map(p => (
          <div key={p.id} onClick={() => onViewProfile(p.id)} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
            borderBottom: `1px solid ${COLORS.border}`, cursor: 'pointer',
          }}>
            <Avatar initials={getInitials(p.display_name)} size={40} colorIndex={p.id?.charCodeAt(0) || 0} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text }}>{p.display_name}</div>
              <div style={{ fontSize: 12, color: COLORS.textDim }}>@{p.username}{p.sport ? ` · ${p.sport}` : ''}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Edit Profile Modal ──
function EditProfile({ profile, onSave, onCancel }) {
  const [form, setForm] = useState({
    display_name: profile.display_name || '',
    bio: profile.bio || '',
    sport: profile.sport || '',
    gym: profile.gym || '',
    unit_pref: profile.unit_pref || 'kg',
  });

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.text, marginBottom: 16 }}>Edit Profile</div>
      <Input label="Display Name" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} />
      <Input label="Bio" value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="Tell people about yourself" />
      <Input label="Sport" value={form.sport} onChange={e => setForm({ ...form, sport: e.target.value })} placeholder="e.g. Skeleton, Rugby, CrossFit" />
      <Input label="Gym" value={form.gym} onChange={e => setForm({ ...form, gym: e.target.value })} placeholder="e.g. Nuffield Health Barbican" />
      <Select label="Weight Unit" value={form.unit_pref} onChange={e => setForm({ ...form, unit_pref: e.target.value })}
        options={[{ value: 'kg', label: 'Kilograms (kg)' }, { value: 'lbs', label: 'Pounds (lbs)' }]} />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Button onClick={() => onSave(form)} style={{ flex: 1 }}>Save</Button>
        <Button variant="secondary" onClick={onCancel} style={{ flex: 1 }}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Main Profile Page ──
export default function Profile({ onViewProfile }) {
  const { profile, updateProfile, user } = useStore();
  const [subTab, setSubTab] = useState('Stats');
  const [editing, setEditing] = useState(false);
  const [workouts, setWorkouts] = useState([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const unit = profile?.unit_pref || 'kg';

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);

    // Fetch all my workouts with exercise details
    const { data: wks } = await supabase
      .from('workouts')
      .select('*, workout_exercises (id, sort_order, exercises:exercise_id (id, name), sets (id, set_number, weight, reps, is_pr))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (wks) setWorkouts(wks);

    // Follower / following counts
    const { count: fc } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id);
    const { count: fgc } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id);
    setFollowerCount(fc || 0);
    setFollowingCount(fgc || 0);

    setLoading(false);
  };

  const handleSave = async (form) => {
    await updateProfile(form);
    setEditing(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  if (!profile) return <Spinner />;
  if (editing) return <EditProfile profile={profile} onSave={handleSave} onCancel={() => setEditing(false)} />;

  // Calculate streak for header
  const dates = workouts.map(w => new Date(w.created_at).toDateString());
  const uniqueDates = [...new Set(dates)];
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (uniqueDates.includes(d.toDateString())) streak++;
    else if (i > 0) break;
  }

  return (
    <div>
      {/* Profile header card */}
      <div style={{
        background: COLORS.card, borderRadius: 16, padding: 20, marginBottom: 14,
        border: `1px solid ${COLORS.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar initials={getInitials(profile.display_name)} size={68} colorIndex={profile.id?.charCodeAt(0) || 0} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 20, color: COLORS.text }}>{profile.display_name}</div>
            <div style={{ fontSize: 13, color: COLORS.textDim }}>@{profile.username}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {profile.sport && <Badge color={COLORS.orange}>{profile.sport}</Badge>}
              {profile.gym && <Badge>{"📍"} {profile.gym}</Badge>}
            </div>
          </div>
          <button onClick={() => setEditing(true)} style={{
            background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8,
            padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: COLORS.textDim,
            fontFamily: 'inherit', fontWeight: 600,
          }}>Edit</button>
        </div>

        {profile.bio && <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 12, lineHeight: 1.4 }}>{profile.bio}</div>}

        {/* Counts row */}
        <div style={{ display: 'flex', gap: 20, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${COLORS.border}` }}>
          <div onClick={() => setSubTab('Following')} style={{ cursor: 'pointer' }}>
            <span style={{ fontWeight: 700, color: COLORS.text }}>{followerCount}</span>
            <span style={{ fontSize: 13, color: COLORS.textDim, marginLeft: 4 }}>Followers</span>
          </div>
          <div onClick={() => setSubTab('Following')} style={{ cursor: 'pointer' }}>
            <span style={{ fontWeight: 700, color: COLORS.text }}>{followingCount}</span>
            <span style={{ fontSize: 13, color: COLORS.textDim, marginLeft: 4 }}>Following</span>
          </div>
          <div>
            <span style={{ fontWeight: 700, color: COLORS.accent }}>{"🔥"} {streak}</span>
            <span style={{ fontSize: 13, color: COLORS.textDim, marginLeft: 4 }}>Day Streak</span>
          </div>
        </div>
      </div>

      {/* Sub-navigation */}
      <SubTab tabs={TABS} active={subTab} onChange={setSubTab} />

      {/* Tab content */}
      {loading ? <Spinner /> : (
        <>
          {subTab === 'Stats' && <StatsView workouts={workouts} unit={unit} />}
          {subTab === 'Workouts' && <WorkoutsView workouts={workouts} unit={unit} />}
          {subTab === 'PRs' && <PRsView workouts={workouts} unit={unit} />}
          {subTab === 'Following' && <FollowingView userId={user.id} onViewProfile={onViewProfile || (() => {})} />}
        </>
      )}

      {/* Settings */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 8 }}>
          Weights in: <strong style={{ color: COLORS.text }}>{unit === 'lbs' ? 'Pounds' : 'Kilograms'}</strong>
        </div>
        <button onClick={logout} style={{
          width: '100%', padding: 12, borderRadius: 10, border: `1px solid #FF525233`,
          background: '#FF525210', color: '#FF5252', cursor: 'pointer', fontSize: 13,
          fontWeight: 600, fontFamily: 'inherit',
        }}>Log Out</button>
      </div>
    </div>
  );
}
