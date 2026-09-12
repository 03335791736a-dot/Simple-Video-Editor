import React, { useRef } from 'react';
import { Film, Music, Image as ImageIcon, Scissors, Check, X } from 'lucide-react';
import { AudioAsset, ImageAsset, PatternSettings, VideoAsset } from '../types/editor';

interface TimelineProps {
  video: VideoAsset | null;
  images: ImageAsset[];
  audio: AudioAsset | null;
  pattern: PatternSettings;
  duplicateFillAudio?: boolean;
  currentTime: number;
  totalDuration: number;
  onSeek: (time: number) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  video,
  pattern,
  currentTime,
  totalDuration,
  onSeek,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);

  // Compute pattern intervals along totalDuration
  const patternSegments: Array<{
    start: number;
    end: number;
    duration: number;
    type: 'keep' | 'cut';
    label: string;
  }> = [];

  if (totalDuration > 0 && pattern.mode !== 'none') {
    const keepDur = 2;
    const cutDur = 4;
    let isKeep = pattern.mode === '2:4';
    let t = 0;
    let keepIndex = 1;
    let cutIndex = 1;

    while (t < totalDuration) {
      const dur = isKeep ? keepDur : cutDur;
      const nextT = Math.min(t + dur, totalDuration);
      const segmentDur = nextT - t;

      if (segmentDur > 0.05) {
        patternSegments.push({
          start: t,
          end: nextT,
          duration: segmentDur,
          type: isKeep ? 'keep' : 'cut',
          label: isKeep ? `KEEP #${keepIndex++} (${segmentDur.toFixed(1)}s)` : `CUT #${cutIndex++} (-${segmentDur.toFixed(1)}s)`,
        });
      }

      t = nextT;
      isKeep = !isKeep;
    }
  }

  // Handle timeline click to seek
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || totalDuration <= 0) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(percentage * totalDuration);
  };

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  // Time markers (every 2, 4, 6 seconds)
  const markerStep = totalDuration <= 15 ? 2 : totalDuration <= 40 ? 4 : 10;
  const markerCount = Math.floor(totalDuration / markerStep);
  const timeMarkers = Array.from({ length: markerCount + 1 }, (_, i) => i * markerStep);

  return (
    <div id="timeline-container" className="bg-slate-900 border-t border-slate-800 flex flex-col shrink-0 select-none">
      {/* Time Header Bar */}
      <div className="h-8 border-b border-slate-800 px-4 flex items-center justify-between text-xs text-slate-400 font-mono">
        <div className="flex items-center gap-4">
          <span className="text-slate-300 font-bold">TIMELINE</span>
          {pattern.mode !== 'none' && (
            <span className="flex items-center gap-1.5 text-xs text-indigo-400 font-semibold">
              <Scissors className="w-3.5 h-3.5" />
              <span>Pattern: {pattern.mode}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span>
            {currentTime.toFixed(2)}s / {totalDuration.toFixed(2)}s
          </span>
          {pattern.mode !== 'none' && (
            <span className="text-emerald-400 font-bold">
              {patternSegments.filter((s) => s.type === 'keep').length} Kept Clips
            </span>
          )}
        </div>
      </div>

      {/* Tracks Container */}
      <div
        ref={trackRef}
        onClick={handleTimelineClick}
        className="relative p-4 space-y-3 cursor-pointer overflow-x-hidden min-h-[140px]"
      >
        {/* Playhead Red Needle */}
        {totalDuration > 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-30 pointer-events-none transition-all duration-75 shadow-sm"
            style={{ left: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          >
            <div className="w-3 h-3 bg-rose-500 rounded-full -ml-[5px] -mt-1 shadow-md" />
          </div>
        )}

        {/* Time ruler ticks */}
        <div className="relative h-4 w-full border-b border-slate-800 text-[10px] text-slate-500 font-mono">
          {timeMarkers.map((time) => {
            const leftPct = totalDuration > 0 ? (time / totalDuration) * 100 : 0;
            return (
              <div
                key={time}
                className="absolute -top-1 transform -translate-x-1/2 flex flex-col items-center pointer-events-none"
                style={{ left: `${leftPct}%` }}
              >
                <span>{time}s</span>
                <div className="h-1.5 w-px bg-slate-700 mt-0.5" />
              </div>
            );
          })}
        </div>

        {/* Track 1: Original Video Track */}
        <div className="flex items-center gap-3">
          <div className="w-24 shrink-0 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <Film className="w-3.5 h-3.5 text-indigo-400" />
            <span>Video Track</span>
          </div>

          <div className="flex-1 h-9 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden relative flex items-center px-3">
            {video ? (
              <div className="w-full flex items-center justify-between text-xs font-mono text-indigo-300">
                <span className="truncate">{video.name}</span>
                <span className="text-slate-500 shrink-0">{video.duration.toFixed(1)}s</span>
              </div>
            ) : (
              <span className="text-xs text-slate-600 italic">No video imported</span>
            )}
          </div>
        </div>

        {/* Track 2: Pattern Cut Track (The 2:4 or 4:2 visualization!) */}
        {pattern.mode !== 'none' && totalDuration > 0 && (
          <div className="flex items-center gap-3">
            <div className="w-24 shrink-0 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <Scissors className="w-3.5 h-3.5 text-purple-400" />
              <span>Pattern {pattern.mode}</span>
            </div>

            <div className="flex-1 h-11 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden relative flex">
              {patternSegments.map((seg, idx) => {
                const widthPct = (seg.duration / totalDuration) * 100;
                const isKeep = seg.type === 'keep';

                return (
                  <div
                    key={idx}
                    className={`h-full border-r border-slate-900 flex items-center justify-center text-[10px] font-mono font-bold transition-all relative overflow-hidden group ${
                      isKeep
                        ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/80'
                        : 'bg-rose-950/70 text-rose-300 border-rose-500/30 hover:bg-rose-900/80'
                    }`}
                    style={{ width: `${widthPct}%` }}
                    title={`${seg.label} [${seg.start.toFixed(1)}s - ${seg.end.toFixed(1)}s]`}
                  >
                    {/* Subtle pattern background for cut */}
                    {!isKeep && (
                      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#f43f5e_1px,transparent_1px)] [background-size:6px_6px] pointer-events-none" />
                    )}

                    <div className="flex items-center gap-1 z-10 px-1 truncate">
                      {isKeep ? (
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                      ) : (
                        <X className="w-3 h-3 text-rose-400 shrink-0" />
                      )}
                      <span className="truncate">{seg.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
