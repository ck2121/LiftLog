import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { exportUserData, importUserData } from '../db/database';

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [msg, setMsg] = useState(null); // { type: 'success'|'error', text: string }
  const [importing, setImporting] = useState(false);

  async function handleExport() {
    try {
      const data = await exportUserData(user.userID);
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `liftlog-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg({ type: 'success', text: 'Backup downloaded successfully.' });
    } catch (e) {
      setMsg({ type: 'error', text: 'Export failed. Please try again.' });
      console.error(e);
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setMsg(null);

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      if (!json.workoutLogs || !Array.isArray(json.workoutLogs)) {
        setMsg({ type: 'error', text: 'Invalid backup file format.' });
        setImporting(false);
        return;
      }

      const confirmed = confirm(
        `This will import ${json.workoutLogs.length} workout log(s) and ${json.plans?.length || 0} plan(s) into your account. Continue?`
      );
      if (!confirmed) { setImporting(false); return; }

      await importUserData(json, user.userID);
      setMsg({ type: 'success', text: `Imported ${json.workoutLogs.length} logs successfully.` });
    } catch (e) {
      setMsg({ type: 'error', text: 'Import failed. Make sure the file is a valid LiftLog backup.' });
      console.error(e);
    } finally {
      setImporting(false);
      // Reset file input
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function handleLogout() {
    if (confirm('Sign out of LiftLog?')) {
      logout();
      navigate('/login');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Signed in as <strong>{user?.username}</strong></p>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`}>
          {msg.text}
        </div>
      )}

      {/* Data Portability */}
      <p className="section-title">Data Backup & Restore</p>
      <div className="card">
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: 14 }}>
          Your data is stored locally on this device. Export a backup to restore it on another device or browser.
        </p>

        <button className="btn btn-primary" onClick={handleExport}>
          ⬇️ Export Backup (JSON)
        </button>

        <div className="divider" />

        <button
          className="btn btn-secondary"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
        >
          {importing ? 'Importing…' : '⬆️ Import Backup (JSON)'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleImport}
        />

        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 10 }}>
          Import adds data to your current account without deleting existing records.
        </p>
      </div>

      {/* About */}
      <p className="section-title">About</p>
      <div className="card">
        <div className="log-row">
          <span className="text-muted">App</span>
          <span>LiftLog v1.0</span>
        </div>
        <div className="log-row">
          <span className="text-muted">Storage</span>
          <span>Local Device (IndexedDB)</span>
        </div>
        <div className="log-row">
          <span className="text-muted">Data shared</span>
          <span style={{ color: 'var(--success)' }}>Never — 100% local</span>
        </div>
        <div className="log-row">
          <span className="text-muted">Exercise library</span>
          <span>45 machines</span>
        </div>
      </div>

      {/* Navigate to Catalog */}
      <p className="section-title">Explore</p>
      <div className="card">
        <button
          className="btn btn-secondary"
          onClick={() => navigate('/catalog')}
        >
          📚 Equipment Catalog
        </button>
      </div>

      {/* Sign Out */}
      <p className="section-title">Account</p>
      <div className="card">
        <button className="btn btn-danger" onClick={handleLogout}>
          Sign Out
        </button>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 10 }}>
          Signing out only removes the session token. Your data stays on this device.
        </p>
      </div>
    </div>
  );
}
