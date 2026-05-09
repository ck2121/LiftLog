import { getUserByUsername, addUser, getUser } from '../db/database';

const TOKEN_KEY = 'liftlog_token';
const USER_ID_KEY = 'liftlog_user_id';
const EXPIRY_KEY = 'liftlog_expiry';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function sha256(str) {
  const buf = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function storeSession(userID) {
  const token = crypto.randomUUID();
  const expiry = Date.now() + THIRTY_DAYS_MS;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_ID_KEY, String(userID));
  localStorage.setItem(EXPIRY_KEY, String(expiry));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(EXPIRY_KEY);
}

export async function getSessionUser() {
  const token = localStorage.getItem(TOKEN_KEY);
  const userID = localStorage.getItem(USER_ID_KEY);
  const expiry = localStorage.getItem(EXPIRY_KEY);

  if (!token || !userID || !expiry) return null;
  if (Date.now() > parseInt(expiry, 10)) {
    clearSession();
    return null;
  }

  try {
    const user = await getUser(parseInt(userID, 10));
    return user || null;
  } catch {
    return null;
  }
}

export async function login(username, password) {
  const user = await getUserByUsername(username);
  if (!user) return { success: false };

  const hash = await sha256(password);
  if (hash !== user.passwordHash) return { success: false };

  storeSession(user.userID);
  return { success: true, user };
}

export async function register(username, password) {
  if (!username.trim() || !password) return { success: false, error: 'empty_fields' };

  try {
    const hash = await sha256(password);
    const userID = await addUser({
      username: username.toLowerCase().trim(),
      passwordHash: hash,
      createdAt: new Date().toISOString(),
    });
    const user = await getUser(userID);
    storeSession(userID);
    return { success: true, user };
  } catch (e) {
    if (e.name === 'ConstraintError') return { success: false, error: 'username_taken' };
    throw e;
  }
}
