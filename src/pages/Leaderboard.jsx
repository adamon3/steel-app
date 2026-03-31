import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { COLORS, Avatar, Badge, Spinner, EmptyState, getInitials, convertWeight } from '../components/UI';

const MAIN_LIFTS = ['Bench Press', 'Squat', 'Deadlift', 'Overhead Press', 'Barbell Row', 'Romanian Deadlift', 'Pull-ups', 'Leg Press', 'Hip Thrust'];
const TIME_FILTERS = ['All Time', 'This Month', 'This Week'];
const RANK_MODES = ['Estimated 1RM', 'Heaviest Set'];

function estimate1RM(weight, reps) {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export default function Leaderboard({ onViewProfile }) {
  const { user, profile } = useStore();
  const [gym, setGym] = useState(profile?.gym || '');
  const [exercise, setExercise] = useState('Bench Press');
  const [timeFilter, setTimeFilter] = useState('All Time');
  const [rankMode, setRankMode] = useState('Estimated 1RM');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availableGyms, setAvailableGyms] = useState([]);
  const unit = profile?.unit_pref || 'kg';

  useEffect(() => {
    fetchGyms();
  }, []);

  useEffect(() => {
    if (gym) fetchLeaderboard();
  }, [gym, exercise, timeFilter, rankMode]);

  const fetchGyms = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('gym')
      .neq('gym', '')
      .not('gym', 'is', null);
    if (data) {
      const unique = [...new Set(data.map(p => p.gym).filter(Boolean))].sort();
      setAvailableGyms(unique);
      if (!gym && profile?.gym) setGym(profile.gym);
      else if (!gym && unique.length > 0) setGym(unique[0]);
    }
  };

  const fetchLeaderboard = async () => {
    setLoading(true);

    // Get all profiles at this gym who show on leaderboard
    const { data: gymProfiles } = await supabase
      .from('profiles')
      .select('id, display_name, username, sport, avatar_url, show_leaderboard')
      .eq('gym', gym);

    if (!gymProfiles || gymProfiles.length === 0) {
      setEntries([]);
      setLoading(false);
      return;
    }

    // Filter to those who have leaderboard enabled (default true)
    const visibleProfiles = gymProfiles.filter(p => p.show_leaderboard !== false);
    const profileIds = visibleProfiles.map(p => p.id);

    // Time filter
    let dateFilter = null;
    if (timeFilter === 'This Month') {
      const d = new Date();
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      dateFilter = d.toISOString();
    } else if (timeFilter === 'This Week') {
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
      dateFilter = d.toISOString();
    }

    // Find the exercise ID
    const { data: exData } = await supabase
      .from('exercises')
      .select('id')
      .eq('name', exercise)
      .limit(1);

    if (!exData || exData.length === 0) {
      setEntries([]);
      setLoading(false);
      return;
    }
    const exerciseId = exData[0].id;

    // For each profile, find their best set for this exercise
    const results = [];
    for (const p of visibleProfiles) {
      // Get workouts by this user
      let wQuery = supabase.from('workouts').select('id, created_at').eq('user_id', p.id).eq('is_public', true);
      if (dateFilter) wQuery = wQuery.gte('created_at', dateFilter);
      const { data: workouts } = await wQuery;

      if (!workouts || workouts.length === 0) continue;

      let bestWeight = 0;
      let bestReps = 0;
      let best1RM = 0;
      let bestDate = null;

      for (const w of workouts) {
        const { data: wes } = await supabase
          .from('workout_exercises')
          .select('sets (weight, reps)')
          .eq('workout_id', w.id)
          .eq('exercise_id', exerciseId);

        if (!wes) continue;
        for (const we of wes) {
          for (const s of (we.sets || [])) {
            const e1rm = estimate1RM(s.weight, s.reps);
            if (rankMode === 'Estimated 1RM') {
              if (e1rm > best1RM) {
                best1RM = e1rm;
                bestWeight = s.weight;
                bestReps = s.reps;
                bestDate = w.created_at;
              }
            } else {
              if (s.weight > bestWeight || (s.weight === bestWeight && s.reps > bestReps)) {
                bestWeight = s.weight;
                bestReps = s.reps;
                best1RM = e1rm;
                bestDate = w.created_at;
              }
            }
          }
        }
      }

      if (bestWeight > 0) {
        results.push({
          profile: p,
          bestWeight,
          bestReps,
          est1RM: best1RM,
          date: bestDate,
          isMe: p.id === user?.id,
        });
      }
    }

    // Sort
    if (rankMode === 'Estimated 1RM') {
      results.sort((a, b) => b.est1RM - a.est1RM);
    } else {
      results.sort((a, b) => b.bestWeight - a.bestWeight || b.bestReps - a.bestReps);
    }

    setEntries(results);
    setLoading(false);
  };

  const medals = ['🥇', '🥈', '🥉'];
  const myRank = entries.findIndex(e => e.isMe) + 1;

  return (
    <div>
      {/* Gym selector */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Gym</div>
        <select value={gym} onChange={e => setGym(e.target.value)} style={{
          width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${COLORS.border}`,
          background: COLORS.card, color: COLORS.text, fontSize: 14, fontFamily: 'inherit',
          outline: 'none', appearance: 'none',
        }}>
          {availableGyms.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* Exercise filter */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Exercise</div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {MAIN_LIFTS.map(ex => (
            <button key={ex} onClick={() => setExercise(ex)} style={{
              padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit',
              background: exercise === ex ? COLORS.accent : COLORS.card,
              color: exercise === ex ? COLORS.bg : COLORS.textDim,
            }}>{ex}</button>
          ))}
        </div>
      </div>

      {/* Time + Rank mode filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {TIME_FILTERS.map(t => (
              <button key={t} onClick={() => setTimeFilter(t)} style={{
                flex: 1, padding: '6px 4px', borderRadius: 6, border: `1px solid ${timeFilter === t ? COLORS.accent : COLORS.border}`,
                cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                background: timeFilter === t ? `${COLORS.accent}15` : 'transparent',
                color: timeFilter === t ? COLORS.accent : COLORS.textDim,
              }}>{t.replace('This ', '')}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {RANK_MODES.map(m => (
              <button key={m} onClick={() => setRankMode(m)} style={{
                flex: 1, padding: '6px 4px', borderRadius: 6, border: `1px solid ${rankMode === m ? COLORS.orange : COLORS.border}`,
                cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                background: rankMode === m ? `${COLORS.orange}15` : 'transparent',
                color: rankMode === m ? COLORS.orange : COLORS.textDim,
              }}>{m === 'Estimated 1RM' ? 'Est. 1RM' : 'Heaviest'}</button>
            ))}
          </div>
        </div>
      </div>

      {/* My rank banner */}
      {myRank > 0 && (
        <div style={{
          background: `${COLORS.accent}12`, borderRadius: 12, padding: '12px 16px',
          border: `1px solid ${COLORS.accent}25`, marginBottom: 14,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 12, color: COLORS.textDim }}>Your rank</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.accent }}>
              {myRank <= 3 ? medals[myRank - 1] : `#${myRank}`} of {entries.length}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>
              {rankMode === 'Estimated 1RM'
                ? `${convertWeight(entries[myRank - 1].est1RM, unit)} ${unit}`
                : `${convertWeight(entries[myRank - 1].bestWeight, unit)} ${unit} x${entries[myRank - 1].bestReps}`}
            </div>
            <div style={{ fontSize: 11, color: COLORS.textDim }}>
              {rankMode === 'Estimated 1RM' ? 'Est. 1RM' : 'Best set'}
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {loading ? <Spinner /> : entries.length === 0 ? (
        <EmptyState emoji="🏆" title={`No ${exercise} records`} subtitle={`No one at ${gym} has logged ${exercise} yet`} />
      ) : (
        <div style={{ background: COLORS.card, borderRadius: 14, overflow: 'hidden', border: `1px solid ${COLORS.border}` }}>
          {/* Header */}
          <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${COLORS.border}` }}>
            <span style={{ width: 28, fontSize: 11, color: COLORS.textDim, fontWeight: 600 }}>#</span>
            <span style={{ flex: 1, fontSize: 11, color: COLORS.textDim, fontWeight: 600 }}>Athlete</span>
            <span style={{ width: 70, fontSize: 11, color: COLORS.textDim, fontWeight: 600, textAlign: 'right' }}>Best Set</span>
            <span style={{ width: 60, fontSize: 11, color: COLORS.textDim, fontWeight: 600, textAlign: 'right' }}>
              {rankMode === 'Estimated 1RM' ? 'Est 1RM' : 'Weight'}
            </span>
          </div>

          {entries.map((entry, i) => (
            <div key={entry.profile.id}
              onClick={() => onViewProfile(entry.profile.id)}
              style={{
                display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px',
                borderBottom: i < entries.length - 1 ? `1px solid ${COLORS.border}` : 'none',
                cursor: 'pointer',
                background: entry.isMe ? `${COLORS.accent}08` : 'transparent',
              }}
            >
              <span style={{
                width: 28, textAlign: 'center', fontSize: i < 3 ? 18 : 13,
                fontWeight: 700, color: i >= 3 ? COLORS.textDim : undefined,
              }}>{i < 3 ? medals[i] : i + 1}</span>

              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar initials={getInitials(entry.profile.display_name)} size={32}
                  colorIndex={entry.profile.id?.charCodeAt(0) || 0} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: entry.isMe ? 700 : 600, color: entry.isMe ? COLORS.accent : COLORS.text }}>
                    {entry.profile.display_name}{entry.isMe ? ' (You)' : ''}
                  </div>
                  {entry.profile.sport && <div style={{ fontSize: 11, color: COLORS.textDim }}>{entry.profile.sport}</div>}
                </div>
              </div>

              <span style={{ width: 70, fontSize: 12, color: COLORS.textDim, textAlign: 'right' }}>
                {convertWeight(entry.bestWeight, unit)}{unit} x{entry.bestReps}
              </span>

              <span style={{
                width: 60, fontSize: 13, fontWeight: 800, textAlign: 'right',
                color: i === 0 ? COLORS.accent : COLORS.text,
              }}>
                {convertWeight(rankMode === 'Estimated 1RM' ? entry.est1RM : entry.bestWeight, unit)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
