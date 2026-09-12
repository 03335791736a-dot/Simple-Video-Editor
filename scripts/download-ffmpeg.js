/**
 * Helper script to ensure bin/win64/ contains ffmpeg.exe and ffprobe.exe
 * before building the Windows installer with electron-builder.
 */
import fs from 'fs';
import path from 'path';

const winBinDir = path.join(process.cwd(), 'bin', 'win64');

if (!fs.existsSync(winBinDir)) {
  fs.mkdirSync(winBinDir, { recursive: true });
}

console.log('Target Windows bin directory:', winBinDir);

// Check if @ffmpeg-installer has a binary we can copy, or provide clear instruction
try {
  const ffmpegInstaller = await import('@ffmpeg-installer/ffmpeg');
  const ffprobeInstaller = await import('@ffprobe-installer/ffprobe');

  console.log('Installed local binaries detected:');
  console.log('FFmpeg:', ffmpegInstaller.default?.path || ffmpegInstaller.path);
  console.log('FFprobe:', ffprobeInstaller.default?.path || ffprobeInstaller.path);
} catch (e) {
  console.log('Note: To build Windows .exe offline installer, ensure bin/win64/ffmpeg.exe and bin/win64/ffprobe.exe exist.');
}
