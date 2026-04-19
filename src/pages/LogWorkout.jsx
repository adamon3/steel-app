import React, { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { COLORS, Icon, convertWeight, convertWeightBack } from '../components/UI';

const FONTS = {
  sans: "'Inter Tight', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
};

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function fmt(seconds) {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
}

function relativeTime(date) {
  if (!date) return '';
  const d = Math.floor((Date.now() - new Date(date)) / 86400000);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function estimate1RM(w, r) {
  if (!w || !r) return 0;
  if (r === 1) return w;
  return Math.round(w * (1 + r / 30));
}

// ═══════════════════════════════════════════════════════════════
// REST BAR — asymmetric Steel style
// ═══════════════════════════════════════════════════════════════

function RestBar({ state, elapsed, duration }) {
  if (state === 'active') {
    const pct = Math.max(0, Math.min(100, (elapsed / duration) * 100));
    const remaining = Math.max(0, duration - elapsed);
    return (
      <div style={{ padding: '14px 4px 16px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontFamily: FONTS.mono, fontSize: 9,
          color: COLORS.textDim, letterSpacing: '0.14em', textTransform: 'uppercase',
          fontWeight: 500, marginBottom: 6,
        }}>
          <span>REST</span>
          <span style={{ color: COLORS.text, fontSize: 11, letterSpacing: '0.04em' }}>
            {fmt(remaining)} REMAINING
          </span>
        </div>
        <div style={{ height: 3, background: COLORS.border, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            width: `${pct}%`, height: '100%', background: COLORS.text,
            transition: 'width 1s linear',
          }} />
        </div>
      </div>
    );
  }

  // Thin divider line + mono timer in middle, for past/upcoming
  const label = duration < 60 ? `${duration}s` : fmt(duration);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '3px 20px',
      opacity: state === 'past' ? 0.6 : 0.4,
    }}>
      <div style={{ flex: 1, height: 1, background: COLORS.border }} />
      <span style={{
        fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textDim,
        letterSpacing: '0.12em', fontWeight: 500,
      }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: COLORS.border }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SET ROW — table structure
// ═══════════════════════════════════════════════════════════════

const COLS = '24px 1fr 64px 52px 36px';

function SetRow({ exIdx, setIdx, set, prevSet, unit, onComplete, onUncomplete, onUpdate, onTogglePR }) {
  const weightRef = `w-${exIdx}-${setIdx}`;
  const repsRef = `r-${exIdx}-${setIdx}`;
  const isPRvsPrev = prevSet && set.completed && set.weight > prevSet.weight;

  if (set.completed) {
    // Completed: wash background, plain numbers, filled check
    return (
      <div style={{
        display: 'grid', gridTemplateColumns: COLS, gap: 10, alignItems: 'center',
        padding: '12px 4px', background: COLORS.card2, borderRadius: 10, margin: '4px 0',
      }}>
        <span style={{
          textAlign: 'center', fontFamily: FONTS.mono,
          fontSize: 12, fontWeight: 500, color: COLORS.textDim,
        }}>{setIdx + 1}</span>

        <span style={{
          fontFamily: FONTS.mono, fontSize: 12, color: COLORS.textDim,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {prevSet ? `${convertWeight(prevSet.weight, unit)} × ${prevSet.reps}` : '—'}
          {(set.is_pr || isPRvsPrev) && (
            <span style={{
              background: '#BFE600', color: '#0A0A0A',
              fontSize: 9, fontWeight: 700, padding: '2px 6px',
              borderRadius: 4, letterSpacing: '0.05em',
            }}>PR</span>
          )}
        </span>

        <span onClick={onUncomplete} style={{
          textAlign: 'center', fontFamily: FONTS.mono, fontSize: 18, fontWeight: 700,
          color: COLORS.text, letterSpacing: '-0.02em', cursor: 'pointer',
        }}>{set.weight || '—'}</span>

        <span onClick={onUncomplete} style={{
          textAlign: 'center', fontFamily: FONTS.mono, fontSize: 18, fontWeight: 700,
          color: COLORS.text, letterSpacing: '-0.02em', cursor: 'pointer',
        }}>{set.reps || '—'}</span>

        <span style={{ textAlign: 'center' }}>
          <button onClick={onUncomplete} onDoubleClick={onTogglePR} style={{
            display: 'inline-flex', width: 24, height: 24, borderRadius: 6,
            background: COLORS.text, color: COLORS.bg, alignItems: 'center',
            justifyContent: 'center', border: 'none', cursor: 'pointer', padding: 0,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke={COLORS.bg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        </span>
      </div>
    );
  }

  // Upcoming: pill inputs, empty check
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: COLS, gap: 10, alignItems: 'center',
      padding: '10px 4px',
    }}>
      <span style={{
        textAlign: 'center', fontFamily: FONTS.mono,
        fontSize: 12, fontWeight: 500, color: COLORS.textDim,
      }}>{setIdx + 1}</span>

      <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.textDim }}>
        {prevSet ? `${convertWeight(prevSet.weight, unit)} × ${prevSet.reps}` : '—'}
      </span>

      <input
        id={weightRef} type="number" inputMode="decimal" enterKeyHint="next"
        value={set.weight || ''}
        placeholder={prevSet ? String(convertWeight(prevSet.weight, unit)) : '0'}
        onChange={e => onUpdate('weight', parseFloat(e.target.value) || 0)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById(repsRef)?.focus(); } }}
        onFocus={e => e.target.select()}
        style={{
          textAlign: 'center', fontFamily: FONTS.mono,
          fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em',
          background: COLORS.card2, border: 'none', borderRadius: 8,
          padding: '9px 0', color: COLORS.text,
          outline: 'none', width: '100%', boxSizing: 'border-box',
          fontVariantNumeric: 'tabular-nums',
        }}
      />

      <input
        id={repsRef} type="number" inputMode="numeric" enterKeyHint="done"
        value={set.reps || ''}
        placeholder={prevSet ? String(prevSet.reps) : '0'}
        onChange={e => onUpdate('reps', parseInt(e.target.value) || 0)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onComplete(); } }}
        onFocus={e => e.target.select()}
        style={{
          textAlign: 'center', fontFamily: FONTS.mono,
          fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em',
          background: COLORS.card2, border: 'none', borderRadius: 8,
          padding: '9px 0', color: COLORS.text,
          outline: 'none', width: '100%', boxSizing: 'border-box',
          fontVariantNumeric: 'tabular-nums',
        }}
      />

      <span style={{ textAlign: 'center' }}>
        <button onClick={onComplete} style={{
          display: 'inline-flex', width: 24, height: 24, borderRadius: 6,
          background: COLORS.card2, alignItems: 'center', justifyContent: 'center',
          border: 'none', cursor: 'pointer', padding: 0,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke={COLORS.textDim} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// EXERCISE
// ═══════════════════════════════════════════════════════════════

function ExerciseCard({ exIdx, exercise, prevSets, unit, restDuration, restElapsed, onUpdate, onAddSet, onRemove }) {
  const lastDate = prevSets?.[0]?.workout_date;
  const lastSet = prevSets?.[0];

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Exercise header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0 8px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontFamily: FONTS.sans, fontSize: 17, fontWeight: 700, color: COLORS.text,
            letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {exercise.name}
          </div>
          {lastSet && (
            <div style={{
              fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textDim,
              fontWeight: 500, marginTop: 2, letterSpacing: '0.04em',
            }}>
              LAST · {convertWeight(lastSet.weight, unit)} × {lastSet.reps}{lastDate ? ` · ${formatDate(lastDate)}` : ''}
            </div>
          )}
        </div>
        <button onClick={onRemove} style={{
          background: 'none', border: 'none', color: COLORS.textDim,
          cursor: 'pointer', fontSize: 18, padding: 4, lineHeight: 1,
        }}>×</button>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: COLS, gap: 10, alignItems: 'center',
        padding: '8px 4px',
        fontFamily: FONTS.mono, fontSize: 9, fontWeight: 500,
        color: COLORS.textDim, letterSpacing: '0.14em', textTransform: 'uppercase',
        borderBottom: `0.5px solid ${COLORS.border}`,
      }}>
        <span style={{ textAlign: 'center' }}>#</span>
        <span>Previous</span>
        <span style={{ textAlign: 'center' }}>{unit}</span>
        <span style={{ textAlign: 'center' }}>Reps</span>
        <span></span>
      </div>

      {/* Set rows with rest between */}
      {exercise.sets.map((set, i) => {
        const prevSet = prevSets?.[i];
        const thisDone = set.completed;
        const nextDone = exercise.sets[i + 1]?.completed;
        const nextIsActive = !nextDone && exercise.sets.findIndex(s => !s.completed) === i + 1;

        let restState = 'upcoming';
        if (thisDone && nextIsActive) restState = 'active';
        else if (thisDone && nextDone) restState = 'past';

        return (
          <React.Fragment key={i}>
            <SetRow
              exIdx={exIdx}
              setIdx={i}
              set={set}
              prevSet={prevSet}
              unit={unit}
              onComplete={() => onUpdate(i, { completed: true })}
              onUncomplete={() => onUpdate(i, { completed: false })}
              onUpdate={(field, val) => onUpdate(i, { [field]: val })}
              onTogglePR={() => onUpdate(i, { is_pr: !set.is_pr })}
            />
            {i < exercise.sets.length - 1 && (
              <RestBar
                state={restState}
                elapsed={restState === 'active' ? restElapsed : 0}
                duration={restDuration}
              />
            )}
          </React.Fragment>
        );
      })}

      {/* Add set */}
      <button onClick={onAddSet} style={{
        width: '100%', marginTop: 10,
        background: 'none', border: `1px dashed ${COLORS.border}`,
        color: COLORS.textDim, padding: '11px 0', borderRadius: 10,
        fontFamily: FONTS.mono, fontSize: 11, fontWeight: 500,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        cursor: 'pointer',
      }}>+ Add set · {fmt(restDuration)}</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Exercise picker
// ═══════════════════════════════════════════════════════════════

function ExercisePicker({ exercises, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const filtered = exercises
    .filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 100);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: COLORS.bg, zIndex: 40,
      display: 'flex', flexDirection: 'column', padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', padding: 4, cursor: 'pointer',
        }}>
          <Icon name="back" size={20} color={COLORS.text} />
        </button>
        <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, letterSpacing: '-0.01em' }}>
          Add exercise
        </div>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search exercises..."
        autoFocus
        style={{
          width: '100%', padding: '12px 14px', borderRadius: 10,
          border: `1px solid ${COLORS.border}`, background: COLORS.card,
          color: COLORS.text, fontSize: 14, fontFamily: FONTS.sans,
          outline: 'none', marginBottom: 12, boxSizing: 'border-box',
        }}
      />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.map(e => (
          <button key={e.id} onClick={() => onSelect(e)} style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '14px 4px', background: 'transparent', border: 'none',
            borderBottom: `0.5px solid ${COLORS.border}`, cursor: 'pointer',
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.text, fontFamily: FONTS.sans }}>{e.name}</div>
            {e.muscle_group && (
              <div style={{
                fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
                marginTop: 3, letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>{e.muscle_group}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Template selector
// ═══════════════════════════════════════════════════════════════

function TemplateSelector({ templates, onPick, onEmpty }) {
  return (
    <div style={{ padding: '40px 0' }}>
      <div style={{
        fontSize: 28, fontWeight: 800, color: COLORS.text,
        letterSpacing: '-0.03em', marginBottom: 4, fontFamily: FONTS.sans,
      }}>
        Start a workout
      </div>
      <div style={{ fontSize: 14, color: COLORS.textDim, marginBottom: 28 }}>
        Pick a template or start from scratch.
      </div>

      <button onClick={onEmpty} style={{
        width: '100%', padding: 14, marginBottom: 20,
        background: COLORS.text, color: COLORS.bg,
        border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
        cursor: 'pointer', fontFamily: FONTS.sans, letterSpacing: '-0.01em',
      }}>
        Empty workout
      </button>

      {templates.length > 0 && (
        <>
          <div style={{
            fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
            letterSpacing: '0.14em', fontWeight: 500, textTransform: 'uppercase',
            marginBottom: 10,
          }}>TEMPLATES</div>
          {templates.map(t => (
            <button key={t.id} onClick={() => onPick(t)} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: 14, marginBottom: 8,
              background: COLORS.card, border: `1px solid ${COLORS.border}`,
              borderRadius: 12, cursor: 'pointer',
            }}>
              <div style={{
                fontSize: 15, fontWeight: 700, color: COLORS.text,
                letterSpacing: '-0.01em', fontFamily: FONTS.sans,
              }}>
                {t.name}
              </div>
              <div style={{
                fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textDim,
                marginTop: 4, letterSpacing: '0.04em',
              }}>
                {(t.template_exercises || []).length} EXERCISES
                {t.last_used && ` · ${relativeTime(t.last_used).toUpperCase()}`}
              </div>
            </button>
          ))}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Completion
// ═══════════════════════════════════════════════════════════════

function CompletionScreen({ workout, onDone, unit }) {
  const stats = {
    sets: workout.exercises.reduce((t, e) => t + e.sets.filter(s => s.completed).length, 0),
    volume: workout.exercises.reduce((t, e) => t + e.sets.filter(s => s.completed).reduce((v, s) => v + (s.weight || 0) * (s.reps || 0), 0), 0),
    prs: workout.exercises.reduce((t, e) => t + e.sets.filter(s => s.is_pr).length, 0),
  };
  const volDisplay = stats.volume >= 1000 ? (stats.volume / 1000).toFixed(1) : String(Math.round(stats.volume));
  const volSuffix = stats.volume >= 1000 ? ' k' : ` ${unit}`;

  const oneRMs = workout.exercises.map(e => {
    const best = e.sets.filter(s => s.completed && s.weight > 0).reduce((b, s) => {
      const est = estimate1RM(s.weight, s.reps);
      return est > b.est ? { ...s, est, name: e.name || 'Exercise' } : b;
    }, { est: 0, name: e.name });
    return best.est > 0 ? best : null;
  }).filter(Boolean);

  return (
    <div style={{ padding: '32px 16px', textAlign: 'center' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 64, height: 64, borderRadius: '50%', background: COLORS.text,
        marginBottom: 20,
      }}>
        <Icon name="check" size={28} color={COLORS.bg} />
      </div>
      <div style={{
        fontSize: 28, fontWeight: 800, color: COLORS.text,
        letterSpacing: '-0.03em', marginBottom: 6, fontFamily: FONTS.sans,
      }}>
        Workout complete
      </div>
      <div style={{
        fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textDim,
        letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 28, fontWeight: 500,
      }}>
        {workout.duration_mins} MIN · {workout.exercises.length} EXERCISES
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 28 }}>
        {[
          { label: 'SETS', value: stats.sets, suffix: '' },
          { label: 'VOLUME', value: volDisplay, suffix: volSuffix },
          { label: 'PR', value: stats.prs, suffix: '' },
        ].map(s => (
          <div key={s.label} style={{
            padding: 14, background: COLORS.card, borderRadius: 12,
            border: `1px solid ${COLORS.border}`,
          }}>
            <div style={{
              fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textDim,
              letterSpacing: '0.14em', fontWeight: 500,
            }}>
              {s.label}
            </div>
            <div style={{
              fontFamily: FONTS.mono, fontSize: 24, fontWeight: 700,
              color: COLORS.text, letterSpacing: '-0.03em', marginTop: 4,
            }}>
              {s.value}<span style={{ color: COLORS.textDim, fontSize: 13, fontWeight: 500 }}>{s.suffix}</span>
            </div>
          </div>
        ))}
      </div>

      {oneRMs.length > 0 && (
        <div style={{ textAlign: 'left', marginBottom: 28 }}>
          <div style={{
            fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textDim,
            letterSpacing: '0.14em', fontWeight: 500, marginBottom: 10, textTransform: 'uppercase',
          }}>
            ESTIMATED 1RM
          </div>
          {oneRMs.map((o, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              padding: '12px 14px', background: COLORS.card, borderRadius: 10,
              border: `1px solid ${COLORS.border}`, marginBottom: 4,
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, fontFamily: FONTS.sans }}>{o.name}</span>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  fontFamily: FONTS.mono, fontSize: 16, fontWeight: 700,
                  color: COLORS.text, letterSpacing: '-0.02em',
                }}>
                  {convertWeight(o.est, unit)} <span style={{ fontSize: 11, color: COLORS.textDim, fontWeight: 500 }}>{unit}</span>
                </span>
                <div style={{
                  fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
                  letterSpacing: '0.04em', marginTop: 2,
                }}>
                  FROM {convertWeight(o.weight, unit)} × {o.reps}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={onDone} style={{
        width: '100%', padding: 14, background: COLORS.text, color: COLORS.bg,
        border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
        cursor: 'pointer', fontFamily: FONTS.sans, letterSpacing: '-0.01em',
      }}>Done</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

export default function LogWorkout({ prefill, onDone, onMinimize }) {
  const { exercises, fetchExercises, saveWorkout, profile, fetchTemplates, templates, getPreviousSets } = useStore();
  const [phase, setPhase] = useState(prefill ? 'logging' : 'select');
  const [title, setTitle] = useState(prefill?.title || 'Workout');
  const [workoutExercises, setWorkoutExercises] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [previousData, setPreviousData] = useState({});
  const [completedWorkout, setCompletedWorkout] = useState(null);
  const [restDuration] = useState(120);
  const [restStartedAt, setRestStartedAt] = useState(null);
  const [restElapsed, setRestElapsed] = useState(0);
  const [editingTitle, setEditingTitle] = useState(false);

  const unit = profile?.unit_pref || 'kg';

  useEffect(() => { fetchExercises(); fetchTemplates(); }, []);

  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [startTime]);

  useEffect(() => {
    if (!restStartedAt) { setRestElapsed(0); return; }
    const iv = setInterval(() => {
      setRestElapsed(Math.floor((Date.now() - restStartedAt) / 1000));
    }, 500);
    return () => clearInterval(iv);
  }, [restStartedAt]);

  const loadPrevious = async (exId) => {
    const prev = await getPreviousSets(exId);
    setPreviousData(p => ({ ...p, [exId]: prev }));
  };

  useEffect(() => {
    if (prefill?.exercises && exercises.length > 0) {
      const mapped = prefill.exercises.map(e => {
        const name = e.name || exercises.find(x => x.id === e.exercise_id)?.name || 'Exercise';
        return {
          exercise_id: e.exercise_id, name, notes: e.notes || '',
          sets: e.sets.map(s => ({
            weight: convertWeight(s.weight, unit), reps: s.reps,
            is_pr: false, set_type: s.set_type || 'normal', completed: false,
          })),
        };
      });
      setWorkoutExercises(mapped);
      mapped.forEach(e => loadPrevious(e.exercise_id));
    }
  }, [prefill, exercises]);

  const pickTemplate = (template) => {
    const exs = (template.template_exercises || [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(te => ({
        exercise_id: te.exercise_id,
        name: te.exercises?.name || 'Exercise',
        notes: '',
        sets: Array.from({ length: te.default_sets || 3 }, () => ({
          weight: convertWeight(te.default_weight || 0, unit),
          reps: te.default_reps || 10,
          is_pr: false, set_type: 'normal', completed: false,
        })),
      }));
    setWorkoutExercises(exs);
    setTitle(template.name);
    setPhase('logging');
    exs.forEach(e => loadPrevious(e.exercise_id));
  };

  const addExercise = (ex) => {
    setWorkoutExercises(prev => [...prev, {
      exercise_id: ex.id, name: ex.name, notes: '',
      sets: [{ weight: 0, reps: 0, is_pr: false, set_type: 'normal', completed: false }],
    }]);
    setShowPicker(false);
    loadPrevious(ex.id);
  };

  const updateSet = (exIdx, setIdx, patch) => {
    setWorkoutExercises(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (patch.completed && !next[exIdx].sets[setIdx].weight) {
        const inWorkoutPrev = next[exIdx].sets.slice(0, setIdx).reverse().find(s => s.weight > 0);
        const dbPrev = previousData[next[exIdx].exercise_id]?.[setIdx];
        if (inWorkoutPrev) {
          next[exIdx].sets[setIdx].weight = inWorkoutPrev.weight;
          next[exIdx].sets[setIdx].reps = inWorkoutPrev.reps;
        } else if (dbPrev) {
          next[exIdx].sets[setIdx].weight = convertWeight(dbPrev.weight, unit);
          next[exIdx].sets[setIdx].reps = dbPrev.reps;
        }
      }
      Object.assign(next[exIdx].sets[setIdx], patch);
      return next;
    });

    if (patch.completed) setRestStartedAt(Date.now());
    if (patch.completed === false) setRestStartedAt(null);
  };

  const addSet = (exIdx) => {
    setWorkoutExercises(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const lastSet = next[exIdx].sets[next[exIdx].sets.length - 1];
      next[exIdx].sets.push({
        weight: lastSet?.weight || 0, reps: lastSet?.reps || 0,
        is_pr: false, set_type: 'normal', completed: false,
      });
      return next;
    });
  };

  const removeExercise = (exIdx) => {
    setWorkoutExercises(prev => prev.filter((_, i) => i !== exIdx));
  };

  const handleFinish = async () => {
    const hasCompleted = workoutExercises.some(ex => ex.sets.some(s => s.completed));
    if (!hasCompleted) return;
    setSaving(true);
    const durationMins = Math.max(1, Math.round((Date.now() - startTime) / 60000));
    const workout = {
      title: title.trim() || 'Workout',
      notes: '',
      duration_mins: durationMins,
      steeled_from: prefill?.steeled_from || null,
      template_id: null,
      is_public: true,
      exercises: workoutExercises.map(e => ({
        exercise_id: e.exercise_id, notes: e.notes,
        sets: e.sets.map(s => ({
          weight: convertWeightBack(s.weight || 0, unit),
          reps: parseInt(s.reps) || 0,
          is_pr: s.is_pr, set_type: s.set_type, completed: s.completed,
        })),
      })),
    };
    const saved = await saveWorkout(workout);
    setSaving(false);
    if (saved) {
      setCompletedWorkout({ ...workout, id: saved.id, duration_mins: durationMins });
      setPhase('complete');
    }
  };

  // ─── Phase: select ───
  if (phase === 'select') {
    return (
      <div style={{ padding: '0 16px' }}>
        <TemplateSelector
          templates={templates}
          onPick={pickTemplate}
          onEmpty={() => setPhase('logging')}
        />
      </div>
    );
  }

  // ─── Phase: complete ───
  if (phase === 'complete' && completedWorkout) {
    return <CompletionScreen workout={completedWorkout} onDone={onDone} unit={unit} />;
  }

  // ─── Phase: logging ───
  const hasAnyExercises = workoutExercises.length > 0;
  const today = formatDate(new Date());

  return (
    <div style={{ paddingBottom: 100, paddingTop: 64, fontFamily: FONTS.sans }}>
      {/* Top bar: back | centered title+meta | Finish */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30,
        background: COLORS.isDark ? 'rgba(10,10,10,0.85)' : 'rgba(250,250,250,0.85)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `0.5px solid ${COLORS.border}`,
        padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 16px 10px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 10,
      }}>
        <button onClick={() => {
          if (hasAnyExercises && onMinimize) {
            onMinimize({ title: title || 'Workout', elapsed });
          } else {
            onDone();
          }
        }} style={{
          background: 'none', border: 'none', padding: 4, cursor: 'pointer',
          flexShrink: 0,
        }}>
          <Icon name="back" size={20} color={COLORS.text} />
        </button>

        {/* Centered: workout name + meta */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          lineHeight: 1.1, minWidth: 0,
        }}>
          {editingTitle ? (
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={e => { if (e.key === 'Enter') setEditingTitle(false); }}
              autoFocus
              style={{
                fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em',
                color: COLORS.text, background: 'transparent', border: 'none',
                outline: 'none', textAlign: 'center', padding: 0, fontFamily: FONTS.sans,
                maxWidth: 200,
              }}
            />
          ) : (
            <span onClick={() => setEditingTitle(true)} style={{
              fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em',
              color: COLORS.text, cursor: 'pointer',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200,
            }}>{title}</span>
          )}
          <span style={{
            fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
            fontWeight: 500, marginTop: 2, letterSpacing: '0.06em',
          }}>{fmt(elapsed)} · {today}</span>
        </div>

        <button onClick={handleFinish} disabled={saving || !hasAnyExercises} style={{
          background: hasAnyExercises ? COLORS.text : 'transparent',
          color: hasAnyExercises ? COLORS.bg : COLORS.textDim,
          border: `1px solid ${hasAnyExercises ? COLORS.text : COLORS.border}`,
          borderRadius: 999, padding: '7px 16px', fontWeight: 700, fontSize: 13,
          cursor: hasAnyExercises ? 'pointer' : 'not-allowed', fontFamily: FONTS.sans,
          opacity: saving ? 0.6 : 1, flexShrink: 0, letterSpacing: '-0.01em',
        }}>{saving ? '...' : 'Finish'}</button>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {workoutExercises.map((ex, exIdx) => (
          <ExerciseCard
            key={exIdx}
            exIdx={exIdx}
            exercise={ex}
            prevSets={previousData[ex.exercise_id]}
            unit={unit}
            restDuration={restDuration}
            restElapsed={restElapsed}
            onUpdate={(setIdx, patch) => updateSet(exIdx, setIdx, patch)}
            onAddSet={() => addSet(exIdx)}
            onRemove={() => removeExercise(exIdx)}
          />
        ))}

        <button onClick={() => setShowPicker(true)} style={{
          width: '100%', padding: 14, marginTop: 4,
          background: COLORS.text, color: COLORS.bg,
          border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
          cursor: 'pointer', fontFamily: FONTS.sans, letterSpacing: '-0.01em',
        }}>+ Add exercise</button>
      </div>

      {showPicker && (
        <ExercisePicker
          exercises={exercises}
          onSelect={addExercise}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
