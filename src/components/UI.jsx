import React, { createContext, useContext, useState, useEffect } from 'react';

const THEME_KEY = 'steel_theme';

const THEMES = {
  light: {
    bg: "#F8F8F8",
    card: "#FFFFFF",
    card2: "#F2F2F2",
    accent: "#6366F1",      // Mid indigo - punchy on white
    accentDim: "#4F46E5",
    orange: "#F97316",      // Warm orange for badges/sport tags
    text: "#111111",
    textDim: "#71717A",
    border: "#E4E4E7",
    pro: "#EAB308",         // Gold for PRs
    red: "#EF4444",
    isDark: false,
  },
  dark: {
    bg: "#09090B",
    card: "#18181B",
    card2: "#1E1E22",
    accent: "#818CF8",      // Lighter indigo for dark mode
    accentDim: "#6366F1",
    orange: "#FB923C",
    text: "#FAFAFA",
    textDim: "#A1A1AA",
    border: "#27272A",
    pro: "#FACC15",
    red: "#F87171",
    isDark: true,
  },
};

const ThemeContext = createContext({ theme: 'light', colors: THEMES.light, toggle: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || 'light'; } catch { return 'light'; }
  });
  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch {}
  };
  const colors = THEMES[theme];

  useEffect(() => {
    document.body.style.background = colors.bg;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, colors, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }

// Legacy COLORS export — reads from localStorage for non-hook usage
export function getColors() {
  try {
    const t = localStorage.getItem(THEME_KEY) || 'light';
    return THEMES[t];
  } catch { return THEMES.light; }
}

// Mutable COLORS object — all modules share the same reference
export const COLORS = { ...THEMES.light };
export function refreshColors() {
  const c = getColors();
  Object.keys(c).forEach(k => { COLORS[k] = c[k]; });
}
refreshColors();

export const SPORTS = [
  'Rugby', 'Football', 'CrossFit', 'Bodybuilding', 'Powerlifting',
  'Boxing', 'MMA', 'Swimming', 'Athletics', 'Basketball',
  'Tennis', 'Rowing', 'Cycling', 'General Fitness', 'Other'
];

const avatarColors = ["#00C853","#E65100","#448AFF","#EF4444","#AB47BC","#26C6DA","#EC407A"];

export function Icon({ name, size = 20, color }) {
  const c = color || getColors().textDim;
  const s = { width: size, height: size, display: 'inline-block', verticalAlign: 'middle' };
  const icons = {
    home: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    search: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    plus: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    trophy: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/></svg>,
    user: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    clock: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    weight: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="9" width="4" height="6" rx="1"/><rect x="18" y="9" width="4" height="6" rx="1"/><rect x="6" y="7" width="3" height="10" rx="1"/><rect x="15" y="7" width="3" height="10" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/></svg>,
    fire: <svg style={s} viewBox="0 0 24 24" fill={c} stroke="none"><path d="M12 23c-3.866 0-7-3.134-7-7 0-3.037 2.346-6.235 4.5-8.5.439-.462 1.048-.199 1.214.34C11.13 9.208 12 10.5 12 10.5s1.5-2.5 1.5-5c0-.55.664-.825 1.05-.437C17.105 7.68 19 11.014 19 16c0 3.866-3.134 7-7 7z"/></svg>,
    heart: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
    heartFill: <svg style={s} viewBox="0 0 24 24" fill={c} stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
    comment: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
    copy: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
    check: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    lock: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
    globe: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
    pin: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
    users: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
    star: <svg style={s} viewBox="0 0 24 24" fill={c} stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    settings: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
    back: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
    sun: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
    moon: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
    wifi: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>,
    wifiOff: <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0119 12.55"/><path d="M5 12.55a10.94 10.94 0 015.17-2.39"/><path d="M10.71 5.05A16 16 0 0122.56 9"/><path d="M1.42 9a15.91 15.91 0 014.7-2.88"/><path d="M8.53 16.11a6 6 0 016.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>,
  };
  return icons[name] || null;
}

export function Avatar({ initials, size = 40, colorIndex = 0, onClick, src }) {
  const color = avatarColors[colorIndex % avatarColors.length];
  if (src) {
    return (
      <img onClick={onClick} src={src} alt="" style={{
        width: size, height: size, borderRadius: '50%', objectFit: 'cover',
        border: `2px solid ${color}44`, flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default',
      }} />
    );
  }
  return (
    <div onClick={onClick} style={{
      width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(135deg, ${color}33, ${color}11)`, border: `2px solid ${color}44`,
      fontSize: size * 0.35, fontWeight: 700, color, flexShrink: 0,
      cursor: onClick ? 'pointer' : 'default',
    }}>{initials}</div>
  );
}

export function Badge({ children, color }) {
  const c = color || getColors().orange;
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
      background: `${c}22`, color: c, border: `1px solid ${c}33`,
    }}>{children}</span>
  );
}

export function Button({ children, onClick, variant = 'primary', style: s = {}, disabled }) {
  const cl = getColors();
  const styles = {
    primary: { background: cl.accent, color: cl.isDark ? cl.bg : '#fff', boxShadow: `0 2px 8px ${cl.accent}33` },
    secondary: { background: cl.card, color: cl.text, border: `1px solid ${cl.border}` },
    ghost: { background: 'transparent', color: cl.textDim },
    danger: { background: cl.red, color: '#fff' },
    steeled: { background: `${cl.accent}22`, color: cl.accent, border: `1px solid ${cl.accent}33` },
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
  const cl = getColors();
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: 'block', fontSize: 12, color: cl.textDim, marginBottom: 4, fontWeight: 600 }}>{label}</label>}
      <input {...props} style={{
        width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${cl.border}`,
        background: cl.card, color: cl.text, fontSize: 14, fontFamily: 'inherit',
        outline: 'none', boxSizing: 'border-box', ...props.style,
      }} />
    </div>
  );
}

export function Select({ label, options, ...props }) {
  const cl = getColors();
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: 'block', fontSize: 12, color: cl.textDim, marginBottom: 4, fontWeight: 600 }}>{label}</label>}
      <select {...props} style={{
        width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${cl.border}`,
        background: cl.card, color: cl.text, fontSize: 14, fontFamily: 'inherit',
        outline: 'none', boxSizing: 'border-box', appearance: 'none', ...props.style,
      }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function BottomTabBar({ tabs, active, onChange }) {
  const cl = getColors();
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20,
      background: cl.card, borderTop: `1px solid ${cl.border}`,
      display: 'flex', padding: '6px 0 env(safe-area-inset-bottom, 8px)',
    }}>
      {tabs.map(t => {
        const isActive = active === t.id;
        if (t.center) {
          return (
            <div key={t.id} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <button onClick={() => onChange(t.id)} style={{
                width: 52, height: 52, borderRadius: 16, border: 'none', cursor: 'pointer',
                background: cl.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: -16, boxShadow: `0 4px 12px ${cl.accent}44`,
              }}>
                <Icon name={t.icon} size={24} color={cl.isDark ? cl.bg : '#fff'} />
              </button>
            </div>
          );
        }
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            flex: 1, background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 0',
          }}>
            <Icon name={t.icon} size={22} color={isActive ? cl.accent : cl.textDim} />
            <span style={{ fontSize: 10, fontWeight: 600, color: isActive ? cl.accent : cl.textDim }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Toast({ message }) {
  const cl = getColors();
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      background: cl.accent, color: cl.isDark ? cl.bg : '#fff', padding: '12px 24px', borderRadius: 12,
      fontWeight: 700, fontSize: 14, boxShadow: `0 8px 32px ${cl.accent}33`, zIndex: 100,
      animation: 'slideUp 0.3s ease-out', display: 'flex', alignItems: 'center', gap: 8,
    }}><Icon name="check" size={18} color={cl.isDark ? cl.bg : '#fff'} /> {message}</div>
  );
}

export function Spinner() {
  const cl = getColors();
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{
        width: 32, height: 32, border: `3px solid ${cl.border}`, borderTop: `3px solid ${cl.accent}`,
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
      }} />
    </div>
  );
}

export function EmptyState({ icon, title, subtitle }) {
  const cl = getColors();
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ marginBottom: 12 }}><Icon name={icon || 'search'} size={40} color={cl.textDim} /></div>
      <div style={{ fontSize: 16, fontWeight: 700, color: cl.text, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: cl.textDim }}>{subtitle}</div>
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
  let streak = 0;
  const now = new Date();
  for (let i = 0; i < 52; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - (i * 7));
    const wk = getWeekKey(d);
    if (weeks.includes(wk)) streak++;
    else if (i > 0) break;
  }
  return streak;
}
