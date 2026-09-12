import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { exportMedia, probeMediaFile } from './electron/ffmpeg';
import { ExportJobOptions } from './src/types/electron';
import { spawn } from 'child_process';
import {
  checkUserAuthorization,
  verifyUserPassword,
  validateSessionToken,
  revokeSessionToken,
  verifyIsAdmin,
  getAllUsers,
  addUser,
  resetUserPassword,
  setUserEnabled,
  deleteUser,
} from './server/authStore';

const app = express();
const PORT = 3000;

// Upload directory configuration
const uploadsDir = path.join(process.cwd(), 'temp-uploads');
const exportsDir = path.join(process.cwd(), 'temp-exports');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

// Storage engine
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});

const upload = multer({ storage });

app.use(express.json());

// Serve uploads and exports statically
app.use('/media-files', express.static(uploadsDir));
app.use('/exported-files', express.static(exportsDir));

// Active export jobs
interface JobState {
  id: string;
  status: 'preparing' | 'exporting' | 'completed' | 'error';
  percent: number;
  message: string;
  outputPath?: string;
  outputUrl?: string;
  error?: string;
}

const activeJobs = new Map<string, JobState>();

// Generate a quick video thumbnail using ffmpeg
function generateVideoThumbnail(videoPath: string, thumbName: string): Promise<string> {
  return new Promise((resolve) => {
    const thumbPath = path.join(uploadsDir, thumbName);
    const child = spawn('ffmpeg', [
      '-y',
      '-ss', '00:00:00.500',
      '-i', videoPath,
      '-vframes', '1',
      '-vf', 'scale=320:-1',
      thumbPath,
    ]);

    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(thumbPath)) {
        resolve(`/media-files/${thumbName}`);
      } else {
        // Return empty or fallback
        resolve('');
      }
    });

    child.on('error', () => {
      resolve('');
    });
  });
}

// API: Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ==========================================
// AUTHENTICATION & ACCESS CONTROL API ROUTES
// ==========================================

// 1. Verify User Email Authorization
app.post('/api/auth/verify-user', (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }
    const status = checkUserAuthorization(email);
    res.json(status);
  } catch (err: any) {
    console.error('Verify user error:', err);
    res.status(500).json({ error: 'Failed to verify user' });
  }
});

// 2. Verify Individual User Password
app.post('/api/auth/verify-password', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }
    const result = verifyUserPassword(email, password);
    res.json(result);
  } catch (err: any) {
    console.error('Verify password error:', err);
    res.status(500).json({ success: false, error: 'Authentication verification failed' });
  }
});

// 3. Validate Session Token
app.get('/api/auth/session', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false, error: 'No token provided' });
  }
  const token = authHeader.substring(7);
  const result = validateSessionToken(token);
  res.json(result);
});

// 4. Logout / Invalidate Session
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    revokeSessionToken(token);
  }
  res.json({ success: true });
});

// 5. Auth Public Config (e.g. indicates configured admin domain or fallback)
app.get('/api/auth/config', (_req, res) => {
  res.json({
    adminConfigured: Boolean(process.env.ADMIN_EMAIL),
    adminEmail: process.env.ADMIN_EMAIL || 'admin@gmail.com',
  });
});

// ==========================================
// ADMIN DASHBOARD API ROUTES (SECURE)
// ==========================================

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  const adminEmail = (req.headers['x-admin-email'] as string) || undefined;

  const authorized = verifyIsAdmin(adminEmail, token);
  if (!authorized) {
    return res.status(403).json({ error: 'Access denied: Administrator privileges required.' });
  }
  next();
}

// Admin: List all authorized users
app.get('/api/admin/users', requireAdmin, (_req, res) => {
  try {
    const users = getAllUsers();
    res.json({ success: true, users });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch users' });
  }
});

// Admin: Add new user and generate unique password
app.post('/api/admin/users/add', requireAdmin, (req, res) => {
  try {
    const { email, displayName, role } = req.body;
    const result = addUser(email, displayName, role);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to add user' });
  }
});

// Admin: Reset user password (generates new one-time password)
app.post('/api/admin/users/reset-password', requireAdmin, (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    const result = resetUserPassword(email);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to reset password' });
  }
});

// Admin: Enable or Disable user
app.post('/api/admin/users/toggle-status', requireAdmin, (req, res) => {
  try {
    const { email, enabled } = req.body;
    if (!email || typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'Email and boolean enabled status are required' });
    }
    const result = setUserEnabled(email, enabled);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to update user status' });
  }
});

// Admin: Delete user
app.post('/api/admin/users/delete', requireAdmin, (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    const result = deleteUser(email);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to delete user' });
  }
});

