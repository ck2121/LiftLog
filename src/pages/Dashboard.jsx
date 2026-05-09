import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLogsByUser } from '../db/database';
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
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getLogsByUser(user.userID).then((data) => {
      setLogs(data);
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

  const totalSessions = new Set(logs.map((l) => `${l.date}-${l.userID}`)).size;
  const totalSets = logs.length;
  const recentDays = 7;
  const recentLogs = logs.filter((l) => {
    const d = new Date(l.date);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - recentDays);
    return d >= cutoff;
  });
  const thisWeekSessions = new Set(recentLogs.map((l) => new Date(l.date).toDateString())).size;

  const chartData = {
    labels: weeklyData.map((w) => w.label),
    datasets: [
      {
        data: weeklyData.map((w) => w.count),
        backgroundColor: weeklyData.map((w) =>
          w.count > 0 ? 'rgba(245,158,11,0.8)' : 'rgba(51,65,85,0.6)'
        ),
        borderRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.raw} session${c.raw !== 1 ? 's' : ''}` } } },
    scales: {
      x: { ticks: { color: '#94a3b8', font: { size: 9 }, maxRotation: 45 }, grid: { display: false } },
      y: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(51,65,85,0.5)' }, beginAtZero: true },
    },
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="dashboard-greeting">{greeting}, {user?.username} 💪</h1>
        <p className="text-muted">Ready to crush it today?</p>
      </div>

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
          👋 No workouts yet! Tap <strong>New Workout</strong> to get started.
        </div>
      )}
    </div>
  );
}
