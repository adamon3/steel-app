import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { COLORS, Avatar, Badge, Button, Icon, Input, Select, Spinner, EmptyState, SPORTS, getInitials, formatVolume, timeAgo, convertWeight, calcWeekStreak } from '../components/UI';
import BodyStatsComponent from '../components/BodyStats';
import { PlateCalculator as PlateCalcComponent } from '../components/Tools';

const TABS = ['Stats', 'Workouts', 'Progress', 'PRs', 'Body', 'Following'];

function SubTab({ tabs, active, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 0, borderBottom: `0.5px solid ${COLORS.border}`,
      marginBottom: 16, overflowX: 'auto', scrollbarWidth: 'none',
    }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)} style={{
          flex: 1, minWidth: 'fit-content', padding: '12px 10px', border: 'none', cursor: 'pointer',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          background: 'transparent',
          color: active === t ? COLORS.text : COLORS.textDim,
          borderBottom: active === t ? `2px solid ${COLORS.text}` : '2px solid transparent',
          marginBottom: -1, whiteSpace: 'nowrap',
        }}>{t}</button>
      ))}
    </div>
  );
}

function StatsView({ workouts, unit }) {
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [selectedDay, setSelectedDay] = useState(null);

  const total = workouts.length;
  const totalVol = workouts.reduce((s, w) => s + (Number(w.total_volume) || 0), 0);
  const totalSets = workouts.reduce((s, w) => s + (Number(w.total_sets) || 0), 0);
  const totalMins = workouts.reduce((s, w) => s + (Number(w.duration_mins) || 0), 0);
  const prSessions = workouts.filter(w => w.has_pr).length;
  const streak = calcWeekStreak(workouts.map(w => w.created_at));
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const thisWeek = workouts.filter(w => new Date(w.created_at) > weekAgo);
  const weekVol = thisWeek.reduce((s, w) => s + (Number(w.total_volume) || 0), 0);

  // Build workout map by date for calendar
  const workoutsByDate = {};
  workouts.forEach(w => {
    const key = new Date(w.created_at).toLocaleDateString('en-CA'); // YYYY-MM-DD
    if (!workoutsByDate[key]) workoutsByDate[key] = [];
    workoutsByDate[key].push(w);
  });

  // Calendar grid
  const { year, month } = calMonth;
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Monday start
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = firstDay.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const today = new Date().toLocaleDateString('en-CA');

  const prevMonth = () => setCalMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { year: p.year, month: p.month - 1 });
  const nextMonth = () => {
    const now = new Date();
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth())) return;
    setCalMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { year: p.year, month: p.month + 1 });
  };

  // Workout count this month
  const monthWorkouts = workouts.filter(w => {
    const d = new Date(w.created_at);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  // Selected day workouts
  const selectedWorkouts = selectedDay ? (workoutsByDate[selectedDay] || []) : [];

  return (
    <div>
      {/* Workout Calendar */}
      <div style={{ background: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 16, border: `1px solid ${COLORS.border}` }}>
        {/* Month nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
            <Icon name="back" size={18} color={COLORS.textDim} />
          </button>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, textAlign: 'center' }}>{monthName}</div>
            <div style={{ fontSize: 11, color: COLORS.textDim, textAlign: 'center' }}>{monthWorkouts.length} workout{monthWorkouts.length !== 1 ? 's' : ''}</div>
          </div>
          <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', opacity: (year === new Date().getFullYear() && month >= new Date().getMonth()) ? 0.3 : 1 }}>
            <span style={{ display: 'inline-block', transform: 'rotate(180deg)' }}><Icon name="back" size={18} color={COLORS.textDim} /></span>
          </button>
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: COLORS.textDim, padding: 4 }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {/* Empty cells before month starts */}
          {Array.from({ length: startDay }).map((_, i) => <div key={`e-${i}`} />)}
          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayWorkouts = workoutsByDate[dateKey] || [];
            const hasWorkout = dayWorkouts.length > 0;
            const hasPr = dayWorkouts.some(w => w.has_pr);
            const isToday = dateKey === today;
            const isSelected = dateKey === selectedDay;
            const isFuture = new Date(dateKey) > new Date();
            const count = dayWorkouts.length;

            return (
              <button key={day} onClick={() => hasWorkout ? setSelectedDay(isSelected ? null : dateKey) : null}
                style={{
                  width: '100%', aspectRatio: '1', borderRadius: '50%',
                  border: isSelected ? `2px solid ${COLORS.accent}` : isToday && !hasWorkout ? `1.5px solid ${COLORS.accent}` : 'none',
                  cursor: hasWorkout ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0, position: 'relative',
                  background: hasWorkout
                    ? hasPr ? `${COLORS.pro}25` : `${COLORS.accent}20`
                    : isToday ? `${COLORS.accent}08` : 'transparent',
                  opacity: isFuture ? 0.25 : 1,
                  transition: 'all 0.15s',
                }}>
                <span style={{
                  fontSize: 12, fontWeight: hasWorkout || isToday ? 800 : 500,
                  color: hasWorkout
                    ? hasPr ? COLORS.pro : COLORS.accent
                    : isToday ? COLORS.accent : COLORS.textDim,
                }}>{day}</span>
                {/* Green tick for workout days */}
                {hasWorkout && !hasPr && (
                  <span style={{
                    position: 'absolute', top: 0, right: 0, fontSize: 9, lineHeight: 1,
                    color: COLORS.accent,
                  }}>✓</span>
                )}
                {/* Gold trophy for PR days */}
                {hasPr && (
                  <span style={{
                    position: 'absolute', top: -1, right: -1, lineHeight: 1,
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="1"><path d="M6 9H4.5a2.5 2.5 0 010-5H6M18 9h1.5a2.5 2.5 0 000-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22M18 2H6v7a6 6 0 0012 0V2z"/></svg>
                  </span>
                )}
                {/* Multi-workout badge */}
                {count > 1 && (
                  <span style={{
                    position: 'absolute', bottom: 0, right: 0, fontSize: 7, fontWeight: 800,
                    color: COLORS.isDark ? COLORS.bg : '#fff', background: COLORS.accent,
                    width: 12, height: 12, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDay && selectedWorkouts.length > 0 && (
        <div style={{ background: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 16, border: `1px solid ${COLORS.accent}33` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.accent, marginBottom: 8 }}>
            {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          {selectedWorkouts.map(w => {
            const exercises = (w.workout_exercises || []).sort((a, b) => a.sort_order - b.sort_order);
            return (
              <div key={w.id} style={{ padding: '8px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.text }}>{w.title}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {w.has_pr && <Badge color={COLORS.pro}>PR</Badge>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  {w.duration_mins > 0 && <span style={{ fontSize: 12, color: COLORS.textDim }}>{w.duration_mins}m</span>}
                  <span style={{ fontSize: 12, color: COLORS.textDim }}>{formatVolume(convertWeight(w.total_volume, unit))} {unit}</span>
                  <span style={{ fontSize: 12, color: COLORS.textDim }}>{w.total_sets} sets</span>
                </div>
                <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 4 }}>
                  {exercises.map(we => we.exercises?.name).filter(Boolean).join(', ')}
                </div>
              </div>
            );
          })}
        </div>
      )}
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

// ── Progress Graphs ──
function ProgressView({ workouts, unit }) {
  const [selectedExercise, setSelectedExercise] = useState(null);

  // Build exercise history from all workouts
  const exerciseHistory = {};
  workouts.forEach(w => {
    (w.workout_exercises || []).forEach(we => {
      const name = we.exercises?.name;
      if (!name) return;
      if (!exerciseHistory[name]) exerciseHistory[name] = [];
      const sets = (we.sets || []);
      const maxWeight = Math.max(...sets.map(s => s.weight), 0);
      const totalVol = sets.reduce((t, s) => t + (s.weight * s.reps), 0);
      const est1RM = Math.max(...sets.map(s => s.reps > 0 ? Math.round(s.weight * (1 + s.reps / 30)) : 0), 0);
      exerciseHistory[name].push({ date: w.created_at, maxWeight, totalVol, est1RM, sets: sets.length });
    });
  });

  // Sort by most frequently done
  const exerciseNames = Object.keys(exerciseHistory).sort((a, b) => exerciseHistory[b].length - exerciseHistory[a].length);
  const active = selectedExercise || exerciseNames[0];
  const data = (exerciseHistory[active] || []).sort((a, b) => new Date(a.date) - new Date(b.date));

  // Muscle group heatmap
  const muscleCount = {};
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  workouts.filter(w => new Date(w.created_at) > weekAgo).forEach(w => {
    (w.workout_exercises || []).forEach(we => {
      const group = we.exercises?.muscle_group;
      if (group) muscleCount[group] = (muscleCount[group] || 0) + 1;
    });
  });

  if (exerciseNames.length === 0) return <EmptyState icon="weight" title="No data yet" subtitle="Complete some workouts to see your progress" />;

  // Simple SVG line chart
  const chartW = 320, chartH = 140, padL = 40, padR = 10, padT = 10, padB = 24;
  const drawW = chartW - padL - padR, drawH = chartH - padT - padB;

  const renderChart = (values, label, color) => {
    if (values.length < 2) return <div style={{ fontSize: 12, color: COLORS.textDim, padding: 8 }}>Need 2+ sessions to show graph</div>;
    const minV = Math.min(...values), maxV = Math.max(...values);
    const range = maxV - minV || 1;
    const points = values.map((v, i) => {
      const x = padL + (i / (values.length - 1)) * drawW;
      const y = padT + drawH - ((v - minV) / range) * drawH;
      return `${x},${y}`;
    }).join(' ');
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textDim, marginBottom: 4 }}>{label}</div>
        <svg width={chartW} height={chartH} style={{ maxWidth: '100%' }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(p => {
            const y = padT + drawH - p * drawH;
            const val = Math.round(minV + p * range);
            return (
              <g key={p}>
                <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke={COLORS.border} strokeWidth="0.5" />
                <text x={padL - 4} y={y + 4} fill={COLORS.textDim} fontSize="10" textAnchor="end">{convertWeight(val, unit)}</text>
              </g>
            );
          })}
          {/* Line */}
          <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {/* Dots */}
          {values.map((v, i) => {
            const x = padL + (i / (values.length - 1)) * drawW;
            const y = padT + drawH - ((v - minV) / range) * drawH;
            return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
          })}
          {/* Date labels */}
          {data.filter((_, i) => i === 0 || i === data.length - 1).map((d, i) => {
            const idx = i === 0 ? 0 : data.length - 1;
            const x = padL + (idx / (data.length - 1)) * drawW;
            return <text key={i} x={x} y={chartH - 4} fill={COLORS.textDim} fontSize="9" textAnchor={i === 0 ? 'start' : 'end'}>{new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</text>;
          })}
        </svg>
      </div>
    );
  };

  return (
    <div>
      {/* Muscle group heatmap */}
      {Object.keys(muscleCount).length > 0 && (
        <div style={{ background: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 16, border: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>This Week's Muscle Groups</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(muscleCount).sort((a, b) => b[1] - a[1]).map(([group, count]) => {
              const intensity = Math.min(count / 4, 1);
              return (
                <div key={group} style={{
                  padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: `rgba(0, 230, 118, ${0.1 + intensity * 0.3})`,
                  color: intensity > 0.5 ? COLORS.accent : COLORS.textDim,
                  border: `1px solid rgba(0, 230, 118, ${0.15 + intensity * 0.2})`,
                }}>{group} ({count})</div>
              );
            })}
          </div>
        </div>
      )}

      {/* Exercise selector */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textDim, marginBottom: 6 }}>EXERCISE</div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {exerciseNames.slice(0, 15).map(name => (
            <button key={name} onClick={() => setSelectedExercise(name)} style={{
              padding: '6px 12px', borderRadius: 16, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit',
              background: active === name ? COLORS.accent : COLORS.card,
              color: active === name ? COLORS.bg : COLORS.textDim,
            }}>{name} ({exerciseHistory[name].length})</button>
          ))}
        </div>
      </div>

      {/* Charts */}
      {data.length > 0 && (
        <div style={{ background: COLORS.card, borderRadius: 12, padding: 14, border: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, marginBottom: 12 }}>{active}</div>
          {renderChart(data.map(d => d.maxWeight), 'Max Weight', COLORS.accent)}
          {renderChart(data.map(d => d.est1RM), 'Estimated 1RM', COLORS.orange)}
          {renderChart(data.map(d => d.totalVol), 'Session Volume', '#448AFF')}
          <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 8 }}>{data.length} sessions tracked</div>
        </div>
      )}
    </div>
  );
}

// ── CSV Export ──
function exportWorkoutsCSV(workouts, unit) {
  const rows = [['Date', 'Workout', 'Exercise', 'Set', 'Weight (' + unit + ')', 'Reps', 'Est 1RM', 'PR']];
  workouts.forEach(w => {
    (w.workout_exercises || []).sort((a, b) => a.sort_order - b.sort_order).forEach(we => {
      (we.sets || []).sort((a, b) => a.set_number - b.set_number).forEach(s => {
        const weight = convertWeight(s.weight, unit);
        const est1RM = s.reps > 0 ? Math.round(s.weight * (1 + s.reps / 30) * 10) / 10 : 0;
        rows.push([
          new Date(w.created_at).toLocaleDateString(),
          w.title, we.exercises?.name || '', s.set_number,
          weight, s.reps, convertWeight(est1RM, unit), s.is_pr ? 'Yes' : '',
        ]);
      });
    });
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `steel-workouts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function WorkoutsView({ workouts, unit, onTogglePrivacy, onDelete, onEditTitle }) {
  const [menuOpen, setMenuOpen] = useState(null); // workout id
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  if (workouts.length === 0) return <EmptyState icon="weight" title="No workouts yet" subtitle="Log your first workout to see it here" />;
  return (
    <div>
      {workouts.map(w => {
        const exercises = (w.workout_exercises || []).sort((a, b) => a.sort_order - b.sort_order);
        const isMenuOpen = menuOpen === w.id;
        return (
          <div key={w.id} style={{ background: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, border: `1px solid ${COLORS.border}`, opacity: w.is_public === false ? 0.7 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                {editingId === w.id ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input value={editTitle} onChange={e => setEditTitle(e.target.value)} autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') { onEditTitle(w.id, editTitle); setEditingId(null); } }}
                      style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: `1px solid ${COLORS.accent}`, background: COLORS.bg, color: COLORS.text, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
                    <button onClick={() => { onEditTitle(w.id, editTitle); setEditingId(null); }} style={{ background: COLORS.accent, border: 'none', borderRadius: 6, padding: '4px 10px', color: COLORS.isDark ? COLORS.bg : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: COLORS.textDim, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: COLORS.text }}>{w.title}</span>
                      {w.is_public === false && <Icon name="lock" size={13} color={COLORS.textDim} />}
                      {w.has_pr && <Badge color={COLORS.pro}>PR</Badge>}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 2 }}>{timeAgo(w.created_at)}</div>
                  </>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <button onClick={() => setMenuOpen(isMenuOpen ? null : w.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', fontSize: 18, color: COLORS.textDim, fontFamily: 'inherit' }}>···</button>
                {isMenuOpen && (
                  <div style={{ position: 'absolute', right: 0, top: 28, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 10, minWidth: 150, overflow: 'hidden' }}>
                    <button onClick={() => { setEditTitle(w.title); setEditingId(w.id); setMenuOpen(null); }} style={{ width: '100%', padding: '10px 14px', border: 'none', background: 'none', color: COLORS.text, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon name="settings" size={14} color={COLORS.textDim} /> Edit Title
                    </button>
                    <button onClick={() => { onTogglePrivacy(w.id, w.is_public); setMenuOpen(null); }} style={{ width: '100%', padding: '10px 14px', border: 'none', background: 'none', color: COLORS.text, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon name={w.is_public !== false ? 'lock' : 'globe'} size={14} color={COLORS.textDim} /> {w.is_public !== false ? 'Make Private' : 'Make Public'}
                    </button>
                    <button onClick={() => { setConfirmDelete(w.id); setMenuOpen(null); }} style={{ width: '100%', padding: '10px 14px', border: 'none', background: 'none', color: COLORS.red, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, borderTop: `1px solid ${COLORS.border}` }}>
                      <Icon name="lock" size={14} color={COLORS.red} /> Delete Workout
                    </button>
                  </div>
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

      {/* Delete confirmation */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 55, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: COLORS.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 320, border: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>Delete Workout?</div>
            <div style={{ fontSize: 14, color: COLORS.textDim, marginBottom: 20, lineHeight: 1.5 }}>
              This can't be undone. The workout and all its data will be permanently removed.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { onDelete(confirmDelete); setConfirmDelete(null); }} style={{
                flex: 1, padding: 12, borderRadius: 10, border: 'none', background: COLORS.red,
                color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              }}>Delete</button>
              <button onClick={() => setConfirmDelete(null)} style={{
                flex: 1, padding: 12, borderRadius: 10, border: `1px solid ${COLORS.border}`,
                background: 'transparent', color: COLORS.text, fontWeight: 600, fontSize: 14,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
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
      <Select label="Sport" value={form.sport} onChange={e => setForm({ ...form, sport: e.target.value })}
        options={[{ value: '', label: 'Select sport...' }, ...SPORTS.map(s => ({ value: s, label: s }))]} />
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
  const [showSettings, setShowSettings] = useState(false);
  const [uploading, setUploading] = useState(false);
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

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      // Upload to Supabase Storage
      const ext = file.name.split('.').pop();
      const path = `avatars/${user.id}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        if (urlData?.publicUrl) {
          await updateProfile({ avatar_url: urlData.publicUrl + '?t=' + Date.now() });
          setUploading(false);
          return;
        }
      }
      // Fallback: convert to base64
      const reader = new FileReader();
      const dataUrl = await new Promise((res, rej) => { reader.onload = (ev) => res(ev.target.result); reader.onerror = rej; reader.readAsDataURL(file); });
      const canvas = document.createElement('canvas');
      const img = new Image();
      await new Promise((res) => { img.onload = res; img.src = dataUrl; });
      canvas.width = 200;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2, sy = (img.height - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200);
      const small = canvas.toDataURL('image/jpeg', 0.7);
      await updateProfile({ avatar_url: small });
    } catch (err) {
      console.error('Photo upload error:', err);
    }
    setUploading(false);
  };

  if (!profile) return <Spinner />;
  if (editing) return <EditProfile profile={profile} onSave={async (form) => { await updateProfile(form); setEditing(false); }} onCancel={() => setEditing(false)} />;

  const streak = calcWeekStreak(workouts.map(w => w.created_at));

  return (
    <div>
      {/* Profile header */}
      <div style={{ background: COLORS.card, borderRadius: 16, padding: 20, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Avatar with photo upload */}
          <div style={{ position: 'relative' }}>
            <Avatar
              initials={getInitials(profile.display_name)}
              size={68}
              colorIndex={profile.id?.charCodeAt(0) || 0}
              src={profile.avatar_url || null}
            />
            <label style={{
              position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: 12,
              background: COLORS.text, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', border: `2px solid ${COLORS.card}`,
            }}>
              <Icon name="plus" size={14} color={COLORS.bg} />
              <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
            </label>
            {uploading && <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 20, color: COLORS.text, letterSpacing: '-0.02em' }}>
              {profile.display_name}
            </div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: COLORS.textDim,
              marginTop: 3, letterSpacing: '0.04em',
            }}>@{profile.username}</div>
            {(profile.sport || profile.gym) && (
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: COLORS.textDim,
                marginTop: 8, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500,
              }}>
                {[profile.sport, profile.gym].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={() => setEditing(true)} style={{
              background: 'transparent', border: `1px solid ${COLORS.border}`, borderRadius: 999,
              padding: '7px 14px', cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: COLORS.text,
              letterSpacing: '0.1em', fontWeight: 500, textTransform: 'uppercase',
            }}>Edit</button>
            <button onClick={() => setShowSettings(!showSettings)} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              display: 'flex', justifyContent: 'center',
            }}>
              <Icon name="settings" size={18} color={COLORS.textDim} />
            </button>
          </div>
        </div>
        {profile.bio && (
          <div style={{
            fontSize: 13, color: COLORS.text, marginTop: 14, lineHeight: 1.45,
          }}>{profile.bio}</div>
        )}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
          marginTop: 16, paddingTop: 14, borderTop: `0.5px solid ${COLORS.border}`,
        }}>
          <div onClick={() => setSubTab('Following')} style={{ cursor: 'pointer', textAlign: 'center' }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700,
              color: COLORS.text, letterSpacing: '-0.03em',
            }}>{followerCount}</div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: COLORS.textDim,
              letterSpacing: '0.14em', fontWeight: 500, textTransform: 'uppercase', marginTop: 2,
            }}>Followers</div>
          </div>
          <div onClick={() => setSubTab('Following')} style={{ cursor: 'pointer', textAlign: 'center' }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700,
              color: COLORS.text, letterSpacing: '-0.03em',
            }}>{followingCount}</div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: COLORS.textDim,
              letterSpacing: '0.14em', fontWeight: 500, textTransform: 'uppercase', marginTop: 2,
            }}>Following</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700,
              color: COLORS.text, letterSpacing: '-0.03em',
            }}>{streak}</div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: COLORS.textDim,
              letterSpacing: '0.14em', fontWeight: 500, textTransform: 'uppercase', marginTop: 2,
            }}>Week streak</div>
          </div>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div style={{ background: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, marginBottom: 12 }}>Settings</div>

          <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 10 }}>
            Weights in: <strong style={{ color: COLORS.text }}>{unit === 'lbs' ? 'Pounds' : 'Kilograms'}</strong>
          </div>

          {workouts.length > 0 && (
            <button onClick={() => exportWorkoutsCSV(workouts, unit)} style={{
              width: '100%', padding: 12, borderRadius: 10, border: `1px solid ${COLORS.border}`,
              background: COLORS.bg, color: COLORS.text, cursor: 'pointer', fontSize: 13,
              fontWeight: 600, fontFamily: 'inherit', marginBottom: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <Icon name="settings" size={16} color={COLORS.textDim} />
              Download My Data (CSV)
            </button>
          )}

          <button onClick={async () => { await supabase.auth.signOut(); }} style={{
            width: '100%', padding: 12, borderRadius: 10, border: `1px solid #FF525233`,
            background: '#FF525210', color: '#FF5252', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
          }}>Log Out</button>
        </div>
      )}

      <SubTab tabs={TABS} active={subTab} onChange={setSubTab} />

      {loading ? <Spinner /> : (
        <>
          {subTab === 'Stats' && <StatsView workouts={workouts} unit={unit} />}
          {subTab === 'Workouts' && <WorkoutsView workouts={workouts} unit={unit}
            onTogglePrivacy={async (workoutId, currentPublic) => {
              const newVal = currentPublic === false ? true : false;
              await supabase.from('workouts').update({ is_public: newVal }).eq('id', workoutId);
              setWorkouts(prev => prev.map(w => w.id === workoutId ? { ...w, is_public: newVal } : w));
            }}
            onEditTitle={async (workoutId, newTitle) => {
              if (!newTitle.trim()) return;
              await supabase.from('workouts').update({ title: newTitle.trim() }).eq('id', workoutId);
              setWorkouts(prev => prev.map(w => w.id === workoutId ? { ...w, title: newTitle.trim() } : w));
            }}
            onDelete={async (workoutId) => {
              // Delete sets, workout_exercises, then workout (cascade should handle it but be safe)
              await supabase.from('workouts').delete().eq('id', workoutId);
              setWorkouts(prev => prev.filter(w => w.id !== workoutId));
            }}
          />}
          {subTab === 'Progress' && <ProgressView workouts={workouts} unit={unit} />}
          {subTab === 'PRs' && <PRsView workouts={workouts} unit={unit} />}
          {subTab === 'Body' && (
            <>
              <BodyStatsComponent unit={unit} />
              <div style={{ marginTop: 16 }}>
                <PlateCalcComponent />
              </div>
            </>
          )}
          {subTab === 'Following' && <FollowingView userId={user.id} onViewProfile={onViewProfile || (() => {})} />}
        </>
      )}
    </div>
  );
}
