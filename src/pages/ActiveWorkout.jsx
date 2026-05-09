import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { addLog } from '../db/database';

export default function ActiveWorkout() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [plan, setPlan] = useState([]);
  const [label, setLabel] = useState('Workout');
  const [exerciseStates, setExerciseStates] = useState([]);
  const [expandedIdx, setExpandedIdx] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Date.now());

  // Timer
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  function formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  // Load plan from sessionStorage
  useEffect(() => {
    const raw = sessionStorage.getItem('liftlog_active_plan');
    const lbl = sessionStorage.getItem('liftlog_active_label') || 'Workout';
    setLabel(lbl);
    if (!raw) { navigate('/plan'); return; }

    const p = JSON.parse(raw);
    setPlan(p);
    setExerciseStates(
      p.map((ex) => ({
        loggedSets: [],
        currentWeight: String(ex.plannedWeightLbs || 0),
        currentReps: String(ex.plannedReps || 10),
      }))
    );
  }, [navigate]);

  function updateField(idx, field, value) {
    setExerciseStates((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  async function logSet(idx) {
    const ex = plan[idx];
    const state = exerciseStates[idx];
    const weight = parseFloat(state.currentWeight) || 0;
    const reps = parseInt(state.currentReps) || 0;

    const logEntry = {
      userID: user.userID,
      date: new Date().toISOString().split('T')[0],
      machineID: ex.exerciseID,
      machineName: ex.machineName,
      sets: 1,
      reps,
      weightLbs: weight,
      notes: '',
    };

    await addLog(logEntry);

    setExerciseStates((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        loggedSets: [...next[idx].loggedSets, { weight, reps }],
      };
      return next;
    });
  }

  async function finishWorkout() {
    setSaving(true);
    // All sets are already logged individually; just clear session
    sessionStorage.removeItem('liftlog_active_plan');
    sessionStorage.removeItem('liftlog_active_label');
    setSaving(false);
    setDone(true);
  }

  if (done) {
    const totalSetsLogged = exerciseStates.reduce((sum, s) => sum + s.loggedSets.length, 0);
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: 16 }}>🎉</div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 8 }}>Workout Complete!</h1>
        <p className="text-muted" style={{ marginBottom: 24 }}>
          {totalSetsLogged} sets logged · {formatTime(elapsed)}
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Back to Dashboard</button>
        <button className="btn btn-secondary mt-2" onClick={() => navigate('/history')}>View History</button>
      </div>
    );
  }

  const totalLogged = exerciseStates.reduce((s, e) => s + e.loggedSets.length, 0);

  return (
    <div className="page">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700 }}>{label}</h1>
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>{totalLogged} sets logged</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(elapsed)}
          </div>
          <div className="text-muted" style={{ fontSize: '0.72rem' }}>elapsed</div>
        </div>
      </div>

      {plan.map((ex, idx) => {
        const state = exerciseStates[idx] || {};
        const isExpanded = expandedIdx === idx;
        const setsLogged = state.loggedSets?.length || 0;
        const targetSets = ex.plannedSets;
        const complete = setsLogged >= targetSets;

        return (
          <div key={ex.exerciseID} className="exercise-card" style={{ borderColor: complete ? 'var(--success)' : 'var(--border)' }}>
            <button className="collapsible-trigger" onClick={() => setExpandedIdx(isExpanded ? -1 : idx)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: complete ? 'var(--success)' : 'var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
                    color: complete ? '#fff' : 'var(--text-muted)',
                  }}
                >
                  {complete ? '✓' : `${setsLogged}/${targetSets}`}
                </div>
                <div>
                  <div className="exercise-name" style={{ fontSize: '0.9rem' }}>{ex.machineName}</div>
                  <div className="exercise-meta">{ex.primaryMuscle} · {ex.plannedSets}×{ex.plannedReps} @ {ex.plannedWeightLbs} lbs</div>
                </div>
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>{isExpanded ? '▲' : '▼'}</span>
            </button>

            {isExpanded && (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                {/* Logged sets */}
                {state.loggedSets?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    {state.loggedSets.map((s, i) => (
                      <div key={i} className="flex gap-2 items-center" style={{ padding: '4px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        <span className="badge badge-success">Set {i + 1}</span>
                        <span>{s.reps} reps @ {s.weight} lbs</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Input for next set */}
                {!complete && (
                  <>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Set {setsLogged + 1} of {targetSets}
                    </p>
                    <div className="set-row">
                      <div className="set-field">
                        <label>Weight (lbs)</label>
                        <input
                          type="number"
                          value={state.currentWeight}
                          onChange={(e) => updateField(idx, 'currentWeight', e.target.value)}
                          step="5"
                          min="0"
                        />
                      </div>
                      <div className="set-field">
                        <label>Reps</label>
                        <input
                          type="number"
                          value={state.currentReps}
                          onChange={(e) => updateField(idx, 'currentReps', e.target.value)}
                          min="1"
                        />
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ width: 'auto', minWidth: 80, alignSelf: 'flex-end' }}
                        onClick={() => logSet(idx)}
                      >
                        Log Set
                      </button>
                    </div>
                  </>
                )}

                {complete && (
                  <div className="alert alert-success" style={{ marginTop: 8 }}>
                    ✓ All sets complete!
                  </div>
                )}

                {/* Instructions */}
                <div className="exercise-detail">{ex.instructions}</div>
              </div>
            )}
          </div>
        );
      })}

      {/* Notes */}
      <div className="form-group mt-3">
        <label>Session Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="How did it go? Any observations…"
          rows={2}
          style={{ resize: 'vertical' }}
        />
      </div>

      <button className="btn btn-primary" onClick={finishWorkout} disabled={saving || totalLogged === 0}>
        {saving ? 'Saving…' : '🏁 Finish Workout'}
      </button>
      <button
        className="btn btn-secondary mt-2"
        onClick={() => {
          if (confirm('Abandon this workout? All logged sets will be saved.')) {
            sessionStorage.removeItem('liftlog_active_plan');
            sessionStorage.removeItem('liftlog_active_label');
            navigate('/');
          }
        }}
      >
        Abandon Workout
      </button>
    </div>
  );
}
