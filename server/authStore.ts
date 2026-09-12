import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface StoredUser {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
  enabled: boolean;
  passwordHash: string; // scrypt hex
  salt: string;         // 16 bytes hex
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

export interface PublicUser {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

const dataDir = path.join(process.cwd(), 'data');
const usersFilePath = path.join(dataDir, 'auth-users.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Active session tokens: token -> { email: string, role: string, expiresAt: number }
interface SessionData {
  email: string;
  role: 'admin' | 'user';
  expiresAt: number;
}
const activeSessions = new Map<string, SessionData>();

/**
 * Generate a cryptographically secure random password formatted as A7K9-X2P4-M8Q1
 */
export function generateSecurePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 characters, no ambiguous chars
  const group = (len: number) => {
    const bytes = crypto.randomBytes(len);
    let str = '';
    for (let i = 0; i < len; i++) {
      str += chars[bytes[i] % chars.length];
    }
    return str;
  };
  return `${group(4)}-${group(4)}-${group(4)}`;
}

/**
 * Hash a password with salt using Node's native scrypt
 */
export function hashPassword(password: string, salt: string): string {
  const key = crypto.scryptSync(password.normalize('NFKC'), salt, 64, { N: 16384, r: 8, p: 1 });
  return key.toString('hex');
}

/**
 * Timing-safe comparison of password
 */
export function verifyPasswordHash(password: string, salt: string, storedHash: string): boolean {
  try {
    const hash = hashPassword(password, salt);
    const hashBuffer = Buffer.from(hash, 'hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');
    if (hashBuffer.length !== storedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(hashBuffer, storedBuffer);
  } catch {
    return false;
  }
}

/**
 * Load users from disk
 */
function loadUsers(): Map<string, StoredUser> {
  const usersMap = new Map<string, StoredUser>();
  if (fs.existsSync(usersFilePath)) {
    try {
      const data = fs.readFileSync(usersFilePath, 'utf-8');
      const list: StoredUser[] = JSON.parse(data);
      for (const u of list) {
        usersMap.set(u.email.toLowerCase().trim(), u);
      }
    } catch (err) {
      console.error('Error reading auth-users.json:', err);
    }
  }
  return usersMap;
}

/**
 * Save users to disk
 */
function saveUsers(usersMap: Map<string, StoredUser>) {
  const list = Array.from(usersMap.values());
  fs.writeFileSync(usersFilePath, JSON.stringify(list, null, 2), 'utf-8');
}

/**
 * Strip password hash and salt for public/admin response
 */
export function toPublicUser(u: StoredUser): PublicUser {
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    enabled: u.enabled,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    lastLogin: u.lastLogin,
  };
}

/**
 * Initialize default users (including admin and prompt example accounts)
 */
export function initializeAuthStore() {
  const usersMap = loadUsers();
  const now = new Date().toISOString();

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@gmail.com').toLowerCase().trim();

  // Ensure configured ADMIN_EMAIL exists
  if (!usersMap.has(adminEmail)) {
    const salt = crypto.randomBytes(16).toString('hex');
    const adminPass = 'ADMIN-7K9P-2026';
    const passwordHash = hashPassword(adminPass, salt);
    usersMap.set(adminEmail, {
      uid: `admin-${Date.now()}`,
      email: adminEmail,
      displayName: 'System Administrator',
      role: 'admin',
      enabled: true,
      passwordHash,
      salt,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`[AUTH] Created default admin: ${adminEmail}`);
  }

  // Pre-seed the 3 example accounts mentioned in user prompt for instant verification testing
  const seedAccounts: Array<{ email: string; pass: string; name: string }> = [
    { email: 'user1@gmail.com', pass: 'A7K9-X2P4', name: 'User One' },
    { email: 'user2@gmail.com', pass: 'B8M3-Q7L1', name: 'User Two' },
    { email: 'user3@gmail.com', pass: 'C4R9-N5K2', name: 'User Three' },
  ];

  for (const acc of seedAccounts) {
    const emailKey = acc.email.toLowerCase().trim();
    if (!usersMap.has(emailKey)) {
      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPassword(acc.pass, salt);
      usersMap.set(emailKey, {
        uid: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        email: acc.email,
        displayName: acc.name,
        role: 'user',
        enabled: true,
        passwordHash,
        salt,
        createdAt: now,
        updatedAt: now,
      });
      console.log(`[AUTH] Seeded test user: ${acc.email} with linked password: ${acc.pass}`);
    }
  }

  saveUsers(usersMap);
}

// Initialize on module load
initializeAuthStore();

/**
 * Check if a user exists and is authorized/enabled
 */
export function checkUserAuthorization(email: string): {
  authorized: boolean;
  enabled: boolean;
  role: 'admin' | 'user';
  displayName: string;
} {
  const usersMap = loadUsers();
  const normalized = email.toLowerCase().trim();
  const user = usersMap.get(normalized);

  if (!user) {
    return {
      authorized: false,
      enabled: false,
      role: 'user',
      displayName: '',
    };
  }

  return {
    authorized: true,
    enabled: user.enabled,
    role: user.role,
    displayName: user.displayName,
  };
}

/**
 * Verify password for a given user email
 */
export function verifyUserPassword(email: string, password: string): {
  success: boolean;
  error?: string;
  user?: PublicUser;
  token?: string;
} {
  const usersMap = loadUsers();
  const normalized = email.toLowerCase().trim();
  const user = usersMap.get(normalized);

  if (!user) {
    return { success: false, error: 'Your Google account is not authorized to use this application.' };
  }

  if (!user.enabled) {
    return { success: false, error: 'Your account has been disabled by the administrator.' };
  }

  const isValid = verifyPasswordHash(password.trim(), user.salt, user.passwordHash);
  if (!isValid) {
    return { success: false, error: 'Incorrect password.' };
  }

  // Update last login
  user.lastLogin = new Date().toISOString();
  usersMap.set(normalized, user);
  saveUsers(usersMap);

  // Generate session token (valid 24h)
  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.set(token, {
    email: user.email,
    role: user.role,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  });

  return {
    success: true,
    user: toPublicUser(user),
    token,
  };
}

/**
 * Validate session token
 */
export function validateSessionToken(token: string): {
  valid: boolean;
  user?: PublicUser;
} {
  const session = activeSessions.get(token);
  if (!session) return { valid: false };

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return { valid: false };
  }

  const usersMap = loadUsers();
  const user = usersMap.get(session.email.toLowerCase().trim());
  if (!user || !user.enabled) {
    activeSessions.delete(token);
    return { valid: false };
  }

  return { valid: true, user: toPublicUser(user) };
}

/**
 * Revoke session
 */
export function revokeSessionToken(token: string) {
  activeSessions.delete(token);
}

/**
 * Check if requesting identity is an admin
 */
export function verifyIsAdmin(adminEmail?: string, token?: string): boolean {
  if (token) {
    const session = activeSessions.get(token);
    if (session && session.role === 'admin' && Date.now() <= session.expiresAt) {
      return true;
    }
  }

  if (adminEmail) {
    const usersMap = loadUsers();
    const user = usersMap.get(adminEmail.toLowerCase().trim());
    if (user && user.role === 'admin' && user.enabled) {
      return true;
    }
    // Also check if matches process.env.ADMIN_EMAIL
    if (process.env.ADMIN_EMAIL && adminEmail.toLowerCase().trim() === process.env.ADMIN_EMAIL.toLowerCase().trim()) {
      return true;
    }
  }

  return false;
}

/**
 * Admin: Get all users
 */
export function getAllUsers(): PublicUser[] {
  const usersMap = loadUsers();
  return Array.from(usersMap.values()).map(toPublicUser);
}

/**
 * Admin: Add new user and generate initial password
 */
export function addUser(email: string, displayName?: string, role: 'admin' | 'user' = 'user'): {
  success: boolean;
  user?: PublicUser;
  generatedPassword?: string;
  error?: string;
} {
  const normalized = email.toLowerCase().trim();
  if (!normalized || !normalized.includes('@')) {
    return { success: false, error: 'A valid email address is required.' };
  }

  const usersMap = loadUsers();
  if (usersMap.has(normalized)) {
    return { success: false, error: 'User with this email already exists.' };
  }

  const generatedPassword = generateSecurePassword();
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(generatedPassword, salt);
  const now = new Date().toISOString();

  const newUser: StoredUser = {
    uid: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    email: normalized,
    displayName: displayName?.trim() || normalized.split('@')[0],
    role,
    enabled: true,
    passwordHash,
    salt,
    createdAt: now,
    updatedAt: now,
  };

  usersMap.set(normalized, newUser);
  saveUsers(usersMap);

  return {
    success: true,
    user: toPublicUser(newUser),
    generatedPassword,
  };
}

/**
 * Admin: Reset user password
 */
export function resetUserPassword(email: string): {
  success: boolean;
  generatedPassword?: string;
  error?: string;
} {
  const normalized = email.toLowerCase().trim();
  const usersMap = loadUsers();
  const user = usersMap.get(normalized);

  if (!user) {
    return { success: false, error: 'User not found.' };
  }

  const newPassword = generateSecurePassword();
  const newSalt = crypto.randomBytes(16).toString('hex');
  const newHash = hashPassword(newPassword, newSalt);

  user.passwordHash = newHash;
  user.salt = newSalt;
  user.updatedAt = new Date().toISOString();

  usersMap.set(normalized, user);
  saveUsers(usersMap);

  // Invalidate any active sessions for this user so they must re-authenticate with new password
  for (const [token, session] of activeSessions.entries()) {
    if (session.email.toLowerCase().trim() === normalized) {
      activeSessions.delete(token);
    }
  }

  return {
    success: true,
    generatedPassword: newPassword,
  };
}

/**
 * Admin: Toggle user enabled / disabled
 */
export function setUserEnabled(email: string, enabled: boolean): {
  success: boolean;
  user?: PublicUser;
  error?: string;
} {
  const normalized = email.toLowerCase().trim();
  const usersMap = loadUsers();
  const user = usersMap.get(normalized);

  if (!user) {
    return { success: false, error: 'User not found.' };
  }

  user.enabled = enabled;
  user.updatedAt = new Date().toISOString();
  usersMap.set(normalized, user);
  saveUsers(usersMap);

  // If disabled, immediately revoke all active sessions
  if (!enabled) {
    for (const [token, session] of activeSessions.entries()) {
      if (session.email.toLowerCase().trim() === normalized) {
        activeSessions.delete(token);
      }
    }
  }

  return {
    success: true,
    user: toPublicUser(user),
  };
}

/**
 * Admin: Delete user permanently
 */
export function deleteUser(email: string): { success: boolean; error?: string } {
  const normalized = email.toLowerCase().trim();
  const usersMap = loadUsers();

  if (!usersMap.has(normalized)) {
    return { success: false, error: 'User not found.' };
  }

  usersMap.delete(normalized);
  saveUsers(usersMap);

  // Invalidate active sessions
  for (const [token, session] of activeSessions.entries()) {
    if (session.email.toLowerCase().trim() === normalized) {
      activeSessions.delete(token);
    }
  }

  return { success: true };
}
