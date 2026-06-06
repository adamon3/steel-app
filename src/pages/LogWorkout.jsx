import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { getWIPWorkout, setWIPWorkout, clearWIPWorkout } from '../lib/localStorage';
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

// Play a subtle ding via Web Audio + vibrate.
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
    if (navigator.vibrate) navigator.vibrate([100, 80, 100]);
  } catch (e) { /* no audio, no problem */ }
}

// Show a system notification so users with the phone locked / app backgrounded
// still get a heads-up. Falls back silently if permission is denied or the
// API isn't available (older iOS Safari, etc.). Prefers showing via the SW
// registration so the notification persists on the lock screen even after
// the JS context goes idle.
async function showRestDoneNotification() {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const body = "Time's up — back to the bar.";
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification('Rest complete', {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'steel-rest-done',  // replaces older notifications of same kind
          renotify: true,
          requireInteraction: false,
          silent: false,
        });
        return;
      }
    }
    new Notification('Rest complete', { body, icon: '/icon-192.png', tag: 'steel-rest-done' });
  } catch (e) { /* notification failed, ding still played */ }
}

// Ask once, on the first user gesture. Calling repeatedly is cheap — the
// browser only prompts once.
async function ensureNotificationPermission() {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch (e) { return false; }
}

function haptic() {
  try { if (navigator.vibrate) navigator.vibrate(15); } catch (e) {}
}

// Detect exercises where the weight column means "added weight on top of
// bodyweight". Used to prefix the weight with "+" so it's clear that 20kg
// pull-up means bodyweight + 20kg, not just 20kg total.
function isBodyweightExercise(name) {
  if (!name) return false;
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return [
    'pullup', 'pullups', 'chinup', 'chinups', 'muscleup', 'muscleups',
    'pushup', 'pushups', 'dip', 'dips', 'ringdip', 'ringdips', 'ringrow', 'ringrows',
    'invertedrow', 'invertedrows', 'pistolsquat', 'pistolsquats',
    'handstandpushup', 'handstandpushups', 'hspu',
    'hanginglegraise', 'hanginglegraises', 'hangingkneeraise', 'hangingkneeraises',
    'toestobar', 'lsit', 'situp', 'situps', 'plank', 'sideplank',
    'archerpushup', 'archerpullup', 'diamondpushup',
  ].some(k => n.includes(k));
}

// ═══════════════════════════════════════════════════════════════
// REST BAR (collapsed / compact) — what sits between sets
// ═══════════════════════════════════════════════════════════════

