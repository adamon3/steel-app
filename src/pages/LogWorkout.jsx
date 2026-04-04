import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../lib/store';
import { COLORS, Button, Input, Icon, Spinner, convertWeight, convertWeightBack, formatVolume } from '../components/UI';

// ── Rest Timer Popup with audio notification ──
function RestTimer({ seconds, onDismiss }) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    if (remaining <= 0) {
      // Play beep sound when timer ends
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.3;
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.frequency.value = 1100;
          gain2.gain.value = 0.3;
          osc2.start();
          osc2.stop(ctx.currentTime + 0.2);
        }, 200);
      } catch (e) {}
      // Vibrate if supported
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      onDismiss();
      return;
    }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const pct = remaining / seconds;
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: COLORS.card, borderTop: `2px solid ${COLORS.accent}`, zIndex: 40 }}>
      {/* Progress bar */}
      <div style={{ height: 3, background: COLORS.border }}>
        <div style={{ height: 3, background: COLORS.accent, width: `${pct * 100}%`, transition: 'width 1s linear' }} />
      </div>
      <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, color: COLORS.textDim, fontWeight: 600 }}>REST TIMER</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: remaining <= 10 ? COLORS.red : COLORS.accent, fontVariantNumeric: 'tabular-nums' }}>
            {mins}:{secs.toString().padStart(2, '0')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setRemaining(r => Math.max(0, r - 30))} style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 12px', color: COLORS.text, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>-30s</button>
          <button onClick={() => setRemaining(r => r + 30)} style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 12px', color: COLORS.text, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>+30s</button>
          <button onClick={onDismiss} style={{ background: COLORS.accent, border: 'none', borderRadius: 8, padding: '8px 16px', color: COLORS.bg, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Skip</button>
        </div>
      </div>
    </div>
  );
}

// ── Completion Screen ──
function CompletionScreen({ workout, onDone, unit }) {
  const totalVol = workout.exercises.reduce((t, ex) => t + ex.sets.filter(s => s.completed).reduce((v, s) => v + (s.weight || 0) * (s.reps || 0), 0), 0);
  const totalSets = workout.exercises.reduce((t, ex) => t + ex.sets.filter(s => s.completed).length, 0);
  const prCount = workout.exercises.reduce((t, ex) => t + ex.sets.filter(s => s.completed && s.is_pr).length, 0);
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: 60, marginBottom: 8 }}>{"🎉"}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: COLORS.text, marginBottom: 4 }}>Workout Complete!</div>
      <div style={{ fontSize: 14, color: COLORS.textDim, marginBottom: 32 }}>{workout.title}</div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 32 }}>
        {[
          { v: `${workout.duration_mins}m`, l: 'Duration', e: '⏱' },
          { v: formatVolume(convertWeight(totalVol, unit)), l: unit, e: '🏋️' },
          { v: totalSets, l: 'Sets', e: '💪' },
          ...(prCount > 0 ? [{ v: prCount, l: 'PRs', e: '🏆' }] : []),
        ].map((s, i) => (
          <div key={i} style={{ background: COLORS.card, borderRadius: 12, padding: '14px 16px', border: `1px solid ${COLORS.border}`, minWidth: 70 }}>
            <div style={{ fontSize: 12, marginBottom: 4 }}>{s.e}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.text }}>{s.v}</div>
            <div style={{ fontSize: 11, color: COLORS.textDim }}>{s.l}</div>
          </div>
        ))}
      </div>
      {prCount > 0 && (
        <div style={{ background: `${COLORS.pro}15`, border: `1px solid ${COLORS.pro}33`, borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.pro }}>{"🏆"} {prCount} Personal Record{prCount > 1 ? 's' : ''}!</div>
        </div>
      )}
      <Button onClick={onDone} style={{ width: '100%', padding: 16, fontSize: 16, borderRadius: 14 }}>Done</Button>
    </div>
  );
}

