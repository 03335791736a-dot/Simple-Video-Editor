import { signInWithPopup, signOut as firebaseSignOut, User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../config/firebase';
import { AuthUser, AdminUserListItem, GeneratePasswordResult, PasswordVerificationResult } from '../types/auth';

const SESSION_TOKEN_KEY = 'sve_session_token';
const AUTH_USER_KEY = 'sve_authenticated_user';

class AuthService {
  private currentToken: string | null = null;
  private currentUser: AuthUser | null = null;

  constructor() {
    this.currentToken = sessionStorage.getItem(SESSION_TOKEN_KEY);
    const stored = sessionStorage.getItem(AUTH_USER_KEY);
    if (stored) {
      try {
        this.currentUser = JSON.parse(stored);
      } catch {
        this.currentUser = null;
      }
    }
  }

  public getToken(): string | null {
    return this.currentToken;
  }

  public getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  /**
   * Perform Google Sign-In
   * Uses Firebase GoogleAuthProvider popup if configured.
   * If in local testing mode without Firebase keys, allows instant test login.
   */
  async signInWithGoogle(customEmail?: string): Promise<{
    email: string;
    displayName: string;
    photoURL?: string;
    uid: string;
  }> {
    // If email is provided directly
    if (customEmail) {
      return {
        email: customEmail.toLowerCase().trim(),
        displayName: customEmail.split('@')[0],
        uid: `auth-${customEmail}`,
      };
    }

    if (isFirebaseConfigured && auth && googleProvider) {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        const user: FirebaseUser = result.user;
        if (!user.email) {
          throw new Error('No email found for this Google account.');
        }
        return {
          email: user.email.toLowerCase().trim(),
          displayName: user.displayName || user.email.split('@')[0],
          photoURL: user.photoURL || undefined,
          uid: user.uid,
        };
      } catch (err: any) {
        if (err.code === 'auth/popup-closed-by-user') {
          throw new Error('Google sign-in popup was closed.');
        }
        if (err.code === 'auth/cancelled-popup-request') {
          throw new Error('Google sign-in was cancelled.');
        }
        throw new Error(err.message || 'Google sign-in failed.');
      }
    }

    // Fallback if Firebase is not yet configured with production keys in .env
    throw new Error(
      'FIREBASE_NOT_CONFIGURED: Please enter your authorized Google email address below or configure Firebase keys in .env.'
    );
  }

  /**
   * Authenticate Google User on backend:
   * Compares Gmail with configured Admin Gmail.
   * If matches Admin Gmail: immediately opens session without an admin password.
   * If regular user: returns authorization status and password requirement.
   */
  async loginWithGoogle(email: string, displayName?: string): Promise<{
    success: boolean;
    isAdmin: boolean;
    user?: AuthUser;
    token?: string;
    requiresUserPassword?: boolean;
    error?: string;
  }> {
    const res = await fetch('/api/auth/google-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, displayName }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        isAdmin: Boolean(data.isAdmin),
        error: data.error || 'Authentication failed.',
      };
    }

    // If Admin, save session immediately
    if (data.isAdmin && data.token && data.user) {
      this.currentToken = data.token;
      this.currentUser = data.user;
      sessionStorage.setItem(SESSION_TOKEN_KEY, data.token);
      sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
    }

    return data;
  }

  /**
   * Check if a Google email is authorized on the backend
   */
  async verifyUserAuthorization(email: string): Promise<{
    authorized: boolean;
    enabled: boolean;
    role: 'admin' | 'user';
    displayName: string;
  }> {
    const res = await fetch('/api/auth/verify-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to verify account authorization.');
    }

    return await res.json();
  }

  /**
   * Verify individual password linked to this Google email
   */
  async verifyPassword(email: string, password: string): Promise<PasswordVerificationResult> {
    const res = await fetch('/api/auth/verify-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Incorrect password.',
      };
    }

    // Save session
    this.currentToken = data.token;
    this.currentUser = data.user;
    if (data.token) {
      sessionStorage.setItem(SESSION_TOKEN_KEY, data.token);
    }
    if (data.user) {
      sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
    }

    return {
      success: true,
      sessionToken: data.token,
      user: data.user,
    };
  }

  /**
   * Verify existing session on application launch
   */
  async validateCurrentSession(): Promise<{ valid: boolean; user?: AuthUser }> {
    const token = this.currentToken || sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) return { valid: false };

    try {
      const res = await fetch('/api/auth/session', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        this.clearSession();
        return { valid: false };
      }
      const data = await res.json();
      if (data.valid && data.user) {
        this.currentUser = data.user;
        sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
        return { valid: true, user: data.user };
      }
    } catch {
      // Network error or server down
    }
    this.clearSession();
    return { valid: false };
  }

  /**
   * Sign out and clear all sessions
   */
  async signOut(): Promise<void> {
    const token = this.currentToken;
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Ignore
      }
    }

    if (isFirebaseConfigured && auth) {
      try {
        await firebaseSignOut(auth);
      } catch {
        // Ignore
      }
    }

    this.clearSession();
  }

  private clearSession() {
    this.currentToken = null;
    this.currentUser = null;
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_USER_KEY);
  }

  // ===================================
  // ADMIN DASHBOARD METHODS
  // ===================================

  private getAdminHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.currentToken) {
      headers['Authorization'] = `Bearer ${this.currentToken}`;
    }
    if (this.currentUser?.email) {
      headers['x-admin-email'] = this.currentUser.email;
    }
    return headers;
  }

  async getAllUsers(): Promise<AdminUserListItem[]> {
    const res = await fetch('/api/admin/users', {
      headers: this.getAdminHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to retrieve users.');
    }
    const data = await res.json();
    return data.users || [];
  }

  async addUser(email: string, displayName?: string, role: 'admin' | 'user' = 'user'): Promise<GeneratePasswordResult> {
    const res = await fetch('/api/admin/users/add', {
      method: 'POST',
      headers: this.getAdminHeaders(),
      body: JSON.stringify({ email, displayName, role }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to add user.');
    }
    return data;
  }

  async resetPassword(email: string): Promise<GeneratePasswordResult> {
    const res = await fetch('/api/admin/users/reset-password', {
      method: 'POST',
      headers: this.getAdminHeaders(),
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to reset password.');
    }
    return data;
  }

  async toggleUserStatus(email: string, enabled: boolean): Promise<void> {
    const res = await fetch('/api/admin/users/toggle-status', {
      method: 'POST',
      headers: this.getAdminHeaders(),
      body: JSON.stringify({ email, enabled }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update user status.');
    }
  }

  async deleteUser(email: string): Promise<void> {
    const res = await fetch('/api/admin/users/delete', {
      method: 'POST',
      headers: this.getAdminHeaders(),
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete user.');
    }
  }
}

export const authService = new AuthService();
