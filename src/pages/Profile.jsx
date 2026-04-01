import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { COLORS, Avatar, Badge, Button, Icon, Input, Select, Spinner, EmptyState, getInitials, formatVolume, timeAgo, convertWeight, calcWeekStreak } from '../components/UI';

const TABS = ['Stats', 'Workouts', 'PRs', 'Following'];

function SubTab({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 14 }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)} style={{
          flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          fontFamily: 'inherit', background: 'transparent',
          color: active === t ? COLORS.accent : COLORS.textDim,
          borderBottom: active === t ? `2px solid ${COLORS.accent}` : '2px solid transparent', marginBottom: -1,
        }}>{t}</button>
      ))}
    </div>
  );
}

function StatsView({ workouts, unit }) {
  const total = workouts.length;
  const totalVol = workouts.reduce((s, w) => s + (Number(w.total_volume) || 0), 0);
  const totalSets = workouts.reduce((s, w) => s + (Number(w.total_sets) || 0), 0);
  const totalMins = workouts.reduce((s, w) => s + (Number(w.duration_mins) || 0), 0);
  const prSessions = workouts.filter(w => w.has_pr).length;
  const streak = calcWeekStreak(workouts.map(w => w.created_at));
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const thisWeek = workouts.filter(w => new Date(w.created_at) > weekAgo);
  const weekVol = thisWeek.reduce((s, w) => s + (Number(w.total_volume) || 0), 0);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {[
          { icon: 'weight', v: total, l: 'Workouts' },
          { icon: 'weight', v: formatVolume(convertWeight(totalVol, unit)), l: `Total ${unit}` },
          { icon: 'fire', v: streak, l: 'Week Streak' },
          { icon: 'clock', v: `${Math.round(totalMins / 60)}h`, l: 'Total Time' },
          { icon: 'weight', v: totalSets, l: 'Total Sets' },
          { icon: 'trophy', v: prSessions, l: 'PR Sessions' },
        ].map((s, i) => (
          <div key={i} style={{ background: COLORS.card, borderRadius: 12, padding: '14px 10px', textAlign: 'center', border: `1px solid ${COLORS.border}` }}>
            <Icon name={s.icon} size={16} color={COLORS.textDim} />
            <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.text, marginTop: 4 }}>{s.v}</div>
            <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{ background: `${COLORS.accent}10`, borderRadius: 12, padding: 16, border: `1px solid ${COLORS.accent}25` }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.accent, marginBottom: 8 }}>This Week</div>
        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          {[
            { v: thisWeek.length, l: 'Workouts' },
            { v: formatVolume(convertWeight(weekVol, unit)), l: `${unit} lifted` },
            { v: thisWeek.reduce((s, w) => s + (w.total_sets || 0), 0), l: 'Sets' },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text }}>{s.v}</div>
              <div style={{ fontSize: 11, color: COLORS.textDim }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkoutsView({ workouts, unit, onTogglePrivacy }) {
  if (workouts.length === 0) return <EmptyState icon="weight" title="No workouts yet" subtitle="Log your first workout to see it here" />;
  return (
    <div>
      {workouts.map(w => {
        const exercises = (w.workout_exercises || []).sort((a, b) => a.sort_order - b.sort_order);
        return (
          <div key={w.id} style={{ background: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, border: `1px solid ${COLORS.border}`, opacity: w.is_public === false ? 0.7 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: COLORS.text }}>{w.title}</span>
                  {w.is_public === false && <Icon name="lock" size={13} color={COLORS.textDim} />}
                </div>
                <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 2 }}>{timeAgo(w.created_at)}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {w.has_pr && <Badge color={COLORS.pro}>PR</Badge>}
                {onTogglePrivacy && (
                  <button onClick={() => onTogglePrivacy(w.id, w.is_public)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
                    <Icon name={w.is_public !== false ? 'globe' : 'lock'} size={16} color={COLORS.textDim} />
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              {w.duration_mins > 0 && <span style={{ fontSize: 12, color: COLORS.textDim, display: 'flex', alignItems: 'center', gap: 3 }}><Icon name="clock" size={12} color={COLORS.textDim} /> {w.duration_mins}m</span>}
              <span style={{ fontSize: 12, color: COLORS.textDim }}>{formatVolume(convertWeight(w.total_volume, unit))} {unit}</span>
              <span style={{ fontSize: 12, color: COLORS.textDim }}>{w.total_sets} sets</span>
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

function PRsView({ workouts, unit }) {
  const prs = {};
  workouts.forEach(w => {
    (w.workout_exercises || []).forEach(we => {
      const name = we.exercises?.name;
      if (!name) return;
      (we.sets || []).forEach(s => {
        if (!prs[name] || s.weight > prs[name].weight || (s.weight === prs[name].weight && s.reps > prs[name].reps)) {
          prs[name] = { weight: s.weight, reps: s.reps, date: w.created_at, exerciseName: name };
        }
      });
    });
  });
  const sorted = Object.values(prs).sort((a, b) => b.weight - a.weight);
  if (sorted.length === 0) return <EmptyState icon="trophy" title="No PRs yet" subtitle="Complete workouts to track your personal records" />;
  return (
    <div>
      <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 12 }}>Best set (heaviest weight) for each exercise</div>
      {sorted.map((pr, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: COLORS.card, borderRadius: 10, marginBottom: 6, border: `1px solid ${i < 3 ? `${COLORS.pro}33` : COLORS.border}` }}>
          <span style={{ width: 28, textAlign: 'center', fontSize: 14, fontWeight: 700, color: i === 0 ? COLORS.pro : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : COLORS.textDim }}>{i + 1}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text }}>{pr.exerciseName}</div>
            <div style={{ fontSize: 11, color: COLORS.textDim }}>{timeAgo(pr.date)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.text }}>{convertWeight(pr.weight, unit)} {unit}</div>
            <div style={{ fontSize: 11, color: COLORS.textDim }}>x {pr.reps}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FollowingView({ userId, onViewProfile }) {
  const [tab, setTab] = useState('followers');
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { load(); }, [userId]);
  const load = async () => {
    setLoading(true);
    const { data: fData } = await supabase.from('follows').select('follower_id, profiles:follower_id (id, display_name, username, sport)').eq('following_id', userId);
    if (fData) setFollowers(fData.map(f => f.profiles).filter(Boolean));
    const { data: gData } = await supabase.from('follows').select('following_id, profiles:following_id (id, display_name, username, sport)').eq('follower_id', userId);
    if (gData) setFollowing(gData.map(f => f.profiles).filter(Boolean));
    setLoading(false);
  };
  if (loading) return <Spinner />;
  const list = tab === 'followers' ? followers : following;
  return (
    <div>
      <div style={{ display: 'flex', gap: 0, marginBottom: 14 }}>
        {['followers', 'following'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '10px 8px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: 'transparent', color: tab === t ? COLORS.text : COLORS.textDim, borderBottom: tab === t ? `2px solid ${COLORS.accent}` : `1px solid ${COLORS.border}` }}>
            {t === 'followers' ? `Followers (${followers.length})` : `Following (${following.length})`}
          </button>
        ))}
      </div>
      {list.length === 0 ? <EmptyState icon="users" title={tab === 'followers' ? 'No followers yet' : 'Not following anyone'} subtitle={tab === 'followers' ? 'Share your profile' : 'Discover athletes to follow'} /> : (
        list.map(p => (
          <div key={p.id} onClick={() => onViewProfile(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${COLORS.border}`, cursor: 'pointer' }}>
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

function EditProfile({ profile, onSave, onCancel }) {
  const [form, setForm] = useState({
    display_name: profile.display_name || '', bio: profile.bio || '', sport: profile.sport || '',
    gym: profile.gym || '', unit_pref: profile.unit_pref || 'kg', show_leaderboard: profile.show_leaderboard !== false,
  });
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.text, marginBottom: 16 }}>Edit Profile</div>
      <Input label="Display Name" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} />
      <Input label="Bio" value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="Tell people about yourself" />
      <Input label="Sport" value={form.sport} onChange={e => setForm({ ...form, sport: e.target.value })} placeholder="e.g. Rugby, CrossFit, Powerlifting" />
      <Input label="Gym" value={form.gym} onChange={e => setForm({ ...form, gym: e.target.value })} placeholder="e.g. Nuffield Health Barbican" />
      <Select label="Weight Unit" value={form.unit_pref} onChange={e => setForm({ ...form, unit_pref: e.target.value })}
        options={[{ value: 'kg', label: 'Kilograms (kg)' }, { value: 'lbs', label: 'Pounds (lbs)' }]} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>Show on Leaderboards</div>
          <div style={{ fontSize: 12, color: COLORS.textDim }}>{form.show_leaderboard ? 'Your lifts appear in gym rankings' : 'Hidden from rankings'}</div>
        </div>
        <button onClick={() => setForm({ ...form, show_leaderboard: !form.show_leaderboard })} style={{
          width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
          background: form.show_leaderboard ? COLORS.accent : COLORS.border, position: 'relative',
        }}>
          <div style={{ width: 22, height: 22, borderRadius: 11, background: '#fff', position: 'absolute', top: 3, left: form.show_leaderboard ? 23 : 3, transition: 'left 0.2s' }} />
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Button onClick={() => onSave(form)} style={{ flex: 1 }}>Save</Button>
        <Button variant="secondary" onClick={onCancel} style={{ flex: 1 }}>Cancel</Button>
      </div>
    </div>
  );
}

export default function Profile({ onViewProfile }) {
  const { profile, updateProfile, user } = useStore();
  const [subTab, setSubTab] = useState('Stats');
  const [editing, setEditing] = useState(false);
  const [workouts, setWorkouts] = useState([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const unit = profile?.unit_pref || 'kg';

  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    setLoading(true);
    const { data: wks } = await supabase.from('workouts')
      .select('*, workout_exercises (id, sort_order, exercises:exercise_id (id, name), sets (id, set_number, weight, reps, is_pr))')
      .eq('user_id', user.id).order('created_at', { ascending: false });
    if (wks) setWorkouts(wks);
    const { count: fc } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id);
    const { count: fgc } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id);
    setFollowerCount(fc || 0);
    setFollowingCount(fgc || 0);
    setLoading(false);
  };

  if (!profile) return <Spinner />;
  if (editing) return <EditProfile profile={profile} onSave={async (form) => { await updateProfile(form); setEditing(false); }} onCancel={() => setEditing(false)} />;

  const streak = calcWeekStreak(workouts.map(w => w.created_at));

  return (
    <div>
      <div style={{ background: COLORS.card, borderRadius: 16, padding: 20, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar initials={getInitials(profile.display_name)} size={68} colorIndex={profile.id?.charCodeAt(0) || 0} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 20, color: COLORS.text }}>{profile.display_name}</div>
            <div style={{ fontSize: 13, color: COLORS.textDim }}>@{profile.username}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {profile.sport && <Badge color={COLORS.orange}>{profile.sport}</Badge>}
              {profile.gym && <Badge><Icon name="pin" size={10} color={COLORS.orange} /> {profile.gym}</Badge>}
            </div>
          </div>
          <button onClick={() => setEditing(true)} style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: COLORS.textDim, fontFamily: 'inherit', fontWeight: 600 }}>Edit</button>
        </div>
        {profile.bio && <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 12, lineHeight: 1.4 }}>{profile.bio}</div>}
        <div style={{ display: 'flex', gap: 20, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${COLORS.border}` }}>
          <div onClick={() => setSubTab('Following')} style={{ cursor: 'pointer' }}><span style={{ fontWeight: 700, color: COLORS.text }}>{followerCount}</span><span style={{ fontSize: 13, color: COLORS.textDim, marginLeft: 4 }}>Followers</span></div>
          <div onClick={() => setSubTab('Following')} style={{ cursor: 'pointer' }}><span style={{ fontWeight: 700, color: COLORS.text }}>{followingCount}</span><span style={{ fontSize: 13, color: COLORS.textDim, marginLeft: 4 }}>Following</span></div>
          <div><span style={{ fontWeight: 700, color: COLORS.accent }}><Icon name="fire" size={14} color={COLORS.accent} /> {streak}</span><span style={{ fontSize: 13, color: COLORS.textDim, marginLeft: 4 }}>Weeks</span></div>
        </div>
      </div>

      <SubTab tabs={TABS} active={subTab} onChange={setSubTab} />

      {loading ? <Spinner /> : (
        <>
          {subTab === 'Stats' && <StatsView workouts={workouts} unit={unit} />}
          {subTab === 'Workouts' && <WorkoutsView workouts={workouts} unit={unit} onTogglePrivacy={async (workoutId, currentPublic) => {
            const newVal = currentPublic === false ? true : false;
            await supabase.from('workouts').update({ is_public: newVal }).eq('id', workoutId);
            setWorkouts(prev => prev.map(w => w.id === workoutId ? { ...w, is_public: newVal } : w));
          }} />}
          {subTab === 'PRs' && <PRsView workouts={workouts} unit={unit} />}
          {subTab === 'Following' && <FollowingView userId={user.id} onViewProfile={onViewProfile || (() => {})} />}
        </>
      )}

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
        <button onClick={async () => { await supabase.auth.signOut(); }} style={{
          width: '100%', padding: 12, borderRadius: 10, border: `1px solid #FF525233`,
          background: '#FF525210', color: '#FF5252', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
        }}>Log Out</button>
      </div>
    </div>
  );
}
