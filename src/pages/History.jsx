import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getLogsByUser, deleteLog } from '../db/database';

function groupByDate(logs) {
  const map = {};
  logs.forEach((l) => {
    if (!map[l.date]) map[l.date] = [];
    map[l.date].push(l);
  });
  // Sort dates descending
  return Object.entries(map).sort((a, b) => new Date(b[0]) - new Date(a[0]));
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function History() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDate, setExpandedDate] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const fetchLogs = () => {
    if (!user) return;
    getLogsByUser(user.userID).then((data) => {
      setLogs(data);
      setLoading(false);
    });
  };

  useEffect(fetchLogs, [user]);

  const grouped = groupByDate(logs);

  async function handleDelete(logID, isRecent, logDate) {
    // Only allow delete within 24 hours
    const logTime = new Date(logDate + 'T23:59:59');
    const now = new Date();
    const hoursDiff = (now - logTime) / (1000 * 60 * 60);
    if (hoursDiff > 24) {
      alert('Sets can only be deleted within 24 hours of logging.');
      return;
    }
    if (!confirm('Delete this logged set?')) return;
    setDeleting(logID);
    await deleteLog(logID);
    setDeleting(null);
    fetchLogs();
  }

  if (loading) return <div className="loading-screen"><div className="loading-spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Workout History</h1>
        <p>{logs.length} total sets logged</p>
      </div>

      {grouped.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <p>No workouts yet. Complete your first session!</p>
        </div>
      ) : (
        grouped.map(([date, dayLogs]) => {
          const isExpanded = expandedDate === date;
          const machines = [...new Set(dayLogs.map((l) => l.machineName))];
          const totalSets = dayLogs.length;
          const maxWeight = Math.max(...dayLogs.map((l) => l.weightLbs));

          return (
            <div key={date} className="card" style={{ marginBottom: 10 }}>
              <button className="collapsible-trigger" onClick={() => setExpandedDate(isExpanded ? null : date)}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{formatDate(date)}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {totalSets} sets · {machines.length} machine{machines.length !== 1 ? 's' : ''} · Top: {maxWeight} lbs
                  </div>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>{isExpanded ? '▲' : '▼'}</span>
              </button>

              {isExpanded && (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  {/* Group by machine within the day */}
                  {machines.map((machineName) => {
                    const machineSets = dayLogs.filter((l) => l.machineName === machineName);
                    return (
                      <div key={machineName} style={{ marginBottom: 12 }}>
                        <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                          {machineName}
                        </p>
                        {machineSets.map((l, i) => {
                          const logTime = new Date(date + 'T23:59:59');
                          const canDelete = (new Date() - logTime) / (1000 * 60 * 60) <= 24;
                          return (
                            <div key={l.logID} className="log-row">
                              <span className="badge badge-muted" style={{ marginRight: 8 }}>Set {i + 1}</span>
                              <span style={{ flex: 1, fontSize: '0.88rem' }}>{l.reps} reps @ {l.weightLbs} lbs</span>
                              {canDelete && (
                                <button
                                  onClick={() => handleDelete(l.logID, true, date)}
                                  disabled={deleting === l.logID}
                                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1rem', padding: '4px 8px', minHeight: 44, minWidth: 44 }}
                                  aria-label="Delete set"
                                >
                                  {deleting === l.logID ? '…' : '🗑'}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