// API: Upload Media
app.post('/api/upload', upload.array('files'), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files were uploaded' });
    }

    const results = [];

    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      const isVideo = ['.mp4', '.mov', '.mkv', '.avi', '.webm'].includes(ext);
      const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'].includes(ext);
      const isAudio = ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'].includes(ext);

      let probeData = {
        duration: 0,
        width: 1920,
        height: 1080,
        format: 'unknown',
        size: file.size,
      };

      try {
        const probed = await probeMediaFile(file.path);
        probeData.duration = probed.duration;
        if (probed.width) probeData.width = probed.width;
        if (probed.height) probeData.height = probed.height;
        probeData.format = probed.format;
      } catch (probeErr) {
        console.warn('Probe warning for', file.originalname, probeErr);
      }

      let thumbnailUrl = '';
      if (isVideo) {
        const thumbName = `thumb-${path.basename(file.filename, ext)}.jpg`;
        thumbnailUrl = await generateVideoThumbnail(file.path, thumbName);
      } else if (isImage) {
        thumbnailUrl = `/media-files/${file.filename}`;
      }

      results.push({
        id: `media-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        name: file.originalname,
        path: file.path,
        url: `/media-files/${file.filename}`,
        thumbnailUrl: thumbnailUrl || undefined,
        duration: isImage ? 3 : Math.round(probeData.duration * 100) / 100,
        width: probeData.width,
        height: probeData.height,
        size: file.size,
        type: isVideo ? 'video' : isImage ? 'image' : isAudio ? 'audio' : 'other',
      });
    }

    res.json({ success: true, files: results });
  } catch (err: any) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Upload processing failed' });
  }
});

// API: Start Export
app.post('/api/export', async (req, res) => {
  try {
    const options: ExportJobOptions = req.body;
    const jobId = `job-${Date.now()}`;
    const outputFilename = `export-${Date.now()}.mp4`;
    const outputPath = path.join(exportsDir, outputFilename);

    options.outputPath = outputPath;

    const jobState: JobState = {
      id: jobId,
      status: 'preparing',
      percent: 0,
      message: 'Preparing project for export...',
      outputPath,
      outputUrl: `/exported-files/${outputFilename}`,
    };

    activeJobs.set(jobId, jobState);

    // Respond immediately with jobId
    res.json({ success: true, jobId });

    // Run export in background
    exportMedia(options, (percent, message) => {
      const job = activeJobs.get(jobId);
      if (job) {
        job.status = percent >= 100 ? 'completed' : 'exporting';
        job.percent = percent;
        job.message = message;
      }
    })
      .then(() => {
        const job = activeJobs.get(jobId);
        if (job) {
          job.status = 'completed';
          job.percent = 100;
          job.message = 'Export completed successfully.';
        }
      })
      .catch((err: any) => {
        const job = activeJobs.get(jobId);
        if (job) {
          job.status = 'error';
          job.error = err.message || 'FFmpeg processing failed.';
          job.message = 'Export failed.';
        }
      });
  } catch (err: any) {
    console.error('Export start error:', err);
    res.status(500).json({ error: err.message || 'Could not start export' });
  }
});

// API: Get Export Progress
app.get('/api/export/progress/:jobId', (req, res) => {
  const job = activeJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

// API: Transcode already-generated video to a specific download quality (360p to 4K)
app.post('/api/transcode-quality', async (req, res) => {
  try {
    const { inputPath, inputUrl, targetResolution } = req.body;
    let sourcePath = inputPath;
    if (!sourcePath && inputUrl) {
      if (inputUrl.startsWith('/exported-files/')) {
        sourcePath = path.join(exportsDir, path.basename(inputUrl));
      } else if (inputUrl.startsWith('/media-files/')) {
        sourcePath = path.join(uploadsDir, path.basename(inputUrl));
      }
    }

    if (!sourcePath || !fs.existsSync(sourcePath)) {
      return res.status(400).json({ error: 'Source video file not found' });
    }

    const ext = path.extname(sourcePath);
    const base = path.basename(sourcePath, ext);
    const outputFilename = `${base}-${targetResolution}.mp4`;
    const outputPath = path.join(exportsDir, outputFilename);
    const outputUrl = `/exported-files/${outputFilename}`;

    // If already exists, return immediately
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      return res.json({ success: true, url: outputUrl, path: outputPath, size: stats.size });
    }

    const heightMap: Record<string, number> = {
      '360p': 360,
      '480p': 480,
      '720p': 720,
      '1080p': 1080,
      '1440p': 1440,
      '4k': 2160,
    };

    const targetHeight = heightMap[targetResolution];
    const scaleArg = targetHeight
      ? `scale=-2:${targetHeight}:force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2:(ow-iw)/2:(oh-ih)/2:color=black`
      : 'scale=trunc(iw/2)*2:trunc(ih/2)*2';

    await new Promise((resolve, reject) => {
      const child = spawn('ffmpeg', [
        '-y',
        '-i', sourcePath,
        '-vf', scaleArg,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '22',
        '-c:a', 'copy',
        outputPath,
      ]);

      child.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve(null);
        } else {
          reject(new Error(`Transcode failed with code ${code}`));
        }
      });

      child.on('error', (err) => reject(err));
    });

    const stats = fs.statSync(outputPath);
    res.json({ success: true, url: outputUrl, path: outputPath, size: stats.size });
  } catch (err: any) {
    console.error('Transcode error:', err);
    res.status(500).json({ error: err.message || 'Transcode failed' });
  }
});

// API: Generate / Provide Built-in Samples for instant testing
app.post('/api/samples/create', async (_req, res) => {
  try {
    const samplesDir = path.join(uploadsDir, 'samples');
    if (!fs.existsSync(samplesDir)) {
      fs.mkdirSync(samplesDir, { recursive: true });
    }

    const sampleVideoPath = path.join(samplesDir, 'sample_clip_24s.mp4');
    const sampleAudioPath = path.join(samplesDir, 'sample_music_65s.mp3');
    const sampleImg1 = path.join(samplesDir, 'slide_1.png');
    const sampleImg2 = path.join(samplesDir, 'slide_2.png');
    const sampleImg3 = path.join(samplesDir, 'slide_3.png');

    // 1. Generate 24-second test video (ideal for 2:4 and 4:2 cutting cycles)
    if (!fs.existsSync(sampleVideoPath)) {
      await new Promise((resolve, reject) => {
        const p = spawn('ffmpeg', [
          '-y',
          '-f', 'lavfi',
          '-i', 'testsrc=duration=24:size=1280x720:rate=30',
          '-f', 'lavfi',
          '-i', 'sine=frequency=440:duration=24',
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          sampleVideoPath,
        ]);
        p.on('close', (code) => code === 0 ? resolve(null) : reject(new Error('Failed creating sample video')));
      });
    }

    // 2. Generate 65-second test audio if not exists
    if (!fs.existsSync(sampleAudioPath)) {
      await new Promise((resolve, reject) => {
        const p = spawn('ffmpeg', [
          '-y',
          '-f', 'lavfi',
          '-i', 'sine=frequency=220:duration=65',
          '-c:a', 'libmp3lame',
          sampleAudioPath,
        ]);
        p.on('close', (code) => code === 0 ? resolve(null) : reject(new Error('Failed creating sample audio')));
      });
    }

    // 3. Generate 3 sample images with different colors
    const createColorImage = (color: string, label: string, outPath: string) => {
      if (fs.existsSync(outPath)) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const p = spawn('ffmpeg', [
          '-y',
          '-f', 'lavfi',
          '-i', `color=c=${color}:s=1280x720:d=1`,
          '-vf', `drawtext=text='${label}':fontcolor=white:fontsize=72:x=(w-text_w)/2:y=(h-text_h)/2`,
          '-frames:v', '1',
          outPath,
        ]);
        p.on('close', (code) => {
          // If drawtext font isn't available, fallback without drawtext
          if (code === 0) return resolve(null);
          const fallback = spawn('ffmpeg', [
            '-y',
            '-f', 'lavfi',
            '-i', `color=c=${color}:s=1280x720:d=1`,
            '-frames:v', '1',
            outPath,
          ]);
          fallback.on('close', (c) => c === 0 ? resolve(null) : reject(new Error('Failed creating slide')));
        });
      });
    };

    await Promise.all([
      createColorImage('0x1e3a8a', 'Slide 1 (Blue)', sampleImg1),
      createColorImage('0x065f46', 'Slide 2 (Emerald)', sampleImg2),
      createColorImage('0x831843', 'Slide 3 (Rose)', sampleImg3),
    ]);

    const videoProbe = await probeMediaFile(sampleVideoPath);
    const audioProbe = await probeMediaFile(sampleAudioPath);

    res.json({
      success: true,
      video: {
        id: 'sample-video-1',
        name: 'Sample 24s Rhythm Demo Clip.mp4',
        path: sampleVideoPath,
        url: `/media-files/samples/sample_clip_24s.mp4`,
        duration: Math.round(videoProbe.duration * 100) / 100,
        width: videoProbe.width || 1280,
        height: videoProbe.height || 720,
      },
      audio: {
        id: 'sample-audio-1',
        name: 'Sample Background Music 65s.mp3',
        path: sampleAudioPath,
        url: `/media-files/samples/sample_music_65s.mp3`,
        duration: Math.round(audioProbe.duration * 100) / 100,
      },
      images: [
        {
          id: 'sample-img-1',
          name: 'Slide 1.png',
          path: sampleImg1,
          url: `/media-files/samples/slide_1.png`,
          duration: 3,
          width: 1280,
          height: 720,
        },
        {
          id: 'sample-img-2',
          name: 'Slide 2.png',
          path: sampleImg2,
          url: `/media-files/samples/slide_2.png`,
          duration: 3,
          width: 1280,
          height: 720,
        },
        {
          id: 'sample-img-3',
          name: 'Slide 3.png',
          path: sampleImg3,
          url: `/media-files/samples/slide_3.png`,
          duration: 3,
          width: 1280,
          height: 720,
        },
      ],
    });
  } catch (err: any) {
    console.error('Sample generation error:', err);
    res.status(500).json({ error: err.message || 'Failed creating samples' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Simple Video Editor running on http://localhost:${PORT}`);
  });
}

startServer();
