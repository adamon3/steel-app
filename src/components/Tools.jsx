import React, { useState } from 'react';
import { COLORS, Icon } from '../components/UI';

// ── Plate Calculator ──
const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25]; // kg
const DEFAULT_BAR = 20; // kg

export function PlateCalculator() {
  const [targetWeight, setTargetWeight] = useState('');
  const [barWeight, setBarWeight] = useState(DEFAULT_BAR);

  const target = parseFloat(targetWeight) || 0;
  const perSide = (target - barWeight) / 2;

  const calculatePlates = () => {
    if (perSide <= 0) return [];
    let remaining = perSide;
    const result = [];
    for (const plate of DEFAULT_PLATES) {
      while (remaining >= plate - 0.01) {
        result.push(plate);
        remaining -= plate;
      }
    }
    return result;
  };

  const plates = calculatePlates();
  const actualWeight = barWeight + plates.reduce((s, p) => s + p, 0) * 2;

  return (
    <div style={{ background: COLORS.card, borderRadius: 14, padding: 16, border: `1px solid ${COLORS.border}` }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="weight" size={18} color={COLORS.accent} /> Plate Calculator
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 2 }}>
          <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 4, fontWeight: 600 }}>TARGET WEIGHT (kg)</div>
          <input type="number" inputMode="decimal" value={targetWeight} onChange={e => setTargetWeight(e.target.value)}
            placeholder="e.g. 100" style={{
              width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`,
              background: COLORS.bg, color: COLORS.text, fontSize: 16, fontFamily: 'inherit', outline: 'none',
              textAlign: 'center', fontWeight: 700, boxSizing: 'border-box',
            }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 4, fontWeight: 600 }}>BAR (kg)</div>
          <select value={barWeight} onChange={e => setBarWeight(Number(e.target.value))} style={{
            width: '100%', padding: '10px 8px', borderRadius: 8, border: `1px solid ${COLORS.border}`,
            background: COLORS.bg, color: COLORS.text, fontSize: 14, fontFamily: 'inherit', outline: 'none',
            appearance: 'none', textAlign: 'center', boxSizing: 'border-box',
          }}>
            <option value={20}>20</option>
            <option value={15}>15</option>
            <option value={10}>10</option>
            <option value={7}>7</option>
          </select>
        </div>
      </div>

      {target > 0 && perSide > 0 && (
        <div>
          <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 8 }}>
            Each side: <strong style={{ color: COLORS.text }}>{perSide}kg</strong>
          </div>
          {/* Visual bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '12px 0', marginBottom: 8 }}>
            {/* Left plates */}
            {[...plates].reverse().map((p, i) => {
              const h = 20 + (p / 25) * 30;
              return (
                <div key={`l-${i}`} style={{
                  width: p >= 10 ? 14 : 10, height: h, borderRadius: 2,
                  background: p >= 20 ? COLORS.accent : p >= 10 ? COLORS.orange : p >= 5 ? '#448AFF' : '#AB47BC',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 7, fontWeight: 700, color: COLORS.isDark ? COLORS.bg : '#fff', writingMode: 'vertical-rl' }}>{p}</span>
                </div>
              );
            })}
            {/* Bar */}
            <div style={{ width: 80, height: 8, background: COLORS.textDim, borderRadius: 4 }} />
            {/* Right plates */}
            {plates.map((p, i) => {
              const h = 20 + (p / 25) * 30;
              return (
                <div key={`r-${i}`} style={{
                  width: p >= 10 ? 14 : 10, height: h, borderRadius: 2,
                  background: p >= 20 ? COLORS.accent : p >= 10 ? COLORS.orange : p >= 5 ? '#448AFF' : '#AB47BC',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 7, fontWeight: 700, color: COLORS.isDark ? COLORS.bg : '#fff', writingMode: 'vertical-rl' }}>{p}</span>
                </div>
              );
            })}
          </div>
          {/* Plate list */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
            {plates.map((p, i) => (
              <span key={i} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 13, fontWeight: 700,
                background: p >= 20 ? `${COLORS.accent}20` : p >= 10 ? `${COLORS.orange}20` : `${COLORS.border}`,
                color: p >= 20 ? COLORS.accent : p >= 10 ? COLORS.orange : COLORS.text,
              }}>{p}kg</span>
            ))}
          </div>
          {actualWeight !== target && (
            <div style={{ fontSize: 11, color: COLORS.orange, marginTop: 8, textAlign: 'center' }}>
              Closest loadable: {actualWeight}kg
            </div>
          )}
        </div>
      )}
      {target > 0 && perSide <= 0 && (
        <div style={{ fontSize: 13, color: COLORS.textDim, textAlign: 'center', padding: 8 }}>
          Target must be more than bar weight ({barWeight}kg)
        </div>
      )}
    </div>
  );
}

// ── Exercise Info Descriptions ──
export const EXERCISE_INFO = {
  // Chest
  'Bench Press': 'Lie flat on bench. Grip bar slightly wider than shoulders. Lower to mid-chest, press up. Keep feet flat, back slightly arched.',
  'Incline Bench Press': 'Set bench to 30-45°. Grip bar shoulder-width. Lower to upper chest, press up. Targets upper chest.',
  'Dumbbell Bench Press': 'Lie flat, hold dumbbells at chest level. Press up, bringing them together at top. Greater range of motion than barbell.',
  'Push Up': 'Hands shoulder-width, body straight. Lower chest to ground, push up. Core tight throughout.',
  'Cable Fly': 'Stand between cable stations. Slight bend in elbows. Bring handles together in front of chest in a hugging motion.',
  'Dip': 'Lean forward slightly for chest focus. Lower until upper arms are parallel to ground. Press up.',
  // Back
  'Deadlift': 'Stand with feet hip-width. Grip bar outside knees. Drive through heels, hips and knees extend together. Keep back neutral.',
  'Pull Up': 'Hang from bar, hands wider than shoulders. Pull chin over bar. Control the descent. Full extension at bottom.',
  'Barbell Row': 'Hinge at hips ~45°. Pull bar to lower chest/upper belly. Squeeze shoulder blades at top. Control the negative.',
  'Lat Pulldown': 'Sit at machine, grip wide. Pull bar to upper chest. Lean back slightly. Squeeze lats at bottom.',
  'Seated Cable Row': 'Sit upright, feet on platform. Pull handle to lower chest. Squeeze shoulder blades. Control the return.',
  // Shoulders
  'Overhead Press': 'Stand with bar at collarbone. Press overhead, locking elbows. Bar travels in straight line. Core braced.',
  'Lateral Raise': 'Stand with dumbbells at sides. Raise arms to shoulder height, slight bend in elbows. Lower slowly.',
  'Face Pull': 'Cable at face height, rope attachment. Pull toward face, externally rotating shoulders. Great for rear delts and posture.',
  // Legs
  'Squat': 'Bar on upper back. Feet shoulder-width. Sit back and down. Knees track over toes. Depth to at least parallel.',
  'Romanian Deadlift': 'Hold bar at hips. Push hips back, lowering bar along legs. Feel hamstring stretch. Return by driving hips forward.',
  'Leg Press': 'Sit in machine, feet shoulder-width on platform. Lower until knees at ~90°. Press up without locking knees.',
  'Bulgarian Split Squat': 'Rear foot on bench. Lower until front thigh is parallel. Keep torso upright. Great for single-leg strength.',
  'Hip Thrust': 'Upper back on bench, bar across hips. Drive hips up squeezing glutes. Chin tucked, ribs down at top.',
  // Arms
  'Barbell Curl': 'Stand with bar, underhand grip. Curl to shoulders keeping elbows still. Lower slowly. Don\'t swing.',
  'Tricep Pushdown': 'Cable at top, rope or bar. Push down until arms straight. Keep elbows at sides. Control the return.',
  'Skull Crusher': 'Lie on bench with EZ bar. Lower to forehead by bending elbows only. Press back up. Keep elbows pointing up.',
  // Core
  'Plank': 'Forearms and toes on ground. Body in straight line. Squeeze glutes and brace core. Hold position.',
  'Hanging Leg Raise': 'Hang from bar. Raise legs to 90° or higher. Control the descent. Avoid swinging.',
  'Cable Crunch': 'Kneel at cable, rope behind head. Crunch down bringing elbows to knees. Hold contraction briefly.',
};

export function ExerciseInfoPanel({ exerciseName, onClose }) {
  const info = EXERCISE_INFO[exerciseName];
  return (
    <div style={{
      background: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 8,
      border: `1px solid ${COLORS.accent}33`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.accent }}>How to: {exerciseName}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: COLORS.textDim, cursor: 'pointer', fontSize: 16, fontFamily: 'inherit' }}>x</button>
      </div>
      <div style={{ fontSize: 13, color: COLORS.textDim, lineHeight: 1.5 }}>
        {info || 'No instructions available for this exercise yet. Check YouTube for form guides.'}
      </div>
    </div>
  );
}
