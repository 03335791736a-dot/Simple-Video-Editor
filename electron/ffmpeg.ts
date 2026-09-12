import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ExportJobOptions, MediaProbeResult } from '../src/types/electron';

// Find executable paths for ffmpeg and ffprobe
export function getBinaryPaths(): { ffmpegPath: string; ffprobePath: string } {
  const platform = process.platform;
  const ext = platform === 'win32' ? '.exe' : '';

  // 1. Check extraResources / bundled location in packaged Electron app
  if ((process as any).resourcesPath) {
    const bundledFfmpeg = path.join((process as any).resourcesPath, 'bin', `ffmpeg${ext}`);
    const bundledFfprobe = path.join((process as any).resourcesPath, 'bin', `ffprobe${ext}`);
    if (fs.existsSync(bundledFfmpeg) && fs.existsSync(bundledFfprobe)) {
      return { ffmpegPath: bundledFfmpeg, ffprobePath: bundledFfprobe };
    }
  }

  // 2. Check local project bin directory
  const localFfmpeg = path.join(process.cwd(), 'bin', platform === 'win32' ? 'win64' : platform, `ffmpeg${ext}`);
  const localFfprobe = path.join(process.cwd(), 'bin', platform === 'win32' ? 'win64' : platform, `ffprobe${ext}`);
  if (fs.existsSync(localFfmpeg) && fs.existsSync(localFfprobe)) {
    return { ffmpegPath: localFfmpeg, ffprobePath: localFfprobe };
  }

  // 3. Check @ffmpeg-installer and @ffprobe-installer packages
  try {
    const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
    const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
    if (ffmpegInstaller.path && ffprobeInstaller.path) {
      return { ffmpegPath: ffmpegInstaller.path, ffprobePath: ffprobeInstaller.path };
    }
  } catch {
    // Ignore fallback
  }

  // 4. Default to system PATH
  return {
    ffmpegPath: `ffmpeg${ext}`,
    ffprobePath: `ffprobe${ext}`,
  };
}

