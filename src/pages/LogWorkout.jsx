import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { COLORS, Icon, Spinner, convertWeight, convertWeightBack } from '../components/UI';

const FONTS = {
  sans: "'Inter Tight', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
};

const MUSCLE_GROUPS = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio', 'Other'];
const LIME = '#BFE600';
const LIME_WASH_DARK = 'rgba(191, 230, 0, 0.08)';
const LIME_WASH_LIGHT = 'rgba(191, 230, 0, 0.12)';

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function fmt(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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
  if (d < 7) return `${d} days ago`;
  if (d < 30) return `${Math.floor(d / 7)} weeks ago`;
  return `${Math.floor(d / 30)} months ago`;
}

function estimate1RM(w, r) {
  if (!w || !r) return 0;
  if (r === 1) return w;
  return Math.round(w * (1 + r / 30));
}

function parseRestInput(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  if (trimmed.includes(':')) {
    const [m, s] = trimmed.split(':');
    return (parseInt(m) || 0) * 60 + (parseInt(s) || 0);
  }
  const n = parseInt(trimmed) || 0;
  if (n < 20) return n * 60; // "3" = 3 min
  return n; // "90" = 90s
}

// Play a subtle ding via Web Audio
function playDing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
    if (navigator.vibrate) navigator.vibrate(100);
  } catch (e) { /* no audio, no problem */ }
}

function haptic() {
  try { if (navigator.vibrate) navigator.vibrate(15); } catch (e) {}
}

// ═══════════════════════════════════════════════════════════════
// REST BAR (collapsed / compact) — what sits between sets
// ═══════════════════════════════════════════════════════════════

