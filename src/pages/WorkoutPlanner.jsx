import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRecentLogsByUser } from '../db/database';
import {
  generateSingleDayPlan,
  generateSplitPlan,
  getAlternatives,
  SPLIT_TEMPLATES,
} from '../services/workoutPlanner';

const DURATIONS = [30, 45, 60, 75, 90];
const BODY_AREAS = ['Upper Body', 'Lower Body', 'Full Body', 'Core'];

export default function WorkoutPlanner() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('single'); // 'single' | 'split'
  const [duration, setDuration] = useState(60);
  const [customDuration, setCustomDuration] = useState('');
  const [bodyArea, setBodyArea] = useState('Upper Body');
  const [splitName, setSplitName] = useState('Push/Pull/Legs');
  const [plan, setPlan] = useState(null);
  const [splitPlan, setSplitPlan] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [swappingIdx, setSwappingIdx] = useState(null);
  const [alternatives, setAlternatives] = useState([]);

  useEffect(() => {
    if (user) getRecentLogsByUser(user.userID, 7).then(setRecentLogs);
  }, [user]);

  function effectiveDuration() {
    return customDuration ? parseInt(customDuration) || 60 : duration;
  }

  function handleGenerate() {
    const mins = effectiveDuration();
    if (mode === 'single') {
      const p = generateSingleDayPlan({ durationMinutes: mins, bodyArea, recentLogs });
      setPlan(p);
      setSplitPlan(null);
    } else {
      const sp = generateSplitPlan({ splitName, durationMinutes: mins, recentLogs });
      setSplitPlan(sp);
      setPlan(null);
    }
  }

  function handleSwap(idx) {
    const currentIds = plan.map((e) => e.exerciseID);
    const alts = getAlternatives(plan[idx], currentIds);
    setSwappingIdx(idx);
    setAlternatives(alts);
  }

  function confirmSwap(alt) {
    const newPlan = [...plan];
    newPlan[swappingIdx] = { ...alt, plannedSets: alt.defaultSets, plannedReps: alt.defaultReps, plannedWeightLbs: alt.defaultWeightLbs };
    setPlan(newPlan);
    setSwappingIdx(null);
    setAlternatives([]);
  }

  function startWorkout() {
    sessionStorage.setItem('liftlog_active_plan', JSON.stringify(plan));
    navigate('/workout');
  }

  function startSplitDay(dayPlan) {
    sessionStorage.setItem('liftlog_active_plan', JSON.stringify(dayPlan.exercises));
    sessionStorage.setItem('liftlog_active_label', dayPlan.dayLabel);
    navigate('/workout');
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Plan Workout</h1>
        <p>Choose your duration and target area</p>
      </div>

      {/* Mode Toggle */}
      <div className="login-tabs" style={{ marginBottom: 20 }}>
        <button className={`login-tab${mode === 'single' ? ' active' : ''}`} onClick={() => { setMode('single'); setPlan(null); setSplitPlan(null); }}>
          Single Day
        </button>
        <button className={`login-tab${mode === 'split' ? ' active' : ''}`} onClick={() => { setMode('split'); setPlan(null); setSplitPlan(null); }}>
          Split Program
        </button>
      </div>

      {/* Duration */}
      <p className="section-title">Duration</p>
      <div className="pill-group">
        {DURATIONS.map((d) => (
          <button
            key={d}
            className={`pill${duration === d && !customDuration ? ' selected' : ''}`}
            onClick={() => { setDuration(d); setCustomDuration(''); }}
          >
            {d} min
          </button>
        ))}
      </div>
      <div className="form-group mt-2">
        <label>Custom duration (min)</label>
        <input
          type="number"
          placeholder="e.g. 50"
          value={customDuration}
          onChange={(e) => { setCustomDuration(e.target.value); setDuration(0); }}
          min="15"
          max="180"
        />
      </div>

      {/* Body Area / Split */}
      {mode === 'single' ? (
        <>
          <p className="section-title">Target Body Area</p>
          <div className="pill-group">
            {BODY_AREAS.map((area) => (
              <button
                key={area}
                className={`pill${bodyArea === area ? ' selected' : ''}`}
                onClick={() => setBodyArea(area)}
              >
                {area}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="section-title">Split Program</p>
          <div className="pill-group" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            {Object.keys(SPLIT_TEMPLATES).map((name) => (
              <button
                key={name}
                className={`pill${splitName === name ? ' selected' : ''}`}
                onClick={() => setSplitName(name)}
                style={{ width: '100%', textAlign: 'left', borderRadius: 'var(--radius-sm)' }}
              >
                {name} ({SPLIT_TEMPLATES[name].length} days)
              </button>
            ))}
          </div>
        </>
      )}

      <button className="btn btn-primary mt-4" onClick={handleGenerate}>
        Generate Plan ✨
      </button>

      {/* Swap modal */}
      {swappingIdx !== null && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => { setSwappingIdx(null); setAlternatives([]); }}
        >
          <div
            style={{ width: '100%', maxWidth: 480, background: 'var(--surface)', borderRadius: '16px 16px 0 0', padding: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 12 }}>Swap Exercise</h3>
            {alternatives.length === 0 ? (
              <p className="text-muted">No alternatives available for this muscle group.</p>
            ) : (
              alternatives.map((alt) => (
                <button key={alt.exerciseID} className="card w-full" style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }} onClick={() => confirmSwap(alt)}>
                  <div className="exercise-name">{alt.machineName}</div>
                  <div className="exercise-meta">{alt.primaryMuscle} · {alt.defaultSets}×{alt.defaultReps} · {alt.defaultWeightLbs} lbs</div>
                </button>
              ))
            )}
            <button className="btn btn-secondary mt-2" onClick={() => { setSwappingIdx(null); setAlternatives([]); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Single day plan results */}
      {plan && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <p className="section-title" style={{ marginTop: 0 }}>Your Plan · {plan.length} exercises</p>
          </div>
          {plan.map((ex, idx) => (
            <div key={ex.exerciseID} className="exercise-card">
              <div className="exercise-card-header">
                <div>
                  <div className="exercise-name">{ex.machineName}</div>
                  <div className="exercise-meta">
                    <span className="badge badge-accent">{ex.muscleGroup}</span>{' '}
                    {ex.primaryMuscle}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ width: 'auto', minWidth: 60 }} onClick={() => handleSwap(idx)}>
                  Swap
                </button>
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <span className="badge badge-muted">{ex.plannedSets} sets</span>
                <span className="badge badge-muted">{ex.plannedReps} reps</span>
                <span className="badge badge-muted">{ex.plannedWeightLbs} lbs</span>
              </div>
            </div>
          ))}
          <button className="btn btn-primary mt-3" onClick={startWorkout}>
            🏋️ Start Workout
          </button>
          <button className="btn btn-secondary mt-2" onClick={handleGenerate}>
            🔀 Regenerate
          </button>
        </div>
      )}

      {/* Split plan results */}
      {splitPlan && (
        <div className="mt-4">
          <p className="section-title">{splitName}</p>
          {splitPlan.map((dayPlan) => (
            <div key={dayPlan.dayLabel} className="card">
              <div className="flex justify-between items-center">
                <div>
                  <div className="card-title">{dayPlan.dayLabel}</div>
                  <div className="card-subtitle">{dayPlan.exercises.length} exercises · {effectiveDuration()} min</div>
                </div>
                <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={() => startSplitDay(dayPlan)}>
                  Start
                </button>
              </div>
              <div style={{ marginTop: 8 }}>
                {dayPlan.exercises.map((ex) => (
                  <div key={ex.exerciseID} style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                    {ex.machineName} · <span style={{ color: 'var(--text)' }}>{ex.plannedSets}×{ex.plannedReps} @ {ex.plannedWeightLbs} lbs</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
