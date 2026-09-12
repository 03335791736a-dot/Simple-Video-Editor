import { AudioAsset, CropSettings, ExportProgress, ExportResolution, ImageAsset, PatternSettings, VideoAsset } from '../types/editor';
import { webFfmpegService } from './webFfmpegService';

// Open browser file selector
export const selectFilesFromBrowser = (accept: string, multiple = false): Promise<File[]> => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = 'none';

    input.onchange = () => {
      const files = Array.from(input.files || []);
      try {
        document.body.removeChild(input);
      } catch {
        // Ignore
      }
      resolve(files);
    };

    input.oncancel = () => {
      try {
        document.body.removeChild(input);
      } catch {
        // Ignore
      }
      resolve([]);
    };

    document.body.appendChild(input);
    input.click();
  });
};

export const mediaService = {
  // Import Video locally in browser without uploading to any cloud or server
  async importVideo(): Promise<VideoAsset | null> {
    const files = await selectFilesFromBrowser('.mp4,.mov,.webm,.mkv,.avi,video/*');
    if (files.length === 0) return null;

    const file = files[0];
    const objectUrl = URL.createObjectURL(file);

    try {
      const probe = await webFfmpegService.probeVideo(file);

      return {
        id: `vid-${Date.now()}`,
        name: file.name,
        path: file.name,
        url: objectUrl,
        file,
        duration: probe.duration || 1,
        width: probe.width || 1920,
        height: probe.height || 1080,
        size: file.size,
        format: probe.format || file.type,
      };
    } catch (err: any) {
      // If probe fails, fallback with standard defaults
      console.warn('Metadata probe warning:', err);
      return {
        id: `vid-${Date.now()}`,
        name: file.name,
        path: file.name,
        url: objectUrl,
        file,
        duration: 10,
        width: 1920,
        height: 1080,
        size: file.size,
        format: file.type,
      };
    }
  },

  // Import Multiple Images locally in browser
  async importImages(): Promise<ImageAsset[]> {
    const files = await selectFilesFromBrowser('.jpg,.jpeg,.png,.webp,.bmp,image/*', true);
    if (files.length === 0) return [];

    const results: ImageAsset[] = [];
    for (const file of files) {
      const objectUrl = URL.createObjectURL(file);
      let width = 1920;
      let height = 1080;

      try {
        const dimensions = await webFfmpegService.probeImage(file);
        width = dimensions.width;
        height = dimensions.height;
      } catch {
        // Default
      }

      results.push({
        id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: file.name,
        path: file.name,
        url: objectUrl,
        file,
        duration: 3,
        width,
        height,
        size: file.size,
      });
    }

    return results;
  },

  // Import Audio track locally in browser
  async importAudio(): Promise<AudioAsset | null> {
    const files = await selectFilesFromBrowser('.mp3,.wav,.m4a,.aac,.flac,.ogg,audio/*');
    if (files.length === 0) return null;

    const file = files[0];
    const objectUrl = URL.createObjectURL(file);

    try {
      const probe = await webFfmpegService.probeAudio(file);
      return {
        id: `aud-${Date.now()}`,
        name: file.name,
        path: file.name,
        url: objectUrl,
        file,
        duration: probe.duration || 1,
        size: file.size,
        format: probe.format || file.type,
      };
    } catch {
      return {
        id: `aud-${Date.now()}`,
        name: file.name,
        path: file.name,
        url: objectUrl,
        file,
        duration: 30,
        size: file.size,
        format: file.type,
      };
    }
  },

  // Export Project with Pattern (2:4 or 4:2), Crop, and Multi-resolution directly in browser
  async exportProject(
    payload: {
      video: VideoAsset | null;
      images?: ImageAsset[];
      audio?: AudioAsset | null;
      crop: CropSettings;
      pattern?: PatternSettings;
      resolution: ExportResolution;
      duplicateFillAudio?: boolean;
    },
    onProgress: (progress: ExportProgress) => void
  ): Promise<{ success: boolean; outputPath: string; outputUrl?: string; blob?: Blob; duration?: number; error?: string }> {
    try {
      // Primary: Browser-native WebAssembly FFmpeg processing (100% local, no server transfer)
      const res = await webFfmpegService.exportProject(payload, onProgress);
      return {
        success: true,
        outputPath: res.outputPath,
        outputUrl: res.outputUrl,
        blob: res.blob,
        duration: res.duration,
      };
    } catch (err: any) {
      console.warn('Browser WebAssembly export encountered error, checking fallback...', err);

      // Graceful fallback to server endpoint if WASM memory is constrained on very low-end device
      try {
        onProgress({
          status: 'exporting',
          percent: 45,
          message: 'Processing media encoding...',
          resolution: payload.resolution,
        });

        // If local video has a file, upload to local express instance
        let videoPath = payload.video?.path;
        if (payload.video?.file) {
          const formData = new FormData();
          formData.append('files', payload.video.file);
          const upRes = await fetch('/api/upload', { method: 'POST', body: formData });
          if (upRes.ok) {
            const data = await upRes.json();
            if (data.files?.[0]) {
              videoPath = data.files[0].path;
            }
          }
        }

        const fallbackOptions = {
          videoPath,
          crop: payload.crop.enabled ? payload.crop : undefined,
          pattern: payload.pattern,
          resolution: payload.resolution,
          outputPath: '',
        };

        const response = await fetch('/api/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fallbackOptions),
        });

        if (response.ok) {
          const { jobId } = await response.json();
          return new Promise((resolve) => {
            const poll = setInterval(async () => {
              try {
                const s = await fetch(`/api/export/progress/${jobId}`);
                if (!s.ok) return;
                const job = await s.json();
                onProgress({
                  status: job.status,
                  percent: job.percent,
                  message: job.message,
                  outputPath: job.outputPath,
                  outputUrl: job.outputUrl,
                  resolution: payload.resolution,
                });
                if (job.status === 'completed') {
                  clearInterval(poll);
                  resolve({ success: true, outputPath: job.outputPath, outputUrl: job.outputUrl });
                } else if (job.status === 'error') {
                  clearInterval(poll);
                  resolve({ success: false, outputPath: '', error: job.error });
                }
              } catch {
                clearInterval(poll);
                resolve({ success: false, outputPath: '', error: 'Export communication failed' });
              }
            }, 500);
          });
        }
      } catch (fallbackErr: any) {
        // Ignore fallback error and return original
      }

      return {
        success: false,
        outputPath: '',
        error: err.message || 'Export failed.',
      };
    }
  },

  // Transcode quality on demand directly in browser
  async transcodeQuality(
    inputUrlOrBlob: string | Blob,
    targetResolution: ExportResolution,
    _inputPath?: string
  ): Promise<{ url: string; size?: number; path?: string }> {
    try {
      const res = await webFfmpegService.transcodeQuality(inputUrlOrBlob, targetResolution);
      return {
        url: res.url,
        size: res.size,
        path: `CutAndCrop_${targetResolution}.mp4`,
      };
    } catch {
      // Fallback via server if needed
      const res = await fetch('/api/transcode-quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputUrl: typeof inputUrlOrBlob === 'string' ? inputUrlOrBlob : '', targetResolution }),
      });
      if (!res.ok) {
        throw new Error('Failed transcoding to target resolution');
      }
      return await res.json();
    }
  },

  // Download video file directly in browser
  async openOutputFolder(filePath: string, outputUrl?: string): Promise<void> {
    if (outputUrl) {
      const a = document.createElement('a');
      a.href = outputUrl;
      a.download = filePath.split(/[/\\]/).pop() || 'CutAndCrop_Export.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  },

  // Load sample test video & audio for instant 1-click testing (100% browser-generated)
  async loadSampleMedia(): Promise<{
    video: VideoAsset;
    audio: AudioAsset;
    images: ImageAsset[];
  }> {
    try {
      // Try local in-browser synthetic generation
      const demo = await webFfmpegService.generateLocalDemoVideo();
      return {
        video: demo.video,
        audio: demo.audio,
        images: [],
      };
    } catch (err) {
      console.warn('Local demo generator fallback to server sample:', err);
      const res = await fetch('/api/samples/create', { method: 'POST' });
      if (!res.ok) {
        throw new Error('Failed to generate sample media clips.');
      }
      const data = await res.json();
      return {
        video: data.video,
        audio: data.audio,
        images: data.images || [],
      };
    }
  },

  // Clean up object URLs to free memory
  cleanup() {
    webFfmpegService.revokeTrackedUrls();
  },
};