function RestBar({ state, elapsed, duration, onExpand }) {
  // state: 'active' (current rest running), 'past' (already rested), 'upcoming' (hidden)
  if (state === 'upcoming') return null;

  if (state === 'active') {
    const pct = Math.max(0, Math.min(100, (elapsed / duration) * 100));
    const remaining = Math.max(0, duration - elapsed);
    return (
      <button
        onClick={onExpand}
        style={{
          display: 'block', width: '100%',
          margin: '4px 0', padding: 0, border: 'none',
          background: 'transparent', cursor: 'pointer',
        }}
      >
        <div style={{
          position: 'relative',
          height: 28, borderRadius: 6,
          background: COLORS.card2,
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            width: `${pct}%`, background: COLORS.text, opacity: 0.14,
            transition: 'width 1s linear',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700,
            color: COLORS.text, letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {fmt(remaining)}
          </div>
        </div>
      </button>
    );
  }

  // past — tiny mono divider
  const label = duration < 60 ? `${duration}s` : fmt(duration);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '4px 6px',
      opacity: 0.4,
    }}>
      <div style={{ flex: 1, height: 1, background: COLORS.border }} />
      <span style={{
        fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textDim,
        letterSpacing: '0.1em', fontWeight: 500,
      }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: COLORS.border }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// REST PANEL (full Strong-style sheet from bottom)
// ═══════════════════════════════════════════════════════════════

function RestPanel({ remaining, duration, paused, onPause, onResume, onReset, onSkip, onAdjust, onSetRemaining, onClose }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const pct = Math.max(0, Math.min(100, ((duration - remaining) / duration) * 100));

  const commitDraft = () => {
    const secs = parseRestInput(draft);
    if (secs && secs > 0 && secs < 3600) onSetRemaining?.(secs);
    setEditing(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 44,
        }}
      />
      {/* Sheet */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 45,
        background: COLORS.isDark ? '#18181A' : '#111',
        color: '#fff',
        borderTopLeftRadius: 22, borderTopRightRadius: 22,
        padding: '14px 20px calc(env(safe-area-inset-bottom, 0px) + 20px)',
        fontFamily: FONTS.sans,
      }}>
        {/* Grab handle */}
        <div style={{
          width: 40, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.2)',
          margin: '0 auto 14px',
        }} />

        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{
            fontFamily: FONTS.mono, fontSize: 10, color: 'rgba(255,255,255,0.6)',
            letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500,
          }}>Rest timer</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', padding: 4, cursor: 'pointer',
            color: 'rgba(255,255,255,0.6)', fontSize: 20, lineHeight: 1,
          }}>×</button>
        </div>

        {/* Big timer — tap to edit */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          {editing ? (
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={e => { if (e.key === 'Enter') commitDraft(); }}
              autoFocus
              placeholder="2:00"
              inputMode="text"
              style={{
                fontFamily: FONTS.mono, fontSize: 56, fontWeight: 700,
                color: '#fff', background: 'transparent',
                border: 'none', outline: 'none', textAlign: 'center',
                padding: 0, width: '100%', letterSpacing: '-0.03em',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
          ) : (
            <div
              onClick={() => { setDraft(fmt(remaining)); setEditing(true); }}
              style={{
                fontFamily: FONTS.mono, fontSize: 56, fontWeight: 700,
                color: '#fff', letterSpacing: '-0.03em',
                cursor: 'text', fontVariantNumeric: 'tabular-nums',
                lineHeight: 1, userSelect: 'none',
              }}
            >{fmt(remaining)}</div>
          )}
        </div>

        {/* Progress bar */}
        <div style={{
          height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.15)', overflow: 'hidden',
          marginBottom: 18,
        }}>
          <div style={{
            height: '100%', width: `${pct}%`, background: LIME,
            transition: 'width 1s linear',
          }} />
        </div>

        {/* −/+ row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <button onClick={() => onAdjust(-15)} style={{
            flex: 1, padding: '12px 0', borderRadius: 12,
            background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer',
            color: '#fff', fontSize: 15, fontWeight: 700,
            fontFamily: FONTS.mono, letterSpacing: '-0.01em',
          }}>−15</button>
          <button onClick={() => onAdjust(-5)} style={{
            flex: 1, padding: '12px 0', borderRadius: 12,
            background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer',
            color: '#fff', fontSize: 15, fontWeight: 700,
            fontFamily: FONTS.mono, letterSpacing: '-0.01em',
          }}>−5</button>
          <button onClick={() => onAdjust(5)} style={{
            flex: 1, padding: '12px 0', borderRadius: 12,
            background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer',
            color: '#fff', fontSize: 15, fontWeight: 700,
            fontFamily: FONTS.mono, letterSpacing: '-0.01em',
          }}>+5</button>
          <button onClick={() => onAdjust(15)} style={{
            flex: 1, padding: '12px 0', borderRadius: 12,
            background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer',
            color: '#fff', fontSize: 15, fontWeight: 700,
            fontFamily: FONTS.mono, letterSpacing: '-0.01em',
          }}>+15</button>
        </div>

        {/* Bottom actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={paused ? onResume : onPause} style={{
            flex: 1, padding: '13px 0', borderRadius: 12,
            background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer',
            color: '#fff', fontSize: 14, fontWeight: 700,
            fontFamily: FONTS.sans, letterSpacing: '-0.01em',
          }}>{paused ? 'Resume' : 'Pause'}</button>
          <button onClick={onReset} style={{
            flex: 1, padding: '13px 0', borderRadius: 12,
            background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer',
            color: '#fff', fontSize: 14, fontWeight: 700,
            fontFamily: FONTS.sans, letterSpacing: '-0.01em',
          }}>Reset</button>
          <button onClick={onSkip} style={{
            flex: 1.3, padding: '13px 0', borderRadius: 12,
            background: LIME, border: 'none', cursor: 'pointer',
            color: '#0A0A0A', fontSize: 14, fontWeight: 700,
            fontFamily: FONTS.sans, letterSpacing: '-0.01em',
          }}>Skip</button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// SET ROW — tighter Strong-like density
// ═══════════════════════════════════════════════════════════════

const COLS = '28px 1fr 60px 48px 34px';

const SET_TYPES = {
  normal: { label: (idx) => idx + 1, color: null },
  warmup: { label: () => 'W', color: '#F59E0B' },
  dropset: { label: () => 'D', color: '#A855F7' },
  failure: { label: () => 'F', color: null },
};

function SetRow({
  exIdx, setIdx, set, prevSet, unit, isActive,
  onComplete, onUncomplete, onUpdate, onTogglePR, onCycleSetType, onRemove,
  focusNextSet,
}) {
  const weightRef = `w-${exIdx}-${setIdx}`;
  const repsRef = `r-${exIdx}-${setIdx}`;
  const isPRvsPrev = prevSet && set.completed && set.weight > prevSet.weight;
  const setTypeKey = set.set_type || 'normal';
  const setTypeCfg = SET_TYPES[setTypeKey];
  const setLabel = setTypeCfg.label(setIdx);
  const setColor = setTypeCfg.color;

  const [swipeOffset, setSwipeOffset] = useState(0);
  const touchStart = useRef(null);

  const handleTouchStart = (e) => { touchStart.current = e.touches[0].clientX; };
  const handleTouchMove = (e) => {
    if (!touchStart.current) return;
    const diff = touchStart.current - e.touches[0].clientX;
    if (diff > 0 && diff < 100) setSwipeOffset(diff);
  };
  const handleTouchEnd = () => {
    if (swipeOffset > 60) onRemove?.();
    setSwipeOffset(0);
    touchStart.current = null;
  };

  const completeSet = () => {
    haptic();
    onComplete();
  };

  // Auto-populate on complete if empty
  const handleCheckTap = () => {
    if (!set.weight || !set.reps) {
      // Try prev set from DB, fall back to most recent completed in this workout
      // Handled in parent via onComplete patch
    }
    completeSet();
  };

  // Background color logic:
  // - completed → soft lime wash
  // - active (next to do) → subtle card2 highlight
  // - otherwise → transparent
  const rowBg = set.completed
    ? (COLORS.isDark ? LIME_WASH_DARK : LIME_WASH_LIGHT)
    : isActive
      ? COLORS.card2
      : 'transparent';

  const rowBorder = isActive && !set.completed
    ? `1px solid ${COLORS.border}`
    : '1px solid transparent';

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          display: 'grid', gridTemplateColumns: COLS, gap: 8, alignItems: 'center',
          padding: '7px 6px', borderRadius: 8, margin: '2px 0',
          background: rowBg,
          border: rowBorder,
          transform: `translateX(-${swipeOffset}px)`,
          transition: swipeOffset === 0 ? 'transform 0.2s, background 0.15s' : 'none',
        }}
      >
        <button onClick={onCycleSetType} style={{
          textAlign: 'center', fontFamily: FONTS.mono,
          fontSize: 12, fontWeight: 700,
          color: setColor || (set.completed ? COLORS.text : COLORS.textDim),
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        }}>{setLabel}</button>

        <span style={{
          fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textDim,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          {prevSet ? `${convertWeight(prevSet.weight, unit)}×${prevSet.reps}` : '—'}
          {(set.is_pr || isPRvsPrev) && set.completed && (
            <span style={{
              background: LIME, color: '#0A0A0A',
              fontSize: 8, fontWeight: 700, padding: '1px 5px',
              borderRadius: 3, letterSpacing: '0.05em',
            }}>PR</span>
          )}
        </span>

        {set.completed ? (
          <>
            <span onClick={onUncomplete} style={{
              textAlign: 'center', fontFamily: FONTS.mono, fontSize: 15, fontWeight: 700,
              color: COLORS.text, letterSpacing: '-0.02em', cursor: 'pointer',
              fontVariantNumeric: 'tabular-nums',
            }}>{set.weight || '—'}</span>
            <span onClick={onUncomplete} style={{
              textAlign: 'center', fontFamily: FONTS.mono, fontSize: 15, fontWeight: 700,
              color: COLORS.text, letterSpacing: '-0.02em', cursor: 'pointer',
              fontVariantNumeric: 'tabular-nums',
            }}>{set.reps || '—'}</span>
          </>
        ) : (
          <>
            <input
              id={weightRef} type="number" inputMode="decimal" enterKeyHint="next"
              value={set.weight || ''}
              placeholder={prevSet ? String(convertWeight(prevSet.weight, unit)) : '0'}
              onChange={e => onUpdate('weight', parseFloat(e.target.value) || 0)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  document.getElementById(repsRef)?.focus();
                }
              }}
              onFocus={e => e.target.select()}
              style={{
                textAlign: 'center', fontFamily: FONTS.mono,
                fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em',
                background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                borderRadius: 7,
                padding: '7px 0', color: COLORS.text,
                outline: 'none', width: '100%', boxSizing: 'border-box',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
            <input
              id={repsRef} type="number" inputMode="numeric" enterKeyHint="done"
              value={set.reps || ''}
              placeholder={prevSet ? String(prevSet.reps) : '0'}
              onChange={e => onUpdate('reps', parseInt(e.target.value) || 0)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.target.blur();
                  // Complete set on Enter after reps
                  completeSet();
                }
              }}
              onFocus={e => e.target.select()}
              style={{
                textAlign: 'center', fontFamily: FONTS.mono,
                fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em',
                background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                borderRadius: 7,
                padding: '7px 0', color: COLORS.text,
                outline: 'none', width: '100%', boxSizing: 'border-box',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
          </>
        )}

        <span style={{ textAlign: 'center' }}>
          <button
            onClick={set.completed ? onUncomplete : handleCheckTap}
            onDoubleClick={set.completed ? onTogglePR : undefined}
            style={{
              width: 26, height: 26, borderRadius: 7,
              border: 'none', padding: 0, cursor: 'pointer',
              background: set.completed ? COLORS.text : COLORS.card2,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {set.is_pr ? (
              <span style={{ fontSize: 14 }}>🏆</span>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke={set.completed ? COLORS.bg : COLORS.textDim}
                strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        </span>
      </div>
      {swipeOffset > 0 && (
        <div style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          fontFamily: FONTS.mono, fontSize: 10, color: COLORS.red,
          letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600,
          pointerEvents: 'none',
        }}>DELETE</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// EXERCISE CARD
// ═══════════════════════════════════════════════════════════════

function ExerciseCard({
  exIdx, exercise, prevSets, unit,
  restDuration, restElapsed, restAnchor, restPaused,
  onUpdate, onAddSet, onRemove, onShowHistory, onRemoveSet,
  onEditNotes, onExpandRest,
}) {
  const lastSet = prevSets?.[0];
  const lastDate = lastSet?.workout_date;
  const [showMenu, setShowMenu] = useState(false);

  // Active set index = first not-completed set
  const activeSetIdx = exercise.sets.findIndex(s => !s.completed);

  return (
    <div style={{ marginBottom: 18 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 2px 6px', position: 'relative' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div onClick={onShowHistory} style={{
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          }}>
            <div style={{
              fontFamily: FONTS.sans, fontSize: 16, fontWeight: 700, color: COLORS.text,
              letterSpacing: '-0.01em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {exercise.name}
            </div>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke={COLORS.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="M7 14l4-4 4 4 5-5" />
            </svg>
          </div>
          {lastSet && (
            <div style={{
              fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
              fontWeight: 500, marginTop: 1, letterSpacing: '0.04em',
            }}>
              LAST · {convertWeight(lastSet.weight, unit)}×{lastSet.reps}{lastDate ? ` · ${formatDate(lastDate)}` : ''}
            </div>
          )}
        </div>
        <button onClick={() => setShowMenu(!showMenu)} style={{
          background: 'none', border: 'none', color: COLORS.textDim,
          cursor: 'pointer', fontSize: 16, padding: 4, lineHeight: 1, fontWeight: 700,
        }}>⋯</button>

        {showMenu && (
          <>
            <div onClick={() => setShowMenu(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
            <div style={{
              position: 'absolute', top: 28, right: 0, zIndex: 31,
              background: COLORS.card, border: `1px solid ${COLORS.border}`,
              borderRadius: 10, minWidth: 180, padding: 4,
              boxShadow: COLORS.isDark
                ? '0 12px 32px -6px rgba(0,0,0,0.6)'
                : '0 12px 32px -6px rgba(0,0,0,0.15)',
            }}>
              <MenuItem label="Add notes" onClick={() => { setShowMenu(false); onEditNotes?.(); }} />
              <MenuItem label="View history" onClick={() => { setShowMenu(false); onShowHistory?.(); }} />
              <MenuItem label="Remove exercise" destructive onClick={() => { setShowMenu(false); onRemove?.(); }} />
            </div>
          </>
        )}
      </div>

      {/* Notes */}
      {exercise.notes && (
        <div onClick={onEditNotes} style={{
          fontSize: 12, color: COLORS.text, padding: '6px 10px', marginBottom: 6,
          background: COLORS.card2, borderRadius: 7, lineHeight: 1.4, cursor: 'text',
        }}>
          {exercise.notes}
        </div>
      )}

      {/* Column headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: COLS, gap: 8, alignItems: 'center',
        padding: '6px 6px',
        fontFamily: FONTS.mono, fontSize: 9, fontWeight: 500,
        color: COLORS.textDim, letterSpacing: '0.14em', textTransform: 'uppercase',
        borderBottom: `0.5px solid ${COLORS.border}`,
      }}>
        <span style={{ textAlign: 'center' }}>Set</span>
        <span>Previous</span>
        <span style={{ textAlign: 'center' }}>{unit}</span>
        <span style={{ textAlign: 'center' }}>Reps</span>
        <span></span>
      </div>

      {/* Set rows */}
      {exercise.sets.map((set, i) => {
        const prevSet = prevSets?.[i];
        const isThisRestActive = restAnchor && restAnchor.exIdx === exIdx && restAnchor.setIdx === i;
        const nextExists = i < exercise.sets.length - 1;

        // Rest state after this set
        let restState = 'upcoming';
        if (set.completed && isThisRestActive) restState = 'active';
        else if (set.completed && exercise.sets[i + 1]?.completed) restState = 'past';

        const isThisActive = i === activeSetIdx;

        return (
          <React.Fragment key={i}>
            <SetRow
              exIdx={exIdx}
              setIdx={i}
              set={set}
              prevSet={prevSet}
              unit={unit}
              isActive={isThisActive}
              onComplete={() => onUpdate(i, { completed: true })}
              onUncomplete={() => onUpdate(i, { completed: false })}
              onUpdate={(field, val) => onUpdate(i, { [field]: val })}
              onTogglePR={() => onUpdate(i, { is_pr: !set.is_pr })}
              onCycleSetType={() => {
                const keys = ['normal', 'warmup', 'dropset', 'failure'];
                const cur = keys.indexOf(set.set_type || 'normal');
                const next = keys[(cur + 1) % keys.length];
                onUpdate(i, { set_type: next });
              }}
              onRemove={() => onRemoveSet?.(i)}
            />
            {/* Rest bar shown AFTER every completed set that has another set following, including final */}
            {set.completed && (
              <RestBar
                state={restState}
                elapsed={restState === 'active' ? restElapsed : 0}
                duration={restDuration}
                onExpand={restState === 'active' ? onExpandRest : null}
              />
            )}
          </React.Fragment>
        );
      })}

      {/* Add set */}
      <button onClick={onAddSet} style={{
        width: '100%', marginTop: 6,
        background: 'none', border: `1px dashed ${COLORS.border}`,
        color: COLORS.textDim, padding: '9px 0', borderRadius: 8,
        fontFamily: FONTS.mono, fontSize: 10, fontWeight: 500,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        cursor: 'pointer',
      }}>+ Add set · {fmt(restDuration)}</button>
    </div>
  );
}

