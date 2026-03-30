import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { COLORS, Input, Button } from '../components/UI';

export default function Auth() {
  const [mode, setMode] = useState('login');
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
      if (!username.trim() || !displayName.trim()) {
        setError('All fields are required');
        setLoading(false);
        return;
      }
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username: username.trim(), display_name: displayName.trim() },
        },
      });
      if (err) setError(err.message);
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: -1 }}>
          <span style={{ color: COLORS.text }}>STEEL</span>
          <span style={{ color: COLORS.accent }}>.</span>
        </div>
        <div style={{ color: COLORS.textDim, fontSize: 14, marginTop: 8 }}>
          Steel workouts from athletes you admire
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: 360 }}>
        {mode === 'signup' && (
          <>
            <Input label="Display Name" placeholder="e.g. Adam M." value={displayName} onChange={e => setDisplayName(e.target.value)} />
            <Input label="Username" placeholder="e.g. adam_lifts" value={username} onChange={e => setUsername(e.target.value)} />
          </>
        )}
        <Input label="Email" type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} />
        <Input label="Password" type="password" placeholder={mode === 'signup' ? 'Min 6 characters' : 'Your password'} value={password} onChange={e => setPassword(e.target.value)} />

        {error && <div style={{ color: COLORS.red, fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</div>}

        <Button onClick={handleSubmit} disabled={loading} style={{ width: '100%', padding: 14, fontSize: 16, borderRadius: 12, marginTop: 8 }}>
          {loading ? 'Loading...' : mode === 'login' ? 'Log in' : 'Create account'}
        </Button>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
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
