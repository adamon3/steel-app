import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { COLORS } from './UI';

// Banner that appears when a new SW has installed and is waiting to activate.
// Tap "Update" to skipWaiting + reload — eliminates the "users stuck on old
// bundle until hard refresh" problem we kept hitting.
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      // Poll for updates every 60 min so long-open tabs catch new versions.
      if (r) {
        setInterval(() => { r.update(); }, 60 * 60 * 1000);
      }
    },
  });

  if (!needRefresh) return null;

  return (
    <div style={{
      position: 'fixed', left: 12, right: 12, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 78px)',
      zIndex: 35,
      background: COLORS.text, color: COLORS.bg,
      borderRadius: 14, padding: '12px 14px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      boxShadow: COLORS.isDark
        ? '0 10px 30px -10px rgba(0,0,0,0.6)'
        : '0 10px 30px -10px rgba(0,0,0,0.3)',
      fontFamily: "'Inter Tight', -apple-system, sans-serif",
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em' }}>New version available</div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10, opacity: 0.7, letterSpacing: '0.08em',
          textTransform: 'uppercase', fontWeight: 500, marginTop: 2,
        }}>Refresh to update</div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={() => setNeedRefresh(false)}
          style={{
            background: 'transparent', color: COLORS.bg, opacity: 0.6,
            border: 'none', padding: '6px 10px', fontSize: 12, fontWeight: 600,
            fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '-0.01em',
          }}
        >Later</button>
        <button
          onClick={() => updateServiceWorker(true)}
          style={{
            background: COLORS.accent, color: '#0A0A0A',
            border: 'none', borderRadius: 999, padding: '7px 14px',
            fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
            cursor: 'pointer', letterSpacing: '-0.01em',
          }}
        >Update</button>
      </div>
    </div>
  );
}
