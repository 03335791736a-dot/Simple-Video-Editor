import React from 'react';
import { X, Monitor, ShieldCheck, Terminal, HardDrive, Check, Copy } from 'lucide-react';

interface OfflineGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OfflineGuideModal: React.FC<OfflineGuideModalProps> = ({ isOpen, onClose }) => {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const steps = [
    {
      title: '1. Clone / Extract the repository to your Windows 10 PC',
      cmd: 'git clone <repo-url> && cd simple-video-editor',
    },
    {
      title: '2. Install Node dependencies (includes Electron & electron-builder)',
      cmd: 'npm install',
    },
    {
      title: '3. Build React client, Server, and Electron binaries',
      cmd: 'npm run build',
    },
    {
      title: '4. Package the Windows 10 64-bit installer with bundled FFmpeg',
      cmd: 'npm run dist:win',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none animate-fadeIn">
      <div
        id="offline-guide-modal"
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Monitor className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Windows 10 Offline Packaging Guide</h3>
              <p className="text-xs text-slate-400">
                How to compile <span className="text-indigo-300 font-mono">SimpleVideoEditorSetup.exe</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Offline Pillars */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>100% Offline</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              No internet, cloud server, login, or subscriptions needed. Runs locally on Windows 10.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 text-indigo-400 text-xs font-semibold">
              <HardDrive className="w-4 h-4" />
              <span>Bundled FFmpeg</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              FFmpeg and FFprobe binaries are bundled directly into the installation directory.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 text-purple-400 text-xs font-semibold">
              <Terminal className="w-4 h-4" />
              <span>NSIS Installer</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Configured with electron-builder to output <code className="text-purple-300">SimpleVideoEditorSetup.exe</code>.
            </p>
          </div>
        </div>

        {/* Build Commands */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Step-by-Step Build Instructions Outside Bolt
          </h4>

          <div className="space-y-2.5 font-mono text-xs">
            {steps.map((step, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                <p className="text-slate-300 font-sans font-medium text-xs">{step.title}</p>
                <div className="flex items-center justify-between bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800 text-indigo-300">
                  <span className="truncate">{step.cmd}</span>
                  <button
                    onClick={() => copyToClipboard(step.cmd, idx)}
                    className="ml-2 text-slate-400 hover:text-white shrink-0"
                    title="Copy command"
                  >
                    {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Output Artifacts Info */}
        <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-800/40 text-xs space-y-2">
          <p className="text-indigo-300 font-semibold">Generated Windows 10 64-bit Outputs:</p>
          <ul className="list-disc list-inside text-slate-300 space-y-1 font-mono text-[11px]">
            <li>
              <span className="text-white font-bold">dist-electron-build/SimpleVideoEditorSetup.exe</span> (Full NSIS installer with desktop shortcut)
            </li>
            <li>
              <span className="text-white font-bold">dist-electron-build/SimpleVideoEditor-Portable.exe</span> (Zero-install portable single .exe)
            </li>
          </ul>
        </div>

        {/* Close Button */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
