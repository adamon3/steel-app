import React, { useState, useEffect } from 'react';
import { useStore } from './lib/store';
import { COLORS, TabBar, Toast, Spinner, Avatar, getInitials } from './components/UI';
import Auth from './pages/Auth';
import Feed from './pages/Feed';
import LogWorkout from './pages/LogWorkout';
import Profile from './pages/Profile';

const tabs = [
  { id: 'feed', label: 'Feed', icon: '📱' },
  { id: 'log', label: 'Log', icon: '💪' },
  { id: 'profile', label: 'Profile', icon: '👤' },
];

export default function App() {
  const { user, profile, loading, init } = useStore();
  const [tab, setTab] = useState('feed');
  const [toast, setToast] = useState(null);
  const [steelPrefill, setSteelPrefill] = useState(null);

  useEffect(() => { init(); }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleSteel = async (workout) => {
    const template = await useStore.getState().steelWorkout(workout.id);
    if (template) {
      template.steeled_from = workout.id;
      setSteelPrefill(template);
      setTab('log');
      showToast(`Steeled "${workout.title}" from ${workout.profiles?.display_name}!`);
    }
  };

  const handleProfile = (userId) => {
    setTab('profile');
  };

  if (loading) {
    return (
      <div style={{ background: COLORS.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </div>
    );
  }

  if (!user) return <Auth />;

  return (
    <div style={{
      background: COLORS.bg, minHeight: '100vh',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: COLORS.text,
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 8px', position: 'sticky', top: 0, zIndex: 10,
        background: `${COLORS.bg}EE`, backdropFilter: 'blur(16px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px' }}>
            <span style={{ color: COLORS.text }}>STEEL</span>
            <span style={{ color: COLORS.accent }}>.</span>
          </span>
          {profile && (
            <div onClick={() => setTab('profile')} style={{ cursor: 'pointer' }}>
              <Avatar initials={getInitials(profile.display_name)} size={32} colorIndex={profile.id?.charCodeAt(0) || 0} />
            </div>
          )}
        </div>
        <TabBar tabs={tabs} active={tab} onChange={(t) => { setTab(t); if (t !== 'log') setSteelPrefill(null); }} />
      </div>

      {/* Content */}
      <div style={{ padding: '0 16px 100px' }}>
        {tab === 'feed' && <Feed onSteel={handleSteel} onProfile={handleProfile} />}
        {tab === 'log' && (
          <LogWorkout
            prefill={steelPrefill}
            onDone={() => {
              setSteelPrefill(null);
              setTab('feed');
            }}
          />
        )}
        {tab === 'profile' && <Profile />}
      </div>

      <Toast message={toast} />

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
        body { margin: 0; background: ${COLORS.bg}; }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
}
