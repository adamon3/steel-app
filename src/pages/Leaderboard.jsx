import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { COLORS, Avatar, Icon, Spinner, EmptyState, getInitials, convertWeight } from '../components/UI';

const FONTS = {
  sans: "'Inter Tight', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
};

const MAIN_LIFTS = ['Bench Press', 'Squat', 'Deadlift', 'Overhead Press', 'Barbell Row', 'Romanian Deadlift', 'Pull-ups', 'Leg Press', 'Hip Thrust'];
const TIME_FILTERS = ['All time', 'This month', 'This week'];
const RANK_MODES = ['Est. 1RM', 'Top set'];

function estimate1RM(weight, reps) {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export default function Leaderboard({ onViewProfile }) {
  const { user, profile } = useStore();
  const [gym, setGym] = useState(profile?.gym || '');
  const [exercise, setExercise] = useState('Bench Press');
  const [timeFilter, setTimeFilter] = useState('All time');
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
      .from('profiles').select('id, display_name, username, sport, show_leaderboard, avatar_url').eq('gym', gym);
    if (!gymProfiles || gymProfiles.length === 0) { setEntries([]); setLoading(false); return; }

    const visibleProfiles = gymProfiles.filter(p => p.show_leaderboard !== false);
    let dateFilter = null;
    if (timeFilter === 'This month') {
      const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); dateFilter = d.toISOString();
    } else if (timeFilter === 'This week') {
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

  const myRank = entries.findIndex(e => e.isMe) + 1;

  return (
    <div style={{ fontFamily: FONTS.sans }}>
      {/* Heading */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <h1 style={{
          fontSize: 22, fontWeight: 800, color: COLORS.text,
          letterSpacing: '-0.02em', margin: 0,
        }}>Leaderboard</h1>
        <button onClick={() => setShowExplainer(!showExplainer)} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
          letterSpacing: '0.1em', fontWeight: 500, textTransform: 'uppercase',
        }}>
          {showExplainer ? 'Hide' : 'How it works'}
        </button>
      </div>

      {showExplainer && (
        <div style={{
          background: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 14,
          border: `1px solid ${COLORS.border}`,
          fontSize: 13, color: COLORS.textDim, lineHeight: 1.6,
        }}>
          <p style={{ margin: '0 0 8px' }}>Rankings by best lift at each gym. Pick an exercise to see who's on top.</p>
          <p style={{ margin: '0 0 8px' }}><strong style={{ color: COLORS.text }}>Est. 1RM</strong> — one-rep max from any set via Epley: weight × (1 + reps/30).</p>
          <p style={{ margin: '0 0 8px' }}><strong style={{ color: COLORS.text }}>Top set</strong> — heaviest single weight lifted, regardless of reps.</p>
          <p style={{ margin: 0 }}>Opt out in profile settings. Only public workouts count.</p>
        </div>
      )}

      {/* Gym selector */}
      <div style={{ marginBottom: 12 }}>
        <div style={{
          fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textDim,
          letterSpacing: '0.14em', fontWeight: 500, textTransform: 'uppercase',
          marginBottom: 6,
        }}>Gym</div>
        <select value={gym} onChange={e => setGym(e.target.value)} style={{
          width: '100%', padding: '11px 14px', borderRadius: 10,
          border: `1px solid ${COLORS.border}`, background: COLORS.card,
          color: COLORS.text, fontSize: 14, fontFamily: FONTS.sans,
          outline: 'none', appearance: 'none', cursor: 'pointer',
        }}>
          {availableGyms.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* Exercise pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        {MAIN_LIFTS.map(ex => (
          <button key={ex} onClick={() => setExercise(ex)} style={{
            padding: '7px 14px', borderRadius: 999,
            border: `1px solid ${exercise === ex ? COLORS.text : COLORS.border}`,
            cursor: 'pointer', whiteSpace: 'nowrap',
            fontSize: 12, fontWeight: 600, fontFamily: FONTS.sans, letterSpacing: '-0.01em',
            background: exercise === ex ? COLORS.text : 'transparent',
            color: exercise === ex ? COLORS.bg : COLORS.text,
          }}>{ex}</button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {TIME_FILTERS.map(t => (
          <button key={t} onClick={() => setTimeFilter(t)} style={{
            flex: 1, padding: '7px 4px', borderRadius: 8,
            border: `1px solid ${timeFilter === t ? COLORS.text : COLORS.border}`,
            cursor: 'pointer',
            fontFamily: FONTS.mono, fontSize: 10, fontWeight: 500,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            background: timeFilter === t ? COLORS.card2 : 'transparent',
            color: timeFilter === t ? COLORS.text : COLORS.textDim,
          }}>{t}</button>
        ))}
        <div style={{ width: 1, background: COLORS.border, margin: '0 4px' }} />
        {RANK_MODES.map(m => (
          <button key={m} onClick={() => setRankMode(m)} style={{
            flex: 1, padding: '7px 4px', borderRadius: 8,
            border: `1px solid ${rankMode === m ? COLORS.text : COLORS.border}`,
            cursor: 'pointer',
            fontFamily: FONTS.mono, fontSize: 10, fontWeight: 500,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            background: rankMode === m ? COLORS.card2 : 'transparent',
            color: rankMode === m ? COLORS.text : COLORS.textDim,
          }}>{m}</button>
        ))}
      </div>

      {/* My rank callout */}
      {myRank > 0 && entries[myRank - 1] && (
        <div style={{
          background: COLORS.text, color: COLORS.bg,
          borderRadius: 12, padding: '14px 16px', marginBottom: 14,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{
              fontFamily: FONTS.mono, fontSize: 9, color: COLORS.bg, opacity: 0.6,
              letterSpacing: '0.14em', fontWeight: 500,
            }}>YOUR RANK</div>
            <div style={{
              fontFamily: FONTS.mono, fontSize: 28, fontWeight: 700,
              color: COLORS.bg, letterSpacing: '-0.03em', lineHeight: 1,
            }}>
              #{myRank}<span style={{ fontSize: 14, opacity: 0.6, fontWeight: 500 }}> / {entries.length}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontFamily: FONTS.mono, fontSize: 22, fontWeight: 700,
              color: COLORS.bg, letterSpacing: '-0.03em',
            }}>
              {convertWeight(rankMode === 'Est. 1RM' ? entries[myRank - 1].est1RM : entries[myRank - 1].bestWeight, unit)}
              <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 500, marginLeft: 3 }}>{unit}</span>
            </div>
            <div style={{
              fontFamily: FONTS.mono, fontSize: 10, color: COLORS.bg, opacity: 0.6,
              letterSpacing: '0.04em', marginTop: 2,
            }}>
              {entries[myRank - 1].bestWeight} × {entries[myRank - 1].bestReps}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? <Spinner /> : entries.length === 0 ? (
        <EmptyState icon="trophy" title={`No ${exercise} records`}
          subtitle={`No one at ${gym} has logged ${exercise} yet`} />
      ) : (
        <div style={{
          background: COLORS.card, borderRadius: 12,
          border: `1px solid ${COLORS.border}`, overflow: 'hidden',
        }}>
          {entries.map((entry, i) => {
            const rank = i + 1;
            const isPodium = rank <= 3;
            return (
              <div key={entry.profile.id} onClick={() => onViewProfile(entry.profile.id)} style={{
                display: 'grid', gridTemplateColumns: '36px 1fr auto', gap: 10, alignItems: 'center',
                padding: '12px 14px',
                borderBottom: i < entries.length - 1 ? `0.5px solid ${COLORS.border}` : 'none',
                cursor: 'pointer',
                background: entry.isMe ? COLORS.card2 : 'transparent',
              }}>
                <span style={{
                  fontFamily: FONTS.mono, fontSize: isPodium ? 18 : 14,
                  fontWeight: 700, color: COLORS.text,
                  letterSpacing: '-0.03em', textAlign: 'center',
                }}>{rank}</span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <Avatar
                    initials={getInitials(entry.profile.display_name)}
                    size={32}
                    colorIndex={entry.profile.id?.charCodeAt(0) || 0}
                    src={entry.profile.avatar_url}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontSize: 13, fontWeight: entry.isMe ? 700 : 600, color: COLORS.text,
                      letterSpacing: '-0.01em',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {entry.profile.display_name}{entry.isMe ? ' · You' : ''}
                    </div>
                    <div style={{
                      fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
                      letterSpacing: '0.04em', marginTop: 2,
                    }}>
                      {convertWeight(entry.bestWeight, unit)} × {entry.bestReps}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontFamily: FONTS.mono, fontSize: 16, fontWeight: 700,
                    color: COLORS.text, letterSpacing: '-0.02em',
                  }}>
                    {convertWeight(rankMode === 'Est. 1RM' ? entry.est1RM : entry.bestWeight, unit)}
                  </div>
                  <div style={{
                    fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textDim,
                    letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2,
                  }}>
                    {rankMode === 'Est. 1RM' ? `est 1rm ${unit}` : unit}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