// ── Template Selector ──
function TemplateSelector({ onSelect, onEmpty, templates }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 900, color: COLORS.text, marginBottom: 4 }}>Start Workout</div>
      <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 20 }}>Choose a template or start fresh</div>
      <button onClick={onEmpty} style={{
        width: '100%', padding: 16, borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 700,
        fontFamily: 'inherit', cursor: 'pointer', marginBottom: 20,
        background: COLORS.accent, color: COLORS.bg,
      }}>Start a New Workout</button>

      {templates.length > 0 && (
        <>
          <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>My Templates ({templates.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {templates.map(t => (
              <button key={t.id} onClick={() => onSelect(t)} style={{
                background: COLORS.card, borderRadius: 12, padding: 14, border: `1px solid ${COLORS.border}`,
                textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.text, marginBottom: 6 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.4 }}>
                  {(t.template_exercises || []).sort((a, b) => a.sort_order - b.sort_order).map(te => te.exercises?.name).filter(Boolean).join(', ')}
                </div>
                {t.last_used && (
                  <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 6 }}>
                    <Icon name="clock" size={12} color={COLORS.textDim} /> {new Date(t.last_used).toLocaleDateString()}
                  </div>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Logger ──
export default function LogWorkout({ prefill, onDone }) {
  const { exercises, fetchExercises, saveWorkout, profile, fetchTemplates, templates, saveTemplate, getPreviousSets } = useStore();
  const [phase, setPhase] = useState(prefill ? 'logging' : 'select'); // select | logging | complete
  const [title, setTitle] = useState(prefill?.title || '');
  const [workoutExercises, setWorkoutExercises] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [restTimer, setRestTimer] = useState(null); // seconds or null
  const [restDuration, setRestDuration] = useState(120); // default 2min
  const [completedWorkout, setCompletedWorkout] = useState(null);
  const [templateId, setTemplateId] = useState(null);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [previousData, setPreviousData] = useState({}); // exerciseId -> previous sets
  const [isPublic, setIsPublic] = useState(true);
  const [showIncompleteConfirm, setShowIncompleteConfirm] = useState(false);
  const [showUpdateTemplate, setShowUpdateTemplate] = useState(false);
  const unit = profile?.unit_pref || 'kg';

  useEffect(() => { fetchExercises(); fetchTemplates(); }, []);

  // Live timer
  useEffect(() => {
    if (phase !== 'logging') return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase, startTime]);

  // Load previous data when exercises change
  const loadPrevious = useCallback(async (exerciseId) => {
    if (previousData[exerciseId]) return;
    const prev = await getPreviousSets(exerciseId);
    if (prev) {
      setPreviousData(p => ({ ...p, [exerciseId]: prev }));
    }
  }, [previousData]);

  // Prefill from steeled workout
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

  const handleSelectTemplate = (template) => {
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
    setTemplateId(template.id);
    setPhase('logging');
    exs.forEach(e => loadPrevious(e.exercise_id));
  };

  const handleStartEmpty = () => {
    setPhase('logging');
  };

  const addExercise = (ex) => {
    setWorkoutExercises(prev => [...prev, {
      exercise_id: ex.id, name: ex.name, notes: '',
      sets: [{ weight: 0, reps: 0, is_pr: false, set_type: 'normal', completed: false }],
    }]);
    setShowPicker(false);
    setSearch('');
    loadPrevious(ex.id);
  };

  const addSet = (exIdx) => {
    setWorkoutExercises(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const last = next[exIdx].sets[next[exIdx].sets.length - 1];
      next[exIdx].sets.push({ weight: last?.weight || 0, reps: last?.reps || 0, is_pr: false, set_type: 'normal', completed: false });
      return next;
    });
  };

  const removeSet = (exIdx, setIdx) => {
    setWorkoutExercises(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[exIdx].sets.splice(setIdx, 1);
      if (next[exIdx].sets.length === 0) next.splice(exIdx, 1);
      return next;
    });
  };

  const updateSet = (exIdx, setIdx, field, value) => {
    setWorkoutExercises(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[exIdx].sets[setIdx][field] = value;
      return next;
    });
  };

  const toggleComplete = (exIdx, setIdx) => {
    setWorkoutExercises(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const wasCompleted = next[exIdx].sets[setIdx].completed;
      next[exIdx].sets[setIdx].completed = !wasCompleted;
      return next;
    });
    // Start rest timer when completing a set
    const set = workoutExercises[exIdx].sets[setIdx];
    if (!set.completed) {
      setRestTimer(restDuration);
    }
  };

  const removeExercise = (exIdx) => {
    setWorkoutExercises(prev => prev.filter((_, i) => i !== exIdx));
  };

  const handleFinish = async () => {
    const hasCompleted = workoutExercises.some(ex => ex.sets.some(s => s.completed));
    if (!hasCompleted && workoutExercises.length === 0) return;

    // Check for incomplete (unchecked) sets
    const incompleteCount = workoutExercises.reduce((t, ex) => t + ex.sets.filter(s => !s.completed).length, 0);
    if (incompleteCount > 0 && !showIncompleteConfirm) {
      setShowIncompleteConfirm(true);
      return;
    }
    setShowIncompleteConfirm(false);

    if (!title.trim()) { setTitle('Workout'); }
    setSaving(true);
    const durationMins = Math.round((Date.now() - startTime) / 60000);
    const workout = {
      title: title.trim() || 'Workout',
      duration_mins: durationMins,
      steeled_from: prefill?.steeled_from || null,
      template_id: templateId,
      is_public: isPublic,
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
      setCompletedWorkout({ ...workout, duration_mins: durationMins });
      // If started from a template and exercises changed, prompt to update
      if (templateId && hasTemplateChanged()) {
        setShowUpdateTemplate(true);
      } else {
        setPhase('complete');
      }
    }
  };

  const hasTemplateChanged = () => {
    if (!templateId) return false;
    const tmpl = templates.find(t => t.id === templateId);
    if (!tmpl) return false;
    const tmplExercises = (tmpl.template_exercises || []).sort((a, b) => a.sort_order - b.sort_order);
    if (tmplExercises.length !== workoutExercises.length) return true;
    for (let i = 0; i < tmplExercises.length; i++) {
      if (tmplExercises[i].exercise_id !== workoutExercises[i].exercise_id) return true;
      if ((tmplExercises[i].default_sets || 3) !== workoutExercises[i].sets.length) return true;
    }
    return false;
  };

  const handleUpdateTemplate = async () => {
    if (templateId) {
      // Delete old template exercises and re-insert
      const { supabase } = await import('../lib/supabase');
      await supabase.from('template_exercises').delete().eq('template_id', templateId);
      const rows = workoutExercises.map((ex, i) => ({
        template_id: templateId,
        exercise_id: ex.exercise_id,
        sort_order: i,
        default_sets: ex.sets.length,
        default_reps: ex.sets[0]?.reps || 10,
        default_weight: convertWeightBack(ex.sets[0]?.weight || 0, unit),
      }));
      await supabase.from('template_exercises').insert(rows);
      await fetchTemplates();
    }
    setShowUpdateTemplate(false);
    setPhase('complete');
  };

  const handleSkipUpdateTemplate = () => {
    setShowUpdateTemplate(false);
    setPhase('complete');
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) return;
    await saveTemplate(templateName.trim(), workoutExercises);
    setShowSaveTemplate(false);
    setTemplateName('');
  };

  const elapsedMins = Math.floor(elapsed / 60);
  const elapsedSecs = elapsed % 60;

  const filteredExercises = exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));
  const grouped = {};
  filteredExercises.forEach(e => {
    if (!grouped[e.muscle_group]) grouped[e.muscle_group] = [];
    grouped[e.muscle_group].push(e);
  });

  // ── TEMPLATE SELECTOR PHASE ──
  if (phase === 'select') {
    return <TemplateSelector templates={templates} onSelect={handleSelectTemplate} onEmpty={handleStartEmpty} />;
  }

  // ── COMPLETION PHASE ──
  if (phase === 'complete' && completedWorkout) {
    return <CompletionScreen workout={completedWorkout} unit={unit} onDone={onDone} />;
  }

  // ── LOGGING PHASE ──
  const hasAnythingCompleted = workoutExercises.some(ex => ex.sets.some(s => s.completed));
  const hasAnyExercises = workoutExercises.length > 0;

  return (
    <div style={{ paddingBottom: restTimer ? 80 : 0 }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onDone} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 13, color: COLORS.textDim, fontFamily: 'inherit' }}>{"<"}</button>
          <div style={{ fontSize: 13, color: COLORS.textDim, fontVariantNumeric: 'tabular-nums' }}>
            <Icon name="clock" size={14} color={COLORS.textDim} /> {elapsedMins}:{elapsedSecs.toString().padStart(2, '0')}
          </div>
        </div>
        <button onClick={handleFinish} disabled={saving || !hasAnyExercises} style={{
          background: hasAnyExercises ? '#22C55E' : COLORS.card,
          color: hasAnyExercises ? '#fff' : COLORS.textDim,
          border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 800, fontSize: 14,
          cursor: hasAnyExercises ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
          opacity: saving ? 0.6 : 1,
        }}>{saving ? 'Saving...' : 'Finish'}</button>
      </div>

      {/* Title */}
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Workout Name"
        style={{ width: '100%', fontSize: 22, fontWeight: 800, color: COLORS.text, background: 'transparent', border: 'none', outline: 'none', marginBottom: 16, fontFamily: 'inherit', padding: 0, boxSizing: 'border-box' }} />

      {/* Exercises */}
      {workoutExercises.map((ex, exIdx) => {
        const prev = previousData[ex.exercise_id];
        const isSuperset = ex.supersetWith != null;
        const nextIsSuperset = workoutExercises[exIdx + 1]?.supersetWith === exIdx || ex.supersetWith === exIdx - 1;
        const showSupersetBadge = ex.supersetWith != null || workoutExercises.some(e => e.supersetWith === exIdx);
        return (
          <div key={exIdx}>
            {/* Superset connector line */}
            {ex.supersetWith != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '-8px 0 -4px 20px' }}>
                <div style={{ width: 2, height: 16, background: COLORS.orange }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.orange, textTransform: 'uppercase', letterSpacing: 1 }}>Superset</span>
              </div>
            )}
            <div style={{
              background: COLORS.card, borderRadius: 14, padding: 14, marginBottom: isSuperset && !nextIsSuperset ? 12 : ex.supersetWith != null ? 0 : 12,
              border: `1px solid ${showSupersetBadge ? `${COLORS.orange}44` : COLORS.border}`,
              borderBottomLeftRadius: workoutExercises[exIdx + 1]?.supersetWith === exIdx ? 0 : 14,
              borderBottomRightRadius: workoutExercises[exIdx + 1]?.supersetWith === exIdx ? 0 : 14,
              borderTopLeftRadius: ex.supersetWith != null ? 0 : 14,
              borderTopRightRadius: ex.supersetWith != null ? 0 : 14,
            }}>
            {/* Exercise header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: COLORS.accent }}>{ex.name}</span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {/* Info button */}
                <button onClick={() => {
                  setWorkoutExercises(prev => {
                    const next = JSON.parse(JSON.stringify(prev));
                    next[exIdx].showInfo = !next[exIdx].showInfo;
                    return next;
                  });
                }} style={{ background: 'none', border: 'none', color: COLORS.textDim, cursor: 'pointer', padding: '4px', fontSize: 13 }}>
                  <Icon name="search" size={14} color={COLORS.textDim} />
                </button>
                {/* Superset button */}
                {exIdx > 0 && ex.supersetWith == null && (
                  <button onClick={() => {
                    setWorkoutExercises(prev => {
                      const next = JSON.parse(JSON.stringify(prev));
                      next[exIdx].supersetWith = exIdx - 1;
                      return next;
                    });
                  }} style={{ background: 'none', border: 'none', color: COLORS.orange, cursor: 'pointer', padding: '4px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>SS</button>
                )}
                {ex.supersetWith != null && (
                  <button onClick={() => {
                    setWorkoutExercises(prev => {
                      const next = JSON.parse(JSON.stringify(prev));
                      delete next[exIdx].supersetWith;
                      return next;
                    });
                  }} style={{ background: `${COLORS.orange}20`, border: 'none', borderRadius: 4, color: COLORS.orange, cursor: 'pointer', padding: '2px 6px', fontSize: 10, fontWeight: 700, fontFamily: 'inherit' }}>Unlink</button>
                )}
                <button onClick={() => removeExercise(exIdx)} style={{ background: 'none', border: 'none', color: COLORS.textDim, cursor: 'pointer', fontSize: 16, fontFamily: 'inherit', padding: '4px 8px' }}>x</button>
              </div>
            </div>

            {/* Exercise info panel */}
            {ex.showInfo && (
              <div style={{ background: `${COLORS.accent}08`, borderRadius: 8, padding: '8px 10px', marginBottom: 10, fontSize: 13, color: COLORS.textDim, lineHeight: 1.5, border: `1px solid ${COLORS.accent}22` }}>
                {(() => { try { const { EXERCISE_INFO } = require('../components/Tools'); return EXERCISE_INFO[ex.name] || 'No instructions available yet. Check YouTube for form guides.'; } catch { return 'No instructions available.'; } })()}
              </div>
            )}

            {/* Column headers */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 6, padding: '0 2px' }}>
              <span style={{ width: 28, fontSize: 11, color: COLORS.textDim, fontWeight: 600 }}>SET</span>
              <span style={{ flex: 1, fontSize: 11, color: COLORS.textDim, fontWeight: 600 }}>PREVIOUS</span>
              <span style={{ width: 64, fontSize: 11, color: COLORS.textDim, fontWeight: 600, textAlign: 'center' }}>{unit.toUpperCase()}</span>
              <span style={{ width: 56, fontSize: 11, color: COLORS.textDim, fontWeight: 600, textAlign: 'center' }}>REPS</span>
              <span style={{ width: 36, fontSize: 11, color: COLORS.textDim, fontWeight: 600, textAlign: 'center' }}>{"✓"}</span>
            </div>

            {/* Sets */}
            {ex.sets.map((set, setIdx) => {
              const prevSet = prev && prev[setIdx];
              const isComplete = set.completed;
              const weightRef = `weight-${exIdx}-${setIdx}`;
              const repsRef = `reps-${exIdx}-${setIdx}`;
              return (
                <div key={setIdx} style={{
                  display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, padding: '4px 2px',
                  borderRadius: 8, background: isComplete ? `${COLORS.accent}12` : 'transparent',
                  transition: 'background 0.2s',
                }}>
                  <span style={{ width: 28, fontSize: 13, color: COLORS.textDim, textAlign: 'center', fontWeight: 700 }}>{setIdx + 1}</span>
                  <span
                    onClick={() => {
                      if (prevSet && (!set.weight && !set.reps)) {
                        updateSet(exIdx, setIdx, 'weight', convertWeight(prevSet.weight, unit));
                        updateSet(exIdx, setIdx, 'reps', prevSet.reps);
                      }
                    }}
                    style={{ flex: 1, fontSize: 12, color: prevSet && !set.weight && !set.reps ? COLORS.accent : COLORS.textDim, cursor: prevSet && !set.weight && !set.reps ? 'pointer' : 'default' }}>
                    {prevSet ? `${convertWeight(prevSet.weight, unit)} ${unit} x ${prevSet.reps}` : '-'}
                  </span>
                  <input
                    id={weightRef}
                    type="number"
                    inputMode="decimal"
                    value={set.weight || ''}
                    placeholder={prevSet ? String(convertWeight(prevSet.weight, unit)) : '0'}
                    onChange={e => updateSet(exIdx, setIdx, 'weight', parseFloat(e.target.value) || 0)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === 'Tab') {
                        e.preventDefault();
                        document.getElementById(repsRef)?.focus();
                      }
                    }}
                    onFocus={e => e.target.select()}
                    style={{ width: 64, padding: '8px 6px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: isComplete ? `${COLORS.accent}08` : COLORS.bg, color: COLORS.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
                  />
                  <input
                    id={repsRef}
                    type="number"
                    inputMode="numeric"
                    value={set.reps || ''}
                    placeholder={prevSet ? String(prevSet.reps) : '0'}
                    onChange={e => updateSet(exIdx, setIdx, 'reps', parseInt(e.target.value) || 0)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        toggleComplete(exIdx, setIdx);
                        // Auto-advance to next set's weight input
                        const nextWeight = document.getElementById(`weight-${exIdx}-${setIdx + 1}`);
                        if (nextWeight) setTimeout(() => nextWeight.focus(), 100);
                        else e.target.blur();
                      }
                    }}
                    onFocus={e => e.target.select()}
                    style={{ width: 56, padding: '8px 6px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: isComplete ? `${COLORS.accent}08` : COLORS.bg, color: COLORS.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
                  />
                  <button onClick={() => toggleComplete(exIdx, setIdx)} style={{
                    width: 36, height: 36, borderRadius: 8,
                    border: isComplete ? 'none' : `2px solid ${COLORS.border}`,
                    background: isComplete ? COLORS.accent : 'transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, color: isComplete ? COLORS.bg : COLORS.textDim,
                    transition: 'all 0.15s', flexShrink: 0,
                  }}>{isComplete ? '✓' : ''}</button>
                </div>
              );
            })}

            {/* Add set */}
            <button onClick={() => addSet(exIdx)} style={{
              width: '100%', padding: 8, borderRadius: 8, border: `1px dashed ${COLORS.border}`,
              background: 'transparent', color: COLORS.textDim, cursor: 'pointer', fontSize: 13,
              fontWeight: 600, fontFamily: 'inherit', marginTop: 6,
            }}>+ Add Set</button>
          </div>
          </div>
        );
      })}

      {/* Add exercise */}
      <button onClick={() => setShowPicker(true)} style={{
        width: '100%', padding: 14, borderRadius: 12, border: `1px dashed ${COLORS.accent}44`,
        background: `${COLORS.accent}08`, color: COLORS.accent, cursor: 'pointer', fontSize: 14,
        fontWeight: 700, fontFamily: 'inherit', marginBottom: 12,
      }}>+ Add Exercise</button>

      {/* Save as template */}
      {workoutExercises.length > 0 && !templateId && (
        showSaveTemplate ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Template name..."
              style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.text, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
            <button onClick={handleSaveAsTemplate} style={{ background: COLORS.accent, color: COLORS.bg, border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
            <button onClick={() => setShowSaveTemplate(false)} style={{ background: COLORS.card, color: COLORS.textDim, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>x</button>
          </div>
        ) : (
          <button onClick={() => { setShowSaveTemplate(true); setTemplateName(title); }} style={{
            width: '100%', padding: 12, borderRadius: 10, border: `1px solid ${COLORS.border}`,
            background: COLORS.card, color: COLORS.textDim, cursor: 'pointer', fontSize: 13,
            fontWeight: 600, fontFamily: 'inherit', marginBottom: 12,
          }}>{"💾"} Save as Template</button>
        )
      )}

      {/* Privacy toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderRadius: 10, background: COLORS.card,
        border: `1px solid ${COLORS.border}`, marginBottom: 12,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{isPublic ? '🌍 Public' : '🔒 Private'}</div>
          <div style={{ fontSize: 12, color: COLORS.textDim }}>{isPublic ? 'Visible in feed & leaderboards' : 'Only you can see this'}</div>
        </div>
        <button onClick={() => setIsPublic(!isPublic)} style={{
          width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
          background: isPublic ? COLORS.accent : COLORS.border, position: 'relative',
          transition: 'background 0.2s',
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: 11, background: '#fff',
            position: 'absolute', top: 3,
            left: isPublic ? 23 : 3, transition: 'left 0.2s',
          }} />
        </button>
      </div>

      {/* Cancel */}
      <button onClick={onDone} style={{
        width: '100%', padding: 12, borderRadius: 10, border: `1px solid #FF525233`,
        background: `#FF525210`, color: '#FF5252', cursor: 'pointer', fontSize: 13,
        fontWeight: 600, fontFamily: 'inherit', marginBottom: 20,
      }}>Cancel Workout</button>

      {/* Rest Timer */}
      {restTimer && <RestTimer seconds={restTimer} onDismiss={() => setRestTimer(null)} />}

      {/* Incomplete sets confirmation */}
      {showIncompleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 55, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: COLORS.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, border: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>Incomplete Sets</div>
            <div style={{ fontSize: 14, color: COLORS.textDim, marginBottom: 20, lineHeight: 1.5 }}>
              You have {workoutExercises.reduce((t, ex) => t + ex.sets.filter(s => !s.completed).length, 0)} uncompleted set{workoutExercises.reduce((t, ex) => t + ex.sets.filter(s => !s.completed).length, 0) > 1 ? 's' : ''}. Incomplete sets won't be saved. Finish anyway?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => handleFinish()} style={{
                flex: 1, padding: 12, borderRadius: 10, border: 'none', background: COLORS.accent,
                color: COLORS.bg, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              }}>Finish Anyway</button>
              <button onClick={() => setShowIncompleteConfirm(false)} style={{
                flex: 1, padding: 12, borderRadius: 10, border: `1px solid ${COLORS.border}`,
                background: 'transparent', color: COLORS.text, fontWeight: 600, fontSize: 14,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Go Back</button>
            </div>
          </div>
        </div>
      )}

      {/* Template update prompt */}
      {showUpdateTemplate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 55, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: COLORS.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, border: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>Update Template?</div>
            <div style={{ fontSize: 14, color: COLORS.textDim, marginBottom: 20, lineHeight: 1.5 }}>
              You changed exercises or sets from the original template. Want to save these changes to the template for next time?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={handleUpdateTemplate} style={{
                width: '100%', padding: 12, borderRadius: 10, border: 'none', background: COLORS.accent,
                color: COLORS.bg, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              }}>Update Template</button>
              <button onClick={handleSkipUpdateTemplate} style={{
                width: '100%', padding: 12, borderRadius: 10, border: `1px solid ${COLORS.border}`,
                background: 'transparent', color: COLORS.text, fontWeight: 600, fontSize: 14,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Keep Original</button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Picker Modal */}
      {showPicker && (
        <ExercisePicker
          exercises={exercises}
          search={search}
          setSearch={setSearch}
          onSelect={addExercise}
          onClose={() => { setShowPicker(false); setSearch(''); }}
          onCreateCustom={async (name, muscleGroup) => {
            const { user } = useStore.getState();
            const { data } = await (await import('../lib/supabase')).supabase
              .from('exercises')
              .insert({ name, muscle_group: muscleGroup, is_custom: true, created_by: user?.id })
              .select()
              .single();
            if (data) {
              await fetchExercises();
              addExercise(data);
            }
          }}
        />
      )}
    </div>
  );
}

// ── Exercise Picker with muscle group filter + custom creation ──
function ExercisePicker({ exercises, search, setSearch, onSelect, onClose, onCreateCustom }) {
  const [muscleFilter, setMuscleFilter] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState('Chest');

  const MUSCLE_GROUPS = ['All', 'Chest', 'Back', 'Shoulders', 'Legs', 'Biceps', 'Triceps', 'Forearms', 'Glutes', 'Core', 'Cardio', 'Mobility', 'Olympic'];

  const filtered = exercises.filter(e => {
    const matchSearch = search === '' || e.name.toLowerCase().includes(search.toLowerCase());
    const matchGroup = muscleFilter === 'All' || e.muscle_group === muscleFilter;
    return matchSearch && matchGroup;
  });

  const grouped = {};
  filtered.forEach(e => {
    if (!grouped[e.muscle_group]) grouped[e.muscle_group] = [];
    grouped[e.muscle_group].push(e);
  });

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreateCustom(newName.trim(), newGroup);
    setShowCreate(false);
    setNewName('');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: COLORS.bg, flex: 1, marginTop: 20, borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '16px 16px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>Choose Exercise</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowCreate(true)} style={{
                background: COLORS.accent, border: 'none', borderRadius: 6, padding: '6px 10px',
                cursor: 'pointer', fontSize: 12, color: COLORS.bg, fontWeight: 700, fontFamily: 'inherit',
              }}>+ New</button>
              <button onClick={onClose} style={{
                background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6,
                padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: COLORS.textDim, fontFamily: 'inherit',
              }}>Close</button>
            </div>
          </div>

          {/* Search */}
          <input placeholder="Search exercises..." value={search} onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`,
              background: COLORS.card, color: COLORS.text, fontSize: 14, fontFamily: 'inherit',
              outline: 'none', marginBottom: 10, boxSizing: 'border-box',
            }} />

          {/* Muscle group filter */}
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 10 }}>
            {MUSCLE_GROUPS.map(g => (
              <button key={g} onClick={() => setMuscleFilter(g)} style={{
                padding: '5px 10px', borderRadius: 16, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit',
                background: muscleFilter === g ? COLORS.accent : COLORS.card,
                color: muscleFilter === g ? COLORS.bg : COLORS.textDim,
              }}>{g}</button>
            ))}
          </div>
        </div>

        {/* Exercise list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 20px' }}>
          {Object.keys(grouped).length === 0 && (
            <div style={{ textAlign: 'center', padding: 30, color: COLORS.textDim }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>No exercises found</div>
              <button onClick={() => setShowCreate(true)} style={{
                background: COLORS.accent, border: 'none', borderRadius: 8, padding: '10px 20px',
                cursor: 'pointer', fontSize: 13, color: COLORS.bg, fontWeight: 700, fontFamily: 'inherit',
              }}>Create Custom Exercise</button>
            </div>
          )}
          {Object.entries(grouped).sort(([a],[b]) => a.localeCompare(b)).map(([group, exs]) => (
            <div key={group}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: COLORS.accent, padding: '10px 0 4px',
                textTransform: 'uppercase', letterSpacing: 1,
                position: 'sticky', top: 0, background: COLORS.bg, zIndex: 1,
              }}>{group} ({exs.length})</div>
              {exs.sort((a,b) => a.name.localeCompare(b.name)).map(ex => (
                <button key={ex.id} onClick={() => onSelect(ex)} style={{
                  display: 'flex', width: '100%', padding: '11px 8px', border: 'none',
                  borderBottom: `1px solid ${COLORS.border}`, background: 'transparent',
                  color: COLORS.text, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
                  textAlign: 'left', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span>{ex.name}</span>
                  {ex.is_custom && <span style={{ fontSize: 10, color: COLORS.textDim, background: COLORS.card, padding: '2px 6px', borderRadius: 4 }}>Custom</span>}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Create custom exercise overlay */}
        {showCreate && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, background: COLORS.card,
            borderTop: `1px solid ${COLORS.border}`, borderRadius: '16px 16px 0 0',
            padding: 20, zIndex: 2,
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, marginBottom: 12 }}>Create Custom Exercise</div>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Exercise name"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`,
                background: COLORS.bg, color: COLORS.text, fontSize: 14, fontFamily: 'inherit',
                outline: 'none', marginBottom: 10, boxSizing: 'border-box',
              }} />
            <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 6, fontWeight: 600 }}>Muscle Group</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 14 }}>
              {MUSCLE_GROUPS.filter(g => g !== 'All').map(g => (
                <button key={g} onClick={() => setNewGroup(g)} style={{
                  padding: '5px 10px', borderRadius: 16, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                  background: newGroup === g ? COLORS.accent : COLORS.bg,
                  color: newGroup === g ? COLORS.bg : COLORS.textDim,
                }}>{g}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCreate} disabled={!newName.trim()} style={{
                flex: 1, padding: 12, borderRadius: 8, border: 'none', background: COLORS.accent,
                color: COLORS.bg, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                opacity: newName.trim() ? 1 : 0.5,
              }}>Create & Add</button>
              <button onClick={() => setShowCreate(false)} style={{
                padding: '12px 16px', borderRadius: 8, border: `1px solid ${COLORS.border}`,
                background: 'transparent', color: COLORS.textDim, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
              }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
