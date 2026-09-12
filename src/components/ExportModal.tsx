import React from 'react';
import { CheckCircle2, AlertCircle, FolderOpen, RefreshCw, X, Download, Film } from 'lucide-react';
import { ExportProgress } from '../types/editor';

interface ExportModalProps {
  progress: ExportProgress;
  isOpen: boolean;
  onClose: () => void;
  onOpenFolder: () => void;
  onExportAgain: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  progress,
  isOpen,
  onClose,
  onOpenFolder,
  onExportAgain,
}) => {
  if (!isOpen) return null;

  const isCompleted = progress.status === 'completed';
  const isError = progress.status === 'error';
  const isExporting = progress.status === 'exporting' || progress.status === 'preparing';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none animate-fadeIn">
      <div
        id="export-modal"
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isCompleted
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : isError
                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
              }`}
            >
              {isCompleted ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : isError ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <Film className="w-5 h-5 animate-pulse" />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                {isCompleted ? 'Export Complete' : isError ? 'Export Error' : 'Exporting MP4 Video'}
              </h3>
              <p className="text-xs text-slate-400">
                {isCompleted
                  ? 'Your video was processed locally in your browser using FFmpeg WebAssembly'
                  : isError
                  ? 'Could not complete video export'
                  : 'Local browser H.264 & AAC encoding in progress'}
              </p>
            </div>
          </div>

          {!isExporting && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Progress Bar & Percentage */}
        {isExporting && (
          <div className="space-y-2 py-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300 font-medium">{progress.message}</span>
              <span className="text-indigo-400 font-bold">{progress.percent}%</span>
            </div>

            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-200"
                style={{ width: `${Math.max(5, progress.percent)}%` }}
              />
            </div>
          </div>
        )}

        {/* Success Details */}
        {isCompleted && (
          <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-xs space-y-1.5 font-mono">
            <p className="text-emerald-300 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Export completed successfully.
            </p>
            {progress.outputPath && (
              <p className="text-slate-400 break-all text-[11px] pt-1">
                Saved to: <span className="text-slate-300">{progress.outputPath}</span>
              </p>
            )}
          </div>
        )}

        {/* Error Details */}
        {isError && (
          <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/40 text-xs space-y-1 text-rose-200">
            <p className="font-semibold">{progress.message || 'FFmpeg processing failed.'}</p>
            <p className="text-rose-400/90 text-[11px]">{progress.error || 'Please check your input media format.'}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          {isCompleted && (
            <>
              {progress.outputUrl && (
                <a
                  id="btn-download-mp4"
                  href={progress.outputUrl}
                  download="CutAndCrop_Export.mp4"
                  className="flex-1 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/30 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Video (MP4)</span>
                </a>
              )}

              <button
                id="btn-export-again"
                onClick={onExportAgain}
                className="py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Export Again</span>
              </button>
            </>
          )}

          {isError && (
            <>
              <button
                onClick={onExportAgain}
                className="flex-1 py-2.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
              <button
                onClick={onClose}
                className="py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700"
              >
                Close
              </button>
            </>
          )}

          {isExporting && (
            <div className="w-full text-center text-xs text-slate-500">
              Please wait while FFmpeg encodes your video...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
