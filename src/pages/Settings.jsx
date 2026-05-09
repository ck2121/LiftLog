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

  function validateBackup(json) {
    if (!json || typeof json !== 'object') return 'Not a valid JSON object.';
    if (!Array.isArray(json.workoutLogs))  return 'Missing or invalid workoutLogs field.';
    if (json.workoutLogs.length > 100_000) return 'Backup contains too many log entries (max 100,000).';

    for (const log of json.workoutLogs) {
      if (typeof log.machineID   !== 'string')             return 'Log entry has invalid machineID.';
      if (typeof log.machineName !== 'string')             return 'Log entry has invalid machineName.';
      if (typeof log.date        !== 'string')             return 'Log entry has invalid date.';
      if (typeof log.weightLbs   !== 'number' || log.weightLbs   < 0 || log.weightLbs   > 2000) return 'Log entry has out-of-range weight.';
      if (typeof log.reps        !== 'number' || log.reps        < 0 || log.reps        > 1000) return 'Log entry has out-of-range reps.';
      if (typeof log.sets        !== 'number' || log.sets        < 0 || log.sets        > 100)  return 'Log entry has out-of-range sets.';
    }

    if (json.plans !== undefined && !Array.isArray(json.plans)) return 'Plans field is not an array.';
    if (Array.isArray(json.plans) && json.plans.length > 10_000)  return 'Backup contains too many plans (max 10,000).';
    return null; // valid
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Sanity-check file size before reading (max 50 MB)
    if (file.size > 50 * 1024 * 1024) {
      setMsg({ type: 'error', text: 'File is too large (max 50 MB).' });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    setImporting(true);
    setMsg(null);

    try {
      const text = await file.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        setMsg({ type: 'error', text: 'Could not parse file — make sure it is a valid LiftLog JSON backup.' });
        setImporting(false);
        return;
      }

      const validationError = validateBackup(json);
      if (validationError) {
        setMsg({ type: 'error', text: `Invalid backup: ${validationError}` });
        setImporting(false);
        return;
      }

      const confirmed = confirm(
        `Import ${json.workoutLogs.length} workout log(s) and ${json.plans?.length || 0} plan(s) into your account?\n\nExisting records will be kept.`
      );
      if (!confirmed) { setImporting(false); return; }

      await importUserData(json, user.userID);
      setMsg({ type: 'success', text: `Imported ${json.workoutLogs.length} log(s) successfully.` });
    } catch (err) {
      setMsg({ type: 'error', text: 'Import failed. Make sure the file is a valid LiftLog backup.' });
      if (import.meta.env.DEV) console.error(err);
    } finally {
      setImporting(false);
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
