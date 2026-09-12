import React from 'react';
import {
  Crop as CropIcon,
  Scissors,
  Download,
  Sliders,
  Check,
  Sparkles,
  Zap,
  Film,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { AspectRatioType, CropSettings, ExportResolution, PatternMode, PatternSettings, VideoAsset } from '../types/editor';

interface PropertiesPanelProps {
  video: VideoAsset | null;
  crop: CropSettings;
  pattern: PatternSettings;
  resolution: ExportResolution;
  onUpdateCrop: (crop: Partial<CropSettings>) => void;
  onChangePattern: (pattern: PatternSettings) => void;
  onChangeResolution: (res: ExportResolution) => void;
  onExportVideo: () => void;
  isExporting: boolean;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  video,
  crop,
  pattern,
  resolution,
  onUpdateCrop,
  onChangePattern,
  onChangeResolution,
  onExportVideo,
  isExporting,
}) => {
  const videoDuration = video?.duration || 0;

  // Compute estimated stats
  const computeStats = () => {
    if (pattern.mode === 'none' || videoDuration <= 0) {
      return { outputDur: videoDuration, timeSaved: 0, cuts: 0 };
    }
    const keepDur = 2;
    const cutDur = 4;
    let isKeep = pattern.mode === '2:4';
    let t = 0;
    let kept = 0;
    let cuts = 0;

    while (t < videoDuration) {
      const dur = isKeep ? keepDur : cutDur;
      const nextT = Math.min(t + dur, videoDuration);
      if (isKeep) {
        kept += nextT - t;
      } else {
        cuts++;
      }
      t = nextT;
      isKeep = !isKeep;
    }
    return { outputDur: kept, timeSaved: videoDuration - kept, cuts };
  };

  const stats = computeStats();

  const handleSelectAspectRatio = (ratio: AspectRatioType) => {
    if (ratio === 'free') {
      onUpdateCrop({ enabled: true, aspectRatio: 'free' });
    } else if (ratio === '16:9') {
      onUpdateCrop({
        enabled: true,
        aspectRatio: '16:9',
        width: 80,
        height: 45,
        x: 10,
        y: 27.5,
      });
    } else if (ratio === '9:16') {
      onUpdateCrop({
        enabled: true,
        aspectRatio: '9:16',
        width: 45,
        height: 80,
        x: 27.5,
        y: 10,
      });
    } else if (ratio === '1:1') {
      onUpdateCrop({
        enabled: true,
        aspectRatio: '1:1',
        width: 60,
        height: 60,
        x: 20,
        y: 20,
      });
    }
  };

  const handleResetCrop = () => {
    onUpdateCrop({
      enabled: false,
      aspectRatio: 'free',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
  };

  return (
    <aside id="properties-panel" className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col h-full shrink-0 overflow-y-auto select-none">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-800 flex items-center gap-2 text-slate-200 font-semibold text-sm">
        <Sliders className="w-4 h-4 text-indigo-400" />
        <span>Cut & Crop Controls</span>
      </div>

      <div className="p-4 space-y-6 flex-1">
        {/* SECTION 1: RHYTHM PATTERN */}
        <div id="section-rhythm-pattern" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Scissors className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Rhythm Pattern
              </span>
            </div>
            {pattern.mode !== 'none' && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/40">
                ACTIVE
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* 2:4 Pattern */}
            <button
              id="btn-pattern-2-4"
              onClick={() =>
                onChangePattern({
                  mode: '2:4',
                  keepDuration: 2,
                  cutDuration: 4,
                  startWith: 'keep',
                })
              }
              className={`p-2.5 rounded-xl border text-left transition-all ${
                pattern.mode === '2:4'
                  ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-md'
                  : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold font-mono text-indigo-300">2 : 4</span>
                {pattern.mode === '2:4' && <Check className="w-3.5 h-3.5 text-indigo-400" />}
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                Keep 2s, Cut 4s
              </p>
            </button>

            {/* 4:2 Pattern */}
            <button
              id="btn-pattern-4-2"
              onClick={() =>
                onChangePattern({
                  mode: '4:2',
                  keepDuration: 2,
                  cutDuration: 4,
                  startWith: 'cut',
                })
              }
              className={`p-2.5 rounded-xl border text-left transition-all ${
                pattern.mode === '4:2'
                  ? 'bg-purple-600/30 border-purple-500 text-white shadow-md'
                  : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold font-mono text-purple-300">4 : 2</span>
                {pattern.mode === '4:2' && <Check className="w-3.5 h-3.5 text-purple-400" />}
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                Cut 4s, Keep 2s
              </p>
            </button>
          </div>

          {/* Pattern Stats summary */}
          {pattern.mode !== 'none' && videoDuration > 0 && (
            <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] font-mono space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Output Duration:</span>
                <span className="text-emerald-400 font-bold">{stats.outputDur.toFixed(1)}s</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total Cuts:</span>
                <span className="text-purple-300 font-bold">{stats.cuts}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Duration Saved:</span>
                <span className="text-rose-400 font-bold">-{stats.timeSaved.toFixed(1)}s</span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-800" />

        {/* SECTION 2: CROP TOOL */}
        <div id="section-crop-tool" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <CropIcon className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Crop Tool
              </span>
            </div>
            {crop.enabled && (
              <button
                onClick={handleResetCrop}
                className="text-[11px] text-slate-400 hover:text-white"
              >
                Reset
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleSelectAspectRatio('free')}
              className={`px-3 py-2 rounded-lg text-xs font-medium border flex items-center justify-between transition-colors ${
                crop.enabled && crop.aspectRatio === 'free'
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <span>Free</span>
              {crop.enabled && crop.aspectRatio === 'free' && <Check className="w-3 h-3" />}
            </button>

            <button
              onClick={() => handleSelectAspectRatio('16:9')}
              className={`px-3 py-2 rounded-lg text-xs font-medium border flex items-center justify-between transition-colors ${
                crop.enabled && crop.aspectRatio === '16:9'
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <span>16:9</span>
              {crop.enabled && crop.aspectRatio === '16:9' && <Check className="w-3 h-3" />}
            </button>

            <button
              onClick={() => handleSelectAspectRatio('9:16')}
              className={`px-3 py-2 rounded-lg text-xs font-medium border flex items-center justify-between transition-colors ${
                crop.enabled && crop.aspectRatio === '9:16'
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <span>9:16 (Story)</span>
              {crop.enabled && crop.aspectRatio === '9:16' && <Check className="w-3 h-3" />}
            </button>

            <button
              onClick={() => handleSelectAspectRatio('1:1')}
              className={`px-3 py-2 rounded-lg text-xs font-medium border flex items-center justify-between transition-colors ${
                crop.enabled && crop.aspectRatio === '1:1'
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <span>1:1 Square</span>
              {crop.enabled && crop.aspectRatio === '1:1' && <Check className="w-3 h-3" />}
            </button>
          </div>

          {crop.enabled && (
            <div className="p-2 rounded bg-indigo-950/40 border border-indigo-800/40 text-[10px] text-indigo-300 font-mono flex items-center justify-between">
              <span>Box: {crop.width}% × {crop.height}%</span>
              <span>Offset: ({crop.x}%, {crop.y}%)</span>
            </div>
          )}
        </div>

        <div className="border-t border-slate-800" />

        {/* SECTION 3: EXPORT RESOLUTION (360p to 4K) */}
        <div id="section-export-resolution" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Download className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Initial Export Quality
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {(['360p', '480p', '720p', '1080p', '1440p', '4k'] as ExportResolution[]).map((res) => (
              <button
                key={res}
                id={`btn-res-${res}`}
                onClick={() => onChangeResolution(res)}
                className={`py-2 px-1.5 rounded-lg text-xs font-mono font-bold border transition-colors ${
                  resolution === res
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                {res.toUpperCase()}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400">
            You can also download all other qualities instantly after generating!
          </p>
        </div>
      </div>

      {/* FOOTER: MAIN GENERATE BUTTON */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/60">
        <button
          id="btn-generate-cut-video"
          onClick={onExportVideo}
          disabled={!video || isExporting}
          className="w-full py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-40 disabled:pointer-events-none transform active:scale-98"
        >
          <Sparkles className="w-4 h-4" />
          <span>Generate Cut Video</span>
        </button>
      </div>
    </aside>
  );
};
