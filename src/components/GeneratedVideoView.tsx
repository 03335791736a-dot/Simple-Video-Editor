import React, { useState, useRef } from 'react';
import {
  Download,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  Film,
  Scissors,
  Layers,
  ArrowRight,
  Maximize2,
  RefreshCw,
  Loader2,
  Sliders,
} from 'lucide-react';
import { ExportResolution, PatternMode, ProcessedVideoResult, ResolutionOption } from '../types/editor';
import { mediaService } from '../services/mediaService';

interface GeneratedVideoViewProps {
  result: ProcessedVideoResult;
  originalVideoUrl?: string;
  originalVideoName?: string;
  onEditAgain: () => void;
}

const RESOLUTIONS: ResolutionOption[] = [
  { id: '360p', label: '360p SD', resolution: '640 × 360', height: 360, description: 'Low Bandwidth & Mobile' },
  { id: '480p', label: '480p SD', resolution: '854 × 480', height: 480, description: 'Standard Definition' },
  { id: '720p', label: '720p HD', resolution: '1280 × 720', height: 720, description: 'High Definition' },
  { id: '1080p', label: '1080p FHD', resolution: '1920 × 1080', height: 1080, description: 'Full HD (Standard)' },
  { id: '1440p', label: '1440p 2K', resolution: '2560 × 1440', height: 1440, description: 'Quad HD Quality' },
  { id: '4k', label: '4K UHD', resolution: '3840 × 2160', height: 2160, description: 'Ultra High Definition' },
];

export const GeneratedVideoView: React.FC<GeneratedVideoViewProps> = ({
  result,
  originalVideoUrl,
  originalVideoName,
  onEditAgain,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(result.duration || 0);
  const [activeTab, setActiveTab] = useState<'generated' | 'original'>('generated');
  const [transcodingRes, setTranscodingRes] = useState<ExportResolution | null>(null);
  const [cachedUrls, setCachedUrls] = useState<Record<string, string>>({
    [result.resolution]: result.url,
  });

  const videoRef = useRef<HTMLVideoElement>(null);

  const activeUrl = activeTab === 'generated' ? result.url : originalVideoUrl || result.url;

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  // Handle download of any resolution (360p to 4K)
  const handleDownloadQuality = async (res: ExportResolution) => {
    // If it's the resolution already generated, download directly
    if (cachedUrls[res] || res === result.resolution) {
      const urlToDownload = cachedUrls[res] || result.url;
      const a = document.createElement('a');
      a.href = urlToDownload;
      a.download = `CutAndCrop_${result.pattern}_${res}_${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // Otherwise transcode via server
    setTranscodingRes(res);
    try {
      const transcoded = await mediaService.transcodeQuality(result.url, res, result.outputPath);
      setCachedUrls((prev) => ({ ...prev, [res]: transcoded.url }));

      const a = document.createElement('a');
      a.href = transcoded.url;
      a.download = `CutAndCrop_${result.pattern}_${res}_${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Could not encode ${res} quality: ${err.message}`);
    } finally {
      setTranscodingRes(null);
    }
  };

  return (
    <div id="generated-video-view" className="max-w-6xl mx-auto p-6 space-y-6 animate-fadeIn">
      {/* Top Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-indigo-950/60 border border-emerald-500/30 flex items-center justify-between flex-wrap gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">Generated Video Ready</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Pattern {result.pattern.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Successfully cut and encoded via local FFmpeg. Ready to preview and download in all qualities.
            </p>
          </div>
        </div>

        <button
          onClick={onEditAgain}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 flex items-center gap-2 transition-colors shadow-sm"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Edit / Re-Cut Settings</span>
        </button>
      </div>

      {/* Main Grid: Video Player + Stats & Downloads */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT / CENTER: Video Player (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            {/* View Switcher: Generated vs Original */}
            <div className="p-2 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('generated')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    activeTab === 'generated'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generated Video ({result.duration.toFixed(1)}s)</span>
                </button>

                {originalVideoUrl && (
                  <button
                    onClick={() => setActiveTab('original')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      activeTab === 'original'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>Original Source ({result.stats.originalDuration.toFixed(1)}s)</span>
                  </button>
                )}
              </div>

              <span className="text-[11px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                {activeTab === 'generated' ? `Pattern: ${result.pattern}` : 'Uncut'}
              </span>
            </div>

            {/* Video Canvas Container */}
            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                src={activeUrl}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full object-contain"
                playsInline
              />

              {/* Centered Play Button Overlay */}
              {!isPlaying && (
                <button
                  onClick={togglePlay}
                  className="absolute w-16 h-16 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white flex items-center justify-center shadow-xl shadow-indigo-600/40 backdrop-blur-sm transition-transform hover:scale-105 active:scale-95"
                >
                  <Play className="w-7 h-7 ml-1 fill-white" />
                </button>
              )}
            </div>

            {/* Video Player Controls */}
            <div className="p-3 bg-slate-950/80 border-t border-slate-800 space-y-2">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={videoDuration || 1}
                  step={0.05}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePlay}
                    className="text-slate-300 hover:text-white p-1 rounded hover:bg-slate-800"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <span>
                    {formatTime(currentTime)} / {formatTime(videoDuration)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-semibold">
                    {activeTab === 'generated' ? 'Cut Applied' : 'Raw Video'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Cuts Breakdown Bar */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Scissors className="w-3.5 h-3.5 text-indigo-400" />
              <span>Rhythm Cut Analysis</span>
            </h4>

            <div className="grid grid-cols-4 gap-2 text-center font-mono">
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block">ORIGINAL</span>
                <span className="text-xs font-bold text-slate-300">
                  {result.stats.originalDuration.toFixed(1)}s
                </span>
              </div>

              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block">OUTPUT</span>
                <span className="text-xs font-bold text-emerald-400">
                  {result.stats.newDuration.toFixed(1)}s
                </span>
              </div>

              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block">CUTS APPLIED</span>
                <span className="text-xs font-bold text-purple-400">
                  {result.stats.cutsCount}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block">TIME CUT</span>
                <span className="text-xs font-bold text-rose-400">
                  -{result.stats.timeSaved.toFixed(1)}s
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Multi-Quality Download Hub (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Download Qualities
                </h3>
                <p className="text-xs text-slate-400">
                  Export from 360p minimum up to 4K maximum
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Select any desired quality below. Each video is encoded in MP4 (H.264 + AAC) for maximum compatibility.
            </p>

            {/* Quality Cards List */}
            <div className="space-y-2.5">
              {RESOLUTIONS.map((res) => {
                const isReady = Boolean(cachedUrls[res.id] || res.id === result.resolution);
                const isCurrent = res.id === result.resolution;
                const isTranscoding = transcodingRes === res.id;

                return (
                  <div
                    key={res.id}
                    id={`download-quality-card-${res.id}`}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      isCurrent
                        ? 'bg-indigo-950/40 border-indigo-500/60 shadow-md'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white font-mono">{res.label}</span>
                        {isCurrent && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-500 text-white font-mono">
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {res.resolution} • {res.description}
                      </div>
                    </div>

                    <button
                      id={`btn-download-${res.id}`}
                      onClick={() => handleDownloadQuality(res.id)}
                      disabled={Boolean(transcodingRes)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                        isCurrent || isReady
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                      } disabled:opacity-40`}
                    >
                      {isTranscoding ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Encoding...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>{isReady ? 'Download' : 'Export & Save'}</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Quick Action: Open Folder */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Container: MP4 (H.264 / AAC)</span>
              <button
                onClick={() => mediaService.openOutputFolder(result.outputPath, result.url)}
                className="text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                Open / Save File
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
