import { getUserByUsername, addUser, getUser, updateUser } from '../db/database';

// ── Session keys ──────────────────────────────────────────────────────────────
const TOKEN_KEY    = 'liftlog_token';
const USER_ID_KEY  = 'liftlog_user_id';
const EXPIRY_KEY   = 'liftlog_expiry';
const RATE_KEY     = 'liftlog_rate_limit';
const THIRTY_DAYS  = 30 * 24 * 60 * 60 * 1000;

// ── Rate limiting ─────────────────────────────────────────────────────────────
const MAX_ATTEMPTS  = 5;
const LOCKOUT_MS    = 15 * 60 * 1000; // 15 minutes

function getRateData() {
  try {
    return JSON.parse(localStorage.getItem(RATE_KEY) || '{"attempts":0,"lockedUntil":0}');
  } catch {
    return { attempts: 0, lockedUntil: 0 };
  }
}

export function checkRateLimit() {
  const { attempts, lockedUntil } = getRateData();
  if (Date.now() < lockedUntil) {
    const mins = Math.ceil((lockedUntil - Date.now()) / 60000);
    return { locked: true, message: `Too many failed attempts. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.` };
  }
  return { locked: false, attemptsLeft: Math.max(0, MAX_ATTEMPTS - attempts) };
}

function recordFailure() {
  const data = getRateData();
  // Reset attempt counter if previous lockout has fully expired
  const base = Date.now() < data.lockedUntil ? data.attempts : data.attempts + 1;
  const lockedUntil = base >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : data.lockedUntil;
  localStorage.setItem(RATE_KEY, JSON.stringify({ attempts: base, lockedUntil }));
}

function clearRateLimit() {
  localStorage.removeItem(RATE_KEY);
}

// ── Crypto helpers ────────────────────────────────────────────────────────────

// Generates a 16-byte random hex salt
function generateSalt() {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// PBKDF2-SHA256 — 310,000 iterations (OWASP 2024 recommendation)
// hashVersion: 2
async function pbkdf2Hash(password, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 310_000, hash: 'SHA-256' },
    key,
    256
  );
  return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Legacy SHA-256 — kept only for migrating existing accounts
// hashVersion: 1 (or undefined = pre-versioning)
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Session management ────────────────────────────────────────────────────────

function storeSession(userID) {
  const token = crypto.randomUUID();
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_ID_KEY, String(userID));
  localStorage.setItem(EXPIRY_KEY, String(Date.now() + THIRTY_DAYS));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  // Clear any sensitive workout data left in sessionStorage
  sessionStorage.clear();
}

export async function getSessionUser() {
  const token  = localStorage.getItem(TOKEN_KEY);
  const userID = localStorage.getItem(USER_ID_KEY);
  const expiry = localStorage.getItem(EXPIRY_KEY);

  if (!token || !userID || !expiry) return null;
  if (Date.now() > parseInt(expiry, 10)) { clearSession(); return null; }

  try {
    return (await getUser(parseInt(userID, 10))) || null;
  } catch {
    return null;
  }
}

// ── Username validation ───────────────────────────────────────────────────────
// 3–32 characters, letters / numbers / underscores / hyphens only
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,32}$/;

export function validateUsername(username) {
  if (!username || !USERNAME_RE.test(username.trim())) {
    return 'Username must be 3–32 characters and contain only letters, numbers, _ or -.';
  }
  return null;
}

// ── Password strength ─────────────────────────────────────────────────────────
// Returns { score: 0-3, label, color }
export function passwordStrength(password) {
  if (!password || password.length < 8) return { score: 0, label: 'Too short', color: '#FF4D4D' };
  const hasNum  = /\d/.test(password);
  const hasSym  = /[^a-zA-Z0-9]/.test(password);
  const isLong  = password.length >= 12;
  if (isLong && hasNum && hasSym) return { score: 3, label: 'Strong',  color: '#A8FF3E' };
  if ((hasNum || hasSym) && password.length >= 8) return { score: 2, label: 'Fair', color: '#F59E0B' };
  return { score: 1, label: 'Weak', color: '#FF4D4D' };
}

// ── Login ─────────────────────────────────────────────────────────────────────
export async function login(username, password) {
  // Rate-limit check first
  const rate = checkRateLimit();
  if (rate.locked) return { success: false, error: 'rate_limited', message: rate.message };

  const user = await getUserByUsername(username);
  if (!user) {
    recordFailure();
    return { success: false };
  }

  const version = user.hashVersion || 1;
  let matches = false;

  if (version === 2) {
    // PBKDF2 path
    const hash = await pbkdf2Hash(password, user.salt);
    matches = hash === user.passwordHash;
  } else {
    // Legacy SHA-256 path
    const hash = await sha256(password);
    matches = hash === user.passwordHash;
  }

  if (!matches) {
    recordFailure();
    return { success: false };
  }

  // Successful login — clear rate limit
  clearRateLimit();

  // Migrate legacy SHA-256 accounts to PBKDF2 transparently
  if (version < 2) {
    const salt    = generateSalt();
    const newHash = await pbkdf2Hash(password, salt);
    await updateUser({ ...user, passwordHash: newHash, salt, hashVersion: 2 });
  }

  storeSession(user.userID);
  return { success: true, user };
}

// ── Register ──────────────────────────────────────────────────────────────────
export async function register(username, password) {
  const usernameError = validateUsername(username);
  if (usernameError) return { success: false, error: 'invalid_username', message: usernameError };
  if (!password || password.length < 8) return { success: false, error: 'weak_password' };

  try {
    const salt = generateSalt();
    const hash = await pbkdf2Hash(password, salt);
    const userID = await addUser({
      username:     username.toLowerCase().trim(),
      passwordHash: hash,
      salt,
      hashVersion:  2,
      createdAt:    new Date().toISOString(),
    });
    const user = await getUser(userID);
    storeSession(userID);
    return { success: true, user };
  } catch (e) {
    if (e.name === 'ConstraintError') return { success: false, error: 'username_taken' };
    throw e;
  }
}
