import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { COLORS, Avatar, Badge, Button, Input, Select, getInitials } from '../components/UI';

export default function Profile() {
  const { profile, updateProfile } = useStore();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});

  if (!profile) return null;

  const startEdit = () => {
    setForm({
      display_name: profile.display_name,
      bio: profile.bio,
      sport: profile.sport,
      gym: profile.gym,
      unit_pref: profile.unit_pref || 'kg',
    });
    setEditing(true);
  };

  const save = async () => {
    await updateProfile(form);
    setEditing(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  if (editing) {
    return (
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.text, marginBottom: 16 }}>Edit Profile</div>
        <Input label="Display Name" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} />
        <Input label="Bio" value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="e.g. Rugby player. Strength focused." />
        <Input label="Sport" value={form.sport} onChange={e => setForm({ ...form, sport: e.target.value })} placeholder="e.g. Skeleton, Rugby, CrossFit" />
        <Input label="Gym" value={form.gym} onChange={e => setForm({ ...form, gym: e.target.value })} placeholder="e.g. Nuffield Health Barbican" />
        <Select label="Weight Unit" value={form.unit_pref} onChange={e => setForm({ ...form, unit_pref: e.target.value })}
          options={[{ value: 'kg', label: 'Kilograms (kg)' }, { value: 'lbs', label: 'Pounds (lbs)' }]} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Button onClick={save} style={{ flex: 1 }}>Save</Button>
          <Button variant="secondary" onClick={() => setEditing(false)} style={{ flex: 1 }}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ background: COLORS.card, borderRadius: 16, padding: 20, marginBottom: 16, border: `1px solid ${COLORS.border}`, textAlign: 'center' }}>
        <Avatar initials={getInitials(profile.display_name)} size={72} colorIndex={profile.id?.charCodeAt(0) || 0} />
        <div style={{ fontWeight: 800, fontSize: 20, color: COLORS.text, marginTop: 10 }}>{profile.display_name}</div>
        <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 2 }}>@{profile.username}</div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8 }}>
          {profile.sport && <Badge color={COLORS.orange}>{profile.sport}</Badge>}
          {profile.gym && <Badge>{profile.gym}</Badge>}
        </div>
        {profile.bio && <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 8 }}>{profile.bio}</div>}
        <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 8 }}>
          Weights in: <strong style={{ color: COLORS.text }}>{profile.unit_pref === 'lbs' ? 'Pounds (lbs)' : 'Kilograms (kg)'}</strong>
        </div>
      </div>

      <Button onClick={startEdit} variant="secondary" style={{ width: '100%', marginBottom: 8 }}>Edit Profile</Button>
      <Button onClick={logout} variant="ghost" style={{ width: '100%', color: COLORS.red }}>Log Out</Button>
    </div>
  );
}