function MenuItem({ label, onClick, destructive }) {
  return (
    <button onClick={onClick} style={{
      display: 'block', width: '100%', textAlign: 'left',
      background: 'none', border: 'none', padding: '10px 12px',
      fontSize: 13, fontWeight: 500,
      color: destructive ? COLORS.red : COLORS.text,
      cursor: 'pointer', fontFamily: FONTS.sans, borderRadius: 6,
    }}>{label}</button>
  );
}

// ═══════════════════════════════════════════════════════════════
// Exercise picker with categories + create custom
// ═══════════════════════════════════════════════════════════════

function ExercisePicker({ exercises, onSelect, onClose, onCreate }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState('Chest');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const normalizeGroup = (g) => {
    if (!g) return 'Other';
    const lower = g.toLowerCase();
    if (lower.includes('chest')) return 'Chest';
    if (lower.includes('back') || lower.includes('lat')) return 'Back';
    if (lower.includes('leg') || lower.includes('quad') || lower.includes('glute') || lower.includes('ham') || lower.includes('calf')) return 'Legs';
    if (lower.includes('shoulder') || lower.includes('delt')) return 'Shoulders';
    if (lower.includes('arm') || lower.includes('bicep') || lower.includes('tricep')) return 'Arms';
    if (lower.includes('core') || lower.includes('ab')) return 'Core';
    if (lower.includes('cardio')) return 'Cardio';
    return 'Other';
  };

  const filtered = exercises
    .map(e => ({ ...e, _cat: normalizeGroup(e.muscle_group) }))
    .filter(e => {
      const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase());
      const matchesCat = category === 'All' || e._cat === category;
      return matchesSearch && matchesCat;
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 200);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const created = await onCreate(newName.trim(), newGroup);
      if (created) {
        onSelect(created);
        setShowCreate(false);
        setNewName('');
      } else {
        setCreateError('Could not create exercise. Try again.');
      }
    } catch (err) {
      setCreateError(err?.message || 'Something went wrong');
    }
    setCreating(false);
  };

  if (showCreate) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: COLORS.bg, zIndex: 50,
        display: 'flex', flexDirection: 'column', padding: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button onClick={() => { setShowCreate(false); setCreateError(''); }} style={{
            background: 'none', border: 'none', padding: 4, cursor: 'pointer',
          }}>
            <Icon name="back" size={20} color={COLORS.text} />
          </button>
          <div style={{
            fontSize: 20, fontWeight: 800, color: COLORS.text,
            letterSpacing: '-0.02em', fontFamily: FONTS.sans,
          }}>New exercise</div>
        </div>

        <div style={{
          fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textDim,
          letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500,
          marginBottom: 6,
        }}>Name</div>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="e.g. Zercher Squat"
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) handleCreate(); }}
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 10,
            border: `1px solid ${COLORS.border}`, background: COLORS.card,
            color: COLORS.text, fontSize: 15, fontFamily: FONTS.sans,
            outline: 'none', boxSizing: 'border-box', marginBottom: 16,
          }}
        />

        <div style={{
          fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textDim,
          letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500,
          marginBottom: 6,
        }}>Muscle group</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
          {MUSCLE_GROUPS.filter(g => g !== 'All').map(g => (
            <button key={g} onClick={() => setNewGroup(g)} style={{
              padding: '8px 14px', borderRadius: 999,
              border: `1px solid ${newGroup === g ? COLORS.text : COLORS.border}`,
              cursor: 'pointer',
              background: newGroup === g ? COLORS.text : 'transparent',
              color: newGroup === g ? COLORS.bg : COLORS.text,
              fontSize: 12, fontWeight: 600, fontFamily: FONTS.sans,
              letterSpacing: '-0.01em',
            }}>{g}</button>
          ))}
        </div>

        {createError && (
          <div style={{
            fontSize: 12, color: COLORS.red, marginBottom: 12, textAlign: 'center',
            fontFamily: FONTS.mono, letterSpacing: '0.04em',
          }}>{createError}</div>
        )}

        <button
          onClick={handleCreate}
          disabled={!newName.trim() || creating}
          style={{
            width: '100%', padding: 14,
            background: newName.trim() ? COLORS.text : COLORS.card2,
            color: newName.trim() ? COLORS.bg : COLORS.textDim,
            border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
            cursor: newName.trim() && !creating ? 'pointer' : 'not-allowed',
            fontFamily: FONTS.sans, letterSpacing: '-0.01em',
            opacity: creating ? 0.6 : 1,
          }}
        >{creating ? 'Creating…' : 'Create & add'}</button>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: COLORS.bg, zIndex: 40,
      display: 'flex', flexDirection: 'column', padding: 16,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', padding: 4, cursor: 'pointer',
          }}>
            <Icon name="back" size={20} color={COLORS.text} />
          </button>
          <div style={{
            fontSize: 20, fontWeight: 800, color: COLORS.text,
            letterSpacing: '-0.02em', fontFamily: FONTS.sans,
          }}>Exercises</div>
        </div>
        <button onClick={() => setShowCreate(true)} style={{
          background: 'none', border: `1px solid ${COLORS.border}`,
          borderRadius: 999, padding: '6px 14px', cursor: 'pointer',
          fontFamily: FONTS.sans, fontSize: 12, fontWeight: 600,
          color: COLORS.text, letterSpacing: '-0.01em',
        }}>+ New</button>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search exercises…"
        style={{
          width: '100%', padding: '12px 14px', borderRadius: 10,
          border: `1px solid ${COLORS.border}`, background: COLORS.card,
          color: COLORS.text, fontSize: 14, fontFamily: FONTS.sans,
          outline: 'none', marginBottom: 12, boxSizing: 'border-box',
        }}
      />

      <div style={{
        display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10,
        marginBottom: 6, scrollbarWidth: 'none',
      }}>
        {MUSCLE_GROUPS.map(g => (
          <button key={g} onClick={() => setCategory(g)} style={{
            padding: '7px 14px', borderRadius: 999,
            border: `1px solid ${category === g ? COLORS.text : COLORS.border}`,
            cursor: 'pointer', whiteSpace: 'nowrap',
            background: category === g ? COLORS.text : 'transparent',
            color: category === g ? COLORS.bg : COLORS.text,
            fontSize: 12, fontWeight: 600, fontFamily: FONTS.sans,
            letterSpacing: '-0.01em',
          }}>{g}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', marginTop: 6 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{
              fontSize: 14, color: COLORS.textDim, marginBottom: 14,
            }}>No exercises found</div>
            <button onClick={() => { setNewName(search); setShowCreate(true); }} style={{
              background: COLORS.text, color: COLORS.bg, border: 'none',
              borderRadius: 999, padding: '10px 20px',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
              fontFamily: FONTS.sans, letterSpacing: '-0.01em',
            }}>+ Create {search ? `"${search}"` : 'new'}</button>
          </div>
        ) : (
          filtered.map(e => (
            <button key={e.id} onClick={() => onSelect(e)} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '14px 4px', background: 'transparent', border: 'none',
              borderBottom: `0.5px solid ${COLORS.border}`, cursor: 'pointer',
            }}>
              <div style={{
                fontSize: 15, fontWeight: 600, color: COLORS.text, fontFamily: FONTS.sans,
              }}>{e.name}</div>
              <div style={{
                fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
                marginTop: 3, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500,
              }}>
                {e._cat}
                {e.is_custom && ' · Custom'}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Start Workout home
// ═══════════════════════════════════════════════════════════════

function StartWorkoutHome({ templates, onStartEmpty, onPickTemplate }) {
  return (
    <div style={{ fontFamily: FONTS.sans, paddingBottom: 60 }}>
      <div style={{
        fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
        letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500,
        marginBottom: 4,
      }}>Quick start</div>
      <h1 style={{
        fontSize: 32, fontWeight: 800, color: COLORS.text,
        letterSpacing: '-0.03em', margin: '0 0 20px',
      }}>Start workout</h1>

      <button onClick={onStartEmpty} style={{
        width: '100%', padding: 16, marginBottom: 24,
        background: COLORS.text, color: COLORS.bg,
        border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700,
        cursor: 'pointer', fontFamily: FONTS.sans, letterSpacing: '-0.01em',
      }}>
        Start empty workout
      </button>

      {templates.length > 0 ? (
        <>
          <div style={{
            fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
            letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500,
            marginBottom: 10,
          }}>My templates · {templates.length}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {templates.map(t => {
              const exs = (t.template_exercises || []).slice(0, 4);
              return (
                <button key={t.id} onClick={() => onPickTemplate(t)} style={{
                  display: 'block', textAlign: 'left',
                  padding: 14, background: COLORS.card,
                  border: `1px solid ${COLORS.border}`, borderRadius: 14,
                  cursor: 'pointer', fontFamily: FONTS.sans,
                  minHeight: 140,
                }}>
                  <div style={{
                    fontSize: 15, fontWeight: 700, color: COLORS.text,
                    letterSpacing: '-0.01em', marginBottom: 6,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{t.name}</div>
                  <div style={{
                    fontSize: 12, color: COLORS.textDim, lineHeight: 1.4,
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                    overflow: 'hidden', marginBottom: 8,
                  }}>
                    {exs.map(te => te.exercises?.name).filter(Boolean).join(', ')}
                    {(t.template_exercises?.length || 0) > 4 && ` + ${t.template_exercises.length - 4} more`}
                  </div>
                  <div style={{
                    fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textDim,
                    letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500,
                  }}>
                    {t.last_used ? relativeTime(t.last_used) : 'Not used'}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{
          padding: 20, border: `1px dashed ${COLORS.border}`, borderRadius: 14,
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 4,
          }}>No templates yet</div>
          <div style={{
            fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
            letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500,
          }}>Save a workout as template to reuse it</div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Completion
// ═══════════════════════════════════════════════════════════════

function CompletionScreen({ workout, onDone, onReopen, unit, onSaveAsTemplate }) {
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState(workout.title || '');
  const [templateSaved, setTemplateSaved] = useState(false);
  const [showTemplateInput, setShowTemplateInput] = useState(false);

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

  const handleTemplateSave = async () => {
    if (!templateName.trim() || !onSaveAsTemplate) return;
    setSavingTemplate(true);
    try {
      const result = await onSaveAsTemplate(templateName.trim());
      if (result !== false) {
        setTemplateSaved(true);
        setShowTemplateInput(false);
      }
    } catch (err) {
      alert('Could not save template: ' + (err.message || 'unknown error'));
    }
    setSavingTemplate(false);
  };

  return (
    <div style={{ padding: '32px 16px', textAlign: 'center', fontFamily: FONTS.sans }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 64, height: 64, borderRadius: '50%', background: COLORS.text,
        marginBottom: 20,
      }}>
        <Icon name="check" size={28} color={COLORS.bg} />
      </div>
      <div style={{
        fontSize: 28, fontWeight: 800, color: COLORS.text,
        letterSpacing: '-0.03em', marginBottom: 6,
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
            }}>{s.label}</div>
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
        <div style={{ textAlign: 'left', marginBottom: 20 }}>
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
              <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{o.name}</span>
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

      {onSaveAsTemplate && (
        templateSaved ? (
          <div style={{
            padding: 12, marginBottom: 10, borderRadius: 12,
            background: COLORS.card, border: `1px solid ${COLORS.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Icon name="check" size={14} color={COLORS.text} />
            <span style={{
              fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text,
              letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500,
            }}>Template saved</span>
          </div>
        ) : showTemplateInput ? (
          <div style={{
            padding: 12, marginBottom: 10, borderRadius: 12,
            background: COLORS.card, border: `1px solid ${COLORS.border}`,
          }}>
            <div style={{
              fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textDim,
              letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500,
              marginBottom: 6, textAlign: 'left',
            }}>Template name</div>
            <input
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              placeholder="e.g. Push Day A"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleTemplateSave(); }}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: `1px solid ${COLORS.border}`, background: COLORS.bg,
                color: COLORS.text, fontSize: 14, fontFamily: FONTS.sans,
                outline: 'none', marginBottom: 10, boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setShowTemplateInput(false)} style={{
                flex: 1, padding: 10, background: 'transparent', color: COLORS.text,
                border: `1px solid ${COLORS.border}`, borderRadius: 999,
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONTS.sans,
              }}>Cancel</button>
              <button onClick={handleTemplateSave} disabled={!templateName.trim() || savingTemplate} style={{
                flex: 1, padding: 10,
                background: templateName.trim() ? COLORS.text : COLORS.card2,
                color: templateName.trim() ? COLORS.bg : COLORS.textDim,
                border: 'none', borderRadius: 999,
                fontSize: 13, fontWeight: 700,
                cursor: templateName.trim() ? 'pointer' : 'not-allowed',
                fontFamily: FONTS.sans,
                opacity: savingTemplate ? 0.6 : 1,
              }}>{savingTemplate ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowTemplateInput(true)} style={{
            width: '100%', padding: 12, marginBottom: 10,
            background: 'transparent', color: COLORS.text,
            border: `1px solid ${COLORS.border}`, borderRadius: 12,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: FONTS.sans, letterSpacing: '-0.01em',
          }}>Save as template</button>
        )
      )}

      {onReopen && (
        <button onClick={onReopen} style={{
          width: '100%', padding: 12, marginBottom: 10,
          background: 'transparent', color: COLORS.textDim,
          border: `1px solid ${COLORS.border}`, borderRadius: 12,
          fontSize: 13, fontWeight: 500, cursor: 'pointer',
          fontFamily: FONTS.sans, letterSpacing: '-0.01em',
        }}>Back to workout</button>
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
// Exercise history
// ═══════════════════════════════════════════════════════════════

function ExerciseHistory({ exercise, userId, unit, onBack }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('workout_exercises')
        .select('id, workout_id, workouts:workout_id (id, title, created_at, user_id), sets (weight, reps, is_pr)')
        .eq('exercise_id', exercise.exercise_id || exercise.id);
      if (data) {
        const filtered = (data || [])
          .filter(we => we.workouts?.user_id === userId)
          .sort((a, b) => new Date(b.workouts?.created_at) - new Date(a.workouts?.created_at))
          .slice(0, 15);
        setHistory(filtered);
      }
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: COLORS.bg, zIndex: 50,
      padding: 16, overflowY: 'auto', fontFamily: FONTS.sans,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', padding: 4, cursor: 'pointer',
        }}>
          <Icon name="back" size={20} color={COLORS.text} />
        </button>
        <div>
          <div style={{
            fontSize: 20, fontWeight: 800, color: COLORS.text, letterSpacing: '-0.02em',
          }}>{exercise.name}</div>
          <div style={{
            fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
            letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500, marginTop: 2,
          }}>History</div>
        </div>
      </div>

      {loading ? <Spinner /> : history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: COLORS.textDim, fontSize: 14 }}>
          No history yet — complete a set to start tracking
        </div>
      ) : (
        history.map(we => {
          const w = we.workouts;
          const sets = we.sets || [];
          const best = sets.reduce((b, s) => s.weight > b.weight ? s : b, { weight: 0, reps: 0 });
          return (
            <div key={we.id} style={{
              padding: 14, marginBottom: 8,
              background: COLORS.card, border: `1px solid ${COLORS.border}`,
              borderRadius: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{w?.title}</div>
                  <div style={{
                    fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
                    letterSpacing: '0.1em', marginTop: 2, textTransform: 'uppercase',
                  }}>{formatDate(w?.created_at)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontFamily: FONTS.mono, fontSize: 16, fontWeight: 700,
                    color: COLORS.text, letterSpacing: '-0.02em',
                  }}>
                    {convertWeight(best.weight, unit)}<span style={{ fontSize: 10, color: COLORS.textDim, marginLeft: 2 }}>{unit}</span>
                    {' × '}{best.reps}
                  </div>
                  <div style={{
                    fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
                    letterSpacing: '0.04em', marginTop: 2,
                  }}>TOP SET</div>
                </div>
              </div>
              <div style={{
                fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textDim,
                display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 6,
                borderTop: `0.5px solid ${COLORS.border}`,
              }}>
                {sets.map((s, i) => (
                  <span key={i}>
                    {convertWeight(s.weight, unit)}×{s.reps}
                    {s.is_pr && <span style={{ color: LIME, marginLeft: 2 }}>★</span>}
                  </span>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

export default function LogWorkout({ prefill, onDone, onMinimize }) {
  const { exercises, fetchExercises, saveWorkout, profile, fetchTemplates, templates, saveTemplate, getPreviousSets, user } = useStore();
  const [phase, setPhase] = useState(prefill ? 'logging' : 'home');
  const [title, setTitle] = useState(prefill?.title || 'Workout');
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [workoutExercises, setWorkoutExercises] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [previousData, setPreviousData] = useState({});
  const [completedWorkout, setCompletedWorkout] = useState(null);

  // Rest timer state
  const [restDuration, setRestDuration] = useState(120);
  const [restStartedAt, setRestStartedAt] = useState(null);
  const [restElapsed, setRestElapsed] = useState(0);
  const [restAnchor, setRestAnchor] = useState(null); // { exIdx, setIdx }
  const [restPaused, setRestPaused] = useState(false);
  const [restPausedAt, setRestPausedAt] = useState(null);
  const [showRestPanel, setShowRestPanel] = useState(false);
  const dingPlayedRef = useRef(false);

  const [showMenu, setShowMenu] = useState(false);
  const [showNotesEditor, setShowNotesEditor] = useState(false);
  const [exerciseNotesIdx, setExerciseNotesIdx] = useState(null);
  const [showHistory, setShowHistory] = useState(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const unit = profile?.unit_pref || 'kg';

  useEffect(() => { fetchExercises(); fetchTemplates(); }, []);

  useEffect(() => {
    if (phase !== 'logging') return;
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [startTime, phase]);

  // Rest timer tick
  useEffect(() => {
    if (!restStartedAt || restPaused) return;
    const iv = setInterval(() => {
      const e = Math.floor((Date.now() - restStartedAt) / 1000);
      setRestElapsed(e);
      // Ding + vibrate when we cross the boundary
      if (e >= restDuration && !dingPlayedRef.current) {
        dingPlayedRef.current = true;
        playDing();
      }
    }, 250);
    return () => clearInterval(iv);
  }, [restStartedAt, restPaused, restDuration]);

  // Reset ding flag when starting a new rest
  useEffect(() => {
    if (restStartedAt) dingPlayedRef.current = false;
  }, [restStartedAt]);

  // Sync rest elapsed when pause state changes
  useEffect(() => {
    if (!restStartedAt) { setRestElapsed(0); return; }
    setRestElapsed(Math.floor((Date.now() - restStartedAt) / 1000));
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

  const startEmpty = () => {
    setWorkoutExercises([]);
    setTitle('Workout');
    setStartTime(Date.now());
    setElapsed(0);
    setPhase('logging');
  };

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
    setStartTime(Date.now());
    setElapsed(0);
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

  const createExercise = async (name, muscleGroup) => {
    if (!user?.id) {
      alert('You need to be signed in to create custom exercises.');
      return null;
    }
    const { data, error } = await supabase
      .from('exercises')
      .insert({ name, muscle_group: muscleGroup, is_custom: true, created_by: user.id })
      .select()
      .single();
    if (error) {
      console.error('Failed to create exercise:', error);
      throw error;
    }
    await fetchExercises();
    return data;
  };

  const updateSet = (exIdx, setIdx, patch) => {
    setWorkoutExercises(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const thisSet = next[exIdx].sets[setIdx];

      // On complete: auto-populate weight/reps from previous set if empty
      if (patch.completed) {
        if (!thisSet.weight || !thisSet.reps) {
          // Look back within this exercise for the last completed set
          const inWorkoutPrev = next[exIdx].sets.slice(0, setIdx).reverse()
            .find(s => s.completed && s.weight > 0);
          const dbPrev = previousData[next[exIdx].exercise_id]?.[setIdx];

          if (inWorkoutPrev) {
            if (!thisSet.weight) thisSet.weight = inWorkoutPrev.weight;
            if (!thisSet.reps) thisSet.reps = inWorkoutPrev.reps;
          } else if (dbPrev) {
            if (!thisSet.weight) thisSet.weight = convertWeight(dbPrev.weight, unit);
            if (!thisSet.reps) thisSet.reps = dbPrev.reps;
          }
        }
      }
      Object.assign(thisSet, patch);
      return next;
    });

    if (patch.completed) {
      haptic();
      setRestStartedAt(Date.now());
      setRestAnchor({ exIdx, setIdx });
      setRestPaused(false);
      setRestPausedAt(null);
    }
    if (patch.completed === false) {
      // Clear rest if this was the anchor
      if (restAnchor && restAnchor.exIdx === exIdx && restAnchor.setIdx === setIdx) {
        setRestStartedAt(null);
        setRestAnchor(null);
      }
    }
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

  const removeSet = (exIdx, setIdx) => {
    setWorkoutExercises(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[exIdx].sets.splice(setIdx, 1);
      if (next[exIdx].sets.length === 0) {
        next[exIdx].sets.push({ weight: 0, reps: 0, is_pr: false, set_type: 'normal', completed: false });
      }
      return next;
    });
  };

  const removeExercise = (exIdx) => {
    setWorkoutExercises(prev => prev.filter((_, i) => i !== exIdx));
  };

  const updateExerciseNotes = (exIdx, notes) => {
    setWorkoutExercises(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[exIdx].notes = notes;
      return next;
    });
  };

  // ─── Rest timer controls ───
  const restRemaining = Math.max(0, restDuration - restElapsed);

  const pauseRest = () => {
    setRestPaused(true);
    setRestPausedAt(Date.now());
  };

  const resumeRest = () => {
    if (restPaused && restPausedAt && restStartedAt) {
      const pauseDuration = Date.now() - restPausedAt;
      setRestStartedAt(restStartedAt + pauseDuration);
      setRestPaused(false);
      setRestPausedAt(null);
    }
  };

  const resetRest = () => {
    setRestStartedAt(Date.now());
    setRestPaused(false);
    setRestPausedAt(null);
    dingPlayedRef.current = false;
  };

  const skipRest = () => {
    setRestStartedAt(null);
    setRestAnchor(null);
    setRestPaused(false);
    setRestPausedAt(null);
    setShowRestPanel(false);
  };

  const adjustRest = (delta) => {
    if (restStartedAt) {
      // delta positive = add time (shift started later); negative = remove time
      setRestStartedAt(t => t + (delta * 1000));
    }
  };

  const setRestRemainingTime = (secs) => {
    const wanted = Math.max(1, Math.min(3599, secs));
    setRestStartedAt(Date.now() - (restDuration - wanted) * 1000);
    setRestPaused(false);
    setRestPausedAt(null);
    dingPlayedRef.current = false;
  };

  const setDefaultRestDuration = (secs) => {
    setRestDuration(secs);
    // If currently resting, also set remaining to this value
    if (restStartedAt) {
      setRestStartedAt(Date.now());
      setRestPaused(false);
      setRestPausedAt(null);
      dingPlayedRef.current = false;
    }
  };

  // ─── Finish flow ───
  const handleFinishTap = () => {
    const hasCompleted = workoutExercises.some(ex => ex.sets.some(s => s.completed));
    if (!hasCompleted) {
      alert('Complete at least one set before finishing.');
      return;
    }
    setShowFinishConfirm(true);
  };

  const doSave = async () => {
    setShowFinishConfirm(false);
    setSaving(true);
    const durationMins = Math.max(1, Math.round((Date.now() - startTime) / 60000));
    const workout = {
      title: title.trim() || 'Workout',
      notes: workoutNotes,
      duration_mins: durationMins,
      steeled_from: prefill?.steeled_from || null,
      template_id: null,
      is_public: true,
      exercises: workoutExercises.map(e => ({
        exercise_id: e.exercise_id, notes: e.notes,
        sets: e.sets
          .filter(s => s.completed)
          .map(s => ({
            weight: convertWeightBack(s.weight || 0, unit),
            reps: parseInt(s.reps) || 0,
            is_pr: s.is_pr, set_type: s.set_type, completed: s.completed,
          })),
      })).filter(e => e.sets.length > 0),
    };
    try {
      const saved = await saveWorkout(workout);
      if (saved) {
        setCompletedWorkout({ ...workout, id: saved.id, duration_mins: durationMins });
        setPhase('complete');
      } else {
        alert('Could not save workout. Try again.');
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('Could not save workout: ' + (err.message || 'unknown error'));
    }
    setSaving(false);
  };

  const handleDiscard = () => {
    setWorkoutExercises([]);
    setTitle('Workout');
    setWorkoutNotes('');
    setShowDiscardConfirm(false);
    setRestStartedAt(null);
    setRestAnchor(null);
    setPhase('home');
  };

  const handleSaveAsTemplate = async (nameOverride) => {
    const name = (nameOverride || templateName).trim();
    if (!name) return false;
    try {
      await saveTemplate(name, workoutExercises);
      await fetchTemplates();
      if (!nameOverride) {
        setShowSaveTemplate(false);
        setTemplateName('');
      }
      return true;
    } catch (err) {
      alert('Could not save template: ' + (err.message || 'unknown error'));
      throw err;
    }
  };

  const handleMinimize = () => {
    if (!onMinimize) return;
    onMinimize({
      title: title || 'Workout', elapsed,
      exerciseCount: workoutExercises.length,
      setCount: workoutExercises.reduce((t, e) => t + e.sets.filter(s => s.completed).length, 0),
    });
  };

  const handleCancelTap = () => {
    const hasAnyCompleted = workoutExercises.some(ex => ex.sets.some(s => s.completed));
    if (hasAnyCompleted) {
      setShowDiscardConfirm(true);
    } else {
      setWorkoutExercises([]);
      setTitle('Workout');
      setWorkoutNotes('');
      setPhase('home');
    }
  };

  // ─── Phase: home ───
  if (phase === 'home') {
    return (
      <div style={{ padding: '16px 16px 100px' }}>
        <StartWorkoutHome
          templates={templates}
          onStartEmpty={startEmpty}
          onPickTemplate={pickTemplate}
        />
      </div>
    );
  }

  // ─── Phase: complete ───
  if (phase === 'complete' && completedWorkout) {
    return (
      <CompletionScreen
        workout={completedWorkout}
        onDone={onDone}
        onReopen={() => setPhase('logging')}
        unit={unit}
        onSaveAsTemplate={async (name) => {
          return await handleSaveAsTemplate(name);
        }}
      />
    );
  }

  // ─── Phase: logging ───
  const hasAnyExercises = workoutExercises.length > 0;
  const hasAnyCompleted = workoutExercises.some(ex => ex.sets.some(s => s.completed));
  const today = formatDate(new Date());
  const editingExercise = exerciseNotesIdx !== null ? workoutExercises[exerciseNotesIdx] : null;

  return (
    <div style={{ paddingBottom: 120, paddingTop: 62, fontFamily: FONTS.sans }}>
      {/* Top bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30,
        background: COLORS.isDark ? 'rgba(10,10,10,0.85)' : 'rgba(250,250,250,0.85)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `0.5px solid ${COLORS.border}`,
        padding: 'calc(env(safe-area-inset-top, 0px) + 8px) 12px 8px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 10,
      }}>
        {/* Rest timer button (left) — tap opens panel */}
        <button onClick={() => setShowRestPanel(true)} style={{
          background: restStartedAt ? COLORS.text : COLORS.card2, border: 'none',
          width: 36, height: 36, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0, position: 'relative',
        }}>
          <Icon name="clock" size={15} color={restStartedAt ? COLORS.bg : COLORS.text} />
          {restStartedAt && (
            <span style={{
              position: 'absolute', bottom: -18, left: '50%', transform: 'translateX(-50%)',
              fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text,
              letterSpacing: '-0.02em', fontWeight: 700,
              whiteSpace: 'nowrap',
            }}>{fmt(restRemaining)}</span>
          )}
        </button>

        {/* Centered title + elapsed */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          lineHeight: 1.1, minWidth: 0,
        }}>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={{
              fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em',
              color: COLORS.text, background: 'transparent', border: 'none',
              outline: 'none', textAlign: 'center', padding: 0, fontFamily: FONTS.sans,
              maxWidth: 180, width: '100%',
            }}
          />
          <span style={{
            fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
            fontWeight: 500, marginTop: 2, letterSpacing: '0.06em',
            fontVariantNumeric: 'tabular-nums',
          }}>{fmt(elapsed)} · {today}</span>
        </div>

        {/* Minimize (only if sets logged) + Finish */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {onMinimize && hasAnyCompleted && (
            <button onClick={handleMinimize} style={{
              background: COLORS.card2, border: 'none',
              width: 36, height: 36, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={COLORS.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          )}
          <button onClick={handleFinishTap} disabled={saving || !hasAnyCompleted} style={{
            background: hasAnyCompleted ? COLORS.text : 'transparent',
            color: hasAnyCompleted ? COLORS.bg : COLORS.textDim,
            border: `1px solid ${hasAnyCompleted ? COLORS.text : COLORS.border}`,
            borderRadius: 999, padding: '7px 14px', fontWeight: 700, fontSize: 13,
            cursor: hasAnyCompleted ? 'pointer' : 'not-allowed', fontFamily: FONTS.sans,
            opacity: saving ? 0.6 : 1, letterSpacing: '-0.01em',
          }}>{saving ? '...' : 'Finish'}</button>
        </div>
      </div>

      <div style={{ padding: '12px 14px 0', position: 'relative' }}>
        {/* Cancel + menu */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 12,
        }}>
          <button onClick={handleCancelTap} style={{
            background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer',
            fontFamily: FONTS.mono, fontSize: 10, color: COLORS.red,
            letterSpacing: '0.1em', fontWeight: 600, textTransform: 'uppercase',
          }}>Cancel</button>
          <button onClick={() => setShowMenu(!showMenu)} style={{
            background: 'none', border: 'none', padding: 4, cursor: 'pointer',
            color: COLORS.textDim, fontSize: 18, lineHeight: 1, fontWeight: 700,
          }}>⋯</button>

          {showMenu && (
            <>
              <div onClick={() => setShowMenu(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
              <div style={{
                position: 'absolute', top: 30, right: 0, zIndex: 31,
                background: COLORS.card, border: `1px solid ${COLORS.border}`,
                borderRadius: 10, minWidth: 180, padding: 4,
                boxShadow: COLORS.isDark
                  ? '0 12px 32px -6px rgba(0,0,0,0.6)'
                  : '0 12px 32px -6px rgba(0,0,0,0.15)',
              }}>
                <MenuItem label="Workout notes" onClick={() => { setShowMenu(false); setShowNotesEditor(true); }} />
                {hasAnyExercises && (
                  <MenuItem label="Save as template" onClick={() => { setShowMenu(false); setTemplateName(title); setShowSaveTemplate(true); }} />
                )}
                {onMinimize && hasAnyCompleted && (
                  <MenuItem label="Minimize" onClick={() => { setShowMenu(false); handleMinimize(); }} />
                )}
              </div>
            </>
          )}
        </div>

        {/* Workout notes preview */}
        {workoutNotes && (
          <div onClick={() => setShowNotesEditor(true)} style={{
            fontSize: 13, color: COLORS.text, padding: '10px 12px', marginBottom: 12,
            background: COLORS.card2, borderRadius: 10, lineHeight: 1.45, cursor: 'pointer',
          }}>
            {workoutNotes}
          </div>
        )}

        {workoutExercises.map((ex, exIdx) => (
          <ExerciseCard
            key={exIdx}
            exIdx={exIdx}
            exercise={ex}
            prevSets={previousData[ex.exercise_id]}
            unit={unit}
            restDuration={restDuration}
            restElapsed={restElapsed}
            restAnchor={restAnchor}
            restPaused={restPaused}
            onUpdate={(setIdx, patch) => updateSet(exIdx, setIdx, patch)}
            onAddSet={() => addSet(exIdx)}
            onRemove={() => removeExercise(exIdx)}
            onRemoveSet={(setIdx) => removeSet(exIdx, setIdx)}
            onShowHistory={() => setShowHistory(ex)}
            onEditNotes={() => setExerciseNotesIdx(exIdx)}
            onExpandRest={() => setShowRestPanel(true)}
          />
        ))}

        {!hasAnyExercises && (
          <div style={{
            textAlign: 'center', padding: '40px 20px 20px',
            border: `1px dashed ${COLORS.border}`, borderRadius: 14,
            marginBottom: 12,
          }}>
            <div style={{
              fontSize: 18, fontWeight: 800, color: COLORS.text,
              letterSpacing: '-0.02em', marginBottom: 4,
            }}>Ready to lift</div>
            <div style={{
              fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textDim,
              letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500,
            }}>Add an exercise to start your first set</div>
          </div>
        )}

        <button onClick={() => setShowPicker(true)} style={{
          width: '100%', padding: 13, marginTop: 4,
          background: COLORS.text, color: COLORS.bg,
          border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
          cursor: 'pointer', fontFamily: FONTS.sans, letterSpacing: '-0.01em',
        }}>+ Add exercise</button>

        {/* Finish + Cancel at bottom for natural flow */}
        {hasAnyExercises && (
          <div style={{ marginTop: 20, marginBottom: 16 }}>
            <button onClick={handleFinishTap} disabled={saving || !hasAnyCompleted} style={{
              width: '100%', padding: 14, marginBottom: 8,
              background: hasAnyCompleted ? COLORS.text : COLORS.card2,
              color: hasAnyCompleted ? COLORS.bg : COLORS.textDim,
              border: 'none', borderRadius: 12,
              fontSize: 14, fontWeight: 700,
              cursor: hasAnyCompleted ? 'pointer' : 'not-allowed',
              fontFamily: FONTS.sans, letterSpacing: '-0.01em',
              opacity: saving ? 0.6 : 1,
            }}>{saving ? 'Saving…' : 'Finish workout'}</button>
            <button onClick={handleCancelTap} style={{
              width: '100%', padding: 12,
              background: 'transparent', color: COLORS.red,
              border: `1px solid ${COLORS.border}`, borderRadius: 12,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: FONTS.sans, letterSpacing: '-0.01em',
            }}>Cancel workout</button>
          </div>
        )}
      </div>

      {/* Rest panel */}
      {showRestPanel && (
        <RestPanel
          remaining={restStartedAt ? restRemaining : restDuration}
          duration={restDuration}
          paused={restPaused}
          onPause={pauseRest}
          onResume={resumeRest}
          onReset={resetRest}
          onSkip={skipRest}
          onAdjust={adjustRest}
          onSetRemaining={(secs) => {
            if (restStartedAt) {
              setRestRemainingTime(secs);
            } else {
              setDefaultRestDuration(secs);
            }
          }}
          onClose={() => setShowRestPanel(false)}
        />
      )}

      {/* Exercise picker */}
      {showPicker && (
        <ExercisePicker
          exercises={exercises}
          onSelect={addExercise}
          onClose={() => setShowPicker(false)}
          onCreate={createExercise}
        />
      )}

      {/* Workout notes editor */}
      {showNotesEditor && (
        <div onClick={() => setShowNotesEditor(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 45,
          display: 'flex', alignItems: 'flex-end',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: COLORS.bg, width: '100%', borderRadius: '20px 20px 0 0',
            padding: '20px 16px calc(env(safe-area-inset-bottom, 0px) + 24px)',
            fontFamily: FONTS.sans,
          }}>
            <div style={{
              fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
              letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500,
              marginBottom: 10,
            }}>Workout notes</div>
            <textarea
              value={workoutNotes}
              onChange={e => setWorkoutNotes(e.target.value)}
              placeholder="How did it feel? Anything noteworthy?"
              autoFocus
              rows={5}
              style={{
                width: '100%', padding: 12, borderRadius: 12,
                border: `1px solid ${COLORS.border}`, background: COLORS.card,
                color: COLORS.text, fontSize: 14, fontFamily: FONTS.sans,
                outline: 'none', resize: 'none', marginBottom: 14, boxSizing: 'border-box',
              }}
            />
            <button onClick={() => setShowNotesEditor(false)} style={{
              width: '100%', padding: 13, background: COLORS.text, color: COLORS.bg,
              border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: FONTS.sans, letterSpacing: '-0.01em',
            }}>Done</button>
          </div>
        </div>
      )}

      {/* Exercise notes editor */}
      {editingExercise && (
        <div onClick={() => setExerciseNotesIdx(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 45,
          display: 'flex', alignItems: 'flex-end',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: COLORS.bg, width: '100%', borderRadius: '20px 20px 0 0',
            padding: '20px 16px calc(env(safe-area-inset-bottom, 0px) + 24px)',
            fontFamily: FONTS.sans,
          }}>
            <div style={{
              fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
              letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500,
              marginBottom: 4,
            }}>Notes for</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, letterSpacing: '-0.01em', marginBottom: 10 }}>
              {editingExercise.name}
            </div>
            <textarea
              value={editingExercise.notes}
              onChange={e => updateExerciseNotes(exerciseNotesIdx, e.target.value)}
              placeholder="Form cues, grip, etc."
              autoFocus
              rows={4}
              style={{
                width: '100%', padding: 12, borderRadius: 12,
                border: `1px solid ${COLORS.border}`, background: COLORS.card,
                color: COLORS.text, fontSize: 14, fontFamily: FONTS.sans,
                outline: 'none', resize: 'none', marginBottom: 14, boxSizing: 'border-box',
              }}
            />
            <button onClick={() => setExerciseNotesIdx(null)} style={{
              width: '100%', padding: 13, background: COLORS.text, color: COLORS.bg,
              border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: FONTS.sans, letterSpacing: '-0.01em',
            }}>Done</button>
          </div>
        </div>
      )}

      {/* Exercise history */}
      {showHistory && (
        <ExerciseHistory
          exercise={showHistory}
          userId={user?.id}
          unit={unit}
          onBack={() => setShowHistory(null)}
        />
      )}

      {/* Finish confirm */}
      {showFinishConfirm && (() => {
        const unfinished = workoutExercises.reduce((total, ex) =>
          total + ex.sets.filter(s => !s.completed).length, 0);
        return (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 55,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}>
            <div style={{
              background: COLORS.card, borderRadius: 16, padding: 22, maxWidth: 320, width: '100%',
              border: `1px solid ${COLORS.border}`, fontFamily: FONTS.sans,
            }}>
              <div style={{
                fontSize: 17, fontWeight: 800, color: COLORS.text, letterSpacing: '-0.02em', marginBottom: 6,
              }}>Finish workout?</div>
              <div style={{
                fontSize: 13, color: COLORS.textDim, marginBottom: 18, lineHeight: 1.45,
              }}>
                {unfinished > 0
                  ? <>You have <span style={{ color: COLORS.text, fontWeight: 600 }}>{unfinished} unfinished set{unfinished !== 1 ? 's' : ''}</span> that won't be saved.</>
                  : 'Save this workout and share it to your feed.'
                }
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowFinishConfirm(false)} style={{
                  flex: 1, padding: 11, background: 'transparent', color: COLORS.text,
                  border: `1px solid ${COLORS.border}`, borderRadius: 999,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONTS.sans,
                }}>Keep going</button>
                <button onClick={doSave} style={{
                  flex: 1, padding: 11, background: COLORS.text, color: COLORS.bg,
                  border: 'none', borderRadius: 999,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONTS.sans,
                }}>Finish</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Discard confirm */}
      {showDiscardConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 55,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: COLORS.card, borderRadius: 16, padding: 22, maxWidth: 320, width: '100%',
            border: `1px solid ${COLORS.border}`, fontFamily: FONTS.sans,
          }}>
            <div style={{
              fontSize: 17, fontWeight: 800, color: COLORS.text, letterSpacing: '-0.02em', marginBottom: 6,
            }}>Cancel workout?</div>
            <div style={{
              fontSize: 13, color: COLORS.textDim, marginBottom: 18, lineHeight: 1.45,
            }}>All sets you've logged will be lost. This can't be undone.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowDiscardConfirm(false)} style={{
                flex: 1, padding: 11, background: 'transparent', color: COLORS.text,
                border: `1px solid ${COLORS.border}`, borderRadius: 999,
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONTS.sans,
              }}>Keep workout</button>
              <button onClick={handleDiscard} style={{
                flex: 1, padding: 11, background: COLORS.red, color: '#fff',
                border: 'none', borderRadius: 999,
                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONTS.sans,
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Save as template from menu */}
      {showSaveTemplate && (
        <div onClick={() => setShowSaveTemplate(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 55,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: COLORS.card, borderRadius: 16, padding: 22, maxWidth: 340, width: '100%',
            border: `1px solid ${COLORS.border}`, fontFamily: FONTS.sans,
          }}>
            <div style={{
              fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
              letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 10,
            }}>New template</div>
            <input
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              placeholder="Template name"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && templateName.trim()) handleSaveAsTemplate(); }}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10,
                border: `1px solid ${COLORS.border}`, background: COLORS.bg,
                color: COLORS.text, fontSize: 14, fontFamily: FONTS.sans,
                outline: 'none', marginBottom: 14, boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowSaveTemplate(false)} style={{
                flex: 1, padding: 11, background: 'transparent', color: COLORS.text,
                border: `1px solid ${COLORS.border}`, borderRadius: 999,
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONTS.sans,
              }}>Cancel</button>
              <button onClick={() => handleSaveAsTemplate()} disabled={!templateName.trim()} style={{
                flex: 1, padding: 11,
                background: templateName.trim() ? COLORS.text : COLORS.card2,
                color: templateName.trim() ? COLORS.bg : COLORS.textDim,
                border: 'none', borderRadius: 999,
                fontSize: 13, fontWeight: 700,
                cursor: templateName.trim() ? 'pointer' : 'not-allowed',
                fontFamily: FONTS.sans,
              }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
