import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { COLORS, Input, Button, Icon } from '../components/UI';

export default function Auth({ onClose, message }) {
  const [mode, setMode] = useState('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    if (mode === 'signup') {
      if (!username.trim() || !displayName.trim()) { setError('All fields are required'); setLoading(false); return; }
      const { error: err } = await supabase.auth.signUp({
        email, password,
        options: { data: { username: username.trim(), display_name: displayName.trim() } },
      });
      if (err) setError(err.message);
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: COLORS.bg, borderRadius: '20px 20px 0 0', padding: '24px 20px', width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>
              <span style={{ color: COLORS.text }}>STEEL</span><span style={{ color: COLORS.accent }}>.</span>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: COLORS.textDim, fontFamily: 'inherit', fontSize: 13 }}>Close</button>
          )}
        </div>

        {message && (
          <div style={{ background: `${COLORS.accent}12`, border: `1px solid ${COLORS.accent}25`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: COLORS.accent }}>
            {message}
          </div>
        )}

        <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>
          {mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </div>
        <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 16 }}>
          {mode === 'signup' ? 'Join the community and sync your workouts' : 'Log in to access your workouts'}
        </div>

        {mode === 'signup' && (
          <>
            <Input label="Display Name" placeholder="e.g. Adam M." value={displayName} onChange={e => setDisplayName(e.target.value)} />
            <Input label="Username" placeholder="e.g. adam_lifts" value={username} onChange={e => setUsername(e.target.value)} />
          </>
        )}
        <Input label="Email" type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} />
        <Input label="Password" type="password" placeholder={mode === 'signup' ? 'Min 6 characters' : 'Your password'} value={password} onChange={e => setPassword(e.target.value)} />

        {error && <div style={{ color: COLORS.red, fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</div>}

        <Button onClick={handleSubmit} disabled={loading} style={{ width: '100%', padding: 14, fontSize: 16, borderRadius: 12, marginTop: 4 }}>
          {loading ? 'Loading...' : mode === 'login' ? 'Log in' : 'Create account'}
        </Button>

        <div style={{ textAlign: 'center', marginTop: 16, paddingBottom: 8 }}>
          <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }} style={{
            background: 'none', border: 'none', color: COLORS.accent, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', fontWeight: 600,
          }}>
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
          </button>
        </div>
      </div>
    </div>
  );
}
