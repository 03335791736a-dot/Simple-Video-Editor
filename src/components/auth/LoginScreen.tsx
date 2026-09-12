import React, { useState } from 'react';
import {
  Unlock,
  ShieldAlert,
  ShieldCheck,
  LogOut,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  Scissors,
  ArrowRight,
  Mail,
} from 'lucide-react';
import { authService } from '../../services/authService';
import { AuthUser } from '../../types/auth';
import { isFirebaseConfigured } from '../../config/firebase';

interface LoginScreenProps {
  onAuthenticated: (user: AuthUser, openAdmin?: boolean) => void;
}

type LoginStep = 'google' | 'denied' | 'disabled' | 'password';

export const LoginScreen: React.FC<LoginScreenProps> = ({ onAuthenticated }) => {
  const [step, setStep] = useState<LoginStep>('google');
  const [emailInput, setEmailInput] = useState<string>('');
  const [googleEmail, setGoogleEmail] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Handle Google Sign-In or Email Verification
  const handleGoogleSignIn = async (overrideEmail?: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      let email = overrideEmail?.trim() || emailInput.trim();
      let name = '';

      if (!email) {
        if (!isFirebaseConfigured) {
          throw new Error('Please enter your authorized Google email address.');
        }
        const gUser = await authService.signInWithGoogle();
        email = gUser.email;
        name = gUser.displayName;
      } else {
        name = email.split('@')[0];
      }

      setGoogleEmail(email);
      setDisplayName(name);

      // Authenticate via Google Sign-In backend verification
      const loginResult = await authService.loginWithGoogle(email, name);

      if (!loginResult.success) {
        if (loginResult.error?.includes('disabled')) {
          setStep('disabled');
        } else {
          setStep('denied');
        }
        return;
      }

      // If Gmail matches configured Admin Gmail:
      // IMMEDIATELY open Admin Dashboard! There is NO Admin Password step.
      if (loginResult.isAdmin && loginResult.user) {
        onAuthenticated(loginResult.user, true);
        return;
      }

      // If normal authorized user requiring password to unlock the editor:
      if (loginResult.requiresUserPassword) {
        setStep('password');
        return;
      }

      if (loginResult.user) {
        onAuthenticated(loginResult.user, false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete Google authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Regular User Password Unlock (for normal authorized users only)
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMessage('Please enter your access password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await authService.verifyPassword(googleEmail, password.trim());
      if (result.success && result.user) {
        onAuthenticated(result.user, result.user.role === 'admin');
      } else {
        setErrorMessage(result.error || 'Incorrect password.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Password verification error.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await authService.signOut();
    } finally {
      setStep('google');
      setGoogleEmail('');
      setDisplayName('');
      setPassword('');
      setEmailInput('');
      setErrorMessage(null);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between select-none">
      {/* Top Brand Bar */}
      <header className="h-16 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Scissors className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight">Cut and Crop</h1>
            <p className="text-[10px] text-slate-400">Browser-Based Rhythmic Video Editor</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Local Engine Ready</span>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 relative overflow-hidden">
          {/* Subtle decorative glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* STEP 1: Google Sign-In */}
          {step === 'google' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto shadow-inner">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Sign in to Cut and Crop
                </h2>
                <p className="text-xs text-slate-400">
                  Sign in with your Google account. Configured administrators are automatically granted immediate access to the Admin Dashboard.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMessage}</span>
                </div>
              )}

              {/* Primary Google Sign-In Button (when Firebase is configured) */}
              {isFirebaseConfigured && (
                <>
                  <button
                    id="btn-google-sign-in"
                    onClick={() => handleGoogleSignIn()}
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm flex items-center justify-center gap-3 transition-all shadow-md active:scale-98 disabled:opacity-60 cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                    <span>{isLoading ? 'Signing in...' : 'Sign in with Google'}</span>
                  </button>

                  <div className="relative flex items-center justify-center">
                    <div className="border-t border-slate-800 w-full" />
                    <span className="bg-slate-900 px-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                      or
                    </span>
                    <div className="border-t border-slate-800 w-full" />
                  </div>
                </>
              )}

              {/* Authorized Google Email Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleGoogleSignIn(emailInput);
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label htmlFor="input-google-email" className="text-xs font-semibold text-slate-300 block">
                    Authorized Google Email
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="input-google-email"
                      type="email"
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="name@gmail.com"
                      disabled={isLoading}
                      className="w-full py-3 pl-10 pr-3.5 rounded-xl bg-slate-950 border border-slate-750 focus:border-indigo-500 text-white text-sm focus:outline-none transition-colors placeholder:text-slate-600"
                      autoFocus={!isFirebaseConfigured}
                    />
                  </div>
                </div>

                <button
                  id="btn-submit-google-email"
                  type="submit"
                  disabled={isLoading || !emailInput.trim()}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 disabled:opacity-40 cursor-pointer"
                >
                  <span>{isLoading ? 'Verifying...' : 'Continue with Google Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* STEP 2: Access Denied (Unauthorized Gmail) */}
          {step === 'denied' && (
            <div className="space-y-6 text-center animate-fadeIn">
              <div className="w-14 h-14 rounded-2xl bg-rose-950/60 text-rose-400 border border-rose-800 flex items-center justify-center mx-auto shadow-lg">
                <ShieldAlert className="w-7 h-7" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white">Access Denied</h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Your Google account is not authorized to use this application or access the Admin Dashboard.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-300">
                <span className="text-slate-500 block text-[10px] uppercase font-sans mb-0.5">Signed in as:</span>
                <span className="text-rose-400 font-bold">{googleEmail}</span>
              </div>

              <p className="text-xs text-slate-400">
                Only the configured administrator or authorized users may access this application.
              </p>

              <button
                id="btn-access-denied-signout"
                onClick={handleSignOut}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors border border-slate-700 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Try Another Account</span>
              </button>
            </div>
          )}

          {/* STEP 2B: Account Disabled */}
          {step === 'disabled' && (
            <div className="space-y-6 text-center animate-fadeIn">
              <div className="w-14 h-14 rounded-2xl bg-amber-950/60 text-amber-400 border border-amber-800 flex items-center justify-center mx-auto shadow-lg">
                <ShieldAlert className="w-7 h-7" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white">Account Disabled</h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Your account has been disabled by the administrator.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-300">
                <span className="text-slate-500 block text-[10px] uppercase font-sans mb-0.5">Signed in as:</span>
                <span className="text-amber-400 font-bold">{googleEmail}</span>
              </div>

              <button
                id="btn-disabled-signout"
                onClick={handleSignOut}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors border border-slate-700 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}

          {/* STEP 3: Regular User Password Screen (for normal authorized users only, NEVER for Admin) */}
          {step === 'password' && (
            <form onSubmit={handleUnlock} className="space-y-5 animate-fadeIn">
              <div className="text-center space-y-1.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto shadow-inner">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Welcome, {displayName || 'User'}
                </h2>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-300 text-xs font-mono">
                  <span className="text-slate-500 text-[10px]">Account:</span>
                  <span>{googleEmail}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Enter your access password
                </label>
                <div className="relative">
                  <input
                    id="input-access-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your individual access password"
                    disabled={isLoading}
                    className="w-full py-3 pl-3.5 pr-10 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 text-white font-mono text-sm tracking-wider focus:outline-none transition-colors placeholder:text-slate-600"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="space-y-2 pt-1">
                <button
                  id="btn-unlock-editor"
                  type="submit"
                  disabled={isLoading || !password.trim()}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/25 active:scale-98 disabled:opacity-40 cursor-pointer"
                >
                  <Unlock className="w-4 h-4" />
                  <span>{isLoading ? 'Verifying Password...' : 'Unlock Editor'}</span>
                </button>

                <button
                  id="btn-switch-account"
                  type="button"
                  onClick={handleSignOut}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out / Switch account</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* Footer info */}
      <footer className="h-12 px-6 border-t border-slate-900 text-slate-500 text-xs flex items-center justify-between">
        <span>Cut and Crop • Secure Access Control</span>
        <span>Admin authentication via Google Sign-In</span>
      </footer>
    </div>
  );
};
