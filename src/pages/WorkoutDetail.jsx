import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { COLORS, Icon, Spinner, Avatar, convertWeight, convertWeightBack, getInitials } from '../components/UI';

const FONTS = {
  sans: "'Inter Tight', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
};

const LIME = '#BFE600';

function fmtDate(d) {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(d) {
  if (!d) return '';
  const seconds = Math.floor((Date.now() - new Date(d)) / 1000);
  if (seconds < 60) return 'just now';
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDate(d);
}

const SET_TYPES = ['normal', 'warmup', 'dropset', 'failure'];
const SET_LABELS = {
  warmup: { label: 'W', color: '#F59E0B' },
  dropset: { label: 'D', color: '#A855F7' },
  failure: { label: 'F', color: COLORS.red || '#EF4444' },
  normal: { label: '', color: null },
};

// ═══════════════════════════════════════════════════════════════
// SET ROW (view + edit modes share same layout)
// ═══════════════════════════════════════════════════════════════

function SetRow({ set, idx, unit, editing, onUpdate, onDelete, onCycleType }) {
  const typeKey = set.set_type || 'normal';
  const typeLabel = SET_LABELS[typeKey].label;
  const typeColor = SET_LABELS[typeKey].color;
  const cols = '32px 1fr 1fr 28px' + (editing ? ' 28px' : '');

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: cols, gap: 8, alignItems: 'center',
      padding: '8px 6px', borderRadius: 8,
      background: set.is_pr ? 'rgba(191, 230, 0, 0.10)' : 'transparent',
      border: set.is_pr ? `1px solid ${LIME}` : '1px solid transparent',
      marginBottom: 2,
    }}>
      <button
        onClick={editing ? onCycleType : undefined}
        disabled={!editing}
        style={{
          textAlign: 'center', fontFamily: FONTS.mono, fontSize: 12, fontWeight: 700,
          color: typeColor || COLORS.text, background: 'none', border: 'none',
          padding: 0, cursor: editing ? 'pointer' : 'default',
        }}>
        {typeLabel || (idx + 1)}
      </button>

      {editing ? (
        <input
          type="number" inputMode="decimal" enterKeyHint="next"
          value={set.weight ?? ''}
          onChange={e => onUpdate({ weight: parseFloat(e.target.value) || 0 })}
          onFocus={e => e.target.select()}
          style={{
            textAlign: 'center', fontFamily: FONTS.mono, fontSize: 14, fontWeight: 700,
            background: COLORS.bg, border: `1px solid ${COLORS.border}`,
            borderRadius: 7, padding: '7px 0', color: COLORS.text,
            outline: 'none', width: '100%', boxSizing: 'border-box',
          }}
        />
      ) : (
        <span style={{
          textAlign: 'center', fontFamily: FONTS.mono, fontSize: 14, fontWeight: 700,
          color: COLORS.text, fontVariantNumeric: 'tabular-nums',
        }}>
          {set.weight || 0}<span style={{ fontSize: 9, color: COLORS.textDim, marginLeft: 2 }}>{unit}</span>
        </span>
      )}

      {editing ? (
        <input
          type="number" inputMode="numeric" enterKeyHint="done"
          value={set.reps ?? ''}
          onChange={e => onUpdate({ reps: parseInt(e.target.value) || 0 })}
          onFocus={e => e.target.select()}
          style={{
            textAlign: 'center', fontFamily: FONTS.mono, fontSize: 14, fontWeight: 700,
            background: COLORS.bg, border: `1px solid ${COLORS.border}`,
            borderRadius: 7, padding: '7px 0', color: COLORS.text,
            outline: 'none', width: '100%', boxSizing: 'border-box',
          }}
        />
      ) : (
        <span style={{
          textAlign: 'center', fontFamily: FONTS.mono, fontSize: 14, fontWeight: 700,
          color: COLORS.text, fontVariantNumeric: 'tabular-nums',
        }}>
          {set.reps || 0}
        </span>
      )}

      <button
        onClick={editing ? () => onUpdate({ is_pr: !set.is_pr }) : undefined}
        disabled={!editing}
        style={{
          background: 'none', border: 'none', padding: 0,
          cursor: editing ? 'pointer' : 'default',
          fontSize: 14, lineHeight: 1, textAlign: 'center',
        }}>
        {set.is_pr ? '🏆' : (editing ? <span style={{ color: COLORS.textDim, fontSize: 11 }}>—</span> : '')}
      </button>

      {editing && (
        <button onClick={onDelete} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: COLORS.red || '#EF4444', fontSize: 16, padding: 0,
          lineHeight: 1,
        }}>×</button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// EXERCISE BLOCK (view + edit)
