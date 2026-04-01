import React from 'react';

export const COLORS = {
  bg: "#0A0E17",
  card: "#141B2D",
  card2: "#1A2340",
  accent: "#00E676",
  accentDim: "#00C853",
  orange: "#FF6D00",
  text: "#E8EAF0",
  textDim: "#7B8CA8",
  border: "#1E2A45",
  pro: "#FFD600",
  red: "#FF5252",
};

export const SPORTS = [
  'Rugby', 'Football', 'CrossFit', 'Bodybuilding', 'Powerlifting',
  'Boxing', 'MMA', 'Swimming', 'Athletics', 'Basketball',
  'Tennis', 'Rowing', 'Cycling', 'General Fitness', 'Other'
];

const avatarColors = ["#00E676","#FF6D00","#448AFF","#FF5252","#AB47BC","#26C6DA","#EC407A"];

// ── SVG Icons (replace emojis) ──
export function Icon({ name, size = 20, color = COLORS.textDim }) {
  const s = { width: size, height: size, display: 'inline-block', verticalAlign: 'middle' };
  const icons = {
    home: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    search: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    plus: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    trophy: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/></svg>,
    user: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    clock: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    weight: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="9" width="4" height="6" rx="1"/><rect x="18" y="9" width="4" height="6" rx="1"/><rect x="6" y="7" width="3" height="10" rx="1"/><rect x="15" y="7" width="3" height="10" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/></svg>,
    fire: <svg style={s} viewBox="0 0 24 24" fill={color} stroke="none"><path d="M12 23c-3.866 0-7-3.134-7-7 0-3.037 2.346-6.235 4.5-8.5.439-.462 1.048-.199 1.214.34C11.13 9.208 12 10.5 12 10.5s1.5-2.5 1.5-5c0-.55.664-.825 1.05-.437C17.105 7.68 19 11.014 19 16c0 3.866-3.134 7-7 7z"/></svg>,
    heart: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
    heartFill: <svg style={s} viewBox="0 0 24 24" fill={color} stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
    comment: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
    copy: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
    check: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    lock: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
    globe: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
    pin: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
    users: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
    star: <svg style={s} viewBox="0 0 24 24" fill={color} stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    settings: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
    back: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  };
  return icons[name] || null;
}

export function Avatar({ initials, size = 40, colorIndex = 0, onClick }) {
  const color = avatarColors[colorIndex % avatarColors.length];
  return (
    <div onClick={onClick} style={{
      width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(135deg, ${color}33, ${color}11)`, border: `2px solid ${color}44`,
      fontSize: size * 0.35, fontWeight: 700, color, flexShrink: 0,
      cursor: onClick ? 'pointer' : 'default',
    }}>{initials}</div>
  );
}

export function Badge({ children, color = COLORS.orange }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
      background: `${color}22`, color, border: `1px solid ${color}33`,
    }}>{children}</span>
  );
}

export function Button({ children, onClick, variant = 'primary', style: s = {}, disabled }) {
  const styles = {
    primary: { background: COLORS.accent, color: COLORS.bg, boxShadow: `0 2px 8px ${COLORS.accent}33` },
    secondary: { background: COLORS.card, color: COLORS.text, border: `1px solid ${COLORS.border}` },
    ghost: { background: 'transparent', color: COLORS.textDim },
    danger: { background: COLORS.red, color: '#fff' },
    steeled: { background: `${COLORS.accent}22`, color: COLORS.accent, border: `1px solid ${COLORS.accent}33` },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, fontSize: 14,
      cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
      opacity: disabled ? 0.5 : 1, ...styles[variant], ...s,
    }}>{children}</button>
  );
}

export function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: 'block', fontSize: 12, color: COLORS.textDim, marginBottom: 4, fontWeight: 600 }}>{label}</label>}
      <input {...props} style={{
        width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`,
        background: COLORS.card, color: COLORS.text, fontSize: 14, fontFamily: 'inherit',
        outline: 'none', boxSizing: 'border-box', ...props.style,
      }} />
    </div>
  );
}

export function Select({ label, options, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: 'block', fontSize: 12, color: COLORS.textDim, marginBottom: 4, fontWeight: 600 }}>{label}</label>}
      <select {...props} style={{
        width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`,
        background: COLORS.card, color: COLORS.text, fontSize: 14, fontFamily: 'inherit',
        outline: 'none', boxSizing: 'border-box', appearance: 'none', ...props.style,
      }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── Bottom Tab Bar (fixed, like Strava/Strong) ──
export function BottomTabBar({ tabs, active, onChange }) {
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20,
      background: COLORS.card, borderTop: `1px solid ${COLORS.border}`,
      display: 'flex', padding: '6px 0 env(safe-area-inset-bottom, 8px)',
    }}>
      {tabs.map(t => {
        const isActive = active === t.id;
        const isCenter = t.center;
        if (isCenter) {
          return (
            <div key={t.id} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <button onClick={() => onChange(t.id)} style={{
                width: 52, height: 52, borderRadius: 16, border: 'none', cursor: 'pointer',
                background: COLORS.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: -16, boxShadow: `0 4px 12px ${COLORS.accent}44`,
              }}>
                <Icon name={t.icon} size={24} color={COLORS.bg} />
              </button>
            </div>
          );
        }
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            flex: 1, background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 0',
          }}>
            <Icon name={t.icon} size={22} color={isActive ? COLORS.accent : COLORS.textDim} />
            <span style={{ fontSize: 10, fontWeight: 600, color: isActive ? COLORS.accent : COLORS.textDim }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Toast({ message }) {
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      background: COLORS.accent, color: COLORS.bg, padding: '12px 24px', borderRadius: 12,
      fontWeight: 700, fontSize: 14, boxShadow: `0 8px 32px rgba(0,230,118,0.3)`, zIndex: 100,
      animation: 'slideUp 0.3s ease-out', display: 'flex', alignItems: 'center', gap: 8,
    }}><Icon name="check" size={18} color={COLORS.bg} /> {message}</div>
  );
}

export function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{
        width: 32, height: 32, border: `3px solid ${COLORS.border}`, borderTop: `3px solid ${COLORS.accent}`,
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
      }} />
    </div>
  );
}

export function EmptyState({ icon, title, subtitle }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ marginBottom: 12 }}><Icon name={icon || 'search'} size={40} color={COLORS.textDim} /></div>
      <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: COLORS.textDim }}>{subtitle}</div>
    </div>
  );
}

export function getInitials(name) {
  if (!name) return '??';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function formatVolume(v) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

export function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

export function convertWeight(kg, unit) {
  if (unit === 'lbs') return Math.round(kg * 2.20462 * 10) / 10;
  return kg;
}

export function convertWeightBack(val, unit) {
  if (unit === 'lbs') return Math.round(val / 2.20462 * 10) / 10;
  return val;
}

// Week streak calculator (counts weeks with at least 1 workout)
export function calcWeekStreak(workoutDates) {
  if (!workoutDates || workoutDates.length === 0) return 0;
  const getWeekKey = (d) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    return `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
  };
  const weeks = [...new Set(workoutDates.map(getWeekKey))].sort().reverse();
  const thisWeek = getWeekKey(new Date());
  let streak = 0;
  const now = new Date();
  for (let i = 0; i < 52; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - (i * 7));
    const wk = getWeekKey(d);
    if (weeks.includes(wk)) {
      streak++;
    } else if (i > 0) break; // allow current week to be incomplete
  }
  return streak;
}
