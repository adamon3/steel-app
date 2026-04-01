import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { COLORS, Avatar, Icon, Spinner, EmptyState, getInitials, convertWeight } from '../components/UI';

const MAIN_LIFTS = ['Bench Press', 'Squat', 'Deadlift', 'Overhead Press', 'Barbell Row', 'Romanian Deadlift', 'Pull-ups', 'Leg Press', 'Hip Thrust'];
const TIME_FILTERS = ['All Time', 'This Month', 'This Week'];
const RANK_MODES = ['Est. 1RM', 'Heaviest Set'];

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
  const [rankMode, setRankMode] = useState('Est. 1RM');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availableGyms, setAvailableGyms] = useState([]);
  const [showExplainer, setShowExplainer] = useState(false);
  const unit = profile?.unit_pref || 'kg';

  useEffect(() => { fetchGyms(); }, []);
  useEffect(() => { if (gym) fetchLeaderboard(); }, [gym, exercise, timeFilter, rankMode]);

  const fetchGyms = async () => {
    const { data } = await supabase.from('profiles').select('gym').neq('gym', '').not('gym', 'is', null);
    if (data) {
      const unique = [...new Set(data.map(p => p.gym).filter(Boolean))].sort();
      setAvailableGyms(unique);
      if (!gym && profile?.gym) setGym(profile.gym);
      else if (!gym && unique.length > 0) setGym(unique[0]);
    }
  };

  const fetchLeaderboard = async () => {
    setLoading(true);
    const { data: gymProfiles } = await supabase
      .from('profiles').select('id, display_name, username, sport, show_leaderboard').eq('gym', gym);
    if (!gymProfiles || gymProfiles.length === 0) { setEntries([]); setLoading(false); return; }

    const visibleProfiles = gymProfiles.filter(p => p.show_leaderboard !== false);
    let dateFilter = null;
    if (timeFilter === 'This Month') {
      const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); dateFilter = d.toISOString();
    } else if (timeFilter === 'This Week') {
      const d = new Date(); const day = d.getDay();
      d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); d.setHours(0,0,0,0); dateFilter = d.toISOString();
    }

    const { data: exData } = await supabase.from('exercises').select('id').eq('name', exercise).limit(1);
    if (!exData || exData.length === 0) { setEntries([]); setLoading(false); return; }
    const exerciseId = exData[0].id;

    const results = [];
    for (const p of visibleProfiles) {
      let wQuery = supabase.from('workouts').select('id, created_at').eq('user_id', p.id).eq('is_public', true);
      if (dateFilter) wQuery = wQuery.gte('created_at', dateFilter);
      const { data: workouts } = await wQuery;
      if (!workouts || workouts.length === 0) continue;

      let bestWeight = 0, bestReps = 0, best1RM = 0, bestDate = null;
      for (const w of workouts) {
        const { data: wes } = await supabase.from('workout_exercises')
          .select('sets (weight, reps)').eq('workout_id', w.id).eq('exercise_id', exerciseId);
        if (!wes) continue;
        for (const we of wes) {
          for (const s of (we.sets || [])) {
            const e1rm = estimate1RM(s.weight, s.reps);
            if (rankMode === 'Est. 1RM') {
              if (e1rm > best1RM) { best1RM = e1rm; bestWeight = s.weight; bestReps = s.reps; bestDate = w.created_at; }
            } else {
              if (s.weight > bestWeight || (s.weight === bestWeight && s.reps > bestReps)) { bestWeight = s.weight; bestReps = s.reps; best1RM = e1rm; bestDate = w.created_at; }
            }
          }
        }
      }
      if (bestWeight > 0) {
        results.push({ profile: p, bestWeight, bestReps, est1RM: best1RM, date: bestDate, isMe: p.id === user?.id });
      }
    }

    results.sort(rankMode === 'Est. 1RM' ? (a, b) => b.est1RM - a.est1RM : (a, b) => b.bestWeight - a.bestWeight || b.bestReps - a.bestReps);
    setEntries(results);
    setLoading(false);
  };

  const medals = ['', '', ''];
  const myRank = entries.findIndex(e => e.isMe) + 1;

  return (
    <div>
      {/* Explainer */}
      <div style={{
        background: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 14,
        border: `1px solid ${COLORS.border}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="trophy" size={20} color={COLORS.pro} />
            <span style={{ fontWeight: 700, fontSize: 16, color: COLORS.text }}>Gym Leaderboard</span>
          </div>
          <button onClick={() => setShowExplainer(!showExplainer)} style={{
            background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 6,
            padding: '4px 8px', cursor: 'pointer', fontSize: 11, color: COLORS.textDim, fontFamily: 'inherit',
          }}>{showExplainer ? 'Hide' : 'How it works'}</button>
        </div>
        {showExplainer && (
          <div style={{ marginTop: 12, fontSize: 13, color: COLORS.textDim, lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 8px' }}>Leaderboards rank athletes at each gym by their best lifts. Pick an exercise to see who's on top.</p>
            <p style={{ margin: '0 0 8px' }}><strong style={{ color: COLORS.text }}>Est. 1RM</strong> calculates your estimated one-rep max from any set using the Epley formula: weight x (1 + reps/30). A 100kg x 5 = 117kg estimated 1RM.</p>
            <p style={{ margin: '0 0 8px' }}><strong style={{ color: COLORS.text }}>Heaviest Set</strong> ranks by the heaviest single weight lifted regardless of reps.</p>
            <p style={{ margin: 0 }}>You can opt out of leaderboards in your profile settings. Only public workouts count.</p>
          </div>
        )}
      </div>

      {/* Gym selector */}
      <select value={gym} onChange={e => setGym(e.target.value)} style={{
        width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${COLORS.border}`,
        background: COLORS.card, color: COLORS.text, fontSize: 14, fontFamily: 'inherit',
        outline: 'none', appearance: 'none', marginBottom: 12,
      }}>
        {availableGyms.map(g => <option key={g} value={g}>{g}</option>)}
      </select>

      {/* Exercise pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
        {MAIN_LIFTS.map(ex => (
          <button key={ex} onClick={() => setExercise(ex)} style={{
            padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit',
            background: exercise === ex ? COLORS.accent : COLORS.card,
            color: exercise === ex ? COLORS.bg : COLORS.textDim,
          }}>{ex}</button>
        ))}
      </div>

      {/* Time + mode filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {TIME_FILTERS.map(t => (
          <button key={t} onClick={() => setTimeFilter(t)} style={{
            flex: 1, padding: '7px 4px', borderRadius: 8,
            border: `1px solid ${timeFilter === t ? COLORS.accent : COLORS.border}`,
            cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
            background: timeFilter === t ? `${COLORS.accent}15` : 'transparent',
            color: timeFilter === t ? COLORS.accent : COLORS.textDim,
          }}>{t}</button>
        ))}
        <div style={{ width: 1, background: COLORS.border }} />
        {RANK_MODES.map(m => (
          <button key={m} onClick={() => setRankMode(m)} style={{
            flex: 1, padding: '7px 4px', borderRadius: 8,
            border: `1px solid ${rankMode === m ? COLORS.orange : COLORS.border}`,
            cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
            background: rankMode === m ? `${COLORS.orange}15` : 'transparent',
            color: rankMode === m ? COLORS.orange : COLORS.textDim,
          }}>{m}</button>
        ))}
      </div>

      {/* My rank */}
      {myRank > 0 && (
        <div style={{
          background: `${COLORS.accent}10`, borderRadius: 12, padding: '12px 16px',
          border: `1px solid ${COLORS.accent}25`, marginBottom: 14,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textDim }}>Your rank</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.accent }}>
              #{myRank} <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.textDim }}>of {entries.length}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>
              {convertWeight(rankMode === 'Est. 1RM' ? entries[myRank - 1].est1RM : entries[myRank - 1].bestWeight, unit)} {unit}
            </div>
            <div style={{ fontSize: 11, color: COLORS.textDim }}>
              {entries[myRank - 1].bestWeight}{unit} x{entries[myRank - 1].bestReps}
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
            <div key={entry.profile.id} onClick={() => onViewProfile(entry.profile.id)} style={{
              display: 'flex', gap: 8, alignItems: 'center', padding: '12px 14px',
              borderBottom: i < entries.length - 1 ? `1px solid ${COLORS.border}` : 'none',
              cursor: 'pointer', background: entry.isMe ? `${COLORS.accent}08` : 'transparent',
            }}>
              <span style={{
                width: 28, textAlign: 'center', fontWeight: 800, fontSize: i < 3 ? 15 : 13,
                color: i === 0 ? COLORS.pro : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : COLORS.textDim,
              }}>{i + 1}</span>
              <Avatar initials={getInitials(entry.profile.display_name)} size={34} colorIndex={entry.profile.id?.charCodeAt(0) || 0} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: entry.isMe ? 700 : 600, color: entry.isMe ? COLORS.accent : COLORS.text }}>
                  {entry.profile.display_name}{entry.isMe ? ' (You)' : ''}
                </div>
                <div style={{ fontSize: 11, color: COLORS.textDim }}>
                  {convertWeight(entry.bestWeight, unit)}{unit} x{entry.bestReps}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: i === 0 ? COLORS.pro : COLORS.text }}>
                  {convertWeight(rankMode === 'Est. 1RM' ? entry.est1RM : entry.bestWeight, unit)}
                </div>
                <div style={{ fontSize: 10, color: COLORS.textDim }}>{rankMode === 'Est. 1RM' ? 'est 1RM' : unit}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
