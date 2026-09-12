export type UserRole = 'admin' | 'user';

export type UserStatus = 'active' | 'disabled';

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

export interface AuthState {
  isAuthenticated: boolean; // Google Auth passed
  isAuthorized: boolean;    // Gmail is on the authorized list
  isEnabled: boolean;       // Account is enabled
  isUnlocked: boolean;      // Password verified successfully
  user: AuthUser | null;
  sessionToken?: string;
  error?: string | null;
}

export interface PasswordVerificationResult {
  success: boolean;
  error?: string;
  sessionToken?: string;
  user?: AuthUser;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

export interface GeneratePasswordResult {
  success: boolean;
  email: string;
  generatedPassword?: string;
  error?: string;
}