export function probeMediaFile(filePath: string): Promise<MediaProbeResult> {
  return new Promise((resolve, reject) => {
    const { ffprobePath } = getBinaryPaths();
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ];

    const child = spawn(ffprobePath, args);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe failed with code ${code}: ${stderr}`));
      }

      try {
        const data = JSON.parse(stdout);
        const format = data.format || {};
        const streams = data.streams || [];

        const videoStream = streams.find((s: any) => s.codec_type === 'video');
        const audioStream = streams.find((s: any) => s.codec_type === 'audio');

        let duration = parseFloat(format.duration || '0');
        if (!duration && videoStream?.duration) {
          duration = parseFloat(videoStream.duration);
        }
        if (!duration && audioStream?.duration) {
          duration = parseFloat(audioStream.duration);
        }

        const width = videoStream ? parseInt(videoStream.width, 10) : undefined;
        const height = videoStream ? parseInt(videoStream.height, 10) : undefined;

        let fps: number | undefined;
        if (videoStream?.r_frame_rate) {
          const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
          if (den && den !== 0) {
            fps = Math.round((num / den) * 100) / 100;
          }
        }

        resolve({
          format: format.format_name || 'unknown',
          duration: Math.max(0, duration),
          width,
          height,
          fps,
          size: parseInt(format.size || '0', 10),
          hasAudio: Boolean(audioStream),
          hasVideo: Boolean(videoStream),
        });
      } catch (err: any) {
        reject(new Error(`Failed to parse ffprobe output: ${err.message}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Could not execute ffprobe: ${err.message}`));
    });
  });
}

// Compute kept segments and timeline markers based on 2:4 or 4:2 pattern
export function computeCutSegments(
  totalDuration: number,
  pattern?: ExportJobOptions['pattern']
): {
  kept: Array<{ start: number; end: number }>;
  all: Array<{ index: number; start: number; end: number; duration: number; type: 'keep' | 'cut' }>;
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
  const all: Array<{ index: number; start: number; end: number; duration: number; type: 'keep' | 'cut' }> = [];

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

  // Safety fallback if no segments were kept (e.g., video shorter than cut window)
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

// Build video resolution scaling filter
export function getScaleFilter(resolution: ExportJobOptions['resolution']): string {
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

export function exportMedia(
  options: ExportJobOptions,
  onProgress: (percent: number, message: string) => void
): Promise<{ outputPath: string }> {
  return new Promise(async (resolve, reject) => {
    try {
      const { ffmpegPath } = getBinaryPaths();
      const tempDir = path.join(os.tmpdir(), 'cut-and-crop-' + Date.now());
      fs.mkdirSync(tempDir, { recursive: true });

      const hasVideo = Boolean(options.videoPath && fs.existsSync(options.videoPath));
      const hasImages = Boolean(options.images && options.images.length > 0);
      const hasAudio = Boolean(options.audioPath && fs.existsSync(options.audioPath));

      if (!hasVideo && !hasImages) {
        return reject(new Error('No video or images provided for export.'));
      }

      // Probe source media
      let sourceDuration = 0;
      let hasAudioStream = false;

      if (hasVideo && options.videoPath) {
        const videoProbe = await probeMediaFile(options.videoPath);
        sourceDuration = videoProbe.duration || 1;
        hasAudioStream = videoProbe.hasAudio;
      } else if (hasImages && options.images) {
        sourceDuration = options.images.reduce((acc, img) => acc + (img.duration || 3), 0);
      }

      // 1. Calculate kept segments for Pattern Cut (2:4 or 4:2)
      const isPatternCutActive = Boolean(
        options.pattern && options.pattern.mode !== 'none' && hasVideo
      );

      const { kept: keptSegments } = isPatternCutActive
        ? computeCutSegments(sourceDuration, options.pattern)
        : { kept: [{ start: 0, end: sourceDuration }] };

      const targetTotalDuration = isPatternCutActive
        ? keptSegments.reduce((acc, s) => acc + (s.end - s.start), 0)
        : sourceDuration;

      // 2. Crop filter setup
      let cropFilter = '';
      if (options.crop && options.crop.enabled) {
        const { x, y, width, height } = options.crop;
        cropFilter = `crop=w='trunc(iw*${width}/100/2)*2':h='trunc(ih*${height}/100/2)*2':x='trunc(iw*${x}/100/2)*2':y='trunc(ih*${y}/100/2)*2'`;
      }

      // 3. Scale filter setup
      const scaleFilter = getScaleFilter(options.resolution);

      const ffmpegArgs: string[] = ['-y'];

      // SCENARIO A: Pattern Cut on Video (2:4, 4:2, or custom trim)
      if (isPatternCutActive && options.videoPath) {
        ffmpegArgs.push('-i', options.videoPath);

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
          ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k');
        }

        ffmpegArgs.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22');
        ffmpegArgs.push('-movflags', '+faststart');
        ffmpegArgs.push(options.outputPath);
      }
      // SCENARIO B: Standard Video (No Pattern Cut or Crop/Scale only)
      else if (hasVideo && options.videoPath) {
        ffmpegArgs.push('-i', options.videoPath);

        const vFilters: string[] = [];
        if (cropFilter) vFilters.push(cropFilter);
        if (scaleFilter) vFilters.push(scaleFilter);
        vFilters.push('format=yuv420p');

        ffmpegArgs.push('-vf', vFilters.join(','));
        ffmpegArgs.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22');

        if (hasAudioStream) {
          ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k');
        }

        ffmpegArgs.push('-movflags', '+faststart');
        ffmpegArgs.push(options.outputPath);
      }
      // SCENARIO C: Slideshow Mode
      else if (hasImages && options.images) {
        const concatFilePath = path.join(tempDir, 'concat_list.txt');
        let concatContent = '';

        for (const img of options.images) {
          concatContent += `file '${img.path.replace(/'/g, "'\\''")}'\n`;
          concatContent += `duration ${(img.duration || 3).toFixed(3)}\n`;
        }
        const lastImg = options.images[options.images.length - 1];
        concatContent += `file '${lastImg.path.replace(/'/g, "'\\''")}'\n`;

        fs.writeFileSync(concatFilePath, concatContent, 'utf8');

        ffmpegArgs.push('-f', 'concat', '-safe', '0', '-i', concatFilePath);

        if (hasAudio && options.audioPath) {
          ffmpegArgs.push('-i', options.audioPath);
          ffmpegArgs.push('-map', '0:v:0', '-map', '1:a:0');
          ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k');
        } else {
          ffmpegArgs.push('-map', '0:v:0');
        }

        const vFilters: string[] = [];
        if (cropFilter) vFilters.push(cropFilter);
        if (scaleFilter) vFilters.push(scaleFilter);
        vFilters.push('format=yuv420p');

        ffmpegArgs.push('-vf', vFilters.join(','));
        ffmpegArgs.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22');
        ffmpegArgs.push('-movflags', '+faststart');
        ffmpegArgs.push(options.outputPath);
      }

      onProgress(5, 'Starting FFmpeg processing...');

      const child = spawn(ffmpegPath, ffmpegArgs);
      let stderrBuffer = '';

      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        stderrBuffer += text;

        const timeMatch = text.match(/time=(\d+):(\d+):(\d+\.\d+)/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const seconds = parseFloat(timeMatch[3]);
          const currentSeconds = hours * 3600 + minutes * 60 + seconds;
          if (targetTotalDuration > 0) {
            const rawPct = (currentSeconds / targetTotalDuration) * 92;
            const pct = Math.min(96, Math.max(8, Math.round(rawPct)));
            onProgress(pct, `Processing video... ${pct}%`);
          }
        }
      });

      child.on('close', (code) => {
        try {
          if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
        } catch {
          // ignore
        }

        if (code === 0 && fs.existsSync(options.outputPath)) {
          onProgress(100, 'Export completed successfully.');
          resolve({ outputPath: options.outputPath });
        } else {
          reject(new Error(`FFmpeg processing failed (exit code ${code}). Details: ${stderrBuffer.slice(-600)}`));
        }
      });

      child.on('error', (err) => {
        reject(new Error(`FFmpeg failed to start: ${err.message}`));
      });
    } catch (err: any) {
      reject(err);
    }
  });
}
