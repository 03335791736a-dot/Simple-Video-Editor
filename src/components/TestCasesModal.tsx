import React, { useState } from 'react';
import { X, CheckCircle2, Play, FlaskConical, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { AspectRatioType, AudioAsset, CropSettings, ExportResolution, ImageAsset, VideoAsset } from '../types/editor';
import { mediaService } from '../services/mediaService';

interface TestCase {
  id: number;
  title: string;
  description: string;
  hasVideo: boolean;
  hasImages: boolean;
  hasAudio: boolean;
  crop: boolean;
  cropRatio?: AspectRatioType;
  duplicateFill: boolean;
}

const TEST_CASES: TestCase[] = [
  {
    id: 1,
    title: 'TEST 1: Import Video → Preview → Export',
    description: 'Loads 10s video, verifies video playback in preview player, exports as MP4 video.',
    hasVideo: true,
    hasImages: false,
    hasAudio: false,
    crop: false,
    duplicateFill: false,
  },
  {
    id: 2,
    title: 'TEST 2: Import Multiple Images → Set Durations → Reorder → Export Slideshow',
    description: 'Loads 3 images (3s each = 9s slideshow), generates MP4 video slideshow using FFmpeg.',
    hasVideo: false,
    hasImages: true,
    hasAudio: false,
    crop: false,
    duplicateFill: false,
  },
  {
    id: 3,
    title: 'TEST 3: Import Images → Import Audio → Export',
    description: 'Combines 3 images slideshow with imported audio track, exporting synchronized MP4.',
    hasVideo: false,
    hasImages: true,
    hasAudio: true,
    crop: false,
    duplicateFill: false,
  },
  {
    id: 4,
    title: 'TEST 4: Import Images → Import Audio → Duplicate / Fill Audio → Export',
    description: 'Slideshow (9s) loops repeatedly until it fills the complete 65s audio duration exactly.',
    hasVideo: false,
    hasImages: true,
    hasAudio: true,
    crop: false,
    duplicateFill: true,
  },
  {
    id: 5,
    title: 'TEST 5: Import Short Video → Import Long Audio → Duplicate / Fill Audio → Export',
    description: 'Short video (10s) repeats seamlessly 6.5 times to cover the 65s audio, trimmed to exact length.',
    hasVideo: true,
    hasImages: false,
    hasAudio: true,
    crop: false,
    duplicateFill: true,
  },
  {
    id: 6,
    title: 'TEST 6: Import Video → Crop → Export',
    description: 'Applies 16:9 crop rectangle to imported video and encodes cropped MP4 output.',
    hasVideo: true,
    hasImages: false,
    hasAudio: false,
    crop: true,
    cropRatio: '16:9',
    duplicateFill: false,
  },
  {
    id: 7,
    title: 'TEST 7: Import Images → Crop → Export',
    description: 'Applies 1:1 square crop to image slideshow composition, encoding cropped MP4.',
    hasVideo: false,
    hasImages: true,
    hasAudio: false,
    crop: true,
    cropRatio: '1:1',
    duplicateFill: false,
  },
  {
    id: 8,
    title: 'TEST 8: Import Video → Import Audio → Crop → Duplicate / Fill Audio → Export',
    description: 'Full stack: 10s video looped to 65s audio duration with 16:9 crop and audio replacement.',
    hasVideo: true,
    hasImages: false,
    hasAudio: true,
    crop: true,
    cropRatio: '16:9',
    duplicateFill: true,
  },
  {
    id: 9,
    title: 'TEST 9: Import Images → Import Audio → Crop → Duplicate / Fill Audio → Export',
    description: 'Full stack: 3 images looped to fill 65s audio duration with 9:16 portrait crop.',
    hasVideo: false,
    hasImages: true,
    hasAudio: true,
    crop: true,
    cropRatio: '9:16',
    duplicateFill: true,
  },
];

interface TestCasesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTestCase: (config: {
    video: VideoAsset | null;
    images: ImageAsset[];
    audio: AudioAsset | null;
    crop: CropSettings;
    duplicateFillAudio: boolean;
  }) => void;
  onTriggerExport: () => void;
}

export const TestCasesModal: React.FC<TestCasesModalProps> = ({
  isOpen,
  onClose,
  onApplyTestCase,
  onTriggerExport,
}) => {
  const [loadingTestId, setLoadingTestId] = useState<number | null>(null);
  const [activeTestId, setActiveTestId] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleRunTestCase = async (test: TestCase, autoExport = false) => {
    setLoadingTestId(test.id);
    try {
      const samples = await mediaService.loadSampleMedia();

      const cropSettings: CropSettings = {
        enabled: test.crop,
        aspectRatio: test.cropRatio || 'free',
        x: test.cropRatio === '9:16' ? 27.5 : test.cropRatio === '1:1' ? 20 : 10,
        y: test.cropRatio === '9:16' ? 10 : test.cropRatio === '1:1' ? 20 : 27.5,
        width: test.cropRatio === '9:16' ? 45 : test.cropRatio === '1:1' ? 60 : 80,
        height: test.cropRatio === '9:16' ? 80 : test.cropRatio === '1:1' ? 60 : 45,
      };

      onApplyTestCase({
        video: test.hasVideo ? samples.video : null,
        images: test.hasImages ? samples.images : [],
        audio: test.hasAudio ? samples.audio : null,
        crop: cropSettings,
        duplicateFillAudio: test.duplicateFill,
      });

      setActiveTestId(test.id);
      onClose();

      if (autoExport) {
        setTimeout(() => {
          onTriggerExport();
        }, 300);
      }
    } catch (err: any) {
      alert(`Could not load test sample media: ${err.message}`);
    } finally {
      setLoadingTestId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none animate-fadeIn">
      <div
        id="test-cases-modal"
        className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">9 Required Test Cases Verification</h3>
              <p className="text-xs text-slate-400">
                Instantly load and test each mandated functional test scenario with real FFmpeg processing
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of Test Cases */}
        <div className="space-y-3">
          {TEST_CASES.map((tc) => {
            const isLoading = loadingTestId === tc.id;
            const isSelected = activeTestId === tc.id;

            return (
              <div
                key={tc.id}
                id={`test-case-row-${tc.id}`}
                className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                  isSelected
                    ? 'bg-purple-950/30 border-purple-500/60 shadow-sm'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-white">{tc.title}</span>
                    {tc.duplicateFill && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-900/60 text-purple-300 font-mono">
                        Duplicate / Fill Active
                      </span>
                    )}
                    {tc.crop && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-900/60 text-indigo-300 font-mono">
                        {tc.cropRatio} Crop
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 leading-snug">{tc.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    id={`btn-load-test-${tc.id}`}
                    onClick={() => handleRunTestCase(tc, false)}
                    disabled={Boolean(loadingTestId)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 hover:border-purple-500/50 flex items-center gap-1.5 transition-colors disabled:opacity-40"
                  >
                    {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 text-purple-400" />}
                    <span>Load Test</span>
                  </button>

                  <button
                    id={`btn-run-export-test-${tc.id}`}
                    onClick={() => handleRunTestCase(tc, true)}
                    disabled={Boolean(loadingTestId)}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all disabled:opacity-40"
                    title="Load test scenario and immediately trigger FFmpeg export"
                  >
                    <span>Test & Export</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>All media files, videos, audio, and slides are processed 100% offline via FFmpeg.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
