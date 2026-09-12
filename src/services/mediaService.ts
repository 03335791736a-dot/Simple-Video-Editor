import { AudioAsset, CropSettings, ExportProgress, ExportResolution, ImageAsset, PatternSettings, VideoAsset } from '../types/editor';
import { ExportJobOptions } from '../types/electron';

// Helper to check if running in Electron environment
export const isElectronEnv = (): boolean => {
  return typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);
};

// Open file selector in browser
const selectFilesFromBrowser = (accept: string, multiple = false): Promise<File[]> => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = 'none';

    input.onchange = () => {
      const files = Array.from(input.files || []);
      document.body.removeChild(input);
      resolve(files);
    };

    input.oncancel = () => {
      document.body.removeChild(input);
      resolve([]);
    };

    document.body.appendChild(input);
    input.click();
  });
};

// Upload files to Express server in web mode
const uploadFilesToServer = async (files: File[]) => {
  const formData = new FormData();
  files.forEach((f) => formData.append('files', f));

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to upload and process media');
  }

  const data = await response.json();
  return data.files;
};

export const mediaService = {
  // Import Video
  async importVideo(): Promise<VideoAsset | null> {
    if (isElectronEnv() && window.electronAPI) {
      const dialogRes = await window.electronAPI.openVideoDialog();
      if (dialogRes.canceled || !dialogRes.filePath) return null;

      const filePath = dialogRes.filePath;
      const fileName = filePath.split(/[/\\]/).pop() || 'video.mp4';
      const probe = await window.electronAPI.probeMedia(filePath);

      return {
        id: `vid-${Date.now()}`,
        name: fileName,
        path: filePath,
        url: `file://${filePath.replace(/\\/g, '/')}`,
        duration: probe.duration || 1,
        width: probe.width || 1920,
        height: probe.height || 1080,
        size: probe.size,
        format: probe.format,
      };
    }

    // Web Mode
    const files = await selectFilesFromBrowser('.mp4,.mov,.mkv,.avi,.webm');
    if (files.length === 0) return null;

    const uploaded = await uploadFilesToServer([files[0]]);
    if (uploaded.length === 0) return null;

    const file = uploaded[0];
    return {
      id: file.id,
      name: file.name,
      path: file.path,
      url: file.url,
      duration: file.duration || 1,
      width: file.width || 1920,
      height: file.height || 1080,
      thumbnailUrl: file.thumbnailUrl,
      size: file.size,
    };
  },

  // Import Multiple Images
  async importImages(): Promise<ImageAsset[]> {
    if (isElectronEnv() && window.electronAPI) {
      const dialogRes = await window.electronAPI.openImagesDialog();
      if (dialogRes.canceled || !dialogRes.filePaths || dialogRes.filePaths.length === 0) {
        return [];
      }

      const results: ImageAsset[] = [];
      for (const filePath of dialogRes.filePaths) {
        const fileName = filePath.split(/[/\\]/).pop() || 'image.jpg';
        let width = 1920;
        let height = 1080;
        try {
          const probe = await window.electronAPI.probeMedia(filePath);
          if (probe.width) width = probe.width;
          if (probe.height) height = probe.height;
        } catch {
          // ignore
        }

        results.push({
          id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: fileName,
          path: filePath,
          url: `file://${filePath.replace(/\\/g, '/')}`,
          duration: 3,
          width,
          height,
        });
      }
      return results;
    }

    // Web Fallback
    const files = await selectFilesFromBrowser('.jpg,.jpeg,.png,.webp,.bmp', true);
    if (files.length === 0) return [];

    const uploaded = await uploadFilesToServer(files);
    return uploaded.map((u: any) => ({
      id: u.id,
      name: u.name,
      path: u.path,
      url: u.url,
      duration: 3,
      width: u.width || 1920,
      height: u.height || 1080,
      thumbnailUrl: u.thumbnailUrl,
      size: u.size,
    }));
  },

  // Import Audio
  async importAudio(): Promise<AudioAsset | null> {
    if (isElectronEnv() && window.electronAPI) {
      const dialogRes = await window.electronAPI.openAudioDialog();
      if (dialogRes.canceled || !dialogRes.filePath) return null;

      const filePath = dialogRes.filePath;
      const fileName = filePath.split(/[/\\]/).pop() || 'audio.mp3';
      const probe = await window.electronAPI.probeMedia(filePath);

      return {
        id: `aud-${Date.now()}`,
        name: fileName,
        path: filePath,
        url: `file://${filePath.replace(/\\/g, '/')}`,
        duration: probe.duration || 1,
        size: probe.size,
        format: probe.format,
      };
    }

    // Web Fallback
    const files = await selectFilesFromBrowser('.mp3,.wav,.m4a,.aac,.flac,.ogg');
    if (files.length === 0) return null;

    const uploaded = await uploadFilesToServer([files[0]]);
    if (uploaded.length === 0) return null;

    const file = uploaded[0];
    return {
      id: file.id,
      name: file.name,
      path: file.path,
      url: file.url,
      duration: file.duration || 1,
      size: file.size,
    };
  },

  // Export Project with Pattern (2:4 or 4:2), Crop, and Multi-resolution
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
  ): Promise<{ success: boolean; outputPath: string; outputUrl?: string; error?: string }> {
    onProgress({
      status: 'preparing',
      percent: 5,
      message: 'Preparing timeline and FFmpeg encoding parameters...',
    });

    const options: ExportJobOptions = {
      videoPath: payload.video ? payload.video.path : undefined,
      images: payload.images?.map((img) => ({ path: img.path, duration: img.duration })),
      audioPath: payload.audio ? payload.audio.path : undefined,
      crop: payload.crop.enabled
        ? {
            enabled: true,
            x: payload.crop.x,
            y: payload.crop.y,
            width: payload.crop.width,
            height: payload.crop.height,
          }
        : undefined,
      pattern: payload.pattern,
      resolution: payload.resolution,
      duplicateFillAudio: payload.duplicateFillAudio,
      outputPath: '',
    };

    // If running in Electron
    if (isElectronEnv() && window.electronAPI) {
      const defaultName = `CutAndCrop_${payload.pattern?.mode || 'exported'}_${Date.now()}.mp4`;
      const saveRes = await window.electronAPI.saveVideoDialog(defaultName);
      if (saveRes.canceled || !saveRes.filePath) {
        onProgress({ status: 'idle', percent: 0, message: 'Export cancelled' });
        return { success: false, outputPath: '', error: 'Export cancelled' };
      }

      options.outputPath = saveRes.filePath;

      try {
        const result = await window.electronAPI.exportVideo(options, (p) => {
          onProgress(p);
        });

        if (result.success) {
          onProgress({
            status: 'completed',
            percent: 100,
            message: 'Export completed successfully.',
            outputPath: result.outputPath,
          });
          return { success: true, outputPath: result.outputPath };
        } else {
          onProgress({
            status: 'error',
            percent: 0,
            message: 'FFmpeg processing failed.',
            error: result.error,
          });
          return { success: false, outputPath: '', error: result.error };
        }
      } catch (err: any) {
        onProgress({
          status: 'error',
          percent: 0,
          message: 'Export error occurred.',
          error: err.message,
        });
        return { success: false, outputPath: '', error: err.message };
      }
    }

    // Web Mode: Call Express backend /api/export
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to start export server-side.');
      }

      const { jobId } = await response.json();

      // Poll progress every 350ms
      return new Promise((resolve) => {
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/export/progress/${jobId}`);
            if (!statusRes.ok) return;

            const job = await statusRes.json();
            onProgress({
              status: job.status,
              percent: job.percent,
              message: job.message,
              outputPath: job.outputPath,
              outputUrl: job.outputUrl,
              error: job.error,
              resolution: payload.resolution,
            });

            if (job.status === 'completed') {
              clearInterval(pollInterval);
              resolve({
                success: true,
                outputPath: job.outputPath,
                outputUrl: job.outputUrl,
              });
            } else if (job.status === 'error') {
              clearInterval(pollInterval);
              resolve({
                success: false,
                outputPath: '',
                error: job.error || 'FFmpeg export failed',
              });
            }
          } catch (e: any) {
            clearInterval(pollInterval);
            onProgress({
              status: 'error',
              percent: 0,
              message: 'Failed communicating with export server.',
              error: e.message,
            });
            resolve({ success: false, outputPath: '', error: e.message });
          }
        }, 350);
      });
    } catch (err: any) {
      onProgress({
        status: 'error',
        percent: 0,
        message: 'Could not connect to export service.',
        error: err.message,
      });
      return { success: false, outputPath: '', error: err.message };
    }
  },

  // Transcode generated video to a target quality on demand
  async transcodeQuality(
    inputUrl: string,
    targetResolution: ExportResolution,
    inputPath?: string
  ): Promise<{ url: string; size?: number; path?: string }> {
    const res = await fetch('/api/transcode-quality', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputUrl, inputPath, targetResolution }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed transcoding to target resolution');
    }

    const data = await res.json();
    return {
      url: data.url,
      size: data.size,
      path: data.path,
    };
  },

  // Open Output Folder or Trigger Browser Download
  async openOutputFolder(filePath: string, outputUrl?: string): Promise<void> {
    if (isElectronEnv() && window.electronAPI) {
      await window.electronAPI.openOutputFolder(filePath);
      return;
    }

    // In web mode, download directly
    if (outputUrl) {
      const a = document.createElement('a');
      a.href = outputUrl;
      a.download = outputUrl.split('/').pop() || 'CutAndCrop_Export.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  },

  // Load sample test video & audio for instant 1-click testing
  async loadSampleMedia(): Promise<{
    video: VideoAsset;
    audio: AudioAsset;
    images: ImageAsset[];
  }> {
    const res = await fetch('/api/samples/create', { method: 'POST' });
    if (!res.ok) {
      throw new Error('Failed to generate sample media clips.');
    }
    const data = await res.json();
    return {
      video: data.video,
      audio: data.audio,
      images: data.images,
    };
  },
};
