import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { COLORS, FONTS, Avatar, Spinner, EmptyState, getInitials, convertWeight } from '../components/UI';

const MAIN_LIFTS = ['Bench Press', 'Squat', 'Deadlift', 'Overhead Press', 'Barbell Row', 'Romanian Deadlift', 'Pull Up', 'Leg Press', 'Hip Thrust'];
const TIME_FILTERS = ['All Time', 'This Month', 'This Week'];
const RANK_MODES = ['Est. 1RM', 'Heaviest Set'];
const MEDAL = ['#D4A017', '#9CA3AF', '#CD7F32'];

function estimate1RM(weight, reps) {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export default function Leaderboard({ gym: gymProp, onViewProfile }) {
  const { user, profile } = useStore();
  const gym = gymProp || profile?.gym || '';
  const [exercise, setExercise] = useState('Bench Press');
  const [timeFilter, setTimeFilter] = useState('All Time');
  const [rankMode, setRankMode] = useState('Est. 1RM');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExplainer, setShowExplainer] = useState(false);
  const unit = profile?.unit_pref || 'kg';

  useEffect(() => {
    if (gym) fetchLeaderboard();
    else setLoading(false);
  }, [gym, exercise, timeFilter, rankMode]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const { data: gymProfiles } = await supabase
        .from('profiles').select('id, display_name, username, sport, avatar_url, show_leaderboard')
        .eq('gym', gym).eq('privacy_mode', 'normal');
      const visible = (gymProfiles || []).filter(p => p.show_leaderboard !== false);
      if (visible.length === 0) { setEntries([]); return; }

      const { data: exData } = await supabase.from('exercises')
        .select('id').eq('name', exercise).eq('is_custom', false).limit(1);
      if (!exData || exData.length === 0) { setEntries([]); return; }

      let dateFilter = null;
      if (timeFilter === 'This Month') {
        const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); dateFilter = d.toISOString();
      } else if (timeFilter === 'This Week') {
        const d = new Date(); const day = d.getDay();
        d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); d.setHours(0, 0, 0, 0); dateFilter = d.toISOString();
      }

      // Single nested query instead of the old per-member/per-workout loop.
      let q = supabase.from('sets')
        .select('weight, reps, set_type, workout_exercises!inner(exercise_id, workouts!inner(user_id, created_at, is_public))')
        .eq('workout_exercises.exercise_id', exData[0].id)
        .eq('workout_exercises.workouts.is_public', true)
        .in('workout_exercises.workouts.user_id', visible.map(p => p.id));
      if (dateFilter) q = q.gte('workout_exercises.workouts.created_at', dateFilter);
      const { data: sets, error } = await q;
      if (error) { console.error('Leaderboard query error:', error); setEntries([]); return; }

      const byUser = {};
      (sets || []).forEach(s => {
        if (s.set_type === 'warmup') return;
        const w = s.workout_exercises?.workouts;
        if (!w?.user_id) return;
        const e1rm = estimate1RM(s.weight, s.reps);
        const cur = byUser[w.user_id];
        const better = rankMode === 'Est. 1RM'
          ? (!cur || e1rm > cur.est1RM)
          : (!cur || s.weight > cur.bestWeight || (s.weight === cur.bestWeight && s.reps > cur.bestReps));
        if (better) byUser[w.user_id] = { bestWeight: s.weight, bestReps: s.reps, est1RM: e1rm, date: w.created_at };
      });

      const results = visible
        .filter(p => byUser[p.id] && byUser[p.id].bestWeight > 0)
        .map(p => ({ profile: p, ...byUser[p.id], isMe: p.id === user?.id }));
      results.sort(rankMode === 'Est. 1RM'
        ? (a, b) => b.est1RM - a.est1RM
        : (a, b) => b.bestWeight - a.bestWeight || b.bestReps - a.bestReps);
      setEntries(results);
    } catch (e) {
      console.error('Leaderboard error:', e);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  if (!gym) {
    return <EmptyState icon="trophy" title="No gym yet" subtitle="Join a gym to see who's lifting what" />;
  }

  const myRank = entries.findIndex(e => e.isMe) + 1;

  const pill = (active) => ({
    padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: FONTS.sans,
    background: active ? COLORS.accent : COLORS.card,
    color: active ? COLORS.accentText : COLORS.textDim,
  });

  const segBtn = (active) => ({
    flex: 1, padding: '8px 4px', borderRadius: 9, border: 'none', cursor: 'pointer',
    fontSize: 11, fontWeight: 700, fontFamily: FONTS.sans, letterSpacing: '-0.01em',
    background: active ? COLORS.text : 'transparent',
    color: active ? COLORS.bg : COLORS.textDim,
    transition: 'background 0.15s, color 0.15s',
  });

  return (
    <div>
      {/* Exercise pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', paddingBottom: 4 }}>
        {MAIN_LIFTS.map(ex => (
          <button key={ex} onClick={() => setExercise(ex)} style={pill(exercise === ex)}>{ex}</button>
        ))}
      </div>

      {/* Time + mode segmented controls */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <div style={{ flex: 3, display: 'flex', gap: 3, padding: 3, borderRadius: 12, border: `1px solid ${COLORS.border}`, background: COLORS.card }}>
          {TIME_FILTERS.map(t => (
            <button key={t} onClick={() => setTimeFilter(t)} style={segBtn(timeFilter === t)}>{t.replace('This ', '')}</button>
          ))}
        </div>
        <div style={{ flex: 2, display: 'flex', gap: 3, padding: 3, borderRadius: 12, border: `1px solid ${COLORS.border}`, background: COLORS.card }}>
          {RANK_MODES.map(m => (
            <button key={m} onClick={() => setRankMode(m)} style={segBtn(rankMode === m)}>{m === 'Est. 1RM' ? '1RM' : 'Top set'}</button>
          ))}
        </div>
      </div>

      {/* My rank */}
      {myRank > 0 && (
        <div style={{
          background: COLORS.isDark ? 'rgba(191,230,0,0.07)' : 'rgba(191,230,0,0.10)',
          borderRadius: 12, padding: '12px 16px',
          border: `1px solid ${COLORS.accent}55`, marginBottom: 12,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textDim, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500 }}>Your rank</div>
            <div style={{ fontFamily: FONTS.mono, fontSize: 22, fontWeight: 700, color: COLORS.text, letterSpacing: '-0.02em', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
              #{myRank} <span style={{ fontSize: 12, fontWeight: 500, color: COLORS.textDim }}>of {entries.length}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: FONTS.mono, fontSize: 17, fontWeight: 700, color: COLORS.text, fontVariantNumeric: 'tabular-nums' }}>
              {convertWeight(rankMode === 'Est. 1RM' ? entries[myRank - 1].est1RM : entries[myRank - 1].bestWeight, unit)} <span style={{ fontSize: 11, color: COLORS.textDim, fontWeight: 500 }}>{unit}</span>
            </div>
            <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
              {convertWeight(entries[myRank - 1].bestWeight, unit)}{unit} × {entries[myRank - 1].bestReps}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? <Spinner /> : entries.length === 0 ? (
        <EmptyState icon="trophy" title={`No ${exercise} records`} subtitle={`No one at ${gym} has logged ${exercise} yet`} />
      ) : (
        <div style={{ background: COLORS.card, borderRadius: 14, overflow: 'hidden', border: `1px solid ${COLORS.border}` }}>
          {entries.map((entry, i) => (
            <div key={entry.profile.id} onClick={() => onViewProfile?.(entry.profile.id)} style={{
              display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px',
              borderBottom: i < entries.length - 1 ? `1px solid ${COLORS.border}` : 'none',
              cursor: 'pointer',
              background: entry.isMe ? (COLORS.isDark ? 'rgba(191,230,0,0.05)' : 'rgba(191,230,0,0.07)') : 'transparent',
            }}>
              <span style={{
                width: 24, textAlign: 'center', fontFamily: FONTS.mono, fontWeight: 700,
                fontSize: i < 3 ? 14 : 12, fontVariantNumeric: 'tabular-nums',
                color: i < 3 ? MEDAL[i] : COLORS.textDim,
              }}>{i + 1}</span>
              <Avatar initials={getInitials(entry.profile.display_name)} size={34} colorIndex={entry.profile.id?.charCodeAt(0) || 0} src={entry.profile.avatar_url || null} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: entry.isMe ? 700 : 600, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.profile.display_name}{entry.isMe ? ' (You)' : ''}
                </div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                  {convertWeight(entry.bestWeight, unit)}{unit} × {entry.bestReps}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: FONTS.mono, fontSize: 15, fontWeight: 700, color: COLORS.text, fontVariantNumeric: 'tabular-nums' }}>
                  {convertWeight(rankMode === 'Est. 1RM' ? entry.est1RM : entry.bestWeight, unit)}
                </div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textDim, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{rankMode === 'Est. 1RM' ? 'est 1RM' : unit}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* How it works */}
      <button onClick={() => setShowExplainer(!showExplainer)} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0 4px',
        fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
        letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500,
      }}>{showExplainer ? 'Hide' : 'How rankings work'}</button>
      {showExplainer && (
        <div style={{ fontSize: 13, color: COLORS.textDim, lineHeight: 1.6, paddingBottom: 8 }}>
          <p style={{ margin: '0 0 8px' }}><strong style={{ color: COLORS.text }}>Est. 1RM</strong> estimates your one-rep max from any set (Epley: weight × (1 + reps/30)). 100kg × 5 ≈ 117kg.</p>
          <p style={{ margin: '0 0 8px' }}><strong style={{ color: COLORS.text }}>Top set</strong> ranks by the heaviest single weight lifted, regardless of reps.</p>
          <p style={{ margin: 0 }}>Warmup sets don't count. Only public workouts count. You can opt out in profile settings.</p>
        </div>
      )}
    </div>
  );
}
