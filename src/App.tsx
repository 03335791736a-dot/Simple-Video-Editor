import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { UploadHero } from './components/UploadHero';
import { PatternSelector } from './components/PatternSelector';
import { PreviewPlayer } from './components/PreviewPlayer';
import { Timeline } from './components/Timeline';
import { PropertiesPanel } from './components/PropertiesPanel';
import { GeneratedVideoView } from './components/GeneratedVideoView';
import { ExportModal } from './components/ExportModal';
import { LoginScreen } from './components/auth/LoginScreen';
import { AdminDashboard } from './components/auth/AdminDashboard';
import { authService } from './services/authService';
import { AuthUser } from './types/auth';
import {
  CropSettings,
  ExportProgress,
  ExportResolution,
  PatternMode,
  PatternSettings,
  ProcessedVideoResult,
  VideoAsset,
} from './types/editor';
import { mediaService } from './services/mediaService';
import { Loader2 } from 'lucide-react';

const STORAGE_KEY = 'cut_and_crop_project_v2';

const defaultCrop: CropSettings = {
  enabled: false,
  aspectRatio: 'free',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
};

const defaultPattern: PatternSettings = {
  mode: '2:4', // Default to 2:4 as primary option
  keepDuration: 2,
  cutDuration: 4,
  startWith: 'keep',
};

