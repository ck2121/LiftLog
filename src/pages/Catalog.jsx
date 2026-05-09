import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getLogsByUser } from '../db/database';
import { EXERCISES, BODY_PARTS } from '../data/exercises';

export default function Catalog() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [triedIds, setTriedIds] = useState(new Set());
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!user) return;
    getLogsByUser(user.userID).then((logs) => {
      setTriedIds(new Set(logs.map((l) => l.machineID)));
    });
  }, [user]);

  const filtered = EXERCISES.filter((ex) => {
    const matchSearch =
      search.trim() === '' ||
      ex.machineName.toLowerCase().includes(search.toLowerCase()) ||
      ex.primaryMuscle.toLowerCase().includes(search.toLowerCase()) ||
      ex.muscleGroup.toLowerCase().includes(search.toLowerCase());

    const matchFilter = filter === 'All' || ex.bodyPart === filter || (filter === 'Not Yet Tried' && !triedIds.has(ex.exerciseID));
    return matchSearch && matchFilter;
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1>Equipment Catalog</h1>
        <p>{EXERCISES.length} machines · {triedIds.size} tried</p>
      </div>

      <div className="search-bar">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Search machines or muscles…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="pill-group mb-3" style={{ flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 4 }}>
        {['All', ...BODY_PARTS, 'Not Yet Tried'].map((f) => (
          <button
            key={f}
            className={`pill${filter === f ? ' selected' : ''}`}
            onClick={() => setFilter(f)}
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <p>No machines match your search.</p>
        </div>
      )}

      {filtered.map((ex) => {
        const tried = triedIds.has(ex.exerciseID);
        const isExpanded = expanded === ex.exerciseID;

        return (
          <div key={ex.exerciseID} className="exercise-card">
            <button className="collapsible-trigger" onClick={() => setExpanded(isExpanded ? null : ex.exerciseID)}>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div className="exercise-name" style={{ fontSize: '0.95rem' }}>{ex.machineName}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                  <span className="badge badge-accent">{ex.bodyPart}</span>
                  <span className="badge badge-muted">{ex.primaryMuscle}</span>
                  {tried ? (
                    <span className="badge badge-success">✓ Tried</span>
                  ) : (
                    <span className="badge badge-info">Not Yet Tried</span>
                  )}
                </div>
              </div>
              <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{isExpanded ? '▲' : '▼'}</span>
            </button>

            {isExpanded && (
              <div className="exercise-detail">
                <div style={{ marginBottom: 8 }}>
                  <strong>Primary:</strong> {ex.primaryMuscle}<br />
                  <strong>Secondary:</strong> {ex.secondaryMuscles}<br />
                  <strong>Default:</strong> {ex.defaultSets} sets × {ex.defaultReps} reps @ {ex.defaultWeightLbs} lbs
                </div>
                <div>
                  <strong>How to use:</strong><br />
                  {ex.instructions}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
