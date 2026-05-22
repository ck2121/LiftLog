import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLogsByUser, getActivePlan } from '../db/database';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

function getWeekLabel(date) {
  const d = new Date(date);
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getLogsByUser(user.userID),
      getActivePlan(user.userID),
    ]).then(([logData, plan]) => {
      setLogs(logData);
      setActivePlan(plan || null);
      setLoading(false);
    });
  }, [user]);

  // Weekly frequency for past 12 weeks
  const weeklyData = (() => {
    const weeks = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay() - i * 7);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      const count = new Set(
        logs
          .filter((l) => {
            const d = new Date(l.date);
            return d >= start && d < end;
          })
          .map((l) => new Date(l.date).toDateString())
      ).size;
      weeks.push({ label: getWeekLabel(start), count });
    }
    return weeks;
  })();

  const totalSessions = new Set(logs.map((l) => `${l.date}`)).size;
  const totalSets = logs.length;
  const recentLogs = logs.filter((l) => {
    const d = new Date(l.date);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return d >= cutoff;
  });
  const thisWeekSessions = new Set(recentLogs.map((l) => new Date(l.date).toDateString())).size;

  const chartData = {
    labels: weeklyData.map((w) => w.label),
    datasets: [
      {
        data: weeklyData.map((w) => w.count),
        backgroundColor: weeklyData.map((w) =>
          w.count > 0 ? 'rgba(168,255,62,0.85)' : 'rgba(42,48,53,0.8)'
        ),
        borderRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => `${c.raw} session${c.raw !== 1 ? 's' : ''}` } },
    },
    scales: {
      x: { ticks: { color: '#7B8B94', font: { size: 9 }, maxRotation: 45 }, grid: { display: false } },
      y: { ticks: { color: '#7B8B94', stepSize: 1 }, grid: { color: 'rgba(42,48,53,0.8)' }, beginAtZero: true },
    },
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Next day info for active plan
  const nextDay = activePlan ? activePlan.days[activePlan.currentDayIndex] : null;

  function continuePlan() {
    if (!nextDay) return;
    sessionStorage.setItem('liftlog_active_plan', JSON.stringify(nextDay.exercises));
    sessionStorage.setItem('liftlog_active_label', nextDay.dayLabel);
    sessionStorage.setItem('liftlog_completing_day_index', String(activePlan.currentDayIndex));
    navigate('/workout');
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="dashboard-greeting">{greeting}, {user?.username} 💪</h1>
        <p className="text-muted">Ready to crush it today?</p>
      </div>

      {/* Continue Plan card */}
      {activePlan && nextDay && (
        <div
          style={{
            background: 'var(--card)',
            border: '1.5px solid var(--accent)',
            borderRadius: 'var(--radius)',
            padding: '18px',
            marginBottom: '16px',
          }}
        >
          <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: 6 }}>
            Active Plan · {activePlan.splitName}
          </div>
          <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 2 }}>{nextDay.dayLabel}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            {nextDay.exercises.length} exercises · {activePlan.completedDates.length} days completed
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={continuePlan}>
              Continue ▶
            </button>
            <Link to="/plan" className="btn btn-secondary" style={{ flex: 1, textAlign: 'center' }}>
              Change Plan
            </Link>
          </div>
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{thisWeekSessions}</div>
          <div className="stat-label">This Week</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalSessions}</div>
          <div className="stat-label">Total Sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalSets}</div>
          <div className="stat-label">Total Sets</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{logs.length > 0 ? new Set(logs.map((l) => l.machineID)).size : 0}</div>
          <div className="stat-label">Machines Used</div>
        </div>
      </div>

      <p className="section-title">Quick Actions</p>
      <div className="quick-actions">
        <Link to="/plan" className="quick-action-card">
          <span className="quick-action-icon">🏋️</span>
          <span className="quick-action-label">New Workout</span>
        </Link>
        <Link to="/progress" className="quick-action-card">
          <span className="quick-action-icon">📈</span>
          <span className="quick-action-label">My Progress</span>
        </Link>
        <Link to="/history" className="quick-action-card">
          <span className="quick-action-icon">📅</span>
          <span className="quick-action-label">History</span>
        </Link>
        <Link to="/catalog" className="quick-action-card">
          <span className="quick-action-icon">📚</span>
          <span className="quick-action-label">Catalog</span>
        </Link>
      </div>

      <p className="section-title">Workout Frequency (12 Weeks)</p>
      {loading ? (
        <div className="card" style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="loading-spinner" />
        </div>
      ) : (
        <div className="chart-container" style={{ height: 160 }}>
          <Bar data={chartData} options={chartOptions} />
        </div>
      )}

      {logs.length === 0 && !loading && (
        <div className="alert alert-info mt-3">
          👋 No workouts yet — tap <strong>New Workout</strong> to get started.
        </div>
      )}
    </div>
  );
}
