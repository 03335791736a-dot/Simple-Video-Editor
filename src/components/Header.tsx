import React from 'react';
import { Scissors, Crop, Sparkles, RefreshCw, Upload, Film, CheckCircle2, Shield, LogOut, User } from 'lucide-react';
import { AuthUser } from '../types/auth';

interface HeaderProps {
  onResetProject: () => void;
  onLoadDemoClip: () => void;
  hasVideo: boolean;
  isProcessing: boolean;
  videoName?: string;
  currentUser?: AuthUser | null;
  onOpenAdmin?: () => void;
  onSignOut?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onResetProject,
  onLoadDemoClip,
  hasVideo,
  isProcessing,
  videoName,
  currentUser,
  onOpenAdmin,
  onSignOut,
}) => {
  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shrink-0 select-none shadow-sm z-30">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
          <div className="relative">
            <Scissors className="w-5 h-5 text-white" />
            <Crop className="w-3 h-3 text-amber-300 absolute -bottom-1 -right-1" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-white tracking-tight">Cut and Crop</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800/60">
              Rhythm Editor
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Automated 2:4 & 4:2 pattern cutting • Visual crop • 360p to 4K exports
          </p>
        </div>
      </div>

      {/* Middle: Video Loaded Indicator */}
      {hasVideo && (
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs font-mono text-slate-300 max-w-xs truncate">
          <Film className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="truncate">{videoName || 'Video active'}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
        </div>
      )}

      {/* Action Buttons & Auth User Profile */}
      <div className="flex items-center gap-2.5">
        <button
          id="btn-load-demo-clip"
          onClick={onLoadDemoClip}
          disabled={isProcessing}
          className="px-3.5 py-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 hover:text-purple-100 text-xs font-semibold flex items-center gap-1.5 border border-purple-800/50 hover:border-purple-600 transition-all disabled:opacity-40"
          title="Load a 24-second demo video to test 2:4 and 4:2 rhythm cuts immediately"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span className="hidden sm:inline">Load Demo Video</span>
        </button>

        {hasVideo && (
          <button
            id="btn-reset-project"
            onClick={onResetProject}
            disabled={isProcessing}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-40"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Video</span>
          </button>
        )}

        {/* Divider */}
        {currentUser && <div className="h-6 w-px bg-slate-800 my-auto" />}

        {/* Admin Dashboard Access */}
        {currentUser?.role === 'admin' && onOpenAdmin && (
          <button
            id="btn-open-admin-dashboard"
            onClick={onOpenAdmin}
            className="px-3 py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 hover:text-amber-100 text-xs font-semibold border border-amber-800/60 transition-all flex items-center gap-1.5 shadow-sm"
            title="Open Admin Access & Password Management"
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>Admin</span>
          </button>
        )}

        {/* User Badge & Sign Out */}
        {currentUser && (
          <div className="flex items-center gap-2">
            <div
              className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300"
              title={`Logged in as ${currentUser.email}`}
            >
              <div className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold text-[10px]">
                {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
              </div>
              <span className="max-w-[140px] truncate text-[11px] font-mono">{currentUser.email}</span>
            </div>

            {onSignOut && (
              <button
                id="btn-header-signout"
                onClick={onSignOut}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors border border-slate-750"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

