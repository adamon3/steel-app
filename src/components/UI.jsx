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

const avatarColors = ["#00E676","#FF6D00","#448AFF","#FF5252","#AB47BC","#26C6DA","#EC407A"];

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
      opacity: disabled ? 0.5 : 1,
      ...styles[variant], ...s,
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
        outline: 'none', boxSizing: 'border-box',
        ...props.style,
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
        outline: 'none', boxSizing: 'border-box', appearance: 'none',
        ...props.style,
      }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: 4, background: COLORS.card, borderRadius: 12 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          flex: 1, padding: '10px 12px', border: 'none', borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s',
          background: active === t.id ? COLORS.accent : 'transparent',
          color: active === t.id ? COLORS.bg : COLORS.textDim,
          fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
        }}>{t.icon} {t.label}</button>
      ))}
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
      animation: 'slideUp 0.3s ease-out',
    }}>{"✅"} {message}</div>
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

export function EmptyState({ emoji, title, subtitle }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{emoji}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: COLORS.textDim }}>{subtitle}</div>
    </div>
  );
}

export function getInitials(name) {
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