// ═══════════════════════════════════════════════════════════════

function ExerciseBlock({ exercise, unit, editing, onUpdate, onAddSet, onRemoveExercise }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        padding: '4px 4px 6px',
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 16, fontWeight: 700, color: COLORS.text,
            letterSpacing: '-0.01em',
          }}>
            {exercise.name}
          </div>
          {editing ? (
            <input
              value={exercise.notes || ''}
              onChange={e => onUpdate({ notes: e.target.value })}
              placeholder="Notes (form cues, grip, etc.)"
              style={{
                width: '100%', marginTop: 4, padding: '6px 8px',
                background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                borderRadius: 6, color: COLORS.text, fontSize: 12,
                fontFamily: FONTS.sans, outline: 'none', boxSizing: 'border-box',
              }}
            />
          ) : (
            exercise.notes && (
              <div style={{
                fontSize: 12, color: COLORS.textDim, marginTop: 3, lineHeight: 1.4,
              }}>{exercise.notes}</div>
            )
          )}
        </div>
        {editing && (
          <button onClick={onRemoveExercise} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: COLORS.red || '#EF4444',
            fontFamily: FONTS.mono, fontSize: 10, fontWeight: 600,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: 4,
          }}>Remove</button>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr 1fr 28px' + (editing ? ' 28px' : ''),
        gap: 8, alignItems: 'center',
        padding: '6px 6px',
        fontFamily: FONTS.mono, fontSize: 9, fontWeight: 500,
        color: COLORS.textDim, letterSpacing: '0.14em', textTransform: 'uppercase',
        borderBottom: `0.5px solid ${COLORS.border}`,
      }}>
        <span style={{ textAlign: 'center' }}>Set</span>
        <span style={{ textAlign: 'center' }}>{unit}</span>
        <span style={{ textAlign: 'center' }}>Reps</span>
        <span style={{ textAlign: 'center' }}>PR</span>
        {editing && <span></span>}
      </div>

      {(exercise.sets || []).map((set, i) => (
        <SetRow
          key={i}
          set={set} idx={i} unit={unit} editing={editing}
          onUpdate={(patch) => {
            const next = JSON.parse(JSON.stringify(exercise));
            Object.assign(next.sets[i], patch);
            onUpdate(next);
          }}
          onDelete={() => {
            const next = JSON.parse(JSON.stringify(exercise));
            next.sets.splice(i, 1);
            onUpdate(next);
          }}
          onCycleType={() => {
            const next = JSON.parse(JSON.stringify(exercise));
            const cur = SET_TYPES.indexOf(next.sets[i].set_type || 'normal');
            next.sets[i].set_type = SET_TYPES[(cur + 1) % SET_TYPES.length];
            onUpdate(next);
          }}
        />
      ))}

      {editing && (
        <button onClick={onAddSet} style={{
          width: '100%', marginTop: 6,
          background: 'none', border: `1px dashed ${COLORS.border}`,
          color: COLORS.textDim, padding: '8px 0', borderRadius: 8,
          fontFamily: FONTS.mono, fontSize: 10, fontWeight: 500,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          cursor: 'pointer',
        }}>+ Add set</button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// EXERCISE PICKER (for adding new exercise in edit mode)
// ═══════════════════════════════════════════════════════════════

function ExercisePicker({ exercises, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  // Strip non-alphanumerics so "t bar row" matches "T-Bar Row" etc.
  const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const searchNorm = normalize(search);
  const filtered = exercises
    .filter(e => !searchNorm || normalize(e.name).includes(searchNorm))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 100);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: COLORS.bg, zIndex: 100,
      display: 'flex', flexDirection: 'column', padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', padding: 4, cursor: 'pointer',
        }}>
          <Icon name="back" size={20} color={COLORS.text} />
        </button>
        <div style={{
          fontSize: 20, fontWeight: 800, color: COLORS.text,
          letterSpacing: '-0.02em', fontFamily: FONTS.sans,
        }}>Add exercise</div>
      </div>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search exercises…"
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
            padding: '12px 4px', background: 'transparent', border: 'none',
            borderBottom: `0.5px solid ${COLORS.border}`, cursor: 'pointer',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{e.name}</div>
            {e.muscle_group && (
              <div style={{
                fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
                marginTop: 2, letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>{e.muscle_group}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

export default function WorkoutDetail({ workoutId, onClose, onProfile, onSteel }) {
  const { user, profile, exercises, fetchExercises, fetchWorkout, updateWorkoutFull, deleteWorkout, toggleLike, addComment } = useStore();
  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [draft, setDraft] = useState(null); // editable copy
  const [likedByMe, setLikedByMe] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [localComments, setLocalComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const unit = profile?.unit_pref || 'kg';

  useEffect(() => {
    fetchExercises();
    let alive = true;
    (async () => {
      const w = await fetchWorkout(workoutId);
      if (alive) {
        setWorkout(w);
        setLikedByMe(w?.likes?.some(l => l.user_id === user?.id) || false);
        setLikeCount(w?.likes?.length || 0);
        setLocalComments(
          (w?.comments || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        );
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [workoutId]);

  const isOwner = workout && user && workout.user_id === user.id;

  const startEdit = () => {
    if (!workout) return;
    // Convert workout into editable draft (weights converted to display unit)
    const editable = {
      title: workout.title || 'Workout',
      notes: workout.notes || '',
      duration_mins: workout.duration_mins || 0,
      is_public: workout.is_public !== false,
      exercises: (workout.workout_exercises || [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(we => ({
          exercise_id: we.exercises?.id,
          name: we.exercises?.name || 'Exercise',
          notes: we.notes || '',
          sets: (we.sets || [])
            .sort((a, b) => a.set_number - b.set_number)
            .map(s => ({
              weight: convertWeight(s.weight || 0, unit),
              reps: s.reps || 0,
              is_pr: s.is_pr || false,
              set_type: s.set_type || 'normal',
            })),
        })),
    };
    setDraft(editable);
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(null);
    setEditing(false);
  };

  const handleLike = async () => {
    if (!user) return;
    const wasLiked = likedByMe;
    setLikedByMe(!wasLiked);
    setLikeCount(c => wasLiked ? c - 1 : c + 1);
    await toggleLike(workoutId);
  };

  const handlePostComment = async () => {
    const body = commentInput.trim();
    if (!body || !user) return;
    setPostingComment(true);
    const newComment = await addComment(workoutId, body);
    if (newComment) {
      setLocalComments(prev => [...prev, {
        ...newComment,
        profiles: { display_name: profile?.display_name, username: profile?.username, id: user.id, avatar_url: profile?.avatar_url },
      }]);
      setCommentInput('');
    }
    setPostingComment(false);
  };

  const saveEdit = async () => {
    if (!draft) return;
    setSaving(true);
    // Convert weights back to base unit (kg) before saving
    const payload = {
      ...draft,
      exercises: draft.exercises.map(ex => ({
        ...ex,
        sets: ex.sets.map(s => ({
          ...s,
          weight: convertWeightBack(s.weight || 0, unit),
        })),
      })),
    };
    const ok = await updateWorkoutFull(workoutId, payload);
    setSaving(false);
    if (ok) {
      // Refetch to show fresh data
      const w = await fetchWorkout(workoutId);
      setWorkout(w);
      setDraft(null);
      setEditing(false);
    } else {
      alert('Could not save changes. Try again.');
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    const ok = await deleteWorkout(workoutId);
    setSaving(false);
    setShowDeleteConfirm(false);
    if (ok) {
      onClose?.();
    } else {
      alert('Could not delete workout. Try again.');
    }
  };

  const updateExercise = (idx, next) => {
    setDraft(d => {
      const out = JSON.parse(JSON.stringify(d));
      out.exercises[idx] = next;
      return out;
    });
  };

  const addSetTo = (idx) => {
    setDraft(d => {
      const out = JSON.parse(JSON.stringify(d));
      const last = out.exercises[idx].sets[out.exercises[idx].sets.length - 1];
      out.exercises[idx].sets.push({
        weight: last?.weight || 0,
        reps: last?.reps || 0,
        is_pr: false,
        set_type: 'normal',
      });
      return out;
    });
  };

  const removeExercise = (idx) => {
    setDraft(d => {
      const out = JSON.parse(JSON.stringify(d));
      out.exercises.splice(idx, 1);
      return out;
    });
  };

  const addExercise = (exDef) => {
    setDraft(d => {
      const out = JSON.parse(JSON.stringify(d));
      out.exercises.push({
        exercise_id: exDef.id,
        name: exDef.name,
        notes: '',
        sets: [{ weight: 0, reps: 0, is_pr: false, set_type: 'normal' }],
      });
      return out;
    });
    setShowPicker(false);
  };

  // ─── Loading state ───
  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: COLORS.bg, zIndex: 80,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Spinner />
      </div>
    );
  }

  if (!workout) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: COLORS.bg, zIndex: 80,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 32, fontFamily: FONTS.sans,
      }}>
        <div style={{
          fontSize: 18, fontWeight: 700, color: COLORS.text, marginBottom: 8,
        }}>Workout not found</div>
        <div style={{
          fontSize: 13, color: COLORS.textDim, marginBottom: 20, textAlign: 'center',
        }}>It may have been deleted or set to private.</div>
        <button onClick={onClose} style={{
          padding: '11px 24px', background: COLORS.text, color: COLORS.bg,
          border: 'none', borderRadius: 999,
          fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONTS.sans,
        }}>Close</button>
      </div>
    );
  }

  // ─── Display data ───
  const display = editing && draft ? draft : {
    title: workout.title,
    notes: workout.notes,
    duration_mins: workout.duration_mins,
    is_public: workout.is_public,
    exercises: (workout.workout_exercises || [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(we => ({
        exercise_id: we.exercises?.id,
        name: we.exercises?.name || 'Exercise',
        notes: we.notes || '',
        sets: (we.sets || [])
          .sort((a, b) => a.set_number - b.set_number)
          .map(s => ({
            weight: convertWeight(s.weight || 0, unit),
            reps: s.reps || 0,
            is_pr: s.is_pr || false,
            set_type: s.set_type || 'normal',
          })),
      })),
  };

  const totalSets = display.exercises.reduce((t, e) => t + (e.sets?.length || 0), 0);
  const totalVolume = display.exercises.reduce((t, e) =>
    t + (e.sets || []).reduce((v, s) => v + (s.weight || 0) * (s.reps || 0), 0), 0);
  const prCount = display.exercises.reduce((t, e) =>
    t + (e.sets || []).filter(s => s.is_pr).length, 0);
  const volDisp = totalVolume >= 1000 ? (totalVolume / 1000).toFixed(1) : String(Math.round(totalVolume));
  const volSuffix = totalVolume >= 1000 ? 'k' : ` ${unit}`;

  const p = workout.profiles;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: COLORS.bg, zIndex: 80,
      overflowY: 'auto', fontFamily: FONTS.sans,
      paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
    }}>
      {/* Top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 5,
        background: COLORS.isDark ? 'rgba(10,10,10,0.85)' : 'rgba(250,250,250,0.85)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `0.5px solid ${COLORS.border}`,
        padding: 'calc(env(safe-area-inset-top, 0px) + 8px) 12px 8px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 10,
      }}>
        <button onClick={editing ? cancelEdit : onClose} style={{
          background: COLORS.card2, border: 'none',
          width: 36, height: 36, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          {editing ? (
            <span style={{
              fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text,
              fontWeight: 700, letterSpacing: '-0.02em',
            }}>Cancel</span>
          ) : (
            <Icon name="back" size={18} color={COLORS.text} />
          )}
        </button>

        <div style={{
          flex: 1, fontSize: 14, fontWeight: 700, color: COLORS.text,
          letterSpacing: '-0.01em', textAlign: 'center',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {editing ? 'Edit workout' : 'Workout'}
        </div>

        {isOwner && !editing && (
          <button onClick={startEdit} style={{
            background: COLORS.text, color: COLORS.bg,
            border: 'none', borderRadius: 999, padding: '7px 14px',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            fontFamily: FONTS.sans, letterSpacing: '-0.01em',
          }}>Edit</button>
        )}

        {isOwner && editing && (
          <button onClick={saveEdit} disabled={saving} style={{
            background: COLORS.text, color: COLORS.bg,
            border: 'none', borderRadius: 999, padding: '7px 14px',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            fontFamily: FONTS.sans, letterSpacing: '-0.01em',
            opacity: saving ? 0.6 : 1,
          }}>{saving ? 'Saving…' : 'Save'}</button>
        )}

        {!isOwner && !editing && <div style={{ width: 36 }} />}
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Author row */}
        {p && !editing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Avatar
              initials={getInitials(p.display_name || '??')}
              colorIndex={p.id?.charCodeAt(0) || 0}
              size={40}
              src={p.avatar_url || null}
              onClick={() => onProfile?.(p.id)}
            />
            <div onClick={() => onProfile?.(p.id)} style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>
                {p.display_name}
              </div>
              <div style={{
                fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
                letterSpacing: '0.06em', marginTop: 2,
              }}>
                {timeAgo(workout.created_at).toUpperCase()}
                {p.gym ? ` · ${p.gym.toUpperCase()}` : ''}
              </div>
            </div>
          </div>
        )}

        {/* Title */}
        {editing ? (
          <input
            value={display.title}
            onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 10,
              border: `1px solid ${COLORS.border}`, background: COLORS.card,
              color: COLORS.text, fontSize: 22, fontWeight: 800,
              fontFamily: FONTS.sans, letterSpacing: '-0.02em',
              outline: 'none', marginBottom: 8, boxSizing: 'border-box',
            }}
          />
        ) : (
          <div style={{
            fontSize: 26, fontWeight: 800, color: COLORS.text,
            letterSpacing: '-0.025em', marginBottom: 4,
          }}>{display.title}</div>
        )}

        {!editing && (
          <div style={{
            fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16,
          }}>
            {fmtDate(workout.created_at)} · {fmtTime(workout.created_at)}
            {workout.duration_mins ? ` · ${workout.duration_mins} MIN` : ''}
          </div>
        )}

        {/* Notes */}
        {editing ? (
          <textarea
            value={display.notes || ''}
            onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
            placeholder="Workout notes (optional)…"
            rows={3}
            style={{
              width: '100%', padding: 12, borderRadius: 10,
              border: `1px solid ${COLORS.border}`, background: COLORS.card,
              color: COLORS.text, fontSize: 14, fontFamily: FONTS.sans,
              outline: 'none', resize: 'none', marginBottom: 14, boxSizing: 'border-box',
              lineHeight: 1.5,
            }}
          />
        ) : (
          display.notes && (
            <div style={{
              padding: '12px 14px', background: COLORS.card2, borderRadius: 10,
              fontSize: 14, color: COLORS.text, lineHeight: 1.5, marginBottom: 16,
            }}>
              {display.notes}
            </div>
          )
        )}

        {/* Stats strip */}
        {!editing && totalSets > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: prCount > 0 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
            gap: 6, marginBottom: 22,
          }}>
            <div style={{
              padding: '12px 8px', background: COLORS.card, borderRadius: 10,
              border: `1px solid ${COLORS.border}`, textAlign: 'center',
            }}>
              <div style={{
                fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textDim,
                letterSpacing: '0.14em', fontWeight: 500,
              }}>SETS</div>
              <div style={{
                fontFamily: FONTS.mono, fontSize: 22, fontWeight: 700,
                color: COLORS.text, letterSpacing: '-0.03em', marginTop: 4,
              }}>{totalSets}</div>
            </div>
            <div style={{
              padding: '12px 8px', background: COLORS.card, borderRadius: 10,
              border: `1px solid ${COLORS.border}`, textAlign: 'center',
            }}>
              <div style={{
                fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textDim,
                letterSpacing: '0.14em', fontWeight: 500,
              }}>VOLUME</div>
              <div style={{
                fontFamily: FONTS.mono, fontSize: 22, fontWeight: 700,
                color: COLORS.text, letterSpacing: '-0.03em', marginTop: 4,
              }}>
                {volDisp}<span style={{ color: COLORS.textDim, fontSize: 12, fontWeight: 500 }}>{volSuffix}</span>
              </div>
            </div>
            {prCount > 0 && (
              <div style={{
                padding: '12px 8px', background: 'rgba(191, 230, 0, 0.08)',
                borderRadius: 10, border: `1px solid ${LIME}`, textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textDim,
                  letterSpacing: '0.14em', fontWeight: 500,
                }}>PR</div>
                <div style={{
                  fontFamily: FONTS.mono, fontSize: 22, fontWeight: 700,
                  color: COLORS.text, letterSpacing: '-0.03em', marginTop: 4,
                }}>{prCount}</div>
              </div>
            )}
          </div>
        )}

        {/* Social row — likes + comment count */}
        {!editing && (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
            <button onClick={handleLike} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}>
              <span style={{ fontSize: 18, color: likedByMe ? LIME : COLORS.textDim, lineHeight: 1 }}>
                {likedByMe ? '♥' : '♡'}
              </span>
              <span style={{
                fontFamily: FONTS.mono, fontSize: 12, fontWeight: 600,
                color: likedByMe ? LIME : COLORS.textDim,
              }}>{likeCount}</span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 15, color: COLORS.textDim, lineHeight: 1 }}>💬</span>
              <span style={{
                fontFamily: FONTS.mono, fontSize: 12, fontWeight: 600, color: COLORS.textDim,
              }}>{localComments.length}</span>
            </div>
          </div>
        )}

        {/* Exercise list */}
        {display.exercises.map((ex, idx) => (
          <ExerciseBlock
            key={idx}
            exercise={ex}
            unit={unit}
            editing={editing}
            onUpdate={(next) => updateExercise(idx, next)}
            onAddSet={() => addSetTo(idx)}
            onRemoveExercise={() => removeExercise(idx)}
          />
        ))}

        {editing && (
          <button onClick={() => setShowPicker(true)} style={{
            width: '100%', padding: 13, marginTop: 4,
            background: COLORS.text, color: COLORS.bg,
            border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: FONTS.sans, letterSpacing: '-0.01em',
          }}>+ Add exercise</button>
        )}

        {/* Comments section (view mode) */}
        {!editing && (
          <div style={{ marginTop: 28, borderTop: `0.5px solid ${COLORS.border}`, paddingTop: 20 }}>
            {localComments.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textDim,
                  letterSpacing: '0.14em', fontWeight: 500, textTransform: 'uppercase', marginBottom: 12,
                }}>
                  Comments ({localComments.length})
                </div>
                {localComments.map((c, i) => (
                  <div key={c.id || i} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <Avatar
                      initials={getInitials(c.profiles?.display_name || '?')}
                      size={28}
                      colorIndex={c.profiles?.id?.charCodeAt(0) || 0}
                      src={c.profiles?.avatar_url || null}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>
                          {c.profiles?.display_name}
                        </span>
                        <span style={{
                          fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textDim,
                          letterSpacing: '0.08em',
                        }}>
                          {timeAgo(c.created_at).toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: COLORS.text, marginTop: 3, lineHeight: 1.4 }}>
                        {c.body}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={commentInput}
                onChange={e => setCommentInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment(); }
                }}
                placeholder="Add a comment…"
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 10,
                  border: `1px solid ${COLORS.border}`, background: COLORS.card,
                  color: COLORS.text, fontSize: 13, fontFamily: FONTS.sans,
                  outline: 'none',
                }}
              />
              <button
                onClick={handlePostComment}
                disabled={!commentInput.trim() || postingComment}
                style={{
                  padding: '10px 16px', borderRadius: 10, border: 'none',
                  background: commentInput.trim() ? COLORS.text : COLORS.border,
                  color: commentInput.trim() ? COLORS.bg : COLORS.textDim,
                  fontWeight: 700, fontSize: 13, fontFamily: FONTS.sans,
                  cursor: commentInput.trim() && !postingComment ? 'pointer' : 'default',
                  opacity: postingComment ? 0.6 : 1,
                  whiteSpace: 'nowrap',
                }}
              >{postingComment ? '…' : 'Post'}</button>
            </div>
          </div>
        )}

        {/* Action buttons (view mode) */}
        {!editing && onSteel && (
          <button onClick={() => onSteel(workout)} style={{
            width: '100%', padding: 13, marginTop: 14,
            background: 'transparent', color: COLORS.text,
            border: `1px solid ${COLORS.border}`, borderRadius: 12,
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            fontFamily: FONTS.sans, letterSpacing: '-0.01em',
          }}>+ Steel this workout</button>
        )}

        {/* Delete (edit mode) */}
        {editing && isOwner && (
          <button onClick={() => setShowDeleteConfirm(true)} style={{
            width: '100%', padding: 12, marginTop: 24,
            background: 'transparent',
            color: COLORS.red || '#EF4444',
            border: `1px solid ${COLORS.red || '#EF4444'}`,
            borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: FONTS.sans, letterSpacing: '-0.01em',
          }}>Delete workout</button>
        )}
      </div>

      {/* Exercise picker */}
      {showPicker && (
        <ExercisePicker
          exercises={exercises}
          onSelect={addExercise}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 90,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: COLORS.card, borderRadius: 16, padding: 22, maxWidth: 320, width: '100%',
            border: `1px solid ${COLORS.border}`, fontFamily: FONTS.sans,
          }}>
            <div style={{
              fontSize: 17, fontWeight: 800, color: COLORS.text,
              letterSpacing: '-0.02em', marginBottom: 6,
            }}>Delete workout?</div>
            <div style={{
              fontSize: 13, color: COLORS.textDim, marginBottom: 18, lineHeight: 1.45,
            }}>
              This permanently removes the workout, all sets, likes and comments. Can't be undone.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{
                flex: 1, padding: 11, background: 'transparent', color: COLORS.text,
                border: `1px solid ${COLORS.border}`, borderRadius: 999,
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONTS.sans,
              }}>Keep</button>
              <button onClick={handleDelete} disabled={saving} style={{
                flex: 1, padding: 11,
                background: COLORS.red || '#EF4444', color: '#fff',
                border: 'none', borderRadius: 999,
                fontSize: 13, fontWeight: 700,
                cursor: saving ? 'wait' : 'pointer', fontFamily: FONTS.sans,
                opacity: saving ? 0.6 : 1,
              }}>{saving ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
