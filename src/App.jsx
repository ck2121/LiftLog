import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import WorkoutPlanner from './pages/WorkoutPlanner';
import ActiveWorkout from './pages/ActiveWorkout';
import Progress from './pages/Progress';
import History from './pages/History';
import Catalog from './pages/Catalog';
import Settings from './pages/Settings';
import NavBar from './components/NavBar';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (user === undefined) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <div className="app-container">
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plan"
          element={
            <ProtectedRoute>
              <WorkoutPlanner />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workout"
          element={
            <ProtectedRoute>
              <ActiveWorkout />
            </ProtectedRoute>
          }
        />
        <Route
          path="/progress"
          element={
            <ProtectedRoute>
              <Progress />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <History />
            </ProtectedRoute>
          }
        />
        <Route
          path="/catalog"
          element={
            <ProtectedRoute>
              <Catalog />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Bottom nav only shown when logged in */}
      {user && <NavBar />}
    </div>
  );
}
