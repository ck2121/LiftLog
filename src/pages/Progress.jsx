import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getLogsByUser, getActivePlan } from '../db/database';
import { EXERCISES } from '../data/exercises';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const TIME_RANGES = [
  { label: '1 Month', days: 30 },
  { label: '3 Months', days: 90 },
  { label: '6 Months', days: 180 },
  { label: 'All Time', days: Infinity },
];

function downloadCSV(logs, machineName) {
  const rows = [['Date', 'Machine', 'Sets', 'Reps', 'Weight (lbs)']];
  logs.forEach((l) => rows.push([l.date, l.machineName, l.sets, l.reps, l.weightLbs]));
  const csv = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `liftlog-${machineName.replace(/\s+/g, '-').toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Progress() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMachine, setSelectedMachine] = useState('');
  const [timeRange, setTimeRange] = useState(TIME_RANGES[1]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getLogsByUser(user.userID),
      getActivePlan(user.userID),
    ]).then(([data, plan]) => {
      setLogs(data);
      setActivePlan(plan || null);
      if (data.length > 0 && !selectedMachine) {
        const counts = {};
        data.forEach((l) => { counts[l.machineID] = (counts[l.machineID] || 0) + 1; });
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        if (top) setSelectedMachine(top[0]);
      }
      setLoading(false);
    });
  }, [user]);

  // Unique machines the user has logged
  const loggedMachines = [
    ...new Map(logs.map((l) => [l.machineID, { id: l.machineID, name: l.machineName }])).values(),
  ];

  // Filter logs by selected machine and time range
  const cutoff = timeRange.days === Infinity ? new Date(0) : (() => { const d = new Date(); d.setDate(d.getDate() - timeRange.days); return d; })();
  const machineLogs = logs
    .filter((l) => l.machineID === selectedMachine && new Date(l.date) >= cutoff)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Max weight per date
  const byDate = {};
  machineLogs.forEach((l) => {
    if (!byDate[l.date] || l.weightLbs > byDate[l.date]) byDate[l.date] = l.weightLbs;
  });
  const chartLabels = Object.keys(byDate).sort();
  const chartValues = chartLabels.map((d) => byDate[d]);

  const chartData = {
    labels: chartLabels.map((d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Max Weight (lbs)',
        data: chartValues,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245,158,11,0.1)',
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#f59e0b',
        pointRadius: 5,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => `${c.raw} lbs` } },
    },
    scales: {
      x: { ticks: { color: '#94a3b8', maxRotation: 45, font: { size: 10 } }, grid: { display: false } },
      y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(51,65,85,0.5)' } },
    },
  };

  // PRs for all machines
  const prByMachine = {};
  logs.forEach((l) => {
    if (!prByMachine[l.machineID] || l.weightLbs > prByMachine[l.machineID].weight) {
      prByMachine[l.machineID] = { name: l.machineName, weight: l.weightLbs, date: l.date };
    }
  });
  const prs = Object.values(prByMachine).sort((a, b) => b.weight - a.weight);

  const selectedMachineName = loggedMachines.find((m) => m.id === selectedMachine)?.name || '';

  if (loading) return <div className="loading-screen"><div className="loading-spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>My Progress</h1>
        <p>Track your strength gains over time</p>
      </div>

      {logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📈</div>
          <p>No workout data yet. Complete a workout to see your progress!</p>
        </div>
      ) : (
        <>
          {/* Machine selector */}
          <p className="section-title">Select Machine</p>
          <div className="form-group">
            <select value={selectedMachine} onChange={(e) => setSelectedMachine(e.target.value)}>
              {loggedMachines.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Time range */}
          <div className="pill-group mb-3">
            {TIME_RANGES.map((tr) => (
              <button
                key={tr.label}
                className={`pill${timeRange.label === tr.label ? ' selected' : ''}`}
                onClick={() => setTimeRange(tr)}
                style={{ padding: '8px 12px', fontSize: '0.82rem' }}
              >
                {tr.label}
              </button>
            ))}
          </div>

          {/* Chart */}
          {chartLabels.length > 0 ? (
            <>
              <div className="chart-container" style={{ height: 220 }}>
                <Line data={chartData} options={chartOptions} />
              </div>
              <div className="flex justify-between items-center mt-2 mb-4">
                <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                  {chartLabels.length} sessions · Max: {Math.max(...chartValues)} lbs
                </p>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ width: 'auto' }}
                  onClick={() => downloadCSV(machineLogs, selectedMachineName)}
                >
                  ↓ CSV
                </button>
              </div>
            </>
          ) : (
            <div className="alert alert-info">No data for this machine in the selected time range.</div>
          )}

          {/* Personal Records */}
          <p className="section-title">Personal Records</p>
          {prs.length === 0 ? (
            <p className="text-muted text-sm">No records yet.</p>
          ) : (
            <div className="pr-grid">
              {prs.map((pr) => (
                <div key={pr.name} className="pr-card">
                  <div className="pr-machine">{pr.name}</div>
                  <div className="pr-weight">{pr.weight} lbs</div>
                  <div className="pr-date">{new Date(pr.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                </div>
              ))}
            </div>
          )}

          {/* Plan Progress */}
          {activePlan && (
            <>
              <p className="section-title">Plan Progress · {activePlan.splitName}</p>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                {activePlan.completedDates.length} of {activePlan.days.length} days completed
              </div>
              {activePlan.days.map((day) => (
                <div key={day.dayLabel} className="card" style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 8, color: 'var(--accent-light)' }}>
                    {day.dayLabel}
                  </div>
                  {day.exercises.map((ex) => {
                    // Find all logs for this machine, sorted by date ascending
                    const machineLogs = logs
                      .filter((l) => l.machineID === ex.exerciseID)
                      .sort((a, b) => new Date(a.date) - new Date(b.date));

                    const pr = machineLogs.length > 0
                      ? Math.max(...machineLogs.map((l) => l.weightLbs))
                      : null;

                    const sessionDates = [...new Set(machineLogs.map((l) => l.date))];
                    const trend = sessionDates.map((d) => ({
                      date: d,
                      max: Math.max(...machineLogs.filter((l) => l.date === d).map((l) => l.weightLbs)),
                    }));

                    const firstWeight = trend.length > 0 ? trend[0].max : null;
                    const lastWeight = trend.length > 0 ? trend[trend.length - 1].max : null;
                    const gained = firstWeight && lastWeight ? lastWeight - firstWeight : null;

                    return (
                      <div key={ex.exerciseID} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{ex.machineName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {sessionDates.length} session{sessionDates.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {pr !== null ? (
                            <>
                              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{pr} lbs PR</div>
                              {gained !== null && gained !== 0 && (
                                <div style={{ fontSize: '0.72rem', color: gained > 0 ? 'var(--success)' : 'var(--danger)' }}>
                                  {gained > 0 ? '+' : ''}{gained} lbs overall
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="badge badge-info">Not started</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
