import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import {
  AudioAsset,
  CropSettings,
  CutSegment,
  ExportProgress,
  ExportResolution,
  ImageAsset,
  PatternSettings,
  VideoAsset,
} from '../types/editor';

// Resolution target scale map
export function getScaleFilter(resolution: ExportResolution): string {
  switch (resolution) {
    case '360p':
      return 'scale=-2:360';
    case '480p':
      return 'scale=-2:480';
    case '720p':
      return 'scale=-2:720';
    case '1080p':
      return 'scale=-2:1080';
    case '1440p':
      return 'scale=-2:1440';
    case '4k':
      return 'scale=-2:2160';
    case 'original':
    default:
      return 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
  }
}

// Compute kept segments and markers for 2:4, 4:2, or custom patterns
export function computeCutSegments(
  totalDuration: number,
  pattern?: PatternSettings
): {
  kept: Array<{ start: number; end: number }>;
  all: CutSegment[];
} {
  if (!pattern || pattern.mode === 'none') {
    return {
      kept: [{ start: 0, end: totalDuration }],
      all: [
        {
          index: 0,
          start: 0,
          end: totalDuration,
          duration: totalDuration,
          type: 'keep',
        },
      ],
    };
  }

  const keepDur = pattern.mode === '2:4' ? 2 : pattern.mode === '4:2' ? 2 : pattern.keepDuration || 2;
  const cutDur = pattern.mode === '2:4' ? 4 : pattern.mode === '4:2' ? 4 : pattern.cutDuration || 4;
  const startWith = pattern.mode === '2:4' ? 'keep' : pattern.mode === '4:2' ? 'cut' : pattern.startWith || 'keep';

  const kept: Array<{ start: number; end: number }> = [];
  const all: CutSegment[] = [];

  let t = 0;
  let segIdx = 0;
  let isKeep = startWith === 'keep';

  while (t < totalDuration) {
    const currentDur = isKeep ? keepDur : cutDur;
    const nextT = Math.min(t + currentDur, totalDuration);
    const duration = nextT - t;

    if (duration > 0.05) {
      if (isKeep) {
        kept.push({ start: t, end: nextT });
      }
      all.push({
        index: segIdx++,
        start: t,
        end: nextT,
        duration,
        type: isKeep ? 'keep' : 'cut',
      });
    }

    t = nextT;
    isKeep = !isKeep;
  }

  // Safety fallback if video is shorter than first cut
  if (kept.length === 0 && totalDuration > 0) {
    const fallbackEnd = Math.min(totalDuration, 1);
    kept.push({ start: 0, end: fallbackEnd });
    all.push({
      index: segIdx++,
      start: 0,
      end: fallbackEnd,
      duration: fallbackEnd,
      type: 'keep',
    });
  }

  return { kept, all };
}

// Convert File, Blob, or URL to Uint8Array
async function readDataToUint8Array(source: File | Blob | string): Promise<Uint8Array> {
  if (source instanceof File || source instanceof Blob) {
    const buffer = await source.arrayBuffer();
    return new Uint8Array(buffer);
  }
  const res = await fetch(source);
  if (!res.ok) {
    throw new Error(`Failed to read media source: ${res.statusText}`);
  }
  const buffer = await res.arrayBuffer();
  return new Uint8Array(buffer);
}

class WebFfmpegService {
  private ffmpeg: FFmpeg | null = null;
  private isLoaded = false;
  private isLoading = false;
  private loadPromise: Promise<FFmpeg> | null = null;
  private engineMessage = 'Idle';
  private createdObjectUrls: Set<string> = new Set();

