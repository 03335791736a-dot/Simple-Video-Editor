import React, { useState, useRef } from 'react';
import {
  Upload,
  Film,
  Scissors,
  Crop,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Zap,
} from 'lucide-react';
import { VideoAsset } from '../types/editor';
import { mediaService } from '../services/mediaService';

interface UploadHeroProps {
  onVideoUploaded: (video: VideoAsset) => void;
  onLoadDemo: () => void;
  isLoading: boolean;
}

export const UploadHero: React.FC<UploadHeroProps> = ({
  onVideoUploaded,
  onLoadDemo,
  isLoading,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|mov|webm|mkv|avi)$/i)) {
      setError('Please select a valid video file (.mp4, .mov, .webm, .mkv, .avi)');
      return;
    }

    setError(null);
    setUploadProgress(`Uploading ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append('files', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Upload failed');
      }

      const data = await res.json();
      if (data.files && data.files.length > 0) {
        const uploaded = data.files[0];
        onVideoUploaded({
          id: uploaded.id,
          name: uploaded.name,
          path: uploaded.path,
          url: uploaded.url,
          duration: uploaded.duration || 1,
          width: uploaded.width || 1920,
          height: uploaded.height || 1080,
          size: uploaded.size,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Error processing video upload');
    } finally {
      setUploadProgress(null);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-12 flex flex-col items-center justify-center max-w-5xl mx-auto space-y-10 animate-fadeIn">
      {/* Brand Hero Header */}
      <div className="text-center space-y-3 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-800/60 text-indigo-300 text-xs font-semibold shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Automated Rhythmic Video Editor</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
          Cut and Crop
        </h1>

        <p className="text-slate-300 text-sm md:text-base leading-relaxed">
          Upload any video and apply automated <span className="text-indigo-400 font-bold">2:4</span> or{' '}
          <span className="text-purple-400 font-bold">4:2</span> rhythm cutting across the whole timeline, crop freely, and export in qualities from <strong className="text-white">360p to 4K</strong>.
        </p>
      </div>

      {/* Upload Drop Zone */}
      <div
        id="video-dropzone"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full max-w-2xl p-10 md:p-12 rounded-3xl border-2 border-dashed cursor-pointer transition-all duration-200 text-center flex flex-col items-center justify-center space-y-4 group ${
          isDragging
            ? 'border-indigo-500 bg-indigo-950/40 scale-[1.01] shadow-2xl shadow-indigo-500/20'
            : 'border-slate-800 bg-slate-900/70 hover:border-indigo-600/70 hover:bg-slate-900 shadow-xl'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp4,.mov,.webm,.mkv,.avi,video/*"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />

        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner border border-indigo-500/30">
          <Upload className="w-9 h-9 text-indigo-300 group-hover:text-white transition-colors" />
        </div>

        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
            {uploadProgress || 'Click to Upload Video or Drag & Drop'}
          </h3>
          <p className="text-xs text-slate-400">
            Supports MP4, MOV, WebM, MKV, AVI • Up to 4K resolution
          </p>
        </div>

        {/* Instant Demo Clip Button */}
        <div className="pt-3" onClick={(e) => e.stopPropagation()}>
          <button
            id="btn-hero-load-demo"
            onClick={onLoadDemo}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 text-xs font-semibold border border-purple-800/60 hover:border-purple-500 transition-all flex items-center gap-2 shadow-sm disabled:opacity-40"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Try with Instant 24s Demo Video</span>
          </button>
        </div>

        {error && (
          <p className="text-xs text-rose-400 font-semibold bg-rose-950/60 px-3 py-1.5 rounded-lg border border-rose-800">
            {error}
          </p>
        )}
      </div>

      {/* The Two Cutting Patterns Preview */}
      <div className="w-full max-w-3xl space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 text-center font-mono">
          Automated Pattern Options Available After Upload
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 2:4 Card */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black font-mono text-indigo-400">2 : 4 Option</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                Keep 2s, Cut 4s
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Preserves the first 2 seconds untouched, removes the next 4 seconds, keeps next 2 seconds, removes next 4 seconds. Applied recursively across the entire video.
            </p>
            <div className="h-5 rounded-md bg-slate-950 border border-slate-800 overflow-hidden flex text-[9px] font-mono font-bold">
              <div className="w-1/3 bg-emerald-600/80 text-white flex items-center justify-center">
                0-2s KEEP
              </div>
              <div className="w-2/3 bg-rose-950/80 text-rose-300 flex items-center justify-center line-through">
                2-6s CUT
              </div>
            </div>
          </div>

          {/* 4:2 Card */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black font-mono text-purple-400">4 : 2 Option</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                Cut 4s, Keep 2s
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Removes the first 4 seconds immediately, keeps the next 2 seconds, removes next 4 seconds, keeps next 2 seconds. Applied recursively across the entire video.
            </p>
            <div className="h-5 rounded-md bg-slate-950 border border-slate-800 overflow-hidden flex text-[9px] font-mono font-bold">
              <div className="w-2/3 bg-rose-950/80 text-rose-300 flex items-center justify-center line-through">
                0-4s CUT
              </div>
              <div className="w-1/3 bg-emerald-600/80 text-white flex items-center justify-center">
                4-6s KEEP
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
