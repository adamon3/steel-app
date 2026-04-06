import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { COLORS, Button } from '../components/UI';

export default function Auth({ onClose, message }) {
  const { user } = useStore();
  const [mode, setMode] = useState('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  // Auto-close when user becomes logged in
  useEffect(() => {
    if (user && onClose) onClose();
  }, [user]);

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    if (mode === 'signup') {
      if (!displayName.trim()) { setError('Display name is required'); setLoading(false); return; }
      if (!username.trim()) { setError('Username is required'); setLoading(false); return; }
      if (!email.trim()) { setError('Email is required'); setLoading(false); return; }
      if (password.length < 6) { setError('Password must be at least 6 characters'); setLoading(false); return; }

      const cleanUsername = username.trim().toLowerCase().replace(/\s/g, '_');
      if (cleanUsername.length < 3) { setError('Username must be at least 3 characters'); setLoading(false); return; }
      if (!/^[a-z0-9_]+$/.test(cleanUsername)) { setError('Only letters, numbers, and underscores'); setLoading(false); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Please enter a valid email'); setLoading(false); return; }

      const { data: existing } = await supabase.from('profiles').select('id').eq('username', cleanUsername).maybeSingle();
      if (existing) { setError('Username is already taken'); setLoading(false); return; }

      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: { data: { username: cleanUsername, display_name: displayName.trim() } },
      });

      if (err) {
        setError(err.message);
      } else if (data?.user?.identities?.length === 0) {
        setError('An account with this email already exists. Try logging in.');
      } else if (data?.session) {
        // Logged in immediately — useEffect will auto-close
      } else {
        setSuccess('Account created! Check your email to confirm, then log in.');
        setMode('login');
      }
    } else {
      if (!email.trim() || !password) { setError('Email and password are required'); setLoading(false); return; }
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) {
        setError(err.message.includes('Invalid login') ? 'Incorrect email or password' : err.message);
      }
    }
    setLoading(false);
  };

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 10, border: `1px solid ${COLORS.border}`,
    background: COLORS.card, color: COLORS.text, fontSize: 15, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: COLORS.bg, borderRadius: '20px 20px 0 0', padding: '24px 20px', width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '3px', fontStyle: 'italic', color: COLORS.text }}>STEEL</div>
          {onClose && (
            <button onClick={onClose} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: COLORS.textDim, fontFamily: 'inherit', fontSize: 13 }}>Close</button>
          )}
        </div>

        {message && (
          <div style={{ background: `${COLORS.accent}15`, border: `1px solid ${COLORS.accent}30`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: COLORS.accent }}>
            {message}
          </div>
        )}

        <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>
          {mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </div>
        <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 20 }}>
          {mode === 'signup' ? 'Join the community and sync your workouts' : 'Log in to access your workouts'}
        </div>

        {mode === 'signup' && (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: COLORS.textDim, marginBottom: 5, fontWeight: 600 }}>Display Name</label>
              <input type="text" autoComplete="name" placeholder="e.g. Adam M." value={displayName}
                onChange={e => setDisplayName(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: COLORS.textDim, marginBottom: 5, fontWeight: 600 }}>Username</label>
              <input type="text" autoComplete="username" placeholder="e.g. adam_lifts" value={username}
                onChange={e => setUsername(e.target.value)} style={inputStyle} />
            </div>
          </>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, color: COLORS.textDim, marginBottom: 5, fontWeight: 600 }}>Email</label>
          <input type="email" autoComplete="email" placeholder="you@email.com" value={email}
            onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} style={inputStyle} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, color: COLORS.textDim, marginBottom: 5, fontWeight: 600 }}>Password</label>
          <input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder={mode === 'signup' ? 'Min 6 characters' : 'Your password'} value={password}
            onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} style={inputStyle} />
        </div>

        {error && <div style={{ color: COLORS.red, fontSize: 13, marginBottom: 12, textAlign: 'center', lineHeight: 1.4 }}>{error}</div>}
        {success && <div style={{ color: COLORS.accent, fontSize: 13, marginBottom: 12, textAlign: 'center', lineHeight: 1.4 }}>{success}</div>}

        <Button onClick={handleSubmit} disabled={loading} style={{ width: '100%', padding: 14, fontSize: 16, borderRadius: 12, marginTop: 4 }}>
          {loading ? 'Loading...' : mode === 'login' ? 'Log in' : 'Create account'}
        </Button>

        <div style={{ textAlign: 'center', marginTop: 16, paddingBottom: 8 }}>
          <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setSuccess(''); }} style={{
            background: 'none', border: 'none', color: COLORS.accent, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', fontWeight: 600,
          }}>
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
          </button>
        </div>
      </div>
    </div>
  );
}
