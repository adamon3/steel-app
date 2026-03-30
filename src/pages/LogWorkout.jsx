import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../lib/store';
import { COLORS, Input, Button, Select, Spinner, convertWeight, convertWeightBack } from '../components/UI';

export default function LogWorkout({ prefill, onDone }) {
  const { exercises, fetchExercises, saveWorkout, profile } = useStore();
  const [title, setTitle] = useState(prefill?.title || '');
  const [workoutExercises, setWorkoutExercises] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [startTime] = useState(Date.now());
  const unit = profile?.unit_pref || 'kg';

  useEffect(() => {
    fetchExercises();
  }, []);

  useEffect(() => {
    if (prefill?.exercises) {
      setWorkoutExercises(prefill.exercises.map(e => ({
        exercise_id: e.exercise_id,
        name: exercises.find(x => x.id === e.exercise_id)?.name || 'Exercise',
        notes: e.notes || '',
        sets: e.sets.map(s => ({
          weight: convertWeight(s.weight, unit),
          reps: s.reps,
          is_pr: false,
          set_type: s.set_type || 'normal',
        })),
      })));
    }
  }, [prefill, exercises]);

  const addExercise = (ex) => {
    setWorkoutExercises(prev => [...prev, {
      exercise_id: ex.id,
      name: ex.name,
      notes: '',
      sets: [{ weight: 0, reps: 0, is_pr: false, set_type: 'normal' }],
    }]);
    setShowPicker(false);
    setSearch('');
  };

  const addSet = (exIdx) => {
    setWorkoutExercises(prev => {
      const next = [...prev];
      const lastSet = next[exIdx].sets[next[exIdx].sets.length - 1];
      next[exIdx].sets.push({ weight: lastSet?.weight || 0, reps: lastSet?.reps || 0, is_pr: false, set_type: 'normal' });
      return next;
    });
  };

  const removeSet = (exIdx, setIdx) => {
    setWorkoutExercises(prev => {
      const next = [...prev];
      next[exIdx].sets.splice(setIdx, 1);
      if (next[exIdx].sets.length === 0) next.splice(exIdx, 1);
      return next;
    });
  };

  const updateSet = (exIdx, setIdx, field, value) => {
    setWorkoutExercises(prev => {
      const next = [...prev];
      next[exIdx].sets[setIdx][field] = value;
      return next;
    });
  };

  const removeExercise = (exIdx) => {
    setWorkoutExercises(prev => prev.filter((_, i) => i !== exIdx));
  };

  const handleSave = async () => {
    if (!title.trim() || workoutExercises.length === 0) return;
    setSaving(true);
    const durationMins = Math.round((Date.now() - startTime) / 60000);
    const workout = {
      title: title.trim(),
      duration_mins: durationMins,
      steeled_from: prefill?.steeled_from || null,
      exercises: workoutExercises.map(e => ({
        exercise_id: e.exercise_id,
        notes: e.notes,
        sets: e.sets.map(s => ({
          weight: convertWeightBack(s.weight, unit),
          reps: parseInt(s.reps) || 0,
          is_pr: s.is_pr,
          set_type: s.set_type,
        })),
      })),
    };
    await saveWorkout(workout);
    setSaving(false);
    onDone?.();
  };

  const filteredExercises = exercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = {};
  filteredExercises.forEach(e => {
    if (!grouped[e.muscle_group]) grouped[e.muscle_group] = [];
    grouped[e.muscle_group].push(e);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.text }}>
          {prefill ? '📋 Steeled Workout' : '💪 Log Workout'}
        </div>
        <Button variant="ghost" onClick={onDone} style={{ fontSize: 13 }}>Cancel</Button>
      </div>

      <Input label="Workout Title" placeholder="e.g. Heavy Upper, Leg Day, Push..." value={title} onChange={e => setTitle(e.target.value)} />

      {/* Exercise list */}
      {workoutExercises.map((ex, exIdx) => (
        <div key={exIdx} style={{ background: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 12, border: `1px solid ${COLORS.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: COLORS.text }}>{ex.name}</span>
            <button onClick={() => removeExercise(exIdx)} style={{ background: 'none', border: 'none', color: COLORS.textDim, cursor: 'pointer', fontSize: 18, fontFamily: 'inherit' }}>x</button>
          </div>

          {/* Header row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 6, padding: '0 4px' }}>
            <span style={{ width: 32, fontSize: 11, color: COLORS.textDim, fontWeight: 600 }}>Set</span>
            <span style={{ flex: 1, fontSize: 11, color: COLORS.textDim, fontWeight: 600 }}>{unit}</span>
            <span style={{ flex: 1, fontSize: 11, color: COLORS.textDim, fontWeight: 600 }}>Reps</span>
            <span style={{ width: 32, fontSize: 11, color: COLORS.textDim, fontWeight: 600 }}>PR</span>
            <span style={{ width: 24 }}></span>
          </div>

          {/* Sets */}
          {ex.sets.map((set, setIdx) => (
            <div key={setIdx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ width: 32, fontSize: 13, color: COLORS.textDim, textAlign: 'center', fontWeight: 600 }}>{setIdx + 1}</span>
              <input type="number" value={set.weight || ''} placeholder="0"
                onChange={e => updateSet(exIdx, setIdx, 'weight', parseFloat(e.target.value) || 0)}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.bg, color: COLORS.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
              <input type="number" value={set.reps || ''} placeholder="0"
                onChange={e => updateSet(exIdx, setIdx, 'reps', parseInt(e.target.value) || 0)}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.bg, color: COLORS.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
              <button onClick={() => updateSet(exIdx, setIdx, 'is_pr', !set.is_pr)} style={{
                width: 32, height: 32, borderRadius: 8, border: `1px solid ${set.is_pr ? COLORS.pro : COLORS.border}`,
                background: set.is_pr ? `${COLORS.pro}22` : 'transparent', cursor: 'pointer', fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{set.is_pr ? '🏆' : ''}</button>
              <button onClick={() => removeSet(exIdx, setIdx)} style={{
                width: 24, background: 'none', border: 'none', color: COLORS.textDim, cursor: 'pointer', fontSize: 16, fontFamily: 'inherit',
              }}>-</button>
            </div>
          ))}

          <button onClick={() => addSet(exIdx)} style={{
            width: '100%', padding: 8, borderRadius: 8, border: `1px dashed ${COLORS.border}`,
            background: 'transparent', color: COLORS.accent, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', marginTop: 4,
          }}>+ Add Set</button>
        </div>
      ))}

      {/* Add exercise button */}
      <button onClick={() => setShowPicker(true)} style={{
        width: '100%', padding: 14, borderRadius: 12, border: `1px dashed ${COLORS.accent}44`,
        background: `${COLORS.accent}08`, color: COLORS.accent, cursor: 'pointer', fontSize: 14, fontWeight: 700,
        fontFamily: 'inherit', marginBottom: 16,
      }}>+ Add Exercise</button>

      {/* Save */}
      <Button onClick={handleSave} disabled={saving || !title.trim() || workoutExercises.length === 0}
        style={{ width: '100%', padding: 14, fontSize: 16, borderRadius: 12 }}>
        {saving ? 'Saving...' : '✓ Finish Workout'}
      </Button>

      {/* Exercise picker modal */}
      {showPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: COLORS.bg, flex: 1, marginTop: 40, borderRadius: '20px 20px 0 0', padding: 16, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>Choose Exercise</span>
              <Button variant="ghost" onClick={() => { setShowPicker(false); setSearch(''); }}>Close</Button>
            </div>
            <Input placeholder="Search exercises..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 12 }} />
            {Object.entries(grouped).map(([group, exs]) => (
              <div key={group}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textDim, padding: '8px 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>{group}</div>
                {exs.map(ex => (
                  <button key={ex.id} onClick={() => addExercise(ex)} style={{
                    display: 'block', width: '100%', padding: '12px 8px', border: 'none', borderBottom: `1px solid ${COLORS.border}`,
                    background: 'transparent', color: COLORS.text, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                  }}>{ex.name}</button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
