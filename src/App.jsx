import React, { useState, useEffect } from 'react';
import { useStore } from './lib/store';
import { useTheme, getColors, refreshColors, COLORS, BottomTabBar, Toast, Spinner, Avatar, Icon, getInitials } from './components/UI';
import Auth from './pages/Auth';
import Feed from './pages/Feed';
import Discover from './pages/Discover';
import LogWorkout from './pages/LogWorkout';
import Leaderboard from './pages/Leaderboard';
import UserProfile from './pages/UserProfile';
import GymCommunity from './pages/GymCommunity';
import Profile from './pages/Profile';

const tabs = [
  { id: 'feed', label: 'Home', icon: 'home' },
  { id: 'discover', label: 'Discover', icon: 'search' },
  { id: 'log', label: '', icon: 'plus', center: true },
  { id: 'gym', label: 'Gym', icon: 'users' },
  { id: 'profile', label: 'You', icon: 'user' },
];

// Blurred overlay for pages that need sign-up
function AuthGate({ children, message, onSignUp }) {
  return (
    <div style={{ position: 'relative', minHeight: 320 }}>
      <div style={{ filter: 'blur(6px)', pointerEvents: 'none', opacity: 0.5 }}>
        {children}
      </div>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 32,
        background: COLORS.isDark ? 'rgba(10,14,23,0.6)' : 'rgba(245,246,250,0.6)',
      }}>
        <div style={{
          background: COLORS.card, borderRadius: 20, padding: '32px 28px', textAlign: 'center',
          border: `1px solid ${COLORS.border}`,
          boxShadow: COLORS.isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.1)',
          maxWidth: 300, width: '100%',
        }}>
          <Icon name="lock" size={36} color={COLORS.accent} />
          <div style={{ fontWeight: 700, fontSize: 18, color: COLORS.text, marginTop: 12 }}>
            {message || 'Sign up to unlock'}
          </div>
          <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 6, lineHeight: 1.4 }}>
            Create a free account to access this feature
          </div>
          <button onClick={onSignUp} style={{
            marginTop: 16, padding: '12px 32px', borderRadius: 10, border: 'none',
            background: COLORS.accent, color: COLORS.isDark ? COLORS.bg : '#fff',
            fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', width: '100%',
          }}>Sign Up Free</button>
        </div>
      </div>
    </div>
  );
}

