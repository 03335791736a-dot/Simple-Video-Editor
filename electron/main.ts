import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { exportMedia, probeMediaFile } from './ffmpeg';
import { ExportJobOptions } from '../src/types/electron';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 1000,
    minHeight: 650,
    title: 'Simple Video Editor',
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Register IPC handlers

  ipcMain.handle('app:version', () => {
    return app.getVersion();
  });

  // Open Video Dialog
  ipcMain.handle('dialog:open-video', async () => {
    if (!mainWindow) return { canceled: true };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Video',
      properties: ['openFile'],
      filters: [
        { name: 'Video Files', extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { canceled: false, filePath: result.filePaths[0] };
  });

  // Open Images Dialog
  ipcMain.handle('dialog:open-images', async () => {
    if (!mainWindow) return { canceled: true };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Images',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Image Files', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { canceled: false, filePaths: result.filePaths };
  });

  // Open Audio Dialog
  ipcMain.handle('dialog:open-audio', async () => {
    if (!mainWindow) return { canceled: true };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Audio',
      properties: ['openFile'],
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { canceled: false, filePath: result.filePaths[0] };
  });

  // Save Video Dialog
  ipcMain.handle('dialog:save-video', async (_event, defaultName?: string) => {
    if (!mainWindow) return { canceled: true };
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Video As',
      defaultPath: defaultName || `exported_video_${Date.now()}.mp4`,
      filters: [
        { name: 'MP4 Video', extensions: ['mp4'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }
    return { canceled: false, filePath: result.filePath };
  });

  // Probe media using ffprobe
  ipcMain.handle('media:probe', async (_event, filePath: string) => {
    try {
      return await probeMediaFile(filePath);
    } catch (err: any) {
      console.error('Probe error:', err);
      throw new Error(err.message || 'Could not read media information.');
    }
  });

  // Export video using FFmpeg
  ipcMain.handle('media:export', async (event, options: ExportJobOptions) => {
    try {
      const result = await exportMedia(options, (percent, message) => {
        event.sender.send('export:progress', {
          status: percent >= 100 ? 'completed' : 'exporting',
          percent,
          message,
          outputPath: options.outputPath,
        });
      });

      return { success: true, outputPath: result.outputPath };
    } catch (err: any) {
      console.error('Export error:', err);
      return { success: false, outputPath: '', error: err.message || 'FFmpeg processing failed.' };
    }
  });

  // Open folder
  ipcMain.handle('shell:open-folder', async (_event, filePath: string) => {
    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
      return true;
    }
    return false;
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
