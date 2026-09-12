import React from 'react';
import { Scissors, Play, ShieldAlert, Sparkles, Check, Clock, Film } from 'lucide-react';
import { PatternMode, PatternSettings } from '../types/editor';

interface PatternSelectorProps {
  pattern: PatternSettings;
  onChangePattern: (pattern: PatternSettings) => void;
  videoDuration: number;
}

export const PatternSelector: React.FC<PatternSelectorProps> = ({
  pattern,
  onChangePattern,
  videoDuration,
}) => {
  // Calculate stats for 2:4
  const calc24Stats = () => {
    let t = 0;
    let keptDur = 0;
    let cutsCount = 0;
    let isKeep = true;
    while (t < videoDuration) {
      const dur = isKeep ? 2 : 4;
      const nextT = Math.min(t + dur, videoDuration);
      if (isKeep) {
        keptDur += nextT - t;
      } else {
        cutsCount++;
      }
      t = nextT;
      isKeep = !isKeep;
    }
    return {
      outputDur: keptDur,
      timeSaved: videoDuration - keptDur,
      cutsCount,
    };
  };

  // Calculate stats for 4:2
  const calc42Stats = () => {
    let t = 0;
    let keptDur = 0;
    let cutsCount = 0;
    let isKeep = false;
    while (t < videoDuration) {
      const dur = isKeep ? 2 : 4;
      const nextT = Math.min(t + dur, videoDuration);
      if (isKeep) {
        keptDur += nextT - t;
      } else {
        cutsCount++;
      }
      t = nextT;
      isKeep = !isKeep;
    }
    return {
      outputDur: keptDur,
      timeSaved: videoDuration - keptDur,
      cutsCount,
    };
  };

  const stats24 = calc24Stats();
  const stats42 = calc42Stats();

  const handleSelect24 = () => {
    onChangePattern({
      mode: '2:4',
      keepDuration: 2,
      cutDuration: 4,
      startWith: 'keep',
    });
  };

  const handleSelect42 = () => {
    onChangePattern({
      mode: '4:2',
      keepDuration: 2,
      cutDuration: 4,
      startWith: 'cut',
    });
  };

  const handleSelectNone = () => {
    onChangePattern({
      mode: 'none',
      keepDuration: 2,
      cutDuration: 4,
      startWith: 'keep',
    });
  };

  return (
    <div id="pattern-selector-container" className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <Scissors className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Step 1: Choose Rhythm Cut Pattern
            </h3>
            <p className="text-xs text-slate-400">
              Select between the automated 2:4 and 4:2 interval cut algorithms
            </p>
          </div>
        </div>

        {pattern.mode !== 'none' && (
          <button
            onClick={handleSelectNone}
            className="text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800 transition-colors"
          >
            Disable Cut (Crop Only)
          </button>
        )}
      </div>

      {/* TWO PRIMARY OPTION CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* OPTION 1: 2:4 Pattern */}
        <div
          id="option-card-2-4"
          onClick={handleSelect24}
          className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between group ${
            pattern.mode === '2:4'
              ? 'bg-gradient-to-b from-indigo-950/60 to-slate-900 border-indigo-500 shadow-xl shadow-indigo-500/10'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
          }`}
        >
          {pattern.mode === '2:4' && (
            <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-bold shadow-md flex items-center gap-1">
              <Check className="w-3 h-3" /> Selected Mode
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl font-black text-indigo-400 font-mono tracking-tight">
                  2 : 4
                </span>
                <span className="text-xs font-semibold text-white px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Keep 2s • Cut 4s
                </span>
              </div>
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  pattern.mode === '2:4'
                    ? 'border-indigo-400 bg-indigo-500 text-white'
                    : 'border-slate-600'
                }`}
              >
                {pattern.mode === '2:4' && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              <strong className="text-white">Keep first 2 seconds</strong> untouched, then{' '}
              <strong className="text-rose-400">remove next 4 seconds</strong>, keep next 2 seconds,
              remove next 4 seconds, applied across the entire video.
            </p>

            {/* Visual pattern diagram */}
            <div className="space-y-1.5 mb-4">
              <div className="text-[10px] uppercase font-mono text-slate-400 font-semibold flex justify-between">
                <span>Pattern Sequence</span>
                <span className="text-indigo-400">6s cycle</span>
              </div>
              <div className="h-6 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex text-[10px] font-mono font-bold">
                <div className="w-[33.3%] bg-emerald-600/80 text-white flex items-center justify-center border-r border-slate-900">
                  0-2s KEEP
                </div>
                <div className="w-[66.7%] bg-rose-950/70 text-rose-300 flex items-center justify-center line-through decoration-rose-400">
                  2-6s CUT
                </div>
              </div>
              <div className="h-6 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex text-[10px] font-mono font-bold opacity-75">
                <div className="w-[33.3%] bg-emerald-600/80 text-white flex items-center justify-center border-r border-slate-900">
                  6-8s KEEP
                </div>
                <div className="w-[66.7%] bg-rose-950/70 text-rose-300 flex items-center justify-center line-through decoration-rose-400">
                  8-12s CUT
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          {videoDuration > 0 && (
            <div className="pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center text-xs font-mono">
              <div className="p-2 rounded bg-slate-950/50 border border-slate-800/50">
                <span className="text-[10px] text-slate-500 block">OUTPUT</span>
                <span className="text-emerald-400 font-bold">{stats24.outputDur.toFixed(1)}s</span>
              </div>
              <div className="p-2 rounded bg-slate-950/50 border border-slate-800/50">
                <span className="text-[10px] text-slate-500 block">CUT TIME</span>
                <span className="text-rose-400 font-bold">-{stats24.timeSaved.toFixed(1)}s</span>
              </div>
              <div className="p-2 rounded bg-slate-950/50 border border-slate-800/50">
                <span className="text-[10px] text-slate-500 block">TOTAL CUTS</span>
                <span className="text-indigo-300 font-bold">{stats24.cutsCount}</span>
              </div>
            </div>
          )}
        </div>

        {/* OPTION 2: 4:2 Pattern */}
        <div
          id="option-card-4-2"
          onClick={handleSelect42}
          className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between group ${
            pattern.mode === '4:2'
              ? 'bg-gradient-to-b from-purple-950/60 to-slate-900 border-purple-500 shadow-xl shadow-purple-500/10'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
          }`}
        >
          {pattern.mode === '4:2' && (
            <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-purple-500 text-white text-[10px] font-bold shadow-md flex items-center gap-1">
              <Check className="w-3 h-3" /> Selected Mode
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl font-black text-purple-400 font-mono tracking-tight">
                  4 : 2
                </span>
                <span className="text-xs font-semibold text-white px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Cut 4s • Keep 2s
                </span>
              </div>
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  pattern.mode === '4:2'
                    ? 'border-purple-400 bg-purple-500 text-white'
                    : 'border-slate-600'
                }`}
              >
                {pattern.mode === '4:2' && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              <strong className="text-rose-400">Remove first 4 seconds</strong> immediately, then{' '}
              <strong className="text-white">keep next 2 seconds</strong>, remove next 4 seconds,
              keep next 2 seconds, applied across the entire video.
            </p>

            {/* Visual pattern diagram */}
            <div className="space-y-1.5 mb-4">
              <div className="text-[10px] uppercase font-mono text-slate-400 font-semibold flex justify-between">
                <span>Pattern Sequence</span>
                <span className="text-purple-400">6s cycle</span>
              </div>
              <div className="h-6 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex text-[10px] font-mono font-bold">
                <div className="w-[66.7%] bg-rose-950/70 text-rose-300 flex items-center justify-center line-through decoration-rose-400 border-r border-slate-900">
                  0-4s CUT
                </div>
                <div className="w-[33.3%] bg-emerald-600/80 text-white flex items-center justify-center">
                  4-6s KEEP
                </div>
              </div>
              <div className="h-6 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex text-[10px] font-mono font-bold opacity-75">
                <div className="w-[66.7%] bg-rose-950/70 text-rose-300 flex items-center justify-center line-through decoration-rose-400 border-r border-slate-900">
                  6-10s CUT
                </div>
                <div className="w-[33.3%] bg-emerald-600/80 text-white flex items-center justify-center">
                  10-12s KEEP
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          {videoDuration > 0 && (
            <div className="pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center text-xs font-mono">
              <div className="p-2 rounded bg-slate-950/50 border border-slate-800/50">
                <span className="text-[10px] text-slate-500 block">OUTPUT</span>
                <span className="text-emerald-400 font-bold">{stats42.outputDur.toFixed(1)}s</span>
              </div>
              <div className="p-2 rounded bg-slate-950/50 border border-slate-800/50">
                <span className="text-[10px] text-slate-500 block">CUT TIME</span>
                <span className="text-rose-400 font-bold">-{stats42.timeSaved.toFixed(1)}s</span>
              </div>
              <div className="p-2 rounded bg-slate-950/50 border border-slate-800/50">
                <span className="text-[10px] text-slate-500 block">TOTAL CUTS</span>
                <span className="text-purple-300 font-bold">{stats42.cutsCount}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