  // Lazy-load the FFmpeg WebAssembly engine only when needed
  async loadEngine(onProgress?: (percent: number, message: string) => void): Promise<FFmpeg> {
    if (this.isLoaded && this.ffmpeg) {
      return this.ffmpeg;
    }

    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    onProgress?.(10, 'Preparing WebAssembly video engine...');

    this.loadPromise = (async () => {
      try {
        const ffmpeg = new FFmpeg();

        ffmpeg.on('log', ({ message }) => {
          // Log messages for debugging
          if (process.env.NODE_ENV !== 'production') {
            console.debug('[FFmpeg WASM]:', message);
          }
        });

        onProgress?.(30, 'Loading FFmpeg WASM core modules...');

        // Attempt 1: Try local Express/Vite endpoint first (offline capable)
        let coreURL = '';
        let wasmURL = '';

        try {
          // Test local availability
          const testRes = await fetch('/ffmpeg-core/ffmpeg-core.js', { method: 'HEAD' });
          if (testRes.ok) {
            coreURL = await toBlobURL('/ffmpeg-core/ffmpeg-core.js', 'text/javascript');
            wasmURL = await toBlobURL('/ffmpeg-core/ffmpeg-core.wasm', 'application/wasm');
          }
        } catch {
          // Fall through to CDN
        }

        // Attempt 2: Fallback to high-speed CDN if local not served
        if (!coreURL || !wasmURL) {
          onProgress?.(50, 'Loading FFmpeg WASM core from CDN...');
          const cdnBase = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
          coreURL = await toBlobURL(`${cdnBase}/ffmpeg-core.js`, 'text/javascript');
          wasmURL = await toBlobURL(`${cdnBase}/ffmpeg-core.wasm`, 'application/wasm');
        }

        onProgress?.(75, 'Compiling WebAssembly media codecs...');

        await ffmpeg.load({
          coreURL,
          wasmURL,
        });

        this.ffmpeg = ffmpeg;
        this.isLoaded = true;
        this.isLoading = false;
        this.engineMessage = 'Ready';

        onProgress?.(100, 'Video engine ready.');
        return ffmpeg;
      } catch (err: any) {
        this.isLoading = false;
        this.loadPromise = null;
        console.error('Failed to load FFmpeg WASM:', err);
        throw new Error(
          `Could not initialize FFmpeg WebAssembly engine: ${err.message || 'Browser WebAssembly error'}. Please ensure WebAssembly is supported in your browser.`
        );
      }
    })();

    return this.loadPromise;
  }