function RestBar({ state, elapsed, duration, onExpand }) {
  // state:
  //   'active'   — current rest, dark pill with lime progress + countdown
  //   'past'     — already rested between two completed sets, dim mono divider
  //   'upcoming' — between sets that haven't been done yet; tap to edit
  //                the planned rest before you get there.
  if (state === 'upcoming') {
    const label = duration < 60 ? `${duration}s` : fmt(duration);
    return (
      <button
        onClick={onExpand}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '4px 6px', background: 'transparent', border: 'none',
          cursor: 'pointer', opacity: 0.55,
        }}>
        <div style={{ flex: 1, height: 1, background: COLORS.border }} />
        <span style={{
          fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textDim,
          letterSpacing: '0.12em', fontWeight: 500, textTransform: 'uppercase',
        }}>Rest · {label}</span>
        <div style={{ flex: 1, height: 1, background: COLORS.border }} />
      </button>
    );
  }

  if (state === 'active') {
    const pct = Math.max(0, Math.min(100, (elapsed / duration) * 100));
    const remaining = Math.max(0, duration - elapsed);
    return (
      <button
        onClick={onExpand}
        style={{
          display: 'block', width: '100%',
          margin: '8px 0', padding: 0, border: 'none',
          background: 'transparent', cursor: 'pointer',
        }}
      >
        <div style={{
          position: 'relative',
          height: 32, borderRadius: 999,
          background: COLORS.text,
          overflow: 'hidden',
          boxShadow: COLORS.isDark
            ? '0 4px 14px -6px rgba(0,0,0,0.5)'
            : '0 4px 14px -6px rgba(0,0,0,0.25)',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            width: `${pct}%`, background: LIME, opacity: 0.85,
            transition: 'width 1s linear',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8,
            fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700,
            color: COLORS.bg, letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
            mixBlendMode: 'normal',
          }}>
            <span style={{
              fontSize: 9, fontWeight: 500, letterSpacing: '0.18em',
              opacity: 0.65, textTransform: 'uppercase',
            }}>Rest</span>
            <span>{fmt(remaining)}</span>
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
  exIdx, setIdx, set, prevSet, unit, isActive, isBodyweight,
  onComplete, onUncomplete, onUpdate, onTogglePR, onCycleSetType, onRemove,
  focusNextSet,
}) {
  const bwPrefix = isBodyweight ? '+' : '';
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
          {prevSet ? `${bwPrefix}${convertWeight(prevSet.weight, unit)}×${prevSet.reps}` : '—'}
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
            }}>{set.weight ? `${bwPrefix}${set.weight}` : (isBodyweight ? 'BW' : '—')}</span>
            <span onClick={onUncomplete} style={{
              textAlign: 'center', fontFamily: FONTS.mono, fontSize: 15, fontWeight: 700,
              color: COLORS.text, letterSpacing: '-0.02em', cursor: 'pointer',
              fontVariantNumeric: 'tabular-nums',
            }}>{set.reps || '—'}</span>
          </>
        ) : (
          <>
            <input
              id={weightRef} type="number" inputMode="decimal" enterKeyHint="next" min="0" max="9999" min="0" max="9999"
              value={set.weight || ''}
              placeholder={prevSet ? `${bwPrefix}${convertWeight(prevSet.weight, unit)}` : (isBodyweight ? '+0' : '0')}
              onChange={e => { const v = parseFloat(e.target.value) || 0; onUpdate('weight', Math.min(Math.max(v, 0), 9999)); }}
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
              id={repsRef} type="number" inputMode="numeric" enterKeyHint="done" min="0" max="999" step="1" min="0" max="999" step="1"
              value={set.reps || ''}
              placeholder={prevSet ? String(prevSet.reps) : '0'}
              onChange={e => { const v = parseInt(e.target.value) || 0; onUpdate('reps', Math.min(Math.max(v, 0), 999)); }}
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
  onUpdate, onAddSet, onRemove, onReplace, onShowHistory, onRemoveSet,
  onEditNotes, onExpandRest, onCycleRestDuration,
}) {
  const lastSet = prevSets?.[0];
  const lastDate = lastSet?.workout_date;
  const isBodyweight = isBodyweightExercise(exercise.name);
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
              LAST · {isBodyweight ? '+' : ''}{convertWeight(lastSet.weight, unit)}×{lastSet.reps}{lastDate ? ` · ${formatDate(lastDate)}` : ''}
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
              <MenuItem label="Replace exercise" onClick={() => { setShowMenu(false); onReplace?.(); }} />
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
        <span style={{ textAlign: 'center' }}>{isBodyweight ? `+ ${unit}` : unit}</span>
        <span style={{ textAlign: 'center' }}>Reps</span>
        <span></span>
      </div>

      {/* Set rows */}
      {exercise.sets.map((set, i) => {
        const prevSet = prevSets?.[i];
        const isThisRestActive = restAnchor && restAnchor.exIdx === exIdx && restAnchor.setIdx === i;
        const showRestAfter = i < exercise.sets.length - 1;

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
              isBodyweight={isBodyweight}
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
            {/* Rest divider after every set except the last — past/active/upcoming.
                Tapping the active timer opens the full rest panel.
                Tapping an upcoming divider cycles the default rest duration. */}
            {showRestAfter && (
              <RestBar
                state={restState}
                elapsed={restState === 'active' ? restElapsed : 0}
                duration={restDuration}
                onExpand={
                  restState === 'active' ? onExpandRest :
                  restState === 'upcoming' ? () => onCycleRestDuration?.() :
                  null
                }
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
      }}>+ Add set</button>
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

function ExercisePicker({ exercises, onSelect, onClose, onCreate, mode = 'add' }) {
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

  // Normalize: strip dashes, spaces, punctuation so "t bar row", "tbar row",
  // "T-Bar Row", "t.bar-row" all match the same canonical form.
  const normalizeForSearch = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const searchNorm = normalizeForSearch(search);

  const filtered = exercises
    .map(e => ({ ...e, _cat: normalizeGroup(e.muscle_group) }))
    .filter(e => {
      const matchesSearch = !searchNorm || normalizeForSearch(e.name).includes(searchNorm);
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
          }}>{mode === 'replace' ? 'Replace exercise' : 'Exercises'}</div>
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

function StartWorkoutHome({ templates, onStartEmpty, onTemplateOptions }) {
  return (
    <div style={{ fontFamily: FONTS.sans, paddingBottom: 60, position: 'relative' }}>
      <div style={{ position: 'absolute', top: -20, right: -30, width: 300, height: 220, background: 'radial-gradient(circle at 72% 28%, rgba(191,230,0,0.20), transparent 62%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
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
        width: '100%', padding: 16, marginBottom: 26,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        background: COLORS.text, color: COLORS.bg,
        border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700,
        cursor: 'pointer', fontFamily: FONTS.sans, letterSpacing: '-0.01em',
        boxShadow: '0 8px 22px -10px rgba(10,10,10,0.45)',
      }}>
        <Icon name="plus" size={17} color={COLORS.bg} /> Start empty workout
      </button>

      {templates.length > 0 ? (
        <>
          <div style={{
            fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
            letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500,
            marginBottom: 10,
          }}>My templates · {templates.length}</div>
          {templates.map(t => {
            const exs = (t.template_exercises || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            const count = exs.length;
            return (
              <button key={t.id} onClick={() => onTemplateOptions(t)} style={{
                display: 'block', textAlign: 'left', width: '100%', padding: 0,
                background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16,
                cursor: 'pointer', fontFamily: FONTS.sans, marginBottom: 10, overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(10,10,10,0.05)',
              }}>
                <div style={{ padding: '14px 16px 4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 17, fontWeight: 800, color: COLORS.text, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                    <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: FONTS.mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: COLORS.accentDim, background: `${COLORS.accent}1f`, border: `1px solid ${COLORS.accent}3d`, padding: '3px 8px', borderRadius: 7 }}>
                      <Icon name="weight" size={11} color={COLORS.accentDim} /> {count}
                    </span>
                  </div>
                  {count === 0 ? (
                    <div style={{ fontSize: 13, color: COLORS.textDim, paddingBottom: 10 }}>Empty template</div>
                  ) : (
                    <>
                      {exs.slice(0, 3).map((te, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 0', borderTop: i > 0 ? `1px solid ${COLORS.border}` : 'none' }}>
                          <span style={{ fontSize: 14, color: COLORS.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{te.exercises?.name || 'Exercise'}</span>
                          <span style={{ flexShrink: 0, fontSize: 12, color: COLORS.textDim, fontFamily: FONTS.mono, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}>{te.default_sets || 3} × {te.default_reps || 10}</span>
                        </div>
                      ))}
                      {count > 3 && <div style={{ fontSize: 12, color: COLORS.textSubtle, padding: '7px 0 4px', borderTop: `1px solid ${COLORS.border}` }}>+{count - 3} more</div>}
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', borderTop: `1px solid ${COLORS.border}`, background: COLORS.card2 }}>
                  <span style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textDim, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500 }}>{t.last_used ? relativeTime(t.last_used) : 'Not used'}</span>
                  <span style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.accentDim, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>Options ›</span>
                </div>
              </button>
            );
          })}
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
    volume: workout.exercises.reduce((t, e) => t + e.sets.filter(s => s.completed && s.set_type !== 'warmup').reduce((v, s) => v + (s.weight || 0) * (s.reps || 0), 0), 0),
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
      let result = await onSaveAsTemplate(templateName.trim());
      if (result?.conflict) {
        if (window.confirm(`You already have a template called "${result.name}". Overwrite it?`)) {
          result = await onSaveAsTemplate(templateName.trim(), { overwrite: true });
        } else {
          setSavingTemplate(false);
          return;
        }
      }
      if (result && !result.conflict) {
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
        {workout.duration_mins} MIN · {workout.exercises.length} {workout.exercises.length === 1 ? 'EXERCISE' : 'EXERCISES'}
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
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Phones at gyms have flaky cellular — 15s timeout is generous but
    // beats falsely showing "Couldn't load" on a slow connection.
    const TIMEOUT_MS = 15000;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Filter by user_id at the DB layer instead of client-side so we
        // only get rows we'll actually display (matters when the exercise
        // is popular and the unfiltered query is huge).
        const query = supabase
          .from('workouts')
          .select('id, title, created_at, workout_exercises!inner(id, exercise_id, sets(weight, reps, is_pr))')
          .eq('user_id', userId)
          .eq('workout_exercises.exercise_id', exercise.exercise_id || exercise.id)
          .order('created_at', { ascending: false })
          .limit(15);
        const { data, error: err } = await Promise.race([
          query,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), TIMEOUT_MS)),
        ]);
        if (cancelled) return;
        if (err) throw err;
        const flattened = (data || []).map(w => ({
          id: w.workout_exercises[0]?.id,
          workouts: { id: w.id, title: w.title, created_at: w.created_at, user_id: userId },
          sets: w.workout_exercises[0]?.sets || [],
        })).filter(we => we.id);
        setHistory(flattened);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not load history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [retryCount]);

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

      {loading ? <Spinner /> : error ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>Couldn't load history</div>
          <div style={{ fontSize: 12, color: COLORS.textDim, fontFamily: FONTS.mono, letterSpacing: '0.05em', marginBottom: 14 }}>{error}</div>
          <button onClick={() => setRetryCount(c => c + 1)} style={{
            background: COLORS.text, color: COLORS.bg,
            border: 'none', borderRadius: 999, padding: '9px 18px',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: FONTS.sans, letterSpacing: '-0.01em',
          }}>Try again</button>
        </div>
      ) : history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Icon name="weight" size={32} color={COLORS.textDim} />
          <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, marginTop: 10 }}>No history yet</div>
          <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 4, lineHeight: 1.45 }}>
            Complete a set of {exercise.name} to start tracking your progress.
          </div>
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

export default function LogWorkout({ prefill, onDone, onMinimize, onActiveChange }) {
  const { exercises, fetchExercises, saveWorkout, profile, fetchTemplates, templates, saveTemplate, deleteTemplate, updateTemplate, getPreviousSets, user, isGuest } = useStore();
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

  // Template management (options menu + editor)
  const [templateMenu, setTemplateMenu] = useState(null);
  const [confirmDeleteTemplate, setConfirmDeleteTemplate] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [savingTemplateEdit, setSavingTemplateEdit] = useState(false);
  const [templateName, setTemplateName] = useState('');
  // Index of the exercise the user is replacing (opens the picker in replace mode).
  const [replaceExerciseIdx, setReplaceExerciseIdx] = useState(null);

  // Tap an upcoming rest divider to cycle through common durations.
  // Matches Strong's pattern: tap to step through 30s / 60s / 90s / 2m / 2:30 / 3m / 4m / 5m.
  const REST_PRESETS = [30, 60, 90, 120, 150, 180, 240, 300];
  const cycleRestDuration = () => {
    haptic();
    setRestDuration(cur => {
      const idx = REST_PRESETS.indexOf(cur);
      // If current value isn't a preset, snap to nearest. Otherwise advance.
      if (idx === -1) {
        const nearest = REST_PRESETS.reduce((b, v) => Math.abs(v - cur) < Math.abs(b - cur) ? v : b, REST_PRESETS[0]);
        return nearest;
      }
      return REST_PRESETS[(idx + 1) % REST_PRESETS.length];
    });
  };

  const unit = profile?.unit_pref || 'kg';

  useEffect(() => { fetchExercises(); fetchTemplates(); }, []);

  // ─── WIP restore on mount ───
  // If there's a saved work-in-progress workout (from a crash, close, or
  // stuck save), pick up where the user left off. Prefill from a Steel'd
  // workout takes priority — that's an explicit user intent.
  useEffect(() => {
    if (prefill) return; // explicit prefill wins
    const wip = getWIPWorkout();
    if (!wip || !wip.exercises || wip.exercises.length === 0) return;
    // Only auto-restore if user has at least one completed set — otherwise
    // it's likely an abandoned blank workout, just clear it.
    const hasCompleted = wip.exercises.some(e => (e.sets || []).some(s => s.completed));
    if (!hasCompleted) { clearWIPWorkout(); return; }
    setWorkoutExercises(wip.exercises);
    setTitle(wip.title || 'Workout');
    setWorkoutNotes(wip.workoutNotes || '');
    setStartTime(wip.startTime || Date.now());
    setPhase('logging');
  }, []); // mount only

  // ─── WIP auto-save on every meaningful change ───
  // Persists the current workout to localStorage so a refresh / crash /
  // force-close can recover it. Cleared after successful save or discard.
  useEffect(() => {
    if (phase !== 'logging') return;
    if (workoutExercises.length === 0) return;
    setWIPWorkout({
      title,
      workoutNotes,
      startTime,
      exercises: workoutExercises,
    });
  }, [workoutExercises, title, workoutNotes, startTime, phase]);

  useEffect(() => {
    if (!onActiveChange) return;
    const isActive = phase === 'logging' && workoutExercises.length > 0;
    const completedSets = workoutExercises.reduce((t, e) => t + e.sets.filter(s => s.completed).length, 0);
    if (isActive) {
      onActiveChange(true, {
        title: title || 'Workout', elapsed,
        exerciseCount: workoutExercises.length,
        setCount: completedSets,
      });
    } else {
      onActiveChange(false, null);
    }
  }, [phase, workoutExercises.length, title]);

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
      // Ding + vibrate + lock-screen notification + auto-advance when we
      // cross the boundary. The auto-advance clears restAnchor so the rest
      // bar disappears and the next not-yet-completed set becomes the
      // active row (the activeSetIdx computation already keys off the
      // first not-completed set, so clearing the anchor is enough).
      if (e >= restDuration && !dingPlayedRef.current) {
        dingPlayedRef.current = true;
        playDing();
        showRestDoneNotification();
        // Brief delay so the user sees the timer hit 0:00 before it
        // dismisses — feels less abrupt.
        setTimeout(() => {
          setRestStartedAt(null);
          setRestAnchor(null);
        }, 600);
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

  const openTemplateEditor = (t) => {
    setTemplateMenu(null);
    setEditingTemplate({
      id: t.id,
      name: t.name || '',
      exercises: (t.template_exercises || [])
        .slice().sort((a, b) => a.sort_order - b.sort_order)
        .map(te => ({
          exercise_id: te.exercise_id,
          name: te.exercises?.name || 'Exercise',
          default_sets: te.default_sets || 3,
          default_reps: te.default_reps || 10,
          default_weight: te.default_weight || 0,
        })),
    });
  };

  const updateEditingExercise = (i, field, val) => {
    setEditingTemplate(p => {
      const ex = p.exercises.slice();
      ex[i] = { ...ex[i], [field]: val };
      return { ...p, exercises: ex };
    });
  };

  const addEditingExercise = (ex) => {
    setEditingTemplate(p => ({
      ...p,
      exercises: [...p.exercises, { exercise_id: ex.id, name: ex.name, default_sets: 3, default_reps: 10, default_weight: 0 }],
    }));
    setShowTemplatePicker(false);
  };

  const saveTemplateEdit = async () => {
    if (!editingTemplate?.name.trim()) return;
    setSavingTemplateEdit(true);
    try {
      await updateTemplate(editingTemplate.id, editingTemplate.name.trim(), editingTemplate.exercises);
      setEditingTemplate(null);
    } catch (err) {
      alert('Could not save template: ' + (err.message || 'unknown error'));
    }
    setSavingTemplateEdit(false);
  };

  const confirmRemoveTemplate = async () => {
    const t = confirmDeleteTemplate;
    if (!t) return;
    try {
      await deleteTemplate(t.id);
    } catch (err) {
      alert('Could not delete template: ' + (err.message || 'unknown error'));
    }
    setConfirmDeleteTemplate(null);
    setTemplateMenu(null);
    setEditingTemplate(null);
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
      // Ask for notification permission on the first set completion — this is
      // a user gesture so iOS Safari will honor the request. Subsequent calls
      // are no-ops if already granted/denied.
      ensureNotificationPermission();
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

  // Optimistic save: queue locally + jump to the completion screen
  // immediately. The actual Supabase sync happens in the background via
  // store.syncOfflineQueue. If the network call fails or stalls, the
  // workout stays in the queue and retries on the next online event /
  // app reload — the user never sees a stuck spinner or loses data.
  const doSave = async ({ isPublic = true } = {}) => {
    setShowFinishConfirm(false);
    const durationMins = Math.max(1, Math.round((Date.now() - startTime) / 60000));
    const workout = {
      title: title.trim() || 'Workout',
      notes: workoutNotes,
      duration_mins: durationMins,
      steeled_from: prefill?.steeled_from || null,
      template_id: null,
      is_public: isPublic,
      exercises: workoutExercises.map(e => ({
        exercise_id: e.exercise_id, name: e.name, notes: e.notes,
        sets: e.sets
          .filter(s => s.completed)
          .map(s => ({
            weight: convertWeightBack(s.weight || 0, unit),
            reps: parseInt(s.reps) || 0,
            is_pr: s.is_pr, set_type: s.set_type, completed: s.completed,
          })),
      })).filter(e => e.sets.length > 0),
    };
    // saveWorkout queues to localStorage synchronously and returns immediately.
    const queued = await saveWorkout(workout);
    setCompletedWorkout({ ...workout, id: queued?.id || 'local', duration_mins: durationMins });
    setPhase('complete');
    clearWIPWorkout();
  };

  const handleDiscard = () => {
    setWorkoutExercises([]);
    setTitle('Workout');
    setWorkoutNotes('');
    setShowDiscardConfirm(false);
    setRestStartedAt(null);
    setRestAnchor(null);
    setPhase('home');
    clearWIPWorkout();
  };

  const handleSaveAsTemplate = async (nameOverride, opts = {}) => {
    const name = (nameOverride || templateName).trim();
    if (!name) return null;
    try {
      const res = await saveTemplate(name, workoutExercises, opts);
      if (res?.conflict) return res;
      if (!nameOverride) {
        setShowSaveTemplate(false);
        setTemplateName('');
      }
      return res;
    } catch (err) {
      alert('Could not save template: ' + (err.message || 'unknown error'));
      throw err;
    }
  };

  const submitSaveTemplate = async () => {
    let res = await handleSaveAsTemplate();
    if (res?.conflict) {
      if (window.confirm(`You already have a template called "${res.name}". Overwrite it?`)) {
        await handleSaveAsTemplate(undefined, { overwrite: true });
      }
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
    setShowDiscardConfirm(true);
  };

  // ─── Phase: home ───
  if (phase === 'home') {
    return (
      <div style={{ padding: '16px 16px 100px' }}>
        <StartWorkoutHome
          templates={templates}
          onStartEmpty={startEmpty}
          onTemplateOptions={setTemplateMenu}
        />

        {/* Template options menu */}
        {templateMenu && (
          <div onClick={() => setTemplateMenu(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: COLORS.card, borderRadius: 16, padding: 16, width: '100%', maxWidth: 380, border: `1px solid ${COLORS.border}`, fontFamily: FONTS.sans, marginBottom: 8 }}>
              <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 4 }}>Template</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text, letterSpacing: '-0.02em', marginBottom: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{templateMenu.name}</div>
              <button onClick={() => { const t = templateMenu; setTemplateMenu(null); pickTemplate(t); }} style={{ width: '100%', padding: 14, marginBottom: 8, background: COLORS.accent, color: COLORS.accentText, border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: FONTS.sans, letterSpacing: '-0.01em' }}>Start workout</button>
              <button onClick={() => openTemplateEditor(templateMenu)} style={{ width: '100%', padding: 13, marginBottom: 8, background: 'transparent', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: FONTS.sans }}>Edit template</button>
              <button onClick={() => setConfirmDeleteTemplate(templateMenu)} style={{ width: '100%', padding: 13, background: 'transparent', color: COLORS.red, border: `1px solid ${COLORS.red}33`, borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: FONTS.sans }}>Delete template</button>
            </div>
          </div>
        )}

        {/* Delete confirm */}
        {confirmDeleteTemplate && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 66, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: COLORS.card, borderRadius: 16, padding: 22, width: '100%', maxWidth: 320, border: `1px solid ${COLORS.border}`, fontFamily: FONTS.sans }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text, marginBottom: 6 }}>Delete template?</div>
              <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 18, lineHeight: 1.5 }}>"{confirmDeleteTemplate.name}" will be removed. This can't be undone.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirmDeleteTemplate(null)} style={{ flex: 1, padding: 11, background: 'transparent', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONTS.sans }}>Keep</button>
                <button onClick={confirmRemoveTemplate} style={{ flex: 1, padding: 11, background: COLORS.red, color: '#fff', border: 'none', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONTS.sans }}>Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Template editor */}
        {editingTemplate && (
          <div style={{ position: 'fixed', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 520, background: COLORS.bg, zIndex: 63, overflowY: 'auto', fontFamily: FONTS.sans }}>
            <div style={{ padding: '16px 16px calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <button onClick={() => setEditingTemplate(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.textDim, fontFamily: FONTS.mono, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500, padding: 0 }}>Cancel</button>
                <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500 }}>Edit template</div>
                <button onClick={saveTemplateEdit} disabled={!editingTemplate.name.trim() || savingTemplateEdit} style={{ background: 'none', border: 'none', cursor: editingTemplate.name.trim() ? 'pointer' : 'default', color: editingTemplate.name.trim() ? COLORS.accentDim : COLORS.textDim, fontWeight: 800, fontSize: 15, fontFamily: FONTS.sans, padding: 0, opacity: savingTemplateEdit ? 0.5 : 1 }}>Save</button>
              </div>

              <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 6 }}>Name</div>
              <input value={editingTemplate.name} onChange={e => setEditingTemplate(p => ({ ...p, name: e.target.value }))} placeholder="Template name" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.text, fontSize: 15, fontWeight: 600, fontFamily: FONTS.sans, outline: 'none', marginBottom: 20, boxSizing: 'border-box' }} />

              <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 8 }}>Exercises · {editingTemplate.exercises.length}</div>
              {editingTemplate.exercises.length === 0 && (
                <div style={{ fontSize: 13, color: COLORS.textDim, padding: '12px 0', marginBottom: 4 }}>No exercises — add one below.</div>
              )}
              {editingTemplate.exercises.map((ex, i) => (
                <div key={i} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</span>
                    <button onClick={() => setEditingTemplate(p => ({ ...p, exercises: p.exercises.filter((_, idx) => idx !== i) }))} style={{ background: 'none', border: 'none', color: COLORS.red, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONTS.mono, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0, padding: 0 }}>Remove</button>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textDim, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Sets</div>
                      <input type="number" inputMode="numeric" min="1" max="20" value={ex.default_sets} onChange={e => updateEditingExercise(i, 'default_sets', Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.bg, color: COLORS.text, fontSize: 14, fontFamily: FONTS.sans, outline: 'none', boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textDim, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Reps</div>
                      <input type="number" inputMode="numeric" min="1" max="99" value={ex.default_reps} onChange={e => updateEditingExercise(i, 'default_reps', Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.bg, color: COLORS.text, fontSize: 14, fontFamily: FONTS.sans, outline: 'none', boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums' }} />
                    </div>
                  </div>
                </div>
              ))}

              <button onClick={() => setShowTemplatePicker(true)} style={{ width: '100%', padding: 13, marginTop: 4, marginBottom: 24, background: 'transparent', color: COLORS.text, border: `1px dashed ${COLORS.border}`, borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: FONTS.sans }}>+ Add exercise</button>

              <button onClick={() => setConfirmDeleteTemplate(editingTemplate)} style={{ width: '100%', padding: 13, background: 'transparent', color: COLORS.red, border: `1px solid ${COLORS.red}33`, borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: FONTS.sans }}>Delete template</button>
            </div>

            {showTemplatePicker && (
              <ExercisePicker
                exercises={exercises}
                onSelect={addEditingExercise}
                onClose={() => setShowTemplatePicker(false)}
                onCreate={createExercise}
              />
            )}
          </div>
        )}
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
        onSaveAsTemplate={async (name, opts) => {
          return await handleSaveAsTemplate(name, opts);
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
            onReplace={() => setReplaceExerciseIdx(exIdx)}
            onRemoveSet={(setIdx) => removeSet(exIdx, setIdx)}
            onShowHistory={() => setShowHistory(ex)}
            onEditNotes={() => setExerciseNotesIdx(exIdx)}
            onExpandRest={() => setShowRestPanel(true)}
            onCycleRestDuration={cycleRestDuration}
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

      {/* Exercise picker — add OR replace depending on which flow opened it */}
      {(showPicker || replaceExerciseIdx !== null) && (
        <ExercisePicker
          exercises={exercises}
          onSelect={(ex) => {
            if (replaceExerciseIdx !== null) {
              // Replace: swap the exercise_id + name on the existing row,
              // preserve sets / notes / reps so the user keeps their data.
              setWorkoutExercises(prev => {
                const next = JSON.parse(JSON.stringify(prev));
                if (next[replaceExerciseIdx]) {
                  next[replaceExerciseIdx].exercise_id = ex.id;
                  next[replaceExerciseIdx].name = ex.name;
                }
                return next;
              });
              loadPrevious(ex.id);
              setReplaceExerciseIdx(null);
            } else {
              addExercise(ex);
            }
          }}
          onClose={() => {
            setShowPicker(false);
            setReplaceExerciseIdx(null);
          }}
          onCreate={createExercise}
          mode={replaceExerciseIdx !== null ? 'replace' : 'add'}
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
        const completed = workoutExercises.reduce((total, ex) =>
          total + ex.sets.filter(s => s.completed).length, 0);
        const volume = workoutExercises.reduce((t, e) =>
          t + e.sets.filter(s => s.completed && s.set_type !== 'warmup').reduce((v, s) => v + (s.weight || 0) * (s.reps || 0), 0), 0);
        const volDisp = volume >= 1000 ? (volume / 1000).toFixed(1) : String(Math.round(volume));
        const volSuffix = volume >= 1000 ? 'k' : unit;
        const prCount = workoutExercises.reduce((t, e) => t + e.sets.filter(s => s.is_pr).length, 0);

        // Unfinished-sets variant — warning, tighter
        if (unfinished > 0) {
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
                }}>Finish without these sets?</div>
                <div style={{
                  fontSize: 13, color: COLORS.textDim, marginBottom: 18, lineHeight: 1.45,
                }}>
                  You have <span style={{ color: COLORS.text, fontWeight: 600 }}>{unfinished} unfinished set{unfinished !== 1 ? 's' : ''}</span>. They won't be saved to your workout.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowFinishConfirm(false)} style={{
                    flex: 1, padding: 11, background: 'transparent', color: COLORS.text,
                    border: `1px solid ${COLORS.border}`, borderRadius: 999,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONTS.sans,
                  }}>Keep going</button>
                  <button onClick={() => doSave({ isPublic: true })} style={{
                    flex: 1, padding: 11, background: COLORS.text, color: COLORS.bg,
                    border: 'none', borderRadius: 999,
                    fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONTS.sans,
                  }}>Finish anyway</button>
                </div>
              </div>
            </div>
          );
        }

        // Everything-complete variant — celebratory summary
        return (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 55,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}>
            <div style={{
              background: COLORS.card, borderRadius: 20, padding: '28px 22px 22px', maxWidth: 340, width: '100%',
              border: `1px solid ${COLORS.border}`, fontFamily: FONTS.sans, textAlign: 'center',
            }}>
              {/* Lime check circle */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 56, height: 56, borderRadius: '50%',
                background: LIME, marginBottom: 14,
                boxShadow: `0 0 32px ${LIME}66`,
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                  stroke="#0A0A0A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <div style={{
                fontSize: 22, fontWeight: 800, color: COLORS.text, letterSpacing: '-0.02em', marginBottom: 4,
              }}>Nice work!</div>
              <div style={{
                fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
                letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 18,
              }}>You smashed it</div>

              {/* Mini stats strip */}
              <div style={{
                display: 'grid', gridTemplateColumns: prCount > 0 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
                gap: 6, marginBottom: 20,
              }}>
                <div style={{
                  padding: '10px 6px', background: COLORS.card2, borderRadius: 10,
                }}>
                  <div style={{
                    fontFamily: FONTS.mono, fontSize: 18, fontWeight: 700,
                    color: COLORS.text, letterSpacing: '-0.03em',
                    fontVariantNumeric: 'tabular-nums',
                  }}>{completed}</div>
                  <div style={{
                    fontFamily: FONTS.mono, fontSize: 8, color: COLORS.textDim,
                    letterSpacing: '0.14em', fontWeight: 500, marginTop: 2,
                  }}>SETS</div>
                </div>
                <div style={{
                  padding: '10px 6px', background: COLORS.card2, borderRadius: 10,
                }}>
                  <div style={{
                    fontFamily: FONTS.mono, fontSize: 18, fontWeight: 700,
                    color: COLORS.text, letterSpacing: '-0.03em',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {volDisp}<span style={{ color: COLORS.textDim, fontSize: 11, fontWeight: 500 }}>{volSuffix}</span>
                  </div>
                  <div style={{
                    fontFamily: FONTS.mono, fontSize: 8, color: COLORS.textDim,
                    letterSpacing: '0.14em', fontWeight: 500, marginTop: 2,
                  }}>VOLUME</div>
                </div>
                {prCount > 0 && (
                  <div style={{
                    padding: '10px 6px',
                    background: COLORS.isDark ? LIME_WASH_DARK : LIME_WASH_LIGHT,
                    borderRadius: 10, border: `1px solid ${LIME}33`,
                  }}>
                    <div style={{
                      fontFamily: FONTS.mono, fontSize: 18, fontWeight: 700,
                      color: COLORS.text, letterSpacing: '-0.03em',
                      fontVariantNumeric: 'tabular-nums',
                    }}>{prCount}</div>
                    <div style={{
                      fontFamily: FONTS.mono, fontSize: 8, color: COLORS.textDim,
                      letterSpacing: '0.14em', fontWeight: 500, marginTop: 2,
                    }}>PR</div>
                  </div>
                )}
              </div>

              <button onClick={() => doSave({ isPublic: true })} style={{
                width: '100%', padding: 13, background: COLORS.text, color: COLORS.bg,
                border: 'none', borderRadius: 12,
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                fontFamily: FONTS.sans, letterSpacing: '-0.01em', marginBottom: 8,
              }}>{isGuest ? 'Save workout' : 'Save & share'}</button>

              <button onClick={() => doSave({ isPublic: false })} style={{
                width: '100%', padding: 12, background: 'transparent', color: COLORS.text,
                border: `1px solid ${COLORS.border}`, borderRadius: 12,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: FONTS.sans, letterSpacing: '-0.01em', marginBottom: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <Icon name="lock" size={13} color={COLORS.text} />
                Save private
              </button>

              <button onClick={() => setShowFinishConfirm(false)} style={{
                width: '100%', padding: 10, background: 'transparent', color: COLORS.textDim,
                border: 'none',
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                fontFamily: FONTS.mono, letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>One more set</button>
            </div>
          </div>
        );
      })()}

      {/* Discard confirm */}
      {showDiscardConfirm && (() => {
        const completedCount = workoutExercises.reduce((t, ex) =>
          t + ex.sets.filter(s => s.completed).length, 0);
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
              }}>Cancel workout?</div>
              <div style={{
                fontSize: 13, color: COLORS.textDim, marginBottom: 18, lineHeight: 1.45,
              }}>
                {completedCount > 0
                  ? <>You'll lose <span style={{ color: COLORS.text, fontWeight: 600 }}>{completedCount} completed set{completedCount !== 1 ? 's' : ''}</span>. This can't be undone.</>
                  : <>Nothing to save yet — this just goes back to the start screen.</>
                }
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowDiscardConfirm(false)} style={{
                  flex: 1, padding: 11, background: 'transparent', color: COLORS.text,
                  border: `1px solid ${COLORS.border}`, borderRadius: 999,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONTS.sans,
                }}>Keep workout</button>
                <button onClick={handleDiscard} style={{
                  flex: 1, padding: 11,
                  background: completedCount > 0 ? COLORS.red : COLORS.text,
                  color: completedCount > 0 ? '#fff' : COLORS.bg,
                  border: 'none', borderRadius: 999,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONTS.sans,
                }}>{completedCount > 0 ? 'Discard' : 'Cancel'}</button>
              </div>
            </div>
          </div>
        );
      })()}

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
              onKeyDown={e => { if (e.key === 'Enter' && templateName.trim()) submitSaveTemplate(); }}
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
              <button onClick={() => submitSaveTemplate()} disabled={!templateName.trim()} style={{
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
