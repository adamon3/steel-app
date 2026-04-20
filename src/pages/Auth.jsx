import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { COLORS } from '../components/UI';

const FONTS = {
  sans: "'Inter Tight', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
  serif: "'Instrument Serif', Georgia, serif",
};

export default function Auth({ onClose, message, initialMode }) {
  const { user } = useStore();
  const [mode, setMode] = useState(initialMode || 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => { if (user && onClose) onClose(); }, [user]);

  const handleSubmit = async () => {
    setError(''); setSuccess(''); setLoading(true);

    if (mode === 'signup') {
      if (!displayName.trim()) { setError('Display name is required'); setLoading(false); return; }
      if (!username.trim()) { setError('Username is required'); setLoading(false); return; }
      if (!email.trim()) { setError('Email is required'); setLoading(false); return; }
      if (password.length < 6) { setError('Password must be at least 6 characters'); setLoading(false); return; }

      const cleanUsername = username.trim().toLowerCase().replace(/\s/g, '_');
      if (cleanUsername.length < 3) { setError('Username must be at least 3 characters'); setLoading(false); return; }
      if (!/^[a-z0-9_]+$/.test(cleanUsername)) { setError('Only letters, numbers, underscores'); setLoading(false); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email'); setLoading(false); return; }

      const { data: existing } = await supabase.from('profiles').select('id').eq('username', cleanUsername).maybeSingle();
      if (existing) { setError('Username is already taken'); setLoading(false); return; }

      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: { data: { username: cleanUsername, display_name: displayName.trim() } },
      });

      if (err) setError(err.message);
      else if (data?.user?.identities?.length === 0) setError('Account with this email exists. Log in.');
      else if (!data?.session) {
        setSuccess('Account created. Check email to confirm, then log in.');
        setMode('login');
      }
    } else {
      if (!email.trim() || !password) { setError('Email and password required'); setLoading(false); return; }
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) setError(err.message.includes('Invalid login') ? 'Incorrect email or password' : err.message);
    }
    setLoading(false);
  };

  const inputStyle = {
    width: '100%', padding: '13px 14px', borderRadius: 10,
    border: `1px solid ${COLORS.border}`, background: COLORS.card,
    color: COLORS.text, fontSize: 15, fontFamily: FONTS.sans,
    outline: 'none', boxSizing: 'border-box', letterSpacing: '-0.01em',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 60,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        background: COLORS.bg, borderRadius: '24px 24px 0 0',
        padding: '28px 20px 32px', width: '100%', maxWidth: 420,
        maxHeight: '90vh', overflowY: 'auto',
        fontFamily: FONTS.sans,
      }}>
        {/* Header: serif italic STEEL wordmark with lime dot */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div style={{
            fontFamily: "'Inter Tight', -apple-system, sans-serif",
            fontWeight: 900, fontSize: 24, color: COLORS.text,
            letterSpacing: '0.02em',
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            STEEL
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: '#BFE600',
              display: 'inline-block',
            }} />
          </div>
          {onClose && (
            <button onClick={onClose} style={{
              background: 'none', border: 'none', padding: 4, cursor: 'pointer',
              fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textDim,
              letterSpacing: '0.1em', fontWeight: 500, textTransform: 'uppercase',
            }}>Close</button>
          )}
        </div>

        {message && (
          <div style={{
            background: COLORS.card, border: `1px solid ${COLORS.border}`,
            borderRadius: 10, padding: '10px 14px', marginBottom: 18,
            fontSize: 13, color: COLORS.text, lineHeight: 1.5,
          }}>{message}</div>
        )}

        <div style={{
          fontSize: 24, fontWeight: 800, color: COLORS.text,
          letterSpacing: '-0.02em', marginBottom: 4,
        }}>
          {mode === 'signup' ? 'Create account' : 'Welcome back'}
        </div>
        <div style={{
          fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim,
          letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500,
          marginBottom: 24,
        }}>
          {mode === 'signup' ? 'Join the gym' : 'Log in to continue'}
        </div>

        {mode === 'signup' && (
          <>
            <div style={{ marginBottom: 12 }}>
              <input type="text" autoComplete="name" placeholder="Display name" value={displayName}
                onChange={e => setDisplayName(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <input type="text" autoComplete="username" placeholder="Username" value={username}
                onChange={e => setUsername(e.target.value)} style={inputStyle} />
            </div>
          </>
        )}

        <div style={{ marginBottom: 12 }}>
          <input type="email" autoComplete="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()} style={inputStyle} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()} style={inputStyle} />
        </div>

        {error && (
          <div style={{
            color: COLORS.red, fontSize: 12, marginBottom: 12, textAlign: 'center',
            lineHeight: 1.4, fontFamily: FONTS.mono, letterSpacing: '0.04em',
          }}>{error}</div>
        )}
        {success && (
          <div style={{
            color: COLORS.text, fontSize: 12, marginBottom: 12, textAlign: 'center',
            lineHeight: 1.4, fontFamily: FONTS.mono, letterSpacing: '0.04em',
          }}>{success}</div>
        )}

        <button onClick={handleSubmit} disabled={loading} style={{
          width: '100%', padding: 14, fontSize: 14, fontWeight: 700,
          borderRadius: 999, marginTop: 4,
          background: COLORS.text, color: COLORS.bg, border: 'none',
          cursor: loading ? 'wait' : 'pointer',
          fontFamily: FONTS.sans, letterSpacing: '-0.01em',
          opacity: loading ? 0.6 : 1,
        }}>
          {loading ? 'Loading…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 18, paddingBottom: 8 }}>
          <button onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError(''); setSuccess('');
          }} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: FONTS.sans, fontSize: 13, fontWeight: 500,
            color: COLORS.textDim, letterSpacing: '-0.01em',
          }}>
            {mode === 'login'
              ? <>New here? <span style={{ color: COLORS.text, fontWeight: 700 }}>Sign up</span></>
              : <>Have an account? <span style={{ color: COLORS.text, fontWeight: 700 }}>Log in</span></>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
