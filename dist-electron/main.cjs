var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// electron/main.ts
var import_electron = require("electron");
var import_path2 = __toESM(require("path"), 1);
var import_fs2 = __toESM(require("fs"), 1);

// electron/ffmpeg.ts
var import_child_process = require("child_process");
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var import_os = __toESM(require("os"), 1);
function getBinaryPaths() {
  const isDev = process.env.NODE_ENV === "development" || !process.env.NODE_ENV;
  const platform = process.platform;
  const ext = platform === "win32" ? ".exe" : "";
  if (process.resourcesPath) {
    const bundledFfmpeg = import_path.default.join(process.resourcesPath, "bin", `ffmpeg${ext}`);
    const bundledFfprobe = import_path.default.join(process.resourcesPath, "bin", `ffprobe${ext}`);
    if (import_fs.default.existsSync(bundledFfmpeg) && import_fs.default.existsSync(bundledFfprobe)) {
      return { ffmpegPath: bundledFfmpeg, ffprobePath: bundledFfprobe };
    }
  }
  const localFfmpeg = import_path.default.join(process.cwd(), "bin", platform === "win32" ? "win64" : platform, `ffmpeg${ext}`);
  const localFfprobe = import_path.default.join(process.cwd(), "bin", platform === "win32" ? "win64" : platform, `ffprobe${ext}`);
  if (import_fs.default.existsSync(localFfmpeg) && import_fs.default.existsSync(localFfprobe)) {
    return { ffmpegPath: localFfmpeg, ffprobePath: localFfprobe };
  }
  try {
    const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
    const ffprobeInstaller = require("@ffprobe-installer/ffprobe");
    if (ffmpegInstaller.path && ffprobeInstaller.path) {
      return { ffmpegPath: ffmpegInstaller.path, ffprobePath: ffprobeInstaller.path };
    }
  } catch {
  }
  return {
    ffmpegPath: `ffmpeg${ext}`,
    ffprobePath: `ffprobe${ext}`
  };
}
function probeMediaFile(filePath) {
  return new Promise((resolve, reject) => {
    const { ffprobePath } = getBinaryPaths();
    const args = [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      filePath
    ];
    const child = (0, import_child_process.spawn)(ffprobePath, args);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe failed with code ${code}: ${stderr}`));
      }
      try {
        const data = JSON.parse(stdout);
        const format = data.format || {};
        const streams = data.streams || [];
        const videoStream = streams.find((s) => s.codec_type === "video");
        const audioStream = streams.find((s) => s.codec_type === "audio");
        let duration = parseFloat(format.duration || "0");
        if (!duration && videoStream?.duration) {
          duration = parseFloat(videoStream.duration);
        }
        if (!duration && audioStream?.duration) {
          duration = parseFloat(audioStream.duration);
        }
        const width = videoStream ? parseInt(videoStream.width, 10) : void 0;
        const height = videoStream ? parseInt(videoStream.height, 10) : void 0;
        let fps;
        if (videoStream?.r_frame_rate) {
          const [num, den] = videoStream.r_frame_rate.split("/").map(Number);
          if (den && den !== 0) {
            fps = Math.round(num / den * 100) / 100;
          }
        }
        resolve({
          format: format.format_name || "unknown",
          duration: Math.max(0, duration),
          width,
          height,
          fps,
          size: parseInt(format.size || "0", 10),
          hasAudio: Boolean(audioStream),
          hasVideo: Boolean(videoStream)
        });
      } catch (err) {
        reject(new Error(`Failed to parse ffprobe output: ${err.message}`));
      }
    });
    child.on("error", (err) => {
      reject(new Error(`Could not execute ffprobe: ${err.message}`));
    });
  });
}
function exportMedia(options, onProgress) {
  return new Promise(async (resolve, reject) => {
    try {
      const { ffmpegPath } = getBinaryPaths();
      const tempDir = import_path.default.join(import_os.default.tmpdir(), "simple-video-editor-" + Date.now());
      import_fs.default.mkdirSync(tempDir, { recursive: true });
      const hasVideo = Boolean(options.videoPath && import_fs.default.existsSync(options.videoPath));
      const hasImages = Boolean(options.images && options.images.length > 0);
      const hasAudio = Boolean(options.audioPath && import_fs.default.existsSync(options.audioPath));
      if (!hasVideo && !hasImages) {
        return reject(new Error("No video or images provided for export."));
      }
      let visualDuration = 0;
      let sourceWidth = 1920;
      let sourceHeight = 1080;
      if (hasVideo && options.videoPath) {
        const videoProbe = await probeMediaFile(options.videoPath);
        visualDuration = videoProbe.duration || 1;
        if (videoProbe.width && videoProbe.height) {
          sourceWidth = videoProbe.width;
          sourceHeight = videoProbe.height;
        }
      } else if (hasImages && options.images) {
        visualDuration = options.images.reduce((acc, img) => acc + (img.duration || 3), 0);
        try {
          const imgProbe = await probeMediaFile(options.images[0].path);
          if (imgProbe.width && imgProbe.height) {
            sourceWidth = imgProbe.width;
            sourceHeight = imgProbe.height;
          }
        } catch {
        }
      }
      let audioDuration = 0;
      if (hasAudio && options.audioPath) {
        const audioProbe = await probeMediaFile(options.audioPath);
        audioDuration = audioProbe.duration || 0;
      }
      let targetDuration = visualDuration;
      let shouldLoopVisual = false;
      if (options.duplicateFillAudio && hasAudio && audioDuration > visualDuration) {
        shouldLoopVisual = true;
        targetDuration = audioDuration;
      } else if (hasAudio && !options.duplicateFillAudio) {
        targetDuration = visualDuration;
      }
      let scaleFilter = "";
      if (options.resolution === "720p") {
        scaleFilter = "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black";
      } else if (options.resolution === "1080p") {
        scaleFilter = "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black";
      } else if (options.resolution === "4k") {
        scaleFilter = "scale=3840:2160:force_original_aspect_ratio=decrease,pad=3840:2160:(ow-iw)/2:(oh-ih)/2:color=black";
      } else {
        scaleFilter = "scale=trunc(iw/2)*2:trunc(ih/2)*2";
      }
      let cropFilter = "";
      if (options.crop && options.crop.enabled) {
        const { x, y, width, height } = options.crop;
        cropFilter = `crop=w='trunc(iw*${width}/100/2)*2':h='trunc(ih*${height}/100/2)*2':x='trunc(iw*${x}/100/2)*2':y='trunc(ih*${y}/100/2)*2'`;
      }
      const vFilters = [];
      if (cropFilter) {
        vFilters.push(cropFilter);
      }
      if (scaleFilter) {
        vFilters.push(scaleFilter);
      }
      vFilters.push("format=yuv420p");
      const vfString = vFilters.join(",");
      const ffmpegArgs = ["-y"];
      if (hasVideo && options.videoPath) {
        if (shouldLoopVisual && targetDuration > visualDuration) {
          ffmpegArgs.push("-stream_loop", "-1");
        }
        ffmpegArgs.push("-i", options.videoPath);
        if (hasAudio && options.audioPath) {
          ffmpegArgs.push("-i", options.audioPath);
          ffmpegArgs.push("-map", "0:v:0");
          ffmpegArgs.push("-map", "1:a:0");
        } else {
          ffmpegArgs.push("-map", "0:v:0");
          ffmpegArgs.push("-map", "0:a?");
        }
        ffmpegArgs.push("-vf", vfString);
        ffmpegArgs.push("-c:v", "libx264", "-preset", "fast", "-crf", "22");
        if (hasAudio) {
          ffmpegArgs.push("-c:a", "aac", "-b:a", "192k");
        }
        ffmpegArgs.push("-t", targetDuration.toFixed(3));
        ffmpegArgs.push("-movflags", "+faststart");
        ffmpegArgs.push(options.outputPath);
      } else if (hasImages && options.images) {
        const concatFilePath = import_path.default.join(tempDir, "concat_list.txt");
        let concatContent = "";
        if (shouldLoopVisual && audioDuration > visualDuration) {
          let accumulated = 0;
          let loopIdx = 0;
          while (accumulated < targetDuration) {
            for (const img of options.images) {
              const dur = img.duration || 3;
              if (accumulated + dur >= targetDuration) {
                const finalDur = Math.max(0.1, targetDuration - accumulated);
                concatContent += `file '${img.path.replace(/'/g, "'\\''")}'
`;
                concatContent += `duration ${finalDur.toFixed(3)}
`;
                accumulated += finalDur;
                break;
              } else {
                concatContent += `file '${img.path.replace(/'/g, "'\\''")}'
