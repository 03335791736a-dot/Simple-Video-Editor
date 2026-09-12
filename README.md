# Simple Video Editor

A complete offline Windows 10 desktop video editor built with **Electron**, **React**, **TypeScript**, **Vite**, **FFmpeg**, **FFprobe**, and **electron-builder**.

## Key Capabilities & Scope

- **100% Offline Operation**: Zero internet connection, cloud APIs, accounts, logins, or external services required. All video and audio processing happens entirely locally on the machine.
- **Import Video**: Supports MP4, MOV, MKV, AVI, WEBM. Probes duration, width, height, format via local FFprobe without altering the source file.
- **Import Multiple Images**: Supports JPG, JPEG, PNG, WEBP, BMP. Reorder slides, adjust duration per image (default 3 seconds), and preview sequence.
- **Import Audio**: Supports MP3, WAV, M4A, AAC, FLAC, OGG with duration detection.
- **Image Slideshow (Image → Video)**: Renders image sequences into native H.264 MP4 videos using FFmpeg demuxing.
- **Duplicate / Fill Audio**: If audio is longer than the visual content (video or slideshow), automatically loops and trims the visual content to match the exact audio duration with zero overflow.
- **Interactive Visual Crop**: Presets for Free Crop, 16:9 Landscape, 9:16 Portrait, and 1:1 Square with visual guide overlay in the preview. Applied via `-vf crop` during final export.
- **Resolution Scaling**: Original, 720p HD, 1080p Full HD, and 4K Ultra HD.
- **Synchronized Preview Player**: Play, pause, seek, current time, total duration, and real-time visual representation of repeated segments.
- **Visual Timeline**: Dedicated tracks for Video/Images and Audio, illustrating loop repetitions and exact playhead position.
- **Project Auto-Save**: Saves state locally in storage during editing sessions.
- **Windows Installer**: Packages directly into an offline Windows 10 64-bit installer: `SimpleVideoEditorSetup.exe` (NSIS) and `SimpleVideoEditor-Portable.exe`.

---

## How to Build the Windows 10 Installer (`SimpleVideoEditorSetup.exe`)

To package the standalone Windows 10 installer outside Bolt on your Windows PC:

### 1. Prerequisites
- Node.js 18+ installed on your Windows 10 machine.
- Git (optional, for cloning).

### 2. Install Dependencies
```bash
npm install
```

### 3. Ensure FFmpeg Binaries for Windows
The application includes `@ffmpeg-installer/ffmpeg` and `@ffprobe-installer/ffprobe`. For standalone distribution packaging, place Windows 64-bit binaries in `bin/win64/`:
```
bin/
  win64/
    ffmpeg.exe
    ffprobe.exe
```
These are automatically bundled by `electron-builder.json5` under `extraResources`.

### 4. Build Application & Installer
```bash
# Build React client, Express server, and Electron main/preload
npm run build

# Package the Windows 10 64-bit NSIS installer
npm run dist:win
```

### 5. Output Artifacts
Once packaging completes, the generated Windows binaries are located in:
```
dist-electron-build/
  SimpleVideoEditorSetup.exe      <-- Full NSIS Offline Windows 10 Installer
  SimpleVideoEditor-Portable.exe  <-- Portable standalone executable
```

---

## Required Test Verification Matrix

All 9 required test cases can be run and verified directly in the app via the **"9 Test Cases"** button:

| Test Case | Scenario | Expected Outcome |
|---|---|---|
| **TEST 1** | Import Video → Preview → Export | Clean MP4 video exported with preserved dimensions |
| **TEST 2** | Import Multiple Images → Set Durations → Reorder → Export Slideshow | 3-slide sequence exported as timed MP4 slideshow |
| **TEST 3** | Import Images → Import Audio → Export | Slideshow video with synchronized background audio |
| **TEST 4** | Import Images → Import Audio → Duplicate / Fill Audio → Export | 9s slideshow repeats to cover 65s audio duration exactly |
| **TEST 5** | Import Short Video → Import Long Audio → Duplicate / Fill Audio → Export | 10s video repeats 6.5 times to fill 65s audio without overflow |
| **TEST 6** | Import Video → Crop → Export | Video exported with 16:9 crop applied via FFmpeg filter |
| **TEST 7** | Import Images → Crop → Export | Slideshow exported with 1:1 square crop filter applied |
| **TEST 8** | Video + Audio + Crop + Duplicate / Fill Audio → Export | Video looped to 65s audio duration with 16:9 crop |
| **TEST 9** | Images + Audio + Crop + Duplicate / Fill Audio → Export | Images looped to 65s audio duration with 9:16 portrait crop |
