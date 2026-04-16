import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { COLORS, Button, Input, Icon, Spinner, convertWeight, convertWeightBack, formatVolume } from '../components/UI';
import { EXERCISE_INFO } from '../components/Tools';

// ── SVG icon components for feelings & misc ──
function FeelingIcon({ level, size = 24, color }) {
  const s = { width: size, height: size };
  switch (level) {
    case 1: return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>;
    case 2: return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="15" x2="16" y2="15"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>;
    case 3: return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>;
    case 4: return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 3 4 3 4-3 4-3"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>;
    case 5: return <svg style={s} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="2"/><path d="M8 13s1.5 4 4 4 4-4 4-4" fill="none"/><path d="M9 9l.5 1 .5-1" fill="none"/><path d="M14 9l.5 1 .5-1" fill="none"/></svg>;
    default: return null;
  }
}

function TrophyIcon({ size = 48, color = '#FACC15' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/></svg>;
}

function CheckCircleIcon({ size = 48, color = '#6366F1' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
}

function SaveIcon({ size = 16, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
}

function ShareIcon({ size = 18, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>;
}

function CameraIcon({ size = 18, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>;
}

function GlobeIcon({ size = 16, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>;
}

function LockIcon({ size = 16, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>;
}

function GripIcon({ size = 18, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>;
}

function estimate1RM(weight, reps) {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

// ── Inline Rest Timer Bar (appears between sets like Strong) ──
function InlineRestBar({ totalSeconds, onDismiss, onAdjust }) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const startRef = useRef(Date.now());
  const totalRef = useRef(totalSeconds);

  useEffect(() => {
    setRemaining(totalSeconds);
    startRef.current = Date.now();
    totalRef.current = totalSeconds;
  }, [totalSeconds]);

  useEffect(() => {
    if (remaining <= 0) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880; gain.gain.value = 0.3;
        osc.start(); osc.stop(ctx.currentTime + 0.15);
        setTimeout(() => {
          const o2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          o2.connect(g2); g2.connect(ctx.destination);
          o2.frequency.value = 1100; g2.gain.value = 0.3;
          o2.start(); o2.stop(ctx.currentTime + 0.2);
        }, 200);
      } catch (e) {}
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      onDismiss();
      return;
    }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  const pct = remaining / totalRef.current;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div style={{ margin: '4px 0', borderRadius: 10, overflow: 'hidden', background: `${COLORS.accent}12` }}>
      <div style={{ position: 'relative', height: 32 }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accentDim || COLORS.accent})`,
          borderRadius: 10, width: `${pct * 100}%`,
          transition: 'width 1s linear',
        }} />
        <div style={{
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: '100%', padding: '0 10px', zIndex: 1,
        }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
            {mins}:{secs.toString().padStart(2, '0')}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => onAdjust(-30)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 4, padding: '2px 8px', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>-30s</button>
            <button onClick={() => onAdjust(30)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 4, padding: '2px 8px', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+30s</button>
            <button onClick={onDismiss} style={{ background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: 4, padding: '2px 8px', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Skip</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Completion Screen ──
function CompletionScreen({ workout, onDone, unit }) {
  const [feeling, setFeeling] = useState(null);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);

  const totalVol = workout.exercises.reduce((t, ex) => t + ex.sets.filter(s => s.completed).reduce((v, s) => v + (s.weight || 0) * (s.reps || 0), 0), 0);
  const totalSets = workout.exercises.reduce((t, ex) => t + ex.sets.filter(s => s.completed).length, 0);
  const prCount = workout.exercises.reduce((t, ex) => t + ex.sets.filter(s => s.completed && s.is_pr).length, 0);

  const feelings = [
    { label: 'Exhausted', value: 1, color: '#EF4444' },
    { label: 'Tough', value: 2, color: '#F97316' },
    { label: 'Good', value: 3, color: '#EAB308' },
    { label: 'Strong', value: 4, color: '#22C55E' },
    { label: 'Amazing', value: 5, color: '#6366F1' },
  ];

  // Compute estimated 1RMs for all exercises
  const estimated1RMs = workout.exercises
    .map(ex => {
      const completed = ex.sets.filter(s => s.completed);
      if (completed.length === 0) return null;
      const best = completed.reduce((top, s) => {
        const est = estimate1RM(s.weight, s.reps);
        return est > top.est ? { est, weight: s.weight, reps: s.reps } : top;
      }, { est: 0, weight: 0, reps: 0 });
      if (best.weight <= 0) return null;
      return { name: ex.name, est1rm: best.est, weight: best.weight, reps: best.reps };
    })
    .filter(Boolean);

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setPhoto({ preview, file });
  };

  const handleDone = async () => {
    let imageUrl = null;
    if (photo?.file) {
      setUploading(true);
      try {
        const ext = photo.file.name.split('.').pop();
        const path = `workouts/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from('avatars').upload(path, photo.file, { upsert: true });
        if (!error) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
          imageUrl = urlData?.publicUrl || null;
        }
      } catch (err) {
        try {
          const reader = new FileReader();
          const dataUrl = await new Promise((res) => { reader.onload = (e) => res(e.target.result); reader.readAsDataURL(photo.file); });
          if (dataUrl.length < 500000) imageUrl = dataUrl;
        } catch {}
      }
      setUploading(false);
    }
    onDone({ feeling, note, imageUrl });
  };

  const handleShare = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');

    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, 1920);
    grad.addColorStop(0, '#09090B');
    grad.addColorStop(1, '#18181B');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    // Accent bar
    ctx.fillStyle = '#6366F1';
    ctx.fillRect(0, 0, 1080, 6);

    // Logo
    ctx.font = 'italic 900 48px -apple-system, sans-serif';
    ctx.fillStyle = '#FAFAFA';
    ctx.fillText('STEEL', 80, 120);

    // Title
    ctx.font = '800 64px -apple-system, sans-serif';
    ctx.fillStyle = '#FAFAFA';
    ctx.fillText(workout.title || 'Workout', 80, 280);

    // Date
    ctx.font = '400 32px -apple-system, sans-serif';
    ctx.fillStyle = '#A1A1AA';
    ctx.fillText(new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }), 80, 340);

    // Stats
    const stats = [
      { v: `${workout.duration_mins}m`, l: 'Duration' },
      { v: String(formatVolume(convertWeight(totalVol, unit))), l: `Volume (${unit})` },
      { v: String(totalSets), l: 'Sets' },
    ];
    if (prCount > 0) stats.push({ v: String(prCount), l: 'PRs' });

    const boxW = (1080 - 160 - (stats.length - 1) * 24) / stats.length;
    stats.forEach((s, i) => {
      const x = 80 + i * (boxW + 24);
      const y = 420;
      ctx.fillStyle = '#27272A';
      ctx.beginPath();
      ctx.roundRect(x, y, boxW, 160, 20);
      ctx.fill();
      ctx.font = '800 56px -apple-system, sans-serif';
      ctx.fillStyle = i === stats.length - 1 && prCount > 0 ? '#FACC15' : '#FAFAFA';
      ctx.textAlign = 'center';
      ctx.fillText(s.v, x + boxW / 2, y + 80);
      ctx.font = '500 24px -apple-system, sans-serif';
      ctx.fillStyle = '#A1A1AA';
      ctx.fillText(s.l, x + boxW / 2, y + 120);
    });
    ctx.textAlign = 'left';

    // Exercises
    const exList = workout.exercises.slice(0, 6);
    exList.forEach((ex, i) => {
      const y = 660 + i * 80;
      const completedSets = ex.sets.filter(s => s.completed);
      const bestWeight = Math.max(...completedSets.map(s => s.weight || 0), 0);
      const bestSet = completedSets.find(s => s.weight === bestWeight);
      ctx.font = '600 34px -apple-system, sans-serif';
      ctx.fillStyle = '#FAFAFA';
      ctx.fillText(ex.name || 'Exercise', 80, y);
      ctx.font = '400 28px -apple-system, sans-serif';
      ctx.fillStyle = '#A1A1AA';
      const setsText = `${completedSets.length} sets`;
      const weightText = bestSet ? ` · ${convertWeight(bestWeight, unit)}${unit} x${bestSet.reps}` : '';
      ctx.fillText(setsText + weightText, 80, y + 36);
      if (completedSets.some(s => s.is_pr)) {
        ctx.font = '700 24px -apple-system, sans-serif';
        ctx.fillStyle = '#FACC15';
        ctx.textAlign = 'right';
        ctx.fillText('PR', 1000, y);
        ctx.textAlign = 'left';
      }
    });
    if (workout.exercises.length > 6) {
      ctx.font = '400 28px -apple-system, sans-serif';
      ctx.fillStyle = '#A1A1AA';
      ctx.fillText(`+${workout.exercises.length - 6} more exercises`, 80, 660 + 6 * 80);
    }

    // PR celebration (SVG trophy text instead of emoji)
    if (prCount > 0) {
      ctx.font = '700 40px -apple-system, sans-serif';
      ctx.fillStyle = '#FACC15';
      ctx.textAlign = 'center';
      ctx.fillText(`${prCount} Personal Record${prCount > 1 ? 's' : ''}!`, 540, 1600);
      ctx.textAlign = 'left';
    }

    // Footer
    ctx.font = 'italic 700 28px -apple-system, sans-serif';
    ctx.fillStyle = '#6366F1';
    ctx.textAlign = 'center';
    ctx.fillText('STEEL', 540, 1820);
    ctx.font = '400 22px -apple-system, sans-serif';
    ctx.fillStyle = '#71717A';
    ctx.fillText('Steel workouts from athletes you admire', 540, 1860);

    try {
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      if (navigator.share && blob) {
        const file = new File([blob], 'steel-workout.png', { type: 'image/png' });
        await navigator.share({ files: [file], title: workout.title });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'steel-workout.png'; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) { console.log('Share cancelled or failed:', e); }
  };

  return (
    <div style={{ textAlign: 'center', padding: '32px 20px' }}>
      <div style={{ marginBottom: 8 }}>
        {prCount > 0 ? <TrophyIcon size={48} color="#FACC15" /> : <CheckCircleIcon size={48} color={COLORS.accent} />}
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color: COLORS.text, marginBottom: 4 }}>Workout Complete!</div>
      <div style={{ fontSize: 14, color: COLORS.textDim, marginBottom: 24 }}>{workout.title}</div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
        {[
          { v: `${workout.duration_mins}m`, l: 'Duration' },
          { v: formatVolume(convertWeight(totalVol, unit)), l: unit },
          { v: totalSets, l: 'Sets' },
          ...(prCount > 0 ? [{ v: prCount, l: 'PRs' }] : []),
        ].map((s, i) => (
          <div key={i} style={{ background: COLORS.card, borderRadius: 12, padding: '12px 14px', border: `1px solid ${COLORS.border}`, minWidth: 65 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>{s.v}</div>
            <div style={{ fontSize: 10, color: COLORS.textDim }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* PR badge */}
      {prCount > 0 && (
        <div style={{ background: `${COLORS.pro}15`, border: `1px solid ${COLORS.pro}33`, borderRadius: 12, padding: 14, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <TrophyIcon size={20} color={COLORS.pro} />
          <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.pro }}>{prCount} Personal Record{prCount > 1 ? 's' : ''}!</span>
        </div>
      )}

      {/* Estimated 1RMs */}
      {estimated1RMs.length > 0 && (
        <div style={{ marginBottom: 20, textAlign: 'left' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 8, textAlign: 'center' }}>Estimated 1RMs</div>
          {estimated1RMs.map((e, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: COLORS.card, borderRadius: 8, marginBottom: 4, border: `1px solid ${COLORS.border}` }}>
              <span style={{ fontSize: 13, color: COLORS.text, fontWeight: 500 }}>{e.name}</span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: COLORS.accent }}>{convertWeight(e.est1rm, unit)} {unit}</span>
                <div style={{ fontSize: 10, color: COLORS.textDim }}>from {convertWeight(e.weight, unit)}x{e.reps}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Photo upload */}
      <div style={{ marginBottom: 20 }}>
        {photo ? (
          <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
            <img src={photo.preview} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 12, border: `1px solid ${COLORS.border}` }} />
            <button onClick={() => setPhoto(null)} style={{
              position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14,
              background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
          </div>
        ) : (
          <label style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 20px', borderRadius: 12, border: `1px dashed ${COLORS.border}`,
            background: COLORS.card, cursor: 'pointer', color: COLORS.textDim, fontSize: 14, fontWeight: 500,
          }}>
            <CameraIcon size={18} color={COLORS.textDim} /> Add a photo
            <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
          </label>
        )}
      </div>

      {/* Feeling score — SVG icons, no emojis */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 10 }}>How did it feel?</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {feelings.map(f => (
            <button key={f.value} onClick={() => setFeeling(f.value)} style={{
              width: 52, height: 56, borderRadius: 12,
              border: feeling === f.value ? `2px solid ${f.color}` : `1px solid ${COLORS.border}`,
              background: feeling === f.value ? `${f.color}15` : COLORS.card,
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
              transition: 'all 0.15s',
            }}>
              <FeelingIcon level={f.value} size={22} color={feeling === f.value ? f.color : COLORS.textDim} />
              <span style={{ fontSize: 7, color: feeling === f.value ? f.color : COLORS.textDim, fontWeight: 600, lineHeight: 1 }}>{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Note */}
      <div style={{ marginBottom: 20, textAlign: 'left' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textDim, marginBottom: 6 }}>Add a note (optional)</div>
        <textarea value={note} onChange={e => setNote(e.target.value)}
          placeholder="How was the session? Anything to remember for next time?"
          rows={2}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${COLORS.border}`,
            background: COLORS.card, color: COLORS.text, fontSize: 14, fontFamily: 'inherit',
            outline: 'none', resize: 'none', boxSizing: 'border-box',
          }} />
      </div>

      <Button onClick={handleDone} disabled={uploading} style={{ width: '100%', padding: 16, fontSize: 16, borderRadius: 14 }}>
        {uploading ? 'Uploading photo...' : 'Done'}
      </Button>

      {/* Share to Stories */}
      <button onClick={handleShare} style={{
        width: '100%', padding: 14, fontSize: 14, borderRadius: 14, marginTop: 10,
        background: COLORS.card, border: `1px solid ${COLORS.border}`,
        color: COLORS.text, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <ShareIcon size={18} color={COLORS.textDim} /> Share to Stories
      </button>
    </div>
  );
}

// ── Template Selector ──
function TemplateSelector({ onSelect, onEmpty, templates }) {
  const relativeTime = (dateStr) => {
    if (!dateStr) return null;
    const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 14) return '1 week ago';
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 60) return '1 month ago';
    return `${Math.floor(days / 30)} months ago`;
  };

  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 900, color: COLORS.text, marginBottom: 4 }}>Start Workout</div>
      <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 20 }}>Choose a template or start fresh</div>
      <button onClick={onEmpty} style={{
        width: '100%', padding: 16, borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 700,
        fontFamily: 'inherit', cursor: 'pointer', marginBottom: 20,
        background: COLORS.accent, color: COLORS.isDark ? COLORS.bg : '#fff',
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
                  <div style={{ fontSize: 11, color: COLORS.accent, marginTop: 6, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="clock" size={12} color={COLORS.accent} /> {relativeTime(t.last_used)}
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

// ── Exercise Picker ──
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
      <div style={{ background: COLORS.bg, flex: 1, marginTop: 20, borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 16px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>Choose Exercise</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowCreate(true)} style={{
                background: COLORS.accent, border: 'none', borderRadius: 6, padding: '6px 10px',
                cursor: 'pointer', fontSize: 12, color: COLORS.isDark ? COLORS.bg : '#fff', fontWeight: 700, fontFamily: 'inherit',
              }}>+ Custom</button>
              <button onClick={onClose} style={{
                background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6,
                padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: COLORS.textDim, fontFamily: 'inherit',
              }}>Close</button>
            </div>
          </div>
          <input placeholder="Search exercises..." value={search} onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`,
              background: COLORS.card, color: COLORS.text, fontSize: 14, fontFamily: 'inherit',
              outline: 'none', marginBottom: 10, boxSizing: 'border-box',
            }} />
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 10, WebkitOverflowScrolling: 'touch' }}>
            {MUSCLE_GROUPS.map(g => (
              <button key={g} onClick={() => setMuscleFilter(g)} style={{
                padding: '5px 10px', borderRadius: 16, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit',
                background: muscleFilter === g ? COLORS.accent : COLORS.card,
                color: muscleFilter === g ? (COLORS.isDark ? COLORS.bg : '#fff') : COLORS.textDim,
              }}>{g}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 16px 20px', minHeight: 0 }}>
          {Object.keys(grouped).length === 0 && (
            <div style={{ textAlign: 'center', padding: 30, color: COLORS.textDim }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>No exercises found</div>
              <button onClick={() => setShowCreate(true)} style={{
                background: COLORS.accent, border: 'none', borderRadius: 8, padding: '10px 20px',
                cursor: 'pointer', fontSize: 13, color: COLORS.isDark ? COLORS.bg : '#fff', fontWeight: 700, fontFamily: 'inherit',
              }}>Create Custom Exercise</button>
            </div>
          )}
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([group, exs]) => (
            <div key={group}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: COLORS.accent, padding: '10px 0 4px',
                textTransform: 'uppercase', letterSpacing: 1,
                position: 'sticky', top: 0, background: COLORS.bg, zIndex: 1,
              }}>{group} ({exs.length})</div>
              {exs.sort((a, b) => a.name.localeCompare(b.name)).map(ex => (
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
                color: COLORS.isDark ? COLORS.bg : '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
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

// ── Main Logger ──
export default function LogWorkout({ prefill, onDone, onMinimize }) {
  const { exercises, fetchExercises, saveWorkout, profile, fetchTemplates, templates, saveTemplate, getPreviousSets } = useStore();
  const [phase, setPhase] = useState(prefill ? 'logging' : 'select');
  const [title, setTitle] = useState(prefill?.title || '');
  const [workoutExercises, setWorkoutExercises] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [restTimerActive, setRestTimerActive] = useState(false);
  const [restTimerSeconds, setRestTimerSeconds] = useState(0);
  const [restDuration, setRestDuration] = useState(120);
  const [lastCompletedSet, setLastCompletedSet] = useState(null);
  const [completedWorkout, setCompletedWorkout] = useState(null);
  const [templateId, setTemplateId] = useState(null);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [previousData, setPreviousData] = useState({});
  const [isPublic, setIsPublic] = useState(true);
  const [showIncompleteConfirm, setShowIncompleteConfirm] = useState(false);
  const [showUpdateTemplate, setShowUpdateTemplate] = useState(false);
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [touchStartYPos, setTouchStartYPos] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const exerciseRefs = useRef([]);
  const dragStartY = useRef(0);
  const unit = profile?.unit_pref || 'kg';

  useEffect(() => { fetchExercises(); fetchTemplates(); }, []);

  // Live timer
  useEffect(() => {
    if (phase !== 'logging') return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase, startTime]);

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
            is_pr: false, set_type: s.set_type || 'normal', completed: false, rpe: 0,
          })),
        };
      });
      setWorkoutExercises(mapped);
      mapped.forEach(e => loadPrevious(e.exercise_id));
    }
  }, [prefill, exercises]);

  // Mouse drag listeners for desktop reorder
  useEffect(() => {
    if (dragIdx === null) return;
    const onMove = (e) => handleDragMove(e.clientY);
    const onUp = () => handleDragEnd();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragIdx]);

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
          is_pr: false, set_type: 'normal', completed: false, rpe: 0,
        })),
      }));
    setWorkoutExercises(exs);
    setTitle(template.name);
    setTemplateId(template.id);
    setPhase('logging');
    exs.forEach(e => loadPrevious(e.exercise_id));
  };

  const handleStartEmpty = () => { setPhase('logging'); };

  const addExercise = (ex) => {
    setWorkoutExercises(prev => [...prev, {
      exercise_id: ex.id, name: ex.name, notes: '',
      sets: [{ weight: 0, reps: 0, is_pr: false, set_type: 'normal', completed: false, rpe: 0 }],
    }]);
    setShowPicker(false);
    setSearch('');
    loadPrevious(ex.id);
  };

  const addSet = (exIdx) => {
    setWorkoutExercises(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const last = next[exIdx].sets[next[exIdx].sets.length - 1];
      next[exIdx].sets.push({ weight: last?.weight || 0, reps: last?.reps || 0, is_pr: false, set_type: 'normal', completed: false, rpe: 0 });
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
      // Auto-fill from previous set in current workout if both fields are empty
      if (!wasCompleted) {
        const s = next[exIdx].sets[setIdx];
        if (!s.weight && !s.reps) {
          // First try previous set in same exercise
          if (setIdx > 0) {
            const prevInExercise = next[exIdx].sets[setIdx - 1];
            if (prevInExercise.weight) s.weight = prevInExercise.weight;
            if (prevInExercise.reps) s.reps = prevInExercise.reps;
          }
          // If still empty, try previous workout data
          if (!s.weight && !s.reps) {
            const prev = previousData[next[exIdx].exercise_id];
            if (prev && prev[setIdx]) {
              s.weight = convertWeight(prev[setIdx].weight, unit);
              s.reps = prev[setIdx].reps;
            }
          }
        }
      }
      next[exIdx].sets[setIdx].completed = !wasCompleted;
      return next;
    });
    const set = workoutExercises[exIdx].sets[setIdx];
    if (!set.completed) {
      // Reset and start rest timer with actual rest duration setting
      setRestTimerSeconds(restDuration);
      setRestTimerActive(true);
      setLastCompletedSet({ exIdx, setIdx });
    }
  };

  const removeExercise = (exIdx) => {
    setWorkoutExercises(prev => prev.filter((_, i) => i !== exIdx));
  };

  // ── Drag-to-reorder handlers ──
  const handleDragStart = (exIdx, clientY) => {
    setDragIdx(exIdx);
    setDragOverIdx(exIdx);
    dragStartY.current = clientY;
    setDragOffsetY(0);
  };

  const handleDragMove = (clientY) => {
    if (dragIdx === null) return;
    setDragOffsetY(clientY - dragStartY.current);
    // Determine which index we're hovering over
    const refs = exerciseRefs.current;
    for (let i = 0; i < refs.length; i++) {
      if (!refs[i]) continue;
      const rect = refs[i].getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (clientY < mid) {
        setDragOverIdx(i);
        return;
      }
    }
    setDragOverIdx(refs.length - 1);
  };

  const handleDragEnd = () => {
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
      setWorkoutExercises(prev => {
        const next = [...prev];
        const [moved] = next.splice(dragIdx, 1);
        next.splice(dragOverIdx, 0, moved);
        // Fix superset links after reorder
        return next.map(e => { const n = { ...e }; delete n.supersetWith; return n; });
      });
    }
    setDragIdx(null);
    setDragOverIdx(null);
    setDragOffsetY(0);
  };

  const handleFinish = async () => {
    const hasCompleted = workoutExercises.some(ex => ex.sets.some(s => s.completed));
    if (!hasCompleted && workoutExercises.length === 0) return;
    const incompleteCount = workoutExercises.reduce((t, ex) => t + ex.sets.filter(s => !s.completed).length, 0);
    if (incompleteCount > 0 && !showIncompleteConfirm) {
      setShowIncompleteConfirm(true);
      return;
    }
    setShowIncompleteConfirm(false);
    if (!title.trim()) setTitle('Workout');
    setSaving(true);
    const durationMins = Math.round((Date.now() - startTime) / 60000);
    const workout = {
      title: title.trim() || 'Workout',
      notes: workoutNotes,
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
      setCompletedWorkout({ ...workout, id: saved.id, duration_mins: durationMins });
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
      await supabase.from('template_exercises').delete().eq('template_id', templateId);
      const rows = workoutExercises.map((ex, i) => ({
        template_id: templateId, exercise_id: ex.exercise_id, sort_order: i,
        default_sets: ex.sets.length, default_reps: ex.sets[0]?.reps || 10,
        default_weight: convertWeightBack(ex.sets[0]?.weight || 0, unit),
      }));
      await supabase.from('template_exercises').insert(rows);
      await fetchTemplates();
    }
    setShowUpdateTemplate(false);
    setPhase('complete');
  };

  const handleSkipUpdateTemplate = () => { setShowUpdateTemplate(false); setPhase('complete'); };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) return;
    await saveTemplate(templateName.trim(), workoutExercises);
    setShowSaveTemplate(false);
    setTemplateName('');
  };

  const elapsedMins = Math.floor(elapsed / 60);
  const elapsedSecs = elapsed % 60;

  // ── TEMPLATE SELECTOR PHASE ──
  if (phase === 'select') {
    return <TemplateSelector templates={templates} onSelect={handleSelectTemplate} onEmpty={handleStartEmpty} />;
  }

  // ── COMPLETION PHASE ──
  if (phase === 'complete' && completedWorkout) {
    return <CompletionScreen workout={completedWorkout} unit={unit} onDone={async (extra) => {
      if (extra && completedWorkout.id) {
        const updates = {};
        if (extra.note) updates.notes = extra.note;
        if (extra.imageUrl) updates.image_url = extra.imageUrl;
        if (Object.keys(updates).length > 0) {
          try { await supabase.from('workouts').update(updates).eq('id', completedWorkout.id); } catch (e) { console.error('Failed to update workout extras:', e); }
        }
      }
      onDone();
    }} />;
  }

  // ── LOGGING PHASE ──
  const hasAnythingCompleted = workoutExercises.some(ex => ex.sets.some(s => s.completed));
  const hasAnyExercises = workoutExercises.length > 0;

  // Swipe down handlers
  const handleTouchStart = (e) => { setTouchStartYPos(e.touches[0].clientY); };
  const handleTouchEnd = (e) => {
    if (touchStartYPos === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartYPos;
    if (deltaY > 80 && touchStartYPos < 100 && workoutExercises.length > 0 && onMinimize) {
      onMinimize({
        title: title || 'Workout', elapsed, exerciseCount: workoutExercises.length,
        setCount: workoutExercises.reduce((t, e) => t + e.sets.filter(s => s.completed).length, 0),
      });
    }
    setTouchStartYPos(null);
  };

  // Input style for weight/reps — better contrast, bolder, thicker borders
  const inputStyle = (isComplete) => ({
    padding: '9px 4px', borderRadius: 8,
    border: isComplete ? `2px solid ${COLORS.accent}55` : `2px solid ${COLORS.border}`,
    background: isComplete ? `${COLORS.accent}10` : COLORS.card,
    color: COLORS.text, fontSize: 16, fontWeight: 800,
    fontFamily: 'inherit', outline: 'none', textAlign: 'center', boxSizing: 'border-box',
  });

  return (
    <div style={{ paddingBottom: 20, paddingTop: 64 }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Sticky top bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30,
        background: `${COLORS.bg}F5`, backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        {/* Pull handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 2px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: COLORS.border }} />
        </div>
        <div style={{ padding: '4px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => {
              if (phase === 'logging' && workoutExercises.length > 0 && onMinimize) {
                onMinimize({
                  title: title || 'Workout', elapsed, exerciseCount: workoutExercises.length,
                  setCount: workoutExercises.reduce((t, e) => t + e.sets.filter(s => s.completed).length, 0),
                });
              } else {
                onDone();
              }
            }} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 13, color: COLORS.textDim, fontFamily: 'inherit' }}>
              <Icon name="back" size={16} color={COLORS.textDim} />
            </button>
            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, fontVariantNumeric: 'tabular-nums' }}>
              {elapsedMins}:{elapsedSecs.toString().padStart(2, '0')}
            </div>
          </div>
          <button onClick={handleFinish} disabled={saving || !hasAnyExercises} style={{
            background: hasAnyExercises ? COLORS.accent : COLORS.card,
            color: hasAnyExercises ? '#fff' : COLORS.textDim,
            border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 800, fontSize: 14,
            cursor: hasAnyExercises ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            opacity: saving ? 0.6 : 1,
          }}>{saving ? 'Saving...' : 'Finish'}</button>
        </div>
      </div>

      {/* Title */}
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Workout Name"
        style={{ width: '100%', fontSize: 22, fontWeight: 800, color: COLORS.text, background: 'transparent', border: 'none', outline: 'none', marginBottom: 8, fontFamily: 'inherit', padding: 0, boxSizing: 'border-box' }} />

      {/* Workout notes */}
      <textarea value={workoutNotes} onChange={e => setWorkoutNotes(e.target.value)}
        placeholder="Add workout notes..." rows={1}
        style={{
          width: '100%', padding: '6px 0', border: 'none', background: 'transparent',
          color: COLORS.textDim, fontSize: 13, fontFamily: 'inherit',
          outline: 'none', resize: 'none', boxSizing: 'border-box', marginBottom: 12,
        }} />

      {/* Rest duration selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: COLORS.textDim, fontWeight: 600 }}>REST:</span>
        {[60, 90, 120, 180, 300].map(s => (
          <button key={s} onClick={() => setRestDuration(s)} style={{
            padding: '4px 10px', borderRadius: 12, border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
            background: restDuration === s ? COLORS.accent : COLORS.card,
            color: restDuration === s ? (COLORS.isDark ? COLORS.bg : '#fff') : COLORS.textDim,
          }}>{s < 60 ? `${s}s` : `${s / 60}m`}</button>
        ))}
      </div>

      {/* Exercises */}
      {workoutExercises.map((ex, exIdx) => {
        const prev = previousData[ex.exercise_id];
        const isSuperset = ex.supersetWith != null;
        const nextIsSuperset = workoutExercises[exIdx + 1]?.supersetWith === exIdx || ex.supersetWith === exIdx - 1;
        const showSupersetBadge = ex.supersetWith != null || workoutExercises.some(e => e.supersetWith === exIdx);
        const isDragging = dragIdx === exIdx;
        const isDropTarget = dragOverIdx === exIdx && dragIdx !== null && dragIdx !== exIdx;
        return (
          <div key={exIdx} ref={el => exerciseRefs.current[exIdx] = el} style={{
            position: isDragging ? 'relative' : undefined,
            zIndex: isDragging ? 10 : undefined,
            transform: isDragging ? `translateY(${dragOffsetY}px)` : undefined,
            transition: isDragging ? 'none' : 'transform 0.2s ease',
            opacity: isDragging ? 0.85 : 1,
          }}>
            {isDropTarget && (
              <div style={{ height: 3, background: COLORS.accent, borderRadius: 2, marginBottom: 4 }} />
            )}
            {ex.supersetWith != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '-8px 0 -4px 20px' }}>
                <div style={{ width: 2, height: 16, background: COLORS.orange }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.orange, textTransform: 'uppercase', letterSpacing: 1 }}>Superset</span>
              </div>
            )}
            <div style={{
              background: COLORS.card, borderRadius: 14, padding: 14, marginBottom: isSuperset && !nextIsSuperset ? 12 : ex.supersetWith != null ? 0 : 12,
              border: `1px solid ${isDragging ? COLORS.accent : showSupersetBadge ? `${COLORS.orange}44` : COLORS.border}`,
              boxShadow: isDragging ? `0 8px 24px ${COLORS.accent}22` : 'none',
              borderBottomLeftRadius: workoutExercises[exIdx + 1]?.supersetWith === exIdx ? 0 : 14,
              borderBottomRightRadius: workoutExercises[exIdx + 1]?.supersetWith === exIdx ? 0 : 14,
              borderTopLeftRadius: ex.supersetWith != null ? 0 : 14,
              borderTopRightRadius: ex.supersetWith != null ? 0 : 14,
            }}>
              {/* Exercise header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <div
                    onTouchStart={(e) => { e.stopPropagation(); handleDragStart(exIdx, e.touches[0].clientY); }}
                    onTouchMove={(e) => { e.stopPropagation(); handleDragMove(e.touches[0].clientY); }}
                    onTouchEnd={(e) => { e.stopPropagation(); handleDragEnd(); }}
                    onMouseDown={(e) => { handleDragStart(exIdx, e.clientY); }}
                    style={{ cursor: 'grab', padding: '4px 2px', touchAction: 'none', flexShrink: 0 }}
                  >
                    <GripIcon size={16} color={COLORS.textDim} />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 15, color: COLORS.accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</span>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                  <button onClick={() => {
                    setWorkoutExercises(prev => { const next = JSON.parse(JSON.stringify(prev)); next[exIdx].showInfo = !next[exIdx].showInfo; return next; });
                  }} style={{ background: 'none', border: 'none', color: COLORS.textDim, cursor: 'pointer', padding: '4px' }}>
                    <Icon name="search" size={14} color={COLORS.textDim} />
                  </button>
                  {exIdx > 0 && ex.supersetWith == null && (
                    <button onClick={() => {
                      setWorkoutExercises(prev => { const next = JSON.parse(JSON.stringify(prev)); next[exIdx].supersetWith = exIdx - 1; return next; });
                    }} style={{ background: 'none', border: 'none', color: COLORS.orange, cursor: 'pointer', padding: '4px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>SS</button>
                  )}
                  {ex.supersetWith != null && (
                    <button onClick={() => {
                      setWorkoutExercises(prev => { const next = JSON.parse(JSON.stringify(prev)); delete next[exIdx].supersetWith; return next; });
                    }} style={{ background: `${COLORS.orange}20`, border: 'none', borderRadius: 4, color: COLORS.orange, cursor: 'pointer', padding: '2px 6px', fontSize: 10, fontWeight: 700, fontFamily: 'inherit' }}>Unlink</button>
                  )}
                  <button onClick={() => removeExercise(exIdx)} style={{ background: 'none', border: 'none', color: COLORS.textDim, cursor: 'pointer', fontSize: 16, fontFamily: 'inherit', padding: '4px 8px' }}>x</button>
                </div>
              </div>

              {/* Exercise info */}
              {ex.showInfo && (
                <div style={{ background: `${COLORS.accent}08`, borderRadius: 8, padding: '8px 10px', marginBottom: 10, fontSize: 13, color: COLORS.textDim, lineHeight: 1.5, border: `1px solid ${COLORS.accent}22` }}>
                  {EXERCISE_INFO[ex.name] || 'No instructions available yet. Check YouTube for form guides.'}
                </div>
              )}

              {/* Exercise notes */}
              <input value={ex.notes || ''} onChange={e => {
                setWorkoutExercises(prev => { const next = JSON.parse(JSON.stringify(prev)); next[exIdx].notes = e.target.value; return next; });
              }} placeholder="Exercise notes..."
                style={{
                  width: '100%', padding: '5px 4px', border: 'none', borderBottom: `1px solid ${COLORS.border}`,
                  background: 'transparent', color: COLORS.textDim, fontSize: 12, fontFamily: 'inherit',
                  outline: 'none', marginBottom: 8, boxSizing: 'border-box',
                }} />

              {/* Column headers */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 6, padding: '0 2px' }}>
                <span style={{ width: 32, fontSize: 10, color: COLORS.textDim, fontWeight: 600 }}>SET</span>
                <span style={{ flex: 1, fontSize: 10, color: COLORS.textDim, fontWeight: 600 }}>PREV</span>
                <span style={{ width: 62, fontSize: 10, color: COLORS.textDim, fontWeight: 600, textAlign: 'center' }}>{unit.toUpperCase()}</span>
                <span style={{ width: 52, fontSize: 10, color: COLORS.textDim, fontWeight: 600, textAlign: 'center' }}>REPS</span>
                <span style={{ width: 38, fontSize: 10, color: COLORS.textDim, fontWeight: 600, textAlign: 'center' }}>RPE</span>
                <span style={{ width: 34, fontSize: 10, color: COLORS.textDim, fontWeight: 600, textAlign: 'center' }}>
                  <Icon name="check" size={12} color={COLORS.textDim} />
                </span>
              </div>

              {/* Progressive overload suggestion */}
              {prev && prev.length > 0 && (() => {
                const lastBest = Math.max(...prev.map(s => s.weight || 0));
                const lastBestSet = prev.find(s => s.weight === lastBest);
                if (lastBest > 0 && lastBestSet) {
                  const suggestWeight = Math.round((lastBest * 1.025) * 2) / 2;
                  return (
                    <div style={{ fontSize: 11, color: COLORS.accent, marginBottom: 6, padding: '4px 8px', background: `${COLORS.accent}08`, borderRadius: 6 }}>
                      Last: {convertWeight(lastBest, unit)}{unit} x{lastBestSet.reps} → Try {convertWeight(suggestWeight, unit)}{unit} or +1 rep
                    </div>
                  );
                }
                return null;
              })()}

              {/* Sets */}
              {ex.sets.map((set, setIdx) => {
                const prevSet = prev && prev[setIdx];
                const isComplete = set.completed;
                const weightRef = `weight-${exIdx}-${setIdx}`;
                const repsRef = `reps-${exIdx}-${setIdx}`;
                const setTypes = ['normal', 'warmup', 'dropset', 'failure'];
                const typeLabels = { normal: setIdx + 1, warmup: 'W', dropset: 'D', failure: 'F' };
                const typeColors = { normal: COLORS.textDim, warmup: COLORS.orange, dropset: '#A855F7', failure: COLORS.red };

                // Show inline timer after the last completed set
                const showInlineTimer = restTimerActive && lastCompletedSet &&
                  lastCompletedSet.exIdx === exIdx && lastCompletedSet.setIdx === setIdx && isComplete;

                return (
                  <React.Fragment key={setIdx}>
                    {/* Set row */}
                    <div style={{
                      display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4, padding: '4px 2px',
                      borderRadius: 8,
                      background: isComplete
                        ? set.set_type === 'warmup' ? `${COLORS.orange}12`
                        : set.set_type === 'dropset' ? '#A855F712'
                        : set.set_type === 'failure' ? `${COLORS.red}12`
                        : `${COLORS.accent}12`
                        : 'transparent',
                      transition: 'background 0.2s',
                    }}>
                      <button onClick={() => {
                        const currentIdx = setTypes.indexOf(set.set_type || 'normal');
                        const nextType = setTypes[(currentIdx + 1) % setTypes.length];
                        updateSet(exIdx, setIdx, 'set_type', nextType);
                      }} style={{
                        width: 32, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: set.set_type && set.set_type !== 'normal' ? `${typeColors[set.set_type]}20` : 'transparent',
                        color: typeColors[set.set_type || 'normal'],
                        fontSize: 12, fontWeight: 800, fontFamily: 'inherit', padding: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{typeLabels[set.set_type || 'normal']}</button>

                      <span onClick={() => {
                        if (prevSet && (!set.weight && !set.reps)) {
                          updateSet(exIdx, setIdx, 'weight', convertWeight(prevSet.weight, unit));
                          updateSet(exIdx, setIdx, 'reps', prevSet.reps);
                        }
                      }} style={{ flex: 1, fontSize: 11, color: prevSet && !set.weight && !set.reps ? COLORS.accent : COLORS.textDim, cursor: prevSet && !set.weight && !set.reps ? 'pointer' : 'default' }}>
                        {prevSet ? `${convertWeight(prevSet.weight, unit)}x${prevSet.reps}` : '-'}
                      </span>

                      <input id={weightRef} type="number" inputMode="decimal" enterKeyHint="next"
                        value={set.weight || ''} placeholder={prevSet ? String(convertWeight(prevSet.weight, unit)) : '0'}
                        onChange={e => updateSet(exIdx, setIdx, 'weight', parseFloat(e.target.value) || 0)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); document.getElementById(repsRef)?.focus(); } }}
                        onFocus={e => e.target.select()}
                        style={{ width: 62, ...inputStyle(isComplete) }}
                      />

                      <input id={repsRef} type="number" inputMode="numeric" enterKeyHint="done"
                        value={set.reps || ''} placeholder={prevSet ? String(prevSet.reps) : '0'}
                        onChange={e => updateSet(exIdx, setIdx, 'reps', parseInt(e.target.value) || 0)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            toggleComplete(exIdx, setIdx);
                            const nextWeight = document.getElementById(`weight-${exIdx}-${setIdx + 1}`);
                            if (nextWeight) setTimeout(() => nextWeight.focus(), 100);
                            else e.target.blur();
                          }
                        }}
                        onFocus={e => e.target.select()}
                        style={{ width: 52, ...inputStyle(isComplete) }}
                      />

                      {/* RPE — number input field */}
                      <input type="number" inputMode="decimal" enterKeyHint="done"
                        value={set.rpe || ''} placeholder="-"
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          updateSet(exIdx, setIdx, 'rpe', (v >= 1 && v <= 10) ? v : e.target.value === '' ? 0 : set.rpe);
                        }}
                        onFocus={e => e.target.select()}
                        style={{
                          width: 38, padding: '7px 2px', borderRadius: 8,
                          border: `1px solid ${COLORS.border}`,
                          background: set.rpe ? `${COLORS.orange}10` : isComplete ? `${COLORS.accent}08` : COLORS.bg,
                          color: set.rpe ? COLORS.orange : COLORS.textDim,
                          fontSize: 12, fontWeight: 700, fontFamily: 'inherit', outline: 'none', textAlign: 'center',
                          boxSizing: 'border-box',
                        }}
                      />

                      {/* Check / PR toggle */}
                      <div style={{ width: 34, display: 'flex', justifyContent: 'center', gap: 0 }}>
                        {isComplete ? (
                          <button onClick={() => toggleComplete(exIdx, setIdx)} onDoubleClick={() => updateSet(exIdx, setIdx, 'is_pr', !set.is_pr)} style={{
                            width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
                            background: set.is_pr ? COLORS.pro : COLORS.accent,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {set.is_pr ? <TrophyIcon size={16} color="#fff" /> : <Icon name="check" size={16} color="#fff" />}
                          </button>
                        ) : (
                          <button onClick={() => toggleComplete(exIdx, setIdx)} style={{
                            width: 30, height: 30, borderRadius: 8, border: `2px solid ${COLORS.border}`,
                            cursor: 'pointer', background: 'transparent',
                          }} />
                        )}
                      </div>
                    </div>

                    {/* Inline rest timer bar — shows right after the completed set */}
                    {showInlineTimer && (
                      <InlineRestBar
                        totalSeconds={restTimerSeconds}
                        onDismiss={() => { setRestTimerActive(false); }}
                        onAdjust={(delta) => {
                          setRestTimerSeconds(prev => Math.max(0, prev + delta));
                          setRestDuration(prev => Math.max(30, prev + delta));
                        }}
                      />
                    )}

                    {/* Swipe-to-delete hint */}
                    {!isComplete && ex.sets.length > 1 && (
                      <div style={{ position: 'relative' }}>
                        <button onClick={() => removeSet(exIdx, setIdx)} style={{
                          position: 'absolute', right: 0, top: -26, background: 'none', border: 'none',
                          color: COLORS.red, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
                          opacity: 0, padding: 2,
                        }}>remove</button>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Add set button */}
              <button onClick={() => addSet(exIdx)} style={{
                width: '100%', padding: 8, borderRadius: 8, border: `1px dashed ${COLORS.border}`,
                background: 'transparent', color: COLORS.textDim, cursor: 'pointer', fontSize: 12,
                fontWeight: 600, fontFamily: 'inherit', marginTop: 4,
              }}>+ Add Set</button>
            </div>
          </div>
        );
      })}

      {/* Add exercise button */}
      <button onClick={() => setShowPicker(true)} style={{
        width: '100%', padding: 14, borderRadius: 12, border: `1px solid ${COLORS.accent}44`,
        background: `${COLORS.accent}08`, color: COLORS.accent, cursor: 'pointer', fontSize: 14,
        fontWeight: 700, fontFamily: 'inherit', marginBottom: 12,
      }}>+ Add Exercise</button>

      {/* Save as template */}
      {workoutExercises.length > 0 && !templateId && (
        showSaveTemplate ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Template name..."
              style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.text, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
            <button onClick={handleSaveAsTemplate} style={{ background: COLORS.accent, color: COLORS.isDark ? COLORS.bg : '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
            <button onClick={() => setShowSaveTemplate(false)} style={{ background: COLORS.card, color: COLORS.textDim, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>x</button>
          </div>
        ) : (
          <button onClick={() => { setShowSaveTemplate(true); setTemplateName(title); }} style={{
            width: '100%', padding: 12, borderRadius: 10, border: `1px solid ${COLORS.border}`,
            background: COLORS.card, color: COLORS.textDim, cursor: 'pointer', fontSize: 13,
            fontWeight: 600, fontFamily: 'inherit', marginBottom: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <SaveIcon size={14} color={COLORS.textDim} /> Save as Template
          </button>
        )
      )}

      {/* Privacy toggle — SVG icons instead of emojis */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderRadius: 10, background: COLORS.card,
        border: `1px solid ${COLORS.border}`, marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isPublic ? <GlobeIcon size={16} color={COLORS.accent} /> : <LockIcon size={16} color={COLORS.textDim} />}
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{isPublic ? 'Public' : 'Private'}</div>
            <div style={{ fontSize: 12, color: COLORS.textDim }}>{isPublic ? 'Visible in feed & leaderboards' : 'Only you can see this'}</div>
          </div>
        </div>
        <button onClick={() => setIsPublic(!isPublic)} style={{
          width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
          background: isPublic ? COLORS.accent : COLORS.border, position: 'relative',
          transition: 'background 0.2s',
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: 11, background: '#fff',
            position: 'absolute', top: 3, left: isPublic ? 23 : 3, transition: 'left 0.2s',
          }} />
        </button>
      </div>

      {/* Cancel */}
      <button onClick={onDone} style={{
        width: '100%', padding: 12, borderRadius: 10, border: `1px solid #FF525233`,
        background: `#FF525210`, color: '#FF5252', cursor: 'pointer', fontSize: 13,
        fontWeight: 600, fontFamily: 'inherit', marginBottom: 20,
      }}>Cancel Workout</button>

      {/* Incomplete sets confirmation */}
      {showIncompleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 55, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: COLORS.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, border: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>Incomplete Sets</div>
            <div style={{ fontSize: 14, color: COLORS.textDim, marginBottom: 20, lineHeight: 1.5 }}>
              You have {workoutExercises.reduce((t, ex) => t + ex.sets.filter(s => !s.completed).length, 0)} uncompleted sets. Incomplete sets won't be saved. Finish anyway?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => handleFinish()} style={{
                flex: 1, padding: 12, borderRadius: 10, border: 'none', background: COLORS.accent,
                color: COLORS.isDark ? COLORS.bg : '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
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
              You changed exercises or sets from the original template. Want to save these changes for next time?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={handleUpdateTemplate} style={{
                width: '100%', padding: 12, borderRadius: 10, border: 'none', background: COLORS.accent,
                color: COLORS.isDark ? COLORS.bg : '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
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
            try {
              const { data } = await supabase
                .from('exercises')
                .insert({ name, muscle_group: muscleGroup, is_custom: true, created_by: user?.id })
                .select()
                .single();
              if (data) {
                await fetchExercises();
                addExercise(data);
                // Picker is closed by addExercise calling setShowPicker(false)
              }
            } catch (e) { console.error('Create custom exercise error:', e); }
          }}
        />
      )}
    </div>
  );
}
