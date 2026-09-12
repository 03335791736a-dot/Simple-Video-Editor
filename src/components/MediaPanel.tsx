import React, { useState } from 'react';
import { Video, Image as ImageIcon, Music, Trash2, ArrowUp, ArrowDown, Clock, Check, Layers, AlertCircle } from 'lucide-react';
import { AudioAsset, ImageAsset, VideoAsset } from '../types/editor';
import { mediaService } from '../services/mediaService';

interface MediaPanelProps {
  video: VideoAsset | null;
  images: ImageAsset[];
  audio: AudioAsset | null;
  selectedImageId: string | null;
  onSetVideo: (video: VideoAsset | null) => void;
  onSetImages: (images: ImageAsset[]) => void;
  onSetAudio: (audio: AudioAsset | null) => void;
  onSelectImage: (id: string | null) => void;
}

export const MediaPanel: React.FC<MediaPanelProps> = ({
  video,
  images,
  audio,
  selectedImageId,
  onSetVideo,
  onSetImages,
  onSetAudio,
  onSelectImage,
}) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Helper formatting seconds to MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Import Video Handler
  const handleImportVideo = async () => {
    setLoading('video');
    setErrorMessage(null);
    try {
      const importedVideo = await mediaService.importVideo();
      if (importedVideo) {
        onSetVideo(importedVideo);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not read this video.');
    } finally {
      setLoading(null);
    }
  };

  // Import Images Handler
  const handleImportImages = async () => {
    setLoading('images');
    setErrorMessage(null);
    try {
      const newImages = await mediaService.importImages();
      if (newImages.length > 0) {
        onSetImages([...images, ...newImages]);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not read images.');
    } finally {
      setLoading(null);
    }
  };

  // Import Audio Handler
  const handleImportAudio = async () => {
    setLoading('audio');
    setErrorMessage(null);
    try {
      const importedAudio = await mediaService.importAudio();
      if (importedAudio) {
        onSetAudio(importedAudio);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Audio could not be loaded.');
    } finally {
      setLoading(null);
    }
  };

  // Image duration changer
  const handleDurationChange = (id: string, newDuration: number) => {
    const validDuration = Math.max(0.5, Math.min(60, newDuration));
    onSetImages(
      images.map((img) => (img.id === id ? { ...img, duration: validDuration } : img))
    );
  };

  // Image reorder: move up
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const reordered = [...images];
    const temp = reordered[index - 1];
    reordered[index - 1] = reordered[index];
    reordered[index] = temp;
    onSetImages(reordered);
  };

  // Image reorder: move down
  const handleMoveDown = (index: number) => {
    if (index >= images.length - 1) return;
    const reordered = [...images];
    const temp = reordered[index + 1];
    reordered[index + 1] = reordered[index];
    reordered[index] = temp;
    onSetImages(reordered);
  };

  // Delete image
  const handleDeleteImage = (id: string) => {
    const filtered = images.filter((img) => img.id !== id);
    onSetImages(filtered);
    if (selectedImageId === id) {
      onSelectImage(null);
    }
  };

  // Total slideshow duration
  const totalSlideshowDuration = images.reduce((acc, img) => acc + (img.duration || 3), 0);

  return (
    <aside id="media-panel" className="w-80 bg-slate-900/95 border-r border-slate-800 flex flex-col h-full shrink-0 overflow-hidden">
      {/* Panel Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span>Media Assets</span>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">
          {video ? '1 Video' : `${images.length} Images`} • {audio ? '1 Audio' : 'No Audio'}
        </span>
      </div>

      {/* Error alert if any */}
      {errorMessage && (
        <div className="m-3 p-2.5 bg-rose-950/60 border border-rose-800/60 rounded-md flex items-start gap-2 text-rose-200 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p>{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-200 text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Import Action Buttons */}
      <div className="p-3 grid grid-cols-3 gap-2 border-b border-slate-800 bg-slate-950/40">
        <button
          id="btn-import-video"
          onClick={handleImportVideo}
          disabled={Boolean(loading)}
          className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-indigo-500/50 transition-all text-center gap-1.5 shadow-sm group disabled:opacity-50"
          title="Import MP4, MOV, MKV, AVI, WEBM"
        >
          <div className="w-8 h-8 rounded-md bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-colors">
            <Video className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-medium leading-tight">Import Video</span>
        </button>

        <button
          id="btn-import-images"
          onClick={handleImportImages}
          disabled={Boolean(loading)}
          className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-emerald-500/50 transition-all text-center gap-1.5 shadow-sm group disabled:opacity-50"
          title="Import JPG, PNG, WEBP, BMP"
        >
          <div className="w-8 h-8 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors">
            <ImageIcon className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-medium leading-tight">Import Images</span>
        </button>

        <button
          id="btn-import-audio"
          onClick={handleImportAudio}
          disabled={Boolean(loading)}
          className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-amber-500/50 transition-all text-center gap-1.5 shadow-sm group disabled:opacity-50"
          title="Import MP3, WAV, M4A, AAC, FLAC, OGG"
        >
          <div className="w-8 h-8 rounded-md bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-colors">
            <Music className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-medium leading-tight">Import Audio</span>
        </button>
      </div>

      {/* Scrollable Media List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* VIDEO SECTION */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Video Source</span>
            {video && (
              <button
                id="btn-remove-video"
                onClick={() => onSetVideo(null)}
                className="text-[11px] text-rose-400 hover:text-rose-300 hover:underline"
              >
                Remove
              </button>
            )}
          </div>

          {video ? (
            <div id="video-asset-card" className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700 hover:border-indigo-500/40 transition-all space-y-2">
              <div className="relative aspect-video rounded-md overflow-hidden bg-black flex items-center justify-center border border-slate-700/60">
                {video.thumbnailUrl ? (
                  <img src={video.thumbnailUrl} alt={video.name} className="w-full h-full object-cover" />
                ) : (
                  <video src={video.url} className="w-full h-full object-cover" muted preload="metadata" />
                )}
                <span className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-mono text-white">
                  {formatDuration(video.duration)}
                </span>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-200 truncate" title={video.name}>
                  {video.name}
                </p>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 font-mono">
                  <span>{video.width} × {video.height}</span>
                  <span>{video.duration.toFixed(1)}s</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-lg border border-dashed border-slate-800 bg-slate-950/20 text-center text-slate-500 text-xs">
              No video imported. Click "Import Video" or use images below.
            </div>
          )}
        </div>

        {/* IMAGES SECTION */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Image Slideshow</span>
              {images.length > 0 && (
                <span className="text-[11px] text-emerald-400 font-mono">
                  ({images.length} items • {totalSlideshowDuration.toFixed(1)}s)
                </span>
              )}
            </div>
            {images.length > 0 && (
              <button
                id="btn-clear-images"
                onClick={() => onSetImages([])}
                className="text-[11px] text-rose-400 hover:text-rose-300 hover:underline"
              >
                Clear all
              </button>
            )}
          </div>

          {images.length > 0 ? (
            <div className="space-y-2">
              {images.map((img, index) => {
                const isSelected = selectedImageId === img.id;
                return (
                  <div
                    key={img.id}
                    id={`image-item-${index}`}
                    onClick={() => onSelectImage(img.id)}
                    className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center gap-2.5 ${
                      isSelected
                        ? 'bg-emerald-950/30 border-emerald-500/60 shadow-sm'
                        : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    {/* Index & Thumbnail */}
                    <div className="relative w-14 h-11 rounded bg-black/60 shrink-0 overflow-hidden border border-slate-700/60">
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                      <span className="absolute top-0.5 left-0.5 bg-black/75 px-1 rounded text-[9px] font-bold text-white">
                        #{index + 1}
                      </span>
                    </div>

                    {/* Meta & Duration Input */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-200 truncate" title={img.name}>
                        {img.name}
                      </p>

                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex items-center gap-1 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-700/60 text-[11px] text-slate-300">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <input
                            id={`input-duration-${index}`}
                            type="number"
                            min="0.5"
                            max="60"
                            step="0.5"
                            value={img.duration}
                            onChange={(e) => handleDurationChange(img.id, parseFloat(e.target.value) || 1)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-9 bg-transparent text-center font-mono text-xs focus:outline-none focus:text-emerald-400"
                          />
                          <span className="text-[10px] text-slate-400">sec</span>
                        </div>

                        {img.width && img.height && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            {img.width}x{img.height}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions: Move Up, Down, Delete */}
                    <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30"
                          title="Move earlier in slideshow"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleMoveDown(index)}
                          disabled={index === images.length - 1}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30"
                          title="Move later in slideshow"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => handleDeleteImage(img.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-700 self-end"
                        title="Delete image"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 rounded-lg border border-dashed border-slate-800 bg-slate-950/20 text-center text-slate-500 text-xs">
              No images imported. Import images to create a slideshow.
            </div>
          )}
        </div>

        {/* AUDIO SECTION */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Audio Track</span>
            {audio && (
              <button
                id="btn-remove-audio"
                onClick={() => onSetAudio(null)}
                className="text-[11px] text-rose-400 hover:text-rose-300 hover:underline"
              >
                Remove
              </button>
            )}
          </div>

          {audio ? (
            <div id="audio-asset-card" className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700 hover:border-amber-500/40 transition-all flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-md bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                  <Music className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-200 truncate" title={audio.name}>
                    {audio.name}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Duration: {formatDuration(audio.duration)} ({audio.duration.toFixed(1)}s)
                  </p>
                </div>
              </div>

              <button
                id="btn-replace-audio"
                onClick={handleImportAudio}
                className="px-2 py-1 text-[11px] font-medium rounded bg-slate-700 hover:bg-slate-600 text-slate-200 shrink-0"
              >
                Replace
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-lg border border-dashed border-slate-800 bg-slate-950/20 text-center text-slate-500 text-xs">
              No audio imported. Click "Import Audio" to add background music or voiceover.
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