export default function App() {
  // Authentication & Access Control State
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [showAdminDashboard, setShowAdminDashboard] = useState<boolean>(false);

  // Active Video State
  const [video, setVideo] = useState<VideoAsset | null>(null);
  const [crop, setCrop] = useState<CropSettings>(defaultCrop);
  const [pattern, setPattern] = useState<PatternSettings>(defaultPattern);
  const [resolution, setResolution] = useState<ExportResolution>('1080p');

  // Playback State
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState<boolean>(false);

  // Result / Generated Video State
  const [generatedResult, setGeneratedResult] = useState<ProcessedVideoResult | null>(null);

  // Export Progress State
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    status: 'idle',
    percent: 0,
    message: '',
  });

  // Verify existing session on launch
  useEffect(() => {
    let isMounted = true;
    authService.validateCurrentSession().then((res) => {
      if (isMounted) {
        if (res.valid && res.user) {
          setAuthUser(res.user);
        } else {
          setAuthUser(null);
        }
        setIsAuthChecking(false);
      }
    }).catch(() => {
      if (isMounted) {
        setAuthUser(null);
        setIsAuthChecking(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSignOut = async () => {
    await authService.signOut();
    setAuthUser(null);
    setShowAdminDashboard(false);
  };

  const totalDuration = useMemo(() => {
    return video ? Math.max(0.5, video.duration || 1) : 0;
  }, [video]);

  // Restore saved state if exists
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.video) setVideo(parsed.video);
        if (parsed.crop) setCrop(parsed.crop);
        if (parsed.pattern) setPattern(parsed.pattern);
        if (parsed.resolution) setResolution(parsed.resolution);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Save state to local storage
  useEffect(() => {
    try {
      const stateToSave = { video, crop, pattern, resolution };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch {
      // Ignore
    }
  }, [video, crop, pattern, resolution]);

  // Playback timer ticker
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 0.05;
        if (next >= totalDuration) {
          setIsPlaying(false);
          return totalDuration;
        }
        return next;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying, totalDuration]);

  const handleSeek = (time: number) => {
    const clamped = Math.max(0, Math.min(totalDuration, time));
    setCurrentTime(clamped);
  };

  const handleTogglePlay = () => {
    if (currentTime >= totalDuration && totalDuration > 0) {
      setCurrentTime(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleResetProject = () => {
    if (window.confirm('Start a new project? This will clear the active video and generated outputs.')) {
      setVideo(null);
      setGeneratedResult(null);
      setCrop(defaultCrop);
      setPattern(defaultPattern);
      setCurrentTime(0);
      setIsPlaying(false);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // 1-Click Demo Clip Loader
  const handleLoadDemoClip = async () => {
    setIsLoadingDemo(true);
    try {
      const samples = await mediaService.loadSampleMedia();
      if (samples.video) {
        setVideo(samples.video);
        setGeneratedResult(null);
        setCurrentTime(0);
        setIsPlaying(false);
      }
    } catch (err: any) {
      alert(`Could not load demo video: ${err.message}`);
    } finally {
      setIsLoadingDemo(false);
    }
  };

  // Trigger Video Generation
  const handleGenerateVideo = async () => {
    if (!video) {
      alert('Please upload a video first.');
      return;
    }

    setIsPlaying(false);
    setIsExportModalOpen(true);
    setExportProgress({
      status: 'preparing',
      percent: 5,
      message: `Applying ${pattern.mode.toUpperCase()} cut pattern and encoding ${resolution}...`,
    });

    try {
      const result = await mediaService.exportProject(
        {
          video,
          crop,
          pattern,
          resolution,
        },
        (progress) => {
          setExportProgress(progress);
        }
      );

      if (result.success && result.outputUrl) {
        // Calculate output duration
        let outputDur = video.duration;
        let cutsCount = 0;
        if (pattern.mode !== 'none') {
          const keepDur = 2;
          const cutDur = 4;
          let isKeep = pattern.mode === '2:4';
          let t = 0;
          let kept = 0;
          while (t < video.duration) {
            const dur = isKeep ? keepDur : cutDur;
            const nextT = Math.min(t + dur, video.duration);
            if (isKeep) {
              kept += nextT - t;
            } else {
              cutsCount++;
            }
            t = nextT;
            isKeep = !isKeep;
          }
          outputDur = kept;
        }

        const processed: ProcessedVideoResult = {
          url: result.outputUrl,
          outputPath: result.outputPath,
          duration: outputDur,
          resolution,
          pattern: pattern.mode,
          stats: {
            originalDuration: video.duration,
            newDuration: outputDur,
            cutsCount,
            timeSaved: Math.max(0, video.duration - outputDur),
          },
        };

        setGeneratedResult(processed);
        setIsExportModalOpen(false);
      }
    } catch (err: any) {
      setExportProgress({
        status: 'error',
        percent: 0,
        message: 'FFmpeg processing failed.',
        error: err.message || 'An unexpected error occurred.',
      });
    }
  };

  const isExporting = exportProgress.status === 'exporting' || exportProgress.status === 'preparing';

  // Auth Checking Loading Screen
  if (isAuthChecking) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 select-none">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
        <p className="text-xs text-slate-400 font-mono tracking-wide">Validating session...</p>
      </div>
    );
  }

  // Not authenticated or not unlocked with password -> Show Login Screen
  if (!authUser) {
    return <LoginScreen onAuthenticated={(user) => setAuthUser(user)} />;
  }

  return (
    <div id="cut-and-crop-app" className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Navigation Header */}
      <Header
        onResetProject={handleResetProject}
        onLoadDemoClip={handleLoadDemoClip}
        hasVideo={Boolean(video)}
        isProcessing={isExporting || isLoadingDemo}
        videoName={video?.name}
        currentUser={authUser}
        onOpenAdmin={() => setShowAdminDashboard(true)}
        onSignOut={handleSignOut}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {/* CASE 1: Video NOT yet uploaded -> Show Upload Hero with 2:4 & 4:2 introduction */}
        {!video ? (
          <UploadHero
            onVideoUploaded={(uploadedVideo) => {
              setVideo(uploadedVideo);
              setGeneratedResult(null);
              setCurrentTime(0);
            }}
            onLoadDemo={handleLoadDemoClip}
            isLoading={isLoadingDemo}
          />
        ) : generatedResult ? (
          /* CASE 2: Video has been generated -> Show Generated Video View with Multi-Quality Downloads */
          <div className="flex-1 overflow-y-auto">
            <GeneratedVideoView
              result={generatedResult}
              originalVideoUrl={video.url}
              originalVideoName={video.name}
              onEditAgain={() => setGeneratedResult(null)}
            />
          </div>
        ) : (
          /* CASE 3: Video is uploaded and in Editor workspace */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Top Workspace Area */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
              {/* Center / Left: Pattern Options & Preview Player */}
              <div className="flex-1 flex flex-col min-w-0 overflow-y-auto p-4 space-y-4">
                {/* Step 1: The 2:4 vs 4:2 Rhythm Options */}
                <PatternSelector
                  pattern={pattern}
                  onChangePattern={setPattern}
                  videoDuration={totalDuration}
                />

                {/* Step 2: Interactive Video Preview Player with Crop Handles */}
                <div className="flex-1 min-h-[360px] flex flex-col">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono">
                    Step 2: Preview & Visual Crop
                  </h3>
                  <div className="flex-1 min-h-0">
                    <PreviewPlayer
                      video={video}
                      images={[]}
                      audio={null}
                      crop={crop}
                      duplicateFillAudio={false}
                      onUpdateCrop={(newCrop) => setCrop((prev) => ({ ...prev, ...newCrop }))}
                      currentTime={currentTime}
                      onSeek={handleSeek}
                      isPlaying={isPlaying}
                      onTogglePlay={handleTogglePlay}
                      totalDuration={totalDuration}
                    />
                  </div>
                </div>
              </div>

              {/* Right: Controls & Generate Button */}
              <PropertiesPanel
                video={video}
                crop={crop}
                pattern={pattern}
                resolution={resolution}
                onUpdateCrop={(newCrop) => setCrop((prev) => ({ ...prev, ...newCrop }))}
                onChangePattern={setPattern}
                onChangeResolution={setResolution}
                onExportVideo={handleGenerateVideo}
                isExporting={isExporting}
              />
            </div>

            {/* Bottom: Timeline with rhythmic cut visualization */}
            <Timeline
              video={video}
              images={[]}
              audio={null}
              pattern={pattern}
              currentTime={currentTime}
              totalDuration={totalDuration}
              onSeek={handleSeek}
            />
          </div>
        )}
      </main>

      {/* Export Progress Modal */}
      <ExportModal
        progress={exportProgress}
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onOpenFolder={() => {
          if (exportProgress.outputPath || exportProgress.outputUrl) {
            mediaService.openOutputFolder(exportProgress.outputPath || '', exportProgress.outputUrl);
          }
        }}
        onExportAgain={() => {
          setIsExportModalOpen(false);
          setTimeout(() => handleGenerateVideo(), 100);
        }}
      />

      {/* Admin Access & User Management Dashboard */}
      {showAdminDashboard && authUser && (
        <AdminDashboard
          currentUser={authUser}
          onClose={() => setShowAdminDashboard(false)}
        />
      )}
    </div>
  );
}
