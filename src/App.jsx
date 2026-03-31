import React, { useState, useEffect } from 'react';
import { useStore } from './lib/store';
import { COLORS, TabBar, Toast, Spinner, Avatar, getInitials } from './components/UI';
import Auth from './pages/Auth';
import Feed from './pages/Feed';
import Discover from './pages/Discover';
import LogWorkout from './pages/LogWorkout';
import Leaderboard from './pages/Leaderboard';
import UserProfile from './pages/UserProfile';
import Profile from './pages/Profile';

const tabs = [
  { id: 'feed', label: 'Feed', icon: '📱' },
  { id: 'discover', label: 'Discover', icon: '🔍' },
  { id: 'log', label: 'Log', icon: '💪' },
  { id: 'leaderboard', label: 'Ranks', icon: '🏆' },
  { id: 'profile', label: 'Me', icon: '👤' },
];

export default function App() {
  const { user, profile, loading, init } = useStore();
  const [tab, setTab] = useState('feed');
  const [toast, setToast] = useState(null);
  const [steelPrefill, setSteelPrefill] = useState(null);
  const [viewUserId, setViewUserId] = useState(null);

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
      setViewUserId(null);
      setTab('log');
      showToast(`Steeled "${workout.title}" from ${workout.profiles?.display_name}!`);
    }
  };

  const handleSteelFromProfile = (template, title, athleteName) => {
    setSteelPrefill(template);
    setViewUserId(null);
    setTab('log');
    showToast(`Steeled "${title}" from ${athleteName}!`);
  };

  const handleViewProfile = (userId) => {
    if (userId === user?.id) {
      setTab('profile');
    } else {
      setViewUserId(userId);
    }
  };

  if (loading) {
    return (
      <div style={{ background: COLORS.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </div>
    );
  }

  if (!user) return <Auth />;

  // Viewing another user's profile
  if (viewUserId) {
    return (
      <div style={{
        background: COLORS.bg, minHeight: '100vh',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: COLORS.text,
      }}>
        <div style={{ padding: '16px 16px 8px', position: 'sticky', top: 0, zIndex: 10, background: `${COLORS.bg}EE`, backdropFilter: 'blur(16px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px' }}>
              <span style={{ color: COLORS.text }}>STEEL</span><span style={{ color: COLORS.accent }}>.</span>
            </span>
            {profile && (
              <div onClick={() => { setViewUserId(null); setTab('profile'); }} style={{ cursor: 'pointer' }}>
                <Avatar initials={getInitials(profile.display_name)} size={32} colorIndex={profile.id?.charCodeAt(0) || 0} />
              </div>
            )}
          </div>
        </div>
        <div style={{ padding: '8px 16px 100px' }}>
          <UserProfile userId={viewUserId} onBack={() => setViewUserId(null)} onSteel={handleSteelFromProfile} />
        </div>
        <Toast message={toast} />
        <style>{`
          @keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
          @keyframes spin { to { transform: rotate(360deg); } }
          * { box-sizing: border-box; } ::-webkit-scrollbar { display: none; }
          body { margin: 0; background: ${COLORS.bg}; }
          input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
          input[type="number"] { -moz-appearance: textfield; }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      background: COLORS.bg, minHeight: '100vh',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: COLORS.text,
    }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 8px', position: 'sticky', top: 0, zIndex: 10, background: `${COLORS.bg}EE`, backdropFilter: 'blur(16px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px' }}>
            <span style={{ color: COLORS.text }}>STEEL</span><span style={{ color: COLORS.accent }}>.</span>
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
        {tab === 'feed' && <Feed onSteel={handleSteel} onProfile={handleViewProfile} />}
        {tab === 'discover' && <Discover onViewProfile={handleViewProfile} />}
        {tab === 'log' && (
          <LogWorkout prefill={steelPrefill} onDone={() => { setSteelPrefill(null); setTab('feed'); }} />
        )}
        {tab === 'leaderboard' && <Leaderboard onViewProfile={handleViewProfile} />}
        {tab === 'profile' && <Profile onViewProfile={handleViewProfile} />}
      </div>

      <Toast message={toast} />

      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; } ::-webkit-scrollbar { display: none; }
        body { margin: 0; background: ${COLORS.bg}; }
        input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
}
