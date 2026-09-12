import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Key,
  Shield,
  Trash2,
  Power,
  Copy,
  Check,
  Search,
  RefreshCw,
  X,
  AlertTriangle,
  Lock,
  ArrowLeft,
  Sparkles,
  Info,
  Eye,
  EyeOff,
} from 'lucide-react';
import { authService } from '../../services/authService';
import { AdminUserListItem, AuthUser } from '../../types/auth';

interface AdminDashboardProps {
  currentUser: AuthUser;
  onClose: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, onClose }) => {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add user form state
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user');
  const [isAddingUser, setIsAddingUser] = useState<boolean>(false);

  // Generated password modal state
  const [generatedModal, setGeneratedModal] = useState<{
    open: boolean;
    email: string;
    password: string;
    action: 'created' | 'reset';
  } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [showModalPassword, setShowModalPassword] = useState<boolean>(false);

  // Delete confirmation
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState<string | null>(null);

  const loadUsers = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const list = await authService.getAllUsers();
      setUsers(list);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load authorized users.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserEmail.includes('@')) {
      setErrorMessage('Please enter a valid Gmail address.');
      return;
    }

    setIsAddingUser(true);
    setErrorMessage(null);

    try {
      const res = await authService.addUser(
        newUserEmail.trim(),
        newUserName.trim() || undefined,
        newUserRole
      );

      if (res.generatedPassword) {
        setGeneratedModal({
          open: true,
          email: res.email,
          password: res.generatedPassword,
          action: 'created',
        });
      }

      setNewUserEmail('');
      setNewUserName('');
      setNewUserRole('user');
      await loadUsers();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to add user.');
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleResetPassword = async (targetEmail: string) => {
    const proceed = window.confirm(
      `Are you sure you want to reset the password for ${targetEmail}? The current password will immediately stop working.`
    );
    if (!proceed) return;

    try {
      const res = await authService.resetPassword(targetEmail);
      if (res.generatedPassword) {
        setGeneratedModal({
          open: true,
          email: res.email,
          password: res.generatedPassword,
          action: 'reset',
        });
      }
      await loadUsers();
    } catch (err: any) {
      alert(`Error resetting password: ${err.message}`);
    }
  };

  const handleToggleStatus = async (targetEmail: string, currentEnabled: boolean) => {
    try {
      await authService.toggleUserStatus(targetEmail, !currentEnabled);
      await loadUsers();
    } catch (err: any) {
      alert(`Error updating user status: ${err.message}`);
    }
  };

  const handleDeleteUser = async (targetEmail: string) => {
    try {
      await authService.deleteUser(targetEmail);
      setDeleteConfirmEmail(null);
      await loadUsers();
    } catch (err: any) {
      alert(`Error deleting user: ${err.message}`);
    }
  };

  const copyPasswordToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    return u.email.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col select-none overflow-hidden animate-fadeIn">
      {/* Top Header */}
      <header className="h-16 px-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
            title="Back to Video Editor"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight">Admin Dashboard</h1>
            <p className="text-[10px] text-slate-400">User Access & Security Control</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300">
            <span className="text-slate-500 text-[10px]">Admin:</span>
            <span>{currentUser.email}</span>
          </div>

          <button
            id="btn-admin-close"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-md"
          >
            <span>Return to Editor</span>
          </button>
        </div>
      </header>

      {/* Main Admin Content */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Top Quick Actions Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Stat: Total Users */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-white">{users.length}</div>
                <div className="text-xs text-slate-400">Authorized Accounts</div>
              </div>
            </div>

            {/* Stat: Active Users */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Power className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-emerald-400">
                  {users.filter((u) => u.enabled).length}
                </div>
                <div className="text-xs text-slate-400">Active / Enabled</div>
              </div>
            </div>

            {/* Stat: Disabled Users */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-rose-400">
                  {users.filter((u) => !u.enabled).length}
                </div>
                <div className="text-xs text-slate-400">Disabled Accounts</div>
              </div>
            </div>
          </div>

          {/* Add User Section */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-sm">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-white">Authorize New Google Account</h2>
            </div>
            <p className="text-xs text-slate-400">
              Enter the person's Gmail address. The system will authorize their account and generate a unique individual password that only works for their Gmail.
            </p>

            <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                id="input-admin-new-email"
                type="email"
                placeholder="user@gmail.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                required
                className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-750 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 font-mono"
              />

              <input
                id="input-admin-new-name"
                type="text"
                placeholder="Full Name (optional)"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-750 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              />

              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'user')}
                className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-750 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="user">Role: Standard User (Password Required)</option>
                <option value="admin">Role: Administrator (Google Sign-In Only, No Password)</option>
              </select>

              <button
                id="btn-admin-add-user"
                type="submit"
                disabled={isAddingUser}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Key className="w-3.5 h-3.5" />
                <span>
                  {isAddingUser
                    ? 'Authorizing...'
                    : newUserRole === 'admin'
                    ? 'Authorize Admin'
                    : 'Create & Generate Password'}
                </span>
              </button>
            </form>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* User List Table */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white">Authorized Users Directory</h2>
                <p className="text-xs text-slate-400">
                  Manage authorized Gmail accounts, generate passwords, and toggle access.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by email or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-750 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  onClick={loadUsers}
                  disabled={isLoading}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                  title="Refresh users"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4">Last Access</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        {isLoading ? 'Loading users...' : 'No authorized users found.'}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id || u.email} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{u.displayName}</div>
                          <div className="font-mono text-[11px] text-indigo-300">{u.email}</div>
                        </td>

                        <td className="py-3 px-4">
                          {u.enabled ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              ACTIVE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-950 text-rose-300 border border-rose-800/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                              DISABLED
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              u.role === 'admin'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800/50'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}
                        </td>

                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                          {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}
                        </td>

                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {/* Reset Password Button - regular users only */}
                          {u.role === 'user' ? (
                            <button
                              id={`btn-reset-pass-${u.email}`}
                              onClick={() => handleResetPassword(u.email)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-950 hover:bg-indigo-900 text-indigo-300 hover:text-white border border-indigo-800/50 text-[11px] font-medium transition-colors"
                              title="Generate a new password for this user"
                            >
                              Reset Password
                            </button>
                          ) : (
                            <span className="text-[11px] text-amber-400/80 font-mono px-2 py-0.5 rounded bg-amber-950/40 border border-amber-900/40">
                              Google Sign-In Only
                            </span>
                          )}

                          {/* Toggle Status Button */}
                          <button
                            id={`btn-toggle-status-${u.email}`}
                            onClick={() => handleToggleStatus(u.email, u.enabled)}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
                              u.enabled
                                ? 'bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border-amber-800/50'
                                : 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border-emerald-800/50'
                            }`}
                            title={u.enabled ? 'Disable user access' : 'Enable user access'}
                          >
                            {u.enabled ? 'Disable' : 'Enable'}
                          </button>

                          {/* Delete Button */}
                          {deleteConfirmEmail === u.email ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => handleDeleteUser(u.email)}
                                className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px]"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirmEmail(null)}
                                className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-[10px]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              id={`btn-delete-user-${u.email}`}
                              onClick={() => setDeleteConfirmEmail(u.email)}
                              className="p-1 rounded-lg hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 transition-colors"
                              title="Delete user"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* GENERATED ONE-TIME PASSWORD MODAL */}
      {generatedModal && generatedModal.open && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-400">
                <Key className="w-5 h-5" />
                <h3 className="font-bold text-white text-base">
                  {generatedModal.action === 'created' ? 'New User Authorized' : 'Password Reset Successfully'}
                </h3>
              </div>
              <button
                onClick={() => setGeneratedModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
              <span className="text-slate-500 text-[10px] block uppercase font-sans">Google Account:</span>
              <span className="text-indigo-300 font-bold">{generatedModal.email}</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  Individual Access Password:
                </label>
                <button
                  type="button"
                  onClick={() => setShowModalPassword(!showModalPassword)}
                  className="text-[11px] text-slate-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                >
                  {showModalPassword ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Hide Password</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Show Password</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 p-3.5 rounded-xl bg-slate-950 border border-indigo-500/50 text-emerald-400 font-mono text-base font-bold tracking-widest text-center select-all">
                  {showModalPassword ? generatedModal.password : '••••••••••••••••'}
                </div>
                <button
                  id="btn-copy-password"
                  onClick={() => copyPasswordToClipboard(generatedModal.password)}
                  className="p-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-md flex items-center justify-center shrink-0"
                  title="Copy password to clipboard"
                >
                  {copied ? <Check className="w-5 h-5 text-emerald-300" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Crucial Security Notice */}
            <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-800/60 text-amber-300 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Password is securely hashed on the server. You can copy it directly to clipboard to share securely.
              </p>
            </div>

            <button
              id="btn-close-pass-modal"
              onClick={() => {
                setGeneratedModal(null);
                setShowModalPassword(false);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors"
            >
              Done / Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
