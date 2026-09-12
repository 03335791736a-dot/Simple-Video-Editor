import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, Crop as CropIcon } from 'lucide-react';
import { AudioAsset, CropSettings, ImageAsset, VideoAsset } from '../types/editor';

interface PreviewPlayerProps {
  video: VideoAsset | null;
  images: ImageAsset[];
  audio: AudioAsset | null;
  crop: CropSettings;
  duplicateFillAudio: boolean;
  onUpdateCrop: (crop: Partial<CropSettings>) => void;
  currentTime: number;
  onSeek: (time: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  totalDuration: number;
}

export const PreviewPlayer: React.FC<PreviewPlayerProps> = ({
  video,
  images,
  audio,
  crop,
  duplicateFillAudio,
  onUpdateCrop,
  currentTime,
  onSeek,
  isPlaying,
  onTogglePlay,
  totalDuration,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [activeDrag, setActiveDrag] = useState<string | null>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; cropX: number; cropY: number; cropW: number; cropH: number }>({
    startX: 0,
    startY: 0,
    cropX: 0,
    cropY: 0,
    cropW: 0,
    cropH: 0,
  });

  // Calculate visual content duration
  const visualDuration = video
    ? video.duration || 1
    : images.reduce((sum, img) => sum + (img.duration || 3), 0);

  // Determine current image for slideshow
  const getCurrentImage = useCallback((): ImageAsset | null => {
    if (images.length === 0) return null;
    if (visualDuration <= 0) return images[0];

    // Handle looping if duplicateFillAudio is active
    let effectiveTime = currentTime;
    if (duplicateFillAudio && currentTime > visualDuration) {
      effectiveTime = currentTime % visualDuration;
    }

    let accumulated = 0;
    for (const img of images) {
      const dur = img.duration || 3;
      if (effectiveTime >= accumulated && effectiveTime < accumulated + dur) {
        return img;
      }
      accumulated += dur;
    }
    return images[images.length - 1];
  }, [images, visualDuration, currentTime, duplicateFillAudio]);

  const currentImage = getCurrentImage();

  // Sync video time with currentTime
  useEffect(() => {
    if (!videoRef.current || !video) return;

    let targetVideoTime = currentTime;
    if (duplicateFillAudio && currentTime > video.duration) {
      targetVideoTime = currentTime % video.duration;
    }

    if (Math.abs(videoRef.current.currentTime - targetVideoTime) > 0.3) {
      videoRef.current.currentTime = targetVideoTime;
    }
  }, [currentTime, video, duplicateFillAudio]);

  // Sync audio time with currentTime
  useEffect(() => {
    if (!audioRef.current || !audio) return;
    if (Math.abs(audioRef.current.currentTime - currentTime) > 0.3) {
      audioRef.current.currentTime = currentTime;
    }
  }, [currentTime, audio]);

  // Sync playback states
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }

