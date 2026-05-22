import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLogsByUser, getRecentLogsByUser, getActivePlan, setActivePlan, clearActivePlan } from '../db/database';
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

  const [mode, setMode] = useState('single');
  const [duration, setDuration] = useState(60);
  const [customDuration, setCustomDuration] = useState('');
  const [bodyArea, setBodyArea] = useState('Upper Body');
  const [splitName, setSplitName] = useState('Push/Pull/Legs');
  const [plan, setPlan] = useState(null);
  const [splitPlan, setSplitPlan] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [swappingIdx, setSwappingIdx] = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  const [activePlan, setActivePlanState] = useState(null);
  const [showNewPlan, setShowNewPlan] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getRecentLogsByUser(user.userID, 7),
      getLogsByUser(user.userID),
      getActivePlan(user.userID),
    ]).then(([recent, all, active]) => {
      setRecentLogs(recent);
      setAllLogs(all);
      setActivePlanState(active || null);
    });
  }, [user]);

  function effectiveDuration() {
    return customDuration ? parseInt(customDuration) || 60 : duration;
  }

  function handleGenerate() {
    const mins = effectiveDuration();
    if (mode === 'single') {
      const p = generateSingleDayPlan({ durationMinutes: mins, bodyArea, recentLogs, allLogs });
      setPlan(p);
      setSplitPlan(null);
    } else {
      const sp = generateSplitPlan({ splitName, durationMinutes: mins, recentLogs, allLogs });
      setSplitPlan(sp);
      setPlan(null);
    }
  }

  function handleSwap(idx) {
    const currentIds = plan.map((e) => e.exerciseID);
    setSwappingIdx(idx);
    setAlternatives(getAlternatives(plan[idx], currentIds));
  }

  function confirmSwap(alt) {
    const newPlan = [...plan];
    newPlan[swappingIdx] = {
      ...alt,
      plannedSets: alt.defaultSets,
      plannedReps: alt.defaultReps,
      plannedWeightLbs: alt.defaultWeightLbs,
    };
    setPlan(newPlan);
    setSwappingIdx(null);
    setAlternatives([]);
  }

  function startSingleWorkout() {
    sessionStorage.setItem('liftlog_active_plan', JSON.stringify(plan));
    sessionStorage.setItem('liftlog_active_label', 'Workout');
    sessionStorage.removeItem('liftlog_completing_day_index');
    navigate('/workout');
  }

  async function startSplitPlan() {
    // Save the full split as the active plan, starting at day 0
    const newActivePlan = {
      userID: user.userID,
      splitName,
      days: splitPlan,
      currentDayIndex: 0,
      completedDates: [],
      startedAt: new Date().toISOString(),
    };
    await setActivePlan(newActivePlan);
    setActivePlanState(newActivePlan);

    // Navigate to day 0
    const day0 = splitPlan[0];
    sessionStorage.setItem('liftlog_active_plan', JSON.stringify(day0.exercises));
    sessionStorage.setItem('liftlog_active_label', day0.dayLabel);
    sessionStorage.setItem('liftlog_completing_day_index', '0');
    navigate('/workout');
  }

  async function continuePlan() {
    if (!activePlan) return;
    const nextDay = activePlan.days[activePlan.currentDayIndex];
    sessionStorage.setItem('liftlog_active_plan', JSON.stringify(nextDay.exercises));
    sessionStorage.setItem('liftlog_active_label', nextDay.dayLabel);
    sessionStorage.setItem('liftlog_completing_day_index', String(activePlan.currentDayIndex));
    navigate('/workout');
  }

  async function handleClearActivePlan() {
    if (!confirm('Stop the current plan? Your workout history will be kept.')) return;
    await clearActivePlan(user.userID);
    setActivePlanState(null);
    setShowNewPlan(false);
  }

  const nextDay = activePlan ? activePlan.days[activePlan.currentDayIndex] : null;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Plan Workout</h1>
        <p>Choose your duration and target area</p>
      </div>

      {/* Active plan banner */}
      {activePlan && !showNewPlan && (
        <div
          style={{
            background: 'var(--card)',
            border: '1.5px solid var(--accent)',
            borderRadius: 'var(--radius)',
            padding: '18px',
            marginBottom: '20px',
          }}
        >
          <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: 6 }}>
            Active Plan · {activePlan.splitName}
          </div>
          <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 2 }}>{nextDay?.dayLabel}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            {activePlan.completedDates.length} of {activePlan.days.length} days completed
          </div>

          {/* Day progress dots */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {activePlan.days.map((d, i) => {
              const done = activePlan.completedDates.some((c) => c.dayIndex === i);
              const isCurrent = i === activePlan.currentDayIndex;
              return (
                <div
                  key={i}
                  title={d.dayLabel}
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    background: done
                      ? 'var(--accent)'
                      : isCurrent
                      ? 'var(--text-muted)'
                      : 'var(--border)',
                  }}
                />
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={continuePlan}>
              Continue ▶
            </button>
            <button
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setShowNewPlan(true)}
            >
              New Plan
            </button>
          </div>
        </div>
      )}

      {/* New plan form — shown when no active plan or user tapped "New Plan" */}
      {(!activePlan || showNewPlan) && (
        <>
          {showNewPlan && (
            <div className="alert alert-info mb-3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Starting a new plan will replace your current one.</span>
              <button onClick={() => setShowNewPlan(false)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 700, marginLeft: 8 }}>✕</button>
            </div>
          )}

          {/* Mode toggle */}
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

          {/* Body area / split */}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.keys(SPLIT_TEMPLATES).map((name) => (
                  <button
                    key={name}
                    className={`pill${splitName === name ? ' selected' : ''}`}
                    onClick={() => setSplitName(name)}
                    style={{ width: '100%', textAlign: 'left', borderRadius: 'var(--radius-sm)' }}
                  >
                    {name} <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>({SPLIT_TEMPLATES[name].length} days)</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <button className="btn btn-primary mt-4" onClick={handleGenerate}>
            Generate Plan ✨
          </button>

          {showNewPlan && activePlan && (
            <button className="btn btn-danger mt-2" onClick={handleClearActivePlan}>
              Stop Current Plan
            </button>
          )}
        </>
      )}

      {/* Swap modal */}
      {swappingIdx !== null && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => { setSwappingIdx(null); setAlternatives([]); }}
        >
          <div
            style={{ width: '100%', maxWidth: 430, background: 'var(--surface)', borderRadius: '16px 16px 0 0', padding: 20, paddingBottom: 'calc(20px + var(--safe-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 12 }}>Swap Exercise</h3>
            {alternatives.length === 0 ? (
              <p className="text-muted">No alternatives available for this muscle group.</p>
            ) : (
              alternatives.map((alt) => (
                <button key={alt.exerciseID} className="card w-full" style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)', display: 'block' }} onClick={() => confirmSwap(alt)}>
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
          <p className="section-title" style={{ marginTop: 0 }}>Your Plan · {plan.length} exercises</p>
          {plan.map((ex, idx) => {
            const isProgressive = ex.plannedWeightLbs !== ex.defaultWeightLbs;
            return (
              <div key={ex.exerciseID} className="exercise-card">
                <div className="exercise-card-header">
                  <div style={{ flex: 1 }}>
                    <div className="exercise-name">{ex.machineName}</div>
                    <div className="exercise-meta">
                      <span className="badge badge-accent">{ex.muscleGroup}</span>
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ width: 'auto', minWidth: 60 }} onClick={() => handleSwap(idx)}>
                    Swap
                  </button>
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="badge badge-muted">{ex.plannedSets} sets</span>
                  <span className="badge badge-muted">{ex.plannedReps} reps</span>
                  <span className="badge badge-muted">{ex.plannedWeightLbs} lbs</span>
                  {isProgressive && <span className="badge badge-success">↑ +10%</span>}
                </div>
              </div>
            );
          })}
          <button className="btn btn-primary mt-3" onClick={startSingleWorkout}>🏋️ Start Workout</button>
          <button className="btn btn-secondary mt-2" onClick={handleGenerate}>🔀 Regenerate</button>
        </div>
      )}

      {/* Split plan results */}
      {splitPlan && (
        <div className="mt-4">
          <p className="section-title">{splitName}</p>
          {splitPlan.map((dayPlan, dayIdx) => (
            <div key={dayPlan.dayLabel} className="card">
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{dayPlan.dayLabel}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                {dayPlan.exercises.length} exercises · {effectiveDuration()} min
              </div>
              {dayPlan.exercises.map((ex) => {
                const isProgressive = ex.plannedWeightLbs !== ex.defaultWeightLbs;
                return (
                  <div key={ex.exerciseID} style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '4px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{ex.machineName}</span>
                    <span style={{ color: 'var(--text)' }}>
                      {ex.plannedSets}×{ex.plannedReps} @ {ex.plannedWeightLbs} lbs
                      {isProgressive && <span style={{ color: 'var(--success)', marginLeft: 4 }}>↑</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
          <button className="btn btn-primary mt-3" onClick={startSplitPlan}>
            🏋️ Start Plan from Day 1
          </button>
          <button className="btn btn-secondary mt-2" onClick={handleGenerate}>🔀 Regenerate</button>
        </div>
      )}
    </div>
  );
}