  // Probe media using native browser HTML5 elements (Zero-overhead, instant metadata)
  async probeVideo(source: File | Blob | string): Promise<{
    duration: number;
    width: number;
    height: number;
    size: number;
    format: string;
    hasAudio: boolean;
  }> {
    return new Promise((resolve, reject) => {
      const url = typeof source === 'string' ? source : URL.createObjectURL(source);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      const cleanup = () => {
        if (typeof source !== 'string') {
          URL.revokeObjectURL(url);
        }
        video.src = '';
        video.load();
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Video metadata loading timed out. The file may be corrupt or an unsupported format.'));
      }, 10000);

      video.onloadedmetadata = () => {
        clearTimeout(timeout);
        const duration = Math.max(0.1, video.duration || 0);
        const width = video.videoWidth || 1920;
        const height = video.videoHeight || 1080;
        const size = source instanceof File || source instanceof Blob ? source.size : 0;
        const format = source instanceof File ? source.type || 'video/mp4' : 'video/mp4';

        // Check for audio presence using audio tracks or duration sanity
        let hasAudio = false;
        if ((video as any).webkitAudioDecodedByteCount !== undefined) {
          hasAudio = (video as any).webkitAudioDecodedByteCount > 0;
        } else if ((video as any).audioTracks && (video as any).audioTracks.length > 0) {
          hasAudio = true;
        } else {
          // Default true for standard video files
          hasAudio = true;
        }

        cleanup();
        resolve({
          duration,
          width,
          height,
          size,
          format,
          hasAudio,
        });
      };

      video.onerror = () => {
        clearTimeout(timeout);
        cleanup();
        reject(new Error('Browser could not decode video file metadata.'));
      };

      video.src = url;
    });
  }

  // Probe audio using native browser Audio element
  async probeAudio(source: File | Blob | string): Promise<{
    duration: number;
    size: number;
    format: string;
  }> {
    return new Promise((resolve, reject) => {
      const url = typeof source === 'string' ? source : URL.createObjectURL(source);
      const audio = new Audio();
      audio.preload = 'metadata';

      const cleanup = () => {
        if (typeof source !== 'string') {
          URL.revokeObjectURL(url);
        }
        audio.src = '';
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Audio metadata loading timed out.'));
      }, 10000);

      audio.onloadedmetadata = () => {
        clearTimeout(timeout);
        const duration = Math.max(0.1, audio.duration || 0);
        const size = source instanceof File || source instanceof Blob ? source.size : 0;
        const format = source instanceof File ? source.type || 'audio/mp3' : 'audio/mp3';

        cleanup();
        resolve({
          duration,
          size,
          format,
        });
      };

      audio.onerror = () => {
        clearTimeout(timeout);
        cleanup();
        reject(new Error('Browser could not decode audio metadata.'));
      };

      audio.src = url;
    });
  }

  // Probe image dimensions
  async probeImage(source: File | Blob | string): Promise<{ width: number; height: number; size: number }> {
    return new Promise((resolve, reject) => {
      const url = typeof source === 'string' ? source : URL.createObjectURL(source);
      const img = new Image();

      const cleanup = () => {
        if (typeof source !== 'string') {
          URL.revokeObjectURL(url);
        }
      };

      img.onload = () => {
        const width = img.naturalWidth || 1920;
        const height = img.naturalHeight || 1080;
        const size = source instanceof File || source instanceof Blob ? source.size : 0;
        cleanup();
        resolve({ width, height, size });
      };

      img.onerror = () => {
        cleanup();
        reject(new Error('Browser could not decode image.'));
      };

      img.src = url;
    });
  }

  // Process and export project locally in the browser
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
  ): Promise<{
    success: boolean;
    outputPath: string;
    outputUrl: string;
    blob: Blob;
    duration: number;
    error?: string;
  }> {
    const writtenFiles: string[] = [];

    try {
      onProgress({
        status: 'preparing',
        percent: 5,
        message: 'Initializing local WebAssembly video engine...',
        resolution: payload.resolution,
      });

      const ffmpeg = await this.loadEngine((pct, msg) => {
        onProgress({
          status: 'preparing',
          percent: Math.round(5 + (pct * 0.15)),
          message: msg,
          resolution: payload.resolution,
        });
      });

      const hasVideo = Boolean(payload.video);
      const hasImages = Boolean(payload.images && payload.images.length > 0);
      const hasAudio = Boolean(payload.audio);

      if (!hasVideo && !hasImages) {
        throw new Error('No video or images provided for export.');
      }

      onProgress({
        status: 'preparing',
        percent: 22,
        message: 'Reading source media into browser memory...',
        resolution: payload.resolution,
      });

      let sourceDuration = 0;
      let hasAudioStream = false;

      // 1. Prepare video file in virtual filesystem
      if (hasVideo && payload.video) {
        sourceDuration = payload.video.duration || 1;
        const videoData = payload.video.file
          ? await readDataToUint8Array(payload.video.file)
          : await readDataToUint8Array(payload.video.url);

        await ffmpeg.writeFile('input_video.mp4', videoData);
        writtenFiles.push('input_video.mp4');

        // Check audio capability
        hasAudioStream = Boolean(payload.video.size && payload.video.size > 0);
      } else if (hasImages && payload.images) {
        sourceDuration = payload.images.reduce((acc, img) => acc + (img.duration || 3), 0);
      }

      // 2. Prepare audio file if present
      if (hasAudio && payload.audio) {
        const audioData = payload.audio.file
          ? await readDataToUint8Array(payload.audio.file)
          : await readDataToUint8Array(payload.audio.url);

        await ffmpeg.writeFile('input_audio.mp3', audioData);
        writtenFiles.push('input_audio.mp3');
      }

      // 3. Compute Pattern Cut segments
      const isPatternCutActive = Boolean(
        payload.pattern && payload.pattern.mode !== 'none' && hasVideo
      );

      const { kept: keptSegments } = isPatternCutActive
        ? computeCutSegments(sourceDuration, payload.pattern)
        : { kept: [{ start: 0, end: sourceDuration }] };

      const targetTotalDuration = isPatternCutActive
        ? keptSegments.reduce((acc, s) => acc + (s.end - s.start), 0)
        : sourceDuration;

      // 4. Crop filter setup
      let cropFilter = '';
      if (payload.crop && payload.crop.enabled) {
        const { x, y, width, height } = payload.crop;
        // Clamp and ensure even numbers for H.264
        cropFilter = `crop=w='trunc(iw*${width}/100/2)*2':h='trunc(ih*${height}/100/2)*2':x='trunc(iw*${x}/100/2)*2':y='trunc(ih*${y}/100/2)*2'`;
      }

      // 5. Scale filter setup
      const scaleFilter = getScaleFilter(payload.resolution);

      const ffmpegArgs: string[] = ['-y'];

      // Setup progress listener
      const progressHandler = ({ progress, time }: { progress: number; time: number }) => {
        let pct = 0;
        if (targetTotalDuration > 0 && time > 0) {
          const currentSeconds = time / 1000000; // time in microseconds
          const rawPct = (currentSeconds / targetTotalDuration) * 70;
          pct = Math.min(95, Math.max(25, Math.round(25 + rawPct)));
        } else if (progress > 0 && progress <= 1) {
          pct = Math.min(95, Math.max(25, Math.round(25 + progress * 70)));
        } else {
          pct = 50;
        }

        onProgress({
          status: 'exporting',
          percent: pct,
          message: `Encoding MP4 (${payload.resolution})... ${pct}%`,
          resolution: payload.resolution,
        });
      };

      ffmpeg.on('progress', progressHandler);

      // SCENARIO A: Pattern Cut on Video (2:4 or 4:2 or custom)
      if (isPatternCutActive && hasVideo) {
        ffmpegArgs.push('-i', 'input_video.mp4');

        const filterParts: string[] = [];
        const vLabels: string[] = [];
        const aLabels: string[] = [];

        keptSegments.forEach((seg, idx) => {
          const s = seg.start.toFixed(3);
          const e = seg.end.toFixed(3);
          const vLabel = `v${idx}`;
          filterParts.push(`[0:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS[${vLabel}]`);
          vLabels.push(`[${vLabel}]`);

          if (hasAudioStream) {
            const aLabel = `a${idx}`;
            filterParts.push(`[0:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS[${aLabel}]`);
            aLabels.push(`[${aLabel}]`);
          }
        });

        // Concat segments
        if (hasAudioStream) {
          const concatInput = keptSegments.map((_, idx) => `[v${idx}][a${idx}]`).join('');
          filterParts.push(`${concatInput}concat=n=${keptSegments.length}:v=1:a=1[vcat][acat]`);
        } else {
          const concatInput = vLabels.join('');
          filterParts.push(`${concatInput}concat=n=${keptSegments.length}:v=1:a=0[vcat]`);
        }

        // Post-concat video filters: Crop + Scale + format=yuv420p
        const postFilters: string[] = [];
        if (cropFilter) postFilters.push(cropFilter);
        if (scaleFilter) postFilters.push(scaleFilter);
        postFilters.push('format=yuv420p');

        filterParts.push(`[vcat]${postFilters.join(',')}[finalv]`);

        const filterComplexString = filterParts.join(';');

        ffmpegArgs.push('-filter_complex', filterComplexString);
        ffmpegArgs.push('-map', '[finalv]');
        if (hasAudioStream) {
          ffmpegArgs.push('-map', '[acat]');
          ffmpegArgs.push('-c:a', 'aac', '-b:a', '128k');
        }

        ffmpegArgs.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '24');
        ffmpegArgs.push('-movflags', '+faststart');
        ffmpegArgs.push('output.mp4');
      }
      // SCENARIO B: Standard Video (Crop or Scale only)
      else if (hasVideo) {
        ffmpegArgs.push('-i', 'input_video.mp4');

        const vFilters: string[] = [];
        if (cropFilter) vFilters.push(cropFilter);
        if (scaleFilter) vFilters.push(scaleFilter);
        vFilters.push('format=yuv420p');

        ffmpegArgs.push('-vf', vFilters.join(','));
        ffmpegArgs.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '24');

        if (hasAudioStream) {
          ffmpegArgs.push('-c:a', 'aac', '-b:a', '128k');
        }

        ffmpegArgs.push('-movflags', '+faststart');
        ffmpegArgs.push('output.mp4');
      }
      // SCENARIO C: Image Slideshow Mode
      else if (hasImages && payload.images) {
        // Write each image file
        let concatContent = '';
        for (let i = 0; i < payload.images.length; i++) {
          const img = payload.images[i];
          const imgFileName = `img_${i}.jpg`;
          const imgData = img.file
            ? await readDataToUint8Array(img.file)
            : await readDataToUint8Array(img.url);

          await ffmpeg.writeFile(imgFileName, imgData);
          writtenFiles.push(imgFileName);

          concatContent += `file '${imgFileName}'\n`;
          concatContent += `duration ${(img.duration || 3).toFixed(3)}\n`;
        }
        // Concat demuxer requires the last file to be repeated without duration
        const lastIndex = payload.images.length - 1;
        concatContent += `file 'img_${lastIndex}.jpg'\n`;

        await ffmpeg.writeFile('concat_list.txt', new TextEncoder().encode(concatContent));
        writtenFiles.push('concat_list.txt');

        ffmpegArgs.push('-f', 'concat', '-safe', '0', '-i', 'concat_list.txt');

        if (hasAudio) {
          ffmpegArgs.push('-i', 'input_audio.mp3');
          ffmpegArgs.push('-map', '0:v:0', '-map', '1:a:0');
          ffmpegArgs.push('-c:a', 'aac', '-b:a', '128k');
        } else {
          ffmpegArgs.push('-map', '0:v:0');
        }

        const vFilters: string[] = [];
        if (cropFilter) vFilters.push(cropFilter);
        if (scaleFilter) vFilters.push(scaleFilter);
        vFilters.push('format=yuv420p');

        ffmpegArgs.push('-vf', vFilters.join(','));
        ffmpegArgs.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '24');
        ffmpegArgs.push('-movflags', '+faststart');
        ffmpegArgs.push('output.mp4');
      }

      onProgress({
        status: 'exporting',
        percent: 30,
        message: 'Encoding video frames using browser WebAssembly...',
        resolution: payload.resolution,
      });

      // Execute FFmpeg WASM command
      await ffmpeg.exec(ffmpegArgs);

      onProgress({
        status: 'exporting',
        percent: 96,
        message: 'Generating downloadable MP4 video blob...',
        resolution: payload.resolution,
      });

      // Read output video from virtual filesystem
      const outputData = await ffmpeg.readFile('output.mp4');
      writtenFiles.push('output.mp4');

      const outputBytes = outputData instanceof Uint8Array ? outputData : new Uint8Array(outputData as any);
      const blob = new Blob([outputBytes], { type: 'video/mp4' });
      const outputUrl = URL.createObjectURL(blob);
      this.createdObjectUrls.add(outputUrl);

      // Clean up virtual files to prevent memory leaks in WASM
      for (const f of writtenFiles) {
        try {
          await ffmpeg.deleteFile(f);
        } catch {
          // Ignore cleanup errors
        }
      }

      onProgress({
        status: 'completed',
        percent: 100,
        message: 'Export completed successfully.',
        outputUrl,
        outputPath: `CutAndCrop_${payload.pattern?.mode || 'video'}_${payload.resolution}.mp4`,
        resolution: payload.resolution,
      });

      return {
        success: true,
        outputPath: `CutAndCrop_${payload.pattern?.mode || 'video'}_${payload.resolution}.mp4`,
        outputUrl,
        blob,
        duration: targetTotalDuration,
      };
    } catch (err: any) {
      // Cleanup virtual files on error
      if (this.ffmpeg) {
        for (const f of writtenFiles) {
          try {
            await this.ffmpeg.deleteFile(f);
          } catch {
            // Ignore
          }
        }
      }

      console.error('Web FFmpeg export failed:', err);
      onProgress({
        status: 'error',
        percent: 0,
        message: 'Video export failed in browser.',
        error: err.message || 'Unknown processing error',
        resolution: payload.resolution,
      });

      throw err;
    }
  }

  // Transcode generated video to a target resolution directly in browser
  async transcodeQuality(
    inputBlobOrUrl: Blob | string,
    targetResolution: ExportResolution,
    onProgress?: (percent: number, message: string) => void
  ): Promise<{ url: string; blob: Blob; size: number }> {
    const ffmpeg = await this.loadEngine((pct, msg) => {
      onProgress?.(pct * 0.3, msg);
    });

    onProgress?.(35, `Reading video for ${targetResolution} encoding...`);
    const inputData = await readDataToUint8Array(inputBlobOrUrl);
    await ffmpeg.writeFile('transcode_in.mp4', inputData);

    const scaleFilter = getScaleFilter(targetResolution);
    const args = [
      '-y',
      '-i', 'transcode_in.mp4',
      '-vf', `${scaleFilter},format=yuv420p`,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '24',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      'transcode_out.mp4',
    ];

    onProgress?.(55, `Transcoding to ${targetResolution}...`);
    await ffmpeg.exec(args);

    onProgress?.(95, 'Finalizing download package...');
    const outData = await ffmpeg.readFile('transcode_out.mp4');

    try {
      await ffmpeg.deleteFile('transcode_in.mp4');
      await ffmpeg.deleteFile('transcode_out.mp4');
    } catch {
      // Ignore
    }

    const bytes = outData instanceof Uint8Array ? outData : new Uint8Array(outData as any);
    const blob = new Blob([bytes], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    this.createdObjectUrls.add(url);

    onProgress?.(100, `Ready in ${targetResolution}.`);
    return { url, blob, size: blob.size };
  }

  // Revoke all tracked object URLs when clearing or resetting
  revokeTrackedUrls() {
    this.createdObjectUrls.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignore
      }
    });
    this.createdObjectUrls.clear();
  }

  // Generate a local 24s test video clip in the browser using HTML5 Canvas & Web Audio (Zero Server Dependency!)
  async generateLocalDemoVideo(): Promise<{
    video: VideoAsset;
    audio: AudioAsset;
  }> {
    return new Promise(async (resolve, reject) => {
      try {
        const width = 1280;
        const height = 720;
        const durationSeconds = 24;
        const fps = 25;

        // 1. Create offscreen canvas for rhythmic test pattern
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas 2D context unavailable');
        }

        // 2. Setup Web Audio synth beat for test audio
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();

        // Oscillator with rhythmic pulse
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);

        // Modulate gain every second for rhythmic beat
        for (let i = 0; i < durationSeconds; i++) {
          const t = audioCtx.currentTime + i;
          // Pulse on each beat
          gainNode.gain.setValueAtTime(0.3, t);
          gainNode.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        }

        osc.connect(gainNode);
        gainNode.connect(dest);
        osc.start();

        // 3. Setup MediaRecorder with canvas stream + audio stream
        const canvasStream = canvas.captureStream(fps);
        const combinedStream = new MediaStream([
          ...canvasStream.getVideoTracks(),
          ...dest.stream.getAudioTracks(),
        ]);

        const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
          ? 'video/mp4;codecs=avc1'
          : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : 'video/webm';

        const recorder = new MediaRecorder(combinedStream, { mimeType });
        const recordedChunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunks.push(e.data);
          }
        };

        recorder.onstop = async () => {
          try {
            osc.stop();
            audioCtx.close();
          } catch {
            // Ignore
          }

          const videoBlob = new Blob(recordedChunks, { type: mimeType });
          const videoFile = new File([videoBlob], 'Demo_Rhythm_Test_24s.mp4', { type: mimeType });
          const videoUrl = URL.createObjectURL(videoFile);
          this.createdObjectUrls.add(videoUrl);

          // Create companion audio asset
          const audioAsset: AudioAsset = {
            id: `demo-aud-${Date.now()}`,
            name: 'Demo_Rhythmic_Beat.mp3',
            path: 'local-demo-audio',
            url: videoUrl,
            duration: durationSeconds,
            size: videoFile.size,
          };

          const videoAsset: VideoAsset = {
            id: `demo-vid-${Date.now()}`,
            name: 'Demo_Rhythm_Test_24s.mp4',
            path: 'local-demo-video',
            url: videoUrl,
            duration: durationSeconds,
            width,
            height,
            file: videoFile,
            size: videoFile.size,
            format: mimeType,
          };

          resolve({ video: videoAsset, audio: audioAsset });
        };

        recorder.start();

        // Animate frames in canvas
        let currentFrame = 0;
        const totalFrames = durationSeconds * fps;

        const drawFrame = () => {
          const currentSecond = (currentFrame / fps);
          const is24Keep = (currentSecond % 6) < 2; // 2s keep, 4s cut preview
          const is42Keep = (currentSecond % 6) >= 4; // 4s cut, 2s keep preview

          // Dynamic gradient background
          const hue = (currentSecond * 15) % 360;
          ctx.fillStyle = `hsl(${hue}, 40%, 12%)`;
          ctx.fillRect(0, 0, width, height);

          // Grid lines
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 1;
          for (let x = 0; x < width; x += 60) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
          }

          // Center badge: Time counter
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 72px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const timeText = `00:${Math.floor(currentSecond).toString().padStart(2, '0')}.${Math.floor((currentSecond % 1) * 10)}`;
          ctx.fillText(timeText, width / 2, height / 2 - 40);

          // Title
          ctx.font = 'bold 28px sans-serif';
          ctx.fillStyle = '#818cf8';
          ctx.fillText('Cut and Crop • Rhythm Test Video (24s)', width / 2, height / 2 - 120);

          // 2:4 Pattern Indicator
          ctx.font = 'bold 20px monospace';
          ctx.fillStyle = is24Keep ? '#34d399' : '#f87171';
          const pattern24Text = `2:4 Pattern: ${is24Keep ? '🟢 KEEP (0-2s)' : '🔴 CUT (2-6s)'}`;
          ctx.fillText(pattern24Text, width / 2, height / 2 + 50);

          // 4:2 Pattern Indicator
          ctx.fillStyle = is42Keep ? '#34d399' : '#f87171';
          const pattern42Text = `4:2 Pattern: ${is42Keep ? '🟢 KEEP (4-6s)' : '🔴 CUT (0-4s)'}`;
          ctx.fillText(pattern42Text, width / 2, height / 2 + 90);

          // Moving Progress Bar along bottom
          const progressRatio = currentFrame / totalFrames;
          ctx.fillStyle = '#4f46e5';
          ctx.fillRect(40, height - 60, (width - 80) * progressRatio, 16);
          ctx.strokeStyle = '#312e81';
          ctx.strokeRect(40, height - 60, width - 80, 16);

          currentFrame++;
          if (currentFrame < totalFrames) {
            setTimeout(drawFrame, 1000 / fps);
          } else {
            recorder.stop();
          }
        };

        drawFrame();
      } catch (err: any) {
        reject(err);
      }
    });
  }
}

export const webFfmpegService = new WebFfmpegService();