    if (audioRef.current && audio) {
      if (isPlaying) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, audio]);

  // Handle Mute & Volume
  useEffect(() => {
    if (videoRef.current) {
      // If separate audio track is present, mute the video's original audio
      videoRef.current.muted = isMuted || Boolean(audio);
      videoRef.current.volume = volume;
    }
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
      audioRef.current.volume = volume;
    }
  }, [isMuted, volume, audio]);

  // Time format helper (MM:SS)
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Drag & Crop Interaction logic
  const handleMouseDown = (e: React.MouseEvent, type: string) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveDrag(type);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      cropX: crop.x,
      cropY: crop.y,
      cropW: crop.width,
      cropH: crop.height,
    };
  };

  useEffect(() => {
    if (!activeDrag) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const deltaXPercent = ((e.clientX - dragStartRef.current.startX) / rect.width) * 100;
      const deltaYPercent = ((e.clientY - dragStartRef.current.startY) / rect.height) * 100;

      const { cropX, cropY, cropW, cropH } = dragStartRef.current;

      if (activeDrag === 'move') {
        const newX = Math.max(0, Math.min(100 - cropW, cropX + deltaXPercent));
        const newY = Math.max(0, Math.min(100 - cropH, cropY + deltaYPercent));
        onUpdateCrop({ x: Math.round(newX), y: Math.round(newY) });
      } else if (activeDrag === 'se') {
        let newW = Math.max(10, Math.min(100 - cropX, cropW + deltaXPercent));
        let newH = Math.max(10, Math.min(100 - cropY, cropH + deltaYPercent));

        if (crop.aspectRatio === '16:9') {
          newH = (newW * 9) / 16;
        } else if (crop.aspectRatio === '9:16') {
          newH = (newW * 16) / 9;
        } else if (crop.aspectRatio === '1:1') {
          newH = newW;
        }

        if (cropY + newH <= 100 && cropX + newW <= 100) {
          onUpdateCrop({ width: Math.round(newW), height: Math.round(newH) });
        }
      } else if (activeDrag === 'sw') {
        let newW = Math.max(10, Math.min(cropX + cropW, cropW - deltaXPercent));
        let newX = cropX + cropW - newW;
        let newH = Math.max(10, Math.min(100 - cropY, cropH + deltaYPercent));

        if (crop.aspectRatio === '16:9') newH = (newW * 9) / 16;
        else if (crop.aspectRatio === '9:16') newH = (newW * 16) / 9;
        else if (crop.aspectRatio === '1:1') newH = newW;

        if (cropY + newH <= 100 && newX >= 0) {
          onUpdateCrop({ x: Math.round(newX), width: Math.round(newW), height: Math.round(newH) });
        }
      } else if (activeDrag === 'ne') {
        let newW = Math.max(10, Math.min(100 - cropX, cropW + deltaXPercent));
        let newH = Math.max(10, Math.min(cropY + cropH, cropH - deltaYPercent));
        let newY = cropY + cropH - newH;

        if (crop.aspectRatio === '16:9') newH = (newW * 9) / 16;
        else if (crop.aspectRatio === '9:16') newH = (newW * 16) / 9;
        else if (crop.aspectRatio === '1:1') newH = newW;

        if (newY >= 0 && cropX + newW <= 100) {
          onUpdateCrop({ y: Math.round(newY), width: Math.round(newW), height: Math.round(newH) });
        }
      }
    };

    const handleMouseUp = () => {
      setActiveDrag(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeDrag, crop, onUpdateCrop]);

  const hasMedia = Boolean(video || images.length > 0);

  return (
    <div id="preview-player-container" className="flex-1 flex flex-col bg-slate-950 overflow-hidden relative select-none">
      {/* Viewport Area */}
      <div className="flex-1 flex items-center justify-center p-4 min-h-0 relative">
        {hasMedia ? (
          <div
            ref={containerRef}
            id="video-viewport"
            className="relative max-w-full max-h-full aspect-video bg-black rounded-lg shadow-2xl overflow-hidden border border-slate-800 flex items-center justify-center"
            style={{ width: '100%', maxWidth: '850px' }}
          >
            {/* Visual Content: Video or Current Image */}
            {video ? (
              <video
                ref={videoRef}
                id="main-video-element"
                src={video.url}
                className="w-full h-full object-contain pointer-events-none"
                playsInline
              />
            ) : currentImage ? (
              <img
                id="slideshow-image-element"
                src={currentImage.url}
                alt={currentImage.name}
                className="w-full h-full object-contain pointer-events-none transition-opacity duration-150"
              />
            ) : null}

            {/* Synchronized Audio element */}
            {audio && (
              <audio
                ref={audioRef}
                id="main-audio-element"
                src={audio.url}
                preload="auto"
              />
            )}

            {/* Crop Overlay */}
            {crop.enabled && (
              <div
                id="crop-bounding-box"
                style={{
                  left: `${crop.x}%`,
                  top: `${crop.y}%`,
                  width: `${crop.width}%`,
                  height: `${crop.height}%`,
                }}
                className="absolute border-2 border-indigo-400 bg-indigo-500/15 cursor-move z-20 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]"
                onMouseDown={(e) => handleMouseDown(e, 'move')}
              >
                {/* Aspect ratio label */}
                <span className="absolute top-1 left-1.5 bg-indigo-600/90 text-white font-mono text-[10px] px-1 rounded uppercase">
                  {crop.aspectRatio} Crop
                </span>

                {/* Corner Resizing Handles */}
                <div
                  className="w-3 h-3 bg-white border border-indigo-600 absolute -top-1.5 -left-1.5 cursor-nwse-resize rounded-sm"
                  onMouseDown={(e) => handleMouseDown(e, 'nw')}
                />
                <div
                  className="w-3 h-3 bg-white border border-indigo-600 absolute -top-1.5 -right-1.5 cursor-nesw-resize rounded-sm"
                  onMouseDown={(e) => handleMouseDown(e, 'ne')}
                />
                <div
                  className="w-3 h-3 bg-white border border-indigo-600 absolute -bottom-1.5 -left-1.5 cursor-nesw-resize rounded-sm"
                  onMouseDown={(e) => handleMouseDown(e, 'sw')}
                />
                <div
                  className="w-3 h-3 bg-white border border-indigo-600 absolute -bottom-1.5 -right-1.5 cursor-nwse-resize rounded-sm"
                  onMouseDown={(e) => handleMouseDown(e, 'se')}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-500 space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
              <Play className="w-8 h-8 ml-1" />
            </div>
            <p className="text-sm font-medium text-slate-400">Import a video or images to begin preview</p>
            <p className="text-xs text-slate-600 max-w-sm text-center">
              All editing, slideshow compilation, cropping, and audio synchronization happens locally and offline.
            </p>
          </div>
        )}
      </div>

      {/* Playback Control Bar */}
      <div className="h-14 bg-slate-900/90 border-t border-slate-800 px-4 flex items-center justify-between gap-4 shrink-0">
        {/* Play/Pause & Reset */}
        <div className="flex items-center gap-2">
          <button
            id="btn-play-pause"
            onClick={onTogglePlay}
            disabled={!hasMedia}
            className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-colors disabled:opacity-40 disabled:pointer-events-none shadow-md shadow-indigo-600/20"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <button
            id="btn-restart"
            onClick={() => onSeek(0)}
            disabled={!hasMedia}
            className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40"
            title="Return to start"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Scrubber & Timestamps */}
        <div className="flex-1 flex items-center gap-3 max-w-2xl">
          <span className="text-xs font-mono text-slate-300 min-w-[42px] text-right">
            {formatTime(currentTime)}
          </span>

          <input
            id="playback-scrubber"
            type="range"
            min="0"
            max={totalDuration || 1}
            step="0.1"
            value={currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value) || 0)}
            disabled={!hasMedia}
            className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-40"
          />

          <span className="text-xs font-mono text-slate-400 min-w-[42px]">
            {formatTime(totalDuration)}
          </span>
        </div>

        {/* Volume & Crop Toggle */}
        <div className="flex items-center gap-2">
          <button
            id="btn-toggle-crop-overlay"
            onClick={() => onUpdateCrop({ enabled: !crop.enabled })}
            disabled={!hasMedia}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border transition-colors disabled:opacity-40 ${
              crop.enabled
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Toggle Visual Crop Guide"
          >
            <CropIcon className="w-3.5 h-3.5" />
            <span>{crop.enabled ? 'Crop Active' : 'Crop'}</span>
          </button>

          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-1 rounded border border-slate-700/60">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="text-slate-400 hover:text-white"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value));
                if (isMuted) setIsMuted(false);
              }}
              className="w-16 h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
