import React, { useState, useEffect } from 'react';
import { COLORS, Icon, Spinner, convertWeight } from '../components/UI';

const STORAGE_KEY = 'steel_body_stats';
const MEASUREMENTS = ['Weight', 'Body Fat %', 'Chest', 'Waist', 'Arms', 'Shoulders', 'Thighs', 'Calves', 'Neck'];

function getStats() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function saveStats(stats) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

export default function BodyStats({ unit }) {
  const [stats, setStats] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({});
  const [selectedMetric, setSelectedMetric] = useState('Weight');

  useEffect(() => { setStats(getStats()); }, []);

  const handleSave = () => {
    const entry = { date: new Date().toISOString(), ...form };
    // Only save if at least one value entered
    const hasValue = Object.values(form).some(v => v && v !== '');
    if (!hasValue) return;
    const updated = [entry, ...stats];
    saveStats(updated);
    setStats(updated);
    setShowAdd(false);
    setForm({});
  };

  // Get history for selected metric
  const history = stats
    .filter(s => s[selectedMetric])
    .map(s => ({ date: s.date, value: parseFloat(s[selectedMetric]) }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const latest = stats[0] || {};
  const isWeightMetric = selectedMetric === 'Weight';
  const unitLabel = selectedMetric === 'Body Fat %' ? '%' : isWeightMetric ? unit : 'cm';

  // Simple chart
  const chartW = 320, chartH = 120, padL = 40, padR = 10, padT = 10, padB = 24;
  const drawW = chartW - padL - padR, drawH = chartH - padT - padB;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>Body Stats</div>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          background: COLORS.accent, border: 'none', borderRadius: 8, padding: '7px 14px',
          cursor: 'pointer', fontSize: 12, fontWeight: 700, color: COLORS.bg, fontFamily: 'inherit',
        }}>{showAdd ? 'Cancel' : '+ Log'}</button>
      </div>

      {/* Add entry form */}
      {showAdd && (
        <div style={{ background: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 10 }}>New Entry</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {MEASUREMENTS.map(m => (
              <div key={m}>
                <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 3, fontWeight: 600 }}>
                  {m} {m === 'Weight' ? `(${unit})` : m === 'Body Fat %' ? '' : '(cm)'}
                </div>
                <input type="number" inputMode="decimal" value={form[m] || ''}
                  onChange={e => setForm({ ...form, [m]: e.target.value })}
                  placeholder="-"
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${COLORS.border}`,
                    background: COLORS.bg, color: COLORS.text, fontSize: 14, fontFamily: 'inherit',
                    outline: 'none', textAlign: 'center', boxSizing: 'border-box',
                  }} />
              </div>
            ))}
          </div>
          <button onClick={handleSave} style={{
            width: '100%', padding: 12, borderRadius: 10, border: 'none', background: COLORS.accent,
            color: COLORS.bg, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', marginTop: 12,
          }}>Save Entry</button>
        </div>
      )}

      {/* Current stats summary */}
      {stats.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto' }}>
          {MEASUREMENTS.filter(m => latest[m]).map(m => (
            <div key={m} style={{
              background: COLORS.card, borderRadius: 10, padding: '10px 14px', border: `1px solid ${COLORS.border}`,
              minWidth: 80, textAlign: 'center', flexShrink: 0,
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>{latest[m]}</div>
              <div style={{ fontSize: 10, color: COLORS.textDim }}>{m}</div>
            </div>
          ))}
        </div>
      )}

      {/* Metric selector */}
      {stats.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
            {MEASUREMENTS.map(m => (
              <button key={m} onClick={() => setSelectedMetric(m)} style={{
                padding: '5px 10px', borderRadius: 16, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit',
                background: selectedMetric === m ? COLORS.accent : COLORS.card,
                color: selectedMetric === m ? COLORS.bg : COLORS.textDim,
              }}>{m}</button>
            ))}
          </div>

          {/* Chart */}
          {history.length >= 2 ? (
            <div style={{ background: COLORS.card, borderRadius: 12, padding: 14, border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textDim, marginBottom: 8 }}>
                {selectedMetric} ({unitLabel}) over time
              </div>
              <svg width={chartW} height={chartH} style={{ maxWidth: '100%' }}>
                {(() => {
                  const vals = history.map(h => h.value);
                  const minV = Math.min(...vals), maxV = Math.max(...vals);
                  const range = maxV - minV || 1;
                  const points = vals.map((v, i) => {
                    const x = padL + (i / (vals.length - 1)) * drawW;
                    const y = padT + drawH - ((v - minV) / range) * drawH;
                    return `${x},${y}`;
                  }).join(' ');
                  return (
                    <>
                      {[0, 0.5, 1].map(p => {
                        const y = padT + drawH - p * drawH;
                        const val = (minV + p * range).toFixed(1);
                        return (
                          <g key={p}>
                            <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke={COLORS.border} strokeWidth="0.5" />
                            <text x={padL - 4} y={y + 4} fill={COLORS.textDim} fontSize="10" textAnchor="end">{val}</text>
                          </g>
                        );
                      })}
                      <polyline points={points} fill="none" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      {vals.map((v, i) => {
                        const x = padL + (i / (vals.length - 1)) * drawW;
                        const y = padT + drawH - ((v - minV) / range) * drawH;
                        return <circle key={i} cx={x} cy={y} r="3" fill={COLORS.accent} />;
                      })}
                      {history.filter((_, i) => i === 0 || i === history.length - 1).map((d, i) => {
                        const idx = i === 0 ? 0 : history.length - 1;
                        const x = padL + (idx / (history.length - 1)) * drawW;
                        return <text key={i} x={x} y={chartH - 4} fill={COLORS.textDim} fontSize="9" textAnchor={i === 0 ? 'start' : 'end'}>{new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</text>;
                      })}
                    </>
                  );
                })()}
              </svg>
              {/* Change indicator */}
              {history.length >= 2 && (
                <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 6 }}>
                  Change: <span style={{ fontWeight: 700, color: history[history.length - 1].value >= history[0].value ? COLORS.accent : COLORS.red }}>
                    {history[history.length - 1].value >= history[0].value ? '+' : ''}{(history[history.length - 1].value - history[0].value).toFixed(1)} {unitLabel}
                  </span> over {history.length} entries
                </div>
              )}
            </div>
          ) : history.length === 1 ? (
            <div style={{ fontSize: 13, color: COLORS.textDim, textAlign: 'center', padding: 16 }}>
              Log one more entry to see your {selectedMetric.toLowerCase()} trend
            </div>
          ) : (
            <div style={{ fontSize: 13, color: COLORS.textDim, textAlign: 'center', padding: 16 }}>
              No {selectedMetric.toLowerCase()} data logged yet
            </div>
          )}
        </>
      )}

      {stats.length === 0 && !showAdd && (
        <div style={{ textAlign: 'center', padding: '24px 16px' }}>
          <Icon name="user" size={32} color={COLORS.textDim} />
          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginTop: 8 }}>Track your body stats</div>
          <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 4 }}>Log weight, body fat, and measurements to see your progress over time</div>
        </div>
      )}
    </div>
  );
}