`;
                concatContent += `duration ${dur.toFixed(3)}
`;
                accumulated += dur;
              }
            }
            loopIdx++;
            if (loopIdx > 1e3) break;
          }
          if (options.images.length > 0) {
            const lastImg = options.images[options.images.length - 1];
            concatContent += `file '${lastImg.path.replace(/'/g, "'\\''")}'
`;
          }
        } else {
          for (const img of options.images) {
            concatContent += `file '${img.path.replace(/'/g, "'\\''")}'
`;
            concatContent += `duration ${(img.duration || 3).toFixed(3)}
`;
          }
          const lastImg = options.images[options.images.length - 1];
          concatContent += `file '${lastImg.path.replace(/'/g, "'\\''")}'
`;
        }
        import_fs.default.writeFileSync(concatFilePath, concatContent, "utf8");
        ffmpegArgs.push("-f", "concat", "-safe", "0", "-i", concatFilePath);
        if (hasAudio && options.audioPath) {
          ffmpegArgs.push("-i", options.audioPath);
          ffmpegArgs.push("-map", "0:v:0");
          ffmpegArgs.push("-map", "1:a:0");
          ffmpegArgs.push("-c:a", "aac", "-b:a", "192k");
        } else {
          ffmpegArgs.push("-map", "0:v:0");
          ffmpegArgs.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
          ffmpegArgs.push("-map", "1:a:0");
          ffmpegArgs.push("-c:a", "aac", "-b:a", "128k");
          ffmpegArgs.push("-shortest");
        }
        ffmpegArgs.push("-vf", vfString);
        ffmpegArgs.push("-c:v", "libx264", "-preset", "fast", "-crf", "22");
        ffmpegArgs.push("-t", targetDuration.toFixed(3));
        ffmpegArgs.push("-movflags", "+faststart");
        ffmpegArgs.push(options.outputPath);
      }
      onProgress(5, "Starting FFmpeg processing...");
      const child = (0, import_child_process.spawn)(ffmpegPath, ffmpegArgs);
      let stderrBuffer = "";
      child.stderr.on("data", (chunk) => {
        const text = chunk.toString();
        stderrBuffer += text;
        const timeMatch = text.match(/time=(\d+):(\d+):(\d+\.\d+)/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const seconds = parseFloat(timeMatch[3]);
          const currentSeconds = hours * 3600 + minutes * 60 + seconds;
          if (targetDuration > 0) {
            const rawPct = currentSeconds / targetDuration * 90;
            const pct = Math.min(95, Math.max(5, Math.round(rawPct)));
            onProgress(pct, `Exporting... ${pct}%`);
          }
        }
      });
      child.on("close", (code) => {
        try {
          if (import_fs.default.existsSync(tempDir)) {
            import_fs.default.rmSync(tempDir, { recursive: true, force: true });
          }
        } catch {
        }
        if (code === 0 && import_fs.default.existsSync(options.outputPath)) {
          onProgress(100, "Export completed successfully.");
          resolve({ outputPath: options.outputPath });
        } else {
          reject(new Error(`FFmpeg processing failed (exit code ${code}). Details: ${stderrBuffer.slice(-500)}`));
        }
      });
      child.on("error", (err) => {
        reject(new Error(`FFmpeg failed to start: ${err.message}`));
      });
    } catch (err) {
      reject(err);
    }
  });
}

// electron/main.ts
var mainWindow = null;
function createWindow() {
  mainWindow = new import_electron.BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 1e3,
    minHeight: 650,
    title: "Simple Video Editor",
    backgroundColor: "#0f172a",
    autoHideMenuBar: true,
    webPreferences: {
      preload: import_path2.default.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  const isDev = process.env.NODE_ENV === "development" || !import_electron.app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
  } else {
    mainWindow.loadFile(import_path2.default.join(__dirname, "../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
import_electron.app.whenReady().then(() => {
  import_electron.ipcMain.handle("app:version", () => {
    return import_electron.app.getVersion();
  });
  import_electron.ipcMain.handle("dialog:open-video", async () => {
    if (!mainWindow) return { canceled: true };
    const result = await import_electron.dialog.showOpenDialog(mainWindow, {
      title: "Import Video",
      properties: ["openFile"],
      filters: [
        { name: "Video Files", extensions: ["mp4", "mov", "mkv", "avi", "webm"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { canceled: false, filePath: result.filePaths[0] };
  });
  import_electron.ipcMain.handle("dialog:open-images", async () => {
    if (!mainWindow) return { canceled: true };
    const result = await import_electron.dialog.showOpenDialog(mainWindow, {
      title: "Import Images",
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Image Files", extensions: ["jpg", "jpeg", "png", "webp", "bmp"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { canceled: false, filePaths: result.filePaths };
  });
  import_electron.ipcMain.handle("dialog:open-audio", async () => {
    if (!mainWindow) return { canceled: true };
    const result = await import_electron.dialog.showOpenDialog(mainWindow, {
      title: "Import Audio",
      properties: ["openFile"],
      filters: [
        { name: "Audio Files", extensions: ["mp3", "wav", "m4a", "aac", "flac", "ogg"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { canceled: false, filePath: result.filePaths[0] };
  });
  import_electron.ipcMain.handle("dialog:save-video", async (_event, defaultName) => {
    if (!mainWindow) return { canceled: true };
    const result = await import_electron.dialog.showSaveDialog(mainWindow, {
      title: "Export Video As",
      defaultPath: defaultName || `exported_video_${Date.now()}.mp4`,
      filters: [
        { name: "MP4 Video", extensions: ["mp4"] }
      ]
    });
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }
    return { canceled: false, filePath: result.filePath };
  });
  import_electron.ipcMain.handle("media:probe", async (_event, filePath) => {
    try {
      return await probeMediaFile(filePath);
    } catch (err) {
      console.error("Probe error:", err);
      throw new Error(err.message || "Could not read media information.");
    }
  });
  import_electron.ipcMain.handle("media:export", async (event, options) => {
    try {
      const result = await exportMedia(options, (percent, message) => {
        event.sender.send("export:progress", {
          status: percent >= 100 ? "completed" : "exporting",
          percent,
          message,
          outputPath: options.outputPath
        });
      });
      return { success: true, outputPath: result.outputPath };
    } catch (err) {
      console.error("Export error:", err);
      return { success: false, outputPath: "", error: err.message || "FFmpeg processing failed." };
    }
  });
  import_electron.ipcMain.handle("shell:open-folder", async (_event, filePath) => {
    if (import_fs2.default.existsSync(filePath)) {
      import_electron.shell.showItemInFolder(filePath);
      return true;
    }
    return false;
  });
  createWindow();
  import_electron.app.on("activate", () => {
    if (import_electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
import_electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    import_electron.app.quit();
  }
});
