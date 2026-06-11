import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { COLORS, Avatar, Badge, Icon, IconTile, Spinner, EmptyState, getInitials, formatVolume, timeAgo, convertWeight } from '../components/UI';
import Leaderboard from './Leaderboard';

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const DEFAULT_CENTER = [51.5074, -0.1278]; // London
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

// ─── Hooks ────────────────────────────────────────────────────────

function useLeaflet() {
  const [loaded, setLoaded] = useState(() => typeof window !== 'undefined' && !!window.L);
  useEffect(() => {
    if (loaded || typeof window === 'undefined') return;
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    if (window.L) { setLoaded(true); return; }
    let script = document.querySelector(`script[src="${LEAFLET_JS}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = LEAFLET_JS;
      script.async = true;
      document.head.appendChild(script);
    }
    const onReady = () => setLoaded(true);
    script.addEventListener('load', onReady);
    return () => script.removeEventListener('load', onReady);
  }, [loaded]);
  return loaded;
}

function useNominatim(query) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (query.trim().length < 3) { setResults([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=8&addressdetails=1&namedetails=1`;
        const res = await fetch(url, { signal: ctrl.signal });
        const data = await res.json();
        setResults(data.map(d => ({
          place_id: String(d.place_id),
          name: d.namedetails?.name || d.display_name.split(',')[0],
          fullName: d.display_name,
          lat: parseFloat(d.lat),
          lng: parseFloat(d.lon),
        })));
      } catch (e) { if (e.name !== 'AbortError') console.error('Nominatim error:', e); }
      finally { setLoading(false); }
    }, 600);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);
  return { results, loading };
}

// ─── Map ──────────────────────────────────────────────────────────