// Placeholder cards for blurred gated pages
function PlaceholderCards({ count = 3, height = 120 }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          background: COLORS.isDark ? COLORS.card : '#DEE2E8',
          borderRadius: 14, padding: 14, marginBottom: 10,
          border: `1px solid ${COLORS.isDark ? COLORS.border : '#C8CDD5'}`, height,
        }}>
          <div style={{ background: COLORS.isDark ? COLORS.border : '#C0C5CE', borderRadius: 8, height: 14, width: '60%', marginBottom: 8 }} />
          <div style={{ background: COLORS.isDark ? COLORS.border : '#C0C5CE', borderRadius: 6, height: 10, width: '40%' }} />
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const { user, profile, loading, init, isGuest, offline, fetchFeed, fetchTemplates } = useStore();
  const { colors: COLORS, theme, toggle: toggleTheme } = useTheme();
  refreshColors(); // keep static COLORS in sync with theme

  const [tab, setTab] = useState('log');
  const [toast, setToast] = useState(null);
  const [steelPrefill, setSteelPrefill] = useState(null);
  const [viewUserId, setViewUserId] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [authMode, setAuthMode] = useState('signup');
  const [showSteelPopup, setShowSteelPopup] = useState(false);
  const [steelData, setSteelData] = useState(null);
  const [workoutMinimized, setWorkoutMinimized] = useState(false);
  const [minimizedInfo, setMinimizedInfo] = useState(null);

  useEffect(() => { init(); }, []);

  // Once logged in, fetch social data
  useEffect(() => {
    if (!isGuest) {
      fetchFeed();
      fetchTemplates();
    }
  }, [isGuest]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const promptAuth = (msg, mode = 'signup') => {
    setAuthMessage(msg || '');
    setAuthMode(mode);
    setShowAuth(true);
  };

  const handleSteel = async (workout) => {
    if (isGuest) { promptAuth('Sign up to Steel workouts from other athletes'); return; }
    const template = await useStore.getState().steelWorkout(workout.id);
    if (template) {
      template.steeled_from = workout.id;
      setSteelData({ template, title: workout.title, from: workout.profiles?.display_name });
      setShowSteelPopup(true);
    }
  };

  const handleSteelStart = () => {
    if (steelData) {
      setSteelPrefill(steelData.template);
      setViewUserId(null);
      setTab('log');
      showToast(`Starting "${steelData.title}" from ${steelData.from}!`);
    }
    setShowSteelPopup(false);
    setSteelData(null);
  };

  const handleSteelSave = async () => {
    if (steelData) {
      await useStore.getState().saveTemplate(
        `${steelData.title} (from ${steelData.from})`,
        steelData.template.exercises
      );
      showToast(`Saved "${steelData.title}" as a template!`);
    }
    setShowSteelPopup(false);
    setSteelData(null);
  };

  const handleSteelFromProfile = (template, title, athleteName) => {
    setSteelPrefill(template);
    setViewUserId(null);
    setTab('log');
    showToast(`Steeled "${title}" from ${athleteName}!`);
  };

  const handleViewProfile = (userId) => {
    if (isGuest) { promptAuth('Sign up to view athlete profiles'); return; }
    if (userId === user?.id) { setTab('profile'); } else { setViewUserId(userId); }
  };

  if (loading) {
    return (
      <div style={{ background: COLORS.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </div>
    );
  }

  // Main app shell — works for both guests and logged-in users
  const renderContent = () => {
    // Viewing another user's profile (logged in only)
    if (viewUserId && !isGuest) {
      return (
        <div style={{ padding: '8px 16px 90px' }}>
          <UserProfile userId={viewUserId} onBack={() => setViewUserId(null)} onSteel={handleSteelFromProfile} />
        </div>
      );
    }

    return (
      <div style={{ padding: '0 16px 90px' }}>
        {/* HOME / FEED */}
        {tab === 'feed' && (
          isGuest ? (
            <div>
              {/* Show a peek of the feed then gate */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>Activity Feed</div>
                <div style={{ fontSize: 13, color: COLORS.textDim }}>See what athletes at your gym are lifting</div>
              </div>
              <AuthGate message="Sign up to see the community feed" onSignUp={() => promptAuth('Join Steel to see workouts from athletes you follow')}>
                <PlaceholderCards count={3} height={180} />
              </AuthGate>
            </div>
          ) : (
            <Feed onSteel={handleSteel} onProfile={handleViewProfile} />
          )
        )}

        {/* DISCOVER */}
        {tab === 'discover' && (
          isGuest ? (
            <AuthGate message="Sign up to discover athletes" onSignUp={() => promptAuth('Create an account to find and follow athletes')}>
              <PlaceholderCards count={3} height={120} />
            </AuthGate>
          ) : (
            <Discover onViewProfile={handleViewProfile} />
          )
        )}

        {/* LOG WORKOUT — always mounted once started, hidden when on other tabs */}
        {(tab === 'log' || workoutMinimized || steelPrefill) && (
          <div key="workout-logger" style={{ display: tab === 'log' ? 'block' : 'none' }}>
            <LogWorkout
              prefill={steelPrefill}
              onMinimize={(info) => {
                setMinimizedInfo(info);
                setWorkoutMinimized(true);
                setTab('feed');
              }}
              onDone={() => {
                setSteelPrefill(null);
                setWorkoutMinimized(false);
                setMinimizedInfo(null);
                showToast('Workout saved!');
                if (!isGuest) setTab('feed');
              }}
            />
          </div>
        )}

        {/* GYM COMMUNITY */}
        {tab === 'gym' && (
          isGuest ? (
            <AuthGate message="Sign up to join your gym's community" onSignUp={() => promptAuth('Join Steel to connect with your gym and compete on leaderboards')}>
              <PlaceholderCards count={4} height={60} />
            </AuthGate>
          ) : (
            <GymCommunity onViewProfile={handleViewProfile} />
          )
        )}

        {/* PROFILE */}
        {tab === 'profile' && (
          isGuest ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <Icon name="user" size={48} color={COLORS.textDim} />
              <div style={{ fontWeight: 700, fontSize: 18, color: COLORS.text, marginTop: 12 }}>Your Profile</div>
              <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 4, marginBottom: 20, lineHeight: 1.5 }}>
                Sign up to save your workouts to the cloud, access them from any device, and join the community.
              </div>
              {/* Show guest workout count */}
              {(() => {
                try {
                  const local = JSON.parse(localStorage.getItem('steel_guest_workouts') || '[]');
                  if (local.length > 0) {
                    return (
                      <div style={{ background: `${COLORS.accent}12`, border: `1px solid ${COLORS.accent}25`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
                        <div style={{ fontSize: 14, color: COLORS.accent, fontWeight: 600 }}>
                          You have {local.length} workout{local.length > 1 ? 's' : ''} saved locally
                        </div>
                        <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 4 }}>
                          Sign up to sync them to your account
                        </div>
                      </div>
                    );
                  }
                } catch {}
                return null;
              })()}
              <button onClick={() => promptAuth('Create your account to save your workouts')} style={{
                padding: '14px 32px', borderRadius: 12, border: 'none',
                background: COLORS.accent, color: COLORS.isDark ? COLORS.bg : '#fff', fontWeight: 700, fontSize: 16,
                cursor: 'pointer', fontFamily: 'inherit', width: '100%',
              }}>Create Account</button>
              <button onClick={() => promptAuth('', 'login')} style={{
                border: `1px solid ${COLORS.border}`, color: COLORS.text, fontWeight: 600,
                fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', width: '100%',
              }}>Log In</button>
            </div>
          ) : (
            <Profile onViewProfile={handleViewProfile} />
          )
        )}
      </div>
    );
  };

  return (
    <div key={theme} style={{ background: COLORS.bg, minHeight: '100vh', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: COLORS.text }}>
      {/* Offline banner */}
      {offline && (
        <div style={{
          background: COLORS.orange, color: '#fff', padding: '6px 16px', fontSize: 12,
          fontWeight: 600, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Icon name="wifiOff" size={14} color="#fff" /> You're offline — workouts will sync when you're back
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '16px 16px 12px', position: 'sticky', top: 0, zIndex: 10, background: `${COLORS.bg}EE`, backdropFilter: 'blur(16px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '3px', fontStyle: 'italic' }}>
            <span style={{ color: COLORS.text }}>STEEL</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Theme toggle */}
            <button onClick={toggleTheme} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            }}>
              <Icon name={theme === 'light' ? 'moon' : 'sun'} size={20} color={COLORS.textDim} />
            </button>
            {isGuest ? (
              <button onClick={() => promptAuth('')} style={{
                background: COLORS.accent, border: 'none', borderRadius: 8,
                padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                color: COLORS.isDark ? COLORS.bg : '#fff', fontFamily: 'inherit',
              }}>Sign Up</button>
            ) : profile && (
              <div onClick={() => setTab('profile')} style={{ cursor: 'pointer' }}>
                <Avatar initials={getInitials(profile.display_name)} size={32} colorIndex={profile.id?.charCodeAt(0) || 0} src={profile.avatar_url || null} />
              </div>
            )}
          </div>
        </div>
      </div>

      {renderContent()}

      {/* Minimized workout bar */}
      {workoutMinimized && minimizedInfo && tab !== 'log' && (
        <div onClick={() => setTab('log')} style={{
          position: 'fixed', bottom: 64, left: 8, right: 8, zIndex: 25,
          background: COLORS.accent, borderRadius: 14, padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', boxShadow: `0 4px 20px ${COLORS.accent}44`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: '#fff', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{minimizedInfo.title}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                {minimizedInfo.exerciseCount} exercise{minimizedInfo.exerciseCount !== 1 ? 's' : ''} · {minimizedInfo.setCount} sets done
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: 8 }}>
            Resume
          </div>
        </div>
      )}

      <BottomTabBar tabs={tabs} active={tab} onChange={(t) => { setViewUserId(null); setTab(t); if (t !== 'log') setSteelPrefill(null); }} />

      {/* Auth modal */}
      {showAuth && <Auth onClose={() => setShowAuth(false)} message={authMessage} initialMode={authMode} />}

      {/* Steel It popup */}
      {showSteelPopup && steelData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 55, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: COLORS.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, border: `1px solid ${COLORS.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Icon name="copy" size={20} color={COLORS.accent} />
              <span style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>Steel It</span>
            </div>
            <div style={{ fontSize: 14, color: COLORS.textDim, marginBottom: 6 }}>
              {steelData.title}
            </div>
            <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 20 }}>
              from {steelData.from}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={handleSteelStart} style={{
                width: '100%', padding: 14, borderRadius: 10, border: 'none', background: COLORS.accent,
                color: COLORS.isDark ? COLORS.bg : '#fff', fontWeight: 700, fontSize: 15,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Start Workout Now</button>
              <button onClick={handleSteelSave} style={{
                width: '100%', padding: 14, borderRadius: 10, border: `1px solid ${COLORS.border}`,
                background: COLORS.bg, color: COLORS.text, fontWeight: 600, fontSize: 14,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Save for Later</button>
              <button onClick={() => { setShowSteelPopup(false); setSteelData(null); }} style={{
                width: '100%', padding: 10, borderRadius: 10, border: 'none', background: 'transparent',
                color: COLORS.textDim, fontWeight: 500, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} />

      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        * { box-sizing: border-box; } ::-webkit-scrollbar { display: none; }
        body { margin: 0; background: ${COLORS.bg}; }
        input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
}