function GymMap({ pins, userLoc, onPinClick }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const leafletReady = useLeaflet();

  // Init map once
  useEffect(() => {
    if (!leafletReady || !containerRef.current || mapRef.current) return;
    const L = window.L;
    const center = userLoc || (pins[0] ? [pins[0].lat, pins[0].lng] : DEFAULT_CENTER);
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false }).setView(center, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19,
    }).addTo(map);
    L.control.attribution({ prefix: false }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [leafletReady]);

  // Refresh markers
  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    const L = window.L;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    pins.forEach(p => {
      const marker = L.marker([p.lat, p.lng], {
        title: p.name,
      }).addTo(mapRef.current);
      const popupHtml = `<div style="font-family:'Inter Tight',sans-serif;min-width:160px"><div style="font-weight:700;font-size:14px;margin-bottom:4px;">${p.name}</div><div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#6B7280;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;">${p.members} member${p.members !== 1 ? 's' : ''}</div><button data-pin-join="${p.place_id || p.name}" style="background:#BFE600;color:#0A0A0A;border:none;border-radius:999px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">Join</button></div>`;
      marker.bindPopup(popupHtml);
      marker.on('popupopen', () => {
        const btn = document.querySelector(`button[data-pin-join="${p.place_id || p.name}"]`);
        if (btn) btn.onclick = () => onPinClick?.(p);
      });
      markersRef.current.push(marker);
    });
    if (pins.length > 1) {
      const bounds = L.latLngBounds(pins.map(p => [p.lat, p.lng]));
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    } else if (pins.length === 1 && !userLoc) {
      mapRef.current.setView([pins[0].lat, pins[0].lng], 14);
    }
  }, [pins, leafletReady, onPinClick]);

  return (
    <div style={{
      position: 'relative', height: 260, borderRadius: 12, overflow: 'hidden',
      border: `1px solid ${COLORS.border}`, marginBottom: 16, background: COLORS.card2,
    }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {!leafletReady && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: COLORS.textDim,
          letterSpacing: '0.14em', textTransform: 'uppercase',
        }}>Loading map…</div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────

export default function GymCommunity({ onViewProfile, onWorkout }) {
  const { user, profile, updateProfile } = useStore();
  const [pinnedGyms, setPinnedGyms] = useState([]);
  const [legacyGyms, setLegacyGyms] = useState([]); // text-only gyms from older profiles
  const [myGymData, setMyGymData] = useState(null);
  const [gymFeed, setGymFeed] = useState([]);
  const [gymMembers, setGymMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [subTab, setSubTab] = useState('feed');
  const [userLoc, setUserLoc] = useState(null);
  const unit = profile?.unit_pref || 'kg';

  const { results: searchResults, loading: searching } = useNominatim(searchQuery);

  useEffect(() => { loadData(); }, [profile?.gym]);

  // Ask for geolocation once on mount when user has no gym yet
  useEffect(() => {
    if (profile?.gym || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      p => setUserLoc([p.coords.latitude, p.coords.longitude]),
      () => {},
      { timeout: 5000, maximumAge: 60_000 }
    );
  }, [profile?.gym]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Pinned gyms (have coords) — dedupe by place_id or name
      const { data: pinned } = await supabase.from('profiles')
        .select('gym, gym_lat, gym_lng, gym_place_id')
        .not('gym_lat', 'is', null).eq('privacy_mode', 'normal');
      if (pinned) {
        const byKey = {};
        pinned.forEach(p => {
          const key = p.gym_place_id || p.gym;
          if (!byKey[key]) byKey[key] = { name: p.gym, lat: Number(p.gym_lat), lng: Number(p.gym_lng), place_id: p.gym_place_id, members: 0 };
          byKey[key].members += 1;
        });
        setPinnedGyms(Object.values(byKey));
      }

      // Legacy gyms (text only, no coords) — for fallback list
      const { data: legacy } = await supabase.from('profiles')
        .select('gym').neq('gym', '').not('gym', 'is', null).is('gym_lat', null);
      if (legacy) {
        const counts = {};
        legacy.forEach(p => { if (p.gym) counts[p.gym] = (counts[p.gym] || 0) + 1; });
        setLegacyGyms(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })));
      }

      if (profile?.gym) {
        const { data: members } = await supabase.from('profiles')
          .select('id, display_name, username, sport, avatar_url')
          .eq('gym', profile.gym).eq('privacy_mode', 'normal').neq('id', user?.id || '');
        if (members) setGymMembers(members);

        const { data: memberProfiles } = await supabase.from('profiles')
          .select('id').eq('gym', profile.gym).eq('privacy_mode', 'normal');
        if (memberProfiles && memberProfiles.length > 0) {
          const memberIds = memberProfiles.map(m => m.id);
          const { data: workouts } = await supabase.from('workouts')
            .select('*, profiles:user_id (id, display_name, username, sport, avatar_url), workout_exercises (id, sort_order, exercises:exercise_id (id, name), sets (id, weight, reps, is_pr))')
            .in('user_id', memberIds).eq('is_public', true)
            .order('created_at', { ascending: false }).limit(15);
          if (workouts) setGymFeed(workouts);
        }
        setMyGymData({ name: profile.gym, members: (members?.length || 0) + 1 });
      }
    } catch (e) {
      console.error('GymCommunity loadData error:', e);
    } finally {
      setLoading(false);
    }
  };

  const joinPlace = async (place) => {
    await updateProfile({
      gym: place.name,
      gym_lat: place.lat,
      gym_lng: place.lng,
      gym_place_id: place.place_id || null,
    });
    setSearchQuery('');
  };

  const joinLegacy = async (name) => {
    await updateProfile({ gym: name });
    setSearchQuery('');
  };

  const handleLeaveGym = async () => {
    await updateProfile({ gym: '', gym_lat: null, gym_lng: null, gym_place_id: null });
    setMyGymData(null);
    setGymFeed([]);
    setGymMembers([]);
  };

  if (loading) return <Spinner />;

  // ── NO GYM — Show finder ──
  if (!profile?.gym) {
    return (
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text, marginBottom: 4 }}>Find your gym</div>
        <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 14, lineHeight: 1.5 }}>
          Pick from the map or search by name. We use OpenStreetMap so canonical gyms don't get duplicated.
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <div style={{ position: 'absolute', left: 12, top: 14 }}>
            <Icon name="search" size={18} color={COLORS.textDim} />
          </div>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search e.g. Gymbox Bank, Equinox…"
            style={{
              width: '100%', padding: '14px 14px 14px 38px', borderRadius: 12,
              border: `1px solid ${COLORS.border}`, background: COLORS.card,
              color: COLORS.text, fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
            }} />
          {searching && (
            <div style={{ position: 'absolute', right: 14, top: 17, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: COLORS.textDim, letterSpacing: '0.1em' }}>…</div>
          )}
        </div>

        {/* Nominatim results */}
        {searchResults.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            {searchResults.map(r => (
              <div key={r.place_id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                background: COLORS.card, borderRadius: 12, padding: '11px 14px', marginBottom: 6,
                border: `1px solid ${COLORS.border}`,
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.fullName.split(',').slice(1, 4).join(',').trim()}
                  </div>
                </div>
                <button onClick={() => joinPlace(r)} style={{
                  padding: '8px 16px', borderRadius: 999, border: 'none', background: COLORS.accent,
                  color: COLORS.isDark ? COLORS.bg : '#0A0A0A', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}>Join</button>
              </div>
            ))}
          </div>
        )}

        {/* Map of pinned gyms */}
        {!searchQuery && (
          <>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 500,
              color: COLORS.textDim, letterSpacing: '0.12em', textTransform: 'uppercase',
              marginBottom: 8,
            }}>Gyms near you</div>
            <GymMap pins={pinnedGyms} userLoc={userLoc} onPinClick={joinPlace} />
          </>
        )}

        {/* Legacy text-only gyms (older signups) */}
        {!searchQuery && legacyGyms.length > 0 && (
          <>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 500,
              color: COLORS.textDim, letterSpacing: '0.12em', textTransform: 'uppercase',
              marginTop: 16, marginBottom: 8,
            }}>Other Steel gyms</div>
            {legacyGyms.slice(0, 8).map(g => (
              <div key={g.name} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: COLORS.card, borderRadius: 12, padding: '11px 14px', marginBottom: 6,
                border: `1px solid ${COLORS.border}`,
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text }}>{g.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.textDim, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Icon name="users" size={11} color={COLORS.textDim} /> {g.count} member{g.count !== 1 ? 's' : ''}
                  </div>
                </div>
                <button onClick={() => joinLegacy(g.name)} style={{
                  padding: '8px 16px', borderRadius: 999, border: 'none', background: COLORS.accent,
                  color: COLORS.isDark ? COLORS.bg : '#0A0A0A', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                }}>Join</button>
              </div>
            ))}
          </>
        )}

        {!searchQuery && pinnedGyms.length === 0 && legacyGyms.length === 0 && (
          <div style={{ textAlign: 'center', padding: '28px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <IconTile name="pin" tone="lime" size={52} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text, marginTop: 12, letterSpacing: '-0.01em' }}>Be the first!</div>
            <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 4 }}>Search your gym above to drop the first pin.</div>
          </div>
        )}
      </div>
    );
  }

  // ── HAS GYM ──
  return (
    <div>
      <div style={{
        background: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 14,
        border: `1px solid ${COLORS.border}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Icon name="pin" size={18} color={COLORS.accent} />
              <span style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>{profile.gym}</span>
            </div>
            <div style={{ fontSize: 13, color: COLORS.textDim, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon name="users" size={14} color={COLORS.textDim} /> {myGymData?.members || 1} member{(myGymData?.members || 1) !== 1 ? 's' : ''}
            </div>
          </div>
          <button onClick={handleLeaveGym} style={{
            background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8,
            padding: '6px 10px', cursor: 'pointer', fontSize: 11, color: COLORS.textDim, fontFamily: 'inherit',
          }}>Leave</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 14 }}>
        {['feed', 'members', 'leaderboard'].map(t => (
          <button key={t} onClick={() => setSubTab(t)} style={{
            flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            fontFamily: 'inherit', background: 'transparent',
            color: subTab === t ? COLORS.text : COLORS.textDim,
            borderBottom: subTab === t ? `2px solid ${COLORS.accent}` : '2px solid transparent',
            marginBottom: -1, textTransform: 'capitalize',
          }}>{t === 'feed' ? `Feed (${gymFeed.length})` : t === 'members' ? `Members (${gymMembers.length})` : 'Leaderboard'}</button>
        ))}
      </div>

      {subTab === 'feed' && (
        gymFeed.length === 0 ? (
          <EmptyState icon="weight" title="No gym activity yet" subtitle="Be the first to log a workout at your gym!" />
        ) : (
          gymFeed.map(w => {
            const exercises = (w.workout_exercises || []).sort((a, b) => a.sort_order - b.sort_order);
            const p = w.profiles;
            return (
              <div key={w.id} onClick={() => onWorkout?.(w.id)} style={{ background: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, border: `1px solid ${COLORS.border}`, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Avatar initials={getInitials(p?.display_name || '??')} size={36} colorIndex={p?.id?.charCodeAt(0) || 0} src={p?.avatar_url || null} onClick={(e) => { e?.stopPropagation?.(); onViewProfile?.(p?.id); }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.text, cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onViewProfile?.(p?.id); }}>{p?.display_name}</div>
                    <div style={{ fontSize: 12, color: COLORS.textDim }}>{timeAgo(w.created_at)}</div>
                  </div>
                  {w.has_pr && <Badge color={COLORS.pro}>PR</Badge>}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.text, marginBottom: 6 }}>{w.title}</div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
                  {w.duration_mins > 0 && <span style={{ fontSize: 12, color: COLORS.textDim }}><Icon name="clock" size={12} color={COLORS.textDim} /> {w.duration_mins}m</span>}
                  <span style={{ fontSize: 12, color: COLORS.textDim }}>{formatVolume(convertWeight(w.total_volume, unit))} {unit}</span>
                  <span style={{ fontSize: 12, color: COLORS.textDim }}>{w.total_sets} sets</span>
                </div>
                <div style={{ fontSize: 12, color: COLORS.textDim }}>{exercises.map(we => we.exercises?.name).filter(Boolean).join(', ')}</div>
              </div>
            );
          })
        )
      )}

      {subTab === 'leaderboard' && (
        <Leaderboard gym={profile.gym} onViewProfile={onViewProfile} />
      )}

      {subTab === 'members' && (
        gymMembers.length === 0 ? (
          <EmptyState icon="users" title="Just you so far" subtitle="Invite your gym mates to join!" />
        ) : (
          gymMembers.map(m => (
            <div key={m.id} onClick={() => onViewProfile?.(m.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
              borderBottom: `1px solid ${COLORS.border}`, cursor: 'pointer',
            }}>
              <Avatar initials={getInitials(m.display_name)} size={40} colorIndex={m.id?.charCodeAt(0) || 0} src={m.avatar_url || null} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text }}>{m.display_name}</div>
                <div style={{ fontSize: 12, color: COLORS.textDim }}>@{m.username}{m.sport ? ` · ${m.sport}` : ''}</div>
              </div>
            </div>
          ))
        )
      )}
    </div>
  );
}
